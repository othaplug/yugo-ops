import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

/**
 * Vercel Cron: runs daily at 6 AM EST.
 *
 * Billing model — the billing cycle IS the payment window:
 *
 * Net 30:  Monthly statement on anchor day. Period = prior 30 days.
 *          Due date = statement date (anchor day). Max wait per delivery: 30 days.
 *          Example: anchor = 1st. Apr 1–30 deliveries → May 1 statement. Due: May 1.
 *
 * Net 15:  Two statements per month. Always runs on the 1st AND the 16th.
 *          Due date = statement date. Max wait per delivery: 15 days.
 *          Example: Apr 1–15 deliveries → Apr 16 statement. Due: Apr 16.
 *                   Apr 16–30 deliveries → May 1 statement. Due: May 1.
 *
 * Due on Receipt: Per-delivery invoices only — NOT handled here (generated on delivery completion).
 *
 * Overdue: A statement whose due_date has passed (due_date < today) and is still unpaid
 *          gets flagged as "overdue" starting the calendar day after the anchor date.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const dayOfMonth = today.getDate();
  const todayStr = today.toISOString().slice(0, 10);
  const results = { generated: 0, overdue: 0, errors: [] as string[] };

  // ── PART 1: Collect partners to bill today ──
  //
  // Primary: partners whose billing_anchor_day matches today.
  // Secondary: Net 15 partners with anchor=1 also run on the 16th.
  const baseQuery = supabase
    .from("organizations")
    .select("id, name, email, billing_email, payment_terms, billing_anchor_day, billing_method")
    .eq("onboarding_status", "active")
    .eq("billing_method", "monthly_statement");

  const [{ data: anchorPartners }, { data: net15MidMonth }] = await Promise.all([
    baseQuery.eq("billing_anchor_day", dayOfMonth),
    // On the 16th: also run Net 15 partners whose anchor is 1
    dayOfMonth === 16
      ? supabase
          .from("organizations")
          .select("id, name, email, billing_email, payment_terms, billing_anchor_day, billing_method")
          .eq("onboarding_status", "active")
          .eq("billing_method", "monthly_statement")
          .eq("payment_terms", "net_15")
          .eq("billing_anchor_day", 1)
      : Promise.resolve({ data: [] }),
  ]);

  // Deduplicate by id (a Net 15 partner with anchor=16 would appear twice on the 16th otherwise)
  const seenIds = new Set<string>();
  const partners: typeof anchorPartners = [];
  for (const p of [...(anchorPartners ?? []), ...(net15MidMonth ?? [])]) {
    if (!seenIds.has(p.id)) { seenIds.add(p.id); partners.push(p); }
  }

  // ── PART 2: Generate statements ──
  for (const partner of partners) {
    try {
      const terms = partner.payment_terms || "net_30";

      // Due on Receipt partners should not have monthly statements — skip gracefully
      if (terms === "due_on_receipt" || terms === "due_on_delivery") continue;

      // Cycle length: 15 days for Net 15, 30 days for everything else
      const cycleDays = terms === "net_15" ? 15 : 30;

      // Period: yesterday back to cycleDays-1 days before that
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() - 1);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - (cycleDays - 1));

      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, completed_at, price, item_description, status")
        .eq("partner_id", partner.id)
        .eq("status", "completed")
        .gte("completed_at", periodStart.toISOString().slice(0, 10) + "T00:00:00Z")
        .lte("completed_at", periodEnd.toISOString().slice(0, 10) + "T23:59:59Z")
        .is("statement_id", null);

      if (!deliveries || deliveries.length === 0) continue;

      const subtotal = deliveries.reduce((s, d) => s + (Number(d.price) || 0), 0);
      const hst = Math.round(subtotal * 0.13 * 100) / 100;
      const total = subtotal + hst;

      // Due date = today (the anchor / statement date). The billing cycle IS the payment window.
      const dueDate = todayStr;

      // Statement number: include a half-month suffix for Net 15 mid-month runs
      const monthStr = today.toISOString().slice(0, 7).replace("-", "");
      const partnerCode = partner.id.slice(0, 4).toUpperCase();
      const halfSuffix = terms === "net_15" && dayOfMonth === 16 ? "B" : "A";
      const statementNumber = terms === "net_15"
        ? `STM-${partnerCode}-${monthStr}-${halfSuffix}`
        : `STM-${partnerCode}-${monthStr}`;

      const { data: stmt, error: stmtErr } = await supabase
        .from("partner_statements")
        .insert({
          partner_id: partner.id,
          statement_number: statementNumber,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
          deliveries: deliveries.map((d) => ({
            id: d.id,
            number: d.delivery_number,
            date: d.completed_at,
            price: d.price,
            description: d.item_description,
          })),
          delivery_count: deliveries.length,
          subtotal,
          hst,
          total,
          due_date: dueDate,
          payment_terms: terms,
          status: "draft",
        })
        .select()
        .single();

      if (stmtErr || !stmt) {
        results.errors.push(`${partner.name}: ${stmtErr?.message || "insert failed"}`);
        continue;
      }

      // Link deliveries to statement
      await supabase
        .from("deliveries")
        .update({ statement_id: stmt.id })
        .in("id", deliveries.map((d) => d.id));

      // Send statement email
      const billingEmail = partner.billing_email || partner.email;
      const baseUrl = getEmailBaseUrl();
      if (billingEmail) {
        const periodLabel = `${new Date(periodStart).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}–${new Date(periodEnd).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;
        const statementUrl = `${baseUrl}/admin/partners/statements/${stmt.id}`;
        const html = buildStatementEmail({
          partnerName: partner.name,
          statementNumber,
          periodLabel,
          deliveryCount: deliveries.length,
          subtotal,
          hst,
          total,
          dueDate,
          paymentTerms: terms,
          statementUrl,
        });

        await sendEmail({
          to: billingEmail,
          subject: `Yugo Statement ${statementNumber} — $${total.toFixed(2)} due today`,
          html,
        });

        await supabase
          .from("partner_statements")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", stmt.id);
      }

      results.generated++;
    } catch (err) {
      results.errors.push(`${partner.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── PART 3: Mark overdue statements ──
  // A statement is overdue starting the calendar day AFTER its due_date.
  // due_date < todayStr means due_date is strictly before today — i.e., yesterday or earlier.
  // New statements generated today (due_date = today) are never flagged overdue on the same run.
  const { data: overdueStmts } = await supabase
    .from("partner_statements")
    .select("id, partner_id, statement_number, total, organizations(name, billing_email, email)")
    .lt("due_date", todayStr)
    .in("status", ["sent", "viewed"]);

  for (const stmt of overdueStmts ?? []) {
    try {
      await supabase
        .from("partner_statements")
        .update({ status: "overdue" })
        .eq("id", stmt.id);

      const orgs = stmt.organizations as { name: string; billing_email?: string; email?: string }[] | { name: string; billing_email?: string; email?: string } | null;
      const org = Array.isArray(orgs) ? orgs[0] ?? null : orgs;
      const billingEmail = org?.billing_email || org?.email;
      if (billingEmail) {
        await sendEmail({
          to: billingEmail,
          subject: `Statement ${stmt.statement_number} is overdue — $${Number(stmt.total).toFixed(2)}`,
          html: buildOverdueEmail({
            partnerName: org?.name || "Partner",
            statementNumber: stmt.statement_number,
            total: Number(stmt.total),
          }),
        });
      }
      results.overdue++;
    } catch (err) {
      results.errors.push(`overdue:${stmt.statement_number}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

function buildStatementEmail(opts: {
  partnerName: string;
  statementNumber: string;
  periodLabel: string;
  deliveryCount: number;
  subtotal: number;
  hst: number;
  total: number;
  dueDate: string;
  paymentTerms: string;
  statementUrl: string;
}): string {
  const dueDateLabel = new Date(opts.dueDate + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const cycleMap: Record<string, string> = {
    net_30: "Net 30 — monthly statement, due on statement date. The billing cycle is your payment window.",
    net_15: "Net 15 — bi-monthly statement (1st & 16th), due on statement date. Max 15-day payment window.",
    due_on_receipt: "Due on Receipt",
    prepay: "Pre-paid",
  };
  const cycleLabel = cycleMap[opts.paymentTerms] || opts.paymentTerms;

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#f5f4f2;margin:0;padding:0;font-family:'Inter',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#0d0b08;border-radius:12px;padding:28px;margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C9A962;margin:0 0 4px;">Yugo+</p>
      <h1 style="font-size:20px;font-weight:700;color:#e8e0d0;margin:0 0 2px;">Statement Ready</h1>
      <p style="font-size:12px;color:#9c9489;margin:0;">${opts.statementNumber}</p>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;">
      <p style="font-size:14px;color:#1a1714;margin:0 0 16px;">Hi ${opts.partnerName},</p>
      <p style="font-size:13px;color:#4a4540;margin:0 0 20px;">Your Yugo statement for <strong>${opts.periodLabel}</strong> is ready. Payment is due <strong>today, ${dueDateLabel}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:12px;color:#6b6560;">Deliveries</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#1a1714;text-align:right;font-weight:600;">${opts.deliveryCount}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:12px;color:#6b6560;">Subtotal</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#1a1714;text-align:right;">$${opts.subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:12px;color:#6b6560;">HST (13%)</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#1a1714;text-align:right;">$${opts.hst.toFixed(2)}</td></tr>
        <tr><td style="padding:10px 0 0;font-size:14px;color:#1a1714;font-weight:700;">Total Due</td><td style="padding:10px 0 0;font-size:16px;color:#B8962E;text-align:right;font-weight:700;">$${opts.total.toFixed(2)}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px 16px;background:#fef3cd;border-radius:8px;font-size:12px;color:#856404;border:1px solid #fde68a;">
        <strong>Payment due: ${dueDateLabel}</strong> &mdash; ${cycleLabel}
      </div>
      <div style="margin-top:20px;text-align:center;">
        <a href="${opts.statementUrl}" style="display:inline-block;background:#B8962E;color:#0d0b08;padding:12px 28px;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:1.2px;text-transform:uppercase;border-radius:8px;">View Statement</a>
      </div>
    </div>
    <p style="font-size:11px;color:#9c9489;text-align:center;">Questions? Reply to this email or contact your Yugo coordinator.</p>
  </div>
</body></html>`;
}

function buildOverdueEmail(opts: { partnerName: string; statementNumber: string; total: number }): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#f5f4f2;margin:0;padding:0;font-family:'Inter',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1a0a0a;border-radius:12px;padding:28px;margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin:0 0 4px;">PAYMENT OVERDUE</p>
      <h1 style="font-size:20px;font-weight:700;color:#e8e0d0;margin:0;">${opts.statementNumber}</h1>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;">
      <p style="font-size:14px;color:#1a1714;margin:0 0 12px;">Hi ${opts.partnerName},</p>
      <p style="font-size:13px;color:#4a4540;margin:0 0 20px;">Statement <strong>${opts.statementNumber}</strong> for <strong>$${opts.total.toFixed(2)}</strong> is now overdue. Please arrange payment at your earliest convenience.</p>
      <p style="font-size:12px;color:#9c9489;">If you have already sent payment, please disregard this notice. Contact your Yugo coordinator to confirm.</p>
    </div>
  </div>
</body></html>`;
}
