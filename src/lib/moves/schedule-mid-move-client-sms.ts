import type { SupabaseClient } from "@supabase/supabase-js";

const EN_ROUTE_CHECKIN_DELAY_MS = 15 * 60 * 1000;

/**
 * Deprecated. Both mid-move reassurance texts were retired because they
 * duplicated the stage-checkpoint SMS ("belongings on the way to your
 * new home" fired twice on MV-30282 — first by `notifyOnCheckpoint`,
 * then again by this scheduler's cron drain). The stage-checkpoint SMS
 * is the single source of truth for one-text-per-stage. These stubs stay
 * so lingering callers do not error; the cron drains and skips.
 */
export const scheduleEnRouteMidMoveCheckin = async (
  _admin: SupabaseClient,
  _moveId: string,
  _sendAfter: Date,
): Promise<void> => {
  return;
};

export const scheduleLongUnloadCheckinIfNeeded = async (
  _admin: SupabaseClient,
  _moveId: string,
  _sessionStartedAt: string | null,
  _nowIso: string,
): Promise<void> => {
  return;
};

export { EN_ROUTE_CHECKIN_DELAY_MS };
