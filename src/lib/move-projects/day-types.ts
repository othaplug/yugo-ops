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

/**
 * Office-move day stages. Uses the TrackingStatus keys the crew flow
 * already recognises (initial_walkthrough / it_documentation /
 * packing_started / packing_complete / en_route_to_pickup / loading /
 * setup / completed) so a crew opening the job sees office-appropriate
 * check-ins on Day 1 (walkthrough + IT + pack) and Day 2 (move + setup),
 * not residential "departed_hq / arrived_pickup" copy that reads as
 * moving-truck-speak on a commercial job. Tier variants trim the flow
 * per contract: Essential drops all packing (client packs), Signature
 * keeps IT packing, Priority runs the full 12-step flow.
 */
type OfficeTierKey = "priority" | "signature" | "essential";

export const OFFICE_MOVE_DAY_STAGES: Record<
  OfficeTierKey,
  Record<string, { label: string; stages: string[]; requiresPoD: boolean }>
> = {
  priority: {
    pack: {
      label: "Pack & IT prep",
      stages: [
        "initial_walkthrough",
        "it_documentation",
        "packing_started",
        "packing_complete",
      ],
      requiresPoD: false,
    },
    move: {
      label: "Move & set up",
      stages: [
        "en_route_to_pickup",
        "arrived_at_pickup",
        "loading",
        "en_route_to_destination",
        "arrived_at_destination",
        "unloading",
        "setup",
        "completed",
      ],
      requiresPoD: true,
    },
    unpack: {
      label: "Unpack & set up",
      stages: ["setup", "completed"],
      requiresPoD: false,
    },
  },
  signature: {
    pack: {
      label: "IT prep & pack",
      stages: [
        "initial_walkthrough",
        "it_documentation",
        "packing_started",
        "packing_complete",
      ],
      requiresPoD: false,
    },
    move: {
      label: "Move day",
      stages: [
        "en_route_to_pickup",
        "arrived_at_pickup",
        "loading",
        "en_route_to_destination",
        "arrived_at_destination",
        "unloading",
        "completed",
      ],
      requiresPoD: true,
    },
    unpack: {
      label: "Client unpack",
      stages: ["completed"],
      requiresPoD: false,
    },
  },
  essential: {
    pack: {
      label: "Site prep",
      stages: ["initial_walkthrough", "it_documentation"],
      requiresPoD: false,
    },
    move: {
      label: "Move day",
      stages: [
        "en_route_to_pickup",
        "arrived_at_pickup",
        "loading",
        "en_route_to_destination",
        "arrived_at_destination",
        "unloading",
        "completed",
      ],
      requiresPoD: true,
    },
    unpack: {
      label: "Client unpack",
      stages: ["completed"],
      requiresPoD: false,
    },
  },
};

/**
 * Pick the right per-day stage set. Office moves route by tier; every
 * other service falls through to the residential MOVE_DAY_STAGE_FLOW.
 * Callers pass whatever they have; missing/unknown values collapse to
 * sane defaults so nothing crashes if a project row is mid-migration.
 */
export function resolveDayStageFlow(opts: {
  serviceType?: string | null;
  tier?: string | null;
  dayType: string;
}): { label: string; stages: string[]; requiresPoD: boolean } {
  const st = String(opts.serviceType || "").toLowerCase().trim();
  if (st === "office_move") {
    const tierKey = (String(opts.tier || "priority").toLowerCase().trim() ||
      "priority") as OfficeTierKey;
    const table =
      OFFICE_MOVE_DAY_STAGES[tierKey] ?? OFFICE_MOVE_DAY_STAGES.priority;
    return table[opts.dayType] ?? table.move;
  }
  return MOVE_DAY_STAGE_FLOW[opts.dayType] ?? MOVE_DAY_STAGE_FLOW.move;
}

export function labelForDayType(dayType: string): string {
  return MOVE_DAY_STAGE_FLOW[dayType]?.label ?? "Move day";
}

/** Create Move planner defaults (admin form + DB seed overlap). */
export const MOVE_DAY_FORM_DEFAULTS: Record<
  string,
  {
    hours: number
    crewSize: number
    truckLabel: string
    /** HH:MM (24h) for HTML time inputs */
    startTime: string
  }
> = {
  pack: { hours: 8, crewSize: 3, truckLabel: "", startTime: "08:00" },
  move: { hours: 10, crewSize: 4, truckLabel: "26ft", startTime: "07:00" },
  unpack: { hours: 8, crewSize: 3, truckLabel: "", startTime: "08:00" },
  crating: { hours: 6, crewSize: 2, truckLabel: "", startTime: "08:00" },
  volume: { hours: 10, crewSize: 4, truckLabel: "26ft", startTime: "07:00" },
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
