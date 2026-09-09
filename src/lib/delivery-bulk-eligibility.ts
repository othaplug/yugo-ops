import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import { deliveryEligibleForAdminPrepaidMark } from "@/lib/delivery-prepaid-eligibility";

/**
 * Client-side eligibility for the bulk "Send tracking" and "Record payment"
 * actions. Mirrors the server gates in sendDeliveryRecipientTracking and
 * recordDeliveryPaymentBulk so the pre-send preview count matches what the
 * server will actually do. Any gate change on the server must be reflected
 * here (and vice versa).
 */

export type TrackingIneligibleReason =
  | "cancelled"
  | "already_sent"
  | "no_customer_contact";

type TrackingRow = {
  status?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  recipient_tracking_sent_at?: string | null;
};

export function deliveryTrackingBulkIneligibleReason(
  row: TrackingRow,
): TrackingIneligibleReason | null {
  const status = (row.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (row.recipient_tracking_sent_at) return "already_sent";
  if (!(row.customer_phone || "").trim() && !(row.customer_email || "").trim()) {
    return "no_customer_contact";
  }
  return null;
}

export const TRACKING_INELIGIBLE_LABEL: Record<TrackingIneligibleReason, string> = {
  cancelled: "cancelled",
  already_sent: "tracking already sent",
  no_customer_contact: "no customer phone or email",
};

export type PaymentIneligibleReason =
  | "already_paid"
  | "not_b2b"
  | "no_price";

type PaymentRow = Parameters<typeof effectiveDeliveryPrice>[0] & {
  payment_received_at?: string | null;
  status?: string | null;
  booking_type?: string | null;
  organization_id?: string | null;
  category?: string | null;
  vertical_code?: string | null;
};

export function deliveryPaymentBulkIneligibleReason(
  row: PaymentRow,
): PaymentIneligibleReason | null {
  if (row.payment_received_at) return "already_paid";
  // deliveryEligibleForAdminPrepaidMark already rejects cancelled + non-B2B.
  if (!deliveryEligibleForAdminPrepaidMark(row)) return "not_b2b";
  if (effectiveDeliveryPrice(row) <= 0) return "no_price";
  return null;
}

export const PAYMENT_INELIGIBLE_LABEL: Record<PaymentIneligibleReason, string> = {
  already_paid: "already paid",
  not_b2b: "not an eligible B2B job",
  no_price: "no price set",
};

/** Delivered/completed but no payment recorded — the bulk collections target. */
export function isDeliveredAndUnpaid(
  row: PaymentRow,
): boolean {
  const status = (row.status || "").toLowerCase();
  const delivered = status === "delivered" || status === "completed";
  return delivered && deliveryPaymentBulkIneligibleReason(row) === null;
}
