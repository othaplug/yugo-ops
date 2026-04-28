import type { SupabaseClient } from "@supabase/supabase-js";

const EN_ROUTE_CHECKIN_DELAY_MS = 15 * 60 * 1000;

/**
 * When crew reaches en route to destination, queue a single caring check-in SMS (~15 min later).
 * Idempotent per move via partial unique index (pending + kind).
 */
export const scheduleEnRouteMidMoveCheckin = async (
  admin: SupabaseClient,
  moveId: string,
  sendAfter: Date,
): Promise<void> => {
  const { error } = await admin.from("scheduled_move_client_sms").insert({
    move_id: moveId,
    kind: "en_route_checkin",
    send_at: sendAfter.toISOString(),
    status: "pending",
  });
  if (error && !String(error.message || "").includes("duplicate") && error.code !== "23505") {
    console.error("[mid-move-sms] schedule en_route_checkin:", error.message);
  }
};

/**
 * Long jobs (3+ hours since session start): optional unload check-in when unloading starts.
 */
export const scheduleLongUnloadCheckinIfNeeded = async (
  admin: SupabaseClient,
  moveId: string,
  sessionStartedAt: string | null,
  nowIso: string,
): Promise<void> => {
  if (!sessionStartedAt) return;
  const elapsedH =
    (new Date(nowIso).getTime() - new Date(sessionStartedAt).getTime()) / 3_600_000;
  if (elapsedH < 3) return;

  const { error } = await admin.from("scheduled_move_client_sms").insert({
    move_id: moveId,
    kind: "long_unload_checkin",
    send_at: nowIso,
    status: "pending",
  });
  if (error && !String(error.message || "").includes("duplicate") && error.code !== "23505") {
    console.error("[mid-move-sms] schedule long_unload_checkin:", error.message);
  }
};

export { EN_ROUTE_CHECKIN_DELAY_MS };
