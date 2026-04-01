import { createAdminClient } from "@/lib/supabase/admin";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";

export type B2BPaymentNotifyMode = "always" | "only_if_newly_paid";

/**
 * Validates B2B one-off (booking_type one_off, no organization_id) and runs post-payment steps.
 * - Sets payment_received_at when missing.
 * - Issues tracking tokens (idempotent).
 * - Sends email/SMS per notifyMode: "always" matches manual admin button (incl. re-send);
 *   "only_if_newly_paid" sends only when payment_received_at was null before this run (e.g. Square webhook).
 */
export async function runB2BOneOffPaymentRecordedFlow(
  deliveryUuid: string,
  opts: { notifyMode: B2BPaymentNotifyMode },
): Promise<void> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("deliveries")
    .select("id, booking_type, organization_id, payment_received_at")
    .eq("id", deliveryUuid)
    .single();

  if (error || !row) {
    throw new Error(error?.message || "Delivery not found");
  }

  if (row.booking_type !== "one_off" || row.organization_id) {
    throw new Error("Only B2B one-off deliveries use this action");
  }

  const wasPaid = !!row.payment_received_at;
  const now = new Date().toISOString();

  await admin
    .from("deliveries")
    .update({
      payment_received_at: row.payment_received_at || now,
      updated_at: now,
    })
    .eq("id", deliveryUuid);

  await issueDeliveryTrackingTokens(deliveryUuid);

  const shouldNotify =
    opts.notifyMode === "always" || (opts.notifyMode === "only_if_newly_paid" && !wasPaid);

  if (shouldNotify) {
    await sendB2BTrackingNotifications(deliveryUuid);
  }
}
