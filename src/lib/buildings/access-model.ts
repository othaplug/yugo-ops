/**
 * Building access model — turns the typed, building-type-aware access fields on
 * a building_profiles row into a precise, named set of time drivers plus the
 * backward-compatible numbers the existing surcharge engine consumes
 * (estimated_extra_minutes_per_trip + complexity_rating) and the scheduling /
 * compliance flags that should surface as ops tasks on the move.
 *
 * Backward compatible by design: a legacy row (no typed fields) passes its
 * stored estimated_extra_minutes_per_trip straight through, so existing quote
 * amounts do not move. Only rows that carry the new typed fields get recomputed.
 *
 * Calibration anchors (per-trip minutes) match today's heuristic so pricing is
 * stable: standard elevator ~3, passenger-only ~6, single transfer ~8, multi
 * transfer ~12, high walk-up ~15.
 */

export type AccessArchetype = "house" | "walk_up" | "elevator" | "two_stage";

export type AccessDriver = {
  key: string;
  label: string;
  /** Crew-minutes added per loading/unloading trip. */
  minutesPerTrip: number;
};

export type SchedulingFlag = { key: string; label: string };

export type AccessModel = {
  archetype: AccessArchetype | null;
  drivers: AccessDriver[];
  /** Stored on the row and consumed by buildingComplexitySurchargePreTax. */
  estimatedExtraMinutesPerTrip: number;
  complexityRating: number;
  schedulingFlags: SchedulingFlag[];
  recommendExtraCrew: boolean;
};

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const bool = (v: unknown): boolean => v === true;

/** Infer the archetype when a legacy row never set one, from elevator topology. */
export function inferArchetype(row: Row): AccessArchetype | null {
  const a = str(row.access_archetype) as AccessArchetype | null;
  if (a) return a;
  const sys = str(row.elevator_system);
  if (sys === "stairs_only") return "walk_up";
  if (sys === "split_transfer" || sys === "multi_transfer") return "two_stage";
  if (bool(row.has_commercial_tenants) || str(row.building_type) === "mixed_use") return "two_stage";
  if (sys === "standard" || sys === "no_freight") return "elevator";
  return null;
}

/** True when a row carries at least one of the new typed access fields. */
function hasTypedFields(row: Row): boolean {
  return (
    str(row.access_archetype) != null ||
    str(row.entrance_steps_band) != null ||
    num(row.interior_levels) != null ||
    str(row.staircase_type) != null ||
    str(row.truck_spot) != null ||
    num(row.unit_floor) != null ||
    num(row.stair_flights) != null ||
    str(row.stair_type) != null ||
    str(row.stair_width_band) != null ||
    str(row.elevator_type) != null ||
    str(row.carry_band) != null ||
    str(row.lobby_walk_band) != null ||
    bool(row.two_stage_transfer)
  );
}

const ENTRANCE_STEPS_MIN: Record<string, number> = { none: 0, few: 0.5, porch: 1, many: 2 };
const TRUCK_SPOT_MIN: Record<string, number> = { driveway: 0, street: 0.5, laneway: 1, far: 1.5 };
const STAIRCASE_MULT: Record<string, number> = { open: 1, narrow: 1.25, tight_turn: 1.4, spiral: 1.6 };
const STAIR_TYPE_MULT: Record<string, number> = { straight: 1, exterior: 1.1, switchback: 1.15, spiral: 1.4 };
const STAIR_WIDTH_MULT: Record<string, number> = { roomy: 0.9, standard: 1, tight: 1.3 };
const CARRY_MIN: Record<string, number> = { short: 0, medium: 1.5, long: 3, very_long: 5 };
const LOBBY_WALK_MIN: Record<string, number> = { short: 0, medium: 1.5, long: 3 };

function floorTransitMinutes(floor: number | null): number {
  if (floor == null || floor <= 6) return 0;
  if (floor <= 15) return 1;
  if (floor <= 30) return 2;
  return 3;
}

function complexityFromMinutes(m: number): number {
  if (m <= 0.5) return 1;
  if (m <= 4) return 2;
  if (m <= 7) return 3;
  if (m <= 11) return 4;
  return 5;
}

export function deriveAccessModel(row: Row): AccessModel {
  const archetype = inferArchetype(row);

  // Legacy row: pass the stored per-trip number straight through (stable pricing).
  if (!hasTypedFields(row)) {
    const stored = Math.max(0, num(row.estimated_extra_minutes_per_trip) ?? 0);
    const storedComplexity = num(row.complexity_rating);
    return {
      archetype,
      drivers: [],
      estimatedExtraMinutesPerTrip: stored,
      complexityRating: storedComplexity != null ? Math.min(5, Math.max(1, Math.round(storedComplexity))) : complexityFromMinutes(stored),
      schedulingFlags: schedulingFlags(row, storedComplexity != null ? storedComplexity : complexityFromMinutes(stored)),
      recommendExtraCrew: stored >= 8,
    };
  }

  const drivers: AccessDriver[] = [];
  const add = (key: string, label: string, minutesPerTrip: number) => {
    if (minutesPerTrip > 0.01) drivers.push({ key, label, minutesPerTrip: Math.round(minutesPerTrip * 10) / 10 });
  };

  if (archetype === "house") {
    const levels = num(row.interior_levels) ?? 1;
    const stairMult = STAIRCASE_MULT[str(row.staircase_type) ?? "open"] ?? 1;
    add("interior_stairs", "Interior stairs", Math.max(0, levels - 1) * 1 * stairMult);
    add("entrance_steps", "Entrance steps", ENTRANCE_STEPS_MIN[str(row.entrance_steps_band) ?? "none"] ?? 0);
    add("truck_carry", "Carry from truck", TRUCK_SPOT_MIN[str(row.truck_spot) ?? "driveway"] ?? 0);
  } else if (archetype === "walk_up") {
    const flights = num(row.stair_flights) ?? Math.max(0, (num(row.unit_floor) ?? 1) - 1);
    const typeMult = STAIR_TYPE_MULT[str(row.stair_type) ?? "straight"] ?? 1;
    const widthMult = STAIR_WIDTH_MULT[str(row.stair_width_band) ?? "standard"] ?? 1;
    add("flights", `Stairs (${flights} ${flights === 1 ? "flight" : "flights"})`, flights * 3 * typeMult * widthMult);
    add("entrance_steps", "Entrance steps", ENTRANCE_STEPS_MIN[str(row.entrance_steps_band) ?? "none"] ?? 0);
    add("truck_carry", "Carry from truck", TRUCK_SPOT_MIN[str(row.truck_spot) ?? "driveway"] ?? 0);
  } else if (archetype === "elevator" || archetype === "two_stage") {
    const elevType = str(row.elevator_type) ?? (bool(row.freight_elevator) ? "freight" : "both");
    const base = elevType === "passenger" ? 4 : elevType === "none" ? 6 : 2.5;
    add("elevator_overhead", "Elevator handling", base);
    add("floor_transit", "High-floor transit", floorTransitMinutes(num(row.unit_floor)));
    add("carry", "Carry: dock → elevator → unit", CARRY_MIN[str(row.carry_band) ?? "short"] ?? 0);
    if (archetype === "two_stage") {
      const heavy = (num(row.total_elevator_transfers) ?? 0) >= 2;
      if (bool(row.two_stage_transfer)) add("transfer", "Two-stage transfer", heavy ? 9 : 5);
      add("lobby_walk", "Lobby / concourse walk", LOBBY_WALK_MIN[str(row.lobby_walk_band) ?? "short"] ?? 0);
      if (bool(row.elevator_shared) || bool(row.has_commercial_tenants)) add("contention", "Shared-elevator buffer", 1);
    }
  }

  const perTrip = Math.round(drivers.reduce((s, d) => s + d.minutesPerTrip, 0) * 10) / 10;
  let complexity = complexityFromMinutes(perTrip);
  if (archetype === "two_stage" && bool(row.two_stage_transfer)) complexity = Math.max(complexity, 4);
  if (archetype === "walk_up" && (num(row.unit_floor) ?? 0) >= 4) complexity = Math.max(complexity, 4);

  return {
    archetype,
    drivers,
    estimatedExtraMinutesPerTrip: perTrip,
    complexityRating: complexity,
    schedulingFlags: schedulingFlags(row, complexity),
    recommendExtraCrew: perTrip >= 8 || (archetype === "walk_up" && (num(row.stair_flights) ?? num(row.unit_floor) ?? 0) >= 3) || bool(row.two_stage_transfer),
  };
}

function schedulingFlags(row: Row, complexity: number): SchedulingFlag[] {
  const flags: SchedulingFlag[] = [];
  if (bool(row.elevator_booking_required) || num(row.elevator_window_minutes) != null) {
    const mins = num(row.elevator_window_minutes);
    flags.push({ key: "elevator_window", label: mins ? `Reserve a ${mins}-min elevator window` : "Reserve the elevator" });
  }
  if (bool(row.coi_required)) {
    const dep = num(row.coi_deposit);
    flags.push({ key: "coi", label: dep ? `Send COI + $${dep} deposit to property mgmt` : "Send COI to property mgmt" });
  }
  if (bool(row.one_move_per_day)) flags.push({ key: "one_move", label: "One move per day — book early" });
  const hours = str(row.move_hours);
  if (hours) flags.push({ key: "move_hours", label: `Move hours: ${hours}` });
  if (complexity >= 4) flags.push({ key: "site_check", label: "Pre-move site check recommended" });
  return flags;
}

/** Driver/total minutes scaled to an actual trip count, for display. */
export function accessModelTotals(model: AccessModel, trips: number) {
  return {
    totalExtraMinutes: Math.round(model.estimatedExtraMinutesPerTrip * trips),
    drivers: model.drivers.map((d) => ({ ...d, totalMinutes: Math.round(d.minutesPerTrip * trips) })),
  };
}
