import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { finalizeBalancePaymentSettlement } from "@/lib/complete-balance-payment";
import { humanizePaymentProcessorMessage } from "@/lib/email/payment-error-message";

const HS_BASE = "https://api.hubapi.com/crm/v3/objects";
const HS_TASKS = `${HS_BASE}/tasks`;
const HS_ASSOC = `${HS_BASE}/tasks`;

/**
 * Vercel Cron: runs daily at 9 AM EST (14:00 UTC).
 * Auto-charges stored cards at T-48hr for moves where balance is unpaid.
 * Processing costs are already baked into the quoted price — no fee added here.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date();

  const twoDaysFromNow = new Date(now);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const chargeDateStr = twoDaysFromNow.toISOString().split("T")[0];

  const results = { charged: 0, failed: 0, skipped: 0, errors: [] as string[] };

  const { data: moves } = await supabase
    .from("moves")
    .select("*")
    .eq("scheduled_date", chargeDateStr)
    .gt("balance_amount", 0)
    .not("square_card_id", "is", null)
    .not("deposit_paid_at", "is", null);

  if (!moves || moves.length === 0) {
    return NextResponse.json({ ok: true, ...results, message: "No moves to charge" });
  }

  for (const move of moves) {
    const balanceAmount = Number(move.balance_amount || 0);
    if (balanceAmount <= 0) {
      results.skipped++;
      continue;
    }

    // Processing costs are already absorbed into the quoted price — charge the raw balance.
    const amountCents = Math.round(balanceAmount * 100);

    try {
      const { locationId } = await getSquarePaymentConfig();
      if (!locationId) throw new Error("Square location not configured");

      const paymentRes = await squareClient.payments.create({
        sourceId: move.square_card_id,
        amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
        customerId: move.square_customer_id || undefined,
        referenceId: move.move_code || move.id,
        note: "Balance + processing fee, auto-charge",
        idempotencyKey: `bal-auto-${move.id}-${new Date().toISOString().split("T")[0]}`,
        locationId,
      });

      const paymentId = paymentRes.payment?.id;
      if (!paymentId) {
        throw new Error("Payment was not completed, no payment ID returned");
      }

      const receiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;
      await finalizeBalancePaymentSettlement({
        admin: supabase,
        moveId: move.id,
        balancePreTax: balanceAmount,
        squarePaymentId: paymentId,
        squareReceiptUrl: receiptUrl,
        settlementMethod: "auto-charge",
        paymentMarkedBy: "auto-charge",
        updateMoveReceiptUrl: !!receiptUrl,
      });

      await supabase.from("status_events").insert({
        entity_type: "move",
        entity_id: move.id,
        event_type: "payment_received",
        description: `Auto-charged card, $${balanceAmount.toFixed(2)} CAD (48 hrs before move)`,
        icon: "dollar",
      });

      // Send receipt to client
      if (move.client_email) {
        const trackToken = signTrackToken("move", move.id);
        const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;

        await sendEmail({
          to: move.client_email,
          subject: `Payment confirmed - ${formatCurrency(balanceAmount)} - ${move.move_code || "your move"}`,
          template: "balance-auto-charge-receipt",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            baseBalance: balanceAmount,
            processingFee: 0,
            transactionFee: 0,
            totalCharged: balanceAmount,
            trackingUrl,
          },
        }).catch(() => {});
      }

      results.charged++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${move.move_code}:${errorMsg}`);
      results.failed++;

      // Send URGENT alert to coordinator
      const adminEmail = process.env.SUPER_ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `URGENT: Balance charge failed ${move.move_code || move.id}`,
          template: "balance-charge-failed-admin",
          data: {
            clientName: move.client_name || "",
            clientEmail: move.client_email || "",
            clientPhone: move.client_phone || "",
            moveCode: move.move_code || move.id,
            moveDate: move.scheduled_date,
            balanceAmount,
            errorMessage: errorMsg,
          },
        }).catch(() => {});
      }

      // Send failure notice to client
      if (move.client_email) {
        await sendEmail({
          to: move.client_email,
          subject: `Action required - payment issue for ${move.move_code || "your move"}`,
          template: "balance-charge-failed-client",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            balanceAmount,
          },
        }).catch(() => {});
      }

      // Create HubSpot task
      if (move.hubspot_deal_id) {
        await createHubSpotTask(
          move.hubspot_deal_id,
          `URGENT: Balance payment failed ${move.move_code}`,
          `Auto-charge for $${balanceAmount.toFixed(2)} balance failed. Move is tomorrow. Error: ${humanizePaymentProcessorMessage(errorMsg)}. Contact client immediately.`,
        );
      }
    }
  }

  if (results.errors.length > 0) {
    await supabase.from("webhook_logs").insert({
      source: "cron_charge_balance",
      event_type: "partial_failure",
      payload: results,
      status: "error",
      error: results.errors.join("; ").slice(0, 500),
    }).then(() => {});
  }

  return NextResponse.json({ ok: true, ...results });
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── HubSpot Task Creation ── */

async function createHubSpotTask(
  dealId: string,
  subject: string,
  body: string,
): Promise<void> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;

  try {
    const taskRes = await fetch(HS_TASKS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_task_subject: subject,
          hs_task_body: body,
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "HIGH",
          hs_due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
      }),
    });

    if (!taskRes.ok) return;
    const task = await taskRes.json();
    const taskId = task?.id;
    if (!taskId) return;

    await fetch(`${HS_ASSOC}/${taskId}/associations/deals/${dealId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 },
      ]),
    });
  } catch {
    // HubSpot task failures are non-critical
  }
}
