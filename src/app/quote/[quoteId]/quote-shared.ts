import { SERVICE_TYPE_LABELS, TIER_LABELS } from "@/lib/displayLabels";

export const TAX_RATE = 0.13;
export const WINE = "#5C1A33";
export const FOREST = "#2C3E2D";
export const GOLD = "#B8962E";
export const CREAM = "#FAF7F2";

/* ─── Types ──────────────────────────────────── */

/** Single feature entry used by both tier card bullets and the 'Your Move Includes' section. */
export interface TierFeature {
  /** Short label shown as a bullet point on the tier card. */
  card: string;
  /** Title shown in the 'Your Move Includes' expanded section. */
  title: string;
  /** Description shown under the title in the expanded section. */
  desc: string;
  /** Lucide icon name for the expanded section. Falls back to CheckCircle if unknown. */
  iconName: string;
}

export interface TierData {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

export interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  price_type: "flat" | "per_unit" | "tiered" | "percent";
  unit_label: string | null;
  tiers: { label: string; price: number }[] | null;
  percent_value: number | null;
  applicable_service_types: string[];
  excluded_tiers: string[] | null;
  is_popular: boolean;
  display_order: number;
}

export interface AddonSelection {
  addon_id: string;
  slug: string;
  quantity: number;
  tier_index: number;
}

export interface Quote {
  id: string;
  quote_id: string;
  service_type: string;
  status: string;
  from_address: string;
  from_access: string | null;
  to_address: string;
  to_access: string | null;
  move_date: string | null;
  preferred_time: string | null;
  move_size: string | null;
  tiers: Record<string, TierData> | null;
  custom_price: number | null;
  deposit_amount: number | null;
  factors_applied: Record<string, unknown> | null;
  selected_addons: unknown[] | null;
  specialty_items: unknown[] | null;
  expires_at: string | null;
  created_at: string;
  distance_km: number | null;
  drive_time_min: number | null;
  truck_primary: string | null;
  truck_secondary: string | null;
  est_crew_size: number | null;
  contact_id: string | null;
  valuation_tier: string | null;
  valuation_upgraded: boolean | null;
  valuation_upgrade_cost: number | null;
  declaration_total: number | null;
  recommended_tier: string | null;
  inventory_items?: { slug?: string; name?: string; quantity?: number; room?: string; weight_score?: number }[] | null;
  client_box_count?: number | null;
  walkthrough_based?: boolean | null;
  walkthrough_date?: string | null;
  walkthrough_notes?: string | null;
  walkthrough_special_items?: string | null;
}

export interface ValuationTier {
  id: string;
  tier_slug: string;
  display_name: string;
  rate_description: string;
  rate_per_pound: number | null;
  max_per_item: number | null;
  max_per_shipment: number | null;
  deductible: number;
  included_in_package: string;
  damage_process: string;
  covers: string[];
  excludes: string[];
}

export interface ValuationUpgrade {
  id: string;
  move_size: string;
  from_package: string;
  to_tier: string;
  price: number;
  assumed_shipment_value: number;
}

export interface HighValueDeclaration {
  id?: string;
  item_name: string;
  description?: string;
  declared_value: number;
  weight_lbs?: number;
  fee: number;
}

/* ─── Constants ──────────────────────────────── */

export const TIER_ORDER = ["curated", "signature", "estate"] as const;

export const TIER_META: Record<
  string,
  { label: string; tagline: string; badge?: string; footer?: string; accent: string; bg: string; border: string }
> = {
  curated: {
    label: TIER_LABELS.curated,
    tagline: "Precision and care for a seamless move.",
    accent: FOREST,
    bg: "#FFFFFF",
    border: "#E2DDD5",
    footer: "Best for: straightforward moves with quality assurance.",
  },
  signature: {
    label: TIER_LABELS.signature,
    tagline: "Every detail handled. Nothing left to chance.",
    badge: "RECOMMENDED",
    accent: GOLD,
    bg: "#FFFDF8",
    border: GOLD,
    footer: "Best for: full-home moves where nothing gets overlooked.",
  },
  estate: {
    label: TIER_LABELS.estate,
    tagline: "A private standard for those who expect more than a move.",
    accent: WINE,
    bg: "#FDF8FA",
    border: WINE,
    footer: "Best for: high-value homes, art, antiques & complete transitions.",
  },
};

export const MOVE_SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br": "4 Bedroom",
  "5br_plus": "5+ Bedroom",
  partial: "Partial Move",
};

/** @deprecated Prefer getDisplayLabel(_, "service_type") for new code */
export const SERVICE_LABEL: Record<string, string> = SERVICE_TYPE_LABELS;

export const HERO_CONFIG: Record<string, { headline: string; subtitle: string }> = {
  local_move: {
    headline: "Your Move Quote is Ready",
    subtitle:
      "We\u2019ve prepared a personalized quote for your upcoming move. Choose the package that fits your needs.",
  },
  long_distance: {
    headline: "Your Long Distance Move Quote",
    subtitle:
      "Full-service cross-province moving with comprehensive packing and climate-controlled transport.",
  },
  office_move: {
    headline: "Your Office Relocation Proposal",
    subtitle:
      "A comprehensive commercial moving solution tailored to minimize downtime for your business.",
  },
  single_item: {
    headline: "Your Delivery Quote",
    subtitle:
      "Safe, professional transport for your item with full protection and care.",
  },
  white_glove: {
    headline: "Your White Glove Service Quote",
    subtitle:
      "Premium handling with enhanced protection and photo documentation for your valued items.",
  },
  specialty: {
    headline: "Your Custom Service Proposal",
    subtitle:
      "A tailored solution designed specifically for your unique project requirements.",
  },
  b2b_oneoff: {
    headline: "Your Delivery Quote",
    subtitle: "Professional logistics for your delivery needs.",
  },
  b2b_delivery: {
    headline: "Your Delivery Quote",
    subtitle: "Professional logistics for your commercial delivery.",
  },
  event: {
    headline: "Your Event Logistics Quote",
    subtitle: "Round-trip event logistics — delivery, setup, and return handled by the same crew.",
  },
  labour_only: {
    headline: "Your Service Quote",
    subtitle: "Professional crew for your labour needs — no truck required.",
  },
};

/* ─── Helpers ────────────────────────────────── */

export function fmtPrice(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fmtShortDate(d: Date) {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function fmtAccess(a: string | null) {
  if (!a) return null;
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function expiresLabel(d: string | null) {
  if (!d) return null;
  const exp = new Date(d);
  const now = new Date();
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  return `Valid for ${days} days`;
}

/** Value-only for use under a "Valid" label (e.g. "7 days", "Tomorrow") — avoids repeating "Valid". */
export function expiresValue(d: string | null) {
  if (!d) return null;
  const exp = new Date(d);
  const now = new Date();
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Expired";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Tiered deposit for residential local moves — 10 / 15 / 25 % with minimums. */
export function calculateTieredDeposit(tier: string, total: number): number {
  switch (tier) {
    case "curated":
      return Math.max(150, Math.round(total * 0.10));
    case "signature":
      return Math.max(250, Math.round(total * 0.15));
    case "estate":
      return Math.max(500, Math.round(total * 0.25));
    default:
      return Math.max(150, Math.round(total * 0.10));
  }
}

export function calculateDeposit(serviceType: string, total: number, tier?: string): number {
  if (serviceType === "local_move" && tier) {
    return calculateTieredDeposit(tier, total);
  }
  switch (serviceType) {
    case "local_move":
      if (total < 500) return total;
      if (total < 3000) return 150;
      return Math.max(150, Math.round(total * 0.10));
    case "long_distance":
      return Math.round(total * 0.25);
    case "office_move":
      return total < 5000 ? Math.round(total * 0.25) : Math.round(total * 0.3);
    case "single_item":
      if (total < 500) return total;
      return 100;
    case "white_glove":
      if (total < 500) return total;
      if (total < 1000) return 100;
      if (total < 3000) return 150;
      return Math.round(total * 0.1);
    case "specialty":
      return total < 5000 ? Math.round(total * 0.3) : Math.round(total * 0.5);
    case "b2b_oneoff":
    case "b2b_delivery":
      if (total < 300) return total;
      return 100;
    case "event":
      return Math.max(300, Math.round(total * 0.25));
    case "labour_only":
      return Math.max(200, Math.round(total * 0.50));
    default:
      if (total < 500) return total;
      if (total < 3000) return 150;
      return Math.round(total * 0.1);
  }
}
