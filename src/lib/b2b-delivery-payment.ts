import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import { deliveryEligibleForAdminPrepaidMark } from "@/lib/delivery-prepaid-eligibility";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";

export type B2BPaymentNotifyMode = "always" | "only_if_newly_paid";

export { deliveryEligibleForAdminPrepaidMark } from "@/lib/delivery-prepaid-eligibility";

type PrepaidFlowMode = "square_one_off" | "admin_mark_paid";

async function runDeliveryPrepaidRecordedFlow(
  deliveryUuid: string,
  opts: { notifyMode: B2BPaymentNotifyMode; mode: PrepaidFlowMode },
): Promise<void> {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("deliveries").select("*").eq("id", deliveryUuid).single();

  if (error || !row) {
    throw new Error(error?.message || "Delivery not found");
  }

  if (opts.mode === "square_one_off") {
    if (row.booking_type !== "one_off" || row.organization_id) {
      throw new Error("Only B2B one-off deliveries use this action");
    }
  } else {
    if (String(row.status || "").toLowerCase() === "cancelled") {
      throw new Error("Cannot mark payment on a cancelled delivery");
    }
    if (!deliveryEligibleForAdminPrepaidMark(row)) {
      throw new Error("Marked as paid is only for B2B deliveries");
    }
    if (effectiveDeliveryPrice(row) <= 0) {
      throw new Error("Set a quoted price before marking as paid");
    }
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
  return runDeliveryPrepaidRecordedFlow(deliveryUuid, { ...opts, mode: "square_one_off" });
}

/**
 * Admin “marked as paid” for B2B-style jobs (one-off, category b2b, or vertical) when payment
 * was collected before or outside Square. Same side effects as one-off flow.
 */
export async function runAdminMarkDeliveryPaidFlow(
  deliveryUuid: string,
  opts: { notifyMode: B2BPaymentNotifyMode },
): Promise<void> {
  return runDeliveryPrepaidRecordedFlow(deliveryUuid, { ...opts, mode: "admin_mark_paid" });
}
