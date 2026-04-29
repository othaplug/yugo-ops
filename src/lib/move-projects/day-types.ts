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

/** Crew and calendar copy: human label for a move_project_days.current_stage value */
const MOVE_PROJECT_STAGE_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const def of Object.values(MOVE_DAY_STAGE_FLOW)) {
    for (const key of def.stages) {
      m[key] = key
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  m.complete = "Complete";
  m.arrived = "Arrived";
  return m;
})();

export function displayLabelForMoveProjectStage(stage: string): string {
  const s = stage.trim();
  if (!s) return "";
  return MOVE_PROJECT_STAGE_LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
