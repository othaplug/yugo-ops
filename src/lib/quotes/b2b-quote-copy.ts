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

/** Context-aware hero lines for quote page + email subheading. */
export function getB2BQuoteHero(verticalCode: string | null | undefined): {
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
  return map[code] ?? map.custom;
}

/** Email/HTML subheading: single line, title-style lead. */
export function getB2BQuoteEmailSubheading(verticalCode: string | null | undefined): string {
  const { headline, subtitle } = getB2BQuoteHero(verticalCode);
  return `${headline} — ${subtitle.replace(/\.$/, "")}`;
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

/**
 * Standard B2B delivery feature bullets for quote UI.
 * @param crewSize — from quote factors `b2b_crew` or similar; defaults to 2
 */
export function getB2BDeliveryFeatureList(
  verticalCode: string | null | undefined,
  crewSize: number | null | undefined,
  verticalDisplayName?: string | null,
): string[] {
  const code = (verticalCode || "custom").trim() || "custom";
  const isCustomOther = b2bVerticalIsCustomOther(verticalCode, verticalDisplayName);
  const n = typeof crewSize === "number" && crewSize > 0 ? Math.round(crewSize) : 2;
  const line4 = isCustomOther
    ? CUSTOM_SCOPE_PLACEMENT
    : VERTICALS_NO_ASSEMBLY.has(code)
      ? NO_ASSEMBLY_LINE
      : ASSEMBLY_LINE;
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
    "Packaging And Debris Removal",
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
