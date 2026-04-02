/**
 * Client-facing copy for B2B commercial delivery quotes (b2b_delivery / b2b_oneoff)
 * and other logistics-first quote types (single_item, white_glove).
 * Residential local/long-distance moves keep move-specific language elsewhere.
 */

import { ONTARIO_HST_RATE } from "@/lib/format-currency";

export function isB2BDeliveryQuoteServiceType(serviceType: string): boolean {
  return serviceType === "b2b_oneoff" || serviceType === "b2b_delivery";
}

/** Quote types that should use delivery / logistics wording (not “move”) on client flows. */
export function isClientLogisticsDeliveryServiceType(serviceType: string): boolean {
  return (
    serviceType === "b2b_oneoff" ||
    serviceType === "b2b_delivery" ||
    serviceType === "single_item" ||
    serviceType === "white_glove"
  );
}

const LOGISTICS_MOVE_TYPES = new Set([
  "b2b_oneoff",
  "b2b_delivery",
  "single_item",
  "white_glove",
]);

/** Moves / jobs in DB: use service_type and/or move_type bucket. */
export function isMoveRowLogisticsDelivery(move: {
  service_type?: string | null;
  move_type?: string | null;
}): boolean {
  return (
    LOGISTICS_MOVE_TYPES.has(String(move.service_type ?? "")) ||
    LOGISTICS_MOVE_TYPES.has(String(move.move_type ?? ""))
  );
}

/** Expected card charge total (CAD, integer dollars) for simple flat B2B quotes: custom_price + HST. */
export function expectedB2BCardGrandTotalCad(quote: {
  custom_price?: number | null;
  service_type?: string | null;
}): number | null {
  if (!isB2BDeliveryQuoteServiceType(String(quote.service_type ?? ""))) return null;
  const price = Number(quote.custom_price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return null;
  const tax = Math.round(price * ONTARIO_HST_RATE);
  return price + tax;
}

/** Email / PDF crew line: logistics wording for delivery quote types. */
export function quoteEmailCrewLine(estCrewSize: number, serviceType: string): string {
  const n = Math.max(1, Math.round(estCrewSize));
  if (isClientLogisticsDeliveryServiceType(serviceType)) {
    return `${n} licensed, insured logistics professionals`;
  }
  return `${n} professional movers`;
}

export function isB2BInvoiceQuote(
  factors: Record<string, unknown> | null | undefined,
  serviceType: string,
): boolean {
  if (!isB2BDeliveryQuoteServiceType(serviceType)) return false;
  return factors?.b2b_payment_method === "invoice";
}

const KNOWN_B2B_HANDLING = new Set([
  "threshold",
  "room_placement",
  "white_glove",
  "carry_in",
  "hand_bomb",
  "skid_drop",
]);

export type NormalizedB2bHandling =
  | "threshold"
  | "room_placement"
  | "white_glove"
  | "carry_in"
  | "hand_bomb"
  | "skid_drop";

/**
 * Normalize `factors_applied.b2b_handling_type`. Unknown or empty values return `null`
 * so copy falls back to legacy vertical-only messaging (older quotes without the field).
 */
export function normalizeB2bHandling(raw: string | null | undefined): NormalizedB2bHandling | null {
  const s = (raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (!s || !KNOWN_B2B_HANDLING.has(s)) return null;
  return s as NormalizedB2bHandling;
}

function refineHeroForHandling(
  code: string,
  h: NormalizedB2bHandling,
  base: { headline: string; subtitle: string },
): { headline: string; subtitle: string } {
  if (code === "furniture_retail") {
    switch (h) {
      case "white_glove":
        return base;
      case "threshold":
        return {
          headline: "Furniture Retail Delivery",
          subtitle:
            "Unload to front door or lobby as quoted. One transparent flat rate with professional logistics.",
        };
      case "room_placement":
        return {
          headline: "Room-of-Choice Furniture Delivery",
          subtitle: "Placement in the room you specify, as quoted.",
        };
      case "carry_in":
        return {
          headline: "Carry-In Furniture Delivery",
          subtitle: "Per-unit carry-in as quoted at pickup and delivery.",
        };
      case "hand_bomb":
        return {
          headline: "Hand-Bomb Furniture Delivery",
          subtitle: "Individual hand-carry handling as quoted.",
        };
      case "skid_drop":
        return {
          headline: "Skid Drop Furniture Delivery",
          subtitle: "Skid or pallet drop as quoted at the delivery site.",
        };
      default:
        return base;
    }
  }

  if (h === "white_glove") return base;

  if (h === "threshold") {
    const thresholdSubs: Partial<Record<string, string>> = {
      appliance:
        "Delivery to threshold (door or lobby) as quoted. Hook-up and packaging removal only when included in your quote.",
      restaurant_hospitality:
        "Commercial delivery to threshold as quoted. After-hours windows when scheduled.",
      ecommerce_bulk: "Last-mile delivery with photo proof; unload to threshold as quoted.",
      designer: "Multi-stop coordination with threshold unload as quoted at each location.",
      medical_equipment:
        "Secure transport with documentation; unload to threshold as quoted unless your order specifies otherwise.",
      art_gallery:
        "Insured fine art transport; unload to threshold as quoted unless your quote includes full placement.",
      flooring: "Secure materials transport with site protection; unload to threshold or dock as quoted.",
      custom: "Custom-scoped logistics; service to threshold as quoted unless your quote specifies more.",
    };
    const sub = thresholdSubs[code];
    if (sub) return { headline: base.headline, subtitle: sub };
  }

  if (code === "appliance" && h === "room_placement") {
    return {
      headline: base.headline,
      subtitle: "Placement in the room you specify as quoted. Connection services only when included.",
    };
  }

  return base;
}

/** Context-aware hero lines for quote page + email subheading. */
export function getB2BQuoteHero(
  verticalCode: string | null | undefined,
  handlingType?: string | null,
): {
  headline: string;
  subtitle: string;
} {
  const code = (verticalCode || "custom").trim() || "custom";
  const map: Record<string, { headline: string; subtitle: string }> = {
    furniture_retail: {
      headline: "White Glove Delivery",
      subtitle:
        "Room-of-choice placement, assembly, and packaging removal for retail deliveries.",
    },
    designer: {
      headline: "Design Delivery",
      subtitle: "Multi-stop coordination and placement to specification.",
    },
    flooring: {
      headline: "Materials Delivery",
      subtitle: "Secure transport with floor and wall protection.",
    },
    medical_equipment: {
      headline: "Medical Logistics",
      subtitle: "Chain of custody and compliance documentation included.",
    },
    art_gallery: {
      headline: "Art Transport",
      subtitle: "Climate-controlled, insured fine art handling.",
    },
    appliance: {
      headline: "Appliance Delivery",
      subtitle: "Connection-ready placement with packaging removal.",
    },
    restaurant_hospitality: {
      headline: "Commercial Delivery",
      subtitle: "After-hours availability and assembly included.",
    },
    ecommerce_bulk: {
      headline: "Last-Mile Delivery",
      subtitle: "Photo proof and same-day options when available.",
    },
    custom: {
      headline: "Specialty Transport",
      subtitle: "Custom-scoped logistics for unique requirements.",
    },
  };
  const base = map[code] ?? map.custom;
  const h = normalizeB2bHandling(handlingType ?? null);
  if (!h) return base;
  return refineHeroForHandling(code, h, base);
}

/** Email/HTML subheading: single line, title-style lead. */
export function getB2BQuoteEmailSubheading(
  verticalCode: string | null | undefined,
  handlingType?: string | null,
): string {
  const { headline, subtitle } = getB2BQuoteHero(verticalCode, handlingType);
  return `${headline} — ${subtitle.replace(/\.$/, "")}`;
}

/** Loading/unloading row for logistics `InclusionsShowcase` when B2B handling is known. */
export function getLogisticsLoadingUnloadingFeature(handlingType?: string | null): {
  title: string;
  desc: string;
} {
  const h = normalizeB2bHandling(handlingType ?? null);
  if (!h) {
    return {
      title: "Trained loading & unloading",
      desc: "Careful handling at pickup and delivery",
    };
  }
  switch (h) {
    case "threshold":
      return {
        title: "Threshold unloading",
        desc: "Careful unload to front door or lobby as quoted, not beyond unless specified.",
      };
    case "room_placement":
      return {
        title: "Placement as quoted",
        desc: "Inside placement per your quoted scope, access, and room of choice.",
      };
    case "white_glove":
      return {
        title: "White-glove handling",
        desc: "Unpacking, placement, assembly, and debris removal as quoted.",
      };
    case "carry_in":
      return {
        title: "Carry-in service",
        desc: "Per-unit carry-in at pickup and delivery as quoted.",
      };
    case "hand_bomb":
      return {
        title: "Hand-bomb unloading",
        desc: "Individual hand-carry offload as quoted.",
      };
    case "skid_drop":
      return {
        title: "Skid or pallet drop",
        desc: "Drop at dock or designated area as quoted.",
      };
  }
}

const ASSEMBLY_LINE = "Full Assembly And Room-Of-Choice Placement";
const NO_ASSEMBLY_LINE = "Careful Unloading To Designated Area";
const CUSTOM_SCOPE_PLACEMENT = "Handling & Placement Per Your Quoted Scope";

const VERTICALS_NO_ASSEMBLY = new Set(["flooring"]);

function b2bVerticalIsCustomOther(
  verticalCode: string | null | undefined,
  verticalDisplayName?: string | null,
): boolean {
  return b2bVerticalUsesPackageLeadIcon(verticalCode, verticalDisplayName);
}

function line4ForHandling(
  h: NormalizedB2bHandling,
  opts?: { assemblyRequired?: boolean },
): string {
  switch (h) {
    case "threshold":
      return "Careful Unload To Threshold (Front Door Or Lobby)";
    case "skid_drop":
      return "Skid Or Pallet Drop As Quoted";
    case "hand_bomb":
      return "Hand-Bomb Offload Service As Quoted";
    case "carry_in":
      return "Carry-In Per Unit As Quoted";
    case "room_placement":
      return opts?.assemblyRequired
        ? "Room-Of-Choice Placement With Assembly As Quoted"
        : "Room-Of-Choice Placement As Quoted";
    case "white_glove":
      return ASSEMBLY_LINE;
  }
}

function debrisBulletForHandling(
  h: NormalizedB2bHandling | null,
  opts?: { debrisRemoval?: boolean },
): string {
  if (h === null) return "Packaging And Debris Removal";
  if (h === "white_glove") return "Packaging And Debris Removal";
  if (h === "room_placement") {
    return opts?.debrisRemoval
      ? "Packaging And Debris Removal As Quoted"
      : "Coordinator Can Quote Packaging Disposal If Needed";
  }
  if (h === "carry_in" || h === "hand_bomb") {
    return opts?.debrisRemoval
      ? "Packaging And Debris Removal As Quoted"
      : "Packaging Disposal As Quoted If Needed";
  }
  return "No Haul-Away Beyond Threshold Unless Added To Your Quote";
}

export type B2BDeliveryFeatureOptions = {
  assemblyRequired?: boolean;
  debrisRemoval?: boolean;
};

/**
 * Standard B2B delivery feature bullets for quote UI.
 * @param crewSize — from quote factors `b2b_crew` or similar; defaults to 2
 */
export function getB2BDeliveryFeatureList(
  verticalCode: string | null | undefined,
  crewSize: number | null | undefined,
  verticalDisplayName?: string | null,
  handlingType?: string | null,
  opts?: B2BDeliveryFeatureOptions,
): string[] {
  const code = (verticalCode || "custom").trim() || "custom";
  const isCustomOther = b2bVerticalIsCustomOther(verticalCode, verticalDisplayName);
  const n = typeof crewSize === "number" && crewSize > 0 ? Math.round(crewSize) : 2;
  const h = normalizeB2bHandling(handlingType ?? null);

  let line4: string;
  if (isCustomOther) {
    line4 = CUSTOM_SCOPE_PLACEMENT;
  } else if (h === null) {
    line4 = VERTICALS_NO_ASSEMBLY.has(code) ? NO_ASSEMBLY_LINE : ASSEMBLY_LINE;
  } else if (VERTICALS_NO_ASSEMBLY.has(code)) {
    line4 = h === "skid_drop" ? "Skid Or Pallet Placement As Quoted" : NO_ASSEMBLY_LINE;
  } else {
    line4 = line4ForHandling(h, opts);
  }

  const debrisLine = isCustomOther
    ? "Packaging And Debris Removal"
    : debrisBulletForHandling(h, opts);

  const vehicleLine = isCustomOther
    ? "Climate-Controlled Vehicle Assigned To Your Shipment"
    : "Dedicated Delivery Vehicle (Climate-Controlled)";
  return [
    vehicleLine,
    `Professional ${n}-Person Crew`,
    "Protective Blanket Wrapping For All Items",
    line4,
    "Floor And Entryway Protection (Runners, Booties, Corner Guards)",
    "Photo Documentation (Before, During, After)",
    debrisLine,
    "All Equipment Included (Dollies, Straps, Tools)",
    "Real-Time GPS Tracking Via Partner Portal",
    "Digital Proof Of Delivery",
  ];
}

/** B2B verticals where the lead vehicle icon should not be a truck (neutral logistics mark). */
export function b2bVerticalUsesPackageLeadIcon(
  verticalCode: string | null | undefined,
  verticalDisplayName?: string | null,
): boolean {
  const code = (verticalCode || "").trim().toLowerCase();
  if (code === "custom") return true;
  const name = (verticalDisplayName || "").trim().toLowerCase();
  if (name.includes("custom") && name.includes("other")) return true;
  return false;
}
