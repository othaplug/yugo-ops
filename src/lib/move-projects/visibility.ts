/** When the multi-day move project planner should appear on Generate Quote. */
export function shouldShowMoveProjectPlanner(args: {
  serviceType: string;
  moveSize: string;
  recommendedTier: string;
  multiDayEnabled: boolean;
  workstationCount: number;
}): boolean {
  if (args.multiDayEnabled) return true;
  if (args.serviceType === "office_move") {
    const ws = Math.max(0, args.workstationCount);
    if (ws >= 50) return true;
    return false;
  }
  if (args.serviceType !== "local_move" && args.serviceType !== "long_distance") return false;
  if (args.moveSize === "5br_plus") return true;
  if (args.recommendedTier === "estate" && ["3br", "4br", "5br_plus"].includes(args.moveSize)) return true;
  return false;
}
