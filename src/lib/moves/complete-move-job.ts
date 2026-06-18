import type { SupabaseClient } from "@supabase/supabase-js";
import { syncDealStageByMoveId } from "@/lib/hubspot/sync-deal-stage";
import { createReviewRequestIfEligible } from "@/lib/review-request-helper";
import { schedulePostMoveClientSms } from "@/lib/moves/schedule-post-move-client-sms";
import { sendSMS } from "@/lib/sms/sendSMS";
import { createClientReferralIfNeeded } from "@/lib/client-referral";
import { generateMovePDFs } from "@/lib/documents/generateMovePDFs";
import { generatePostMoveDocuments } from "@/lib/post-move-documents";
import { maybeNotifyB2BOneOffDelivered } from "@/lib/b2b-delivery-business-notifications";
import { isTerminalJobStatus } from "@/lib/moves/job-terminal";

export type MoveJobCompletionSource =
  | "crew_signoff"
  | "crew_signoff_skip"
  | "crew_checkpoint"
  | "admin_bulk"
  /** Dispatch board load: repaired stuck job from PoD/sign-off evidence */
  | "repair_dispatch"
  /** move-completion-repair cron */
  | "repair_cron"
  | "repair_signoff_retry";

/**
 * Closes every still-active tracking session for a job (handles duplicate / drifted rows).
 */
export const closeActiveTrackingSessionsForJob = async (
  admin: SupabaseClient,
  jobId: string,
  jobType: "move" | "delivery",
  completedAt: string,
): Promise<void> => {
  const { error } = await admin
    .from("tracking_sessions")
    .update({
      status: "completed",
      is_active: false,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("job_id", jobId)
    .eq("job_type", jobType)
    .eq("is_active", true);
  if (error) {
    console.error("[complete-move-job] closeActiveTrackingSessionsForJob:", error.message);
  }
};

const terminalRowPatch = (
  jobType: "move" | "delivery",
  completedAt: string,
  actualHours?: number | null,
): Record<string, unknown> => ({
  status: jobType === "move" ? "completed" : "delivered",
  stage: "completed",
  completed_at: completedAt,
  updated_at: completedAt,
  eta_tracking_active: false,
  ...(actualHours != null && actualHours > 0 ? { actual_hours: actualHours } : {}),
});

export type EnsureJobCompletedResult = {
  wasAlreadyComplete: boolean;
  ok: boolean;
  error?: string;
};

/**
 * Marks the move/delivery row finished and closes sessions. Idempotent: if already terminal,
 * normalizes stage/ETA flags and still closes stray active sessions.
 * When `ok` is false, the job row may still be non-terminal (caller must surface error / retry).
 */
export const ensureJobCompleted = async (
  admin: SupabaseClient,
  params: {
    jobId: string;
    jobType: "move" | "delivery";
    completedAt: string;
    actualHours?: number | null;
  },
): Promise<EnsureJobCompletedResult> => {
  const { jobId, jobType, completedAt, actualHours } = params;
  const table = jobType === "move" ? "moves" : "deliveries";

  const { data: row, error: fetchErr } = await admin
    .from(table)
    .select("status, completed_at, stage")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchErr || !row) {
    console.error("[complete-move-job] ensureJobCompleted fetch:", fetchErr?.message);
    return {
      wasAlreadyComplete: false,
      ok: false,
      error: fetchErr?.message || "job_not_found",
    };
  }

  const wasAlreadyComplete = isTerminalJobStatus(row.status as string, jobType);
  const patch = terminalRowPatch(jobType, completedAt, actualHours);

  if (wasAlreadyComplete) {
    const stageNorm = String(row.stage || "").toLowerCase() !== "completed";
    const { error: upErr } = await admin
      .from(table)
      .update({
        ...(stageNorm ? { stage: "completed" } : {}),
        eta_tracking_active: false,
        updated_at: completedAt,
      })
      .eq("id", jobId);
    if (upErr) {
      console.error("[complete-move-job] ensureJobCompleted normalize:", upErr.message);
      return { wasAlreadyComplete: true, ok: false, error: upErr.message };
    }
  } else {
    const { error: upErr } = await admin.from(table).update(patch).eq("id", jobId);
    if (upErr) {
      console.error("[complete-move-job] ensureJobCompleted finalize:", upErr.message);
      return { wasAlreadyComplete: false, ok: false, error: upErr.message };
    }
  }

  await closeActiveTrackingSessionsForJob(admin, jobId, jobType, completedAt);

  if (jobType === "move") {
    try {
      // Cancel only the MID-move check-ins (the job is done, they're moot).
      // Post-move texts (review / recovery) are queued AFTER this point by the
      // completion follow-up and must survive — never cancel them here, or an
      // idempotent re-completion would wipe the pending post-move text before
      // the 1h send window elapses.
      const { error: cancelSmsErr } = await admin
        .from("scheduled_move_client_sms")
        .update({ status: "cancelled" })
        .eq("move_id", jobId)
        .eq("status", "pending")
        .in("kind", ["en_route_checkin", "long_unload_checkin"]);
      if (cancelSmsErr) {
        console.error("[complete-move-job] cancel mid-move SMS:", cancelSmsErr.message);
      }
    } catch (e) {
      console.error("[complete-move-job] cancel mid-move SMS:", e);
    }
  }

  return { wasAlreadyComplete, ok: true };
};

const maxIso = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};

/**
 * Strict repair: if PoD, client sign-off, OR sign-off skip exists but the job row is not terminal, finalize it.
 * Skips (`signoff_skips`) finalize the job in crew flow without PoD; they must still count as evidence here.
 */
export const repairJobCompletionFromEvidence = async (
  admin: SupabaseClient,
  jobId: string,
  jobType: "move" | "delivery",
): Promise<{ transitioned: boolean; ok: boolean; error?: string }> => {
  const table = jobType === "move" ? "moves" : "deliveries";
  const { data: row, error: fe } = await admin
    .from(table)
    .select("status, completed_at")
    .eq("id", jobId)
    .maybeSingle();
  if (fe || !row) {
    return { transitioned: false, ok: false, error: fe?.message || "job_not_found" };
  }
  if (isTerminalJobStatus(row.status as string, jobType)) {
    const now = new Date().toISOString();
    await closeActiveTrackingSessionsForJob(admin, jobId, jobType, now);
    return { transitioned: false, ok: true };
  }

  let evidenceAt: string | null = null;
  if (jobType === "move") {
    const { data: pod } = await admin
      .from("proof_of_delivery")
      .select("signed_at, completed_at")
      .eq("move_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: so } = await admin
      .from("client_sign_offs")
      .select("signed_at")
      .eq("job_id", jobId)
      .eq("job_type", "move")
      .maybeSingle();
    const { data: skipped } = await admin
      .from("signoff_skips")
      .select("created_at")
      .eq("job_id", jobId)
      .eq("job_type", "move")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pod && !so && !skipped) return { transitioned: false, ok: true };
    evidenceAt = maxIso(pod?.signed_at ?? null, pod?.completed_at ?? null);
    evidenceAt = maxIso(evidenceAt, so?.signed_at ?? null);
    evidenceAt = maxIso(evidenceAt, skipped?.created_at ?? null);
  } else {
    const { data: pod } = await admin
      .from("proof_of_delivery")
      .select("signed_at, completed_at")
      .eq("delivery_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: so } = await admin
      .from("client_sign_offs")
      .select("signed_at")
      .eq("job_id", jobId)
      .eq("job_type", "delivery")
      .maybeSingle();
    const { data: skipped } = await admin
      .from("signoff_skips")
      .select("created_at")
      .eq("job_id", jobId)
      .eq("job_type", "delivery")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pod && !so && !skipped) return { transitioned: false, ok: true };
    evidenceAt = maxIso(pod?.signed_at ?? null, pod?.completed_at ?? null);
    evidenceAt = maxIso(evidenceAt, so?.signed_at ?? null);
    evidenceAt = maxIso(evidenceAt, skipped?.created_at ?? null);
  }

  const completedAt =
    maxIso(evidenceAt, (row.completed_at as string | null) ?? null) || new Date().toISOString();

  const { wasAlreadyComplete, ok, error } = await ensureJobCompleted(admin, {
    jobId,
    jobType,
    completedAt,
  });
  if (!ok) return { transitioned: false, ok: false, error };
  return { transitioned: !wasAlreadyComplete, ok: true };
};

const fetchOriginBase = () =>
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const fireSendCompletedEta = (jobId: string, jobType: "move" | "delivery"): void => {
  const origin = fetchOriginBase();
  fetch(`${origin.replace(/\/$/, "")}/api/eta/send-completed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, jobType }),
  }).catch((e) => console.error("[eta] send-completed failed:", e));
};

export const fireAutoInvoice = (jobId: string, jobType: "move" | "delivery"): void => {
  const origin = fetchOriginBase();
  if (jobType === "delivery") {
    fetch(`${origin.replace(/\/$/, "")}/api/invoices/auto-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId: jobId }),
    }).catch((e) => console.error("[auto-invoice] delivery trigger failed:", e));
  } else {
    fetch(`${origin.replace(/\/$/, "")}/api/invoices/auto-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveId: jobId }),
    }).catch((e) => console.error("[auto-invoice] move trigger failed:", e));
  }
};

/** Margin persistence used when completing from crew checkpoint (session hours). */
export const persistActualMarginForMove = async (
  admin: SupabaseClient,
  moveId: string,
  actualHours: number | null,
): Promise<void> => {
  try {
    const { calcActualMargin } = await import("@/lib/pricing/engine");
    const { data: moveForMargin } = await admin
      .from("moves")
      .select(
        "actual_hours, est_hours, actual_crew_count, crew_count, truck_primary, distance_km, tier_selected, move_size, estimate",
      )
      .eq("id", moveId)
      .single();
    if (!moveForMargin) return;
    const { data: cfgRows } = await admin.from("platform_config").select("key, value");
    const cfg: Record<string, string> = {};
    for (const r of cfgRows ?? []) cfg[r.key] = r.value;
    const marginResult = calcActualMargin(
      {
        actualHours,
        estimatedHours: moveForMargin.est_hours ?? null,
        actualCrew: moveForMargin.actual_crew_count ?? null,
        crewSize: moveForMargin.crew_count ?? null,
        truckType: moveForMargin.truck_primary ?? null,
        distanceKm: moveForMargin.distance_km ?? null,
        tier: moveForMargin.tier_selected ?? null,
        moveSize: moveForMargin.move_size ?? null,
        totalPrice: moveForMargin.estimate ?? null,
      },
      cfg,
    );
    await admin.from("moves").update(marginResult).eq("id", moveId);
  } catch (e) {
    console.error("[complete-move-job] margin calculation failed:", e);
  }
};

/**
 * Side effects after a move first becomes completed (review scheduling, PDFs, HubSpot, SMS, invoices).
 * Safe to skip when `wasAlreadyComplete` from `ensureJobCompleted`.
 */
/**
 * Immediate "your move is complete" thank-you SMS (luxury tone). Sent on
 * completion, unconditionally — separate from the rating-gated review text that
 * follows ~1h later. Idempotent via a status_events marker so a double
 * completion (e.g. repair-from-evidence) can't double-send. Never throws.
 */
export const sendMoveCompleteThankYouSms = async (
  admin: SupabaseClient,
  moveId: string,
): Promise<void> => {
  try {
    const { data: move } = await admin
      .from("moves")
      .select("id, client_phone, client_name, completed_at")
      .eq("id", moveId)
      .maybeSingle();
    if (!move?.client_phone || !String(move.client_phone).trim()) return;
    // Skip stale completions (e.g. a backfill weeks later) — only text fresh ones.
    const completedAt = move.completed_at
      ? new Date(move.completed_at as string)
      : new Date();
    if (Date.now() - completedAt.getTime() > 12 * 60 * 60 * 1000) return;
    // Idempotency: don't send twice for the same move.
    const { data: already } = await admin
      .from("status_events")
      .select("id")
      .eq("entity_type", "move")
      .eq("entity_id", moveId)
      .eq("event_type", "move_complete_sms")
      .limit(1)
      .maybeSingle();
    if (already) return;
    const firstName =
      (String(move.client_name ?? "").trim().split(/\s+/)[0]) || "there";
    const body = [
      `Hi ${firstName},`,
      `Your move is complete. It was our privilege to care for your belongings today, thank you for choosing Yugo.`,
      `If there is anything at all we can do for you, simply reply here.`,
    ].join("\n\n");
    const res = await sendSMS(String(move.client_phone).replace(/\s/g, ""), body);
    await admin.from("status_events").insert({
      entity_type: "move",
      entity_id: moveId,
      event_type: "move_complete_sms",
      description: res.success
        ? "Move-complete thank-you SMS sent"
        : `Move-complete SMS failed: ${res.error ?? "unknown"}`,
      icon: "check",
    });
  } catch (e) {
    console.error("[move-complete-sms] failed:", e);
  }
};

export const runMoveCompletionFollowUp = async (
  admin: SupabaseClient,
  moveId: string,
  opts: {
    source: MoveJobCompletionSource;
    marginActualHours?: number | null;
  },
): Promise<void> => {
  syncDealStageByMoveId(moveId, "completed").catch(() => {});
  // Immediate thank-you text (luxury tone). The rating-gated review text is
  // scheduled separately ~1h later by schedulePostMoveClientSms below.
  sendMoveCompleteThankYouSms(admin, moveId).catch((e) =>
    console.error("[move-complete-sms] schedule failed:", e),
  );
  // Review-ask EMAIL (unchanged: next-day via /api/cron/review-requests).
  createReviewRequestIfEligible(admin, moveId).catch((e) =>
    console.error("[review] create failed:", e),
  );
  // Timely post-move TEXT (~1h, rating-gated, via /api/cron/move-client-sms).
  // Runs after ensureJobCompleted so the cancellation sweep can't wipe it.
  schedulePostMoveClientSms(admin, moveId).catch((e) =>
    console.error("[post-move-sms] schedule failed:", e),
  );
  createClientReferralIfNeeded(admin, moveId).catch((e) =>
    console.error("[referral] create failed:", e),
  );

  if (opts.source === "crew_signoff_skip") {
    generatePostMoveDocuments(moveId).catch((e) => console.error("[post-move-documents] failed:", e));
  } else {
    try {
      await generateMovePDFs(moveId);
    } catch (e) {
      console.error("[generateMovePDFs] failed:", e);
    }
  }

  fireSendCompletedEta(moveId, "move");
  fireAutoInvoice(moveId, "move");

  if (opts.marginActualHours != null) {
    void persistActualMarginForMove(admin, moveId, opts.marginActualHours);
  }
};

export const runDeliveryCompletionFollowUp = async (
  admin: SupabaseClient,
  deliveryId: string,
): Promise<void> => {
  fireSendCompletedEta(deliveryId, "delivery");
  maybeNotifyB2BOneOffDelivered(deliveryId).catch(() => {});
  fireAutoInvoice(deliveryId, "delivery");
};

const enRouteToProgressStatuses = [
  "en_route_to_pickup",
  "en_route_to_destination",
  "en_route_venue",
  "en_route_return",
  "on_route",
  "en_route",
];

/**
 * Syncs moves/deliveries row from an in-progress crew checkpoint. Returns false if the job is
 * terminal and the update was skipped (completed jobs must not regress to in_progress).
 */
export const applyCheckpointProgressToJobRow = async (
  admin: SupabaseClient,
  params: {
    jobId: string;
    jobType: "move" | "delivery";
    checkpointStatus: string;
    now: string;
  },
): Promise<boolean> => {
  const { jobId, jobType, checkpointStatus, now } = params;
  const table = jobType === "move" ? "moves" : "deliveries";
  const { data: row } = await admin.from(table).select("status").eq("id", jobId).maybeSingle();
  if (!row) return false;
  if (isTerminalJobStatus(row.status as string, jobType)) {
    console.warn(
      `[applyCheckpointProgressToJobRow] Blocked regression for ${jobType} ${jobId}: job is ${row.status}, checkpoint ${checkpointStatus}`,
    );
    return false;
  }

  const markInProgress = enRouteToProgressStatuses.includes(checkpointStatus);
  if (markInProgress) {
    const { error } = await admin
      .from(table)
      .update({ status: "in_progress", stage: checkpointStatus, updated_at: now })
      .eq("id", jobId);
    if (error) console.error("[applyCheckpointProgressToJobRow] in_progress:", error.message);
    if (jobType === "move") {
      syncDealStageByMoveId(jobId, "in_progress").catch(() => {});
    }
  } else {
    const { error } = await admin.from(table).update({ stage: checkpointStatus, updated_at: now }).eq("id", jobId);
    if (error) console.error("[applyCheckpointProgressToJobRow] stage:", error.message);
  }
  return true;
};
