/** Defaults for residential multi-day move_project_days rows by logical day_type */

export const MOVE_DAY_STAGE_FLOW: Record<
  string,
  { label: string; stages: string[]; requiresPoD: boolean }
> = {
  pack: {
    label: "Pack day",
    stages: ["arrived", "packing_in_progress", "packing_complete"],
    requiresPoD: false,
  },
  move: {
    label: "Move day",
    stages: [
      "departed_hq",
      "arrived_pickup",
      "loading",
      "in_transit",
      "arrived_delivery",
      "unloading",
      "complete",
    ],
    requiresPoD: true,
  },
  unpack: {
    label: "Unpack day",
    stages: ["arrived", "unpacking_in_progress", "setup_in_progress", "complete"],
    requiresPoD: false,
  },
  crating: {
    label: "Crating day",
    stages: ["arrived", "crating_in_progress", "crating_complete"],
    requiresPoD: false,
  },
  volume: {
    label: "Volume day",
    stages: ["arrived", "loading", "complete"],
    requiresPoD: false,
  },
};

export function labelForDayType(dayType: string): string {
  return MOVE_DAY_STAGE_FLOW[dayType]?.label ?? "Move day";
}
