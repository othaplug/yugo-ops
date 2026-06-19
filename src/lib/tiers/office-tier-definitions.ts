/**
 * Office move tier definitions — the commercial parallel to TIER_DEFINITIONS
 * (residential). Same shape and philosophy, but the lever that separates the
 * tiers is SCOPE: who packs, who unpacks, and whether Yugo runs a dedicated
 * on-site project manager.
 *
 * Tier philosophy (office):
 *   Essential — "Your team packs and unpacks. We move it properly."
 *   Signature — "We handle your IT and hardware. Your team packs the rest."
 *   Priority  — "We handle everything. Your team unlocks the door." (Recommended)
 *
 * Every tier includes the operational standards Yugo never charges separately
 * for on a commercial job: furniture wrapping, disassembly/reassembly, monitor
 * removal, a dedicated coordinator, $5M commercial general liability insurance,
 * a Certificate of Insurance (COI) for building management, a WSIB Certificate
 * of Clearance on request, OPS+ real-time tracking, and photo documentation.
 *
 * NOTE: deposit stays at 30% across all tiers and the balance is due 48h before
 * service — same as the rest of the platform. There is no electrician /
 * electrical-disconnect scope anywhere in here by design.
 *
 * pricing.anchor is the reference price used to calibrate the engine (Phase 2);
 * it is NOT a flat price — the live number comes from the inventory-driven
 * scope labour.
 */

export type OfficeTierKey = "essential" | "signature" | "priority";

/** Who performs a packing/unpacking scope on a given tier. */
export type ScopeOwner = "client" | "yugo";

/** What level of packing supplies Yugo provides. */
export type SuppliesLevel = "none" | "it_only" | "full";

export interface OfficeTierDefinition {
  key: OfficeTierKey;
  name: string;
  tagline: string;
  clientDescription: string;
  bestFor: string;
  /** Priority is the recommended tier (mirrors Estate-featured on residential). */
  recommended: boolean;

  /** Operational scope flags — drive the engine's pack/unpack labour and the card copy. */
  ops: {
    /** Who packs general office items / boxes. */
    packsGeneral: ScopeOwner;
    /** Who packs IT & hardware (monitors, TVs, electronics). */
    packsIT: ScopeOwner;
    /** Who unpacks at destination. */
    unpacks: ScopeOwner;
    /** Packing supplies Yugo includes. */
    supplies: SuppliesLevel;
    /** Dedicated on-site project manager running the job (adds a PM day-rate). */
    onsitePM: boolean;
    /** Debris + packing-material removal from both locations. */
    debrisRemoval: boolean;

    // ── Operational standards: true on EVERY office tier ──
    furnitureWrap: boolean;
    disassemblyReassembly: boolean;
    monitorRemoval: boolean;
    floorPlanPlacement: boolean;
    dedicatedCoordinator: boolean;
    coiForBuilding: boolean;       // Certificate of Insurance for building mgmt
    wsibOnRequest: boolean;        // WSIB Certificate of Clearance on request
    cgl5mInsurance: boolean;       // $5M commercial general liability
    opsTracking: boolean;          // OPS+ real-time tracking
    photoDocumentation: boolean;

    /** Crew floor for this tier (the engine may raise it from inventory). */
    crewMinimum: number;
  };

  pricing: {
    /** Reference anchor price (pre-tax) used to calibrate the engine in Phase 2. */
    anchor: number;
    /** Deposit percent — 30% across the board, balance due 48h before service. */
    depositPct: number;
  };
}

export const OFFICE_TIER_DEFINITIONS: Record<OfficeTierKey, OfficeTierDefinition> = {
  essential: {
    key: "essential",
    name: "Essential",
    tagline: "Your team packs. We move it properly.",
    clientDescription:
      "Your team handles packing and unpacking. Yugo wraps, disassembles, transports, and reassembles every piece.",
    bestFor: "Budget-conscious teams that can handle their own boxing and setup.",
    recommended: false,
    ops: {
      packsGeneral: "client",
      packsIT: "client",
      unpacks: "client",
      supplies: "none",
      onsitePM: false,
      debrisRemoval: false,
      furnitureWrap: true,
      disassemblyReassembly: true,
      monitorRemoval: true,
      floorPlanPlacement: true,
      dedicatedCoordinator: true,
      coiForBuilding: true,
      wsibOnRequest: true,
      cgl5mInsurance: true,
      opsTracking: true,
      photoDocumentation: true,
      crewMinimum: 4,
    },
    pricing: { anchor: 5500, depositPct: 30 },
  },

  signature: {
    key: "signature",
    name: "Signature",
    tagline: "We handle your IT. Your team handles the boxes.",
    clientDescription:
      "Yugo packs and protects all IT and hardware, wraps and moves every piece. Your team packs general boxes and unpacks at the new space.",
    bestFor: "Teams that want their technology handled by professionals.",
    recommended: false,
    ops: {
      packsGeneral: "client",
      packsIT: "yugo",
      unpacks: "client",
      supplies: "it_only",
      onsitePM: false,
      debrisRemoval: false,
      furnitureWrap: true,
      disassemblyReassembly: true,
      monitorRemoval: true,
      floorPlanPlacement: true,
      dedicatedCoordinator: true,
      coiForBuilding: true,
      wsibOnRequest: true,
      cgl5mInsurance: true,
      opsTracking: true,
      photoDocumentation: true,
      crewMinimum: 5,
    },
    pricing: { anchor: 6500, depositPct: 30 },
  },

  priority: {
    key: "priority",
    name: "Priority",
    tagline: "We handle everything. Your team unlocks the door.",
    clientDescription:
      "Yugo packs every box and every item, moves and reassembles per your floor plan, and unpacks everything at the destination. A dedicated on-site project manager runs the day. All supplies included.",
    bestFor: "Teams that want to show up Monday to a finished office.",
    recommended: true,
    ops: {
      packsGeneral: "yugo",
      packsIT: "yugo",
      unpacks: "yugo",
      supplies: "full",
      onsitePM: true,
      debrisRemoval: true,
      furnitureWrap: true,
      disassemblyReassembly: true,
      monitorRemoval: true,
      floorPlanPlacement: true,
      dedicatedCoordinator: true,
      coiForBuilding: true,
      wsibOnRequest: true,
      cgl5mInsurance: true,
      opsTracking: true,
      photoDocumentation: true,
      crewMinimum: 6,
    },
    pricing: { anchor: 8000, depositPct: 30 },
  },
};

export const OFFICE_TIER_ORDER: OfficeTierKey[] = ["essential", "signature", "priority"];

/** Normalize any string to an OfficeTierKey, defaulting to 'essential'. */
export function normalizeOfficeTierKey(t: string | null | undefined): OfficeTierKey {
  const k = (t ?? "essential").toLowerCase().trim();
  if (k === "signature" || k === "priority") return k;
  return "essential";
}
