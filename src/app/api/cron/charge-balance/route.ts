import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { finalizeBalancePaymentSettlement } from "@/lib/complete-balance-payment";
import { assertChargeMatchesStored } from "@/lib/payments/charge-amount-guard";
import { humanizePaymentProcessorMessage } from "@/lib/email/payment-error-message";
import { moveMatchesBalanceReminder48hWindow } from "@/lib/quotes/estate-schedule";
import { isCollectibleBalance } from "@/lib/money/balance-residual";
import { isFullPaymentAtBookingService } from "@/app/quote/[quoteId]/quote-shared";

const HS_BASE = "https://api.hubapi.com/crm/v3/objects";
const HS_TASKS = `${HS_BASE}/tasks`;
const HS_ASSOC = `${HS_BASE}/tasks`;

/**
 * Vercel Cron: runs daily at 9 AM EST (14:00 UTC).
 * Auto-charges stored cards on the same calendar window as the 48hr balance email
 * (T-2 days before move for most tiers; Estate multi-day uses T-2 days before packing).
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
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const chargeDatePlusOneStr = threeDaysFromNow.toISOString().split("T")[0];

  const results = { charged: 0, failed: 0, skipped: 0, errors: [] as string[] };

  // ── T-2 window: residential/office/long-distance moves 2-3 days out ──
  const { data: windowMoves } = await supabase
    .from("moves")
    .select("*")
    .in("scheduled_date", [chargeDateStr, chargeDatePlusOneStr])
    .gt("balance_amount", 0)
    .not("square_card_id", "is", null)
    .not("deposit_paid_at", "is", null);

  // ── Defense-in-depth: full-payment services with ANY outstanding balance ──
  // WG / single_item / specialty / event / b2b / bin_rental should have paid
  // the full amount at booking. If any of them have balance > 0 with a card
  // on file, a client-side or server-side bug leaked a deposit-only charge
  // through (see MV-30356 / Erika Biro, 2026-07-06). Charge the balance
  // immediately — don't wait for T-2 — so short-notice bookings don't sit
  // uncollected. Payment gate in /api/payments/process now prevents new
  // leaks; this is the safety net that catches anything already in flight.
  const FULL_PAYMENT_SERVICES = [
    "white_glove",
    "specialty",
    "single_item",
    "event",
    "b2b_delivery",
    "b2b_oneoff",
    "bin_rental",
  ];
  const { data: leakedMoves } = await supabase
    .from("moves")
    .select("*")
    .in("service_type", FULL_PAYMENT_SERVICES)
    .gt("balance_amount", 0)
    .not("square_card_id", "is", null)
    .not("deposit_paid_at", "is", null)
    .is("balance_paid_at", null)
    .neq("payment_marked_paid", true);

  // Merge, dedupe by id (a full-pay move 2 days out would appear in both).
  const seen = new Set<string>();
  const moves = [
    ...(leakedMoves ?? []),
    ...(windowMoves ?? []),
  ].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  if (moves.length === 0) {
    return NextResponse.json({ ok: true, ...results, message: "No moves to charge" });
  }

  for (const move of moves) {
    // Skip the T-2 window check for full-payment services — they should
    // have paid at booking, we're catching a leak, not honoring a schedule.
    const isLeakedFullPay = isFullPaymentAtBookingService(move.service_type);
    if (
      !isLeakedFullPay &&
      !moveMatchesBalanceReminder48hWindow({
        scheduledDate: move.scheduled_date,
        twoDaysOutIso: chargeDateStr,
        tierSelected: move.tier_selected,
        serviceTier: move.service_tier,
        moveSize: move.move_size,
        inventoryScore:
          move.inventory_score != null ? Number(move.inventory_score) : null,
      })
    ) {
      results.skipped++;
      continue;
    }

    const balanceAmount = Number(move.balance_amount || 0);
    // Skip sub-$1 residuals (HST rounding noise on already-paid moves).
    // Charging these would fail at Square anyway — most regions reject
    // amounts under $1. See balance-residual.ts.
    if (!isCollectibleBalance(balanceAmount)) {
      results.skipped++;
      continue;
    }

    // Processing costs are already absorbed into the quoted price — charge the raw balance.
    const amountCents = Math.round(balanceAmount * 100);
    assertChargeMatchesStored({
      attemptedCents: amountCents,
      storedCents: Math.round(Number(move.balance_amount || 0) * 100),
      context: {
        site: "GET /api/cron/charge-balance",
        move_id: move.id,
        move_code: move.move_code,
      },
    });

    try {
      const { locationId } = await getSquarePaymentConfig();
      if (!locationId) throw new Error("Square location not configured");

      // Square idempotency key max is 45 chars — keep it short
      const shortId = move.id.replace(/-/g, "").slice(0, 20);
      const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const paymentRes = await squareClient.payments.create({
        sourceId: move.square_card_id,
        amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
        customerId: move.square_customer_id || undefined,
        buyerEmailAddress: move.client_email || undefined,
        referenceId: move.move_code || move.id,
        note: "Balance + processing fee, auto-charge",
        idempotencyKey: `ba-${shortId}-${dateStr}`,
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
        balanceTaxInclusive: balanceAmount,
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
        description: `Auto-charged card, $${balanceAmount.toFixed(2)} CAD (balance due window)`,
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
