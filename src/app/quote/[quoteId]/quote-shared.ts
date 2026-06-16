import { SERVICE_TYPE_LABELS, TIER_LABELS } from "@/lib/displayLabels";
import { formatPlatformDisplay } from "@/lib/date-format";

export { ONTARIO_HST_RATE as TAX_RATE } from "@/lib/format-currency";
export const WINE = "#5C1A33";
export const FOREST = "#2C3E2D";
export const GOLD = "#B8962E";
export const CREAM = "#FAF7F2";

/**
 * Quote / booking client copy on CREAM (#FAF7F2): WCAG-friendly greens (no washed-out hex+opacity).
 * - FOREST_BODY: secondary paragraphs, list text (~7:1 on cream).
 * - FOREST_MUTED: captions, helper lines (~5.5:1 on cream).
 */
export const FOREST_BODY = "#3E4D40";
export const FOREST_MUTED = "#5A6B5E";

/** Hero (wine) subtitle & meta, solid tints read better than 50% white */
export const HERO_SUBTITLE = "rgba(255,255,255,0.92)";
export const HERO_META_LABEL = "rgba(255,255,255,0.82)";
export const HERO_META_VALUE = "#FFFFFF";

/** Uppercase section label above h2, readable size on cream */
export const QUOTE_EYEBROW_CLASS =
  "text-[11px] font-bold tracking-[0.12em] uppercase";

/** Main section titles in quote / booking flow */
export const QUOTE_SECTION_H2_CLASS =
  "font-hero text-2xl md:text-[1.75rem] leading-snug tracking-tight";

/** Pricing / investment summary (receipt-style) */
export const QUOTE_PANEL_RECEIPT =
  "rounded-none border border-[#2C3E2D]/16 bg-white py-5 px-4 sm:px-6 shadow-[0_2px_12px_rgba(44,62,45,0.07)]";
/** Signature / legal commitment */
export const QUOTE_PANEL_SIGNATURE =
  "rounded-none border-2 border-[#5C1A33]/22 bg-[#FFFCFB] px-4 py-6 sm:px-6 sm:py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]";

/** Client-facing arrival window: coordinator window first, then legacy preferred time. */
export function quoteArrivalTimeWindowLabel(quote: {
  arrival_window?: string | null;
  preferred_time?: string | null;
}): string | null {
  const w = quote.arrival_window?.trim();
  if (w) return w;
  const t = quote.preferred_time?.trim();
  return t || null;
}

/**
 * Quote confirm step: room-by-room inventory (or walkthrough summary) is offered for smaller homes only.
 * Studio through 2 BR: show the section. 3 BR and above: omit (standard rule for Estate and residential).
 * Unknown / empty move_size: show (do not hide without a classified size).
 * Walkthrough-based quotes should still render inventory UI, combine with `quote.walkthrough_based` at the call site.
 */
const MOVE_SIZES_HIDE_QUOTE_INVENTORY_SECTION = new Set([
  "3br",
  "4br",
  "4br_plus",
  "5br_plus",
]);

export function shouldShowQuoteInventorySectionByMoveSize(
  moveSize: string | null | undefined,
): boolean {
  const raw = (moveSize ?? "").trim().toLowerCase();
  if (!raw) return true;
  return !MOVE_SIZES_HIDE_QUOTE_INVENTORY_SECTION.has(raw);
}

/* ─── Types ──────────────────────────────────── */

/** Single feature entry used by both tier card bullets and the 'Your Move Includes' section. */
export interface TierFeature {
  /**
   * Stable merge id: a Signature or Estate row with the same key replaces the lower-tier row
   * (resolved “Your Move Includes” shows one line per key, not additive duplicates).
   */
  key?: string;
  /** When true, show this line on the Signature/Estate tier card even if it only upgrades a lower-tier key. */
  highlight?: boolean;
  /** Short label shown as a bullet point on the tier card. */
  card: string;
  /** Title shown in the 'Your Move Includes' expanded section. */
  title: string;
  /** Description shown under the title in the expanded section. */
  desc: string;
  /** Optional icon name for tooling / legacy tier cards (quote inclusions grid is text-only). */
  iconName?: string;
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
  /** Arrival window label from quote creation (e.g. "Morning (8:00 AM – 10:00 AM)"). */
  arrival_window?: string | null;
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
  inventory_items?:
    | {
        slug?: string;
        name?: string;
        quantity?: number;
        room?: string;
        weight_score?: number;
        weight_tier_code?: string;
        actual_weight_lbs?: number;
      }[]
    | null;
  client_box_count?: number | null;
  walkthrough_based?: boolean | null;
  walkthrough_date?: string | null;
  walkthrough_notes?: string | null;
  walkthrough_special_items?: string | null;
  /** Assembly auto-detection fields (set during quote creation when inventory is provided). */
  assembly_required?: boolean | null;
  assembly_auto_detected?: boolean | null;
  assembly_items?: string[] | null;
  assembly_override?: boolean | null;
  assembly_minutes?: number | null;
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

/** DB rows may still use legacy `from_package` values from older migrations. */
const VALUATION_FROM_PACKAGE_ALIASES: Record<string, readonly string[]> = {
  essential: ["essential", "essentials", "curated"],
  signature: ["signature", "premier"],
  estate: ["estate"],
};

export function valuationUpgradeMatchesPackage(
  rowFromPackage: string,
  tierKey: string,
): boolean {
  const key = tierKey.toLowerCase();
  const aliases = VALUATION_FROM_PACKAGE_ALIASES[key];
  const norm = rowFromPackage.toLowerCase();
  if (aliases) return aliases.includes(norm);
  return norm === key;
}

/** Match the client protection card: same package + target tier (and legacy from_package names). */
export function findValuationUpgrade(
  upgrades: ValuationUpgrade[],
  packageKey: string,
  toTier: string,
): ValuationUpgrade | null {
  return (
    upgrades.find(
      (u) =>
        valuationUpgradeMatchesPackage(u.from_package, packageKey) &&
        u.to_tier === toTier,
    ) ?? null
  );
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

export const TIER_ORDER = ["essential", "signature", "estate"] as const;

/**
 * Tier card copy on the client quote (tagline + “Best for” footer can be overridden via platform_config).
 * `inclusionsIntro`, line above the bullet list on Signature/Estate (“Everything in Essential, plus:”).
 */
export type ResidentialQuoteTierMetaMap = Record<
  string,
  {
    label: string;
    tagline: string;
    badge?: string;
    footer?: string;
    /** Signature/Estate only: shown above “plus” bullets on tier cards. */
    inclusionsIntro?: string;
    accent: string;
    bg: string;
    border: string;
  }
>;

export const TIER_META: ResidentialQuoteTierMetaMap = {
  essential: {
    label: TIER_LABELS.essential,
    tagline: "Precision, without the extras.",
    accent: FOREST,
    bg: "#FFFFFF",
    border: "#E2DDD5",
    footer: "Best for: organized, prepared moves with minimal handling needs.",
  },
  signature: {
    label: TIER_LABELS.signature,
    tagline: "Everything protected. Nothing exposed.",
    badge: "RECOMMENDED",
    accent: WINE,
    bg: "#FFFDF8",
    border: `${WINE}45`,
    footer:
      "Best for: full-home moves where protection, flow, and peace of mind matter.",
    inclusionsIntro: "Everything in Essential, plus:",
  },
  estate: {
    label: TIER_LABELS.estate,
    tagline: "A fully managed home transition.",
    accent: WINE,
    bg: "#FDF8FA",
    border: WINE,
    footer:
      "Best for: clients who expect every detail handled, high-value homes, art, antiques, complete transitions.",
    inclusionsIntro: "Everything in Signature, plus:",
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

export const HERO_CONFIG: Record<
  string,
  { headline: string; subtitle: string }
> = {
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
    subtitle:
      "Round-trip event logistics, delivery, setup, and return handled by the same crew.",
  },
  labour_only: {
    headline: "Your Service Quote",
    subtitle: "Professional crew for your labour needs, no truck required.",
  },
  bin_rental: {
    headline: "Your Bin Rental Quote",
    subtitle:
      "Eco-friendly plastic bins: delivered before your move, picked up after.",
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

/**
 * Per-pound rates must show cents (e.g. $0.60/lb). `fmtPrice` uses 0 fraction digits and rounds $0.60 → $1.
 * Uses fixed decimals (not Intl) so the value cannot vary by runtime locale.
 */
export function fmtPricePerLb(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return `$${x.toFixed(2)}`;
}

export function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return formatPlatformDisplay(new Date(d + "T00:00:00"), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }, "\u2014");
}

export function fmtShortDate(d: Date) {
  return formatPlatformDisplay(d, { month: "short", day: "numeric" }, "");
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

/** Value-only for use under a "Valid" label (e.g. "7 days", "Tomorrow"), avoids repeating "Valid". */
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

/** Tiered deposit for residential local moves, 10 / 15 / 25 % with minimums. */
export function calculateTieredDeposit(tier: string, total: number): number {
  switch (tier) {
    case "essential":
      return Math.max(150, Math.round(total * 0.1));
    case "signature":
      return Math.max(250, Math.round(total * 0.15));
    case "estate":
      return Math.max(500, Math.round(total * 0.25));
    default:
      return Math.max(150, Math.round(total * 0.1));
  }
}

/**
 * Compute days between today and the move date. Returns Infinity if
 * move_date is not supplied / invalid, so calling code falls back to
 * the legacy "advance booking" path rather than accidentally locking
 * in full payment.
 */
export function daysUntilMove(moveDate: string | null | undefined): number {
  if (!moveDate) return Infinity;
  const target = new Date(`${moveDate.trim().slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return Infinity;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = target.getTime() - today.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function calculateDeposit(
  serviceType: string,
  total: number,
  tier?: string,
  moveDate?: string | null,
): number {
  // Global rule: any quote under $600 (total with tax) requires full payment at
  // booking — no partial deposit. (Operator policy 2026-06-17, raised from $550.)
  if (total < 600) return total;

  // Universal short-notice rule (operator decision 2026-06-11): bookings
  // less than 4 days from the move date require full payment at booking.
  // The 4-day window matches the operator's 48-hour-before-move balance
  // collection window, a booking made 3 days out leaves no operational
  // gap to collect a balance before crew dispatch. Applies to ALL
  // service types so a last-minute Estate or labour-only book doesn't
  // ship without payment locked in.
  const dUntil = daysUntilMove(moveDate);
  if (dUntil < 4) return total;

  if (serviceType === "local_move" && tier) {
    return calculateTieredDeposit(tier, total);
  }
  switch (serviceType) {
    case "local_move":
      if (total < 3000) return 150;
      return Math.max(150, Math.round(total * 0.1));
    case "long_distance":
      return Math.round(total * 0.25);
    case "office_move":
      return total < 5000 ? Math.round(total * 0.25) : Math.round(total * 0.3);
    case "single_item":
      return 100;
    case "white_glove":
      if (total < 1000) return 100;
      if (total < 3000) return 150;
      return Math.round(total * 0.1);
    case "specialty":
      return total < 5000 ? Math.round(total * 0.3) : Math.round(total * 0.5);
    case "b2b_oneoff":
    case "b2b_delivery":
      return 100;
    case "event":
      return Math.max(300, Math.round(total * 0.25));
    case "labour_only":
      // Operator change 2026-06-11: labour-only bookings made 4+ days
      // out require a flat $150 deposit (not 50%). Under-4-days short-
      // notice case already handled by the universal rule above.
      // Removes the old 50% rule which was generating $452 deposits
      // on $904 jobs, too aggressive for a flat-rate hourly service.
      return 150;
    case "bin_rental":
      return total;
    default:
      if (total < 3000) return 150;
      return Math.round(total * 0.1);
  }
}

/** Pre-tax and tax-inclusive totals from stored tier or custom price (aligned with createMoveFromQuote). */
export function getQuoteTotalWithTaxFromRow(quote: {
  selected_tier?: string | null;
  tiers?: unknown;
  custom_price?: number | null;
}): { basePrice: number; totalWithTax: number } {
  const selectedTier = quote.selected_tier;
  const tiers = quote.tiers as
    | Record<string, { price: number; total: number }>
    | undefined;
  if (selectedTier && tiers?.[selectedTier]) {
    const tierData = tiers[selectedTier];
    const basePrice = tierData?.price ?? 0;
    const totalWithTax =
      tierData?.total ?? Math.round(basePrice * 1.13);
    return { basePrice, totalWithTax };
  }
  const basePrice = Number(quote.custom_price ?? 0);
  return { basePrice, totalWithTax: Math.round(basePrice * 1.13) };
}

/**
 * Tax-inclusive deposit for offline booking (matches client quote deposit logic in aggregate).
 */
export function getOfflineDepositInclusiveFromQuote(quote: {
  service_type?: string | null;
  selected_tier?: string | null;
  tiers?: unknown;
  custom_price?: number | null;
  deposit_amount?: number | null;
  move_date?: string | null;
}): number {
  const { basePrice, totalWithTax } = getQuoteTotalWithTaxFromRow(quote);
  const st = String(quote.service_type ?? "");

  if (quote.deposit_amount != null && Number(quote.deposit_amount) > 0) {
    return Math.min(totalWithTax, Number(quote.deposit_amount));
  }

  if (st === "bin_rental") {
    return totalWithTax;
  }

  // Short-notice booking, calculateDeposit will return full amount
  // when daysUntilMove < 4. We pass move_date so it honors that rule.
  if (daysUntilMove(quote.move_date) < 4) {
    return totalWithTax;
  }

  const tier = String(quote.selected_tier ?? "");
  let depositPreTax: number;
  if (st === "local_move" && tier) {
    depositPreTax = calculateTieredDeposit(tier, basePrice);
  } else {
    depositPreTax = calculateDeposit(
      st === "local_move" ? "local_move" : st,
      basePrice,
      tier || undefined,
      quote.move_date,
    );
  }

  if (basePrice <= 0) return totalWithTax;
  return Math.min(
    totalWithTax,
    Math.round((depositPreTax / basePrice) * totalWithTax * 100) / 100,
  );
}
