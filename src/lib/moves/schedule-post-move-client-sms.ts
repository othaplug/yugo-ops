import type { SupabaseClient } from "@supabase/supabase-js";

/** The post-move text lands ~1h after completion (delivered by the 3-min cron). */
const POST_MOVE_SMS_DELAY_MS = 60 * 60 * 1000;

/**
 * Don't fire a post-move text for a move that was completed long ago and only
 * just got repaired/back-filled — the client has moved on and the email review
 * flow already covered it. Only schedule when completion is recent.
 */
const POST_MOVE_FRESHNESS_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Resolve the star rating the client gave during sign-off. Prefers the most
 * authoritative sign-off evidence, in order:
 *   1. latest proof_of_delivery.satisfaction_rating (written at sign-off)
 *   2. client_sign_offs.satisfaction_rating
 * Both columns are guaranteed by migrations and both are written by the crew
 * sign-off route, so they fully cover the "during client sign-off" rating.
 * Returns null when no sign-off rating exists (e.g. admin bulk-complete,
 * auto-complete via checkpoint, or a skipped sign-off).
 */
async function resolveSignoffRating(
  admin: SupabaseClient,
  moveId: string,
): Promise<number | null> {
  const inRange = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  };

  const { data: pod } = await admin
    .from("proof_of_delivery")
    .select("satisfaction_rating")
    .eq("move_id", moveId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const podRating = inRange(pod?.satisfaction_rating);
  if (podRating != null) return podRating;

  const { data: so } = await admin
    .from("client_sign_offs")
    .select("satisfaction_rating")
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .maybeSingle();
  return inRange(so?.satisfaction_rating);
}

/**
 * Queue the post-move client text, conditioned on the sign-off star rating.
 *
 *   • 4–5★ → kind 'post_move_review'   (thank-you + Google review ask)
 *   • 1–3★ → kind 'post_move_recovery' (luxury service-recovery outreach)
 *   • no rating → nothing is queued; the existing email review flow still runs.
 *
 * The review text is gated on the `auto_review_requests` platform toggle so it
 * shares the same on/off switch as the rest of the review system. The recovery
 * text is ALWAYS queued — reaching an unhappy client quickly is the whole point
 * and must not be silenced by a review toggle.
 *
 * Idempotent: a partial unique index on (move_id, kind) WHERE status='pending'
 * means a duplicate completion follow-up can't double-queue. Fails safe — any
 * error is logged, never thrown, so move completion is never blocked (including
 * the CHECK-constraint error if the kinds migration hasn't been applied yet).
 */
export const schedulePostMoveClientSms = async (
  admin: SupabaseClient,
  moveId: string,
): Promise<void> => {
  try {
    const { data: move } = await admin
      .from("moves")
      .select("id, client_phone, completed_at")
      .eq("id", moveId)
      .maybeSingle();

    if (!move) return;
    if (!move.client_phone || !String(move.client_phone).trim()) return;

    const completedAt = move.completed_at
      ? new Date(move.completed_at as string)
      : new Date();
    if (
      Date.now() - completedAt.getTime() >
      POST_MOVE_FRESHNESS_WINDOW_MS
    ) {
      return; // stale completion — email flow already covers it
    }

    const rating = await resolveSignoffRating(admin, moveId);

    // No sign-off rating → no timely text (the literal "only if 4–5★" rule).
    if (rating == null) return;

    const kind = rating <= 3 ? "post_move_recovery" : "post_move_review";

    // Review ask respects the review-system toggle; recovery always sends.
    if (kind === "post_move_review") {
      const { data: cfg } = await admin
        .from("platform_config")
        .select("value")
        .eq("key", "auto_review_requests")
        .maybeSingle();
      if (cfg?.value !== "true" && cfg?.value !== "1") return;
    }

    const sendAt = new Date(completedAt.getTime() + POST_MOVE_SMS_DELAY_MS);

    const { error } = await admin.from("scheduled_move_client_sms").insert({
      move_id: moveId,
      kind,
      send_at: sendAt.toISOString(),
      status: "pending",
    });

    if (
      error &&
      !String(error.message || "").includes("duplicate") &&
      error.code !== "23505"
    ) {
      console.error("[post-move-sms] schedule failed:", error.message);
    }
  } catch (e) {
    console.error("[post-move-sms] schedule threw:", e);
  }
};

export { POST_MOVE_SMS_DELAY_MS };
