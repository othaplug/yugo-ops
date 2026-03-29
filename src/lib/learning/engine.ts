/**
 * Learning Engine — post-completion calibration feedback loop.
 *
 * After every move is marked completed, collectCalibrationData() is called
 * fire-and-forget. It records prediction vs. actuals and then runs
 * checkAndUpdateCalibrations() to surface admin-reviewable suggestions.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function extractPostal(address: string | null): string | null {
  if (!address) return null;
  const match = address.match(/\b([A-Z]\d[A-Z][ -]?\d[A-Z]\d)\b/i);
  return match ? match[1].toUpperCase().replace(" ", "") : null;
}

function extractBuilding(address: string | null): string | null {
  if (!address) return null;
  // Return first line (unit/building number portion before city)
  return address.split(",")[0]?.trim() ?? null;
}

function getDayOfWeek(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", { weekday: "long" });
}

function getMonth(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").getMonth() + 1;
}

function statisticalMode(arr: string[]): string | null {
  if (!arr.length) return null;
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// ═══════════════════════════════════════════════
// Baseline lookups (mirror pricing engine defaults)
// ═══════════════════════════════════════════════

const BASELINE_HOURS: Record<string, number> = {
  studio: 2,
  "1br": 3,
  "2br": 4,
  "3br": 5.5,
  "4br": 7,
  "5br_plus": 8.5,
  partial: 2,
};

const BASELINE_CREW: Record<string, number> = {
  studio: 2,
  "1br": 2,
  "2br": 3,
  "3br": 3,
  "4br": 4,
  "5br_plus": 4,
  partial: 2,
};

function getBaselineHours(moveSize: string): number {
  return BASELINE_HOURS[moveSize] ?? 4;
}

function getBaselineCrew(moveSize: string): number {
  return BASELINE_CREW[moveSize] ?? 2;
}

// ═══════════════════════════════════════════════
// Calibration suggestion insert
// ═══════════════════════════════════════════════

interface CalibrationSuggestionInput {
  type: string;
  move_size: string;
  service_type: string;
  current_value: string;
  suggested_value: string;
  confidence: "low" | "medium" | "high";
  reason: string;
  sample_size: number;
}

async function createCalibrationSuggestion(input: CalibrationSuggestionInput) {
  const admin = createAdminClient();

  // Avoid duplicating a pending suggestion for the same type + size
  const { data: existing } = await admin
    .from("calibration_suggestions")
    .select("id")
    .eq("type", input.type)
    .eq("move_size", input.move_size)
    .eq("service_type", input.service_type)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    // Update in place instead of creating a duplicate
    await admin
      .from("calibration_suggestions")
      .update({
        current_value: input.current_value,
        suggested_value: input.suggested_value,
        confidence: input.confidence,
        reason: input.reason,
        sample_size: input.sample_size,
      })
      .eq("id", existing.id);
    return;
  }

  await admin.from("calibration_suggestions").insert(input);
}

// ═══════════════════════════════════════════════
// 1B: Auto-calibration check
// ═══════════════════════════════════════════════

export async function checkAndUpdateCalibrations(moveSize: string, serviceType: string) {
  const admin = createAdminClient();

  const { data: recent } = await admin
    .from("calibration_data")
    .select("hours_variance, crew_variance, truck_match, actual_truck, recommended_truck")
    .eq("move_size", moveSize)
    .eq("service_type", serviceType)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!recent || recent.length < 20) return;

  const n = recent.length;
  const conf: "high" | "medium" = n >= 30 ? "high" : "medium";

  // Hours calibration
  const avgHoursVariance =
    recent.reduce((s, r) => s + (r.hours_variance ?? 0), 0) / n;
  if (Math.abs(avgHoursVariance) > 0.5) {
    const baseline = getBaselineHours(moveSize);
    await createCalibrationSuggestion({
      type: "hours_baseline",
      move_size: moveSize,
      service_type: serviceType,
      current_value: `${baseline}h`,
      suggested_value: `${(baseline + avgHoursVariance).toFixed(1)}h`,
      confidence: conf,
      reason: `Average ${avgHoursVariance > 0 ? "under" : "over"}-estimate of ${Math.abs(avgHoursVariance).toFixed(1)}h over ${n} jobs`,
      sample_size: n,
    });
  }

  // Truck calibration
  const truckMismatches = recent.filter((r) => r.truck_match === false);
  const mismatchRate = truckMismatches.length / n;
  if (mismatchRate > 0.3) {
    const mostCommonActual = statisticalMode(
      truckMismatches.map((r) => r.actual_truck).filter(Boolean) as string[]
    );
    if (mostCommonActual) {
      await createCalibrationSuggestion({
        type: "truck_threshold",
        move_size: moveSize,
        service_type: serviceType,
        current_value: recent[0]?.recommended_truck ?? "unknown",
        suggested_value: mostCommonActual,
        confidence: mismatchRate > 0.5 ? "high" : "medium",
        reason: `${Math.round(mismatchRate * 100)}% of ${moveSize} jobs used ${mostCommonActual} instead of recommended`,
        sample_size: n,
      });
    }
  }

  // Crew calibration
  const avgCrewVariance =
    recent.reduce((s, r) => s + (r.crew_variance ?? 0), 0) / n;
  if (Math.abs(avgCrewVariance) > 0.3) {
    const baseline = getBaselineCrew(moveSize);
    const suggested = baseline + Math.round(avgCrewVariance);
    if (suggested !== baseline) {
      await createCalibrationSuggestion({
        type: "crew_recommendation",
        move_size: moveSize,
        service_type: serviceType,
        current_value: String(baseline),
        suggested_value: String(suggested),
        confidence: conf,
        reason: `Average crew variance of ${avgCrewVariance.toFixed(1)} over ${n} jobs`,
        sample_size: n,
      });
    }
  }
}

// ═══════════════════════════════════════════════
// 1D: Address Intelligence update
// ═══════════════════════════════════════════════

export async function updateAddressIntelligence(move: {
  from_address: string | null;
  to_address: string | null;
  hours_variance: number | null;
}) {
  const admin = createAdminClient();

  async function upsertAddress(addr: string | null, variance: number | null) {
    if (!addr) return;

    const { data: existing } = await admin
      .from("address_intelligence")
      .select("id, avg_hours_variance, move_count")
      .eq("address", addr)
      .maybeSingle();

    if (existing) {
      const newCount = existing.move_count + 1;
      const newVariance =
        ((existing.avg_hours_variance * existing.move_count) + (variance ?? 0)) / newCount;
      await admin
        .from("address_intelligence")
        .update({
          avg_hours_variance: newVariance,
          move_count: newCount,
          last_updated: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await admin.from("address_intelligence").insert({
        address: addr,
        postal_code: extractPostal(addr),
        avg_hours_variance: variance ?? 0,
        move_count: 1,
      });
    }
  }

  await Promise.allSettled([
    upsertAddress(move.from_address, move.hours_variance),
    upsertAddress(move.to_address, move.hours_variance),
  ]);
}

// ═══════════════════════════════════════════════
// 1A: Main data collection on completion
// ═══════════════════════════════════════════════

interface MoveCalibrationRow {
  id: string;
  move_size: string | null;
  service_type: string | null;
  tier_selected: string | null;
  from_address: string | null;
  to_address: string | null;
  est_hours: number | null;
  actual_hours: number | null;
  crew_count: number | null;
  actual_crew_count: number | null;
  truck_primary: string | null;
  distance_km: number | null;
  move_date: string | null;
  arrival_window: string | null;
  estimate: number | null;
  margin_percent: number | null;
  total_cost: number | null;
  client_rating: number | null;
  damage_reported: boolean | null;
  completed_at: string | null;
}

/** B2B / partner delivery completion — feeds calibration_data.vertical_code for vertical tuning. */
export async function collectB2BDeliveryCalibrationData(deliveryId: string) {
  const admin = createAdminClient();

  const { data: d } = await admin
    .from("deliveries")
    .select(
      "id, vertical_code, estimated_duration_hours, actual_hours, total_price, admin_adjusted_price, delivery_address, pickup_address, b2b_line_items",
    )
    .eq("id", deliveryId)
    .maybeSingle();

  if (!d) return;

  const dominantHandling = (() => {
    const raw = (d as { b2b_line_items?: unknown }).b2b_line_items;
    if (!Array.isArray(raw)) return null;
    const counts: Record<string, number> = {};
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const h = String((row as { handling?: string }).handling || "").trim();
      if (!h) continue;
      counts[h] = (counts[h] || 0) + 1;
    }
    const keys = Object.keys(counts);
    if (keys.length === 0) return null;
    return keys.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? null;
  })();

  const est =
    d.estimated_duration_hours != null && d.estimated_duration_hours !== ""
      ? Number(d.estimated_duration_hours)
      : null;
  const act = d.actual_hours != null && d.actual_hours !== "" ? Number(d.actual_hours) : null;

  const revenueRaw = d.admin_adjusted_price ?? d.total_price;
  const revenue = revenueRaw != null && revenueRaw !== "" ? Number(revenueRaw) : null;

  const { error } = await admin.from("calibration_data").insert({
    delivery_id: d.id,
    move_id: null,
    move_size: d.vertical_code || "b2b",
    service_type: "b2b_delivery",
    vertical_code: d.vertical_code ?? null,
    handling_type: dominantHandling,
    estimated_hours: Number.isFinite(est as number) ? est : null,
    actual_hours: Number.isFinite(act as number) ? act : null,
    distance_km: null,
    revenue: Number.isFinite(revenue as number) ? revenue : null,
    from_postal: extractPostal(d.pickup_address),
    to_postal: extractPostal(d.delivery_address),
  });

  if (error) {
    console.error("[learning/engine] calibration_data (delivery) insert failed:", error.message);
  }
}

export async function collectCalibrationData(moveId: string) {
  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select(
      "id, move_size, service_type, tier_selected, from_address, to_address, " +
      "est_hours, actual_hours, crew_count, actual_crew_count, truck_primary, " +
      "distance_km, move_date, arrival_window, estimate, margin_percent, " +
      "total_cost, client_rating, damage_reported, completed_at"
    )
    .eq("id", moveId)
    .single() as { data: MoveCalibrationRow | null; error: unknown };

  if (!move) return;

  const { data: quote } = await admin
    .from("quotes")
    .select("inventory_score, est_crew_size, truck_primary, est_hours")
    .eq("move_id", moveId)
    .maybeSingle();

  const estHours =
    move.est_hours ?? (quote?.est_hours as number | null) ?? null;
  const actualHours = move.actual_hours ?? null;
  const recCrew =
    move.crew_count ?? (quote?.est_crew_size as number | null) ?? null;
  const actualCrew = move.actual_crew_count ?? null;
  const recTruck =
    move.truck_primary ?? (quote?.truck_primary as string | null) ?? null;
  const hoursVariance =
    actualHours !== null && estHours !== null ? actualHours - estHours : null;

  const record = {
    move_id: moveId,
    move_size: move.move_size ?? null,
    service_type: move.service_type ?? null,
    tier: move.tier_selected ?? null,
    estimated_hours: estHours,
    actual_hours: actualHours,
    recommended_crew: recCrew,
    actual_crew: actualCrew,
    recommended_truck: recTruck,
    actual_truck: move.truck_primary ?? null,
    quoted_score: (quote?.inventory_score as number | null) ?? null,
    actual_score: null,
    from_postal: extractPostal(move.from_address),
    to_postal: extractPostal(move.to_address),
    from_building: extractBuilding(move.from_address),
    to_building: extractBuilding(move.to_address),
    distance_km: move.distance_km ?? null,
    day_of_week: getDayOfWeek(move.move_date),
    month: getMonth(move.move_date),
    arrival_window: move.arrival_window ?? null,
    actual_start_time: null,
    crew_lead_id: null,
    crew_member_ids: null,
    satisfaction_rating: move.client_rating ?? null,
    damage_reported: move.damage_reported ?? false,
    revenue: move.estimate ?? null,
    cost: move.total_cost ?? null,
    margin_percent: move.margin_percent ?? null,
  };

  const { error } = await admin.from("calibration_data").insert(record);
  if (error) {
    console.error("[learning/engine] calibration_data insert failed:", error.message);
    return;
  }

  // Update address intelligence
  await updateAddressIntelligence({
    from_address: move.from_address,
    to_address: move.to_address,
    hours_variance: hoursVariance,
  });

  // Run auto-calibration checks if we have enough data
  if (move.move_size && move.service_type) {
    await checkAndUpdateCalibrations(move.move_size, move.service_type).catch((e) =>
      console.error("[learning/engine] calibration check failed:", e)
    );
  }
}

// ═══════════════════════════════════════════════
// Address intelligence lookup (used in quoting)
// ═══════════════════════════════════════════════

export async function getAddressIntelligence(address: string | null) {
  if (!address) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("address_intelligence")
    .select("avg_hours_variance, move_count, parking_difficulty, building_notes, has_loading_dock, elevator_count, move_elevator_available")
    .eq("address", address)
    .maybeSingle();
  return data;
}
