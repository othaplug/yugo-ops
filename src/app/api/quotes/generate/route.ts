import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { logAudit } from "@/lib/audit";
import { logActivity } from "@/lib/activity";
import { validateInventoryQuantities } from "@/lib/inventory-quantity-validation";
import { estimateLabourFromScore } from "@/lib/inventory-labour";
import { getDrivingDistance, getMultiStopDrivingDistance, straightLineKmFromGtaCore } from "@/lib/mapbox/driving-distance";
import {
  calculateB2BDimensionalPrice,
  isMoveDateWeekend,
  lineItemsFromQuotePayload,
  stopsFromQuotePayload,
  type B2BDimensionalQuoteInput,
  type B2BPricingExtraLine,
} from "@/lib/pricing/b2b-dimensional";
import { loadB2BVerticalPricing } from "@/lib/pricing/b2b-vertical-load";
import {
  mergedRatesWithBundleTiers,
  prepareB2bLineItemsForDimensionalEngine,
} from "@/lib/b2b-dimensional-quote-prep";
import { normalizeB2bWeightCategory } from "@/lib/pricing/b2b-weight-helpers";
import { hasExtremeWeightCategory, residentialInventoryLineScore } from "@/lib/pricing/weight-tiers";
import {
  SPECIALTY_EQUIPMENT_DEFAULTS,
  SPECIALTY_PROJECT_BASE_DEFAULTS,
} from "@/lib/pricing/specialty-project-defaults";
import { buildBinRentalQuoteResponse } from "./bin-rental-flow";
import {
  calculateDampenedInventoryModifier,
  crewLoadedHourlyRate,
  estimateFuelCostWithDeadhead,
  estimateOperationalSuppliesCost,
  estimateTruckCostPerMove,
  expectedInventoryScoreForMoveSize,
} from "@/lib/pricing/margin-cost-model";
import { evaluateServiceAreaForQuote } from "@/lib/pricing/service-area";
import {
  calculateEstateDays,
  estateLoadedLabourCost,
  buildEstateScheduleLines,
  estateScheduleHeadline,
} from "@/lib/quotes/estate-schedule";
import { pickupDropoffFactorsFromPayload } from "@/lib/quotes/quote-address-display";
import {
  generateNextQuoteId,
  getQuoteIdPrefix,
  isQuoteIdUniqueViolation,
  quoteNumericSuffixForHubSpot,
} from "@/lib/quotes/quote-id";
import { patchHubSpotDealJobNo } from "@/lib/hubspot/sync-deal-job-no";
import { mergeResidentialIncludeLinesDeduped } from "@/lib/quotes/residential-tier-quote-display";
import { normalizePhone } from "@/lib/phone";
// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

interface InventoryItem {
  slug?: string;
  name?: string;
  quantity: number;
  weight_score?: number; // For custom items not in item_weights
  weight_tier_code?: string;
  actual_weight_lbs?: number;
  fragile?: boolean;
}

/** DB `quotes_recommended_tier_check` allows essential | signature | estate only */
function normalizeRecommendedTierForDb(
  raw: string | undefined | null
): "essential" | "signature" | "estate" {
  const t = (raw ?? "signature").toString().toLowerCase().trim();
  if (t === "essential" || t === "signature" || t === "estate") return t;
  if (t === "curated" || t === "essentials") return "essential";
  if (t === "premier") return "signature";
  return "signature";
}

interface QuoteInput {
  /** When provided, update existing quote in place instead of creating a new one */
  quote_id?: string;
  service_type: string;
  from_address: string;
  to_address: string;
  from_access?: string;
  to_access?: string;
  move_date: string;
  move_size?: string;
  specialty_items?: { type: string; qty: number }[];
  selected_addons?: AddonSelection[];
  hubspot_deal_id?: string;
  contact_id?: string;
  inventory_items?: InventoryItem[];
  client_box_count?: number;
  // Office
  square_footage?: number;
  workstation_count?: number;
  has_it_equipment?: boolean;
  has_conference_room?: boolean;
  has_reception_area?: boolean;
  timing_preference?: string;
  /** Office hourly pricing: crew headcount for labour display (optional). */
  office_crew_size?: number;
  /** Billable hours for office move (default 5). */
  office_estimated_hours?: number;
  // Single item / White glove
  item_description?: string;
  item_category?: string;
  item_weight_class?: string;
  /** Free-text instructions shown on quote */
  single_item_special_handling?: string;
  assembly_needed?: string;
  stair_carry?: boolean;
  stair_flights?: number;
  number_of_items?: number;
  // White glove
  declared_value?: number;
  // Specialty
  project_type?: string;
  timeline_hours?: number;
  custom_crating_pieces?: number;
  climate_control?: boolean;
  special_equipment?: string[];
  specialty_item_description?: string;
  specialty_dimensions?: string;
  specialty_requirements?: string[];
  specialty_notes?: string;
  specialty_building_requirements?: string[];
  specialty_access_difficulty?: string;
  // B2B One-Off
  delivery_type?: string;
  b2b_business_name?: string;
  b2b_items?: string[];
  b2b_weight_category?: string;
  b2b_special_instructions?: string;
  b2b_payment_method?: "card" | "invoice";
  /** When payment is invoice: on_completion | net_15 | net_30 */
  b2b_invoice_terms?: string;
  b2b_retailer_source?: string;
  /** Dimensional B2B pricing */
  b2b_vertical_code?: string;
  b2b_partner_organization_id?: string;
  b2b_handling_type?: string;
  /** Coordinator-selected delivery window label (e.g. morning band). */
  b2b_delivery_window?: string;
  b2b_stops?: {
    address: string;
    type: "pickup" | "delivery";
    access?: string;
    items_at_stop?: string[];
    time_window?: string;
  }[];
  b2b_line_items?: {
    description: string;
    quantity: number;
    weight_category?: string;
    weight_lbs?: number;
    actual_weight_lbs?: number;
    fragile?: boolean;
    dimensions?: string;
    /** Per-line handling (threshold, room_placement, white_glove, carry_in_per_box, skid_drop, etc.) */
    handling_type?: string;
    /** Flooring: box, roll, bundle, piece, bag, pallet, unit */
    unit_type?: string;
    serial_number?: string;
    stop_assignment?: string;
    declared_value?: string;
    crating_required?: boolean;
    hookup_required?: boolean;
    haul_away?: boolean;
    haul_away_old?: boolean;
    /** Flooring accessory lines excluded from billable unit tier counts */
    bundled?: boolean;
    assembly_required?: boolean;
    debris_removal?: boolean;
    is_skid?: boolean;
  }[];
  b2b_time_sensitive?: boolean;
  b2b_assembly_required?: boolean;
  b2b_debris_removal?: boolean;
  b2b_stairs_flights?: number;
  /** Keys matching vertical complexity_premiums (e.g. tv_mounting) */
  b2b_complexity_addons?: string[];
  b2b_crew_override?: number;
  b2b_estimated_hours_override?: number;
  /** Before 8am / after 6pm style delivery (vertical schedule surcharges when using zone pricing) */
  b2b_after_hours?: boolean;
  b2b_same_day?: boolean;
  b2b_skid_count?: number;
  b2b_total_load_weight_lbs?: number;
  b2b_haul_away_units?: number;
  b2b_returns_pickup?: boolean;
  /** Estimated monthly delivery count for volume tier discount (B2B). */
  b2b_monthly_delivery_volume_estimate?: number;
  b2b_art_hanging_count?: number;
  b2b_crating_pieces?: number;
  /** When set, replaces dimensional engine subtotal (pre-tax); access + add-ons still apply. */
  b2b_subtotal_override?: number;
  b2b_subtotal_override_reason?: string;
  /** When set, replaces full pre-tax total (includes access + add-ons). Mutually exclusive with `b2b_subtotal_override`. */
  b2b_full_pre_tax_override?: number;
  // Event (round-trip venue delivery)
  event_name?: string;
  event_return_date?: string;
  event_setup_required?: boolean;
  event_setup_hours?: number; // 1, 2, 3, or 99 = half-day
  event_setup_instructions?: string;
  /** When luxury: paid setup applies only to complex/staging (see event_complex_setup_required) */
  event_complex_setup_required?: boolean;
  /** Single-event: moves entirely within one address (no road transit) */
  event_same_location_onsite?: boolean;
  event_same_day?: boolean;
  event_pickup_time_after?: string;
  event_return_rate_preset?: "auto" | "65" | "85" | "100" | "custom";
  event_return_rate_custom?: number;
  event_additional_services?: string[];
  event_items?: {
    name: string;
    quantity: number;
    weight_category?: string;
    actual_weight_lbs?: number;
  }[];
  /** When "multi", use event_legs (≥2) for bundled round-trips; single-leg fields mirror first leg for DB compatibility */
  event_mode?: "single" | "multi";
  event_legs?: EventLegInput[];
  event_is_luxury?: boolean;
  /** Event default sprinter; other types use coordinator override */
  event_truck_type?: string;
  // Labour Only
  labour_crew_size?: number;
  labour_hours?: number;
  labour_truck_required?: boolean;
  labour_visits?: number;
  labour_second_visit_date?: string;
  labour_description?: string;
  labour_storage_needed?: boolean;
  labour_storage_weeks?: number;
  // Bin rental (service_type bin_rental)
  bin_bundle_type?: "studio" | "1br" | "2br" | "3br" | "4br_plus" | "custom";
  bin_custom_count?: number;
  bin_extra_bins?: number;
  bin_packing_paper?: boolean;
  /** Default true; set false to waive material delivery (standalone). */
  bin_material_delivery?: boolean;
  bin_linked_move_id?: string | null;
  bin_delivery_notes?: string;
  internal_notes?: string;
  // Recommended tier (coordinator's manual selection)
  recommended_tier?: "essential" | "signature" | "estate";
  // Custom crating (all service types)
  crating_pieces?: { description?: string; size: "small" | "medium" | "large" | "oversized" }[];
  // Parking / long carry (all service types); optional truck when not inventory-recommended
  from_parking?: "dedicated" | "street" | "no_dedicated";
  to_parking?: "dedicated" | "street" | "no_dedicated";
  from_long_carry?: boolean;
  to_long_carry?: boolean;
  truck_type?: string;
  /** Extra pickup stops after primary `from_address` (local / long distance / white glove). */
  additional_pickup_addresses?: { address?: string }[];
  /** Extra drop-off stops after primary `to_address`. */
  additional_dropoff_addresses?: { address?: string }[];
  /** When true, logs full residential pricing steps to the server console (also set PRICING_DEBUG=1). */
  debug_pricing?: boolean;
  /** Coordinator acknowledges out-of-service-area moves (subcontract / remote crew). */
  service_area_override?: boolean;
  // Client info (used to look up / create a contact)
  client_name?: string;
  client_email?: string;
  client_phone?: string;
}

/** One delivery/return pair in a multi-event quote */
export interface EventLegInput {
  label?: string;
  from_address: string;
  to_address: string;
  from_access?: string;
  to_access?: string;
  move_date: string;
  event_return_date?: string;
  event_same_day?: boolean;
  /** Items repositioned within venue — no transit, no truck surcharge, return rate typically 85% */
  event_same_location_onsite?: boolean;
  event_leg_truck_type?: string;
  event_return_rate_preset?: "auto" | "65" | "85" | "100" | "custom";
  event_return_rate_custom?: number;
  event_items?: {
    name: string;
    quantity: number;
    weight_category?: string;
    actual_weight_lbs?: number;
  }[];
  from_parking?: "dedicated" | "street" | "no_dedicated";
  to_parking?: "dedicated" | "street" | "no_dedicated";
  from_long_carry?: boolean;
  to_long_carry?: boolean;
}

interface AddonSelection {
  addon_id: string;
  quantity?: number;
  tier_index?: number;
}

interface TierResult {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

interface AddonBreakdownItem {
  addon_id: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const TAX_RATE_FALLBACK = 0.13;

// ═══════════════════════════════════════════════
// Config helpers
// ═══════════════════════════════════════════════

async function loadConfig(sb: SupabaseAdmin): Promise<Map<string, string>> {
  const { data } = await sb.from("platform_config").select("key, value");
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.key, row.value);
  return map;
}

function cfgNum(config: Map<string, string>, key: string, fallback: number): number {
  const v = config.get(key);
  return v !== undefined ? Number(v) : fallback;
}

/** Positive finite pre-tax dollar amount from JSON body, or undefined if absent/invalid. */
function parsePositivePreTaxOverride(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function cfgStr(config: Map<string, string>, key: string, fallback: string): string {
  return config.get(key) ?? fallback;
}

function parseJsonConfig<T>(config: Map<string, string>, key: string, fallback: T): T {
  try {
    const v = config.get(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

type TruckKey = "sprinter" | "16ft" | "20ft" | "24ft" | "26ft" | "none";

function normalizeTruckType(raw: string | undefined | null): TruckKey {
  const k = (raw || "sprinter").toLowerCase().replace(/\s+/g, "");
  if (k === "none" || k === "notruck" || k === "no_truck") return "none";
  if (k === "sprinter" || k === "16ft" || k === "20ft" || k === "24ft" || k === "26ft") return k;
  if (k.includes("16")) return "16ft";
  if (k.includes("24")) return "24ft";
  if (k.includes("20")) return "20ft";
  if (k.includes("26")) return "26ft";
  return "sprinter";
}

/** Align with inventory-labour truck tiers so surcharge matches crew estimate. */
function recommendedTruckFromInventoryScore(score: number): TruckKey {
  if (score <= 15) return "sprinter";
  if (score <= 25) return "16ft";
  if (score <= 50) return "20ft";
  if (score <= 75) return "24ft";
  return "26ft";
}

function truckSurchargeAmount(config: Map<string, string>, truck: TruckKey): number {
  if (truck === "none") return 0;
  const m = parseJsonConfig<Record<string, number>>(config, "truck_surcharges", {
    sprinter: 0,
    "16ft": 75,
    "20ft": 150,
    "24ft": 200,
    "26ft": 250,
  });
  return m[truck] ?? 0;
}

/** Default truck included in base rate for each move size (no surcharge if recommendation matches). */
const BASE_TRUCK_FOR_MOVE_SIZE: Record<string, TruckKey> = {
  studio: "sprinter",
  partial: "sprinter",
  "1br": "16ft",
  "2br": "16ft",
  "3br": "20ft",
  "4br": "20ft",
  "5br_plus": "26ft",
};

const TRUCK_UPGRADE_CHAIN: TruckKey[] = ["sprinter", "16ft", "20ft", "24ft", "26ft"];

function truckSizeRank(t: TruckKey): number {
  if (t === "none") return -1;
  const i = TRUCK_UPGRADE_CHAIN.indexOf(t);
  return i >= 0 ? i : 2;
}

/**
 * Residential: surcharge only when recommended truck is larger than the tier default for move size.
 * Upgrade fees are per step along sprinter → 16ft → 20ft → 24ft → 26ft (config: truck_upgrade_step_surcharges).
 */
function residentialTruckUpgradeSurcharge(
  config: Map<string, string>,
  moveSize: string | undefined,
  recommended: TruckKey,
): number {
  if (recommended === "none") return 0;
  const ms = moveSize ?? "2br";
  const baseTruck = BASE_TRUCK_FOR_MOVE_SIZE[ms] ?? "16ft";
  const baseRank = truckSizeRank(baseTruck);
  const recRank = truckSizeRank(recommended);
  if (recRank <= baseRank) return 0;

  const steps = parseJsonConfig<Record<string, number>>(config, "truck_upgrade_step_surcharges", {
    sprinter_16ft: 50,
    "16ft_20ft": 75,
    "20ft_24ft": 50,
    "24ft_26ft": 50,
  });

  let total = 0;
  for (let r = baseRank; r < recRank; r++) {
    const from = TRUCK_UPGRADE_CHAIN[r];
    const to = TRUCK_UPGRADE_CHAIN[r + 1];
    const key = `${from}_${to}`;
    total += steps[key] ?? 0;
  }
  return total;
}

function truckBreakdownLabel(truck: TruckKey, surcharge: number): string {
  if (truck === "none") return "No truck (on-site)";
  const labels: Record<TruckKey, string> = {
    sprinter: "Sprinter",
    "16ft": "16ft",
    "20ft": "20ft",
    "24ft": "24ft",
    "26ft": "26ft",
    none: "No truck",
  };
  const name = labels[truck] ?? truck;
  return surcharge > 0 ? `Truck: ${name} (+$${surcharge})` : `Truck: ${name} (base)`;
}

/** Defaults when platform_config `b2b_weight_surcharges` is missing or partial */
const B2B_WEIGHT_SURCHARGES_FALLBACK: Record<string, number> = {
  standard: 0,
  heavy: 50,
  very_heavy: 100,
  oversized: 175,
  /** B2B form option — same tier as single-item oversized */
  oversized_fragile: 175,
};

/** Map single-item / white-glove weight UI strings to b2b_weight_surcharges keys */
function singleItemWeightCategory(weightClass: string | undefined | null): string {
  const w = (weightClass || "").toLowerCase();
  if (w.includes("over 500")) return "oversized";
  if (w.includes("300-500") || w.includes("300–500")) return "very_heavy";
  if (w.includes("150-300") || w.includes("150–300")) return "heavy";
  return "standard";
}

function resolveEventLegReturnDiscount(
  leg: Pick<
    EventLegInput,
    "event_return_rate_preset" | "event_return_rate_custom" | "event_same_location_onsite"
  >,
  config: Map<string, string>,
): number {
  const preset = leg.event_return_rate_preset ?? "auto";
  if (preset === "custom" && leg.event_return_rate_custom != null) {
    const p = Number(leg.event_return_rate_custom);
    if (Number.isFinite(p) && p >= 0 && p <= 100) return p / 100;
  }
  if (preset === "100") return 1;
  if (preset === "85") return 0.85;
  if (preset === "65") return cfgNum(config, "event_return_discount", 0.65);
  // auto
  if (leg.event_same_location_onsite) return 0.85;
  return cfgNum(config, "event_return_discount", 0.65);
}

function parkingLongCarryLineTotal(
  config: Map<string, string>,
  input: Pick<QuoteInput, "from_parking" | "to_parking" | "from_long_carry" | "to_long_carry">,
  ends: "both" | "origin_only",
): {
  total: number;
  from_parking_fee: number;
  to_parking_fee: number;
  from_long_carry_fee: number;
  to_long_carry_fee: number;
} {
  const parkingRates = parseJsonConfig<Record<string, number>>(config, "parking_surcharges", {
    dedicated: 0,
    street: 0,
    no_dedicated: 75,
  });
  const lc = cfgNum(config, "long_carry_surcharge", 75);
  const fp = parkingRates[input.from_parking ?? "dedicated"] ?? 0;
  const tp = ends === "both" ? (parkingRates[input.to_parking ?? "dedicated"] ?? 0) : 0;
  const flc = input.from_long_carry ? lc : 0;
  const tlc = ends === "both" && input.to_long_carry ? lc : 0;
  return {
    total: fp + tp + flc + tlc,
    from_parking_fee: fp,
    to_parking_fee: tp,
    from_long_carry_fee: flc,
    to_long_carry_fee: tlc,
  };
}

const getDistance = getDrivingDistance;

/** Yugo operations base — used for deadhead and return-trip calculations. */
const YUGO_BASE_ADDRESS = "507 King Street East, Toronto, ON";

// ═══════════════════════════════════════════════
// Postal extraction & neighbourhood tier
// ═══════════════════════════════════════════════

function extractPostalPrefix(address: string): string | null {
  const m = address.match(/\b([A-Z]\d[A-Z])\s*\d[A-Z]\d\b/i);
  return m ? m[1].toUpperCase() : null;
}

async function getNeighbourhood(
  sb: SupabaseAdmin,
  address: string,
): Promise<{ tier: string | null; multiplier: number; postalPrefix: string | null }> {
  const prefix = extractPostalPrefix(address);
  if (!prefix) return { tier: null, multiplier: 1.0, postalPrefix: null };
  const { data } = await sb
    .from("neighbourhood_tiers")
    .select("tier, multiplier")
    .eq("postal_prefix", prefix)
    .single();
  return {
    tier: data?.tier ?? null,
    multiplier: data?.multiplier ?? 1.0,
    postalPrefix: prefix,
  };
}

// ═══════════════════════════════════════════════
// Access surcharges
// ═══════════════════════════════════════════════

async function getAccessSurcharge(sb: SupabaseAdmin, accessType: string | undefined): Promise<number> {
  if (!accessType) return 0;
  const { data } = await sb
    .from("access_scores")
    .select("surcharge")
    .eq("access_type", accessType)
    .single();
  return data?.surcharge ?? 0;
}

// ═══════════════════════════════════════════════
// Date multiplier
// ═══════════════════════════════════════════════

/**
 * Calendar-based date multiplier (no date_factors table compounding).
 * Weekend + season + month-boundary bumps, capped at 1.20.
 */
function computeCalendarDateMultiplier(moveDate: Date): { multiplier: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};
  let mult = 1.0;

  const dayOfWeek = moveDate.getUTCDay();
  const month = moveDate.getUTCMonth();
  const dayOfMonth = moveDate.getUTCDate();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    factors.weekend = 1.05;
    mult *= 1.05;
  } else {
    factors.weekend = 1.0;
  }

  if (month >= 5 && month <= 7) {
    factors.season = 1.1;
    mult *= 1.1;
  } else if (month === 4 || month === 8) {
    factors.season = 1.05;
    mult *= 1.05;
  } else if (month === 3 || month === 9) {
    factors.season = 1.03;
    mult *= 1.03;
  } else {
    factors.season = 1.0;
  }

  if (dayOfMonth <= 3 || dayOfMonth >= 28) {
    factors.month_boundary = 1.05;
    mult *= 1.05;
  } else {
    factors.month_boundary = 1.0;
  }

  const raw = mult;
  const capped = Math.min(mult, 1.2);
  factors.raw_before_cap = Math.round(raw * 1000) / 1000;
  factors.cap_max = 1.2;

  return { multiplier: Math.round(capped * 1000) / 1000, factors };
}

async function getDateMultiplier(
  _sb: SupabaseAdmin,
  moveDateStr: string,
): Promise<{ multiplier: number; factors: Record<string, number> }> {
  const moveDate = new Date(`${moveDateStr}T12:00:00Z`);
  return computeCalendarDateMultiplier(moveDate);
}

// ═══════════════════════════════════════════════
// Specialty surcharges
// ═══════════════════════════════════════════════

async function getSpecialtySurcharge(
  sb: SupabaseAdmin,
  items: { type: string; qty: number }[],
): Promise<number> {
  if (!items || items.length === 0) return 0;
  const types = items.map((i) => i.type);
  const { data } = await sb
    .from("specialty_surcharges")
    .select("item_type, surcharge")
    .in("item_type", types);
  const rateMap = new Map<string, number>();
  for (const r of data ?? []) rateMap.set(r.item_type, r.surcharge);
  let total = 0;
  for (const item of items) {
    total += (rateMap.get(item.type) ?? 0) * (item.qty || 1);
  }
  return total;
}

// ═══════════════════════════════════════════════
// Deposit calculation (from deposit_rules table)
// ═══════════════════════════════════════════════

function amountBracket(amount: number): string {
  if (amount < 500) return "under_500";
  if (amount < 1000) return "500_999";
  if (amount < 3000) return "1000_2999";
  if (amount < 5000) return "3000_4999";
  return "5000_plus";
}

async function calculateDeposit(
  sb: SupabaseAdmin,
  serviceType: string,
  amount: number,
): Promise<number> {
  const bracket = amountBracket(amount);
  const { data } = await sb
    .from("deposit_rules")
    .select("deposit_type, deposit_value")
    .eq("service_type", serviceType)
    .eq("amount_bracket", bracket)
    .single();

  if (!data) {
    if (amount < 500) return amount;
    return 100;
  }

  switch (data.deposit_type) {
    case "full":
      return Math.round(amount);
    case "flat":
      return data.deposit_value;
    case "percent":
      return Math.round(amount * data.deposit_value / 100);
    default:
      return 100;
  }
}

// ═══════════════════════════════════════════════
// Add-on calculation (Step 6.5)
// ═══════════════════════════════════════════════

async function calculateAddons(
  sb: SupabaseAdmin,
  selections: AddonSelection[] | undefined,
  baseTotal: number,
): Promise<{
  total: number;
  breakdown: AddonBreakdownItem[];
  byTierExclusion: Map<string, number>;
}> {
  if (!selections || selections.length === 0) {
    return { total: 0, breakdown: [], byTierExclusion: new Map() };
  }

  const addonIds = selections.map((s) => s.addon_id);
  const { data: addons } = await sb.from("addons").select("*").in("id", addonIds);
  const addonMap = new Map<string, Record<string, unknown>>();
  for (const a of addons ?? []) addonMap.set(a.id, a);

  let total = 0;
  const breakdown: AddonBreakdownItem[] = [];
  const byTierExclusion = new Map<string, number>();

  for (const sel of selections) {
    const addon = addonMap.get(sel.addon_id);
    if (!addon) continue;

    let cost = 0;
    const qty = sel.quantity || 1;

    switch (addon.price_type as string) {
      case "flat":
        cost = (addon.price as number);
        break;
      case "per_unit":
        cost = (addon.price as number) * qty;
        break;
      case "tiered": {
        const tiers = addon.tiers as { label: string; price: number }[] | null;
        cost = tiers?.[sel.tier_index ?? 0]?.price ?? 0;
        break;
      }
      case "percent":
        cost = Math.round(baseTotal * ((addon.percent_value as number) ?? 0));
        break;
    }

    total += cost;
    breakdown.push({
      addon_id: addon.id as string,
      slug: addon.slug as string,
      name: addon.name as string,
      price: cost,
      quantity: qty,
      subtotal: cost,
    });

    const excluded = addon.excluded_tiers as string[] | null;
    if (excluded && excluded.length > 0) {
      for (const tier of excluded) {
        byTierExclusion.set(tier, (byTierExclusion.get(tier) ?? 0) + cost);
      }
    }
  }

  return { total, breakdown, byTierExclusion };
}

// ═══════════════════════════════════════════════
// Rounding helper
// ═══════════════════════════════════════════════

function roundTo(amount: number, nearest: number): number {
  return Math.round(amount / nearest) * nearest;
}

// ═══════════════════════════════════════════════
// Tier includes — loaded from DB with hardcoded fallback
// ═══════════════════════════════════════════════

const DEFAULT_TRUCK_BY_SIZE: Record<string, string> = {
  studio: "16-ft truck",
  "1br": "16-ft truck",
  "2br": "20-ft truck",
  "3br": "20-ft truck",
  "4br": "26-ft truck",
  "5br_plus": "26-ft truck",
  office: "26-ft truck",
};

/** Fetch active features for a service_type+tier combo from the DB, ordered by display_order. */
async function fetchTierFeatures(
  sb: SupabaseAdmin,
  serviceType: string,
  tier: string,
): Promise<string[]> {
  const { data } = await sb
    .from("tier_features")
    .select("feature")
    .eq("service_type", serviceType)
    .eq("tier", tier)
    .eq("active", true)
    .order("display_order");
  if (data && data.length > 0) return data.map((r: { feature: string }) => r.feature);
  return [];
}

async function residentialIncludes(
  sb: SupabaseAdmin,
  minCrew: number,
  estHours: number,
  moveSize?: string,
): Promise<{ essential: string[]; signature: string[]; estate: string[] }> {
  const truckLabel = DEFAULT_TRUCK_BY_SIZE[moveSize ?? "2br"] ?? "Dedicated moving truck";

  const [dbEss, dbSig, dbEst] = await Promise.all([
    fetchTierFeatures(sb, "local_move", "essential"),
    fetchTierFeatures(sb, "local_move", "signature"),
    fetchTierFeatures(sb, "local_move", "estate"),
  ]);

  const crewLine = `Professional crew of ${minCrew}`;
  const hydrate = (list: string[]) =>
    list.map((f) => {
      if (f === "Dedicated moving truck") return truckLabel;
      if (f === "Professional movers" || f.toLowerCase().includes("professional crew of")) return crewLine;
      return f;
    });

  if (dbEss.length > 0) {
    const essential = hydrate(dbEss);
    const sigRaw = hydrate(dbSig.length > 0 ? dbSig : dbEss);
    const estRaw = hydrate(dbEst.length > 0 ? dbEst : dbSig.length > 0 ? dbSig : dbEss);
    const signature = mergeResidentialIncludeLinesDeduped(essential, sigRaw);
    const estate = mergeResidentialIncludeLinesDeduped(signature, estRaw);
    return { essential, signature, estate };
  }

  // Hardcoded fallback — merged lists match tier cards + “Your Move Includes” (deduped across tiers)
  const essential = [
    truckLabel,
    crewLine,
    "Protective wrapping for key furniture",
    "Basic disassembly & reassembly",
    "Floor & entryway protection",
    "All standard equipment included",
    "Standard valuation coverage",
    "Real-time GPS tracking",
  ];
  const signatureAdds = [
    "Full protective wrapping for all furniture",
    "Floor protection",
    "Mattress and TV protection included",
    "Room-of-choice placement throughout the home",
    "Wardrobe box for immediate use",
    "Debris and packaging removal at completion",
    "Enhanced valuation coverage",
  ];
  const estateAdds = [
    "Dedicated move coordinator from booking to final placement",
    "Pre-move walkthrough with room-by-room plan",
    "Full furniture wrapping and protection throughout",
    "Complex disassembly & reassembly",
    "Floor and property protection throughout",
    "All packing materials and supplies included",
    "White glove handling for furniture, art, and high-value items",
    "Precision placement in every room",
    "Full repair or replacement valuation coverage",
    "Pre-move inventory planning and oversight",
    "30-day post-move concierge support",
    "Exclusive partner offers & perks",
  ];
  const signature = mergeResidentialIncludeLinesDeduped(essential, signatureAdds);
  const estate = mergeResidentialIncludeLinesDeduped(signature, estateAdds);
  return { essential, signature, estate };
}

// ═══════════════════════════════════════════════
// Inventory volume modifier
// ═══════════════════════════════════════════════

/** Legacy slug → new slug map for quotes created before expand_inventory (85 items). */
const LEGACY_SLUG_MAP: Record<string, string> = {
  "bed-queen": "queen-bed-frame",
  "bed-king": "king-bed-frame",
  "bed-double": "double-bed-frame",
  "bed-single": "single-twin-bed-frame",
  sofa: "sofa-3-seater",
  loveseat: "sofa-2-seater-loveseat",
  sectional: "sectional-sofa",
  dresser: "dresser-large",
  wardrobe: "wardrobe-armoire",
  "dining-table": "dining-table-6-seater",
  "tv-stand": "tv-stand-entertainment-centre",
  bookshelf: "bookshelf-large",
  "desk-large": "office-desk-large",
  "desk-small": "office-desk-small",
  "accent-chair": "armchair-accent-chair",
  "side-table": "side-end-table",
  "lamp-floor": "floor-lamp",
  "lamp-table": "table-lamp",
  "tv-large": "tv-large-65",
  "tv-small": "tv-mounted-flat",
  ottoman: "ottoman-footstool",
  fridge: "refrigerator",
  "piano-grand": "piano-grand-baby-grand",
  "safe-light": "safe-vault",
  "safe-heavy": "safe-vault",
  mirror: "mirror-large-full-length",
  rug: "rug-large",
  "shoe-rack": "shoe-rack-storage",
  "small-table": "side-end-table",
  monitor: "computer-monitor",
};

async function getItemWeight(sb: SupabaseAdmin, slugOrName: string): Promise<number> {
  const trimmed = (slugOrName || "").trim();
  if (!trimmed) return 1.0;

  // Try exact slug first
  const { data } = await sb
    .from("item_weights")
    .select("weight_score")
    .eq("slug", trimmed)
    .single();
  if (data) return Number(data.weight_score);

  // Try legacy slug → new slug mapping (for old quotes)
  const mapped = LEGACY_SLUG_MAP[trimmed];
  if (mapped) {
    const { data: mappedData } = await sb
      .from("item_weights")
      .select("weight_score")
      .eq("slug", mapped)
      .single();
    if (mappedData) return Number(mappedData.weight_score);
  }

  // Fallback: fuzzy match by item_name (for custom items)
  const { data: byName } = await sb
    .from("item_weights")
    .select("weight_score")
    .ilike("item_name", `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`)
    .limit(1)
    .maybeSingle();
  if (byName) return Number(byName.weight_score);

  return 1.0;
}

async function calcInventoryModifier(
  sb: SupabaseAdmin,
  moveSize: string,
  inventoryItems: InventoryItem[],
  config: Map<string, string>,
  clientBoxCount?: number,
): Promise<{
  modifier: number;
  inventoryScore: number;
  benchmarkScore: number;
  totalItems: number;
  maxModifier?: number;
  boxCount?: number;
  itemScore: number;
}> {
  const noAdj = {
    modifier: 1.0,
    inventoryScore: 0,
    benchmarkScore: 0,
    totalItems: 0,
    maxModifier: undefined,
    itemScore: 0,
    boxCount: 0,
  };
  if (!inventoryItems || inventoryItems.length === 0) return noAdj;

  const { data: bm } = await sb
    .from("volume_benchmarks")
    .select("*")
    .eq("move_size", moveSize)
    .single();
  if (!bm) return noAdj;

  let itemScore = 0;
  let totalItems = 0;
  for (const item of inventoryItems) {
    const weight =
      typeof item.weight_score === "number"
        ? item.weight_score
        : await getItemWeight(sb, item.slug || item.name || "");
    const qty = item.quantity || 1;
    itemScore += residentialInventoryLineScore({
      weight_score: weight,
      quantity: qty,
      weight_tier_code: item.weight_tier_code,
    });
    totalItems += qty;
  }

  const boxCount =
    typeof clientBoxCount === "number" && !Number.isNaN(clientBoxCount) ? clientBoxCount : 0;
  const boxScore = boxCount * 0.3;
  const inventoryScore = itemScore + boxScore;
  const expectedScore = expectedInventoryScoreForMoveSize(moveSize, config);

  const modifier = calculateDampenedInventoryModifier(inventoryScore, moveSize, config);

  return {
    modifier,
    inventoryScore,
    benchmarkScore: expectedScore,
    totalItems,
    maxModifier: Number(bm.max_modifier),
    boxCount,
    itemScore,
  };
}

// ═══════════════════════════════════════════════
// Truck allocation
// ═══════════════════════════════════════════════

interface TruckAllocation {
  primary: { vehicle_type: string; display_name: string; cargo_cubic_ft: number } | null;
  secondary: { vehicle_type: string; display_name: string; cargo_cubic_ft: number } | null;
  isMultiVehicle: boolean;
  notes: string | null;
  range: string;
}

function inventoryRange(modifier: number): string {
  if (modifier === 1.0) return "no_inventory";
  if (modifier <= 0.90) return "light";
  if (modifier <= 1.10) return "standard";
  return "heavy";
}

async function allocateTruck(
  sb: SupabaseAdmin,
  moveSize: string,
  invModifier: number,
): Promise<TruckAllocation> {
  const range = inventoryRange(invModifier);

  const { data: rule } = await sb
    .from("truck_allocation_rules")
    .select("primary_vehicle, secondary_vehicle, notes")
    .eq("move_size", moveSize)
    .eq("inventory_range", range)
    .maybeSingle();

  if (!rule) {
    return { primary: null, secondary: null, isMultiVehicle: false, notes: null, range };
  }

  const { data: primary } = await sb
    .from("fleet_vehicles")
    .select("vehicle_type, display_name, cargo_cubic_ft")
    .eq("vehicle_type", rule.primary_vehicle)
    .single();

  let secondary = null;
  if (rule.secondary_vehicle) {
    const { data: sec } = await sb
      .from("fleet_vehicles")
      .select("vehicle_type, display_name, cargo_cubic_ft")
      .eq("vehicle_type", rule.secondary_vehicle)
      .single();
    secondary = sec;
  }

  return {
    primary: primary ?? null,
    secondary,
    isMultiVehicle: !!secondary,
    notes: rule.notes,
    range,
  };
}

// ═══════════════════════════════════════════════
// RESIDENTIAL — tiered pricing
// ═══════════════════════════════════════════════

type LabourEstimate = { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null;

async function calcResidential(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
  invResult: {
    modifier: number;
    inventoryScore: number;
    benchmarkScore: number;
    totalItems: number;
    itemScore?: number;
    boxCount?: number;
  },
  labour: LabourEstimate,
  deadheadInfo: { distance_km: number; drive_time_min: number } | null,
  returnInfo: { distance_km: number; drive_time_min: number } | null,
) {
  const pricingDebug =
    input.debug_pricing === true ||
    process.env.PRICING_DEBUG === "1" ||
    process.env.PRICING_DEBUG === "true";
  const pd = (...parts: unknown[]) => {
    if (pricingDebug) console.log("[PRICING DEBUG]", ...parts);
  };

  pd("=== RESIDENTIAL PRICING TRACE (calcResidential) ===");
  pd("Input move_size:", input.move_size, "| service_type:", input.service_type, "| move_date:", input.move_date);
  pd("Addresses:", { from: input.from_address, to: input.to_address });
  pd("Access:", { from_access: input.from_access, to_access: input.to_access });
  pd("Parking / long carry:", {
    from_parking: input.from_parking,
    to_parking: input.to_parking,
    from_long_carry: input.from_long_carry,
    to_long_carry: input.to_long_carry,
  });

  const { data: br } = await sb
    .from("base_rates")
    .select("base_price, min_crew, estimated_hours")
    .eq("move_size", input.move_size ?? "2br")
    .single();

  const baseRate = br?.base_price ?? 999;
  pd("Step 1 — base_rates (DB row for move_size):", {
    move_size: input.move_size ?? "2br",
    base_price: br?.base_price,
    fallback_used: br?.base_price == null,
    baseRate_effective: baseRate,
    min_crew: br?.min_crew ?? "(fallback 3)",
    estimated_hours: br?.estimated_hours ?? "(fallback 5)",
  });
  const minCrew = br?.min_crew ?? 3;
  const estHours = br?.estimated_hours ?? 5;

  // ── Section 4A/4B: Distance modifier (replaces flat per-km surcharge) ──────
  const distKm = distInfo?.distance_km ?? 0;
  let distanceModifier = 1.0;

  // Read thresholds from config (with hardcoded fallbacks)
  const distUltraShortKm  = cfgNum(config, "dist_ultra_short_km",  2);
  const distShortKm        = cfgNum(config, "dist_short_km",        5);
  const distBaselineKm     = cfgNum(config, "dist_baseline_km",     20);
  const distMediumKm       = cfgNum(config, "dist_medium_km",       40);
  const distLongKm         = cfgNum(config, "dist_long_km",         60);
  const distVeryLongKm     = cfgNum(config, "dist_very_long_km",    100);

  const distModUltraShort  = cfgNum(config, "dist_mod_ultra_short", 0.92);
  const distModShort       = cfgNum(config, "dist_mod_short",       0.95);
  const distModMedium      = cfgNum(config, "dist_mod_medium",      1.08);
  const distModLong        = cfgNum(config, "dist_mod_long",        1.15);
  const distModVeryLong    = cfgNum(config, "dist_mod_very_long",   1.25);
  const distModExtreme     = cfgNum(config, "dist_mod_extreme",     1.35);

  if (distKm <= distUltraShortKm) {
    distanceModifier = distModUltraShort;  // 8% discount for ultra-short (≤2 km)
  } else if (distKm <= distShortKm) {
    distanceModifier = distModShort;       // 5% discount for short (≤5 km)
  } else if (distKm <= distBaselineKm) {
    distanceModifier = 1.0;               // baseline (≤20 km)
  } else if (distKm <= distMediumKm) {
    distanceModifier = distModMedium;      // 8% surcharge (≤40 km)
  } else if (distKm <= distLongKm) {
    distanceModifier = distModLong;        // 15% surcharge (≤60 km)
  } else if (distKm <= distVeryLongKm) {
    distanceModifier = distModVeryLong;    // 25% surcharge (≤100 km)
  } else {
    distanceModifier = distModExtreme;     // 35% surcharge (>100 km)
  }

  pd("Step 2 — distance_km:", distKm, "| buckets (km):", {
    ultraShort: `≤${distUltraShortKm}`,
    short: `≤${distShortKm}`,
    baseline: `≤${distBaselineKm}`,
    medium: `≤${distMediumKm}`,
    long: `≤${distLongKm}`,
    veryLong: `≤${distVeryLongKm}`,
  });
  pd("Step 2 — distance modifier coeffs:", {
    distModUltraShort,
    distModShort,
    distModMedium,
    distModLong,
    distModVeryLong,
    distModExtreme,
  });
  pd("Step 2 — distance_modifier (applied):", distanceModifier);

  // ── Access + specialty surcharges (flat — not multiplied by tier) ──────────
  const [fromAccess, toAccess] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const accessSurcharge = fromAccess + toAccess;

  const specialtySurcharge = await getSpecialtySurcharge(sb, input.specialty_items ?? []);

  // ── PRICING ENGINE v2 ──────────────────────────────────────────────────────
  // Step 2: COST STACK — operational drivers only (inventory × distance)
  const costStack = invResult.modifier * distanceModifier;
  let operationalPrice = Math.round(baseRate * costStack);

  pd("Step 3 — inventory:", {
    inventory_modifier: invResult.modifier,
    inventory_score: invResult.inventoryScore,
    inventory_benchmark_expected: invResult.benchmarkScore,
    inventory_items_count: invResult.totalItems,
  });
  pd("Step 3 — cost_stack (inv_modifier × distance_modifier):", costStack);
  pd("Step 3 — baseRate × cost_stack (rounded, before surcharges):", operationalPrice);

  // Step 3: FIXED SURCHARGES — additive, not multiplicative
  const plc = parkingLongCarryLineTotal(config, input, "both");
  const truckSizingScore =
    invResult.totalItems > 0
      ? (invResult.itemScore ?? 0) + (invResult.boxCount ?? 0) * 0.3
      : invResult.inventoryScore;
  const recTruck = input.truck_type
    ? normalizeTruckType(input.truck_type)
    : recommendedTruckFromInventoryScore(truckSizingScore);
  const truckSur = residentialTruckUpgradeSurcharge(config, input.move_size, recTruck);

  const estateDayPlan = calculateEstateDays(input.move_size ?? "2br", invResult.inventoryScore);
  const loadedRateForEstateSchedule = crewLoadedHourlyRate(config);
  const ESTATE_SCHEDULE_TRUCK_LABELS: Record<string, string> = {
    sprinter: "Extended Sprinter van",
    "16ft": "16ft climate-protected truck",
    "20ft": "20ft dedicated moving truck",
    "24ft": "24ft full-size moving truck",
    "26ft": "26ft maximum-capacity truck",
    none: "dedicated moving truck",
  };
  const estateScheduleTruckLabel =
    ESTATE_SCHEDULE_TRUCK_LABELS[normalizeTruckType(recTruck)] ?? "dedicated moving truck";

  const deadheadFreeKm = cfgNum(config, "deadhead_free_zone_km", cfgNum(config, "deadhead_free_km", 15));
  const deadheadPerKm  = cfgNum(config, "deadhead_rate_per_km", cfgNum(config, "deadhead_per_km", 3.0));
  const deadheadKmRaw = deadheadInfo?.distance_km ?? 0;
  const maxDeadheadKm = cfgNum(config, "max_deadhead_km", 100);
  const deadheadKm = Math.min(deadheadKmRaw, maxDeadheadKm);
  const deadheadCapped = deadheadKmRaw > maxDeadheadKm;
  const deadheadSurcharge = deadheadKm > deadheadFreeKm
    ? Math.round((deadheadKm - deadheadFreeKm) * deadheadPerKm)
    : 0;

  const mobilizationFee = (() => {
    const d = deadheadKm;
    if (d > 50) return cfgNum(config, "mobilization_50plus", 100);
    if (d > 35) return cfgNum(config, "mobilization_35_50", 75);
    if (d > 25) return cfgNum(config, "mobilization_25_35", 50);
    return 0;
  })();

  const surchargesTotal = accessSurcharge + specialtySurcharge + plc.total + truckSur + deadheadSurcharge + mobilizationFee;
  operationalPrice += surchargesTotal;

  pd("Step 4 — fixed surcharges (additive):", {
    access_from: fromAccess,
    access_to: toAccess,
    access_total: accessSurcharge,
    specialtySurcharge,
    parking_long_carry_total: plc.total,
    truck_recommended: recTruck,
    truck_surcharge: truckSur,
    deadhead_km: deadheadKm,
    deadhead_km_actual: deadheadKmRaw,
    deadhead_capped: deadheadCapped,
    deadhead_cap_km: maxDeadheadKm,
    deadhead_free_km: deadheadFreeKm,
    deadhead_per_km: deadheadPerKm,
    deadhead_surcharge: deadheadSurcharge,
    mobilization_fee: mobilizationFee,
    surcharges_total: surchargesTotal,
  });
  pd("Step 4 — operational_price after surcharges (before market stack):", operationalPrice);

  // Step 4: MARKET STACK — price perception drivers, capped to prevent excessive compounding
  const marketStackRaw = dateMult.multiplier * neighbourhood.multiplier;
  const marketStackCap = cfgNum(config, "market_stack_cap", 1.38);
  const marketStack = Math.min(marketStackRaw, marketStackCap);
  const marketStackCapped = marketStackRaw > marketStackCap;
  const marketAdjustedPrice = Math.round(operationalPrice * marketStack);

  // Keep a "subtotal" alias for the coordinator breakdown view (price before labour)
  const subtotal = marketAdjustedPrice;

  pd("Step 5 — market stack:", {
    date_multiplier: dateMult.multiplier,
    neighbourhood_multiplier: neighbourhood.multiplier,
    neighbourhood_tier: neighbourhood.tier,
    market_stack_raw: marketStackRaw,
    market_stack_cap: marketStackCap,
    market_stack_applied: marketStack,
    was_capped: marketStackCapped,
    market_adjusted_price: marketAdjustedPrice,
    subtotal_before_labour: subtotal,
  });

  // ── Tiered labour delta (v2): extra hours above baseline, per-tier rates ─
  const labourRates = {
    essential: cfgNum(config, "labour_rate_essential", cfgNum(config, "labour_rate_curated", cfgNum(config, "labour_rate_per_mover_hour", 55))),
    signature: cfgNum(config, "labour_rate_signature", cfgNum(config, "labour_rate_per_mover_hour", 65)),
    estate:    cfgNum(config, "labour_rate_estate",    cfgNum(config, "labour_rate_per_mover_hour", 75)),
  };
  // Legacy single rate for breakdown display
  const labourRate = labourRates.essential;

  let labourDelta = 0;
  const tieredLabourDelta = { essential: 0, signature: 0, estate: 0 };
  let benchmark: { baseline_crew: number; baseline_hours: number } | null = null;

  if (labour && labour.crewSize > 0 && labour.estimatedHours > 0) {
    const { data: bm } = await sb
      .from("volume_benchmarks")
      .select("baseline_crew, baseline_hours")
      .eq("move_size", input.move_size ?? "2br")
      .single();
    if (bm && typeof bm.baseline_crew === "number" && typeof bm.baseline_hours === "number") {
      benchmark = { baseline_crew: bm.baseline_crew, baseline_hours: bm.baseline_hours };
      const baselineManHours = bm.baseline_crew * bm.baseline_hours;

      // Min hours floor: ensures estimate never underestimates operational reality
      const minHoursFloors = parseJsonConfig<Record<string, number>>(
        config,
        "minimum_hours_by_size",
        { studio: 2, "1br": 3, "2br": 4, "3br": 5.5, "4br": 7, "5br_plus": 8.5, partial: 2 },
      );
      const minHoursFloor = minHoursFloors[input.move_size ?? "2br"] ?? 3;
      // White glove adds +1 minimum hour
      const effectiveMinHours = input.service_type === "white_glove" ? minHoursFloor + 1 : minHoursFloor;
      const effectiveHours = Math.max(labour.estimatedHours, effectiveMinHours);
      const actualManHours = labour.crewSize * effectiveHours;
      const extraManHours = Math.max(0, actualManHours - baselineManHours);

      tieredLabourDelta.essential = Math.round(extraManHours * labourRates.essential);
      tieredLabourDelta.signature = Math.round(extraManHours * labourRates.signature);
      tieredLabourDelta.estate    = Math.round(extraManHours * labourRates.estate);

      // Legacy single delta (essential rate) for backward-compatible breakdown display
      labourDelta = tieredLabourDelta.essential;

      pd("Step 6 — labour vs benchmark:", {
        labour_crew: labour.crewSize,
        labour_estimated_hours: labour.estimatedHours,
        benchmark_crew: bm.baseline_crew,
        benchmark_hours: bm.baseline_hours,
        baseline_man_hours: baselineManHours,
        min_hours_floor: minHoursFloor,
        effective_min_hours: effectiveMinHours,
        effective_hours_used: effectiveHours,
        actual_man_hours: actualManHours,
        extra_man_hours: extraManHours,
        labour_rates_per_mover_hour: labourRates,
        tiered_labour_delta: tieredLabourDelta,
      });
    } else {
      pd("Step 6 — labour: no benchmark row or missing labour estimate; labour deltas stay 0");
    }
  } else {
    pd("Step 6 — labour: skipped (no labour estimate)");
  }

  let estateMultiDayLabourUplift = 0;
  if (labour && labour.crewSize > 0 && labour.estimatedHours > 0) {
    const minHoursFloorsEstate = parseJsonConfig<Record<string, number>>(
      config,
      "minimum_hours_by_size",
      { studio: 2, "1br": 3, "2br": 4, "3br": 5.5, "4br": 7, "5br_plus": 8.5, partial: 2 },
    );
    const minFloorE = minHoursFloorsEstate[input.move_size ?? "2br"] ?? 3;
    const effMinE = input.service_type === "white_glove" ? minFloorE + 1 : minFloorE;
    const effHrsE = Math.max(labour.estimatedHours, effMinE);
    const singleDayLoadedCost = Math.round(effHrsE * labour.crewSize * loadedRateForEstateSchedule);
    const estateLoadedTotalForUplift = estateLoadedLabourCost(estateDayPlan, loadedRateForEstateSchedule);
    estateMultiDayLabourUplift = Math.max(0, estateLoadedTotalForUplift - singleDayLoadedCost);
  }

  const rounding = cfgNum(config, "rounding_nearest", 50);
  const minJob = cfgNum(config, "minimum_job_amount", 549);
  // Support both old and new config key names during transition
  const curatedMult = cfgNum(config, "tier_essential_multiplier",
    cfgNum(config, "tier_curated_multiplier",
    cfgNum(config, "tier_essentials_multiplier", 1.0)));
  const signatureMult = cfgNum(config, "tier_signature_multiplier",
    cfgNum(config, "tier_premier_multiplier", 1.50));
  const estateMult = cfgNum(config, "tier_estate_multiplier", 3.15);
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);

  // Step 5: TIER MULTIPLIERS applied to market-adjusted price
  // Step 6: TIERED LABOUR DELTA added after (so premium tiers pay more for overages)
  let curBase = roundTo(subtotal * curatedMult, rounding) + tieredLabourDelta.essential;
  let sigBase = roundTo(subtotal * signatureMult, rounding) + tieredLabourDelta.signature;
  let estBase =
    roundTo(subtotal * estateMult, rounding) + tieredLabourDelta.estate + estateMultiDayLabourUplift;

  pd("Step 7 — tier multipliers & rounding (config):", {
    tier_essential_multiplier: curatedMult,
    tier_signature_multiplier: signatureMult,
    tier_estate_multiplier: estateMult,
    rounding_nearest: rounding,
    minimum_job_amount: minJob,
    tax_rate: taxRate,
  });
  pd("Step 7a — tier bases = roundTo(subtotal × tier_mult, rounding) + tier_labour_delta:", {
    subtotal,
    essential: curBase,
    signature: sigBase,
    estate: estBase,
  });

  // Estate-only: packing supplies allowance — lookup by move size from config JSON.
  const suppliesBySize = parseJsonConfig<Record<string, number>>(config, "estate_supplies_by_size", {});
  const SUPPLIES_FALLBACK: Record<string, number> = {
    studio: 120,
    partial: 120,
    "1br": 160,
    "2br": 240,
    "3br": 420,
    "4br": 660,
    "5br_plus": 850,
  };
  const estateSuppliesAllowance =
    suppliesBySize[input.move_size ?? "2br"]
    ?? SUPPLIES_FALLBACK[input.move_size ?? "2br"]
    ?? 240;
  estBase += estateSuppliesAllowance;

  // Custom crating — applies to ALL tiers (coordinator-selected per quote).
  const cratingBySize = parseJsonConfig<Record<string, number>>(config, "crating_prices", {});
  const CRATING_FALLBACK: Record<string, number> = { small: 175, medium: 250, large: 350, oversized: 500 };
  let cratingTotal = 0;
  if (input.crating_pieces && input.crating_pieces.length > 0) {
    for (const piece of input.crating_pieces) {
      cratingTotal += cratingBySize[piece.size] ?? CRATING_FALLBACK[piece.size] ?? 250;
    }
  }
  curBase += cratingTotal;
  sigBase += cratingTotal;
  estBase += cratingTotal;

  pd("Step 7b — estate packing supplies allowance (estate tier only):", {
    estateSuppliesAllowance,
    cratingTotal,
    curBase,
    sigBase,
    estBase,
  });

  const curBaseBeforeMin = curBase;
  const sigBaseBeforeMin = sigBase;
  const estBaseBeforeMin = estBase;
  if (curBase < minJob) curBase = minJob;
  if (sigBase < curBase) sigBase = curBase;
  if (estBase < sigBase) estBase = sigBase;

  pd("Step 7c — after min_job + tier monotonicity:", {
    minJob,
    curBase_before: curBaseBeforeMin,
    curBase_after: curBase,
    sigBase_before: sigBaseBeforeMin,
    sigBase_after: sigBase,
    estBase_before: estBaseBeforeMin,
    estBase_after: estBase,
  });

  const addonForCur = addonResult.total - (addonResult.byTierExclusion.get("essential") ?? (addonResult.byTierExclusion.get("curated") ?? (addonResult.byTierExclusion.get("essentials") ?? 0)));
  const addonForSig = addonResult.total - (addonResult.byTierExclusion.get("signature") ?? (addonResult.byTierExclusion.get("premier") ?? 0));
  const addonForEst = addonResult.total - (addonResult.byTierExclusion.get("estate") ?? 0);

  let curPrice = curBase + addonForCur;
  let sigPrice = sigBase + addonForSig;
  let estPrice = estBase + addonForEst;
  if (sigPrice < curPrice) sigPrice = curPrice;
  if (estPrice < sigPrice) estPrice = sigPrice;

  pd("Step 8 — addons:", {
    addon_line_total: addonResult.total,
    addon_for_essential: addonForCur,
    addon_for_signature: addonForSig,
    addon_for_estate: addonForEst,
    prices_after_addons: { essential: curPrice, signature: sigPrice, estate: estPrice },
  });

  // Tier spread caps: avoid flat multipliers inflating Signature/Estate on small moves
  const minCuratedToSig = cfgNum(config, "min_essential_signature_gap", cfgNum(config, "min_curated_signature_gap", 350));
  const minSigToEstate = cfgNum(config, "min_signature_estate_gap", 800);
  const maxCuratedToSig = cfgNum(config, "max_essential_signature_gap", cfgNum(config, "max_curated_signature_gap", 1200));
  const maxSigToEstate = cfgNum(config, "max_signature_estate_gap", 3000);
  const sigGap = Math.min(Math.max(sigPrice - curPrice, minCuratedToSig), maxCuratedToSig);
  sigPrice = curPrice + sigGap;
  const estGap = Math.min(Math.max(estPrice - sigPrice, minSigToEstate), maxSigToEstate);
  estPrice = sigPrice + estGap;

  pd("Step 8b — tier spread caps (min/max gap between tiers):", {
    min_essential_signature_gap: minCuratedToSig,
    max_essential_signature_gap: maxCuratedToSig,
    min_signature_estate_gap: minSigToEstate,
    max_signature_estate_gap: maxSigToEstate,
    sig_gap_applied: sigGap,
    estate_gap_applied: estGap,
    prices_after_spread_caps: { essential: curPrice, signature: sigPrice, estate: estPrice },
  });

  const preProcessing = { essential: curPrice, signature: sigPrice, estate: estPrice };

  // Processing cost recovery — absorbs credit card fees into the displayed price.
  // Applied after gap caps so tier spread is preserved, before tax and rounding
  // so the recovery is invisible to clients (absorbed into the $50 round).
  const procRate = cfgNum(config, "processing_recovery_rate", 0.029);
  const procFlat = cfgNum(config, "processing_recovery_flat", 0.30);
  curPrice  = Math.ceil((curPrice  + procFlat) / (1 - procRate));
  sigPrice  = Math.ceil((sigPrice  + procFlat) / (1 - procRate));
  estPrice  = Math.ceil((estPrice  + procFlat) / (1 - procRate));

  pd("Step 9 — processing recovery: ceil((price + procFlat) / (1 - procRate)):", {
    procRate,
    procFlat,
    pre_processing: preProcessing,
    after_processing_before_nearest_rounding: { essential: curPrice, signature: sigPrice, estate: estPrice },
  });

  // Re-apply rounding after recovery so prices land on the nearest $50
  curPrice  = Math.round(curPrice  / rounding) * rounding;
  sigPrice  = Math.round(sigPrice  / rounding) * rounding;
  estPrice  = Math.round(estPrice  / rounding) * rounding;

  pd("Step 10 — final pre-tax tier prices (nearest rounding interval):", {
    rounding_nearest: rounding,
    essential: curPrice,
    signature: sigPrice,
    estate: estPrice,
  });
  pd("=== END RESIDENTIAL PRICING TRACE ===");

  const curTax = Math.round(curPrice * taxRate);
  const sigTax = Math.round(sigPrice * taxRate);
  const estTax = Math.round(estPrice * taxRate);

  // Tiered deposits from platform_config (Residential tier-based rules)
  const curPct = cfgNum(config, "deposit_essential_pct", cfgNum(config, "deposit_curated_pct", 10));
  const curMin = cfgNum(config, "deposit_essential_min", cfgNum(config, "deposit_curated_min", 150));
  const sigPct = cfgNum(config, "deposit_signature_pct", 15);
  const sigMin = cfgNum(config, "deposit_signature_min", 250);
  const estPct = cfgNum(config, "deposit_estate_pct", 25);
  const estMin = cfgNum(config, "deposit_estate_min", 500);
  const curDep = Math.max(curMin, Math.round(curPrice * curPct / 100));
  const sigDep = Math.max(sigMin, Math.round(sigPrice * sigPct / 100));
  const estDep = Math.max(estMin, Math.round(estPrice * estPct / 100));

  const inc = await residentialIncludes(sb, minCrew, estHours, input.move_size);

  const tiers = {
    essential: {
      price: curPrice,
      deposit: curDep,
      tax: curTax,
      total: curPrice + curTax,
      includes: inc.essential,
    } as TierResult,
    signature: {
      price: sigPrice,
      deposit: sigDep,
      tax: sigTax,
      total: sigPrice + sigTax,
      includes: inc.signature,
    } as TierResult,
    estate: {
      price: estPrice,
      deposit: estDep,
      tax: estTax,
      total: estPrice + estTax,
      includes: inc.estate,
    } as TierResult,
  };

  // Estimated cost and margin (for admin preview, stored on move creation)
  const actualEstHours = labour
    ? Math.max(
        labour.estimatedHours,
        (() => {
          const minHoursFloors = parseJsonConfig<Record<string, number>>(
            config,
            "minimum_hours_by_size",
            { studio: 2, "1br": 3, "2br": 4, "3br": 5.5, "4br": 7, "5br_plus": 8.5, partial: 2 },
          );
          const floor = minHoursFloors[input.move_size ?? "2br"] ?? 3;
          return input.service_type === "white_glove" ? floor + 1 : floor;
        })(),
      )
    : (estHours ?? 4);
  const loadedRate = crewLoadedHourlyRate(config);
  const estLabourCost = Math.round(actualEstHours * (labour?.crewSize ?? minCrew) * loadedRate);
  const estateLoadedMultiDayCost = estateLoadedLabourCost(estateDayPlan, loadedRate);
  const estTruckCost = estimateTruckCostPerMove(recTruck, config);
  const estFuelCost = estimateFuelCostWithDeadhead(distKm, recTruck, config);
  const estSuppliesCost = estimateOperationalSuppliesCost(input.inventory_items ?? []);
  const estTotalCost = estLabourCost + estTruckCost + estFuelCost + estSuppliesCost;
  const estTotalCostEstateOps = estTotalCost - estLabourCost + estateLoadedMultiDayCost;
  const estMarginPct  = curPrice > 0 ? Math.round(((curPrice - estTotalCost) / curPrice) * 100) : 0;
  const estSigMarginPct  = sigPrice > 0 ? Math.round(((sigPrice - estTotalCost) / sigPrice) * 100) : 0;
  const estEstMarginPct  = estPrice > 0 ? Math.round(((estPrice - estTotalCostEstateOps) / estPrice) * 100) : 0;

  return {
    tiers,
    minCrew,
    estHours,
    factors: {
      base_rate: baseRate,
      inventory_modifier: invResult.modifier,
      distance_modifier: distanceModifier,
      // v2: cost stack and market stack separated
      cost_stack: costStack,
      market_stack: marketStack,
      market_stack_raw: marketStackRaw,
      market_stack_capped: marketStackCapped,
      operational_price: operationalPrice - surchargesTotal,
      surcharges_total: surchargesTotal,
      market_adjusted_price: marketAdjustedPrice,
      date_multiplier: dateMult.multiplier,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
      access_surcharge: accessSurcharge,
      specialty_surcharge: specialtySurcharge,
      labour_delta: labourDelta,
      labour_component: labourDelta,
      labour_delta_essential: tieredLabourDelta.essential,
      labour_delta_signature: tieredLabourDelta.signature,
      labour_delta_estate: tieredLabourDelta.estate,
      deadhead_surcharge: deadheadSurcharge,
      deadhead_km: deadheadKm,
      deadhead_km_actual: deadheadKmRaw,
      deadhead_capped: deadheadCapped,
      deadhead_cap_km: maxDeadheadKm,
      mobilization_fee: mobilizationFee,
      return_km: returnInfo?.distance_km ?? 0,
      inventory_score: invResult.inventoryScore,
      inventory_benchmark: invResult.benchmarkScore,
      inventory_items_count: invResult.totalItems,
      labour_actual_crew: labour?.crewSize ?? null,
      labour_actual_hours: labour?.estimatedHours ?? null,
      labour_baseline_crew: benchmark?.baseline_crew ?? null,
      labour_baseline_hours: benchmark?.baseline_hours ?? null,
      labour_rate: labourRate,
      labour_rate_per_mover_hour: labourRate,
      labour_rate_essential: labourRates.essential,
      labour_rate_signature: labourRates.signature,
      labour_rate_estate: labourRates.estate,
      labour_extra_man_hours:
        labour && benchmark
          ? Math.max(0, labour.crewSize * labour.estimatedHours - benchmark.baseline_crew * benchmark.baseline_hours)
          : null,
      inventory_max_modifier: (invResult as { modifier: number; inventoryScore: number; benchmarkScore: number; totalItems: number; maxModifier?: number }).maxModifier ?? null,
      subtotal_before_labour: marketAdjustedPrice,
      parking_long_carry_total: plc.total,
      truck_recommended: recTruck,
      truck_surcharge: truckSur,
      packing_supplies_included: estateSuppliesAllowance,
      crating_total: cratingTotal,
      crating_pieces_count: input.crating_pieces?.length ?? 0,
      // Estimated cost / margin (admin only — not shown to clients)
      estimated_cost: {
        labour: estLabourCost,
        estate_loaded_labour_multi_day: estateLoadedMultiDayCost,
        truck: estTruckCost,
        fuel: estFuelCost,
        supplies: estSuppliesCost,
        total: estTotalCost,
        total_estate_ops: estTotalCostEstateOps,
      },
      estate_day_plan: {
        days: estateDayPlan.days,
        pack_crew: estateDayPlan.packDay?.crew ?? null,
        pack_hours: estateDayPlan.packDay?.hours ?? null,
        move_crew: estateDayPlan.moveDay.crew,
        move_hours: estateDayPlan.moveDay.hours,
        unpack_included: estateDayPlan.unpackIncluded,
      },
      estate_multi_day_labour_uplift: estateMultiDayLabourUplift,
      estate_loaded_labour_cost: estateLoadedMultiDayCost,
      estate_schedule_headline: estateScheduleHeadline(estateDayPlan),
      estate_schedule_lines: buildEstateScheduleLines(
        estateDayPlan,
        input.move_date ?? "",
        estateScheduleTruckLabel,
      ),
      estimated_margin_essential:   estMarginPct,
      estimated_margin_signature: estSigMarginPct,
      estimated_margin_estate:    estEstMarginPct,
    },
    cratingTotal,
    estateSuppliesAllowance,
  };
}

// ═══════════════════════════════════════════════
// OFFICE MOVE — single price
// ═══════════════════════════════════════════════

async function calcOffice(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  _neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const crewRate = cfgNum(config, "office_crew_hourly_rate", 150);
  const crew = Math.max(1, input.office_crew_size ?? 2);
  const hours = input.office_estimated_hours ?? 5;
  const baseLabour = crewRate * hours;

  const distKm = distInfo?.distance_km ?? 0;
  const distMod = getDistanceModifier(config, distKm);

  const [fromAccess, toAccess] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const accessTotal = fromAccess + toAccess;

  const plcOffice = parkingLongCarryLineTotal(config, input, "both");
  const truckOffice = normalizeTruckType(input.truck_type ?? "16ft");
  const truckSur = truckSurchargeAmount(config, truckOffice);

  const subtotal = Math.round(baseLabour * distMod * dateMult.multiplier)
    + accessTotal
    + plcOffice.from_parking_fee
    + plcOffice.to_parking_fee
    + plcOffice.from_long_carry_fee
    + plcOffice.to_long_carry_fee
    + truckSur;

  const { data: rates } = await sb.from("office_rates").select("parameter, value");
  const r = new Map<string, number>();
  for (const row of rates ?? []) r.set(row.parameter, row.value);
  const itSurcharge = r.get("it_equipment_surcharge") ?? 200;
  const confRoom = r.get("conference_room") ?? 150;
  const reception = r.get("reception_area") ?? 100;
  const minOffice = r.get("minimum_job_amount") ?? 400;

  let price = subtotal;
  if (input.has_it_equipment) price += itSurcharge;
  if (input.has_conference_room) price += confRoom;
  if (input.has_reception_area) price += reception;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);
  if (price < minOffice) price = minOffice;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "office", price);

  const officeFeatures = await fetchTierFeatures(sb, "office_move", "custom");
  const includes = officeFeatures.length > 0 ? [...officeFeatures] : [
    "Professional moving crew",
    "Moving truck(s) as needed",
    "Basic disassembly & reassembly",
    "Floor & door frame protection",
    "Labeled crate system",
  ];
  if (input.has_it_equipment && !includes.includes("IT equipment handling"))
    includes.push("IT equipment handling");
  if (input.has_conference_room && !includes.includes("Conference room teardown & setup"))
    includes.push("Conference room teardown & setup");

  return {
    custom_price: { price, deposit, tax, total: price + tax, includes } as TierResult,
    factors: {
      office_base_labour: baseLabour,
      office_hours: hours,
      office_crew_size: crew,
      office_crew_hourly_rate: crewRate,
      distance_km: distKm,
      distance_modifier: distMod,
      date_multiplier: dateMult.multiplier,
      access_surcharge: accessTotal,
      parking_long_carry_total: plcOffice.total,
      truck_recommended: truckOffice,
      truck_surcharge: truckSur,
      it_equipment_surcharge: input.has_it_equipment ? itSurcharge : 0,
      conference_room_surcharge: input.has_conference_room ? confRoom : 0,
      reception_surcharge: input.has_reception_area ? reception : 0,
      square_footage: input.square_footage ?? null,
      workstation_count: input.workstation_count ?? null,
    },
  };
}

// ═══════════════════════════════════════════════
// LONG DISTANCE — single price
// ═══════════════════════════════════════════════

async function calcLongDistance(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const { data: br } = await sb
    .from("base_rates")
    .select("base_price")
    .eq("move_size", input.move_size ?? "2br")
    .single();

  const baseRate = (br?.base_price ?? 999) * 1.5;
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > 100 ? Math.round((distKm - 100) * 2.5) : 0;

  let price = baseRate + distanceSurcharge;
  price = Math.round(price * dateMult.multiplier);
  price = Math.round(price * neighbourhood.multiplier);

  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);
  if (price < 2500) price = 2500;

  const plcLd = parkingLongCarryLineTotal(config, input, "both");
  const truckLd = normalizeTruckType(input.truck_type ?? "20ft");
  price += plcLd.total + truckSurchargeAmount(config, truckLd);

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "long_distance", price);

  const ldIncludes = await fetchTierFeatures(sb, "long_distance", "custom");
  const longDistanceIncludes = ldIncludes.length > 0 ? ldIncludes : [
    "Climate-controlled truck",
    "Full packing included",
    "Professional crew",
    "Door-to-door service",
    "Basic disassembly & reassembly",
    "Moving blankets & shrink wrap",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: longDistanceIncludes,
    } as TierResult,
    factors: {
      base_rate: Math.round(baseRate),
      distance_surcharge: distanceSurcharge,
      date_multiplier: dateMult.multiplier,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
      parking_long_carry_total: plcLd.total,
      truck_recommended: truckLd,
      truck_surcharge: truckSurchargeAmount(config, truckLd),
    },
  };
}

// ═══════════════════════════════════════════════
// SINGLE ITEM — single price
// ═══════════════════════════════════════════════

async function calcSingleItem(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const baseFee = cfgNum(config, "single_item_base_fee", 255);
  const perItemFee = cfgNum(config, "single_item_additional_fee", 50);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceModifier = getDistanceModifier(config, distKm);

  const weightMapSi = {
    ...B2B_WEIGHT_SURCHARGES_FALLBACK,
    ...parseJsonConfig<Record<string, number>>(config, "b2b_weight_surcharges", {}),
  };
  const wCat = singleItemWeightCategory(input.item_weight_class);
  const weightSurchargeSi = weightMapSi[wCat] ?? weightMapSi.standard ?? 0;

  const [fromAccessSi, toAccessSi] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const accessTotal = fromAccessSi + toAccessSi;

  const asmRaw = (input.assembly_needed ?? "none").toLowerCase().trim();
  const assemblySurcharge =
    asmRaw.includes("both") ? 75 : asmRaw !== "none" && asmRaw.length > 0 ? 50 : 0;

  const additionalItems = Math.max(0, (input.number_of_items ?? 1) - 1);
  const bundleCore = baseFee + additionalItems * perItemFee;
  let price =
    Math.round(bundleCore * distanceModifier)
    + weightSurchargeSi
    + accessTotal
    + assemblySurcharge;

  const stairPerFlight = cfgNum(config, "stair_carry_per_flight", 50);
  if (input.stair_carry) price += stairPerFlight * (input.stair_flights ?? 1);

  const plcSi = parkingLongCarryLineTotal(config, input, "both");
  const truckSi = normalizeTruckType(input.truck_type ?? "20ft");
  price += plcSi.total + truckSurchargeAmount(config, truckSi);

  if (price < 150) price = 150;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "single_item", price);

  const siFeatures = await fetchTierFeatures(sb, "single_item", "custom");
  const singleItemIncludes = siFeatures.length > 0 ? siFeatures : [
    "Professional 2-person crew",
    "Blanket wrapping",
    "Secure transport",
    "Doorstep delivery",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: singleItemIncludes,
    } as TierResult,
    factors: {
      single_item_base_fee: baseFee,
      single_item_additional_fee: perItemFee,
      single_item_bundle_core: bundleCore,
      distance_modifier: distanceModifier,
      distance_km: distKm,
      item_description: input.item_description || null,
      item_category: input.item_category || null,
      weight_class: input.item_weight_class || null,
      weight_category_pricing: wCat,
      weight_surcharge: weightSurchargeSi,
      access_surcharge: accessTotal,
      single_item_special_handling: input.single_item_special_handling?.trim() || null,
      assembly_surcharge: assemblySurcharge,
      parking_long_carry_total: plcSi.total,
      truck_recommended: truckSi,
      truck_surcharge: truckSurchargeAmount(config, truckSi),
    },
  };
}

// ═══════════════════════════════════════════════
// WHITE GLOVE — based on single item × 1.5
// ═══════════════════════════════════════════════

async function calcWhiteGlove(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
  invResult: {
    modifier: number;
    inventoryScore: number;
    benchmarkScore: number;
    totalItems: number;
    itemScore?: number;
    boxCount?: number;
  },
  labour: { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null,
  deadheadInfo: { distance_km: number; drive_time_min: number } | null,
  returnInfo: { distance_km: number; drive_time_min: number } | null,
) {
  const res = await calcResidential(
    sb,
    input,
    config,
    distInfo,
    neighbourhood,
    dateMult,
    addonResult,
    invResult,
    labour,
    deadheadInfo,
    returnInfo,
  );
  const t = res.tiers.essential;
  let price = t.price;
  const wgDvThreshold = cfgNum(config, "white_glove_declared_value_threshold", 5000);
  const wgDvPremium = cfgNum(config, "white_glove_declared_value_premium", 50);
  if ((input.declared_value ?? 0) > wgDvThreshold) price += wgDvPremium;
  const wgMin = cfgNum(config, "white_glove_minimum_price", 250);
  if (price < wgMin) price = wgMin;

  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "white_glove", price);

  const wgFeatures = await fetchTierFeatures(sb, "white_glove", "custom");
  const whiteGloveIncludes = wgFeatures.length > 0 ? wgFeatures : [
    "Premium gloves handling",
    "Professional 2-person crew",
    "Full assembly included",
    "Photo documentation (before/during/after)",
    "Packaging removal",
    "Blanket & pad wrapping",
    "Secure climate transport",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: whiteGloveIncludes,
    } as TierResult,
    factors: {
      ...res.factors,
      white_glove_pricing: "curated_residential_base",
      white_glove_declared_value_premium:
        (input.declared_value ?? 0) > wgDvThreshold ? wgDvPremium : 0,
    },
    cratingTotal: res.cratingTotal,
    estateSuppliesAllowance: res.estateSuppliesAllowance,
    minCrew: res.minCrew,
    estHours: res.estHours,
  };
}

// ═══════════════════════════════════════════════
// SPECIALTY — project-type-based
// ═══════════════════════════════════════════════

async function calcSpecialty(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const baseMap = {
    ...SPECIALTY_PROJECT_BASE_DEFAULTS,
    ...parseJsonConfig<Record<string, number>>(config, "specialty_project_base_prices", {}),
  };
  const pt = input.project_type ?? "custom";
  const projectBase = baseMap[pt] ?? baseMap.custom ?? 500;
  const hours = input.timeline_hours ?? 4;
  let price = Math.round(projectBase * (hours / 4));

  // Distance surcharge (same formula as residential)
  const distBaseKm = cfgNum(config, "distance_base_km", 30);
  const distRateKm = cfgNum(config, "distance_rate_per_km", 4.5);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > distBaseKm ? Math.round((distKm - distBaseKm) * distRateKm) : 0;
  price += distanceSurcharge;

  const cratingPerPiece = cfgNum(config, "specialty_crating_per_piece", 300);
  if (input.custom_crating_pieces && input.custom_crating_pieces > 0) {
    price += cratingPerPiece * input.custom_crating_pieces;
  }
  const climateSur = cfgNum(config, "specialty_climate_surcharge", 150);
  if (input.climate_control) price += climateSur;

  const equipSurcharges: Record<string, number> = {
    ...SPECIALTY_EQUIPMENT_DEFAULTS,
    ...parseJsonConfig<Record<string, number>>(config, "specialty_equipment_surcharges", {}),
  };
  for (const eq of input.special_equipment ?? []) {
    price += equipSurcharges[eq] ?? 100;
  }

  const plcSp = parkingLongCarryLineTotal(config, input, "both");
  const truckSp = normalizeTruckType(input.truck_type ?? "20ft");
  price += plcSp.total + truckSurchargeAmount(config, truckSp);

  const spMin = cfgNum(config, "specialty_minimum_price", 500);
  if (price < spMin) price = spMin;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "specialty", price);

  const spFeatures = await fetchTierFeatures(sb, "specialty", "custom");
  const specialtyIncludes = spFeatures.length > 0 ? spFeatures : [
    "Specialized handling crew",
    "Project-specific equipment",
    "Site assessment",
    "Insurance coverage",
  ];
  if (input.specialty_access_difficulty === "requires_rigging_or_crane") {
    specialtyIncludes.push(
      "Crane/rigging adds $1,500–3,000. Coordinator will confirm exact cost.",
    );
  }

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: specialtyIncludes,
    } as TierResult,
    factors: {
      project_base: projectBase,
      timeline_hours: hours,
      distance_surcharge: distanceSurcharge,
      crating_surcharge: (input.custom_crating_pieces ?? 0) * cratingPerPiece,
      climate_surcharge: input.climate_control ? climateSur : 0,
      parking_long_carry_total: plcSp.total,
      truck_recommended: truckSp,
      truck_surcharge: truckSurchargeAmount(config, truckSp),
      specialty_building_requirements: input.specialty_building_requirements ?? [],
      specialty_access_difficulty: input.specialty_access_difficulty || null,
    },
  };
}

// ═══════════════════════════════════════════════
// B2B ONE-OFF — base + distance modifier + access + weight surcharges
// ═══════════════════════════════════════════════

/** GTA zone surcharges (straight-line km from core to delivery) + weekend flat fee. */
async function loadB2bPricingExtras(
  config: Map<string, string>,
  moveDate: string,
  toAddress: string,
): Promise<{
  lines: B2BPricingExtraLine[];
  deliveryKmFromGta: number | null;
  gtaZone: 1 | 2 | 3 | null;
  weekendAmount: number;
}> {
  const lines: B2BPricingExtraLine[] = [];
  const deliveryKmFromGta = await straightLineKmFromGtaCore(toAddress.trim());
  const z2 = cfgNum(config, "b2b_gta_zone2_surcharge", 75);
  const z3 = cfgNum(config, "b2b_gta_zone3_surcharge", 150);
  let gtaZone: 1 | 2 | 3 | null = null;
  if (deliveryKmFromGta != null) {
    if (deliveryKmFromGta >= 80) {
      gtaZone = 3;
      if (z3 > 0) lines.push({ label: "Outside GTA core (zone 3: 80+ km)", amount: z3 });
    } else if (deliveryKmFromGta >= 40) {
      gtaZone = 2;
      if (z2 > 0) lines.push({ label: "Outside GTA core (zone 2: 40–80 km)", amount: z2 });
    } else {
      gtaZone = 1;
    }
  }
  const wk = cfgNum(config, "b2b_weekend_surcharge", 40);
  let weekendAmount = 0;
  if (isMoveDateWeekend(moveDate) && wk > 0) {
    weekendAmount = wk;
    lines.push({ label: "Weekend delivery", amount: wk });
  }
  return { lines, deliveryKmFromGta, gtaZone, weekendAmount };
}

function getDistanceModifier(config: Map<string, string>, distKm: number): number {
  const distUltraShortKm = cfgNum(config, "dist_ultra_short_km", 2);
  const distShortKm = cfgNum(config, "dist_short_km", 5);
  const distBaselineKm = cfgNum(config, "dist_baseline_km", 20);
  const distMediumKm = cfgNum(config, "dist_medium_km", 40);
  const distLongKm = cfgNum(config, "dist_long_km", 60);
  const distVeryLongKm = cfgNum(config, "dist_very_long_km", 100);
  const distModUltraShort = cfgNum(config, "dist_mod_ultra_short", 0.92);
  const distModShort = cfgNum(config, "dist_mod_short", 0.95);
  const distModMedium = cfgNum(config, "dist_mod_medium", 1.08);
  const distModLong = cfgNum(config, "dist_mod_long", 1.15);
  const distModVeryLong = cfgNum(config, "dist_mod_very_long", 1.25);
  const distModExtreme = cfgNum(config, "dist_mod_extreme", 1.35);
  if (distKm <= distUltraShortKm) return distModUltraShort;
  if (distKm <= distShortKm) return distModShort;
  if (distKm <= distBaselineKm) return 1.0;
  if (distKm <= distMediumKm) return distModMedium;
  if (distKm <= distLongKm) return distModLong;
  if (distKm <= distVeryLongKm) return distModVeryLong;
  return distModExtreme;
}

async function calcB2bOneoff(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const distKm = distInfo?.distance_km ?? 0;
  const accessMap = parseJsonConfig<Record<string, number>>(config, "b2b_access_surcharges", {});
  const accessKey = (k: string | undefined): string => (k === "no_parking_nearby" ? "no_parking" : (k ?? ""));
  const fromAccess = input.from_access ? (accessMap[accessKey(input.from_access)] ?? 0) : 0;
  const toAccess = input.to_access ? (accessMap[accessKey(input.to_access)] ?? 0) : 0;
  const accessSurcharge = fromAccess + toAccess;

  const plcB2b = parkingLongCarryLineTotal(config, input, "both");
  const rounding = cfgNum(config, "rounding_nearest", 25);
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);

  const loaded = await loadB2BVerticalPricing(
    sb,
    input.b2b_vertical_code,
    input.b2b_partner_organization_id?.trim() || null,
  );

  const b2bLocationExtras = await loadB2bPricingExtras(config, input.move_date, input.to_address);

  if (loaded) {
    const items = lineItemsFromQuotePayload(input);
    const stops = stopsFromQuotePayload(input);
    const merged = mergedRatesWithBundleTiers(loaded.mergedRates as Record<string, unknown>);
    const useVerticalZoneSchedule = String(merged.distance_mode || "") === "zones";
    const itemsForEngine = prepareB2bLineItemsForDimensionalEngine(
      items,
      loaded.vertical.code,
      (input.b2b_handling_type || "threshold").toLowerCase(),
      loaded.mergedRates as Record<string, unknown>,
    );

    const crateFromLineItems = items.reduce(
      (s, i) => (i.crating_required ? s + Math.max(1, i.quantity) : s),
      0,
    );
    const cratingPieces = Math.max(crateFromLineItems, input.b2b_crating_pieces ?? 0);

    const dimInput: B2BDimensionalQuoteInput = {
      vertical_code: loaded.vertical.code,
      items: itemsForEngine,
      handling_type: (input.b2b_handling_type || "threshold").toLowerCase(),
      stops,
      crew_override: input.b2b_crew_override,
      truck_override: input.truck_type || undefined,
      estimated_hours_override: input.b2b_estimated_hours_override,
      time_sensitive: !!input.b2b_time_sensitive,
      assembly_required: !!input.b2b_assembly_required,
      debris_removal: !!input.b2b_debris_removal,
      stairs_flights: input.b2b_stairs_flights,
      addons: input.b2b_complexity_addons,
      weekend: isMoveDateWeekend(input.move_date),
      after_hours: !!input.b2b_after_hours,
      same_day: !!input.b2b_same_day,
      skid_count: input.b2b_skid_count,
      total_load_weight_lbs: input.b2b_total_load_weight_lbs,
      haul_away_units: input.b2b_haul_away_units,
      returns_pickup: !!input.b2b_returns_pickup,
      monthly_delivery_volume: input.b2b_monthly_delivery_volume_estimate,
      art_hanging_count: input.b2b_art_hanging_count,
      crating_pieces: cratingPieces > 0 ? cratingPieces : undefined,
    };

    const b2bExtrasForDim = useVerticalZoneSchedule ? [] : b2bLocationExtras.lines;

    const dim = calculateB2BDimensionalPrice({
      vertical: loaded.vertical,
      mergedRates: merged,
      input: dimInput,
      totalDistanceKm: distKm,
      roundingNearest: rounding,
      parkingLongCarryTotal: plcB2b.total,
      pricingExtras: b2bExtrasForDim,
    });

    const partnerOrgId = input.b2b_partner_organization_id?.trim() || null;
    let dimStandard: ReturnType<typeof calculateB2BDimensionalPrice> | null = null;
    if (partnerOrgId) {
      const listLoaded = await loadB2BVerticalPricing(sb, input.b2b_vertical_code, null);
      if (listLoaded) {
        const listMergedCalc = mergedRatesWithBundleTiers(listLoaded.mergedRates as Record<string, unknown>);
        const listUseZones = String(listMergedCalc.distance_mode || "") === "zones";
        dimStandard = calculateB2BDimensionalPrice({
          vertical: listLoaded.vertical,
          mergedRates: listMergedCalc,
          input: dimInput,
          totalDistanceKm: distKm,
          roundingNearest: rounding,
          parkingLongCarryTotal: plcB2b.total,
          pricingExtras: listUseZones ? [] : b2bLocationExtras.lines,
        });
      }
    }

    const engineSubtotal = dim.subtotal;
    const ovr = parsePositivePreTaxOverride(input.b2b_subtotal_override);
    const useSubtotalOverride = ovr !== undefined;
    const b2bSubtotalAfterOverride = useSubtotalOverride ? Math.round(ovr) : engineSubtotal;
    let price = b2bSubtotalAfterOverride + accessSurcharge + addonResult.total;
    const calculatedPreTaxBeforeFullOverride = price;
    const fullOv = parsePositivePreTaxOverride(input.b2b_full_pre_tax_override);
    const useFullPreTaxOverride = fullOv !== undefined;
    if (useFullPreTaxOverride) {
      price = roundTo(fullOv, rounding);
    }
    const tax = Math.round(price * taxRate);
    const deposit = price < 300 ? price : 100;

    const truckKey = normalizeTruckType(dim.truck);
    const verticalTruckRates =
      (loaded.mergedRates.truck_rates as Record<string, number> | undefined) || {};
    const truckSurchargeDim = Number(verticalTruckRates[dim.truck] ?? 0) || 0;

    const b2bFeatures = await fetchTierFeatures(sb, "b2b_delivery", "custom");
    const includes = [
      ...dim.includes,
      ...(b2bFeatures.length > 0 ? b2bFeatures : ["Loading and unloading", "Basic protection"]),
    ];

    const standardVerticalSubtotal = dimStandard?.subtotal ?? null;
    const standardPricePreTax =
      standardVerticalSubtotal != null ? standardVerticalSubtotal + accessSurcharge + addonResult.total : null;
    const partnerDiscountPct =
      standardPricePreTax != null && standardPricePreTax > 0
        ? Math.round((1 - price / standardPricePreTax) * 1000) / 10
        : null;

    return {
      custom_price: {
        price,
        deposit,
        tax,
        total: price + tax,
        includes,
      } as TierResult,
      factors: {
        b2b_dimensional: true,
        b2b_vertical_code: loaded.vertical.code,
        b2b_vertical_name: loaded.vertical.name,
        item_description: loaded.vertical.name,
        item_category: loaded.vertical.code,
        distance_km: distKm,
        drive_time_min: distInfo?.drive_time_min ?? null,
        access_surcharge: accessSurcharge,
        parking_long_carry_total: plcB2b.total,
        b2b_price_breakdown: dim.breakdown,
        b2b_standard_price_breakdown: dimStandard?.breakdown ?? null,
        b2b_list_vertical_subtotal: standardVerticalSubtotal,
        b2b_standard_price_pre_tax: standardPricePreTax,
        b2b_partner_discount_percent: partnerDiscountPct,
        b2b_using_partner_rates: Boolean(partnerOrgId),
        b2b_partner_organization_id: partnerOrgId,
        b2b_line_items: items,
        b2b_has_extreme_weight: hasExtremeWeightCategory(
          items.map((it) => ({ weight_category: it.weight_category })),
        ),
        b2b_stops: stops,
        b2b_handling_type: dimInput.handling_type,
        b2b_delivery_window: input.b2b_delivery_window?.trim() || null,
        b2b_assembly_required: !!input.b2b_assembly_required,
        b2b_debris_removal: !!input.b2b_debris_removal,
        b2b_time_sensitive: !!input.b2b_time_sensitive,
        b2b_complexity_addons: input.b2b_complexity_addons?.length ? input.b2b_complexity_addons : null,
        truck_recommended: truckKey,
        truck_surcharge: truckSurchargeDim,
        b2b_estimated_hours: dim.estimatedHours,
        b2b_crew: dim.crew,
        b2b_business_name: input.b2b_business_name || null,
        b2b_items: input.b2b_items || null,
        b2b_payment_method: input.b2b_payment_method ?? "card",
        b2b_invoice_terms:
          input.b2b_payment_method === "invoice"
            ? (input.b2b_invoice_terms?.trim() || "on_completion")
            : null,
        b2b_retailer_source: input.b2b_retailer_source?.trim() || null,
        weight_surcharge: 0,
        weight_category: input.b2b_weight_category || null,
        includes,
        b2b_delivery_km_from_gta_core: b2bLocationExtras.deliveryKmFromGta,
        b2b_gta_zone: b2bLocationExtras.gtaZone,
        b2b_weekend_surcharge: b2bLocationExtras.weekendAmount,
        b2b_engine_subtotal: engineSubtotal,
        b2b_subtotal_override: useSubtotalOverride ? b2bSubtotalAfterOverride : null,
        b2b_subtotal_override_reason:
          useSubtotalOverride || useFullPreTaxOverride
            ? (input.b2b_subtotal_override_reason?.trim() || null)
            : null,
        b2b_calculated_pre_tax: calculatedPreTaxBeforeFullOverride,
        b2b_full_pre_tax_override_applied: useFullPreTaxOverride,
        b2b_full_pre_tax_override: useFullPreTaxOverride ? fullOv : null,
        b2b_monthly_volume_estimate: input.b2b_monthly_delivery_volume_estimate ?? null,
      },
    };
  }

  // Fallback when delivery_verticals is unavailable (pre-migration)
  const baseFee = cfgNum(config, "b2b_oneoff_base", 350);
  const distanceModifier = getDistanceModifier(config, distKm);
  const weightMap = {
    ...B2B_WEIGHT_SURCHARGES_FALLBACK,
    ...parseJsonConfig<Record<string, number>>(config, "b2b_weight_surcharges", {}),
  };
  const weightCategory = input.b2b_weight_category || "standard";
  const weightSurcharge = weightMap[weightCategory] ?? 0;

  let price = Math.round(baseFee * distanceModifier) + accessSurcharge + weightSurcharge;
  price = roundTo(price, rounding);
  if (price < 200) price = 200;

  const truckB2b = normalizeTruckType(input.truck_type ?? "20ft");
  price += plcB2b.total + truckSurchargeAmount(config, truckB2b);

  price += b2bLocationExtras.lines.reduce((s, l) => s + l.amount, 0);
  price += addonResult.total;
  const tax = Math.round(price * taxRate);

  let deposit: number;
  if (price < 300) {
    deposit = price;
  } else {
    deposit = 100;
  }

  const b2bFeatures = await fetchTierFeatures(sb, "b2b_delivery", "custom");
  const b2bIncludes = b2bFeatures.length > 0 ? b2bFeatures : [
    "Professional crew",
    "Loading and unloading",
    "Basic protection",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: b2bIncludes,
    } as TierResult,
    factors: {
      base_fee: baseFee,
      distance_modifier: distanceModifier,
      distance_km: distKm,
      access_surcharge: accessSurcharge,
      weight_surcharge: weightSurcharge,
      weight_category: weightCategory,
      b2b_business_name: input.b2b_business_name || null,
      b2b_items: input.b2b_items || null,
      parking_long_carry_total: plcB2b.total,
      truck_recommended: truckB2b,
      truck_surcharge: truckSurchargeAmount(config, truckB2b),
      b2b_payment_method: input.b2b_payment_method ?? "card",
      b2b_invoice_terms:
        input.b2b_payment_method === "invoice"
          ? (input.b2b_invoice_terms?.trim() || "on_completion")
          : null,
      b2b_retailer_source: input.b2b_retailer_source?.trim() || null,
      b2b_delivery_window: input.b2b_delivery_window?.trim() || null,
      b2b_assembly_required: !!input.b2b_assembly_required,
      b2b_debris_removal: !!input.b2b_debris_removal,
      b2b_handling_type: input.b2b_handling_type || null,
      b2b_complexity_addons: input.b2b_complexity_addons?.length ? input.b2b_complexity_addons : null,
      includes: b2bIncludes,
      b2b_delivery_km_from_gta_core: b2bLocationExtras.deliveryKmFromGta,
      b2b_gta_zone: b2bLocationExtras.gtaZone,
      b2b_weekend_surcharge: b2bLocationExtras.weekendAmount,
      b2b_location_extra_lines: b2bLocationExtras.lines,
    },
  };
}

// ═══════════════════════════════════════════════
// EVENT — round-trip delivery + optional setup
// ═══════════════════════════════════════════════

const EVENT_WEIGHT_MAP: Record<string, number> = {
  light: 0.5,
  standard: 1.0,
  medium: 1.0,
  heavy: 2.0,
  very_heavy: 4.0,
  super_heavy: 7.0,
  extreme: 12.0,
  extra_heavy: 4.0,
};

function buildEventIncludesList(input: QuoteInput): string[] {
  const lines: string[] = [
    "Dedicated event crew (same team all days)",
    "All items inventoried and protected",
    "Floor and venue protection",
  ];
  if (input.event_is_luxury) {
    lines.push("Basic setup and placement (included with luxury rate)");
    if (input.event_complex_setup_required) {
      lines.push("Complex on-site setup (staging, signage, assembly), as quoted");
    }
  } else if (input.event_setup_required) {
    lines.push("On-site setup and arrangement");
  }
  lines.push("Post-event teardown and return", "Real-time coordination");
  return lines;
}

function eventSetupFeeAndLabel(input: QuoteInput, config: Map<string, string>): { setupFee: number; setupLabel: string } {
  let setupFee = 0;
  let setupLabel = "";
  const luxury = !!input.event_is_luxury;
  const needsPaidSetup = luxury ? !!input.event_complex_setup_required : !!input.event_setup_required;
  if (!needsPaidSetup) {
    return { setupFee, setupLabel };
  }
  const sh = input.event_setup_hours ?? 2;
  const setupPrices: Record<number, number> = {
    1:   cfgNum(config, "event_setup_fee_1hr",     150),
    2:   cfgNum(config, "event_setup_fee_2hr",     275),
    3:   cfgNum(config, "event_setup_fee_3hr",     400),
    99:  cfgNum(config, "event_setup_fee_halfday", 600),
    100: cfgNum(config, "event_setup_fee_fullday", 1000),
  };
  setupFee = setupPrices[sh] ?? setupPrices[2];
  setupLabel = luxury
    ? (sh === 99 ? "Half-day complex setup" : sh === 100 ? "Full-day complex setup" : `${sh}hr complex setup`)
    : (sh === 99 ? "Half-day setup" : sh === 100 ? "Full-day setup" : `${sh}hr setup`);
  return { setupFee, setupLabel };
}

/** Per event leg: crew-hour pricing (not per-mover), truck + parking + access + long carry */
async function computeEventLegPrice(
  sb: SupabaseAdmin,
  input: {
    eventItems: QuoteInput["event_items"];
    fromAccess?: string;
    toAccess?: string;
    distInfo: { distance_km: number; drive_time_min: number } | null;
    config: Map<string, string>;
    isLuxury: boolean;
    truckType: TruckKey;
    fromParking: string;
    toParking: string;
    fromLongCarry: boolean;
    toLongCarry: boolean;
    returnDiscount: number;
    skipTruckSurcharge?: boolean;
  },
) {
  let eventScore = 0;
  for (const item of input.eventItems ?? []) {
    const cat = normalizeB2bWeightCategory(item.weight_category);
    const w = EVENT_WEIGHT_MAP[cat] ?? EVENT_WEIGHT_MAP.standard;
    eventScore += w * (item.quantity || 1);
  }

  const distKm = input.distInfo?.distance_km ?? 0;
  const labour = eventScore > 0
    ? estimateLabourFromScore(eventScore, distKm, input.fromAccess, input.toAccess, "2br", {
        driveTimeMinutes: input.distInfo?.drive_time_min,
      })
    : { crewSize: 2, estimatedHours: 3, hoursRange: "2.5–4 hours", truckSize: "sprinter" };

  const baseHourly = input.isLuxury
    ? cfgNum(input.config, "event_luxury_hourly_rate", 175)
    : cfgNum(input.config, "event_base_hourly_rate", 150);
  const minHours = input.isLuxury
    ? cfgNum(input.config, "event_min_hours_luxury", 4)
    : cfgNum(input.config, "event_min_hours_standard", 3);
  const hours = Math.max(labour.estimatedHours || minHours, minHours);

  const parkingRates = parseJsonConfig<Record<string, number>>(input.config, "parking_surcharges", {
    dedicated: 0,
    street: 0,
    no_dedicated: 75,
  });
  const parkingSur =
    (parkingRates[input.fromParking] ?? 0) + (parkingRates[input.toParking] ?? 0);
  const lcFee = cfgNum(input.config, "long_carry_surcharge", 75);
  const longSur = (input.fromLongCarry ? lcFee : 0) + (input.toLongCarry ? lcFee : 0);

  const truckSur = input.skipTruckSurcharge ? 0 : truckSurchargeAmount(input.config, input.truckType);
  const [oa, va] = await Promise.all([
    getAccessSurcharge(sb, input.fromAccess),
    getAccessSurcharge(sb, input.toAccess),
  ]);

  const rounding = cfgNum(input.config, "rounding_nearest", 50);
  let deliveryCharge = Math.round(baseHourly * hours) + truckSur + parkingSur + oa + va + longSur;
  deliveryCharge = roundTo(deliveryCharge, rounding);
  if (deliveryCharge < 350) deliveryCharge = 350;

  const returnDiscount = Math.min(1, Math.max(0.25, input.returnDiscount));
  const returnCharge = roundTo(Math.round(deliveryCharge * returnDiscount), rounding);
  const returnHours = Math.ceil(hours * returnDiscount);

  return {
    deliveryCharge,
    returnCharge,
    returnHours,
    returnDiscount,
    labour,
    truckSurcharge: truckSur,
    parkingSurcharge: parkingSur,
    longCarrySurcharge: longSur,
    billableHours: hours,
    crewHourlyRate: baseHourly,
  };
}

async function calcEvent(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const isLuxury = !!input.event_is_luxury;
  const onSite = !!input.event_same_location_onsite;
  const distEff = onSite ? { distance_km: 0, drive_time_min: 0 } : distInfo;
  const truckType = onSite
    ? ("none" as TruckKey)
    : normalizeTruckType(input.event_truck_type ?? input.truck_type ?? "sprinter");
  const fromParking = input.from_parking ?? "dedicated";
  const toParking = input.to_parking ?? "dedicated";

  const rd = resolveEventLegReturnDiscount(
    {
      event_return_rate_preset: input.event_return_rate_preset,
      event_return_rate_custom: input.event_return_rate_custom,
      event_same_location_onsite: onSite,
    },
    config,
  );

  const core = await computeEventLegPrice(sb, {
    eventItems: input.event_items,
    fromAccess: input.from_access,
    toAccess: input.to_access,
    distInfo: distEff,
    config,
    isLuxury,
    truckType,
    fromParking,
    toParking,
    fromLongCarry: !!input.from_long_carry,
    toLongCarry: !!input.to_long_carry,
    returnDiscount: rd,
    skipTruckSurcharge: onSite,
  });

  const { setupFee, setupLabel } = eventSetupFeeAndLabel(input, config);

  let price = core.deliveryCharge + core.returnCharge + setupFee + addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const total = price + tax;
  const minDeposit = cfgNum(config, "event_min_deposit", 300);
  const deposit = Math.max(minDeposit, Math.ceil(price * 0.25));

  const eventIncludes = buildEventIncludesList(input);

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total,
      includes: eventIncludes,
    } as TierResult,
    factors: {
      event_mode: "single",
      event_name: input.event_name || null,
      delivery_date: input.move_date || null,
      return_date: input.event_return_date || null,
      delivery_charge: core.deliveryCharge,
      return_charge: core.returnCharge,
      return_discount: core.returnDiscount,
      setup_fee: setupFee,
      setup_label: setupLabel || null,
      event_crew: core.labour.crewSize,
      event_hours: core.billableHours,
      same_day: input.event_same_day ?? false,
      event_is_luxury: isLuxury,
      event_truck_type: truckType,
      event_same_location_onsite: onSite,
      event_type_label: onSite ? "On-site Event" : "Venue delivery",
      truck_surcharge: core.truckSurcharge,
      truck_breakdown_line: truckBreakdownLabel(truckType, core.truckSurcharge),
      event_parking_surcharge: core.parkingSurcharge,
      event_long_carry_surcharge: core.longCarrySurcharge,
      distance_km: distEff?.distance_km ?? 0,
      event_distance_summary:
        onSite ? "On-site (no transit)" : distEff?.distance_km != null ? `${Math.round(distEff.distance_km)} km` : null,
      crew_hourly_rate: core.crewHourlyRate,
    },
    labour: {
      ...core.labour,
      estimatedHours: core.billableHours,
      truckSize: truckType,
    },
  };
}

/** Sum multiple event legs into one quote; setup + addons applied once */
async function calcMultiEvent(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  legDistances: ({ distance_km: number; drive_time_min: number } | null)[],
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const legs = input.event_legs ?? [];
  let totalDelivery = 0;
  let totalReturn = 0;
  let maxCrew = 2;
  let maxHours = 3;
  const legBreakdown: Record<string, unknown>[] = [];
  const distLabels: { label: string; km: number }[] = [];

  const sharedItems = input.event_items;
  const isLuxury = !!input.event_is_luxury;
  const defaultTruck = normalizeTruckType(input.event_truck_type ?? input.truck_type ?? "sprinter");
  let hasOnSiteLeg = false;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const onSite = !!leg.event_same_location_onsite;
    if (onSite) hasOnSiteLeg = true;
    const dist = onSite ? { distance_km: 0, drive_time_min: 0 } : (legDistances[i] ?? null);
    const itemsForLeg = leg.event_items && leg.event_items.length > 0 ? leg.event_items : sharedItems;
    const fromParking = leg.from_parking ?? input.from_parking ?? "dedicated";
    const toParking = leg.to_parking ?? input.to_parking ?? "dedicated";
    const fromLc = leg.from_long_carry ?? input.from_long_carry ?? false;
    const toLc = leg.to_long_carry ?? input.to_long_carry ?? false;
    const rd = resolveEventLegReturnDiscount(leg, config);
    const truckLeg = onSite ? ("none" as TruckKey) : normalizeTruckType(leg.event_leg_truck_type ?? input.event_truck_type ?? input.truck_type ?? "sprinter");

    const core = await computeEventLegPrice(sb, {
      eventItems: itemsForLeg,
      fromAccess: leg.from_access ?? input.from_access,
      toAccess: leg.to_access ?? input.to_access,
      distInfo: dist,
      config,
      isLuxury,
      truckType: truckLeg,
      fromParking,
      toParking,
      fromLongCarry: !!fromLc,
      toLongCarry: !!toLc,
      returnDiscount: rd,
      skipTruckSurcharge: onSite,
    });

    totalDelivery += core.deliveryCharge;
    totalReturn += core.returnCharge;
    if (core.labour.crewSize > maxCrew) maxCrew = core.labour.crewSize;
    if (core.billableHours > maxHours) maxHours = core.billableHours;

    const retDate = leg.event_same_day ? leg.move_date : (leg.event_return_date || leg.move_date);
    const legLabel = leg.label?.trim() || `Event ${i + 1}`;
    const km = dist?.distance_km ?? 0;
    distLabels.push({ label: legLabel, km });

    legBreakdown.push({
      label: legLabel,
      from_address: leg.from_address,
      to_address: onSite ? leg.from_address : leg.to_address,
      delivery_date: leg.move_date,
      return_date: retDate,
      delivery_charge: core.deliveryCharge,
      return_charge: core.returnCharge,
      return_discount: core.returnDiscount,
      event_crew: core.labour.crewSize,
      event_hours: core.billableHours,
      return_hours: core.returnHours,
      same_day: !!leg.event_same_day,
      distance_km: km,
      from_parking: fromParking,
      to_parking: toParking,
      is_on_site: onSite,
      event_type_label: onSite ? "On-site Event" : "Venue delivery",
      truck_type: truckLeg,
    });
  }

  const { setupFee, setupLabel } = eventSetupFeeAndLabel(input, config);
  let price = totalDelivery + totalReturn + setupFee + addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const total = price + tax;
  const minDeposit = cfgNum(config, "event_min_deposit", 300);
  const deposit = Math.max(minDeposit, Math.ceil(price * 0.25));

  const eventDistanceSummary = distLabels
    .map((d, idx) =>
      legs[idx]?.event_same_location_onsite ? `${d.label}: On-site` : `${d.label}: ${Math.round(d.km)} km`,
    )
    .join(" · ");

  const eventIncludes = buildEventIncludesList(input);

  const first = legs[0];
  const firstReturn = first.event_same_day ? first.move_date : (first.event_return_date || first.move_date);

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total,
      includes: eventIncludes,
    } as TierResult,
    factors: {
      event_mode: "multi",
      event_name: input.event_name || null,
      event_legs: legBreakdown,
      event_leg_distances: distLabels,
      event_distance_summary: eventDistanceSummary,
      event_has_on_site_leg: hasOnSiteLeg,
      delivery_date: first.move_date,
      return_date: firstReturn,
      delivery_charge: totalDelivery,
      return_charge: totalReturn,
      setup_fee: setupFee,
      setup_label: setupLabel || null,
      event_crew: maxCrew,
      event_hours: maxHours,
      same_day: false,
      event_is_luxury: isLuxury,
      event_truck_type: defaultTruck,
      truck_breakdown_line: truckBreakdownLabel(defaultTruck, truckSurchargeAmount(config, defaultTruck)),
    },
    labour: {
      crewSize: maxCrew,
      estimatedHours: maxHours,
      hoursRange: `${maxHours}hr`,
      truckSize: defaultTruck,
    },
  };
}

// ═══════════════════════════════════════════════
// LABOUR ONLY — crew at one location, no transit
// ═══════════════════════════════════════════════

async function calcLabourOnly(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const labourRate = cfgNum(config, "labour_only_rate", 80);
  const crewSize = input.labour_crew_size ?? 2;
  const hours = input.labour_hours ?? 3;
  const truckFee = input.labour_truck_required ? cfgNum(config, "labour_only_truck_fee", 150) : 0;
  const accessSurcharge = await getAccessSurcharge(sb, input.from_access);
  const rounding = cfgNum(config, "rounding_nearest", 50);
  const plcLab = parkingLongCarryLineTotal(config, input, "origin_only");

  const basePrice = crewSize * hours * labourRate;
  let visit1Price = roundTo(basePrice + truckFee + accessSurcharge + plcLab.total, rounding);

  const visit2Discount = cfgNum(config, "labour_only_visit2_discount", 0.85);
  let visit2Price = 0;
  if ((input.labour_visits ?? 1) >= 2) {
    visit2Price = roundTo(Math.round(basePrice * visit2Discount) + truckFee + accessSurcharge + plcLab.total, rounding);
  }

  const storageWeekly = cfgNum(config, "storage_weekly_rate", 75);
  const storageWeeks = Math.max(1, Math.round(input.labour_storage_weeks ?? 1));
  const labourStorageFee =
    input.labour_storage_needed ? storageWeeks * storageWeekly : 0;

  let price = visit1Price + visit2Price + labourStorageFee + addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const total = price + tax;
  const deposit = Math.max(100, Math.round(total * 0.25));

  const labourIncludes = [
    `${crewSize} movers × ${hours} hours`,
    `Labour rate: $${labourRate}/mover/hr`,
    input.labour_truck_required ? `Truck included (+$${truckFee})` : "No truck required (crew arrives in van)",
    ...(accessSurcharge > 0 ? [`Access surcharge: $${accessSurcharge}`] : []),
    ...(input.labour_storage_needed
      ? [
          `Storage between visits: ~${storageWeeks} week${storageWeeks !== 1 ? "s" : ""} @ $${storageWeekly}/wk (estimate)`,
        ]
      : []),
    ...((input.labour_visits ?? 1) >= 2
      ? [`Visit 1 (${input.move_date ?? "TBD"}): $${visit1Price}`, `Visit 2 (${input.labour_second_visit_date ?? "TBD"}): $${visit2Price} (return visit discount)`]
      : []),
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total,
      includes: labourIncludes,
    } as TierResult,
    factors: {
      crew_size: crewSize,
      hours,
      labour_rate: labourRate,
      base_price: basePrice,
      truck_fee: truckFee,
      access_surcharge: accessSurcharge,
      visits: input.labour_visits ?? 1,
      visit1_price: visit1Price,
      visit2_price: visit2Price,
      visit2_date: input.labour_second_visit_date || null,
      labour_description: input.labour_description || null,
      parking_long_carry_total: plcLab.total,
      labour_storage_needed: !!input.labour_storage_needed,
      labour_storage_weeks: input.labour_storage_needed ? storageWeeks : null,
      storage_weekly_rate: storageWeekly,
      labour_storage_fee: labourStorageFee,
    },
    labour: {
      crewSize,
      estimatedHours: hours,
      hoursRange: `${hours}hr`,
      truckSize: input.labour_truck_required ? "20ft" : "Van",
    },
  };
}

/** Strip internal cost/margin fields from API JSON for non–super-admin callers. DB `factors_applied` stays full. */
function omitMarginEstimateFields(factors: unknown): unknown {
  if (!factors || typeof factors !== "object") return factors;
  const o = { ...(factors as Record<string, unknown>) };
  delete o.estimated_cost;
  delete o.estimated_margin_essential;
  delete o.estimated_margin_signature;
  delete o.estimated_margin_estate;
  delete o.estimated_margin_curated;
  return o;
}

// ═══════════════════════════════════════════════
// MAIN POST HANDLER
// ═══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { user: authUser, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  // ?preview=true → run all pricing logic but skip the DB insert
  const isPreview = new URL(req.url).searchParams.get("preview") === "true";

  let input: QuoteInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Labour-only: to_address may equal from_address (work at one location)
  const effectiveToAddress = input.to_address || (input.service_type === "labour_only" ? input.from_address : undefined);
  if (!input.service_type || !input.from_address || !effectiveToAddress || !input.move_date) {
    return NextResponse.json(
      { error: "service_type, from_address, to_address (or work_address for labour_only), and move_date are required" },
      { status: 400 },
    );
  }
  if (!input.to_address && input.service_type === "labour_only") {
    input = { ...input, to_address: input.from_address };
  }

  // B2B multi-stop: normalize primary pickup/delivery for distance + quote row
  if (
    (input.service_type === "b2b_delivery" || input.service_type === "b2b_oneoff") &&
    Array.isArray(input.b2b_stops) &&
    input.b2b_stops.length >= 2
  ) {
    const ordered = input.b2b_stops.map((s) => s.address?.trim()).filter(Boolean);
    if (ordered.length >= 2) {
      input = {
        ...input,
        from_address: ordered[0]!,
        to_address: ordered[ordered.length - 1]!,
      };
    }
  }

  if (input.service_type === "b2b_delivery" || input.service_type === "b2b_oneoff") {
    const subO = parsePositivePreTaxOverride(input.b2b_subtotal_override);
    const fullO = parsePositivePreTaxOverride(input.b2b_full_pre_tax_override);
    if (subO !== undefined && fullO !== undefined) {
      return NextResponse.json(
        { error: "Use either dimensional subtotal override or full pre-tax override, not both" },
        { status: 400 },
      );
    }
    const reason = String(input.b2b_subtotal_override_reason || "").trim();
    if ((subO !== undefined || fullO !== undefined) && reason.length < 3) {
      return NextResponse.json(
        { error: "Price override requires a reason (at least 3 characters)" },
        { status: 400 },
      );
    }
  }

  if (input.service_type === "bin_rental") {
    const sb = createAdminClient();
    const binHsToken = process.env.HUBSPOT_ACCESS_TOKEN ?? null;
    const binQuoteIdOpts = binHsToken ? { hubspotAccessToken: binHsToken } : {};
    const config = await loadConfig(sb);
    const neighbourhood = await getNeighbourhood(sb, input.to_address);
    const result = await buildBinRentalQuoteResponse({
      sb,
      config,
      input,
      isPreview,
      authUser: authUser ? { id: authUser.id, email: authUser.email } : null,
      generateQuoteId: () => generateNextQuoteId(sb, binQuoteIdOpts),
      postalPrefix: neighbourhood.postalPrefix,
      hubspotAccessToken: binHsToken,
    });
    return NextResponse.json(result.body, { status: result.status });
  }

  if (input.service_type === "event" && input.event_mode === "multi") {
    if (!Array.isArray(input.event_legs) || input.event_legs.length < 2) {
      return NextResponse.json({ error: "Multi-event requires at least 2 event legs" }, { status: 400 });
    }
  }

  /** Multi-event: ≥2 legs, each with origin/venue/dates; first leg fills primary quote row */
  const isEventMulti =
    input.service_type === "event" &&
    input.event_mode === "multi" &&
    Array.isArray(input.event_legs) &&
    input.event_legs.length >= 2;

  if (isEventMulti && input.event_legs) {
    input = {
      ...input,
      event_legs: input.event_legs.map((l) =>
        l.event_same_location_onsite ? { ...l, to_address: l.from_address } : l,
      ),
    };
  }

  if (isEventMulti) {
    for (let i = 0; i < input.event_legs!.length; i++) {
      const leg = input.event_legs![i];
      const toReq = leg.event_same_location_onsite ? leg.from_address?.trim() : leg.to_address?.trim();
      if (!leg.from_address?.trim() || !toReq || !leg.move_date) {
        return NextResponse.json(
          { error: `Event ${i + 1}: origin, venue, and delivery date are required` },
          { status: 400 },
        );
      }
      if (!leg.event_same_day && !leg.event_return_date?.trim()) {
        return NextResponse.json(
          { error: `Event ${i + 1}: return date is required unless same-day is selected` },
          { status: 400 },
        );
      }
    }
    const first = input.event_legs![0];
    input = {
      ...input,
      from_address: first.from_address,
      to_address: first.to_address,
      from_access: first.from_access ?? input.from_access,
      to_access: first.to_access ?? input.to_access,
      move_date: first.move_date,
      event_return_date: first.event_same_day ? first.move_date : (first.event_return_date || first.move_date),
      event_same_day: !!first.event_same_day,
    };
  }

  if (input.service_type === "event" && !isEventMulti && input.event_same_location_onsite) {
    input = { ...input, to_address: input.from_address };
  }

  const isLocalMove = input.service_type === "local_move";
  const isLongDistance = input.service_type === "long_distance";
  const needsMoveSizeForResidential =
    isLocalMove || isLongDistance || input.service_type === "white_glove";
  const moveSizeTrimmed = input.move_size?.trim() ?? "";
  if (needsMoveSizeForResidential && !moveSizeTrimmed) {
    return NextResponse.json(
      {
        error:
          "move_size is required. Select a move size or add inventory so the form can suggest one.",
      },
      { status: 400 },
    );
  }
  if (needsMoveSizeForResidential) {
    input = { ...input, move_size: moveSizeTrimmed };
  }

  const sb = createAdminClient();
  const hubspotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN ?? null;
  const nextQuoteIdOpts = hubspotAccessToken ? { hubspotAccessToken } : {};
  const config = await loadConfig(sb);

  const serviceAreaCheckedTypes = new Set(["local_move", "long_distance", "white_glove"]);
  if (serviceAreaCheckedTypes.has(input.service_type) && !input.service_area_override) {
    const serviceAreaResult = await evaluateServiceAreaForQuote(
      input.from_address,
      input.to_address,
      config,
    );
    if (!serviceAreaResult.serviceable && serviceAreaResult.type === "out_of_area") {
      return NextResponse.json({
        quote_blocked: true,
        block_reason: "out_of_service_area",
        service_area: serviceAreaResult,
        message:
          serviceAreaResult.warning ??
          "This move is outside the standard service area from the Toronto base.",
      });
    }
  }

  // Per-leg distances for multi-event (Mapbox)
  let legDistances: ({ distance_km: number; drive_time_min: number } | null)[] | null = null;
  if (isEventMulti) {
    legDistances = await Promise.all(
      input.event_legs!.map((leg) =>
        leg.event_same_location_onsite
          ? Promise.resolve({ distance_km: 0, drive_time_min: 0 })
          : getDistance(leg.from_address, leg.to_address?.trim() || leg.from_address),
      ),
    );
  }

  // Section 5: Batch all Mapbox distance calls (job route + deadhead + return trip)
  /** Inventory scoring: local residential + white glove only (not long_distance). */
  const useInventoryScoring = isLocalMove || input.service_type === "white_glove";
  const needsDeadheadReturn = isLocalMove;
  const b2bMultiStop =
    (input.service_type === "b2b_delivery" || input.service_type === "b2b_oneoff") &&
    Array.isArray(input.b2b_stops) &&
    input.b2b_stops.length >= 2;

  const [distInfo, neighbourhood, dateMult, deadheadInfo, returnInfo] = await Promise.all([
    b2bMultiStop
      ? getMultiStopDrivingDistance(
          input.b2b_stops!.map((s) => s.address).filter((a) => a?.trim()),
        ).then((m) => m ?? getDistance(input.from_address, input.to_address))
      : getDistance(input.from_address, input.to_address),
    getNeighbourhood(sb, input.from_address),
    getDateMultiplier(sb, input.move_date),
    // Section 4D: Yugo base → pickup (deadhead)
    needsDeadheadReturn ? getDistance(YUGO_BASE_ADDRESS, input.from_address) : Promise.resolve(null),
    // Section 4E: drop-off → Yugo base (return trip)
    needsDeadheadReturn ? getDistance(input.to_address, YUGO_BASE_ADDRESS) : Promise.resolve(null),
  ]);

  // Pre-compute a rough base for percent-type add-ons (use base_rate as proxy)
  let roughBase = 1000;
  if (isLocalMove || isLongDistance || input.service_type === "white_glove") {
    const { data: br } = await sb
      .from("base_rates")
      .select("base_price")
      .eq("move_size", input.move_size!)
      .single();
    roughBase = br?.base_price ?? 999;
  }

  const addonResult = await calculateAddons(sb, input.selected_addons, roughBase);

  // Inventory volume modifier (local_move + white_glove only)
  const invResult = useInventoryScoring
    ? await calcInventoryModifier(
        sb,
        input.move_size!,
        input.inventory_items ?? [],
        config,
        input.client_box_count,
      )
    : {
        modifier: 1.0,
        inventoryScore: 0,
        benchmarkScore: 0,
        totalItems: 0,
        maxModifier: undefined,
        itemScore: 0,
        boxCount: 0,
      };

  // FIX 1: Inventory quantity sanity — flag for coordinator review (don't block quote)
  const inventoryWarnings = validateInventoryQuantities(input.inventory_items ?? []);

  // FIX 3: Specialty items affect crew/hours (boost score for labour estimate only; pricing uses original modifier)
  const SPECIALTY_CREW_IMPACT: Record<string, number> = {
    piano_upright: 15,
    piano_grand: 25,
    pool_table: 20,
    safe_under_300: 10,
    safe_over_300: 20,
    safe_under_300lbs: 10,
    safe_over_300lbs: 20,
    hot_tub: 25,
    motorcycle: 15,
    gym_equipment_per_piece: 5,
    gym_equipment: 5,
    artwork_per_piece: 3,
    antique_per_piece: 5,
    wine_collection: 5,
    aquarium: 15,
  };
  // Labour estimate uses lower box weight (0.15): boxes move in batches on dollies, not individually; modifier still uses 0.3 for volume.
  const boxCount = (invResult as { boxCount?: number }).boxCount ?? 0;
  const labourBaseScore = invResult.inventoryScore - boxCount * 0.15;
  let adjustedScore = labourBaseScore;
  if (input.specialty_items && input.specialty_items.length > 0) {
    for (const item of input.specialty_items) {
      const impact = SPECIALTY_CREW_IMPACT[item.type] ?? 5;
      adjustedScore += impact * (item.qty || 1);
    }
  }

  // Client-facing labour = on-job hours only (also used for residential tier labour delta).
  const truckInventoryScoreForLabour =
    invResult.totalItems > 0
      ? (invResult.itemScore ?? 0) + ((invResult as { boxCount?: number }).boxCount ?? 0) * 0.3
      : undefined;

  let labourClient: { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null = null;

  if (adjustedScore > 0) {
    labourClient = estimateLabourFromScore(
      adjustedScore,
      distInfo?.distance_km ?? 0,
      input.from_access,
      input.to_access,
      input.move_size ?? "2br",
      {
        driveTimeMinutes: distInfo?.drive_time_min,
        specialtyItems: input.specialty_items,
        whiteGloveHoursMultiplier: input.service_type === "white_glove",
        hoursEstimateMode: "client_on_job",
        truckInventoryScore: truckInventoryScoreForLabour,
      },
    );
  } else if (isLocalMove || input.service_type === "white_glove") {
    const { data: br } = await sb
      .from("base_rates")
      .select("min_crew, estimated_hours")
      .eq("move_size", input.move_size ?? "2br")
      .single();
    const minCrew = br?.min_crew ?? 2;
    const estHours = br?.estimated_hours ?? 3;
    const truckSize = DEFAULT_TRUCK_BY_SIZE[input.move_size ?? "2br"]?.replace("-ft truck", "ft") ?? "16ft";
    const lo = Math.max(2, Number(estHours) - 0.5);
    const hi = Number(estHours) + 1;
    labourClient = {
      crewSize: minCrew,
      estimatedHours: Number(estHours),
      hoursRange: `${lo}–${hi} hours`,
      truckSize,
    };
  }

  let labour = labourClient;
  // Residential tier math must use the same labour model as `labour` in the JSON response
  // (client on-job hours). A separate ops-only estimate (full cycle / return) inflated preview
  // and new saves vs the crew/hours line coordinators see.
  const labourForResidential = labourClient;

  // Global crating calculation (applies to all service types)
  const cratingBySize = parseJsonConfig<Record<string, number>>(config, "crating_prices", {});
  const CRATING_PRICE_FALLBACK: Record<string, number> = { small: 175, medium: 250, large: 350, oversized: 500 };
  let globalCratingTotal = 0;
  if (input.crating_pieces && input.crating_pieces.length > 0) {
    for (const piece of input.crating_pieces) {
      globalCratingTotal += cratingBySize[piece.size] ?? CRATING_PRICE_FALLBACK[piece.size] ?? 250;
    }
  }

  type FactorsObj = Record<string, unknown>;
  let tiers: Record<string, TierResult> | undefined;
  let custom_price: TierResult | undefined;
  let factors: FactorsObj = {};
  let residentialCratingTotal = 0;
  let estateSuppliesAllowance = 0;
  /** For local moves: crew/hours shown to client (from base_rates). Used so ops matches client. */
  let displayCrew: number | null = null;
  let displayHours: number | null = null;

  const svcType = input.service_type;

  // Truck allocation
  const truckMoveSize = (svcType === "single_item" || svcType === "white_glove")
    ? svcType
    : (input.move_size ?? "2br");
  const truckResult = await allocateTruck(sb, truckMoveSize, invResult.modifier);

  switch (svcType) {
    case "local_move": {
      const res = await calcResidential(
        sb,
        input,
        config,
        distInfo,
        neighbourhood,
        dateMult,
        addonResult,
        invResult,
        labourForResidential,
        deadheadInfo,
        returnInfo,
      );
      tiers = res.tiers;
      factors = res.factors;
      residentialCratingTotal = res.cratingTotal;
      estateSuppliesAllowance = res.estateSuppliesAllowance;
      // Use labour (inventory-based or base_rates fallback) when available so quote shows correct crew/hours
      displayCrew = labour ? labour.crewSize : res.minCrew;
      displayHours = labour ? labour.estimatedHours : res.estHours;
      break;
    }
    case "office_move": {
      const res = await calcOffice(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "long_distance": {
      const res = await calcLongDistance(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "single_item": {
      const res = await calcSingleItem(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "white_glove": {
      const res = await calcWhiteGlove(
        sb,
        input,
        config,
        distInfo,
        neighbourhood,
        dateMult,
        addonResult,
        invResult,
        labourForResidential,
        deadheadInfo,
        returnInfo,
      );
      custom_price = res.custom_price;
      factors = res.factors;
      residentialCratingTotal = res.cratingTotal;
      estateSuppliesAllowance = res.estateSuppliesAllowance;
      displayCrew = labour ? labour.crewSize : res.minCrew;
      displayHours = labour ? labour.estimatedHours : res.estHours;
      break;
    }
    case "specialty": {
      const res = await calcSpecialty(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "b2b_delivery":
    case "b2b_oneoff": {
      const res = await calcB2bOneoff(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "event": {
      if (isEventMulti && legDistances && legDistances.length >= 2) {
        const res = await calcMultiEvent(sb, input, config, legDistances, addonResult);
        custom_price = res.custom_price;
        factors = res.factors;
        labour = res.labour;
      } else {
        const res = await calcEvent(sb, input, config, distInfo, addonResult);
        custom_price = res.custom_price;
        factors = res.factors;
        labour = res.labour;
      }
      break;
    }
    case "labour_only": {
      const res = await calcLabourOnly(sb, input, config, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      labour = res.labour;
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown service_type: ${svcType}` }, { status: 400 });
  }

  if (isLocalMove || isLongDistance || svcType === "white_glove") {
    const stopFac = pickupDropoffFactorsFromPayload({
      from_address: input.from_address,
      to_address: input.to_address,
      from_access: input.from_access,
      to_access: input.to_access,
      additional_pickup_addresses: input.additional_pickup_addresses,
      additional_dropoff_addresses: input.additional_dropoff_addresses,
    });
    factors = {
      ...factors,
      ...stopFac,
      // Redundant with pickup_locations but lets clients merge stops if arrays were ever truncated
      ...(input.additional_pickup_addresses?.length
        ? { additional_pickup_addresses: input.additional_pickup_addresses }
        : {}),
      ...(input.additional_dropoff_addresses?.length
        ? { additional_dropoff_addresses: input.additional_dropoff_addresses }
        : {}),
    };
  }

  if (
    (svcType === "b2b_delivery" || svcType === "b2b_oneoff") &&
    factors &&
    factors.b2b_dimensional === true
  ) {
    if (typeof factors.b2b_crew === "number") displayCrew = factors.b2b_crew;
    if (typeof factors.b2b_estimated_hours === "number") displayHours = factors.b2b_estimated_hours;
  }

  if (
    factors &&
    typeof factors.truck_surcharge === "number" &&
    factors.truck_recommended != null &&
    factors.truck_breakdown_line == null
  ) {
    const tk = normalizeTruckType(String(factors.truck_recommended));
    factors = { ...factors, truck_breakdown_line: truckBreakdownLabel(tk, factors.truck_surcharge) };
  }

  // For non-residential services, apply crating cost to custom_price (white_glove uses residential calc — crating already in tier)
  if (custom_price && globalCratingTotal > 0 && svcType !== "white_glove") {
    const taxR = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
    const newPrice = custom_price.price + globalCratingTotal;
    const newTax = Math.round(newPrice * taxR);
    const minEvDep = cfgNum(config, "event_min_deposit", 300);
    const newDeposit =
      svcType === "event"
        ? Math.max(minEvDep, Math.ceil(newPrice * 0.25))
        : custom_price.deposit;
    custom_price = {
      ...custom_price,
      price: newPrice,
      tax: newTax,
      total: newPrice + newTax,
      deposit: newDeposit,
    };
    factors = { ...factors, crating_total: globalCratingTotal, crating_pieces_count: input.crating_pieces?.length ?? 0 };
  }

  // Add crating line item to tier includes when crating is present
  const cratingForDisplay = svcType === "local_move" ? residentialCratingTotal : globalCratingTotal;
  if (cratingForDisplay > 0 && input.crating_pieces && input.crating_pieces.length > 0) {
    const cratingLine = `Custom crating for ${input.crating_pieces.length} item${input.crating_pieces.length === 1 ? "" : "s"}: $${cratingForDisplay.toLocaleString()}`;
    if (tiers) {
      for (const t of Object.values(tiers)) {
        t.includes.push(cratingLine);
      }
    } else if (custom_price) {
      custom_price.includes.push(cratingLine);
    }
  }

  const TRUCK_DISPLAY: Record<string, string> = {
    sprinter: "Extended Sprinter van",
    "16ft": "16ft climate-protected truck",
    "20ft": "20ft dedicated moving truck",
    "24ft": "24ft full-size moving truck",
    "26ft": "26ft maximum-capacity truck",
  };

  // Resolve truck line: from allocation when available, else from labour estimate so tier copy matches actual size
  const labourTruckKey = labour?.truckSize?.replace(/ \+ .*$/i, "")?.toLowerCase() ?? null;
  const fallbackTruckLine = labourTruckKey && TRUCK_DISPLAY[labourTruckKey]
    ? TRUCK_DISPLAY[labourTruckKey]
    : labour?.truckSize ?? "Dedicated moving truck";

  /** Local moves: priced truck (inventory-based) should match quote.truck_primary when coordinator did not override. */
  const residentialPricedTruck =
    svcType === "local_move" && typeof factors.truck_recommended === "string"
      ? (factors.truck_recommended as string)
      : null;

  if (truckResult.primary && tiers) {
    const truckLine = truckResult.isMultiVehicle && truckResult.secondary
      ? `${TRUCK_DISPLAY[truckResult.primary.vehicle_type] || truckResult.primary.display_name} + support van`
      : TRUCK_DISPLAY[truckResult.primary.vehicle_type] || truckResult.primary.display_name;
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const idx = t.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter"));
      if (idx >= 0) t.includes[idx] = truckLine;
      else t.includes.unshift(truckLine);
    }
  } else if (tiers && fallbackTruckLine) {
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const idx = t.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter"));
      if (idx >= 0) t.includes[idx] = fallbackTruckLine;
      else t.includes.unshift(fallbackTruckLine);
    }
  }

  if (truckResult.primary && custom_price) {
    const truckLine = TRUCK_DISPLAY[truckResult.primary.vehicle_type] || truckResult.primary.display_name;
    const idx = custom_price.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter") || s.toLowerCase().includes("transport"));
    if (idx >= 0) custom_price.includes[idx] = truckLine;
    else custom_price.includes.unshift(truckLine);
  } else if (custom_price && fallbackTruckLine) {
    const idx = custom_price.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter") || s.toLowerCase().includes("transport"));
    if (idx >= 0) custom_price.includes[idx] = fallbackTruckLine;
    else custom_price.includes.unshift(fallbackTruckLine);
  }

  // When labour exists (inventory-based or base_rates fallback), use it for tier includes so the public quote page shows crew/hours that match the estimate
  if (labour && tiers) {
    const crewLineStandard = `Professional crew of ${labour.crewSize}`;
    const crewLineEstate = `White glove specialist crew of ${labour.crewSize}`;
    const hoursLine = `${Math.round(labour.estimatedHours)}-hour window`;
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const estateCrewIdx = t.includes.findIndex((s: string) => s.toLowerCase().includes("white glove specialist crew of"));
      if (estateCrewIdx >= 0) t.includes[estateCrewIdx] = crewLineEstate;
      else {
        const crewIdx = t.includes.findIndex((s: string) =>
          s.toLowerCase().includes("professional crew of") || s.toLowerCase().includes("professional movers")
        );
        if (crewIdx >= 0) t.includes[crewIdx] = crewLineStandard;
      }
      const hoursIdx = t.includes.findIndex((s: string) => s.toLowerCase().includes("-hour window"));
      if (hoursIdx >= 0) t.includes[hoursIdx] = hoursLine;
    }
  }

  if (svcType === "local_move" && tiers?.estate && factors && typeof factors === "object") {
    const fObj = factors as Record<string, unknown>;
    const ep = fObj.estate_day_plan as { days?: number } | undefined;
    if (ep && typeof ep.days === "number" && ep.days > 1) {
      const estInc = tiers.estate.includes;
      const hoursIdx = estInc.findIndex((s: string) => s.toLowerCase().includes("-hour window"));
      if (hoursIdx >= 0) {
        const head = fObj.estate_schedule_headline;
        estInc[hoursIdx] =
          typeof head === "string" && head.trim() ? head : "Estate · multi-day plan";
      }
    }
  }

  // ── Valuation upgrades lookup ──
  const INCLUDED_VALUATION: Record<string, string> = {
    essential: "released",
    signature: "enhanced",
    estate: "full_replacement",
  };
  const UPGRADE_PATHS: Record<string, string | null> = {
    essential: "enhanced",
    signature: "full_replacement",
    estate: null,
  };
  const moveSize = input.move_size ?? "2br";
  const valuationUpgrades: Record<string, { price: number; to_tier: string; assumed_shipment_value: number } | null> = {};
  for (const pkg of ["essential", "signature", "estate"]) {
    const target = UPGRADE_PATHS[pkg];
    if (!target) { valuationUpgrades[pkg] = null; continue; }
    const { data: vu } = await sb
      .from("valuation_upgrades")
      .select("price, to_tier, assumed_shipment_value")
      .eq("move_size", moveSize)
      .eq("from_package", pkg)
      .eq("to_tier", target)
      .eq("active", true)
      .maybeSingle();
    valuationUpgrades[pkg] = vu ?? null;
  }

  const { data: valTiers } = await sb
    .from("valuation_tiers")
    .select("tier_slug, display_name, rate_description, rate_per_pound, max_per_item, max_per_shipment, deductible, damage_process, covers, excludes, included_in_package")
    .eq("active", true)
    .order("tier_slug");

  const isUpdate = !isPreview && !!input.quote_id?.trim();
  let quoteId: string;
  if (isPreview) {
    quoteId = "PREVIEW";
  } else if (isUpdate) {
    const { data: existing } = await sb.from("quotes").select("quote_id").eq("quote_id", input.quote_id!.trim()).maybeSingle();
    quoteId = existing?.quote_id ?? (await generateNextQuoteId(sb, nextQuoteIdOpts));
  } else {
    quoteId = await generateNextQuoteId(sb, nextQuoteIdOpts);
  }

  const primaryPrice = tiers ? tiers.essential.price : custom_price!.price;
  const depositAmount = tiers ? tiers.essential.deposit : custom_price!.deposit;

  // Resolve contact: use provided contact_id, or look up / create from client info
  let contactId = input.contact_id || null;
  if (!contactId && input.client_email) {
    const { data: existing } = await sb
      .from("contacts")
      .select("id")
      .eq("email", input.client_email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();
    if (existing) {
      contactId = existing.id;
      if (input.client_phone?.trim()) {
        const p = normalizePhone(input.client_phone);
        if (p.length >= 10) {
          await sb.from("contacts").update({ phone: p }).eq("id", existing.id);
        }
      }
    } else {
      const { data: created } = await sb
        .from("contacts")
        .insert({
          name: input.client_name?.trim() || null,
          email: input.client_email.trim().toLowerCase(),
          phone: input.client_phone?.trim() || null,
        })
        .select("id")
        .single();
      if (created) contactId = created.id;
    }
  }

  const expiryDays = cfgNum(config, "quote_expiry_days", 7);

  if (!isPreview) {
    const quotePayload = {
      hubspot_deal_id: input.hubspot_deal_id || null,
      contact_id: contactId,
      service_type: svcType === "b2b_oneoff" ? "b2b_delivery" : svcType === "event" ? "event" : svcType === "labour_only" ? "labour_only" : svcType,
      status: "draft",
      from_address: input.from_address,
      from_access: input.from_access || null,
      from_postal: neighbourhood.postalPrefix || null,
      from_parking: input.from_parking ?? "dedicated",
      to_parking: input.to_parking ?? "dedicated",
      from_long_carry: input.from_long_carry ?? false,
      to_long_carry: input.to_long_carry ?? false,
      to_address: input.to_address,
      to_access: input.to_access || null,
      move_date: input.move_date,
      move_size: input.move_size || null,
      distance_km: distInfo?.distance_km ?? null,
      drive_time_min: distInfo?.drive_time_min ?? null,
      specialty_items: input.specialty_items ?? [],
      tiers: tiers ?? null,
      custom_price: custom_price?.price ?? null,
      deposit_amount: depositAmount,
      factors_applied: factors,
      selected_addons: addonResult.breakdown,
      expires_at: new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
      inventory_items: input.inventory_items ?? [],
      client_box_count: input.client_box_count ?? null,
      inventory_warnings: inventoryWarnings.length > 0 ? inventoryWarnings : [],
      inventory_score: invResult.inventoryScore || null,
      inventory_modifier: invResult.modifier !== 1.0 ? invResult.modifier : null,
      est_crew_size: displayCrew ?? labour?.crewSize ?? null,
      est_hours: displayHours ?? labour?.estimatedHours ?? null,
      est_truck_size: labour?.truckSize ?? null,
      truck_primary:
        svcType === "local_move" && residentialPricedTruck && residentialPricedTruck !== "none"
          ? residentialPricedTruck
          : truckResult.primary?.vehicle_type ?? (labourTruckKey && TRUCK_DISPLAY[labourTruckKey] ? labourTruckKey : null),
      truck_secondary: truckResult.secondary?.vehicle_type ?? null,
      recommended_tier: normalizeRecommendedTierForDb(input.recommended_tier),
      crating_pieces: input.crating_pieces ?? [],
      crating_total: cratingForDisplay,
      supplies_allowance: estateSuppliesAllowance,
    };

    if (isUpdate) {
      const { error: updateErr } = await sb.from("quotes").update(quotePayload).eq("quote_id", quoteId);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const prefixForHubSpot = await getQuoteIdPrefix(sb);
      const MAX_INSERT_ATTEMPTS = 6;
      let insertQuoteId = quoteId;
      let inserted = false;
      for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
        const { error: insertErr } = await sb.from("quotes").insert({
          quote_id: insertQuoteId,
          ...quotePayload,
        });
        if (!insertErr) {
          quoteId = insertQuoteId;
          inserted = true;
          const dealHs = input.hubspot_deal_id?.trim();
          if (dealHs && hubspotAccessToken) {
            const jobNo = quoteNumericSuffixForHubSpot(insertQuoteId, prefixForHubSpot);
            if (jobNo) {
              patchHubSpotDealJobNo(hubspotAccessToken, dealHs, jobNo).catch((e) =>
                console.warn("[quotes/generate] HubSpot job_no sync:", e),
              );
            }
          }
          break;
        }
        if (isQuoteIdUniqueViolation(insertErr) && attempt < MAX_INSERT_ATTEMPTS - 1) {
          insertQuoteId = await generateNextQuoteId(sb, nextQuoteIdOpts);
          continue;
        }
        if (isQuoteIdUniqueViolation(insertErr)) {
          return NextResponse.json(
            {
              error:
                "Could not assign a unique quote id after several attempts. Another coordinator may be creating a quote at the same time, or HubSpot job numbers are out of sync with OPS. Wait a moment and retry.",
              code: "QUOTE_ID_DUPLICATE",
              detail: insertErr.message,
            },
            { status: 409 },
          );
        }
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      if (!inserted) {
        return NextResponse.json(
          { error: "Quote insert failed", code: "QUOTE_ID_INSERT_FAILED" },
          { status: 500 },
        );
      }
    }
  }

  const expiresAtStr = new Date(Date.now() + expiryDays * 86_400_000).toISOString();

  const marginFieldsForCaller = isSuperAdminEmail(authUser?.email);

  const response: Record<string, unknown> = {
    quote_id: quoteId,
    quoteId,
    preview: isPreview,
    service_type: svcType,
    distance_km: distInfo?.distance_km ?? null,
    drive_time_min: distInfo?.drive_time_min ?? null,
    move_date: input.move_date,
    expires_at: expiresAtStr,
    factors: marginFieldsForCaller ? factors : omitMarginEstimateFields(factors),
    addons: {
      items: addonResult.breakdown,
      total: addonResult.total,
    },
    inventory: {
      modifier: invResult.modifier,
      score: invResult.inventoryScore,
      benchmark: invResult.benchmarkScore,
      totalItems: invResult.totalItems,
      boxCount: (invResult as { boxCount?: number }).boxCount ?? input.client_box_count ?? null,
    },
    inventory_warnings: inventoryWarnings,
    labour: labour ?? null,
    truck: {
      primary: truckResult.primary,
      secondary: truckResult.secondary,
      isMultiVehicle: truckResult.isMultiVehicle,
      notes: truckResult.notes,
      range: truckResult.range,
    },
  };

  if (tiers) {
    response.tiers = tiers;
  } else {
    response.custom_price = custom_price;
    response.deposit_amount = custom_price?.deposit ?? primaryPrice;
  }

  response.valuation = {
    included: INCLUDED_VALUATION,
    upgrades: valuationUpgrades,
    tiers: valTiers ?? [],
  };

  // Margin warning — super-admin only (same gate as estimated_margin* in factors)
  if (marginFieldsForCaller && factors && typeof factors === "object") {
    const f = factors as Record<string, unknown>;
    const estMarginEssential = typeof f.estimated_margin_essential === "number" ? f.estimated_margin_essential : (typeof f.estimated_margin_curated === "number" ? f.estimated_margin_curated : null);
    const estMarginSig = typeof f.estimated_margin_signature === "number" ? f.estimated_margin_signature : null;
    if (estMarginEssential !== null) {
      const cautionTh = cfgNum(config, "margin_warning_threshold", 35);
      const lowTh = cfgNum(config, "margin_low_threshold", 25);
      const critTh = cfgNum(config, "margin_critical_threshold", 15);
      const targetMargin = cfgNum(
        config,
        "margin_target_essential",
        cfgNum(config, "margin_target_curated", 40),
      );
      if (estMarginEssential < cautionTh) {
        const level: "critical" | "warning" | "caution" =
          estMarginEssential < critTh ? "critical" : estMarginEssential < lowTh ? "warning" : "caution";
        const message =
          level === "critical"
            ? `Estimated margin ${estMarginEssential}% is unprofitable (threshold: ${critTh}%). Review pricing before sending.`
            : level === "warning"
              ? `Estimated margin ${estMarginEssential}% is low (below ${lowTh}%). Consider recommending a higher tier.`
              : `Estimated margin ${estMarginEssential}% is below target (${targetMargin}%). Acceptable for volume or strategic moves.`;
        response.margin_warning = {
          level,
          message,
          estimated_margin: estMarginEssential,
          target_margin: targetMargin,
          signature_margin: estMarginSig,
        };
      }
    }
  }

  await logAudit({
    userId: authUser?.id,
    userEmail: authUser?.email,
    action: "quote_status_change",
    resourceType: "quote",
    resourceId: response.quote_id as string | undefined,
    details: { service_type: input.service_type, preview: isPreview, source: "generate" },
  });

  if (!isPreview && !isUpdate) {
    const svcLabel = (input.service_type || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const contactId = input.contact_id;
    await logActivity({
      entity_type: "quote",
      entity_id: String(response.quote_id),
      event_type: "created",
      description: `Quote created: ${svcLabel}${contactId ? "" : ""}, ${String(response.quote_id)}`,
      icon: "quote",
    });
  }

  return NextResponse.json(response);
}
