/**
 * Client-facing copy for B2B commercial delivery quotes (b2b_delivery / b2b_oneoff).
 * Residential and other service types keep move-specific language elsewhere.
 */

export function isB2BDeliveryQuoteServiceType(serviceType: string): boolean {
  return serviceType === "b2b_oneoff" || serviceType === "b2b_delivery";
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
    office_furniture: {
      headline: "Commercial Furniture Delivery",
      subtitle: "Business-grade handling, assembly, and placement.",
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

const VERTICALS_NO_ASSEMBLY = new Set(["flooring"]);

/**
 * Standard B2B delivery feature bullets for quote UI.
 * @param crewSize — from quote factors `b2b_crew` or similar; defaults to 2
 */
export function getB2BDeliveryFeatureList(
  verticalCode: string | null | undefined,
  crewSize: number | null | undefined,
): string[] {
  const code = (verticalCode || "custom").trim() || "custom";
  const n = typeof crewSize === "number" && crewSize > 0 ? Math.round(crewSize) : 2;
  const line4 = VERTICALS_NO_ASSEMBLY.has(code) ? NO_ASSEMBLY_LINE : ASSEMBLY_LINE;
  return [
    "Dedicated Delivery Vehicle (Climate-Controlled)",
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
