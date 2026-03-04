export const TAX_RATE = 0.13;
export const WINE = "#5C1A33";
export const FOREST = "#2C3E2D";
export const GOLD = "#B8962E";
export const CREAM = "#FAF7F2";

/* ─── Types ──────────────────────────────────── */

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
}

/* ─── Constants ──────────────────────────────── */

export const TIER_ORDER = ["essentials", "premier", "estate"] as const;

export const TIER_META: Record<
  string,
  { label: string; tagline: string; badge?: string; accent: string; bg: string; border: string }
> = {
  essentials: {
    label: "Essentials",
    tagline: "Everything you need for a smooth move",
    accent: FOREST,
    bg: "#FFFFFF",
    border: "#E2DDD5",
  },
  premier: {
    label: "Premier",
    tagline: "Full-service protection & comfort",
    badge: "Most Popular",
    accent: GOLD,
    bg: "#FFFDF8",
    border: GOLD,
  },
  estate: {
    label: "Estate",
    tagline: "The ultimate white-glove experience",
    accent: WINE,
    bg: "#FDF8FA",
    border: WINE,
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

export const SERVICE_LABEL: Record<string, string> = {
  local_move: "Local Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_oneoff: "Delivery",
};

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

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function calculateDeposit(serviceType: string, total: number): number {
  switch (serviceType) {
    case "local_move":
      if (total < 500) return total;
      if (total < 3000) return 100;
      if (total < 5000) return Math.round(total * 0.1);
      return Math.round(total * 0.15);
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
      if (total < 300) return total;
      return 100;
    default:
      if (total < 500) return total;
      if (total < 3000) return 100;
      return Math.round(total * 0.1);
  }
}
