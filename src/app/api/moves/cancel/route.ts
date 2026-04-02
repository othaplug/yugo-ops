import { NextResponse } from "next/server";
import { squareClient } from "@/lib/square";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
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

    if (refundType !== "none" && move.square_payment_id) {
      if (refundType === "full") {
        actualRefundAmount = Number(move.deposit_amount) || 0;
      } else {
        actualRefundAmount = refundAmount ?? 0;
      }

      if (actualRefundAmount > 0) {
        const refundCents = Math.round(actualRefundAmount * 100);

        try {
          const refundRes = await squareClient.refunds.refundPayment({
            paymentId: move.square_payment_id,
            amountMoney: { amount: BigInt(refundCents), currency: "CAD" },
            reason: `${REASON_LABELS[reason] || reason}${reasonDetail ? ` ${reasonDetail}` : ""}`,
            idempotencyKey: `refund-${moveId}`,
          });

          squareRefundId = refundRes.refund?.id ?? null;
        } catch (e) {
          console.error("[Square] refund failed:", e);
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
      syncDealStage(move.hubspot_deal_id, "completed").catch(() => {});

      const token = process.env.HUBSPOT_ACCESS_TOKEN;
      if (token) {
        fetch(`https://api.hubapi.com/crm/v3/objects/deals/${move.hubspot_deal_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              hs_is_closed_won: "false",
              closed_lost_reason: fullReason,
              closedate: now,
            },
          }),
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
