import type { SupabaseClient } from "@supabase/supabase-js";
import { updateCrewProfile } from "@/lib/crew/recommendation";
import {
  backfillDeliveryScoreArrivedLateFromSession,
  backfillMoveArrivalOnTimeFromSession,
} from "@/lib/crew/persist-arrival-punctuality";

export type JobCompletionSignoffPayload = {
  clientRating: number | null;
  hadDamage: boolean;
};

function monthKeyFromIso(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 7);
  const d = iso.slice(0, 10);
  if (d.length >= 7) return d.slice(0, 7);
  return new Date().toISOString().slice(0, 7);
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPgDuplicateError(error: { code?: string; message?: string } | null): boolean {
  const c = String(error?.code || "");
  const m = String(error?.message || "").toLowerCase();
  return c === "23505" || m.includes("duplicate key") || m.includes("unique constraint");
}

/** Ensures a `crew_profiles` row exists for PIN crew members (tips + stats). */
export async function ensureCrewProfileRow(
  admin: SupabaseClient,
  crewMemberId: string,
  displayName: string
): Promise<void> {
  const name = displayName.trim() || "Crew";
  const { data: existing } = await admin.from("crew_profiles").select("user_id").eq("user_id", crewMemberId).maybeSingle();
  if (existing) {
    await admin
      .from("crew_profiles")
      .update({ name, last_updated: new Date().toISOString() })
      .eq("user_id", crewMemberId);
    return;
  }
  const { error } = await admin.from("crew_profiles").insert({
    user_id: crewMemberId,
    name,
    total_jobs: 0,
    avg_satisfaction: 0,
    avg_hours_vs_estimate: 0,
    damage_incidents: 0,
    damage_rate: 0,
    on_time_rate: 0,
    consecutive_5stars: 0,
    monthly_jobs: {},
    monthly_ratings: {},
    total_tips_earned: 0,
    avg_tip_per_job: 0,
    highest_tip: 0,
    monthly_tips: {},
  });
  if (error && !isPgDuplicateError(error)) {
    console.error("[crew-profile] ensureCrewProfileRow insert failed:", error);
  }
}

/** Match `crews.members` / job snapshot strings to `crew_members` rows on the team. */
export async function resolveCrewMemberIdsForAssignment(
  admin: SupabaseClient,
  teamId: string,
  assignedNames: string[]
): Promise<{ id: string; name: string }[]> {
  const { data: roster } = await admin
    .from("crew_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("is_active", true);

  const members = (roster ?? []).filter((m) => m.id && m.name);
  if (members.length === 0) return [];

  const raw = (assignedNames || []).map((n) => (typeof n === "string" ? n.trim() : "")).filter(Boolean);
  if (raw.length === 0) return members.map((m) => ({ id: m.id, name: m.name }));

  const picked = new Map<string, { id: string; name: string }>();
  for (const label of raw) {
    const n = normName(label);
    const exact = members.find((m) => normName(m.name) === n);
    if (exact) {
      picked.set(exact.id, { id: exact.id, name: exact.name });
      continue;
    }
    const firstTok = n.split(" ")[0] || "";
    if (firstTok.length >= 2) {
      const loose = members.find((m) => normName(m.name).startsWith(firstTok));
      if (loose) picked.set(loose.id, { id: loose.id, name: loose.name });
    }
  }
  if (picked.size > 0) return [...picked.values()];
  return members.map((m) => ({ id: m.id, name: m.name }));
}

/** `fresh` = first completion for this job; `duplicate` = already counted; `untracked` = ledger missing/error — still apply profiles so stats are not stuck at zero. */
async function tryClaimJobCompletionLedger(
  admin: SupabaseClient,
  jobType: "move" | "delivery",
  jobId: string
): Promise<"fresh" | "duplicate" | "untracked"> {
  const { error } = await admin.from("crew_profile_job_completion").insert({ job_type: jobType, job_id: jobId });
  if (!error) return "fresh";
  if (isPgDuplicateError(error)) return "duplicate";
  console.error(
    "[crew-profile] crew_profile_job_completion insert failed — applying profile deltas without ledger (run migration 20260406170000).",
    error,
  );
  return "untracked";
}

async function loadSignoffForJob(
  admin: SupabaseClient,
  jobType: "move" | "delivery",
  jobId: string
): Promise<JobCompletionSignoffPayload | null> {
  const { data } = await admin
    .from("client_sign_offs")
    .select("satisfaction_rating, no_damages, no_property_damage")
    .eq("job_id", jobId)
    .eq("job_type", jobType)
    .maybeSingle();
  if (!data) return null;
  const r = data.satisfaction_rating;
  const clientRating = typeof r === "number" && r >= 1 && r <= 5 ? r : null;
  const hadDamage = data.no_damages === false || data.no_property_damage === false;
  return { clientRating, hadDamage };
}

async function crewReportedDamage(
  admin: SupabaseClient,
  jobType: "move" | "delivery",
  jobId: string
): Promise<boolean> {
  const { data } = await admin
    .from("incidents")
    .select("id")
    .eq("job_id", jobId)
    .eq("job_type", jobType)
    .eq("issue_type", "damage")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** When job was already credited (e.g. checkpoint) but sign-off has the real client rating. */
async function supplementProfilesWithSignoffRating(
  admin: SupabaseClient,
  crewRows: { id: string; name: string }[],
  clientRating: number,
  monthKey: string
): Promise<void> {
  const assumed = 5;
  if (clientRating === assumed) return;

  for (const cm of crewRows) {
    const { data: p } = await admin.from("crew_profiles").select("*").eq("user_id", cm.id).maybeSingle();
    if (!p || !p.total_jobs || p.total_jobs < 1) continue;

    const n = Number(p.total_jobs);
    const nextAvg = (Number(p.avg_satisfaction) * n - assumed + clientRating) / n;

    const mj = (p.monthly_jobs as Record<string, number>) || {};
    const mr = (p.monthly_ratings as Record<string, number>) || {};
    const monthCount = mj[monthKey] || 0;
    let nextMonthly = mr[monthKey];
    if (monthCount > 0 && mr[monthKey] !== undefined) {
      nextMonthly = (Number(mr[monthKey]) * monthCount - assumed + clientRating) / monthCount;
    }

    await admin
      .from("crew_profiles")
      .update({
        avg_satisfaction: nextAvg,
        ...(nextMonthly !== undefined ? { monthly_ratings: { ...mr, [monthKey]: nextMonthly } } : {}),
        last_updated: new Date().toISOString(),
      })
      .eq("user_id", cm.id);
  }
}

/**
 * Call after a move/delivery is in a terminal state (`completed` / `delivered`).
 * First completion for that job claims a ledger row and increments crew profiles.
 * Later client sign-off can adjust ratings if the first pass assumed a neutral score.
 */
export async function notifyJobCompletedForCrewProfiles(
  admin: SupabaseClient,
  opts: {
    jobType: "move" | "delivery";
    jobId: string;
    /** When omitted, loads from `client_sign_offs` if present. */
    signoff?: JobCompletionSignoffPayload;
  }
): Promise<void> {
  const { jobType, jobId } = opts;
  const table = jobType === "move" ? "moves" : "deliveries";

  const { data: row, error } = await admin
    .from(table)
    .select(
      jobType === "move"
        ? "id, crew_id, assigned_members, completed_at, est_hours, actual_hours, service_type, tier_selected, satisfaction_rating, status, arrived_on_time"
        : "id, crew_id, assigned_members, completed_at, actual_hours, status, score_arrived_late"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error || !row) return;

  const st = String((row as { status?: string }).status || "").toLowerCase();
  const terminal =
    jobType === "move" ? st === "completed" || st === "delivered" : st === "delivered" || st === "completed";
  if (!terminal) return;

  const crewId = (row as { crew_id?: string | null }).crew_id;
  if (!crewId) return;

  const assignedRaw = (row as { assigned_members?: unknown }).assigned_members;
  const assignedNames = Array.isArray(assignedRaw)
    ? assignedRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];

  const crewRows = await resolveCrewMemberIdsForAssignment(admin, crewId, assignedNames);
  if (crewRows.length === 0) return;

  const completedAt = (row as { completed_at?: string | null }).completed_at;
  const monthKey = monthKeyFromIso(completedAt || undefined);

  const signoffRow =
    opts.signoff !== undefined ? opts.signoff : await loadSignoffForJob(admin, jobType, jobId);

  let clientRating =
    signoffRow?.clientRating ??
    (jobType === "move" ? (row as { satisfaction_rating?: number | null }).satisfaction_rating : null);
  if (clientRating != null && (clientRating < 1 || clientRating > 5)) clientRating = null;

  const ratingForProfile = clientRating ?? 5;
  const damageFromSignoff = signoffRow?.hadDamage ?? false;
  const damageFromIncidents = await crewReportedDamage(admin, jobType, jobId);
  const hadDamage = damageFromSignoff || damageFromIncidents;

  const estHours =
    jobType === "move" ? (row as { est_hours?: number | null }).est_hours ?? null : null;
  const actualHours = (row as { actual_hours?: number | null }).actual_hours ?? null;
  const serviceType = jobType === "move" ? (row as { service_type?: string | null }).service_type ?? null : null;
  const tierSelected = jobType === "move" ? (row as { tier_selected?: string | null }).tier_selected ?? null : null;

  let arrivedOnTimeForProfile: boolean | null = null;
  if (jobType === "move") {
    const v = (row as { arrived_on_time?: boolean | null }).arrived_on_time;
    if (v === true || v === false) arrivedOnTimeForProfile = v;
    else arrivedOnTimeForProfile = await backfillMoveArrivalOnTimeFromSession(admin, jobId);
  } else {
    const late = (row as { score_arrived_late?: boolean | null }).score_arrived_late;
    if (late === true) arrivedOnTimeForProfile = false;
    else if (late === false) arrivedOnTimeForProfile = true;
    else arrivedOnTimeForProfile = await backfillDeliveryScoreArrivedLateFromSession(admin, jobId);
  }

  const claim = await tryClaimJobCompletionLedger(admin, jobType, jobId);
  if (claim === "fresh" || claim === "untracked") {
    for (const cm of crewRows) {
      await updateCrewProfile(
        cm.id,
        {
          client_rating: ratingForProfile,
          damage_reported: hadDamage,
          actual_hours: actualHours,
          est_hours: estHours,
          service_type: serviceType,
          tier_selected: tierSelected,
          arrived_on_time: arrivedOnTimeForProfile,
        },
        { monthKey, displayName: cm.name }
      );
    }
    return;
  }

  if (claim === "duplicate" && signoffRow?.clientRating != null) {
    await supplementProfilesWithSignoffRating(admin, crewRows, signoffRow.clientRating, monthKey);
  }
}

/** After a tip row is inserted, split net across assigned crew and update profile aggregates. */
export async function notifyTipRecordedForCrewProfiles(
  admin: SupabaseClient,
  tipId: string,
  crewId: string | null,
  moveId: string | null,
  netAmount: number
): Promise<void> {
  if (!crewId || !moveId || !Number.isFinite(netAmount) || netAmount <= 0) return;

  const { error: ledgerErr } = await admin.from("crew_profile_tip_applied").insert({ tip_id: tipId });
  if (ledgerErr) {
    if (isPgDuplicateError(ledgerErr)) return;
    console.error(
      "[crew-profile] crew_profile_tip_applied insert failed — rolling up tip anyway (run migration 20260406170000).",
      ledgerErr,
    );
  }

  const { data: move } = await admin
    .from("moves")
    .select("assigned_members, crew_id")
    .eq("id", moveId)
    .maybeSingle();
  if (!move || move.crew_id !== crewId) {
    return;
  }

  const assignedRaw = move.assigned_members;
  const assignedNames = Array.isArray(assignedRaw)
    ? assignedRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];

  const crewRows = await resolveCrewMemberIdsForAssignment(admin, crewId, assignedNames);
  if (crewRows.length === 0) return;

  const share = Math.round((netAmount / crewRows.length) * 100) / 100;
  const monthKey = new Date().toISOString().slice(0, 7);

  for (const cm of crewRows) {
    let { data: p } = await admin.from("crew_profiles").select("*").eq("user_id", cm.id).maybeSingle();
    if (!p) {
      await ensureCrewProfileRow(admin, cm.id, cm.name);
      const again = await admin.from("crew_profiles").select("*").eq("user_id", cm.id).maybeSingle();
      p = again.data;
    }
    if (!p) continue;

    const prevTotal = Number(p.total_tips_earned) || 0;
    const newTotal = Math.round((prevTotal + share) * 100) / 100;
    const jobs = Math.max(1, Number(p.total_jobs) || 0);
    const mt = (p.monthly_tips as Record<string, number>) || {};
    const prevMonth = mt[monthKey] || 0;
    const nextMonthTips = { ...mt, [monthKey]: Math.round((prevMonth + share) * 100) / 100 };
    const prevHigh = Number(p.highest_tip) || 0;

    await admin
      .from("crew_profiles")
      .update({
        total_tips_earned: newTotal,
        avg_tip_per_job: Math.round((newTotal / jobs) * 100) / 100,
        highest_tip: Math.max(prevHigh, share),
        monthly_tips: nextMonthTips,
        last_updated: new Date().toISOString(),
      })
      .eq("user_id", cm.id);
  }
}
