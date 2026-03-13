/**
 * Estimate crew size, hours, and truck from inventory score.
 * Used by InventoryInput and quote/move APIs.
 */
export function estimateLabourFromScore(
  inventoryScore: number,
  distanceKm = 0,
  fromAccess?: string,
  toAccess?: string,
): { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } {
  let crewSize = 2;
  if (inventoryScore > 30) crewSize = 3;
  if (inventoryScore > 70) crewSize = 4;
  if (inventoryScore > 110) crewSize = 5;

  const hardAccess = ["walk_up_3", "walk_up_4_plus", "walk_up_4plus"];
  if (fromAccess && hardAccess.includes(fromAccess)) crewSize += 1;
  if (toAccess && hardAccess.includes(toAccess)) crewSize += 1;
  crewSize = Math.min(crewSize, 6);

  const loadHours = inventoryScore / 15;
  const driveHours = distanceKm / 40;
  const unloadHours = loadHours * 0.8;
  let totalHours = loadHours + driveHours + unloadHours;
  totalHours = Math.max(2, Math.round(totalHours * 2) / 2);

  let truckSize = "16ft";
  if (inventoryScore > 25) truckSize = "20ft";
  if (inventoryScore > 50) truckSize = "24ft";
  if (inventoryScore > 75) truckSize = "26ft";
  if (inventoryScore > 90) truckSize = "26ft + trailer or 2 trucks";

  const lo = Math.max(2, totalHours - 0.5);
  const hi = totalHours + 1;

  return {
    crewSize,
    estimatedHours: totalHours,
    hoursRange: `${lo}–${hi} hours`,
    truckSize,
  };
}
