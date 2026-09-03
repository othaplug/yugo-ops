import { NextResponse } from "next/server";
import { squareClient } from "@/lib/square";
import { squareIdem } from "@/lib/square-idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { requireStaff } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

const REASON_LABELS: Record<string, string> = {
  client_requested: "Client requested",
  date_conflict: "Date conflict",
  scope_changed: "Scope changed",
  payment_issue: "Payment issue",
  other: "Other",
};

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireStaff();
    if (authError) return authError;

    const rl = rateLimit(`cancel:${user!.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const {
      moveId,
      reason,
      reasonDetail,
      refundType,
      refundAmount,
    } = body as {
      moveId: string;
      reason: string;
      reasonDetail?: string;
      refundType: "full" | "partial" | "none";
      refundAmount?: number;
    };

    if (!moveId || !reason || !refundType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: move, error: moveErr } = await supabase
      .from("moves")
      .select("*")
      .eq("id", moveId)
      .single();

    if (moveErr || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    if (move.status === "cancelled") {
      return NextResponse.json({ error: "Move is already cancelled" }, { status: 409 });
    }

    /* ── 1. Square Refund (if applicable) ── */
    let squareRefundId: string | null = null;
    let actualRefundAmount = 0;

    const refundReason = `${REASON_LABELS[reason] || reason}${reasonDetail ? ` ${reasonDetail}` : ""}`;

    // Every collected Square payment on the move, grouped by payment id, summed
    // to the captured amount. Previously a "full" refund refunded ONLY
    // deposit_amount against the deposit payment, so a move whose balance had
    // been collected as a separate Square payment (T-2 auto-charge or a portal
    // balance payment) was under-refunded by the entire balance. The ledger is
    // the source of truth for what was actually charged; any row with a
    // square_payment_id is a real, refundable card collection.
    const { data: ledgerPayments } = await supabase
      .from("move_payment_ledger")
      .select("square_payment_id, pre_tax_amount, hst_amount")
      .eq("move_id", moveId)
      .in("entry_type", ["deposit", "balance"])
      .not("square_payment_id", "is", null);
    const capturedByPayment = new Map<string, number>();
    for (const row of ledgerPayments ?? []) {
      const pid = String(row.square_payment_id);
      const cents = Math.round(
        (Number(row.pre_tax_amount || 0) + Number(row.hst_amount || 0)) * 100,
      );
      if (cents > 0) capturedByPayment.set(pid, (capturedByPayment.get(pid) ?? 0) + cents);
    }
    const totalCapturedCents = Array.from(capturedByPayment.values()).reduce((a, b) => a + b, 0);

    if (refundType === "full") {
      // Refund every collected payment in full. Fall back to the legacy
      // single deposit payment when the ledger has no rows (older moves).
      const targets: [string, number][] =
        capturedByPayment.size > 0
          ? Array.from(capturedByPayment.entries())
          : move.square_payment_id && Number(move.deposit_amount) > 0
            ? [[move.square_payment_id as string, Math.round(Number(move.deposit_amount) * 100)]]
            : [];
      for (const [paymentId, cents] of targets) {
        if (cents <= 0) continue;
        try {
          const refundRes = await squareClient.refunds.refundPayment({
            paymentId,
            amountMoney: { amount: BigInt(cents), currency: "CAD" },
            reason: refundReason,
            idempotencyKey: squareIdem("refund", moveId, paymentId),
          });
          if (refundRes.refund?.id) squareRefundId = refundRes.refund.id;
          actualRefundAmount += cents / 100;
        } catch (e) {
          console.error("[Square] full refund failed for payment", paymentId, e);
          return NextResponse.json(
            {
              error: "Refund failed. Some payments may have been refunded. Please review in the Square Dashboard.",
              detail: e instanceof Error ? e.message : String(e),
              refunded_so_far: Math.round(actualRefundAmount * 100) / 100,
            },
            { status: 500 },
          );
        }
      }
    } else if (refundType === "partial" && move.square_payment_id) {
      // Refund the admin-specified amount against the deposit payment, capped at
      // the total actually collected so a typo can't request an over-refund.
      const requestedCents = Math.round((refundAmount ?? 0) * 100);
      const capCents = totalCapturedCents > 0 ? totalCapturedCents : requestedCents;
      const refundCents = Math.min(requestedCents, capCents);
      if (refundCents > 0) {
        try {
          const refundRes = await squareClient.refunds.refundPayment({
            paymentId: move.square_payment_id,
            amountMoney: { amount: BigInt(refundCents), currency: "CAD" },
            reason: refundReason,
            idempotencyKey: squareIdem("refund", moveId, `partial-${refundCents}`),
          });
          squareRefundId = refundRes.refund?.id ?? null;
          actualRefundAmount = refundCents / 100;
        } catch (e) {
          console.error("[Square] partial refund failed:", e);
          return NextResponse.json(
            { error: "Refund failed. Please process manually in Square Dashboard.", detail: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      }
    }

    /* ── 2. Update move → cancelled ── */
    const now = new Date().toISOString();
    const reasonLabel = REASON_LABELS[reason] || reason;
    const fullReason = reasonDetail ? `${reasonLabel}: ${reasonDetail}` : reasonLabel;

    await supabase
      .from("moves")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: fullReason,
        refund_amount: actualRefundAmount > 0 ? actualRefundAmount : null,
        refund_id: squareRefundId,
        updated_at: now,
      })
      .eq("id", moveId);

    /* ── 3. HubSpot → Closed Lost ── */
    if (move.hubspot_deal_id) {
      syncDealStage(move.hubspot_deal_id, "cancelled").catch(() => {});

      const token = process.env.HUBSPOT_ACCESS_TOKEN;
      if (token) {
        safePatchDeal(token, move.hubspot_deal_id, {
          hs_is_closed_won: "false",
          closed_lost_reason: fullReason,
          closedate: now,
        }).catch(() => {});
      }
    }

    /* ── 4. Cancellation email to client ── */
    const clientEmail = move.client_email;
    if (clientEmail) {
      const baseUrl = getEmailBaseUrl();
      const trackToken = signTrackToken("move", moveId);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? moveId}?token=${trackToken}`;

      sendEmail({
        to: clientEmail,
        subject: `Cancellation confirmed ${move.move_code || moveId}`,
        template: "cancellation-confirm",
        data: {
          clientName: move.client_name || "",
          moveCode: move.move_code || moveId,
          fromAddress: move.from_address || "",
          toAddress: move.to_address || move.delivery_address || "",
          moveDate: move.scheduled_date,
          cancellationReason: reasonLabel,
          refundAmount: actualRefundAmount > 0 ? actualRefundAmount : null,
          trackingUrl,
        },
      }).catch((err) => console.error("[cancel] email failed:", err));
    }

    /* ── 5. Quote analytics → lost ── */
    if (move.quote_id) {
      Promise.resolve(
        supabase.from("quote_analytics").insert({
          quote_id: move.quote_id,
          outcome: "lost",
          lost_reason: fullReason,
          final_amount: Number(move.amount) || 0,
          service_type: move.service_type,
        }),
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      refundId: squareRefundId,
      refundAmount: actualRefundAmount,
    });
  } catch (e) {
    console.error("[moves/cancel] unexpected error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
