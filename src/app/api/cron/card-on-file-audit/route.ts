import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { sendEmail } from "@/lib/email/send";
import { internalAdminAlertEmail } from "@/lib/email-templates";

/**
 * Vercel Cron: runs daily at 8 AM EST (13:00 UTC), before charge-balance (14:00)
 * and pre-move-emails (15:00). Scans upcoming moves whose deposit was paid but
 * have no Square card_id on the row — recovers it from Square if a card is on
 * the customer profile, otherwise flags the move so the 72h/48h emails route
 * the client to the e-transfer fallback and admins get a heads-up.
 *
 * Closes the gap that caused MV-30209 (Vasu Beachoo): Square stored the card
 * but the response ID was lost at checkout, so auto-charge silently skipped
 * the move and the client received a misleading "card on file" reminder.
 */
const HS_BASE = "https://api.hubapi.com/crm/v3/objects";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() + 1);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 10);
  const minIso = minDate.toISOString().split("T")[0];
  const maxIso = maxDate.toISOString().split("T")[0];

  const results = {
    scanned: 0,
    recovered: 0,
    flagged_no_card: 0,
    flagged_no_customer: 0,
    errors: [] as string[],
  };

  const { data: moves, error } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, scheduled_date, balance_amount, square_card_id, square_customer_id, hubspot_deal_id",
    )
    .gte("scheduled_date", minIso)
    .lte("scheduled_date", maxIso)
    .gt("balance_amount", 0)
    .not("deposit_paid_at", "is", null)
    .is("balance_paid_at", null)
    .is("square_card_id", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!moves || moves.length === 0) {
    return NextResponse.json({ ok: true, ...results, message: "No moves to audit" });
  }

  for (const move of moves) {
    results.scanned++;
    if (!move.client_email) continue;

    try {
      const searchRes = await squareClient.customers.search({
        query: { filter: { emailAddress: { exact: move.client_email } } },
      });
      const customer = searchRes.customers?.[0];
      const customerId = customer?.id;
      const cards = (customer as { cards?: Array<{ id?: string }> } | undefined)?.cards ?? [];
      const cardId = cards[0]?.id;

      if (customerId && cardId) {
        // Recover both — auto-charge will work on next run
        await supabase
          .from("moves")
          .update({
            square_card_id: cardId,
            square_customer_id: customerId,
          })
          .eq("id", move.id);
        await supabase.from("status_events").insert({
          entity_type: "move",
          entity_id: move.id,
          event_type: "system",
          description: `Recovered Square card on file from customer profile (audit). Auto-charge will resume.`,
          icon: "check",
        });
        results.recovered++;
        continue;
      }

      if (customerId && !cardId) {
        // Customer exists, no card stored — track customer for future and alert admin
        await supabase
          .from("moves")
          .update({ square_customer_id: customerId })
          .eq("id", move.id);
        results.flagged_no_card++;
        await alertNoCard(move, "Square customer found but no card on file. Client will receive e-transfer instructions in their balance reminder.");
        continue;
      }

      // No Square customer at all — most unusual; admin alert
      results.flagged_no_customer++;
      await alertNoCard(move, "No Square customer found by email. Client will receive e-transfer instructions in their balance reminder.");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${move.move_code}:${errorMsg}`);
    }
  }

  if (results.flagged_no_card > 0 || results.flagged_no_customer > 0 || results.errors.length > 0) {
    await supabase
      .from("webhook_logs")
      .insert({
        source: "cron_card_on_file_audit",
        event_type:
          results.errors.length > 0 ? "partial_failure" : "flagged",
        payload: results,
        status: results.errors.length > 0 ? "error" : "ok",
        error: results.errors.join("; ").slice(0, 500) || null,
      })
      .then(() => {});
  }

  return NextResponse.json({ ok: true, ...results });
}

async function alertNoCard(
  move: {
    id: string;
    move_code: string | null;
    client_name: string | null;
    client_email: string | null;
    scheduled_date: string | null;
    balance_amount: number | null;
    hubspot_deal_id: string | null;
  },
  reason: string,
): Promise<void> {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (adminEmail) {
    const balance = Number(move.balance_amount || 0);
    const dateDisplay = move.scheduled_date
      ? new Date(move.scheduled_date + "T00:00:00").toLocaleDateString("en-CA", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "TBD";
    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.yugoplus.co"}/admin/moves/${move.move_code || move.id}`;
    await sendEmail({
      to: adminEmail,
      subject: `No card on file: ${move.move_code} — manual balance collection needed`,
      html: internalAdminAlertEmail({
        kicker: "Action required",
        title: `No card on file — ${move.move_code || "Move"}`,
        summary: reason,
        keyValues: [
          { label: "Move", value: move.move_code || "—", accent: "forest" },
          { label: "Client", value: move.client_name || "—" },
          {
            label: "Email",
            valueHtml: move.client_email
              ? `<a href="mailto:${encodeURIComponent(move.client_email)}" style="color:#2C3E2D;text-decoration:underline;font-weight:600;">${move.client_email}</a>`
              : "—",
          },
          { label: "Move date", value: dateDisplay },
          { label: "Balance", value: `$${balance.toFixed(2)}`, accent: "forest" },
        ],
        callout: {
          label: "Next step",
          body: "Watch <strong>pay@helloyugo.com</strong> for an incoming e-transfer, or follow up with the client directly to confirm payment method.",
        },
        primaryCta: { label: "Open in admin", url: adminUrl },
        tone: "action",
      }),
    }).catch(() => {});
  }

  // HubSpot task so the deal owner sees it
  if (move.hubspot_deal_id && process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const taskRes = await fetch(`${HS_BASE}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            hs_task_subject: `Manual balance collection — ${move.move_code}`,
            hs_task_body: `${reason} Balance: $${Number(move.balance_amount || 0).toFixed(2)}. Watch pay@helloyugo.com for incoming e-transfer.`,
            hs_task_status: "NOT_STARTED",
            hs_task_priority: "HIGH",
            hs_due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          },
        }),
      });
      if (taskRes.ok) {
        const task = await taskRes.json();
        if (task?.id) {
          await fetch(
            `${HS_BASE}/tasks/${task.id}/associations/deals/${move.hubspot_deal_id}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify([
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: 204,
                },
              ]),
            },
          );
        }
      }
    } catch {
      // HubSpot task failures are non-critical
    }
  }
}
