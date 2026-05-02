/** Auto qualification (size/tier) without the explicit “Enable multi-day” toggle. */
export function moveProjectPlannerAutoQualifies(args: {
  serviceType: string;
  moveSize: string;
  recommendedTier: string;
  workstationCount: number;
  /** Extra pickup rows beyond the primary address (each with an address) */
  extraPickupStopCount?: number;
  /** Extra drop-off rows beyond the primary address */
  extraDropoffStopCount?: number;
}): boolean {
  /** Office relocation uses the simplified coordinator scope strip on Generate Quote. */
  if (args.serviceType === "office_move") return false;
  if (args.serviceType !== "local_move" && args.serviceType !== "long_distance")
    return false;
  const extraPick = Math.max(0, args.extraPickupStopCount ?? 0);
  const extraDrop = Math.max(0, args.extraDropoffStopCount ?? 0);
  if (extraPick > 0 || extraDrop > 0) return true;
  if (args.moveSize === "5br_plus") return true;
  if (
    args.recommendedTier === "estate" &&
    ["3br", "4br", "5br_plus"].includes(args.moveSize)
  )
    return true;
  return false;
}

/** Human-readable reason for auto-enabled project mode (Generate Quote UI). */
export function describeAutoProjectModeReason(args: {
  serviceType: string;
  moveSize: string;
  recommendedTier: string;
  extraPickupStopCount: number;
  extraDropoffStopCount: number;
}): string {
  if (args.extraPickupStopCount > 0 && args.extraDropoffStopCount > 0) {
    return "Multiple pickups and multiple drop-offs"
  }
  if (args.extraPickupStopCount > 0) return "Multiple pickup locations"
  if (args.extraDropoffStopCount > 0) return "Multiple drop-off locations"
  if (args.moveSize === "5br_plus") return "5+ bedroom (multi-day)"
  if (
    args.recommendedTier === "estate" &&
    ["3br", "4br", "5br_plus"].includes(args.moveSize)
  ) {
    return "Estate tier with 3+ bedrooms"
  }
  return "Project schedule"
}

/** When the legacy phase/day planner should appear on Generate Quote. */
export function shouldShowMoveProjectPlanner(args: {
  serviceType: string;
  moveSize: string;
  recommendedTier: string;
  multiDayEnabled: boolean;
  workstationCount: number;
  extraPickupStopCount?: number;
  extraDropoffStopCount?: number;
}): boolean {
  if (args.serviceType === "office_move") return false;
  if (args.serviceType === "local_move" || args.serviceType === "long_distance") {
    return false;
  }
  if (args.multiDayEnabled) return true;
  return moveProjectPlannerAutoQualifies(args);
}
