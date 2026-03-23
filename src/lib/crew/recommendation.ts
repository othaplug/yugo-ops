/**
 * Crew Intelligence — profile updates + auto-recommendation engine.
 *
 * After each completed job, updateCrewProfile() refreshes the crew member's
 * aggregate stats. recommendCrew() scores all available crew for a given move
 * and returns the top 3 with human-readable reasons.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface CrewProfileRow {
  id: string;
  user_id: string;
  name: string | null;
  role: "lead" | "member" | null;
  total_jobs: number;
  avg_satisfaction: number;
  avg_hours_vs_estimate: number;
  damage_incidents: number;
  damage_rate: number;
  on_time_rate: number;
  score_residential: number;
  score_white_glove: number;
  score_art_handling: number;
  score_piano: number;
  score_heavy_items: number;
  score_events: number;
  score_office: number;
  score_high_value: number;
  max_floor_walkup: number;
  can_drive_26ft: boolean;
  can_handle_piano: boolean;
}

export interface CrewRecommendation {
  crew: CrewProfileRow;
  score: number;
  reason: string;
}

interface MoveForRecommendation {
  service_type?: string | null;
  tier_selected?: string | null;
  has_art?: boolean;
  has_antiques?: boolean;
  has_piano?: boolean;
  estimate?: number | null;
}

// ═══════════════════════════════════════════════
// Specialty field resolver
// ═══════════════════════════════════════════════

function getSpecialtyField(
  serviceType: string | null,
  tier: string | null
): keyof CrewProfileRow | null {
  if (serviceType === "white_glove" || tier === "estate") return "score_white_glove";
  if (serviceType === "office_move") return "score_office";
  if (serviceType === "event") return "score_events";
  if (serviceType === "local_move" || serviceType === "long_distance") return "score_residential";
  return null;
}

// ═══════════════════════════════════════════════
// 2A: Update crew profile after completed job
// ═══════════════════════════════════════════════

export async function updateCrewProfile(
  userId: string,
  move: {
    client_rating?: number | null;
    damage_reported?: boolean | null;
    actual_hours?: number | null;
    est_hours?: number | null;
    service_type?: string | null;
    tier_selected?: string | null;
    arrived_on_time?: boolean | null;
  }
) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("crew_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const rating = move.client_rating ?? 5;
  const hoursVariance =
    move.actual_hours != null && move.est_hours != null
      ? move.actual_hours - move.est_hours
      : 0;
  const wasOnTime = move.arrived_on_time ?? true;
  const hadDamage = move.damage_reported ?? false;

  if (!existing) {
    // Create initial profile
    await admin.from("crew_profiles").insert({
      user_id: userId,
      total_jobs: 1,
      avg_satisfaction: rating,
      avg_hours_vs_estimate: hoursVariance,
      damage_incidents: hadDamage ? 1 : 0,
      damage_rate: hadDamage ? 1 : 0,
      on_time_rate: wasOnTime ? 1 : 0,
    });
    return;
  }

  const newTotal = existing.total_jobs + 1;
  const newSatisfaction =
    (existing.avg_satisfaction * existing.total_jobs + rating) / newTotal;
  const newHoursEff =
    (existing.avg_hours_vs_estimate * existing.total_jobs + hoursVariance) / newTotal;
  const newDamageIncidents = existing.damage_incidents + (hadDamage ? 1 : 0);
  const newDamageRate = newDamageIncidents / newTotal;
  const onTimeCount = Math.round(existing.on_time_rate * existing.total_jobs);
  const newOnTimeRate = (onTimeCount + (wasOnTime ? 1 : 0)) / newTotal;

  // Specialty score delta (+5 success, -5 failure)
  const specialtyField = getSpecialtyField(move.service_type ?? null, move.tier_selected ?? null);
  const updates: Record<string, number | string> = {
    total_jobs: newTotal,
    avg_satisfaction: newSatisfaction,
    avg_hours_vs_estimate: newHoursEff,
    damage_incidents: newDamageIncidents,
    damage_rate: newDamageRate,
    on_time_rate: newOnTimeRate,
    last_updated: new Date().toISOString(),
  };

  if (specialtyField) {
    const current = existing[specialtyField] as number;
    const outcome = rating >= 4 && !hadDamage ? 5 : -5;
    updates[specialtyField] = Math.min(100, Math.max(0, current + outcome));
  }

  await admin.from("crew_profiles").update(updates).eq("user_id", userId);
}

// ═══════════════════════════════════════════════
// 2B: Generate human-readable recommendation reason
// ═══════════════════════════════════════════════

function generateRecommendationReason(
  crew: CrewProfileRow,
  move: MoveForRecommendation
): string {
  const reasons: string[] = [];

  if (crew.score_white_glove > 80 && (move.tier_selected === "estate" || move.service_type === "white_glove")) {
    reasons.push("Top white glove specialist");
  }
  if (crew.score_art_handling > 80 && (move.has_art || move.has_antiques)) {
    reasons.push("Art handling specialist — zero incidents");
  }
  if (crew.avg_satisfaction >= 4.8) {
    reasons.push(`${crew.avg_satisfaction.toFixed(1)}-star average`);
  } else if (crew.avg_satisfaction >= 4.5) {
    reasons.push(`${crew.avg_satisfaction.toFixed(1)}-star rating`);
  }
  if (crew.avg_hours_vs_estimate < -0.3) {
    const minEarly = Math.round(Math.abs(crew.avg_hours_vs_estimate) * 60);
    reasons.push(`Finishes ~${minEarly}min ahead of schedule`);
  }
  if (crew.damage_rate === 0 && crew.total_jobs > 10) {
    reasons.push(`Zero damage across ${crew.total_jobs} jobs`);
  } else if (crew.damage_rate > 0 && crew.damage_rate < 0.03) {
    reasons.push("Excellent damage record");
  }
  if (crew.on_time_rate >= 0.95 && crew.total_jobs > 5) {
    reasons.push(`${Math.round(crew.on_time_rate * 100)}% on-time arrival`);
  }
  if (crew.score_events > 80 && move.service_type === "event") {
    reasons.push("Experienced event logistics specialist");
  }
  if (crew.score_office > 80 && move.service_type === "office_move") {
    reasons.push("Office relocation specialist");
  }

  return reasons.length > 0
    ? reasons.slice(0, 3).join(". ")
    : "Available and qualified";
}

// ═══════════════════════════════════════════════
// 2B: Auto-recommendation engine
// ═══════════════════════════════════════════════

export async function recommendCrew(
  move: MoveForRecommendation,
  moveDate: string | null
): Promise<CrewRecommendation[]> {
  const admin = createAdminClient();

  // Get all crew profiles
  const { data: profiles } = await admin
    .from("crew_profiles")
    .select("*")
    .order("avg_satisfaction", { ascending: false });

  if (!profiles?.length) return [];

  // If we have a date, filter to crew without conflicts that day
  let availableUserIds: Set<string> | null = null;
  if (moveDate) {
    const { data: blockedCrew } = await admin
      .from("crew_schedule_blocks")
      .select("crew_id")
      .eq("block_date", moveDate)
      .eq("block_type", "blocked");

    const blockedIds = new Set((blockedCrew ?? []).map((b: { crew_id: string }) => b.crew_id));

    // Get crew already with a full-day assignment on this date
    const { data: movesOnDate } = await admin
      .from("moves")
      .select("crew_id")
      .eq("move_date", moveDate)
      .in("status", ["scheduled", "confirmed", "en_route_to_pickup", "in_progress"]);

    const busyCrew = new Set((movesOnDate ?? []).map((m: { crew_id: string | null }) => m.crew_id).filter(Boolean));
    availableUserIds = new Set(
      profiles
        .map((p) => p.user_id)
        .filter((id) => !blockedIds.has(id) && !busyCrew.has(id))
    );
  }

  const moveRevenue = move.estimate ?? 0;

  const scored = (profiles as CrewProfileRow[])
    .filter((crew) => {
      if (availableUserIds && !availableUserIds.has(crew.user_id)) return false;
      if (move.has_piano && !crew.can_handle_piano) return false;
      return true;
    })
    .map((crew) => {
      let score = 50;

      // Specialty match
      if (move.service_type === "white_glove" || move.tier_selected === "estate") {
        score += (crew.score_white_glove / 100) * 30;
      }
      if (move.has_art || move.has_antiques) {
        score += (crew.score_art_handling / 100) * 30;
      }
      if (move.has_piano) {
        score += (crew.score_piano / 100) * 30;
      }
      if (move.service_type === "event") {
        score += (crew.score_events / 100) * 30;
      }
      if (move.service_type === "office_move") {
        score += (crew.score_office / 100) * 20;
      }
      if (moveRevenue > 3000) {
        score += (crew.score_high_value / 100) * 20;
      }

      // General performance
      score += crew.avg_satisfaction * 5;       // 5-star → +25
      score -= crew.damage_rate * 50;            // 10% damage → -5
      score -= Math.max(0, crew.avg_hours_vs_estimate) * 5; // slow = penalty
      score += crew.on_time_rate * 10;           // punctuality bonus

      return { crew, score };
    });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ crew, score }) => ({
    crew,
    score: Math.round(score),
    reason: generateRecommendationReason(crew, move),
  }));
}

// ═══════════════════════════════════════════════
// Crew profile getter (used in scheduling)
// ═══════════════════════════════════════════════

export async function getCrewProfile(userId: string): Promise<CrewProfileRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("crew_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as CrewProfileRow | null;
}
