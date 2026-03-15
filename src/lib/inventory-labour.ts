/**
 * Estimate crew size, hours, and truck from inventory score.
 * Used by InventoryInput, quote generate API, and move create API.
 * Prompt 90 PATCH: move-size minimums, realistic hours (divisor 10, overhead, disassembly), min hours floor.
 */

const MIN_CREW_BY_SIZE: Record<string, number> = {
  studio: 2,
  "1br": 2,
  "2br": 3,
  "3br": 3,
  "4br": 4,
  "5br_plus": 4,
  partial: 2,
};

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

export function estimateLabourFromScore(
  inventoryScore: number,
  distanceKm = 0,
  fromAccess?: string,
  toAccess?: string,
  moveSize?: string,
): { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } {
  const sizeKey = moveSize && MIN_CREW_BY_SIZE[moveSize] !== undefined ? moveSize : "partial";

  // Crew from inventory score (lowered thresholds)
  let crewFromScore = 2;
  if (inventoryScore > 20) crewFromScore = 3;
  if (inventoryScore > 50) crewFromScore = 4;
  if (inventoryScore > 90) crewFromScore = 5;

  let crewSize = Math.max(MIN_CREW_BY_SIZE[sizeKey] ?? 2, crewFromScore);

  const hardAccess = ["walk_up_3", "walk_up_4_plus", "walk_up_4plus"];
  if (fromAccess && hardAccess.includes(fromAccess)) crewSize += 1;
  if (toAccess && hardAccess.includes(toAccess)) crewSize += 1;
  crewSize = Math.min(6, crewSize);

  // Hours: overhead + load (divisor 10) + drive + unload (0.75 of load) + disassembly
  const loadHours = inventoryScore / 10;
  const driveHours = distanceKm / 40;
  const unloadHours = loadHours * 0.75;
  const disassemblyHours = DISASSEMBLY_BY_SIZE[sizeKey] ?? 0.5;

  let totalHours =
    OVERHEAD_HOURS + loadHours + driveHours + unloadHours + disassemblyHours;
  totalHours = Math.round(totalHours * 2) / 2;

  const minHours = MIN_HOURS_BY_SIZE[sizeKey] ?? 3.0;
  totalHours = Math.max(minHours, totalHours);

  let truckSize = "16ft";
  if (inventoryScore > 25) truckSize = "20ft";
  if (inventoryScore > 50) truckSize = "24ft";
  if (inventoryScore > 75) truckSize = "26ft";
  if (inventoryScore > 90) truckSize = "26ft + trailer or 2 trucks";

  const rangeLow = Math.max(minHours, totalHours - 0.5);
  const rangeHigh = totalHours + 1;
  const hoursRange = `${rangeLow}–${rangeHigh} hours`;

  return {
    crewSize,
    estimatedHours: totalHours,
    hoursRange,
    truckSize,
  };
}
