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

  // Hard access: walk-up 3rd floor or higher adds +1 at that end
  // Include walk_up_4th_plus — matches access_scores table and QuoteForm dropdown
  const hardAccess3 = ["walk_up_3", "walk_up_3rd", "walk_up_4_plus", "walk_up_4plus", "walk_up_4th", "walk_up_4th_plus"];
  if (fromAccess && hardAccess3.includes(fromAccess)) crewSize += 1;
  if (toAccess && hardAccess3.includes(toAccess)) crewSize += 1;

  // Walk-up 4th+ with moderate inventory = +1 crew (Section 2 rule)
  const hardAccess4th = ["walk_up_4_plus", "walk_up_4plus", "walk_up_4th", "walk_up_4th_plus"];
  const has4thPlus = (fromAccess && hardAccess4th.includes(fromAccess)) || (toAccess && hardAccess4th.includes(toAccess));
  if (has4thPlus && inventoryScore > 35) crewSize += 1;

  crewSize = Math.min(6, crewSize);

  // ─── Hours estimate ────────────────────────────────────────────────────────
  // Loading: inventory score / 12 (boxes move in batches on dollies)
  const loadHours = inventoryScore / 12;
  const unloadHours = loadHours * 0.75;
  const baseDisassemblyHours = DISASSEMBLY_BY_SIZE[sizeKey] ?? 0.5;
  // Assembly auto-detection: if calcAssemblyMinutes() supplied a positive number, floor at base.
  const itemAssemblyHours =
    options?.assemblyMinutes && options.assemblyMinutes > 0
      ? options.assemblyMinutes / 60
      : 0;
  const disassemblyHours = Math.max(baseDisassemblyHours, itemAssemblyHours);

  const mode = options?.hoursEstimateMode ?? "crew_full_cycle";

  // Drive time: client quote shows loaded move only; crew_full_cycle uses Section 4C/4E ops model.
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
