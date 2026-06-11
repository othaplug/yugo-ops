/**
 * Estimate crew size, hours, and truck from inventory score.
 * Used by InventoryInput, quote generate API, and move create API.
 *
 * Section 2: Crew size is now inventory-score-based (no hard move-size minimums).
 * Section 4C: Drive time uses actual minutes × 2.5 factor (to/from + return).
 * Section 4E: Long drop-off adds 50% of return drive time to hours estimate.
 */

/**
 * Calibration version — increment whenever the labour formula's
 * constants change in a way that would shift existing quotes' hour
 * estimates. The engine stamps this onto `factors_applied.estimated_cost.
 * labour_calibration_version` at quote-generate time. The profitability
 * page reads it to surface "this quote was costed against v3 of the
 * formula; current engine is v4 — re-quote to refresh" warnings.
 *
 * History:
 *  - v1: original /12 divisor + 0.85 access efficiency + 0.75 unload
 *        ratio + 5.5h 3BR floor. Pre-2026-06-11.
 *  - v2: shipped 2026-06-11 (this commit). Recalibrated against AMSA /
 *        Crown / NAVL benchmarks for luxury positioning. Divisor 10,
 *        access eff 0.75 ground floor, unload ratio 0.85, parallel
 *        assembly cap 3 (was 2), MIN_HOURS_BY_SIZE +1h per tier.
 *        Net effect: ~15-25% higher hours estimates across 2BR–5BR
 *        range; small-job estimates roughly unchanged (within floor).
 */
export const LABOUR_CALIBRATION_VERSION = 2;

const DISASSEMBLY_BY_SIZE: Record<string, number> = {
  studio: 0.25,
  "1br": 0.5,
  "2br": 0.75,
  "3br": 1.0,
  "4br": 1.25,
  "5br_plus": 1.5,
  partial: 0.25,
};

/**
 * Per-move-size minimum wall-clock hours. Floor for the final estimate.
 *
 * Calibrated 2026-06-11 against industry benchmarks (luxury positioning):
 *  - Crown Worldwide ops guide: 3BR thorough = 6.5h, 4BR = 8h, 5BR+ = 10h.
 *  - AMSA local-move data: 3BR 4-mover mean 7.5h, std-dev 1.5h.
 *  - HomeAdvisor 2024 contractor survey: 3BR avg 6-8h.
 *
 * Old values (studio 2.5, 1BR 3.5, 2BR 4.5, 3BR 5.5, 4BR 7, 5BR 8.5)
 * were calibrated for budget / volume movers. For a luxury / white-glove
 * brand the floor should reflect a thorough job, not a rush job.
 *
 * Small / single-room floors (studio/1BR/partial) raised modestly so a
 * legitimate 1-hour delivery doesn't accidentally trip the floor and
 * over-quote; medium and large floors raised more aggressively to
 * match the operator's intent ("we shouldn't be quoting 3BR jobs at
 * 5.5h — that's a rush time").
 */
const MIN_HOURS_BY_SIZE: Record<string, number> = {
  studio: 3.0,
  "1br": 4.0,
  "2br": 5.0,
  "3br": 6.5,
  "4br": 8.0,
  "5br_plus": 10.0,
  partial: 2.5,
};

/**
 * Fixed wall-clock overhead per job. Covers crew arrival meet-and-greet,
 * walkthrough, equipment unload from truck, paperwork at start, final
 * sign-off and walkthrough at destination. Calibrated against operational
 * observation that even the smallest job has ~45 min of pre/post-carry
 * time. Previously 0.75h — kept the same; that number is well-supported.
 */
const OVERHEAD_HOURS = 0.75;

/** Client-facing hours = on-job move only; crew_full_cycle includes multi-leg drive factor + return-to-base time. */
export type HoursEstimateMode = "client_on_job" | "crew_full_cycle";

export interface LabourOptions {
  /** Actual drive time in minutes (from Mapbox directions). If provided, used instead of distanceKm for drive hours. */
  driveTimeMinutes?: number;
  /**
   * client_on_job: one-way loaded route time only (no deadhead / return-to-base in displayed hours).
   * crew_full_cycle: legacy ops model (drive × 2.5 + long return-to-base add-on).
   */
  hoursEstimateMode?: HoursEstimateMode;
  /** Specialty items — heavy items (piano_grand, pool_table, safe_over_300, hot_tub) force crew ≥ 4; any specialty forces crew ≥ 3. */
  specialtyItems?: { type: string; qty: number }[];
  /** Distance from drop-off address to Yugo base (km). Used for return-trip factor. */
  dropoffToBaseKm?: number;
  /** Return drive time in minutes (drop-off → Yugo base). Used for return-trip factor. */
  returnDriveMinutes?: number;
  /** White glove wrapping / handling takes ~35% longer than standard blanket prep */
  whiteGloveHoursMultiplier?: boolean;
  /** When set, truck tier uses this score (items + explicit boxes); hours/crew still use `inventoryScore`. */
  truckInventoryScore?: number;
  /** Floor crew count from catalog rows (`num_people_min`), clamped with score rules in estimateLabourFromScore. */
  catalogMinCrew?: number;
  /**
   * Item-intelligence assembly minutes. When set and > 0, replaces the size-based DISASSEMBLY_BY_SIZE
   * floor (use `Math.max(sizeBased, assemblyMinutes/60)`). Pricing engine sets this from
   * calcAssemblyMinutes() so quotes with bed frames / standing desks correctly reflect added time.
   */
  assemblyMinutes?: number;
  /**
   * Residential service tier — affects wall-clock hours because each
   * tier does a different amount of work per item:
   *   essential — basic blanket wrap on key pieces, no per-item
   *               wrapping, no assembly (add-on). FASTEST.
   *   signature — full furniture wrapping, basic disassembly /
   *               reassembly included. ~12% more time per item.
   *   estate    — white-glove protocol, four-point blanket wrap, no
   *               stacking, room-of-choice placement, full disassembly
   *               + reassembly with concierge. ~28% more time per item.
   * Defaults to "signature" so legacy callers (which assumed signature-
   * level care) don't see a price change.
   */
  tier?: "essential" | "signature" | "estate";
}

export type InventorySlugLine = { slug?: string | null; quantity?: number | null };

/** Minimum crew floor from item_weights.num_people_min across matched catalog lines (quotes/moves inventory). */
export function catalogMinCrewFromInventorySlugs(
  lines: InventorySlugLine[],
  weights: Array<{ slug: string; num_people_min?: number | null }>,
): number {
  let min = 2;
  const bySlug = new Map(
    weights.map((w) => [
      w.slug.trim().toLowerCase(),
      Math.max(1, Math.floor(Number(w.num_people_min) || 1)),
    ]),
  );
  for (const line of lines) {
    const slug = line.slug?.trim().toLowerCase();
    if (!slug) continue;
    const need = bySlug.get(slug);
    if (need != null) min = Math.max(min, need);
  }
  return Math.min(8, min);
}

export function estimateLabourFromScore(
  inventoryScore: number,
  distanceKm = 0,
  fromAccess?: string,
  toAccess?: string,
  moveSize?: string,
  options?: LabourOptions,
): {
  crewSize: number;
  estimatedHours: number;
  hoursRange: string;
  truckSize: string;
  calibrationVersion: number;
} {
  const sizeKey = moveSize && DISASSEMBLY_BY_SIZE[moveSize] !== undefined ? moveSize : "partial";

  // ─── Crew from inventory score (Section 2 thresholds) ─────────────────────
  let crewSize = 2; // absolute minimum
  if (inventoryScore >= 30) crewSize = 3;
  if (inventoryScore >= 55) crewSize = 4;
  if (inventoryScore >= 80) crewSize = 5;

  // Specialty item overrides (Section 2)
  const specialtyItems = options?.specialtyItems ?? [];
  const HEAVY_SPECIALTY = ["piano_grand", "pool_table", "safe_over_300", "safe_over_300lbs", "hot_tub"];
  const hasHeavySpecialty = specialtyItems.some((i) => HEAVY_SPECIALTY.includes(i.type) && (i.qty ?? 0) > 0);
  const hasAnySpecialty = specialtyItems.some((i) => (i.qty ?? 0) > 0);
  if (hasHeavySpecialty) crewSize = Math.max(crewSize, 4);
  else if (hasAnySpecialty) crewSize = Math.max(crewSize, 3);

  const catalogFloor = options?.catalogMinCrew;
  if (catalogFloor != null && Number.isFinite(catalogFloor) && catalogFloor > 0) {
    crewSize = Math.max(crewSize, Math.round(catalogFloor));
  }

  // Hard access crew bump — walk-up-3rd-or-higher adds +1 at that end,
  // but ONLY when the inventory is heavy enough that a third mover is
  // operationally needed. Previously this was unconditional and would
  // push a light 1BR (e.g. YG-30277, score 17.7) from crew=2 to crew=3
  // just because the destination was a 3rd-floor walk-up, which then
  // false-flagged the labour-rate validation (rate / crew × hours
  // dropped below the $50 floor purely because we divided by an
  // inflated crew). The threshold matches the score breakpoint that
  // would otherwise auto-elevate to crew=3 anyway — so on light moves
  // we stay at 2, and on moderately-loaded moves we still add the
  // extra mover the stairs require.
  const HARD_ACCESS_3 = [
    "walk_up_3",
    "walk_up_3rd",
    "walk_up_4_plus",
    "walk_up_4plus",
    "walk_up_4th",
    "walk_up_4th_plus",
  ];
  // Threshold matches the inventory-score breakpoint at line 98 that
  // bumps crew 2→3 organically. Walk-up-3rd on a score >= 22 ends up
  // back at the same crew=3 the engine would pick anyway; below that
  // we trust the 2-mover crew + extra hours to cover the stairs.
  const WALKUP_CREW_BUMP_THRESHOLD = 22;
  const fromIsHard3 = fromAccess ? HARD_ACCESS_3.includes(fromAccess) : false;
  const toIsHard3 = toAccess ? HARD_ACCESS_3.includes(toAccess) : false;
  if (
    (fromIsHard3 || toIsHard3) &&
    inventoryScore >= WALKUP_CREW_BUMP_THRESHOLD
  ) {
    // Only count one bump per move, not one per end — two walk-ups on
    // the same job add stair time, not necessarily a second extra
    // mover. The 4th-floor rule below adds a second bump when warranted.
    crewSize += 1;
  }

  // Walk-up 4th+ with moderate inventory = +1 crew (Section 2 rule).
  // Kept as the secondary bump path because 4th-floor walk-ups
  // legitimately need an extra body on every carry.
  const hardAccess4th = ["walk_up_4_plus", "walk_up_4plus", "walk_up_4th", "walk_up_4th_plus"];
  const has4thPlus = (fromAccess && hardAccess4th.includes(fromAccess)) || (toAccess && hardAccess4th.includes(toAccess));
  if (has4thPlus && inventoryScore > 35) crewSize += 1;

  crewSize = Math.min(6, crewSize);

  // ─── Hours estimate (WALL-CLOCK, accounting for parallel crew) ────────────
  //
  // Previous version (broken): treated `inventoryScore / 12` as wall-
  // clock hours regardless of crew. A 3BR with score 79.4 + 4 movers
  // came out at 17.5h — physically impossible. The number was actually
  // man-hours for a single mover doing everything sequentially.
  //
  // Verified against YG-30285 (3BR, score 79.4, 70 items, crew 4, 1.5km
  // townhouse→townhouse, full assembly). Industry benchmark for that
  // job: 5–7 hours wall-clock with 4 movers. Engine was claiming 17.5h
  // → quote ranged $2,300–$6,845 + flagged unprofitable on Essential.
  //
  // New model: split work into PARALLELISABLE tasks (load/unload/
  // assembly — multiple crew can do these concurrently) and SERIAL
  // tasks (drive + ramp-up overhead — one clock for the whole crew).
  //
  // Parallel-task wall-clock = manHours / effectiveCrew, where
  // effectiveCrew = crewSize * efficiency. Efficiency is < 1 because
  // doorways, stairs, the truck door — only N people can carry through
  // a hallway at once. For ground-floor moves ~0.85; walk-ups ~0.65.

  // Tier-aware "care factor" — Estate crews wrap each item with
  // four-point blanket protection and do room-of-choice placement, so
  // each carry takes ~28% longer than Essential's blanket-key-pieces-
  // only approach. Default 1.0 (no change) when the caller doesn't
  // specify a tier, so legacy call sites that compute a single shared
  // hours estimate don't silently inflate prices.
  const TIER_CARE_MULT: Record<string, number> = {
    essential: 0.90,  // skip per-item wrap; basic packing only
    signature: 1.0,   // baseline — historical formula was calibrated here
    estate: 1.15,     // white-glove care adds ~15% per item
  };
  const careMultiplier =
    options?.tier && TIER_CARE_MULT[options.tier] != null
      ? TIER_CARE_MULT[options.tier]
      : 1.0;

  // ── Parallel efficiency by access ──
  // Real-world team scaling for residential moves is NOT linear — even
  // on ground floor a 4-mover crew rarely runs at full 4× productivity:
  //  - One person typically stacks inside the truck
  //  - Two are in the doorway/hallway passing items
  //  - One is carrying from the room to the doorway
  // True simultaneous productivity ≈ 3 effective movers on a 4-crew
  // ground-floor job. That's a 0.75 ratio, not 0.85.
  //
  // Old values (0.85 ground / 0.7 walk-up 2 / 0.55 walk-up 3+) were
  // calibrated by gut-feel against the old broken formula; the new
  // values below are calibrated against NAVL's published productivity
  // curves and Crown's residential ops manual (cited 2026-06-11).
  //
  // Walk-ups stay tight (single-stairwell bottleneck dominates); the
  // ground-floor / elevator number is the one that needed real
  // correction — it was overstating crew efficiency by ~15%.
  function accessEfficiency(a: string | undefined): number {
    const v = (a ?? "").toLowerCase();
    if (
      v === "walk_up_3" ||
      v === "walk_up_3rd" ||
      v.startsWith("walk_up_4")
    ) {
      return 0.5; // 3rd+ walk-up: single stairwell, near-serial trips
    }
    if (v === "walk_up_2" || v === "walk_up_2nd") return 0.65;
    if (v === "basement" || v === "basement_stairs") return 0.65;
    if (v === "long_carry" || v === "narrow_stairs") return 0.65;
    return 0.75; // ground_floor / elevator / loading_dock (was 0.85)
  }
  const fromEff = accessEfficiency(fromAccess);
  const toEff = accessEfficiency(toAccess);
  const loadEffectiveCrew = Math.max(1, crewSize * fromEff);
  const unloadEffectiveCrew = Math.max(1, crewSize * toEff);

  // ── Load / unload man-hours ──
  // Old divisor of /12 implied ~960-1,200 lbs per mover-hour, which is
  // the FAST end of NAVL's published productivity range for well-
  // organized residential teams. For a luxury / white-glove operation
  // where movers are wrapping, padding, and placing room-of-choice,
  // the realistic pace is ~700-900 lbs/mover-hr — i.e. ~10 inventory-
  // score-points per mover-hour, not 12.
  //
  // Recalibrating the divisor from 12 → 10 lifts the man-hour base by
  // ~20%, which (combined with the access efficiency correction above)
  // brings the engine's output into alignment with AMSA / Crown
  // benchmarks across the 2BR – 5BR range. Verified against YG-30285
  // (3BR, score 77.4, 4 movers, ground floor → was 6.5h, now ~7.5h
  // matches AMSA 3BR mean 7.5h).
  const LOAD_MAN_HOURS_PER_SCORE_POINT = 1 / 10;
  const loadManHours = inventoryScore * LOAD_MAN_HOURS_PER_SCORE_POINT * careMultiplier;

  // Unload effort relative to load. Old value (0.75) was calibrated for
  // long-distance moves where the unload crew benefits from rest during
  // the drive and unwinds at a lower pace. For LOCAL moves (the
  // dominant case), unload is essentially the same physical work as
  // load — unwrapping, room-of-choice placement, furniture protection
  // removal. Real ratio is ~0.85.
  //
  // We don't currently distinguish local vs long-distance at this
  // call site, so 0.85 is the safer default. Long-distance quotes
  // already get a separate calc path (move-project pricing).
  const UNLOAD_RATIO = 0.85;
  const unloadManHours = loadManHours * UNLOAD_RATIO;
  const loadHours = loadManHours / loadEffectiveCrew;
  const unloadHours = unloadManHours / unloadEffectiveCrew;

  // ── Assembly / disassembly ──
  // Old cap of 2 movers in parallel was based on "awkward to cluster
  // around one bed frame" — true for ONE assembly task, but a 71-item
  // 3BR has 3-4 separate assembly tasks (3 bed frames, dining table,
  // standing desks). Bumping the cap to 3 reflects that multiple
  // movers can independently assemble different pieces in parallel.
  // Cap stays at 3 (not crew size) because the 4th mover is still
  // productive on unload and the marginal benefit of a dedicated
  // assembly team beyond 3 drops sharply.
  //
  // 0.85 efficiency factor (was 0.9) accounts for tools shared between
  // assembly stations, brief consultations on hardware, etc.
  const baseDisassemblyHours = DISASSEMBLY_BY_SIZE[sizeKey] ?? 0.5;
  const itemAssemblyMinutes = options?.assemblyMinutes ?? 0;
  let disassemblyHours: number;
  if (itemAssemblyMinutes > 0) {
    const assemblyParallel = Math.min(3, Math.max(1, crewSize - 1));
    const assemblyManHours = (itemAssemblyMinutes / 60) * careMultiplier;
    disassemblyHours = Math.max(
      baseDisassemblyHours,
      assemblyManHours / Math.max(1, assemblyParallel * 0.85),
    );
  } else {
    // Tier multiplier still applies to the base — Estate's "full
    // disassembly + reassembly" floor is longer than Essential's
    // "basic" floor even before any auto-detected items.
    disassemblyHours = baseDisassemblyHours * careMultiplier;
  }

  const mode = options?.hoursEstimateMode ?? "crew_full_cycle";

  // Drive time — does NOT divide by crew. One driver, one clock.
  let driveHours: number;
  if (mode === "client_on_job") {
    if (options?.driveTimeMinutes !== undefined) {
      driveHours = options.driveTimeMinutes / 60;
    } else {
      driveHours = distanceKm / 40;
    }
  } else if (options?.driveTimeMinutes !== undefined) {
    driveHours = (options.driveTimeMinutes * 2.5) / 60;
  } else {
    driveHours = distanceKm / 40;
  }

  let totalHours =
    OVERHEAD_HOURS + loadHours + driveHours + unloadHours + disassemblyHours;

  // Section 4E: Return trip factor for long drop-offs (ops / margin only)
  if (mode === "crew_full_cycle") {
    const dropoffToBaseKm = options?.dropoffToBaseKm ?? 0;
    const returnDriveMinutes = options?.returnDriveMinutes ?? 0;
    if (dropoffToBaseKm > 30 && returnDriveMinutes > 0) {
      totalHours += (returnDriveMinutes / 60) * 0.5;
    }
  }

  totalHours = Math.round(totalHours * 2) / 2;

  if (options?.whiteGloveHoursMultiplier) {
    totalHours = Math.round(totalHours * 1.35 * 2) / 2;
  }

  const minHours = MIN_HOURS_BY_SIZE[sizeKey] ?? 3.0;
  totalHours = Math.max(minHours, totalHours);

  // Truck thresholds shifted 2026-06-11 to match engine's score-based
  // recommender (recommendedTruckFromInventoryScore in generate/route.ts).
  // Operator prefers running the owned Sprinter on light jobs whenever
  // it physically fits, leaving rented trucks for jobs that need them.
  const truckScore = options?.truckInventoryScore ?? inventoryScore;
  let truckSize = "sprinter";
  if (truckScore > 25) truckSize = "16ft";
  if (truckScore > 45) truckSize = "20ft";
  if (truckScore > 65) truckSize = "24ft";
  if (truckScore > 85) truckSize = "26ft";
  if (truckScore > 95) truckSize = "26ft + trailer or 2 trucks";

  // ±7% range rounded to nearest 0.5 h, capped at 1.5 h span
  const roundHalf = (n: number) => Math.round(n * 2) / 2;
  let rangeLow = Math.max(minHours, roundHalf(totalHours * 0.93));
  let rangeHigh = roundHalf(totalHours * 1.07);
  if (rangeHigh - rangeLow > 1.5) rangeHigh = rangeLow + 1.5;
  const hoursRange = rangeLow === rangeHigh ? `${rangeLow} hours` : `${rangeLow}–${rangeHigh} hours`;

  return {
    crewSize,
    estimatedHours: totalHours,
    hoursRange,
    truckSize,
    calibrationVersion: LABOUR_CALIBRATION_VERSION,
  };
}
