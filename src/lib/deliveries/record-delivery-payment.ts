import { SupabaseClient } from "@supabase/supabase-js";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import { deliveryEligibleForAdminPrepaidMark } from "@/lib/delivery-prepaid-eligibility";
import { runAdminMarkDeliveryPaidFlow } from "@/lib/b2b-delivery-payment";

export type RecordDeliveryPaymentResult =
  | { status: "recorded" }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/**
 * Mark one B2B delivery as paid for a bulk run, reusing the exact single-button
 * flow (runAdminMarkDeliveryPaidFlow → sets payment_received_at + issues tokens)
 * so bulk and single record payment identically. Adds an "already paid" skip and
 * typed results so a bulk caller can report per-row outcomes without throwing.
 *
 * notifyMode is "only_if_newly_paid": recording payment in bulk should not blast
 * tracking messages during reconciliation. In practice the flow only notifies
 * non-terminal jobs, and bulk payment recording usually targets delivered
 * (terminal) jobs, so this rarely sends at all.
 *
 * NOTE: like the single "Record payment" button, this does not create a Square
 * receipt or flip invoices.status — it only records the payment marker. If
 * receipts on mark-paid are wanted, add them to the shared flow so single and
 * bulk stay in lockstep.
 */
export async function recordDeliveryPaymentBulk(
  admin: SupabaseClient,
  deliveryUuid: string,
): Promise<RecordDeliveryPaymentResult> {
  try {
    const { data: row, error } = await admin
      .from("deliveries")
      .select("*")
      .eq("id", deliveryUuid)
      .single();

    if (error || !row) return { status: "error", reason: "Delivery not found" };

    if (row.payment_received_at) {
      return { status: "skipped", reason: "Already paid" };
    }
    if (String(row.status || "").toLowerCase() === "cancelled") {
      return { status: "skipped", reason: "Delivery cancelled" };
    }
    if (!deliveryEligibleForAdminPrepaidMark(row)) {
      return { status: "skipped", reason: "Not a B2B delivery" };
    }
    if (effectiveDeliveryPrice(row) <= 0) {
      return { status: "skipped", reason: "No price set" };
    }

    await runAdminMarkDeliveryPaidFlow(deliveryUuid, { notifyMode: "only_if_newly_paid" });
    return { status: "recorded" };
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "Unexpected error" };
  }
}
