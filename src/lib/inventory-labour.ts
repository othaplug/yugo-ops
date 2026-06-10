/**
 * Estimate crew size, hours, and truck from inventory score.
 * Used by InventoryInput, quote generate API, and move create API.
 *
 * Section 2: Crew size is now inventory-score-based (no hard move-size minimums).
 * Section 4C: Drive time uses actual minutes × 2.5 factor (to/from + return).
 * Section 4E: Long drop-off adds 50% of return drive time to hours estimate.
 */

const DISASSEMBLY_BY_SIZE: Record<string, number> = {
  studio: 0.25,
  "1br": 0.5,
  "2br": 0.75,
  "3br": 1.0,
  "4br": 1.25,
  "5br_plus": 1.5,
  partial: 0.25,
};

const MIN_HOURS_BY_SIZE: Record<string, number> = {
  studio: 2.5,
  "1br": 3.5,
  "2br": 4.5,
  "3br": 5.5,
  "4br": 7.0,
  "5br_plus": 8.5,
  partial: 2.0,
};

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
): { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } {
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

  // Parallel efficiency by access. Walk-ups force serial trips through
  // a single stairwell so the marginal value of mover #3, #4, #5
  // drops. Ground floor and elevators allow near-linear scaling.
  function accessEfficiency(a: string | undefined): number {
    const v = (a ?? "").toLowerCase();
    if (
      v === "walk_up_3" ||
      v === "walk_up_3rd" ||
      v.startsWith("walk_up_4")
    ) {
      return 0.55;
    }
    if (v === "walk_up_2" || v === "walk_up_2nd") return 0.7;
    if (v === "basement" || v === "basement_stairs") return 0.75;
    if (v === "long_carry" || v === "narrow_stairs") return 0.7;
    return 0.85; // ground_floor, elevator, loading_dock
  }
  const fromEff = accessEfficiency(fromAccess);
  const toEff = accessEfficiency(toAccess);
  const loadEffectiveCrew = Math.max(1, crewSize * fromEff);
  const unloadEffectiveCrew = Math.max(1, crewSize * toEff);

  // Load/unload man-hours (the old formula's "wall-clock"-ish numbers
  // are actually closer to total work-time, so we treat them as
  // man-hours). Divide by effective parallel crew → real wall-clock.
  const loadManHours = (inventoryScore / 12) * careMultiplier;
  const unloadManHours = loadManHours * 0.75;
  const loadHours = loadManHours / loadEffectiveCrew;
  const unloadHours = unloadManHours / unloadEffectiveCrew;

  // Assembly is typically done by 1–2 dedicated crew members in
  // parallel with the rest of the team unloading. Cap parallelism at 2
  // — it's awkward to have 3+ people clustered around one bed frame.
  const baseDisassemblyHours = DISASSEMBLY_BY_SIZE[sizeKey] ?? 0.5;
  const itemAssemblyMinutes = options?.assemblyMinutes ?? 0;
  let disassemblyHours: number;
  if (itemAssemblyMinutes > 0) {
    const assemblyParallel = Math.min(2, Math.max(1, crewSize - 2));
    const assemblyManHours = (itemAssemblyMinutes / 60) * careMultiplier;
    disassemblyHours = Math.max(
      baseDisassemblyHours,
      assemblyManHours / Math.max(1, assemblyParallel * 0.9),
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

  const truckScore = options?.truckInventoryScore ?? inventoryScore;
  let truckSize = "16ft";
  if (truckScore > 25) truckSize = "20ft";
  if (truckScore > 50) truckSize = "24ft";
  if (truckScore > 75) truckSize = "26ft";
  if (truckScore > 90) truckSize = "26ft + trailer or 2 trucks";

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
  };
}
