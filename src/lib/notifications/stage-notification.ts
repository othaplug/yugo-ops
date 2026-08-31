import type { SupabaseClient } from "@supabase/supabase-js";

const digitsOnly = (s: string) => (s || "").replace(/\D/g, "");

/**
 * Cross-pipeline stage-SMS dedup key.
 *
 * Every stage-notifier that fires an SMS to a customer or partner should
 * reserve this key in `notification_log` before hitting the SMS provider.
 * The partial unique index on `notification_key` (see migration
 * 20260724150000_notification_log_dedup_key.sql) rejects a second claim
 * for the same {jobId, stage, phone} tuple, so a second pipeline seeing
 * the conflict simply skips the send.
 *
 * The phone digits are part of the key so that a genuinely separate
 * recipient (different number) still receives their message; the guard
 * only collapses sends that would land on the SAME device.
 */
export function buildStageNotificationKey(opts: {
  jobType: "move" | "delivery";
  jobUuid: string;
  status: string;
  phone: string;
}): string {
  return `${opts.jobType}:${opts.jobUuid}:tracking:${opts.status}:${digitsOnly(opts.phone)}`;
}

export type ReserveOutcome =
  | { reserved: true; id: string }
  | { reserved: true; id: null }
  | { reserved: false; id: null };

/**
 * Reserve a stage notification. Callers should:
 *   - `reserved: false` → another pipeline claimed this stage; skip send silently.
 *   - `reserved: true, id != null` → send SMS, then finalizeStageNotification.
 *   - `reserved: true, id == null` → reservation errored (not a conflict); send
 *     unguarded so we never miss a customer-facing SMS on infra hiccups.
 */
export async function reserveStageNotification(
  admin: SupabaseClient,
  opts: {
    jobType: "move" | "delivery";
    jobUuid: string;
    status: string;
    phone: string;
    event: string;
    message: string;
  },
): Promise<ReserveOutcome> {
  const key = buildStageNotificationKey({
    jobType: opts.jobType,
    jobUuid: opts.jobUuid,
    status: opts.status,
    phone: opts.phone,
  });
  const { data, error } = await admin
    .from("notification_log")
    .insert({
      channel: "sms",
      event: opts.event,
      recipient_phone: opts.phone,
      message: opts.message.slice(0, 1500),
      status: "pending",
      job_id: opts.jobUuid,
      job_type: opts.jobType,
      notification_key: key,
    })
    .select("id")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { reserved: false, id: null };
    }
    console.warn("[stage-notify] reserve failed, will send unguarded:", error.message);
    return { reserved: true, id: null };
  }
  return { reserved: true, id: data.id };
}

export async function finalizeStageNotification(
  admin: SupabaseClient,
  id: string | null,
  success: boolean,
  errorMsg?: string | null,
): Promise<void> {
  if (!id) return;
  try {
    await admin
      .from("notification_log")
      .update({
        status: success ? "sent" : "failed",
        error: success ? null : (errorMsg ?? "send failed"),
      })
      .eq("id", id);
  } catch {
    /* best-effort */
  }
}
