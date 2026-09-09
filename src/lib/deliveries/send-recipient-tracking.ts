import { SupabaseClient } from "@supabase/supabase-js";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";

export type SendRecipientTrackingResult =
  | { status: "sent"; channels: string[] }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/**
 * Send the recipient (end-customer) tracking link for one B2B delivery, reusing
 * the exact single-send path: mint the recipient token if missing
 * (forceRecipient), then sendB2BTrackingNotifications(..., recipient). Derives
 * the delivered channels from the send result, never from column presence, so
 * it can't fake success (the 2026-06-29 fix). On a real send it stamps
 * recipient_tracking_sent_at so a later bulk run skips it instead of re-sending.
 *
 * The single-send route and the bulk "Send tracking" action both call this, so
 * they behave identically. Never throws — every outcome is a typed result.
 */
export async function sendDeliveryRecipientTracking(
  admin: SupabaseClient,
  deliveryUuid: string,
): Promise<SendRecipientTrackingResult> {
  try {
    // select("*") (not a column list) so a DB where the recipient_tracking_sent_at
    // migration hasn't been applied yet doesn't error the whole query — dedup
    // just no-ops until the column exists.
    const { data: d, error } = await admin
      .from("deliveries")
      .select("*")
      .eq("id", deliveryUuid)
      .single();

    if (error || !d) return { status: "error", reason: "Delivery not found" };

    const status = (d.status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled") {
      return { status: "skipped", reason: "Delivery cancelled" };
    }

    if ((d as { recipient_tracking_sent_at?: string | null }).recipient_tracking_sent_at) {
      return { status: "skipped", reason: "Tracking already sent" };
    }

    const hasPhone = !!(d.customer_phone || "").trim();
    const hasEmail = !!(d.customer_email || "").trim();
    if (!hasPhone && !hasEmail) {
      return { status: "skipped", reason: "No customer phone or email" };
    }

    if (!d.recipient_tracking_token) {
      // Operator intent is explicit (they selected this job), so force-mint the
      // recipient token even when the auto heuristic wouldn't.
      await issueDeliveryTrackingTokens(deliveryUuid, { forceRecipient: true });
    }

    const sendResult = await sendB2BTrackingNotifications(deliveryUuid, {
      audiences: ["recipient"],
    });

    const channels: string[] = [];
    if (sendResult.recipient.smsSent) channels.push("SMS");
    if (sendResult.recipient.emailSent) channels.push("email");

    if (channels.length === 0) {
      return {
        status: "error",
        reason: sendResult.recipient.skippedReason || "Nothing delivered",
      };
    }

    await admin
      .from("deliveries")
      .update({ recipient_tracking_sent_at: new Date().toISOString() })
      .eq("id", deliveryUuid);

    return { status: "sent", channels };
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "Unexpected error" };
  }
}
