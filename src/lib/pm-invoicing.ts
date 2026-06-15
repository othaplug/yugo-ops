import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import type { Currency } from "square";

type Sb = ReturnType<typeof createAdminClient>;

/** Revenue for a move row — final_amount > total_price > amount > estimate. */
export function moveRevenue(m: {
  total_price?: number | null;
  amount?: number | null;
  estimate?: number | null;
  final_amount?: number | null;
}): number {
  const fa = m.final_amount != null ? Number(m.final_amount) : null;
  const tp = m.total_price != null ? Number(m.total_price) : null;
  const am = m.amount != null ? Number(m.amount) : null;
  const es = m.estimate != null ? Number(m.estimate) : null;
  return fa ?? tp ?? am ?? es ?? 0;
}

/**
 * Billing-cycle due date. The auto-send cron passes the run date, so the invoice
 * is "due on the day it is sent" (15th → due 15th, month-end → due that day).
 * Manual generation also lands on the nearest cycle date.
 * - On or before the 15th → due on the 15th of the current month
 * - 16th onward            → due on the last calendar day of the current month
 */
export function calcDueDate(now: Date = new Date()): string {
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (day <= 15) return new Date(y, m, 15).toISOString().slice(0, 10);
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, lastDay).toISOString().slice(0, 10);
}

type PmMove = {
  id: string;
  move_code?: string | null;
  client_name?: string | null;
  tenant_name?: string | null;
  scheduled_date?: string | null;
  total_price?: number | null;
  amount?: number | null;
  estimate?: number | null;
  final_amount?: number | null;
  from_address?: string | null;
  to_address?: string | null;
};

const MOVE_SELECT =
  "id, move_code, client_name, tenant_name, scheduled_date, total_price, amount, estimate, final_amount, from_address, to_address";

/**
 * Square requires invoice numbers to be unique per location. The base number is
 * derived from the billing cycle, so a partner billed twice in the same cycle
 * (e.g. a catch-up invoice) would collide and Square rejects the publish. Append
 * -2, -3, … until the number is unused among this partner's invoices.
 */
async function uniqueInvoiceNumber(
  sb: Sb,
  partnerId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const { data } = await sb
    .from("partner_invoices")
    .select("id, invoice_number")
    .eq("organization_id", partnerId)
    .or(`invoice_number.eq.${base},invoice_number.like.${base}-%`);
  const taken = new Set(
    (data ?? [])
      .filter((r) => r.id !== excludeId)
      .map((r) => String(r.invoice_number)),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export type PmInvoiceResult =
  | {
      ok: true;
      sent: boolean;
      invoice_id: string;
      invoice_number: string;
      status: "sent" | "draft";
      due_date: string;
      period_start: string;
      period_end: string;
      total_amount: number;
      move_count: number;
      square_invoice_id?: string | null;
      square_invoice_url?: string | null;
      warning?: string;
    }
  | { ok: false; code: number; error: string; invoice_id?: string };

/**
 * Generate (or resume) and SEND a Square invoice for a PM partner's unbilled
 * completed moves.
 *
 * Self-healing: if a previous attempt created a draft row but the Square publish
 * failed (square_invoice_id is null) and its moves are still linked, we re-use
 * that draft and retry the publish instead of erroring "no unbilled moves".
 * That makes the admin "Generate invoice" button safe to click again until the
 * invoice actually sends.
 */
export async function generateAndSendPmInvoice(
  sb: Sb,
  partnerId: string,
  opts: { now?: Date; dryRun?: boolean } = {},
): Promise<PmInvoiceResult> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;

  // 1. Resolve partner
  const { data: org } = await sb
    .from("organizations")
    .select("id, name, legal_name, contact_name, email, billing_email")
    .eq("id", partnerId)
    .maybeSingle();
  if (!org) return { ok: false, code: 404, error: "Partner not found" };

  const recipientEmail =
    (org.billing_email && String(org.billing_email).trim()) ||
    (org.email && String(org.email).trim()) ||
    null;

  // 2. Resume a stuck draft if one exists (publish previously failed)
  const { data: stuckDraft } = await sb
    .from("partner_invoices")
    .select("id, invoice_number, period_start, period_end, total_amount, due_date")
    .eq("organization_id", partnerId)
    .eq("status", "draft")
    .is("square_invoice_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let invoiceId: string;
  let invoiceNumber: string;
  let periodStart: string;
  let periodEnd: string;
  let dueDate: string;
  let totalAmount: number;
  let moves: PmMove[];

  if (stuckDraft) {
    const { data: linked } = await sb
      .from("moves")
      .select(MOVE_SELECT)
      .eq("invoice_id", stuckDraft.id);
    moves = (linked ?? []) as PmMove[];
    if (moves.length === 0) {
      // Empty draft is useless — clean it up and fall through to a fresh build.
      await sb.from("partner_invoices").delete().eq("id", stuckDraft.id);
    } else {
      invoiceId = stuckDraft.id;
      periodStart = stuckDraft.period_start as string;
      periodEnd = stuckDraft.period_end as string;
      dueDate = (stuckDraft.due_date as string) || calcDueDate(now);
      totalAmount = Number(stuckDraft.total_amount);
      // The previous publish may have failed on a duplicate number — re-resolve
      // to a unique one (excluding this draft) and persist it before retrying.
      invoiceNumber = await uniqueInvoiceNumber(
        sb,
        partnerId,
        stuckDraft.invoice_number as string,
        stuckDraft.id,
      );
      if (invoiceNumber !== stuckDraft.invoice_number) {
        await sb
          .from("partner_invoices")
          .update({ invoice_number: invoiceNumber })
          .eq("id", invoiceId);
      }
      return finishViaSquare();
    }
  }

  // 3. Fresh build from unbilled completed PM moves
  const { data: unbilled, error: movesError } = await sb
    .from("moves")
    .select(MOVE_SELECT)
    .eq("organization_id", partnerId)
    .eq("is_pm_move", true)
    .in("status", ["completed", "delivered", "paid"])
    .is("invoice_id", null)
    .order("scheduled_date", { ascending: true });

  if (movesError) return { ok: false, code: 500, error: movesError.message };
  moves = (unbilled ?? []) as PmMove[];
  if (moves.length === 0) {
    return {
      ok: false,
      code: 409,
      error: "No unbilled completed PM moves for this partner",
    };
  }

  const sortedDates = moves
    .map((m) => String(m.scheduled_date || "").trim())
    .filter(Boolean)
    .sort();
  periodStart = sortedDates[0] || now.toISOString().slice(0, 10);
  periodEnd = sortedDates[sortedDates.length - 1] || periodStart;
  dueDate = calcDueDate(now);
  totalAmount = Math.round(moves.reduce((s, m) => s + moveRevenue(m), 0) * 100) / 100;
  if (totalAmount <= 0) {
    return {
      ok: false,
      code: 422,
      error: "All linked moves resolved to $0 — refusing to invoice",
    };
  }
  const orgCode = partnerId.slice(0, 4).toUpperCase();
  const cycleTag = dueDate.replaceAll("-", "").slice(2, 8); // YYMMDD
  invoiceNumber = await uniqueInvoiceNumber(sb, partnerId, `INV-${orgCode}-${cycleTag}`);

  const { data: invoice, error: insertErr } = await sb
    .from("partner_invoices")
    .insert({
      organization_id: partnerId,
      invoice_number: invoiceNumber,
      status: "draft",
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      due_date: dueDate,
      notes: `${moves.length} PM move${moves.length === 1 ? "" : "s"} — billing cycle through ${dueDate}`,
    })
    .select()
    .single();
  if (insertErr || !invoice) {
    return { ok: false, code: 500, error: insertErr?.message ?? "Failed to create invoice row" };
  }
  invoiceId = invoice.id;

  const linkRes = await sb
    .from("moves")
    .update({ invoice_id: invoiceId })
    .in("id", moves.map((m) => m.id));
  if (linkRes.error) {
    await sb.from("partner_invoices").delete().eq("id", invoiceId);
    return { ok: false, code: 500, error: linkRes.error.message };
  }

  if (dryRun) {
    return {
      ok: true,
      sent: false,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      status: "draft",
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      move_count: moves.length,
    };
  }

  return finishViaSquare();

  /** Publish (or re-publish) the current draft to Square and mark it sent. */
  async function finishViaSquare(): Promise<PmInvoiceResult> {
    if (!(process.env.SQUARE_ACCESS_TOKEN || "").trim()) {
      return drafted("Square not configured — invoice saved locally only");
    }
    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return drafted("Square location not configured — invoice saved locally only");
    }

    const currency = "CAD" as Currency;
    const idem = (suffix: string) => `${suffix}-pminv-${invoiceId}`;
    const displayCompany = (org!.legal_name || org!.name || "Partner").trim();

    try {
      // Find or create Square customer
      let squareCustomerId: string | null = null;
      if (recipientEmail) {
        try {
          const searchRes = await squareClient.customers.search({
            query: { filter: { emailAddress: { exact: recipientEmail } } },
          });
          if (searchRes.customers && searchRes.customers.length > 0) {
            squareCustomerId = searchRes.customers[0].id ?? null;
          }
        } catch {
          /* fall through to create */
        }
      }
      if (!squareCustomerId) {
        const customerRes = await squareClient.customers.create({
          idempotencyKey: idem("customer"),
          givenName: (org!.contact_name || displayCompany).slice(0, 100),
          emailAddress: recipientEmail || undefined,
          companyName: displayCompany.slice(0, 255),
        });
        squareCustomerId = customerRes.customer?.id ?? null;
      }

      const lineItems = moves.map((m) => {
        const tenant =
          (m.tenant_name && String(m.tenant_name).trim()) ||
          (m.client_name && String(m.client_name).trim()) ||
          "PM Move";
        const dateLabel = String(m.scheduled_date || "").slice(0, 10);
        const subtotalCents = Math.round(moveRevenue(m) * 100);
        return {
          name: `${m.move_code || "PM Move"} — ${tenant}${dateLabel ? ` (${dateLabel})` : ""}`,
          quantity: "1",
          basePriceMoney: { amount: BigInt(subtotalCents), currency },
          note: m.to_address ? `To: ${String(m.to_address).slice(0, 200)}` : undefined,
        };
      });
      const hstCents = Math.round(totalAmount * 0.13 * 100);
      lineItems.push({
        name: "HST (13%)",
        quantity: "1",
        basePriceMoney: { amount: BigInt(hstCents), currency },
        note: undefined,
      });

      const orderRes = await squareClient.orders.create({
        order: {
          locationId,
          customerId: squareCustomerId || undefined,
          pricingOptions: { autoApplyTaxes: false, autoApplyDiscounts: false },
          lineItems,
        },
        idempotencyKey: idem("order"),
      });
      const orderId = orderRes.order?.id;
      if (!orderId) throw new Error("Square order creation returned no orderId");

      const invoiceRes = await squareClient.invoices.create({
        invoice: {
          orderId,
          locationId,
          primaryRecipient: squareCustomerId ? { customerId: squareCustomerId } : undefined,
          paymentRequests: [
            { requestType: "BALANCE", dueDate, automaticPaymentSource: "NONE" },
          ],
          deliveryMethod: recipientEmail ? "EMAIL" : "SHARE_MANUALLY",
          invoiceNumber,
          title: `Yugo+ Property Management — ${displayCompany}`,
          description: `Billing cycle ${periodStart} – ${periodEnd}. ${moves.length} move${moves.length === 1 ? "" : "s"}.`,
          acceptedPaymentMethods: { card: true, bankAccount: false, squareGiftCard: false },
        },
        idempotencyKey: idem("invoice"),
      });
      const sqInv = invoiceRes.invoice;
      if (!sqInv?.id) throw new Error("Square invoice creation returned no id");

      await squareClient.invoices.publish({
        invoiceId: sqInv.id,
        version: sqInv.version ?? 0,
        idempotencyKey: idem("publish"),
      });

      const squareUrl = (sqInv as { publicUrl?: string }).publicUrl ?? null;
      await sb
        .from("partner_invoices")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          square_invoice_id: sqInv.id,
          square_invoice_url: squareUrl,
        })
        .eq("id", invoiceId);

      return {
        ok: true,
        sent: true,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        status: "sent",
        due_date: dueDate,
        period_start: periodStart,
        period_end: periodEnd,
        total_amount: totalAmount,
        move_count: moves.length,
        square_invoice_id: sqInv.id,
        square_invoice_url: squareUrl,
      };
    } catch (err) {
      // Leave the draft + linked moves in place so the next click resumes it.
      console.error("[pm-invoicing] Square publish failed:", err);
      return {
        ok: false,
        code: 502,
        invoice_id: invoiceId,
        error: err instanceof Error ? err.message : "Square publish failed",
      };
    }
  }

  /** Square unavailable — keep the local draft and report a soft warning. */
  function drafted(warning: string): PmInvoiceResult {
    return {
      ok: true,
      sent: false,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      status: "draft",
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      move_count: moves.length,
      warning,
    };
  }
}
