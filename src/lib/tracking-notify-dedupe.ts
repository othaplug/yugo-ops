import type { SupabaseClient } from "@supabase/supabase-js"

/** Skip re-sending the same tracking checkpoint if fired twice within this window (crew + admin). */
export const TRACKING_NOTIFY_DEDUPE_MS = 120_000

export async function shouldSkipDuplicateDeliveryTrackingNotify(
  admin: SupabaseClient,
  deliveryId: string,
  status: string,
): Promise<boolean> {
  const { data } = await admin
    .from("deliveries")
    .select("last_notified_tracking_status, last_notified_tracking_at")
    .eq("id", deliveryId)
    .maybeSingle()

  if (!data?.last_notified_tracking_status || !data.last_notified_tracking_at) return false
  if (data.last_notified_tracking_status !== status) return false
  const t = new Date(data.last_notified_tracking_at).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < TRACKING_NOTIFY_DEDUPE_MS
}

export async function recordDeliveryTrackingNotifyDedupe(
  admin: SupabaseClient,
  deliveryId: string,
  status: string,
): Promise<void> {
  await admin
    .from("deliveries")
    .update({
      last_notified_tracking_status: status,
      last_notified_tracking_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
}
