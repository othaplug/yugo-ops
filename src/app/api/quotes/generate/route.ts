import { NextRequest, NextResponse } from "next/server";
import { TIER_DEFINITIONS } from "@/lib/tiers/tier-definitions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { logAudit } from "@/lib/audit";
import { logActivity } from "@/lib/activity";
import { validateInventoryQuantities } from "@/lib/inventory-quantity-validation";
import {
  catalogMinCrewFromInventorySlugs,
  estimateLabourFromScore,
} from "@/lib/inventory-labour";
import { getDrivingDistance, getMultiStopDrivingDistance, straightLineKmFromGtaCore } from "@/lib/mapbox/driving-distance";
import {
  calculateB2BDimensionalPrice,
  isMoveDateWeekend,
  lineItemsFromQuotePayload,
  stopsFromQuotePayload,
  type B2BDimensionalQuoteInput,
  type B2BPricingExtraLine,
} from "@/lib/pricing/b2b-dimensional";
import {
  estimateOfficeCrew,
  estimateOfficeHours,
  estimateOfficeTruckOpsCost,
  estimateSingleItemHours,
  officeTruckSurchargeStack,
  singleItemPricingCategory,
  singleItemWalkUpSurcharge,
  type OfficeScheduleFlags,
} from "@/lib/pricing/non-residential-quote-calcs";
import { resolveSingleItemLines, type SingleItemLine } from "@/lib/quotes/single-item-types";
import { STORAGE_ADDON_SLUG, storageWeeklyRate, clampStorageWeeks } from "@/lib/quotes/storage-pricing";
import {
  formatTruckBreakdownLine,
  formatTruckResidentialUpgradeLine,
  getTruckFeeSync,
} from "@/lib/pricing/truck-fees";
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
  // estimateFuelCostWithDeadhead is intentionally retained in the import
  // list — other code paths (office_move, single_item, etc.) still use
  // the simpler flat-deadhead estimator. The residential margin path
  // below now uses calcThreeLegFuelCost from three-leg-fuel.ts.
  estimateFuelCostWithDeadhead,
  estimateOperationalSuppliesCost,
  estimateTruckCostPerMove,
  expectedInventoryScoreForMoveSize,
} from "@/lib/pricing/margin-cost-model";
import { calcThreeLegFuelCost } from "@/lib/pricing/three-leg-fuel";
import { evaluateServiceAreaForQuote } from "@/lib/pricing/service-area";
import {
  aggregateAccessSurchargesForLabourValidation,
  aggregateSpecialtySurchargesForLabourValidation,
  resolveLabourValidationCrewHours,
  truckTypeForLabourValidation,
  validateLabourRate,
  type LabourValidationResult,
} from "@/lib/pricing/labour-validation";
import {
  calculateEstateDays,
  estateLoadedLabourCost,
  buildEstateScheduleLines,
  estateScheduleHeadline,
} from "@/lib/quotes/estate-schedule";
import { moveProjectPayloadSchema } from "@/lib/move-projects/schema";
import { upsertMoveProjectForQuote, clearMoveProjectFromQuote } from "@/lib/move-projects/persist";
import { computeMoveProjectPricingPreview, priceFromCostAndMargin } from "@/lib/move-projects/pricing";
import { buildResidentialProjectQuoteBreakdown } from "@/lib/move-projects/residential-project-quote-lines";
import type { ProjectQuoteBreakdown } from "@/lib/move-projects/residential-project-quote-lines";
import { pickupDropoffFactorsFromPayload } from "@/lib/quotes/quote-address-display";
import {
  applyMoveScopeAddonToResidentialTiers,
  buildMoveScopeClientSchedule,
  clampEstimatedDaysOverride,
  computeMoveScopeAddonPreTax,
} from "@/lib/quotes/move-scope";
import {
  generateNextQuoteId,
  getQuoteIdPrefix,
  isQuoteIdUniqueViolation,
  quoteNumericSuffixForHubSpot,
} from "@/lib/quotes/quote-id";
import { patchHubSpotDealJobNo } from "@/lib/hubspot/sync-deal-job-no";
import { getResolvedMoveIncludeTitles } from "@/lib/quotes/residential-tier-quote-display";
import { buildOfficeTierQuote } from "@/lib/quotes/office-quote-from-input";
import { normalizePhone } from "@/lib/phone";
import {
  computeWhiteGlovePricingBreakdown,
  estimateWhiteGloveHours,
  getWhiteGloveClientInclusions,
  normalizeWhiteGloveItemsFromQuoteInput,
  recommendWhiteGloveCrew,
} from "@/lib/quotes/white-glove-pricing";
import { buildingComplexitySurchargePreTax } from "@/lib/buildings/complexity-pricing";
import { matchBuildingProfile } from "@/lib/buildings/matcher";
import { parseBuildingAccessFlags } from "@/lib/buildings/types";

const WG_TRUCK_DISPLAY_LABEL: Record<string, string> = {
  sprinter: "Dedicated Sprinter cargo van",
  "16ft": "16ft climate-controlled box truck",
  "20ft": "20ft dedicated delivery truck",
  "24ft": "24ft delivery truck",
  "26ft": "26ft delivery truck",
};

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
  /** Multi-pickup quote: pickup index (0-based) */
  origin_index?: number;
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
  /** Coordinator time input (legacy / supplemental). */
  preferred_time?: string;
  /** Coordinator arrival window label from quote form (e.g. morning band). */
  arrival_window?: string;
  move_size?: string;
  specialty_items?: { type: string; qty: number }[];
  selected_addons?: AddonSelection[];
  hubspot_deal_id?: string;
  contact_id?: string;
  inventory_items?: InventoryItem[];
  client_box_count?: number;
  /** Residential assembly auto-detection (set by QuoteFormClient when inventory provided). */
  assembly_required?: boolean | null;
  assembly_auto_detected?: boolean;
  assembly_items?: string[];
  assembly_override?: boolean | null;
  assembly_minutes?: number | null;
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
  /** Optional desk/chair/filing counts — workstation count defaults to max(desks, chairs) when unset. */
  office_desks_count?: number;
  office_chairs_count?: number;
  office_filing_cabinets_count?: number;
  /** Explicit server / IT closet (defaults from has_it_equipment). */
  office_server_room?: boolean;
  /** Boardrooms to price (defaults from has_conference_room → 1). */
  office_boardroom_count?: number;
  office_kitchen_break_room?: boolean;
  office_after_hours?: boolean;
  office_weekend?: boolean;
  office_truck_count?: number;
  /** Inventory-driven office quoting (Phase 4+). When present, office returns
   *  3 scope tiers (Essential/Signature/Priority) instead of the legacy
   *  workstation single-price. */
  office_inventory?: { slug: string; quantity: number }[];
  /** Selected-items / partial move — suppresses the $/sqft lower bound. */
  office_partial_move?: boolean;
  /** Estimated square footage actually moving (for the confidence band). */
  office_moving_sqft?: number | null;
  // White glove — standalone engine (optional overrides)
  white_glove_crew_override?: number;
  white_glove_hours_override?: number;
  // Labour only — schedule premiums
  labour_weekend?: boolean;
  labour_after_hours?: boolean;
  /**
   * Operator overrides for residential / long-distance labour estimate.
   * The engine's auto-estimate (estimateLabourFromScore) can be too
   * aggressive in edge cases — e.g. the walk-up-3rd unconditional +1
   * crew bump that pushed YG-30277 from 2 → 3 movers despite a light
   * 1BR inventory. These let a coordinator pin crew / hours / truck
   * to operationally correct values. All optional; engine auto-picks
   * when unset. Stored in factors_applied.operator_overrides for audit.
   */
  crew_size_override?: number;
  est_hours_override?: number;
  truck_size_override?: string;
  /** Pre-tax price override (all service types except bin_rental); requires `quote_price_override_reason`. */
  quote_price_override?: number;
  quote_price_override_reason?: string;
  /**
   * Per-tier override map (residential local_move + long_distance only).
   * Targets one or more tiers independently — unlike `quote_price_override`
   * which scales all three tiers proportionally. Each entry replaces that
   * tier's natural engine price; tax / total / deposit are recomputed
   * from the override.
   *   { estate: { price: 6000, reason: "competitive match" } }
   * Per-tier overrides apply BEFORE the global override (so admin can use
   * both: e.g. discount Estate to a flat number, then proportionally
   * scale the rest).
   */
  tier_price_overrides?: Partial<
    Record<
      "essential" | "signature" | "estate",
      { price?: number; reason?: string }
    >
  >;
  /**
   * R2: Structured override reason code from a controlled taxonomy
   * (competitive_match | partner_acquisition | multi_job_discount |
   *  scope_overstated | goodwill | other). Stored alongside the existing
   * free-text override_reason so analytics can regress benchmarks.
   */
  quote_price_override_reason_code?: string;
  /**
   * Client-facing presentation mode. Only meaningful when
   * recommended_tier === 'estate' on residential / long-distance.
   *   comparison       (default) — all three tiers shown
   *   estate_featured  — all three shown, Estate visually dominant
   *   estate_only      — single-tier Estate render
   * Unknown values silently fall back to 'comparison' at persistence.
   */
  presentation_mode?: "comparison" | "estate_featured" | "estate_only";
  /**
   * R2: Consignee separation. When the quote's billing contact is
   * different from the end recipient (B2B drop-ship), these fields carry
   * the deliver-to party. Left undefined for same-as-bill-to quotes.
   */
  deliver_to_name?: string;
  deliver_to_email?: string;
  deliver_to_phone?: string;
  deliver_to_notes?: string;
  /**
   * R2: Inbound shipment foreign key. Set when the quote scope is
   * "receive at warehouse + deliver" (Fritz Hansen pattern). Links the
   * quote to the inbound_shipments row that tracks carrier/waybill/ETA.
   */
  inbound_shipment_id?: string;
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
  /**
   * Multi-item array for single_item quotes. When present and non-empty,
   * the pricing engine reads from this instead of the scalars above. See
   * src/lib/quotes/single-item-types.ts for the schema. Up to 8 lines.
   */
  quote_items?: Array<{
    id?: string;
    item_description?: string;
    item_category?: string;
    weight_class?: string;
    assembly?: string;
    stair_carry?: boolean;
    stair_flights?: number;
    quantity?: number;
  }>;
  // Junk-removal stop — captured when addons includes junk_removal.
  junk_pickup_from?: "origin" | "destination" | "both";
  /** Internal-only items list. Helps coordinator size the truck tier. */
  junk_items_description?: string;
  /** Approximate item count being hauled (single_item flat-formula pricing). */
  junk_items_count?: number;
  // White glove
  declared_value?: number;
  white_glove_kind?: "delivery" | "service";
  /** Multi-line curated delivery items (preferred). Legacy single-line fields remain as fallback. */
  white_glove_items?: Array<{
    id?: string;
    description: string;
    quantity?: number;
    category?: string;
    weight_class?: string;
    assembly?: string;
    is_fragile?: boolean;
    is_high_value?: boolean;
    notes?: string;
    slug?: string;
    is_custom?: boolean;
  }>;
  white_glove_debris_removal?: boolean;
  /** When set (e.g. 2, 3, 4), adds guaranteed narrow-window line per platform_config. */
  white_glove_guaranteed_window_hours?: number | null;
  white_glove_building_requirements_note?: string;
  white_glove_delivery_instructions?: string;
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
  event_return_rate_preset?: EventReturnRatePreset;
  event_return_rate_custom?: number;
  event_additional_services?: string[];
  event_items?: EventQuoteItemInput[];
  /** When "multi", use event_legs (≥2) for bundled round-trips; single-leg fields mirror first leg for DB compatibility */
  event_mode?: "single" | "multi";
  event_legs?: EventLegInput[];
  event_is_luxury?: boolean;
  /** Event default sprinter; other types use coordinator override */
  event_truck_type?: string;
  /** Coordinator override — billable crew count for labour line. */
  event_crew_override?: number;
  /** Coordinator override — billable hours (system still estimates for display when unset). */
  event_hours_override?: number;
  /** Replaces final pre-tax total after engine + add-ons + crating. Requires `event_pre_tax_override_reason`. */
  event_pre_tax_override?: number;
  event_pre_tax_override_reason?: string;
  // Labour Only
  labour_crew_size?: number;
  labour_hours?: number;
  labour_truck_required?: boolean;
  labour_visits?: number;
  labour_second_visit_date?: string;
  labour_description?: string;
  labour_storage_needed?: boolean;
  labour_storage_weeks?: number;
  /** Job category for ops context and client display (e.g. assembly, rearrange, debris_removal). */
  labour_job_category?: string;
  /** Scope complexity — affects price. standard | moderate | complex */
  labour_complexity?: "standard" | "moderate" | "complex";
  /** Item weight class — affects price. standard | heavy | very_heavy */
  labour_weight_class?: "standard" | "heavy" | "very_heavy";
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
  /** Provenance (e.g. widget lead conversion) */
  quote_source?: string;
  source_request_id?: string | null;
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
  /** Coordinator owning this quote (free-text). Stored in
   *  factors_applied.coordinator_name and copied to moves.coordinator_name
   *  when the move is created from the quote. Surfaced on the client
   *  tracking page so the client knows who to call. */
  coordinator_name?: string;
  /** Multi-day move project planner payload (validated with moveProjectPayloadSchema). */
  move_project?: unknown;
  /** When true, detach and delete linked move_projects row for this quote. */
  clear_move_project?: boolean;
  /** Optional coordinator override for quotes.estimated_days (local_move scope flow). */
  move_scope?: {
    estimated_days_override?: number | null;
    optional_additional_volume_day?: boolean;
  };
  /** Mapbox geocode (primary stop) for building profile proximity match */
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  /** When no DB profile, coordinator-reported access flags (origin / destination) */
  origin_building_access_flags?: string[];
  destination_building_access_flags?: string[];
  /** Multi-scenario: when true, scenarios[] below are saved and the client picks one */
  is_multi_scenario?: boolean;
  scenarios?: QuoteScenarioInput[];
}

/** One scheduling/pricing scenario for multi-scenario quotes. */
export interface QuoteScenarioInput {
  scenario_number: number;
  label?: string;
  description?: string;
  is_recommended?: boolean;
  scenario_date?: string;
  scenario_time?: string;
  /** Pre-tax price (optional — falls back to quote base price when omitted) */
  price?: number | null;
  conditions_note?: string;
}

/** Payload line for event inventory (admin quote form + generate API). */
export type EventQuoteItemInput = {
  name: string;
  quantity: number;
  weight_category?: string;
  actual_weight_lbs?: number;
  /** Drives handling time and optional wrapping surcharge when true. */
  item_type?: string;
  requires_wrapping?: boolean;
  requires_protection?: boolean;
  notes?: string;
};

export type EventReturnRatePreset = "auto" | "60" | "65" | "80" | "85" | "100" | "custom";

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
  /** Items repositioned within venue — no transit, no truck surcharge; auto return rate uses same-venue default */
  event_same_location_onsite?: boolean;
  event_leg_truck_type?: string;
  event_return_rate_preset?: EventReturnRatePreset;
  event_return_rate_custom?: number;
  event_items?: EventQuoteItemInput[];
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

// Hard truck + crew minimums live in the shared library so the engine,
// the Estate schedule generator, the client display, and the admin
// override form all agree on a single source of truth. See
// /src/lib/quotes/crew-and-truck-minimums.ts for the operator audit
// rationale (Sprinter near-miss on a 3BR; 4-mover requirement on 3BR+).
//
// floorTruckByMoveSize is re-exported under the same name to keep
// existing call sites working — internally it now delegates to the
// shared lib, which carries the updated 3BR=24ft minimum (was 20ft).
import {
  floorTruckByMoveSize as floorTruckByMoveSizeShared,
  type TruckKey as SharedTruckKey,
} from "@/lib/quotes/crew-and-truck-minimums";

export function floorTruckByMoveSize(
  truck: TruckKey | null | undefined,
  moveSize: string | null | undefined,
): TruckKey {
  return floorTruckByMoveSizeShared(
    truck as SharedTruckKey | null | undefined,
    moveSize,
  ) as TruckKey;
}

/**
 * Align with inventory-labour truck tiers so surcharge matches crew estimate.
 * Floored by move size so a sparse-inventory 3BR can't be sold a Sprinter
 * (or anything smaller than a 24ft).
 */
function recommendedTruckFromInventoryScore(
  score: number,
  moveSize?: string | null,
): TruckKey {
  // Thresholds shifted 2026-06-11 to favour the owned Sprinter on
  // light jobs (operator preference: run the asset we already own).
  // Sprinter cargo: ~400 cu ft, comfortably handles studios, most
  // 1BRs, and light 2BRs (≤ score 25). Heavier loads still upgrade
  // through 16ft / 20ft / 24ft / 26ft. Floor by move size kicks in
  // for 3BR+ which always needs a real truck.
  let pick: TruckKey;
  if (score <= 25) pick = "sprinter";
  else if (score <= 45) pick = "16ft";
  else if (score <= 65) pick = "20ft";
  else if (score <= 85) pick = "24ft";
  else pick = "26ft";
  return floorTruckByMoveSize(pick, moveSize);
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

/** Residential: add fee difference when inventory recommends a larger truck than the tier default. */
function residentialTruckFeeUpgrade(
  config: Map<string, string>,
  moveSize: string | undefined,
  recommended: TruckKey,
): number {
  if (recommended === "none") return 0;
  const ms = moveSize ?? "2br";
  const baseTruck = BASE_TRUCK_FOR_MOVE_SIZE[ms] ?? "16ft";
  const feeRec = getTruckFeeSync(recommended, config);
  const feeBase = getTruckFeeSync(baseTruck, config);
  return Math.max(0, feeRec - feeBase);
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
  const diffDefault = cfgNum(config, "event_default_return_rate_different", cfgNum(config, "event_return_discount", 0.6));
  const sameVenueDefault = cfgNum(config, "event_default_return_rate_same_venue", 0.8);
  const preset = leg.event_return_rate_preset ?? "auto";
  if (preset === "custom" && leg.event_return_rate_custom != null) {
    const p = Number(leg.event_return_rate_custom);
    if (Number.isFinite(p) && p >= 0 && p <= 100) return p / 100;
  }
  if (preset === "100") return 1;
  if (preset === "80" || preset === "85") return sameVenueDefault;
  if (preset === "60" || preset === "65") return diffDefault;
  // auto
  if (leg.event_same_location_onsite) return sameVenueDefault;
  return diffDefault;
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
  moveDate?: string | null,
): Promise<number> {
  // Universal short-notice rule (2026-06-11): bookings less than 4 days
  // from the move date pay the full amount up front, regardless of the
  // deposit_rules table. Operator policy: 48-hour-before-move balance
  // collection window can't be honoured if we book inside it.
  if (moveDate) {
    const target = new Date(`${String(moveDate).trim().slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(target.getTime())) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysOut = Math.floor(
        (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysOut < 4) return Math.round(amount);
    }
  }

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
  moveSize?: string | null,
  serviceType?: string | null,
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
        // Secure storage is billed per week at a size-based rate; quantity is
        // the number of weeks (clamped 1–STORAGE_MAX_WEEKS). The DB price is a
        // placeholder — storageWeeklyRate(moveSize) is the source of truth.
        if ((addon.slug as string) === STORAGE_ADDON_SLUG) {
          cost = storageWeeklyRate(moveSize, serviceType) * clampStorageWeeks(qty);
        } else {
          cost = (addon.price as number) * qty;
        }
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
  /** When explicitly false, suppress "Basic disassembly & reassembly" from the includes list. */
  assemblyRequired?: boolean | null,
): Promise<{ essential: string[]; signature: string[]; estate: string[] }> {
  const truckLabel = DEFAULT_TRUCK_BY_SIZE[moveSize ?? "2br"] ?? "Dedicated moving truck";

  const [dbEss, dbSig, dbEst] = await Promise.all([
    fetchTierFeatures(sb, "local_move", "essential"),
    fetchTierFeatures(sb, "local_move", "signature"),
    fetchTierFeatures(sb, "local_move", "estate"),
  ]);

  const crewLine = `Professional crew of ${minCrew}`;
  const ASSEMBLY_PATTERN = /(disassembly\s*(&|and)?\s*reassembly|basic\s+disassembly)/i;
  const hydrate = (list: string[]) => {
    const filtered = assemblyRequired === false ? list.filter((f) => !ASSEMBLY_PATTERN.test(f)) : list;
    return filtered.map((f) => {
      if (f === "Dedicated moving truck") return truckLabel;
      if (f === "Professional movers" || f.toLowerCase().includes("professional crew of")) return crewLine;
      return f;
    });
  };

  if (dbEss.length > 0) {
    const essential = hydrate(dbEss);
    const signature =
      dbSig.length > 0
        ? hydrate(dbSig)
        : getResolvedMoveIncludeTitles("signature", truckLabel, crewLine, assemblyRequired);
    const estate =
      dbEst.length > 0
        ? hydrate(dbEst)
        : getResolvedMoveIncludeTitles("estate", truckLabel, crewLine, assemblyRequired);
    return { essential, signature, estate };
  }

  return {
    essential: getResolvedMoveIncludeTitles("essential", truckLabel, crewLine, assemblyRequired),
    signature: getResolvedMoveIncludeTitles("signature", truckLabel, crewLine, assemblyRequired),
    estate: getResolvedMoveIncludeTitles("estate", truckLabel, crewLine, assemblyRequired),
  };
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
  "pillows-bedding-linens-small": "pillows-set",
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
  /** Labour estimate with assembly minutes zeroed — used to compute Essential tier price (assembly is an add-on). */
  labourNoAssembly: LabourEstimate,
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
  // Coordinator override (input.truck_type) wins — but ONLY after flooring
  // by move size. Without the floor, a coordinator setting truck_type to
  // "sprinter" on a 3BR Estate would silently undersize the truck and
  // mis-price the job. Floor protects against operator mistakes as well
  // as the score-based recommender.
  const recTruck = input.truck_type
    ? floorTruckByMoveSize(normalizeTruckType(input.truck_type), input.move_size)
    : recommendedTruckFromInventoryScore(truckSizingScore, input.move_size);
  const truckSur = residentialTruckFeeUpgrade(config, input.move_size, recTruck);

  const estateDayPlan = calculateEstateDays(input.move_size ?? "2br", invResult.inventoryScore);
  const loadedRateForEstateSchedule = crewLoadedHourlyRate(config);
  const ESTATE_SCHEDULE_TRUCK_LABELS: Record<string, string> = {
    sprinter: "Extended Sprinter van",
    "16ft": "16ft fully equipped truck",
    "20ft": "20ft dedicated moving truck",
    "24ft": "24ft full-size moving truck",
    "26ft": "26ft maximum-capacity truck",
    none: "dedicated moving truck",
  };
  const estateScheduleTruckLabel =
    ESTATE_SCHEDULE_TRUCK_LABELS[normalizeTruckType(recTruck)] ?? "dedicated moving truck";

  const deadheadFreeKm = cfgNum(config, "deadhead_free_zone_km", cfgNum(config, "deadhead_free_km", 40));
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

  const originBf = parseBuildingAccessFlags(input.origin_building_access_flags);
  const destBf = parseBuildingAccessFlags(input.destination_building_access_flags);
  const [fromBuilding, toBuilding] = await Promise.all([
    matchBuildingProfile(sb, input.from_address, input.from_lat ?? null, input.from_lng ?? null),
    matchBuildingProfile(sb, input.to_address, input.to_lat ?? null, input.to_lng ?? null),
  ]);
  const bMargin = cfgNum(config, "building_complexity_margin_multiplier", 1.45);
  const bRound = cfgNum(config, "rounding_nearest", 50);
  const loadedForBuilding = crewLoadedHourlyRate(config);
  const invScore = invResult.inventoryScore;

  let buildingComplexityCharge = 0;
  const buildingComplexityFlags: string[] = [];
  let buildingLoadingExtraMin = 0;
  let buildingUnloadingExtraMin = 0;

  if (fromBuilding?.id && toBuilding?.id && fromBuilding.id === toBuilding.id) {
    const c = buildingComplexitySurchargePreTax({
      building: fromBuilding,
      inventoryScore: invScore,
      crewLoadedHourlyRate: loadedForBuilding,
      marginMultiplier: bMargin,
      roundingNearest: bRound,
    });
    buildingComplexityCharge = c.charge;
    buildingComplexityFlags.push(...c.flags);
    buildingLoadingExtraMin = c.loadingExtraMinutes;
    buildingUnloadingExtraMin = c.unloadingExtraMinutes;
  } else {
    const cFrom = buildingComplexitySurchargePreTax({
      building: fromBuilding,
      syntheticFlags: fromBuilding ? undefined : originBf,
      inventoryScore: invScore,
      crewLoadedHourlyRate: loadedForBuilding,
      marginMultiplier: bMargin,
      roundingNearest: bRound,
    });
    const cTo = buildingComplexitySurchargePreTax({
      building: toBuilding,
      syntheticFlags: toBuilding ? undefined : destBf,
      inventoryScore: invScore,
      crewLoadedHourlyRate: loadedForBuilding,
      marginMultiplier: bMargin,
      roundingNearest: bRound,
    });
    buildingComplexityCharge = cFrom.charge + cTo.charge;
    buildingComplexityFlags.push(...cFrom.flags, ...cTo.flags);
    buildingLoadingExtraMin = cFrom.loadingExtraMinutes;
    buildingUnloadingExtraMin = cTo.unloadingExtraMinutes;
  }

  // Multi-pickup premium: each additional pickup beyond the first adds a flat
  // surcharge. Reflects the real logistics cost of staging the truck at
  // multiple origins (extra drive time, loading sequencing, coordination
  // overhead). Previously zero — a 2-origin move priced identically to a
  // 1-origin move of the same size. Config: `multi_pickup_premium`, default
  // $400/extra-pickup. Mirrors the `multi_origin_premium` pattern used by
  // project quotes (residential-project-quote-lines.ts).
  const extraPickupCount = Math.max(
    0,
    (input.additional_pickup_addresses ?? []).filter(
      (a) => String(a.address ?? "").trim().length > 0,
    ).length,
  );
  const multiPickupPremium =
    extraPickupCount > 0
      ? extraPickupCount * cfgNum(config, "multi_pickup_premium", 400)
      : 0;

  const surchargesTotal =
    accessSurcharge +
    specialtySurcharge +
    plc.total +
    truckSur +
    deadheadSurcharge +
    mobilizationFee +
    buildingComplexityCharge +
    multiPickupPremium;
  operationalPrice += surchargesTotal;

  pd("Step 4 — fixed surcharges (additive):", {
    access_from: fromAccess,
    access_to: toAccess,
    access_total: accessSurcharge,
    specialtySurcharge,
    building_complexity_surcharge: buildingComplexityCharge,
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
    extra_pickup_count: extraPickupCount,
    multi_pickup_premium: multiPickupPremium,
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
  // Defaults bumped 2026-06-11 to luxury positioning (Essential 65 / Signature
  // 80 / Estate 95). Each tier's per-mover-hour gross margin now lands at or
  // above the corresponding true-margin floor (55/62/70). See migration
  // 20260611000000_labour_rate_luxury_calibration.sql for the rationale.
  const labourRates = {
    essential: cfgNum(config, "labour_rate_essential", cfgNum(config, "labour_rate_curated", cfgNum(config, "labour_rate_per_mover_hour", 65))),
    signature: cfgNum(config, "labour_rate_signature", cfgNum(config, "labour_rate_per_mover_hour", 80)),
    estate:    cfgNum(config, "labour_rate_estate",    cfgNum(config, "labour_rate_per_mover_hour", 95)),
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

      // Signature + Estate: full hours including assembly
      const effectiveHours = Math.max(labour.estimatedHours, effectiveMinHours);
      const actualManHours = labour.crewSize * effectiveHours;
      const extraManHoursRaw = Math.max(0, actualManHours - baselineManHours);

      // Essential: assembly NOT included — use no-assembly labour for the delta
      const essentialLabour = labourNoAssembly ?? labour;
      const effectiveHoursEssential = Math.max(essentialLabour?.estimatedHours ?? labour.estimatedHours, effectiveMinHours);
      const actualManHoursEssential = (essentialLabour?.crewSize ?? labour.crewSize) * effectiveHoursEssential;
      const extraManHoursEssential = Math.max(0, actualManHoursEssential - baselineManHours);

      // ── Labour delta sanity guard ──────────────────────────────────────────
      // Don't add a delta if the (pre-delta) effective hourly rate is already at or
      // above the labour floor. This prevents the delta from firing on healthy quotes
      // just because the crew*hours exceeds a baseline by a fraction of an hour.
      const labourFloorEssential = cfgNum(
        config,
        "labour_rate_floor_essential",
        cfgNum(config, "labour_rate_floor", 50),
      );
      const preDeltaEffectiveRate =
        actualManHours > 0 ? marketAdjustedPrice / actualManHours : 0;
      const rateAlreadyAboveFloor = preDeltaEffectiveRate >= labourFloorEssential;

      // Cap the delta at 1 man-hour of labour. If we would add more than that, it
      // means the base rate is misconfigured for this size — surface a warning
      // and suppress the surcharge rather than silently ballooning the price.
      const maxExtraManHours = 1;
      const cappedExtraManHoursEssential = rateAlreadyAboveFloor
        ? 0
        : Math.min(extraManHoursEssential, maxExtraManHours);
      const cappedExtraManHours = rateAlreadyAboveFloor
        ? 0
        : Math.min(extraManHoursRaw, maxExtraManHours);

      // Essential uses no-assembly hours; Signature/Estate use full hours with assembly
      tieredLabourDelta.essential = Math.round(cappedExtraManHoursEssential * labourRates.essential);
      tieredLabourDelta.signature = Math.round(cappedExtraManHours * labourRates.signature);
      tieredLabourDelta.estate    = Math.round(cappedExtraManHours * labourRates.estate);

      // Legacy single delta (essential rate) for backward-compatible breakdown display
      labourDelta = tieredLabourDelta.essential;

      pd("Step 6.5 — labour delta sanity guard:", {
        marketAdjustedPrice,
        actualManHours,
        actualManHoursEssential,
        preDeltaEffectiveRate: Math.round(preDeltaEffectiveRate * 100) / 100,
        labourFloorEssential,
        rateAlreadyAboveFloor,
        extraManHoursRaw,
        extraManHoursEssential,
        cappedExtraManHours,
        cappedExtraManHoursEssential,
        suppressed: rateAlreadyAboveFloor || extraManHoursRaw > maxExtraManHours,
      });

      pd("Step 6 — labour vs benchmark:", {
        labour_crew: labour.crewSize,
        labour_estimated_hours: labour.estimatedHours,
        essential_estimated_hours: essentialLabour?.estimatedHours ?? labour.estimatedHours,
        benchmark_crew: bm.baseline_crew,
        benchmark_hours: bm.baseline_hours,
        baseline_man_hours: baselineManHours,
        min_hours_floor: minHoursFloor,
        effective_min_hours: effectiveMinHours,
        effective_hours_used: effectiveHours,
        effective_hours_essential: effectiveHoursEssential,
        actual_man_hours: actualManHours,
        extra_man_hours: extraManHoursRaw,
        capped_extra_man_hours: cappedExtraManHours,
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
  // Support both old and new config key names during transition.
  // Code-level fallbacks come from TIER_DEFINITIONS so they stay in sync with the canonical definition.
  // The live value is always platform_config (admin-editable via Pricing Settings).
  const curatedMult = cfgNum(config, "tier_essential_multiplier",
    cfgNum(config, "tier_curated_multiplier",
    cfgNum(config, "tier_essentials_multiplier", TIER_DEFINITIONS.essential.pricing.multiplier)));
  const signatureMultBase = cfgNum(config, "tier_signature_multiplier",
    cfgNum(config, "tier_premier_multiplier", TIER_DEFINITIONS.signature.pricing.multiplier));
  const estateMult = cfgNum(config, "tier_estate_multiplier", TIER_DEFINITIONS.estate.pricing.multiplier);

  /**
   * Size-adjusted Signature multiplier.
   *
   * The flat platform_config Signature multiplier (currently 1.52×)
   * produces an effective labour rate above the market ceiling on
   * small moves (studio / 1br) — the engine then flags its own quote
   * as "above_ceiling", embarrassingly visible to operators. Scale
   * the multiplier down for small jobs so the Signature card stays
   * inside the competitive band. The configured value is treated as
   * the 3BR baseline; smaller sizes proportionally reduce. Capped at
   * the configured value so we never silently inflate.
   *
   * Tightened 2026-06 after YG-30281 (1BR) flagged Signature
   * effective rate $110/hr — above ceiling. 1BR factor pulled from
   * 0.90 → 0.80 so a 1BR Signature lands ~×1.22 instead of ~×1.37
   * over Essential. Studio similar.
   */
  const SIGNATURE_SIZE_FACTOR: Record<string, number> = {
    studio: 0.78,
    "1br": 0.80,
    "2br": 0.92,
    "3br": 1.0,      // baseline
    "4br": 1.03,
    "5br_plus": 1.07,
    partial: 0.80,
  };
  /**
   * Size-adjusted Estate multiplier.
   *
   * Mirrors SIGNATURE_SIZE_FACTOR. The platform_config Estate
   * multiplier (currently 3.35×) is calibrated for 3BR+ Estate moves
   * — pack day + move day + unpack day, full white-glove crew, an
   * Estate-tier truck. Applying that same flat multiplier to a 1BR
   * with score 15.6 produces a $3,300 quote on a $288 cost basis
   * (89% margin), which both reads as predatory to the operator AND
   * is operationally indefensible — a 1BR Estate move doesn't
   * actually consume Estate-grade resources.
   *
   * Scale Estate down hard for small sizes so the tier card reads as
   * a sensible upgrade from Signature rather than an obvious overcharge.
   * 3BR remains baseline (no change for the segment Estate was
   * designed for).
   */
  const ESTATE_SIZE_FACTOR: Record<string, number> = {
    studio: 0.55,
    "1br": 0.62,
    "2br": 0.80,
    "3br": 1.0,      // baseline (×3.35)
    "4br": 1.04,
    "5br_plus": 1.08,
    partial: 0.62,
  };
  const sizeKey = (input.move_size || "2br").toLowerCase().trim();
  const signatureMult = signatureMultBase * (SIGNATURE_SIZE_FACTOR[sizeKey] ?? 1.0);
  const estateMultScaled = estateMult * (ESTATE_SIZE_FACTOR[sizeKey] ?? 1.0);
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);

  // Step 5: TIER MULTIPLIERS applied to market-adjusted price
  // Step 6: TIERED LABOUR DELTA added after (so premium tiers pay more for overages)
  // Both Signature and Estate use the size-scaled multiplier so small
  // moves get a sensible upgrade ladder; 3BR is the baseline where
  // the platform_config value lands exactly.
  let curBase = roundTo(subtotal * curatedMult, rounding) + tieredLabourDelta.essential;
  let sigBase = roundTo(subtotal * signatureMult, rounding) + tieredLabourDelta.signature;
  let estBase =
    roundTo(subtotal * estateMultScaled, rounding) +
    tieredLabourDelta.estate +
    estateMultiDayLabourUplift;

  pd("Step 7 — tier multipliers & rounding (config):", {
    tier_essential_multiplier: curatedMult,
    tier_signature_multiplier: signatureMult,
    tier_signature_size_factor: SIGNATURE_SIZE_FACTOR[sizeKey] ?? 1.0,
    tier_estate_multiplier_base: estateMult,
    tier_estate_multiplier_scaled: estateMultScaled,
    tier_estate_size_factor: ESTATE_SIZE_FACTOR[sizeKey] ?? 1.0,
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

  // Effective assembly: explicit override beats auto-detected value
  const effectiveAssemblyRequired =
    input.assembly_override !== undefined && input.assembly_override !== null
      ? input.assembly_override
      : input.assembly_required ?? null;
  const inc = await residentialIncludes(
    sb,
    minCrew,
    estHours,
    input.move_size,
    effectiveAssemblyRequired,
  );

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
  // Three-leg fuel: office→pickup deadhead + loaded job route + dropoff→office
  // deadhead. Falls back to a 1.5× multiplier when coordinates aren't passed
  // through. See src/lib/pricing/three-leg-fuel.ts. The old single-leg +
  // flat 15km estimator (estimateFuelCostWithDeadhead) undercounted any
  // out-of-town job — e.g. Stouffville quotes were priced for 11.7km of
  // fuel when actual driving was ~120km round-trip.
  const fuelBreakdown = calcThreeLegFuelCost({
    pickupLat: input.from_lat,
    pickupLng: input.from_lng,
    dropoffLat: input.to_lat,
    dropoffLng: input.to_lng,
    jobRouteKm: distKm,
    truckType: recTruck,
    config,
  });
  const estFuelCost = fuelBreakdown.total;
  const estSuppliesCost = estimateOperationalSuppliesCost(input.inventory_items ?? []);
  const estTotalCost = estLabourCost + estTruckCost + estFuelCost + estSuppliesCost;
  const estTotalCostEstateOps = estTotalCost - estLabourCost + estateLoadedMultiDayCost;
  const estMarginPct  = curPrice > 0 ? Math.round(((curPrice - estTotalCost) / curPrice) * 100) : 0;
  const estSigMarginPct  = sigPrice > 0 ? Math.round(((sigPrice - estTotalCost) / sigPrice) * 100) : 0;
  const estEstMarginPct  = estPrice > 0 ? Math.round(((estPrice - estTotalCostEstateOps) / estPrice) * 100) : 0;

  // ─── Overhead allocation (true contribution margin) ─────────────────
  // Per-day model: monthly overhead ÷ working days = daily burn. At quote
  // time we assume worst case (1 job/day) so the operator sees the
  // floor margin. If multiple jobs run that day, actual will be higher.
  //
  // For Essential / Signature this is 1 × daily_burn (single-day local moves
  // are the dominant case). For Estate, the existing day-plan provides the
  // multi-day count which is multiplied through.
  //
  // Claims reserve is revenue-scaled per industry default (0.5%).
  //
  // Single source of truth is the Monthly Overhead UI at /admin/finance/
  // profitability — read via getMonthlyOverhead/getDailyOverheadBurn which
  // share key names. See src/lib/finance/calculateProfit.ts.
  const monthlyOhStandard =
    cfgNum(config, "monthly_software_cost", 250) +
    cfgNum(config, "monthly_auto_insurance", 1000) +
    cfgNum(config, "monthly_gl_insurance", 300) +
    cfgNum(config, "monthly_wsib", 0) +
    cfgNum(config, "monthly_movers_liability", 0) +
    cfgNum(config, "monthly_marketing_budget", 1000) +
    cfgNum(config, "monthly_office_admin", 350) +
    cfgNum(config, "monthly_bookkeeping", 0) +
    cfgNum(config, "monthly_phone_internet", 0) +
    cfgNum(config, "monthly_vehicle_maintenance", 0) +
    cfgNum(config, "monthly_owner_draw", 0);
  let monthlyOhCustom = 0;
  try {
    const customRaw = config.get("custom_overhead_items") ?? "[]";
    const items = JSON.parse(customRaw) as { amount?: number }[];
    monthlyOhCustom = items.reduce((s, i) => s + (Number(i?.amount) || 0), 0);
  } catch { /* ignore malformed JSON */ }
  const monthlyOverhead = monthlyOhStandard + monthlyOhCustom;
  const ohWorkingDays = Math.max(1, cfgNum(config, "truck_working_days_per_month", 22));
  const dailyBurnOh = monthlyOverhead / ohWorkingDays;
  // Estate spans multiple days; Essential / Signature assumed 1 unless the
  // quote was explicitly multi-day via the scope picker (estate_day_plan).
  const ohDaysEssSig = 1;
  const ohDaysEstate = Math.max(1, estateDayPlan.days || 1);
  const ohShareEssential = Math.round(dailyBurnOh * ohDaysEssSig);
  const ohShareSignature = Math.round(dailyBurnOh * ohDaysEssSig);
  const ohShareEstate = Math.round(dailyBurnOh * ohDaysEstate);
  const claimsReservePct = cfgNum(config, "overhead_claims_reserve_pct", 0.005);
  const claimsReserveEss = Math.round(curPrice * claimsReservePct);
  const claimsReserveSig = Math.round(sigPrice * claimsReservePct);
  const claimsReserveEst = Math.round(estPrice * claimsReservePct);
  // True contribution = price − direct cost − overhead share − claims reserve.
  // Per-tier — each uses its own price and the appropriate OH-day count.
  const trueCostEssential = estTotalCost + ohShareEssential + claimsReserveEss;
  const trueCostSignature = estTotalCost + ohShareSignature + claimsReserveSig;
  const trueCostEstate = estTotalCostEstateOps + ohShareEstate + claimsReserveEst;
  const trueMarginEssential = curPrice > 0
    ? Math.round(((curPrice - trueCostEssential) / curPrice) * 100)
    : 0;
  const trueMarginSignature = sigPrice > 0
    ? Math.round(((sigPrice - trueCostSignature) / sigPrice) * 100)
    : 0;
  const trueMarginEstate = estPrice > 0
    ? Math.round(((estPrice - trueCostEstate) / estPrice) * 100)
    : 0;

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
      // Sub-breakdown of where the date_multiplier came from so the
      // operator (and the client-facing breakdown) can explain WHY
      // a Sunday move costs more. Without this, the form just shows
      // "Date factor: 1.155" with no context — operators on YG-30277
      // asked where the Sunday premium went because the multiplier
      // was being silently applied without a labelled line item.
      date_multiplier_factors:
        (dateMult as { factors?: Record<string, number> }).factors ?? null,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
      access_surcharge: accessSurcharge,
      specialty_surcharge: specialtySurcharge,
      multi_pickup_premium: multiPickupPremium,
      multi_pickup_count: extraPickupCount,
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
      // Engine version that produced this quote's hours. When a quote is
      // re-opened after a formula recalibration, the admin form can
      // surface "this quote's hours are stale, re-generate to refresh".
      // See LABOUR_CALIBRATION_VERSION in src/lib/inventory-labour.ts.
      labour_calibration_version:
        (labour as { calibrationVersion?: number } | null | undefined)
          ?.calibrationVersion ?? null,
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
      truck_breakdown_line: formatTruckResidentialUpgradeLine(recTruck, truckSur),
      packing_supplies_included: estateSuppliesAllowance,
      crating_total: cratingTotal,
      crating_pieces_count: input.crating_pieces?.length ?? 0,
      // Assembly auto-detection — surfaced in coordinator preview
      assembly_required:
        input.assembly_override !== undefined && input.assembly_override !== null
          ? input.assembly_override
          : input.assembly_required ?? null,
      assembly_auto_detected: input.assembly_auto_detected ?? false,
      assembly_minutes: input.assembly_minutes ?? 0,
      assembly_items_count: Array.isArray(input.assembly_items) ? input.assembly_items.length : 0,
      assembly_override:
        input.assembly_override !== undefined ? input.assembly_override : null,
      // Essential tier: assembly is an add-on, not included. Flag for admin preview warning.
      essential_assembly_addon_required:
        !TIER_DEFINITIONS.essential.ops.includesAssembly &&
        (input.assembly_override === true ||
          (input.assembly_override !== false && input.assembly_required === true)) &&
        (input.assembly_minutes ?? 0) > 0,
      // Estimated cost / margin (admin only — not shown to clients)
      estimated_cost: {
        labour: estLabourCost,
        estate_loaded_labour_multi_day: estateLoadedMultiDayCost,
        truck: estTruckCost,
        fuel: estFuelCost,
        supplies: estSuppliesCost,
        total: estTotalCost,
        total_estate_ops: estTotalCostEstateOps,
        // Overhead allocation — per-day model, worst-case 1 job/day.
        // True margin reflects what's left after the company's daily burn
        // and damage-claims reserve are subtracted. Operator-facing only.
        monthly_overhead: Math.round(monthlyOverhead),
        oh_daily_burn: Math.round(dailyBurnOh * 100) / 100,
        oh_working_days: ohWorkingDays,
        oh_share_essential: ohShareEssential,
        oh_share_signature: ohShareSignature,
        oh_share_estate: ohShareEstate,
        oh_days_estate: ohDaysEstate,
        claims_reserve_pct: claimsReservePct,
        claims_reserve_essential: claimsReserveEss,
        claims_reserve_signature: claimsReserveSig,
        claims_reserve_estate: claimsReserveEst,
        true_cost_essential: trueCostEssential,
        true_cost_signature: trueCostSignature,
        true_cost_estate: trueCostEstate,
        // Three-leg fuel detail — let the admin margin card expand to
        // show why the fuel cost is what it is. See three-leg-fuel.ts.
        fuel_breakdown: {
          deadhead_out_km: fuelBreakdown.deadheadOutKm,
          deadhead_out_cost: fuelBreakdown.deadheadOutCost,
          job_route_km: fuelBreakdown.jobRouteKm,
          job_route_cost: fuelBreakdown.jobRouteCost,
          deadhead_return_km: fuelBreakdown.deadheadReturnKm,
          deadhead_return_cost: fuelBreakdown.deadheadReturnCost,
          precise: fuelBreakdown.precise,
        },
      },
      estate_day_plan: {
        days: estateDayPlan.days,
        pack_crew: estateDayPlan.packDay?.crew ?? null,
        pack_hours: estateDayPlan.packDay?.hours ?? null,
        move_crew: estateDayPlan.moveDay.crew,
        move_hours: estateDayPlan.moveDay.hours,
        // Separate unpack day (4BR+ Estate). null on smaller plans where
        // unpack labour is bundled into move_hours. Stamped here so the
        // admin form, client confirm page, and lifecycle emails can
        // render the third day without recomputing the plan.
        unpack_crew: estateDayPlan.unpackDay?.crew ?? null,
        unpack_hours: estateDayPlan.unpackDay?.hours ?? null,
        unpack_included: estateDayPlan.unpackIncluded,
      },
      estate_multi_day_labour_uplift: estateMultiDayLabourUplift,
      estate_loaded_labour_cost: estateLoadedMultiDayCost,
      building_complexity_surcharge: buildingComplexityCharge,
      building_complexity_flags: buildingComplexityFlags,
      building_profiles: {
        from_id: fromBuilding?.id ?? null,
        to_id: toBuilding?.id ?? null,
      },
      building_loading_extra_minutes: buildingLoadingExtraMin,
      building_unloading_extra_minutes: buildingUnloadingExtraMin,
      estate_schedule_headline: estateScheduleHeadline(estateDayPlan),
      estate_schedule_lines: buildEstateScheduleLines(
        estateDayPlan,
        input.move_date ?? "",
        estateScheduleTruckLabel,
      ),
      estimated_margin_essential:   estMarginPct,
      estimated_margin_signature: estSigMarginPct,
      estimated_margin_estate:    estEstMarginPct,
      // True margin per tier — after monthly OH allocation and claims reserve.
      // The number the operator should anchor on for "is this job actually
      // profitable" decisions. See estimated_cost.* for the inputs.
      true_margin_essential: trueMarginEssential,
      true_margin_signature: trueMarginSignature,
      true_margin_estate:    trueMarginEstate,
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
  _dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const perWs = cfgNum(config, "office_per_workstation", 85);
  const desks = Math.max(0, Math.floor(input.office_desks_count ?? 0));
  const chairs = Math.max(0, Math.floor(input.office_chairs_count ?? 0));
  const wsFromFields = Math.max(desks, chairs);
  const workstationCount = Math.max(
    0,
    Math.floor(input.workstation_count ?? 0) || wsFromFields,
  );

  const serverRoom = input.office_server_room ?? !!input.has_it_equipment;
  let boardroomCount = Math.max(0, Math.floor(input.office_boardroom_count ?? 0));
  if (boardroomCount === 0 && input.has_conference_room) boardroomCount = 1;
  const kitchen = !!input.office_kitchen_break_room;
  const reception = !!input.has_reception_area;

  const timing = (input.timing_preference || "").toLowerCase();
  const afterHours =
    !!input.office_after_hours ||
    timing.includes("evening") ||
    timing.includes("night") ||
    timing.includes("after");
  const weekend =
    !!input.office_weekend ||
    timing.includes("weekend") ||
    isMoveDateWeekend(input.move_date || "");

  let subtotal = workstationCount * perWs;

  if (serverRoom) subtotal += cfgNum(config, "office_server_room", 500);
  if (boardroomCount > 0) {
    subtotal += cfgNum(config, "office_boardroom", 300) * boardroomCount;
  }
  if (kitchen) subtotal += cfgNum(config, "office_kitchen", 200);
  if (reception) subtotal += cfgNum(config, "office_reception", 250);

  if (afterHours) subtotal *= cfgNum(config, "office_after_hours_multiplier", 1.2);
  if (weekend) subtotal += cfgNum(config, "office_weekend_surcharge", 200);

  const distKm = distInfo?.distance_km ?? 0;
  const distFree = cfgNum(config, "office_dist_free_km", 40);
  if (distKm > distFree) {
    subtotal += (distKm - distFree) * cfgNum(config, "office_per_km", 4);
  }

  const truckOffice = normalizeTruckType(input.truck_type ?? "16ft");
  const truckCount = Math.max(1, Math.floor(input.office_truck_count ?? 1));
  const truckSur = officeTruckSurchargeStack(truckOffice, truckCount, config);
  subtotal += truckSur;

  const minOffice = cfgNum(config, "office_minimum", 800);
  const rounding = cfgNum(config, "rounding_nearest", 50);
  subtotal = Math.max(subtotal, minOffice);
  subtotal = roundTo(subtotal, rounding);

  const [fromAccess, toAccess] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const accessTotal = fromAccess + toAccess;
  const plcOffice = parkingLongCarryLineTotal(config, input, "both");
  let price = subtotal + accessTotal + plcOffice.total;

  const scheduleFlags: OfficeScheduleFlags = {
    serverRoom,
    boardroomCount,
    kitchen,
    reception,
  };
  const estCrew = input.office_crew_size ?? estimateOfficeCrew(workstationCount);
  const estHours = input.office_estimated_hours ?? estimateOfficeHours(workstationCount, scheduleFlags);
  const loadedRate = cfgNum(config, "crew_loaded_hourly_rate", 28);
  const estCost =
    estCrew * estHours * loadedRate + estimateOfficeTruckOpsCost(truckOffice, truckCount, config);
  const marginPct = price > 0 ? Math.round((1 - estCost / price) * 100) : 0;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "office", price, input.move_date);

  const officeFeatures = await fetchTierFeatures(sb, "office_move", "custom");
  const includes = officeFeatures.length > 0 ? [...officeFeatures] : [
    "Professional moving crew",
    "Moving truck(s) as needed",
    "Basic disassembly & reassembly",
    "Floor & door frame protection",
    "Labeled crate system",
  ];
  if (serverRoom && !includes.includes("Server / IT area handling"))
    includes.push("Server / IT area handling");
  if (boardroomCount > 0 && !includes.includes("Boardroom teardown & setup"))
    includes.push("Boardroom teardown & setup");

  return {
    custom_price: { price, deposit, tax, total: price + tax, includes } as TierResult,
    factors: {
      office_pricing_model: "workstation_based",
      office_per_workstation: perWs,
      office_workstations_billed: workstationCount,
      office_server_room: serverRoom,
      office_boardroom_count: boardroomCount,
      office_kitchen: kitchen,
      office_reception: reception,
      office_after_hours: afterHours,
      office_weekend: weekend,
      office_truck_count: truckCount,
      office_hours_estimated: estHours,
      office_crew_estimated: estCrew,
      distance_km: distKm,
      access_surcharge: accessTotal,
      parking_long_carry_total: plcOffice.total,
      truck_recommended: truckOffice,
      truck_surcharge: truckSur,
      office_estimated_ops_cost: Math.round(estCost),
      office_estimated_margin_pct: marginPct,
      square_footage: input.square_footage ?? null,
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
  price += plcLd.total + getTruckFeeSync(truckLd, config);

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "long_distance", price, input.move_date);

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
      truck_surcharge: getTruckFeeSync(truckLd, config),
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
  const distKm = distInfo?.distance_km ?? 0;

  const baseRates: Record<string, number> = {
    small_light: cfgNum(config, "single_item_small", 150),
    medium: cfgNum(config, "single_item_medium", 225),
    large: cfgNum(config, "single_item_large", 300),
    heavy: cfgNum(config, "single_item_heavy", 400),
    extra_heavy: cfgNum(config, "single_item_extra_heavy", 550),
    fragile: cfgNum(config, "single_item_fragile", 350),
  };
  const addRate = cfgNum(config, "single_item_additional_item_rate", 0.6);
  const stairPerFlight = cfgNum(config, "stair_carry_per_flight", 50);
  const assemblyFee = cfgNum(config, "single_item_assembly", 75);

  // ── Resolve lines (array-first, scalar fallback) ───────────────────────
  // Phase 1 added quote_items[]. Older quotes still ship the scalars
  // (item_description, item_category, etc.). resolveSingleItemLines is the
  // single source of truth for converting either shape into a uniform array.
  const lines: SingleItemLine[] = resolveSingleItemLines(input.quote_items, {
    item_description: input.item_description,
    item_category: input.item_category,
    item_weight_class: input.item_weight_class,
    assembly_needed: input.assembly_needed,
    stair_carry: input.stair_carry,
    stair_flights: input.stair_flights,
    number_of_items: input.number_of_items,
  });

  // Safety net: if no lines were produced (e.g. brand-new draft), synthesize
  // a single medium row so pricing doesn't divide by zero.
  const effectiveLines: SingleItemLine[] =
    lines.length > 0
      ? lines
      : [
          {
            id: "fallback-0",
            item_description: "",
            item_category: "standard_furniture",
            weight_class: "",
            assembly: "None",
            stair_carry: false,
            quantity: 1,
          },
        ];

  // Per-line price contributions. Each line carries:
  //   base = baseRates[mappedCategory] × quantity
  //   assembly = assemblyFee if assembly != none (charged ONCE per line, not
  //     per unit inside the line — assembling two identical bedside tables
  //     is one setup, not two)
  //   stair = stair_flights × stairPerFlight × quantity (per unit on stairs)
  type LineCost = {
    line: SingleItemLine;
    mappedCategory: ReturnType<typeof singleItemPricingCategory>;
    unitBase: number;
    base: number;
    assembly: number;
    stair: number;
  };

  const lineCosts: LineCost[] = effectiveLines.map((l) => {
    const mappedCategory = singleItemPricingCategory(l.item_category, l.weight_class);
    const unitBase = baseRates[mappedCategory] ?? baseRates.medium;
    const qty = Math.max(1, Math.floor(l.quantity ?? 1));
    const base = unitBase * qty;
    const asmRaw = (l.assembly || "None").toLowerCase().trim();
    const needsAssembly =
      asmRaw.includes("both") ||
      asmRaw.includes("assembly") ||
      asmRaw.includes("disassembly");
    const assembly = needsAssembly ? assemblyFee : 0;
    const stair = l.stair_carry
      ? stairPerFlight * Math.max(1, l.stair_flights ?? 1) * qty
      : 0;
    return { line: l, mappedCategory, unitBase, base, assembly, stair };
  });

  // Volume discount: most-expensive line (by per-unit base) pays full; every
  // additional line discounts to addRate (60% by default) of its own base.
  // Quantity multiplier within a single line is NOT discounted — two identical
  // chairs are still two chairs to load. The discount applies between distinct
  // line items only, preserving the spirit of the old single-rate × addRate
  // formula while supporting per-line categories.
  const sortedByUnitBaseDesc = [...lineCosts].sort(
    (a, b) => b.unitBase - a.unitBase,
  );
  const idxByLineId = new Map<string, number>();
  sortedByUnitBaseDesc.forEach((lc, i) => idxByLineId.set(lc.line.id, i));

  const discountedBaseTotal = lineCosts.reduce((sum, lc) => {
    const rank = idxByLineId.get(lc.line.id) ?? 0;
    const factor = rank === 0 ? 1 : addRate;
    return sum + lc.base * factor;
  }, 0);

  let price = discountedBaseTotal;

  // Distance over free km
  const distFree = cfgNum(config, "single_item_dist_free_km", 40);
  if (distKm > distFree) {
    price += (distKm - distFree) * cfgNum(config, "single_item_per_km", 3);
  }

  // Access surcharges (move-level; not per-line)
  async function singleItemAccessOne(access: string | undefined): Promise<number> {
    const w = singleItemWalkUpSurcharge(access, config);
    if (w > 0) return w;
    return getAccessSurcharge(sb, access);
  }
  const [fromAccessSi, toAccessSi] = await Promise.all([
    singleItemAccessOne(input.from_access),
    singleItemAccessOne(input.to_access),
  ]);
  const accessTotal = fromAccessSi + toAccessSi;
  price += accessTotal;

  // Per-line assembly + stair charges
  const assemblySurchargeTotal = lineCosts.reduce((s, lc) => s + lc.assembly, 0);
  const stairSurchargeTotal = lineCosts.reduce((s, lc) => s + lc.stair, 0);
  price += assemblySurchargeTotal + stairSurchargeTotal;

  // Move-level parking + truck — driven by the heaviest line
  const heaviestCategory =
    sortedByUnitBaseDesc[0]?.mappedCategory ?? "medium";
  const plcSi = parkingLongCarryLineTotal(config, input, "both");
  const defaultTruck =
    heaviestCategory === "extra_heavy" || heaviestCategory === "heavy"
      ? "16ft"
      : "sprinter";
  const truckSi = normalizeTruckType(input.truck_type ?? defaultTruck);
  price += plcSi.total + getTruckFeeSync(truckSi, config);

  // ── Junk-removal: single-item flat formula ─────────────────────────────
  // Single-item junk pricing differs from residential:
  //   residential → addons.junk_removal tier price (truck volume) + stop fee
  //   single_item → flat $149 base for ≤2 items, +$50 per extra item
  //                 (junk_items_count). No stop fee, no distance math.
  //
  // The coordinator still picks a tier on the addon (the UI requires a
  // selection for tiered addons) but we IGNORE the tier's $ price for
  // single_item and apply the flat formula instead. We subtract the
  // tier's contribution from addonResult below so it isn't double-charged.
  const junkPickupFrom = (input.junk_pickup_from || "").trim();
  const isJunkAddonSelected = (addonResult.breakdown || []).some(
    (b) => (b.slug || "").toLowerCase() === "junk_removal",
  );
  const junkAddonTierAmount = isJunkAddonSelected
    ? (addonResult.breakdown || []).reduce(
        (s, b) =>
          (b.slug || "").toLowerCase() === "junk_removal"
            ? s + (b.price ?? 0)
            : s,
        0,
      )
    : 0;

  let junkStopFee = 0;
  let singleItemJunkFlat = 0;
  if (isJunkAddonSelected) {
    const junkBase = cfgNum(config, "single_item_junk_removal_base", 149);
    const junkPerExtra = cfgNum(
      config,
      "single_item_junk_removal_per_extra",
      50,
    );
    const itemsCount = Math.max(
      1,
      Math.floor(Number(input.junk_items_count ?? 1)),
    );
    const extras = Math.max(0, itemsCount - 2);
    singleItemJunkFlat = junkBase + extras * junkPerExtra;
    void junkPickupFrom; // captured below for factors; not used for pricing on single_item
  }
  // Note: junkStopFee stays 0 for single_item — the flat fee covers labour.
  price += junkStopFee + singleItemJunkFlat;

  // Round + floor
  const roundingSi = cfgNum(config, "rounding_nearest", 25);
  price = roundTo(price, roundingSi);
  if (price < cfgNum(config, "single_item_floor", 150)) {
    price = cfgNum(config, "single_item_floor", 150);
  }

  // ── Suppress assembly addons that the per-line assembly fee already
  // covers. Without this, a coordinator who picks "Both" on an item AND
  // ticks the disassembly_assembly addon pays for the same labour twice:
  // once via single_item_assembly per-line fee, once via the addon's flat
  // price (e.g. $140). The UI also shows the matching addon as locked
  // "Included" — both surfaces must agree.
  const itemsHaveAssembly = lineCosts.some((lc) => lc.assembly > 0);
  const SUPPRESSED_ASSEMBLY_SLUGS = new Set([
    "disassembly",
    "assembly",
    "disassembly_assembly",
  ]);
  const suppressedAddonTotal = itemsHaveAssembly
    ? (addonResult.breakdown || []).reduce(
        (s, b) =>
          SUPPRESSED_ASSEMBLY_SLUGS.has((b.slug || "").toLowerCase())
            ? s + (b.price ?? 0)
            : s,
        0,
      )
    : 0;

  // Addons folded in last, minus any double-counted assembly addons AND
  // minus the junk_removal tier price (which we replaced with the flat
  // single_item formula above).
  price += addonResult.total - suppressedAddonTotal - junkAddonTierAmount;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "single_item", price, input.move_date);

  const totalUnits = effectiveLines.reduce(
    (s, l) => s + Math.max(1, Math.floor(l.quantity ?? 1)),
    0,
  );
  const anyAssembly = lineCosts.some((lc) => lc.assembly > 0);
  const estHours = estimateSingleItemHours(heaviestCategory, totalUnits, anyAssembly);
  const estCrew = heaviestCategory === "extra_heavy" ? 3 : 2;

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
      single_item_pricing_model: "per_line_category_flat",
      single_item_category: heaviestCategory,
      single_item_base_category_rate: sortedByUnitBaseDesc[0]?.unitBase ?? 0,
      single_item_quantity: totalUnits,
      single_item_additional_item_rate: addRate,
      // Per-line breakdown — surfaced so the client quote page and admin
      // detail can show what each item contributed.
      single_item_lines: lineCosts.map((lc) => ({
        id: lc.line.id,
        item_description: lc.line.item_description,
        item_category: lc.line.item_category,
        weight_class: lc.line.weight_class,
        assembly: lc.line.assembly,
        stair_carry: lc.line.stair_carry,
        stair_flights: lc.line.stair_flights,
        quantity: lc.line.quantity,
        mapped_category: lc.mappedCategory,
        unit_base: lc.unitBase,
        base: lc.base,
        assembly_fee: lc.assembly,
        stair_fee: lc.stair,
      })),
      distance_km: distKm,
      // Legacy scalars kept for downstream compatibility (HubSpot, emails, etc.)
      item_description: effectiveLines[0]?.item_description || null,
      item_category: effectiveLines[0]?.item_category || null,
      weight_class: effectiveLines[0]?.weight_class || null,
      access_surcharge: accessTotal,
      single_item_special_handling: input.single_item_special_handling?.trim() || null,
      assembly_surcharge: assemblySurchargeTotal,
      stair_carry_surcharge: stairSurchargeTotal,
      parking_long_carry_total: plcSi.total,
      truck_recommended: truckSi,
      truck_surcharge: getTruckFeeSync(truckSi, config),
      single_item_hours_estimated: estHours,
      single_item_crew_estimated: estCrew,
      // Junk-removal stop — surfaced for admin + crew sheet visibility.
      junk_pickup_from: junkPickupFrom || null,
      junk_items_description: input.junk_items_description?.trim() || null,
      junk_stop_fee: junkStopFee,
      // Single-item junk flat formula breakdown — surfaces so admin can
      // see "$149 base + 2 extras × $50 = $249" instead of a magic number.
      junk_items_count: input.junk_items_count ?? null,
      single_item_junk_flat: singleItemJunkFlat,
      single_item_junk_base: cfgNum(
        config,
        "single_item_junk_removal_base",
        149,
      ),
      single_item_junk_per_extra: cfgNum(
        config,
        "single_item_junk_removal_per_extra",
        50,
      ),
      // Tier price we suppressed (the addons.junk_removal tier dollar
      // value), so the admin breakdown is auditable.
      junk_addon_tier_amount_suppressed: junkAddonTierAmount,
      // Surfaced so admin + client surfaces can show "Assembly already
      // included from item selection" instead of charging twice.
      assembly_addon_suppressed: itemsHaveAssembly,
      assembly_addon_suppressed_amount: suppressedAddonTotal,
    },
  };
}

// ═══════════════════════════════════════════════
// WHITE GLOVE — hours × premium crew rate + per-item surcharges (not residential)
// ═══════════════════════════════════════════════

async function calcWhiteGlove(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const items = normalizeWhiteGloveItemsFromQuoteInput(input).filter((i) =>
    (i.description || "").trim(),
  );
  const distKm = distInfo?.distance_km ?? 0;

  const [fromWg, toWg] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const plcWg = parkingLongCarryLineTotal(config, input, "both");

  const gwRaw = input.white_glove_guaranteed_window_hours;
  const gwHours =
    typeof gwRaw === "number" && Number.isFinite(gwRaw) && gwRaw > 0
      ? gwRaw
      : null;

  const breakdown = computeWhiteGlovePricingBreakdown(config, items, {
    distKm,
    fromAccessCharge: fromWg,
    toAccessCharge: toWg,
    parkingLongCarryTotal: plcWg.total,
    declaredValue: input.declared_value,
    debrisRemoval: input.white_glove_debris_removal === true,
    guaranteedNarrowWindowhours: gwHours,
    truckType: input.truck_type ?? "sprinter",
  });

  let price = breakdown.subtotalPreTax;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "white_glove", price, input.move_date);

  const truckWg = normalizeTruckType(input.truck_type ?? "sprinter");
  const truckDisplay =
    WG_TRUCK_DISPLAY_LABEL[truckWg.toLowerCase()] ?? `${truckWg} delivery vehicle`;

  let crew = recommendWhiteGloveCrew(items);
  let hours = estimateWhiteGloveHours(
    items,
    distKm,
    crew,
    distInfo?.drive_time_min ?? null,
  );
  const crewOvr = input.white_glove_crew_override;
  if (typeof crewOvr === "number" && Number.isFinite(crewOvr) && crewOvr > 0) {
    crew = Math.max(1, Math.min(12, Math.round(crewOvr)));
  }
  const hoursOvr = input.white_glove_hours_override;
  if (typeof hoursOvr === "number" && Number.isFinite(hoursOvr) && hoursOvr > 0) {
    hours = Math.max(0.25, Math.round(hoursOvr * 2) / 2);
  }

  const wgFeatures = await fetchTierFeatures(sb, "white_glove", "custom");
  const dynamicIncludes = getWhiteGloveClientInclusions({
    items,
    assemblyTotal: breakdown.assemblyTotal,
    debrisRemoval: input.white_glove_debris_removal === true,
    debrisFee: breakdown.debrisFee,
    guaranteedWindowHours: gwHours,
    truckDisplay,
    crew,
    hours,
    distKm,
  });
  const fallbackIncludes = wgFeatures.length > 0 ? wgFeatures : [
    "Premium handling",
    "Item-based white glove delivery",
    "Blanket and pad wrapping",
    "Secure transport",
  ];
  const whiteGloveIncludes =
    dynamicIncludes.length > 0 ? dynamicIncludes : fallbackIncludes;

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: whiteGloveIncludes,
    } as TierResult,
    factors: {
      white_glove_pricing: "item_based",
      white_glove_kind:
        input.white_glove_kind === "service" ? "service" : "delivery",
      white_glove_items: items,
      white_glove_item_lines: breakdown.itemLines,
      white_glove_items_subtotal: breakdown.itemsOrMinimum,
      white_glove_assembly_total: breakdown.assemblyTotal,
      white_glove_debris_fee: breakdown.debrisFee,
      white_glove_distance_surcharge: breakdown.distanceSurcharge,
      white_glove_declared_value_premium: breakdown.declaredValuePremium,
      white_glove_guaranteed_window_fee: breakdown.guaranteedWindowFee,
      white_glove_guaranteed_window_hours: gwHours,
      white_glove_access_from: fromWg,
      white_glove_access_to: toWg,
      access_surcharge: fromWg + toWg,
      white_glove_truck_surcharge: breakdown.truckSurcharge,
      parking_long_carry_total: plcWg.total,
      truck_recommended: truckWg,
      truck_surcharge: breakdown.truckSurcharge,
      white_glove_crew_rate: cfgNum(config, "white_glove_crew_rate", 95),
      white_glove_crew: crew,
      white_glove_hours: hours,
      distance_km: distKm,
      includes: whiteGloveIncludes,
      item_description: items[0]?.description ?? input.item_description ?? null,
      declared_value: input.declared_value ?? null,
      white_glove_debris_removal: input.white_glove_debris_removal === true,
      specialty_building_requirements: input.specialty_building_requirements ?? [],
      white_glove_building_requirements_note:
        input.white_glove_building_requirements_note?.trim() || null,
      white_glove_delivery_instructions:
        input.white_glove_delivery_instructions?.trim() || null,
    },
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
  let pt = input.project_type ?? "custom";
  if (pt === "safe_vault") {
    const w = (input.item_weight_class || "").toLowerCase();
    if (w.includes("500") || w.includes("over_1000") || w.includes("1000")) {
      pt = "safe_over_300lbs";
    } else if (w.includes("under_100") || w.includes("100_250") || w.includes("250_500")) {
      pt = "safe_under_300lbs";
    }
  }
  const projectBase = baseMap[pt] ?? baseMap.custom ?? 500;
  // Internal default for the price calculation only — DO NOT write this
  // default into factors_applied. The 4-hour fallback is wrong for any
  // long-distance specialty (Ottawa→Toronto is a 9–12 hour day) and
  // misleads the client when it leaks to the quote page. We track
  // whether the value was coordinator-provided so we can persist
  // timeline_hours only when it's meaningful.
  const timelineHoursExplicit =
    typeof input.timeline_hours === "number" && Number.isFinite(input.timeline_hours);
  const hours = timelineHoursExplicit ? (input.timeline_hours as number) : 4;
  const flatBaseTypes = new Set([
    "piano_upright",
    "piano_grand",
    "pool_table",
    "pool_table_slate",
    "hot_tub",
    "safe_vault",
    "safe_under_300lbs",
    "safe_over_300lbs",
    "wine_collection",
    "aquarium",
    "motorcycle",
    "gym_equipment",
    "art_sculpture",
  ]);
  let price = flatBaseTypes.has(pt) ? projectBase : Math.round(projectBase * (hours / 4));

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
  price += plcSp.total + getTruckFeeSync(truckSp, config);

  const spMin = cfgNum(config, "specialty_minimum_price", 500);
  if (price < spMin) price = spMin;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "specialty", price, input.move_date);

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
      // Only persist timeline_hours when the coordinator explicitly set
      // it — otherwise downstream renderers would surface the engine's
      // 4-hour default as if it were a real estimate.
      ...(timelineHoursExplicit ? { timeline_hours: hours } : {}),
      distance_surcharge: distanceSurcharge,
      crating_surcharge: (input.custom_crating_pieces ?? 0) * cratingPerPiece,
      climate_surcharge: input.climate_control ? climateSur : 0,
      parking_long_carry_total: plcSp.total,
      truck_recommended: truckSp,
      truck_surcharge: getTruckFeeSync(truckSp, config),
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
      platformConfig: config,
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
          platformConfig: config,
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
    const truckSurchargeDim = getTruckFeeSync(dim.truck, config);

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
  price += plcB2b.total + getTruckFeeSync(truckB2b, config);

  price += b2bLocationExtras.lines.reduce((s, l) => s + l.amount, 0);
  price += addonResult.total;
  const tax = Math.round(price * taxRate);
  const b2bTotal = price + tax;
  // Global rule: quotes under $550 (with tax) require full payment at booking.
  const deposit = b2bTotal < 550 ? b2bTotal : 100;

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
      truck_surcharge: getTruckFeeSync(truckB2b, config),
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

type EventItemKind = "box_light" | "box_heavy" | "furniture" | "fragile" | "equipment" | "custom";

const EVENT_HARD_ACCESS_WALKUP: string[] = [
  "walk_up_3",
  "walk_up_3rd",
  "walk_up_4_plus",
  "walk_up_4plus",
  "walk_up_4th",
  "walk_up_4th_plus",
];

function inferEventItemKind(item: EventQuoteItemInput): EventItemKind {
  const raw = (item.item_type || "").trim().toLowerCase();
  if (
    raw === "box_light" ||
    raw === "box_heavy" ||
    raw === "furniture" ||
    raw === "fragile" ||
    raw === "equipment" ||
    raw === "custom"
  ) {
    return raw;
  }
  const cat = normalizeB2bWeightCategory(item.weight_category);
  if (cat === "light") return "box_light";
  if (cat === "heavy" || cat === "very_heavy" || cat === "extreme" || cat === "super_heavy") {
    return "box_heavy";
  }
  return "furniture";
}

function eventItemMinutesPerUnit(item: EventQuoteItemInput, config: Map<string, string>): number {
  if (item.requires_wrapping) {
    return cfgNum(config, "event_wrapping_handling_minutes_per", 15);
  }
  const kind = inferEventItemKind(item);
  switch (kind) {
    case "box_light":
      return cfgNum(config, "event_box_light_minutes_per", 1);
    case "box_heavy":
      return cfgNum(config, "event_box_heavy_minutes_per", 3);
    case "fragile":
      return cfgNum(config, "event_fragile_minutes_per", 15);
    case "equipment":
      return cfgNum(config, "event_equipment_minutes_per", 10);
    case "custom":
      return cfgNum(config, "event_furniture_minutes_per", 8);
    default:
      return cfgNum(config, "event_furniture_minutes_per", 8);
  }
}

function eventWrappingSurchargeForItems(items: EventQuoteItemInput[] | undefined, config: Map<string, string>): number {
  const per = cfgNum(config, "event_wrap_per_item", 15);
  let sum = 0;
  for (const item of items ?? []) {
    if (!item.requires_wrapping) continue;
    sum += Math.max(1, item.quantity || 1) * per;
  }
  return sum;
}

function estimateEventSystemHours(
  items: EventQuoteItemInput[] | undefined,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  venueSetupComplex: boolean,
  config: Map<string, string>,
): number {
  const driveMin = distInfo?.drive_time_min != null && distInfo.drive_time_min > 0 ? distInfo.drive_time_min : 15;
  let hours = (driveMin / 60) * 2;

  for (const item of items ?? []) {
    const q = Math.max(1, item.quantity || 1);
    const minPer = eventItemMinutesPerUnit(item, config);
    hours += ((q * minPer * 2) / 60);
  }

  hours += venueSetupComplex ? 1 : 0.5;

  const buffer = cfgNum(config, "event_hours_buffer_multiplier", 1.15);
  hours *= buffer;

  const floorH = cfgNum(config, "event_min_hours_floor", 2);
  hours = Math.max(hours, floorH);

  return Math.round(hours * 2) / 2;
}

function recommendEventCrewForEvent(
  items: EventQuoteItemInput[] | undefined,
  fromAccess: string | undefined,
  toAccess: string | undefined,
): number {
  let crew = 2;
  if (fromAccess && EVENT_HARD_ACCESS_WALKUP.includes(fromAccess)) crew += 1;
  if (toAccess && EVENT_HARD_ACCESS_WALKUP.includes(toAccess)) crew += 1;

  let qtySum = 0;
  let wrapQty = 0;
  let heavyish = 0;
  for (const item of items ?? []) {
    const q = Math.max(1, item.quantity || 1);
    qtySum += q;
    if (item.requires_wrapping) wrapQty += q;
    const k = inferEventItemKind(item);
    if (k === "box_heavy" || k === "fragile" || k === "equipment") heavyish += q;
  }

  if (qtySum > 80) crew = Math.max(crew, 3);
  if (wrapQty >= 4) crew = Math.max(crew, 3);
  if (heavyish >= 8) crew = Math.max(crew, 3);

  return Math.min(6, crew);
}

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

/** Per event leg: crew × hours × mover rate + truck + km + wrapping + parking + access + long carry */
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
    sameDayReturn?: boolean;
    hoursOverride?: number;
    crewOverride?: number;
    venueSetupComplex: boolean;
  },
) {
  const distKm = input.distInfo?.distance_km ?? 0;
  const systemHours = estimateEventSystemHours(input.eventItems, input.distInfo, input.venueSetupComplex, input.config);
  const minHours = input.isLuxury
    ? cfgNum(input.config, "event_min_hours_luxury", 2)
    : cfgNum(input.config, "event_min_hours_standard", 2);
  let billableHours = systemHours;
  if (input.hoursOverride != null && Number.isFinite(input.hoursOverride) && input.hoursOverride > 0) {
    billableHours = Math.round(input.hoursOverride * 2) / 2;
  }
  billableHours = Math.max(billableHours, minHours);

  let crewSize = recommendEventCrewForEvent(input.eventItems, input.fromAccess, input.toAccess);
  if (input.crewOverride != null && Number.isFinite(input.crewOverride)) {
    crewSize = Math.min(6, Math.max(2, Math.round(input.crewOverride)));
  }

  const moverRate = input.isLuxury
    ? cfgNum(input.config, "event_crew_rate_luxury", 95)
    : cfgNum(input.config, "event_crew_rate_standard", 80);

  const deliveryLabour = Math.round(crewSize * billableHours * moverRate);

  const freeKm = cfgNum(input.config, "event_free_km", 40);
  const perKm = cfgNum(input.config, "event_per_km", 3);
  const distanceSurcharge =
    input.skipTruckSurcharge || distKm <= freeKm ? 0 : Math.round((distKm - freeKm) * perKm);

  const wrapSur = eventWrappingSurchargeForItems(input.eventItems, input.config);

  const parkingRates = parseJsonConfig<Record<string, number>>(input.config, "parking_surcharges", {
    dedicated: 0,
    street: 0,
    no_dedicated: 75,
  });
  const parkingSur =
    (parkingRates[input.fromParking] ?? 0) + (parkingRates[input.toParking] ?? 0);
  const lcFee = cfgNum(input.config, "long_carry_surcharge", 75);
  const longSur = (input.fromLongCarry ? lcFee : 0) + (input.toLongCarry ? lcFee : 0);

  const truckSur = input.skipTruckSurcharge ? 0 : getTruckFeeSync(input.truckType, input.config);
  const [oa, va] = await Promise.all([
    getAccessSurcharge(sb, input.fromAccess),
    getAccessSurcharge(sb, input.toAccess),
  ]);

  const rounding = cfgNum(input.config, "rounding_nearest", 50);
  const rawDelivery =
    deliveryLabour + truckSur + distanceSurcharge + wrapSur + parkingSur + oa + va + longSur;
  let deliveryCharge = roundTo(Math.round(rawDelivery), rounding);

  const returnDiscount = Math.min(1, Math.max(0, input.returnDiscount));
  const returnCharge =
    input.sameDayReturn
      ? 0
      : roundTo(Math.round(deliveryCharge * returnDiscount), rounding);
  const returnHours = input.sameDayReturn ? 0 : Math.ceil(billableHours * returnDiscount);

  const labour = {
    crewSize,
    estimatedHours: billableHours,
    hoursRange: `${billableHours}hr`,
    truckSize: input.truckType === "none" ? "sprinter" : input.truckType,
  };

  return {
    deliveryCharge,
    returnCharge,
    returnHours,
    returnDiscount,
    labour,
    truckSurcharge: truckSur,
    parkingSurcharge: parkingSur,
    longCarrySurcharge: longSur,
    billableHours,
    crewHourlyRate: moverRate,
    deliveryLabour,
    distanceSurcharge,
    wrappingSurcharge: wrapSur,
    systemEstimatedHours: systemHours,
    hoursFromOverride: input.hoursOverride != null && Number.isFinite(input.hoursOverride) && input.hoursOverride > 0,
    crewFromOverride: input.crewOverride != null && Number.isFinite(input.crewOverride),
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

  const venueSetupComplex = isLuxury ? !!input.event_complex_setup_required : !!input.event_setup_required;

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
    sameDayReturn: !!input.event_same_day,
    hoursOverride: input.event_hours_override,
    crewOverride: input.event_crew_override,
    venueSetupComplex,
  });

  const { setupFee, setupLabel } = eventSetupFeeAndLabel(input, config);

  const roundingEv = cfgNum(config, "rounding_nearest", 50);
  const minEv = cfgNum(config, "event_minimum", 400);
  let del = core.deliveryCharge;
  let ret = core.returnCharge;
  let eventMinimumApplied = false;
  if (!input.event_same_day) {
    let guard = 0;
    while (del + ret < minEv && guard < 40) {
      del = roundTo(del + roundingEv, roundingEv);
      ret = roundTo(Math.round(del * rd), roundingEv);
      guard += 1;
    }
    eventMinimumApplied = del + ret > core.deliveryCharge + core.returnCharge;
  } else {
    let guard = 0;
    while (del < minEv && guard < 40) {
      del = roundTo(del + roundingEv, roundingEv);
      guard += 1;
    }
    eventMinimumApplied = del > core.deliveryCharge;
  }

  let price = del + ret + setupFee + addonResult.total;
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
      delivery_charge: del,
      return_charge: ret,
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
      truck_breakdown_line: formatTruckBreakdownLine(truckType, config),
      event_parking_surcharge: core.parkingSurcharge,
      event_long_carry_surcharge: core.longCarrySurcharge,
      distance_km: distEff?.distance_km ?? 0,
      event_distance_summary:
        onSite ? "On-site (no transit)" : distEff?.distance_km != null ? `${Math.round(distEff.distance_km)} km` : null,
      crew_hourly_rate: core.crewHourlyRate,
      event_delivery_labour: core.deliveryLabour,
      event_distance_surcharge: core.distanceSurcharge,
      event_wrapping_surcharge: core.wrappingSurcharge,
      event_hours_system_estimate: core.systemEstimatedHours,
      event_hours_coordinator_override: core.hoursFromOverride,
      event_crew_coordinator_override: core.crewFromOverride,
      event_system_delivery_charge: core.deliveryCharge,
      event_system_return_charge: core.returnCharge,
      event_minimum_applied: eventMinimumApplied,
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
  const venueSetupComplex = isLuxury ? !!input.event_complex_setup_required : !!input.event_setup_required;
  let totalLabourLine = 0;
  let totalDistSur = 0;
  let totalWrapSur = 0;
  let maxSystemEstHours = 0;

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
      sameDayReturn: !!leg.event_same_day,
      hoursOverride: input.event_hours_override,
      crewOverride: input.event_crew_override,
      venueSetupComplex,
    });

    totalLabourLine += core.deliveryLabour;
    totalDistSur += core.distanceSurcharge;
    totalWrapSur += core.wrappingSurcharge;
    maxSystemEstHours = Math.max(maxSystemEstHours, core.systemEstimatedHours);

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

  const roundingEv = cfgNum(config, "rounding_nearest", 50);
  const minEv = cfgNum(config, "event_minimum", 400);
  let eventMinimumApplied = false;
  if (totalDelivery + totalReturn < minEv) {
    const deficit = minEv - totalDelivery - totalReturn;
    totalDelivery = roundTo(totalDelivery + deficit, roundingEv);
    eventMinimumApplied = true;
    if (legBreakdown.length > 0) {
      const row = legBreakdown[0] as { delivery_charge: number };
      row.delivery_charge = roundTo(row.delivery_charge + deficit, roundingEv);
    }
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
      truck_breakdown_line: formatTruckBreakdownLine(defaultTruck, config),
      event_delivery_labour: totalLabourLine,
      event_distance_surcharge: totalDistSur,
      event_wrapping_surcharge: totalWrapSur,
      event_hours_system_estimate: maxSystemEstHours,
      event_hours_coordinator_override:
        input.event_hours_override != null &&
        Number.isFinite(input.event_hours_override) &&
        input.event_hours_override > 0,
      event_crew_coordinator_override:
        input.event_crew_override != null && Number.isFinite(input.event_crew_override),
      event_minimum_applied: eventMinimumApplied,
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
  const labourRate = cfgNum(
    config,
    "labour_only_per_mover_hour",
    cfgNum(config, "labour_only_rate", 80),
  );
  const crewSize = input.labour_crew_size ?? 2;
  const hours = input.labour_hours ?? 1;
  const truckFee = input.labour_truck_required ? cfgNum(config, "labour_only_truck_fee", 150) : 0;
  const accessSurcharge = await getAccessSurcharge(sb, input.from_access);
  const rounding = cfgNum(config, "rounding_nearest", 50);
  const plcLab = parkingLongCarryLineTotal(config, input, "origin_only");

  const weekend =
    !!input.labour_weekend || isMoveDateWeekend(input.move_date || "");
  const afterHours = !!input.labour_after_hours;

  // Complexity multiplier — increases base price for scope/access difficulty.
  const COMPLEXITY_MULT: Record<string, number> = {
    standard: 1.0,
    moderate: cfgNum(config, "labour_only_complexity_moderate", 1.25),
    complex:  cfgNum(config, "labour_only_complexity_complex",  1.5),
  };
  // Weight class multiplier — increases base price when items are heavy.
  const WEIGHT_MULT: Record<string, number> = {
    standard:   1.0,
    heavy:      cfgNum(config, "labour_only_weight_heavy",      1.2),
    very_heavy: cfgNum(config, "labour_only_weight_very_heavy", 1.45),
  };
  const complexityMult = COMPLEXITY_MULT[input.labour_complexity ?? "standard"] ?? 1.0;
  const weightMult     = WEIGHT_MULT[input.labour_weight_class ?? "standard"] ?? 1.0;

  let basePrice = crewSize * hours * labourRate * complexityMult * weightMult;
  if (weekend) basePrice += cfgNum(config, "labour_only_weekend", 100);
  if (afterHours) basePrice *= cfgNum(config, "labour_only_after_hours_multiplier", 1.15);

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

  let price = visit1Price + visit2Price + labourStorageFee;
  price = Math.max(price, cfgNum(config, "labour_only_minimum", 300));
  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const total = price + tax;

  // Deposit rules (operator decision 2026-06-11):
  //  1. Quotes under $550 (with tax) → full payment at booking.
  //  2. Booking less than 4 days from move → full payment at booking.
  //  3. Otherwise labour-only = flat $150 deposit (was 50%).
  // The 4-day window matches the 48-hour-before-move balance collection
  // window; a booking 3 days out leaves no operational gap to collect.
  const moveDateStr = (input.move_date ?? "").trim();
  let daysOut = Infinity;
  if (moveDateStr) {
    const target = new Date(`${moveDateStr.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(target.getTime())) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      daysOut = Math.floor(
        (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
      );
    }
  }
  const deposit = total < 550 || daysOut < 4 ? total : 150;

  // Internal ops context only — not shown on client quote.
  const labourIncludes = [
    `${crewSize}-person crew`,
    input.labour_truck_required ? `Truck included (+$${truckFee})` : "No truck required",
    ...(accessSurcharge > 0 ? [`Access surcharge: $${accessSurcharge}`] : []),
    ...(input.labour_storage_needed
      ? [`Storage between visits: ~${storageWeeks} week${storageWeeks !== 1 ? "s" : ""} @ $${storageWeekly}/wk`]
      : []),
    ...((input.labour_visits ?? 1) >= 2
      ? [
          `Visit 1 (${input.move_date ?? "TBD"}): $${visit1Price}`,
          `Visit 2 (${input.labour_second_visit_date ?? "TBD"}): $${visit2Price} (return visit discount)`,
        ]
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
      complexity: input.labour_complexity ?? "standard",
      complexity_multiplier: complexityMult,
      weight_class: input.labour_weight_class ?? "standard",
      weight_multiplier: weightMult,
      job_category: input.labour_job_category ?? null,
      labour_only_weekend_applied: weekend,
      labour_only_after_hours_applied: afterHours,
      truck_fee: truckFee,
      access_surcharge: accessSurcharge,
      visits: input.labour_visits ?? 1,
      visit1_price: visit1Price,
      visit2_price: visit2Price,
      visit2_date: input.labour_second_visit_date || null,
      labour_description: input.labour_description || null,
      parking_long_carry_total: plcLab.total,
      // Storage fields are conditionally stamped (2026-06-11): when the
      // client didn't request storage we DON'T leave the rate/needed
      // flags in factors_applied — the admin breakdown surface kept
      // rendering "Storage Weekly Rate $150" lines on labour-only jobs
      // that had no storage, which confused operators and clients on
      // every preview. Now the fields only appear when storage is real.
      ...(input.labour_storage_needed
        ? {
            labour_storage_needed: true,
            labour_storage_weeks: storageWeeks,
            storage_weekly_rate: storageWeekly,
            labour_storage_fee: labourStorageFee,
          }
        : {}),
    },
    labour: {
      crewSize,
      estimatedHours: hours,
      hoursRange: `${hours}hr`,
      truckSize: input.labour_truck_required ? "20ft" : "none",
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
  delete o.labour_validation;
  delete o.labour_validation_by_tier;
  delete o.building_profiles;
  return o;
}

// ═══════════════════════════════════════════════
// MAIN POST HANDLER
// ═══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // ─────────────────────────────────────────────────────────────────────
  // Outer try/catch around the entire handler.
  //
  // Background: this handler is ~1,500 lines covering every service type's
  // pricing math, distance lookups, addon resolution, DB writes, HubSpot
  // sync, and version snapshots. Any unhandled throw inside that block
  // bubbles up as a generic Next.js 500 with no body, which the admin
  // form surfaces as a bare "Failed to fetch" toast — useless for
  // debugging in production.
  //
  // The catch logs a structured error to the server (visible in Vercel
  // function logs) and returns a JSON body with a short detail string so
  // the form can show "Quote generation failed — {real cause}" instead
  // of "Failed to fetch". detail is capped at 200 chars to avoid leaking
  // stack traces to the client.
  // ─────────────────────────────────────────────────────────────────────
  try {
    return await handleQuoteGenerate(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[quotes/generate] Fatal error:", {
      message,
      stack,
      timestamp: new Date().toISOString(),
      url: req.url,
    });
    return NextResponse.json(
      {
        error: "Quote generation failed",
        detail: message.slice(0, 200),
      },
      { status: 500 },
    );
  }
}

async function handleQuoteGenerate(req: NextRequest): Promise<NextResponse> {
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

  if (input.service_type === "white_glove") {
    const wgRows = normalizeWhiteGloveItemsFromQuoteInput(input);
    if (!wgRows.some((i) => (i.description || "").trim().length > 0)) {
      return NextResponse.json(
        { error: "White Glove quotes need at least one item with a description" },
        { status: 400 },
      );
    }
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

  if (input.service_type === "event") {
    const evO = parsePositivePreTaxOverride(input.event_pre_tax_override);
    const evReason = String(input.event_pre_tax_override_reason || "").trim();
    if (evO !== undefined && evReason.length < 3) {
      return NextResponse.json(
        { error: "Event price override requires a reason (at least 3 characters)" },
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
  const needsMoveSizeForResidential = isLocalMove || isLongDistance;
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
  /** Inventory scoring: local residential only (not long_distance or white_glove). */
  const useInventoryScoring = isLocalMove;
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
  if (isLocalMove || isLongDistance) {
    const { data: br } = await sb
      .from("base_rates")
      .select("base_price")
      .eq("move_size", input.move_size!)
      .single();
    roughBase = br?.base_price ?? 999;
  } else if (input.service_type === "white_glove") {
    roughBase = cfgNum(config, "white_glove_addon_rough_base", 800);
  }

  const addonResult = await calculateAddons(sb, input.selected_addons, roughBase, input.move_size, input.service_type);

  // Inventory volume modifier (local_move only)
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
  // Declared here so it's in scope after the if/else block (used at calcResidential call site).
  let labourClientNoAssembly: LabourEstimate = null;

  if (adjustedScore > 0) {
    let catalogMinCrew: number | undefined;
    if ((input.inventory_items?.length ?? 0) > 0) {
      const { data: iwMin } = await sb
        .from("item_weights")
        .select("slug, num_people_min")
        .eq("active", true);
      const linesForCatalogCrew = (input.inventory_items ?? []).map((line) => {
        const raw = line.slug?.trim();
        if (!raw) return line;
        const mapped = LEGACY_SLUG_MAP[raw] ?? LEGACY_SLUG_MAP[raw.toLowerCase()];
        return mapped ? { ...line, slug: mapped } : line;
      });
      catalogMinCrew = catalogMinCrewFromInventorySlugs(linesForCatalogCrew, iwMin ?? []);
    }
    // Effective assembly minutes for this quote — used to bump labour hours.
    // Only apply when assembly is required (override beats auto-detection).
    const effectiveAssemblyOn =
      input.assembly_override !== undefined && input.assembly_override !== null
        ? input.assembly_override === true
        : input.assembly_required !== false;
    const labourAssemblyMinutes =
      effectiveAssemblyOn && (input.assembly_minutes ?? 0) > 0
        ? input.assembly_minutes!
        : 0;

    // Assembly is NOT included in Essential tier — it's an add-on.
    // Compute a no-assembly labour estimate for the Essential tier price,
    // and the standard (with-assembly) estimate for Signature and Estate.
    labourClientNoAssembly =
      labourAssemblyMinutes > 0
        ? estimateLabourFromScore(
            adjustedScore,
            distInfo?.distance_km ?? 0,
            input.from_access,
            input.to_access,
            input.move_size ?? "2br",
            {
              driveTimeMinutes: distInfo?.drive_time_min,
              specialtyItems: input.specialty_items,
              whiteGloveHoursMultiplier: false,
              hoursEstimateMode: "client_on_job",
              truckInventoryScore: truckInventoryScoreForLabour,
              catalogMinCrew,
              assemblyMinutes: 0,
            },
          )
        : null;

    labourClient = estimateLabourFromScore(
      adjustedScore,
      distInfo?.distance_km ?? 0,
      input.from_access,
      input.to_access,
      input.move_size ?? "2br",
      {
        driveTimeMinutes: distInfo?.drive_time_min,
        specialtyItems: input.specialty_items,
        whiteGloveHoursMultiplier: false,
        hoursEstimateMode: "client_on_job",
        truckInventoryScore: truckInventoryScoreForLabour,
        catalogMinCrew,
        assemblyMinutes: labourAssemblyMinutes,
      },
    );
  } else if (isLocalMove) {
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
  // Floor crew size by move-size. The inventory-score labour estimator can
  // return crew=2 on a sparse-inventory 3BR; operationally a 3BR move
  // needs 4 movers. Mirrors the truck floor a few lines above. See
  // src/lib/quotes/crew-and-truck-minimums.ts for rationale.
  // (Uses input.service_type directly because svcType isn't in scope yet
  //  here — declared a few lines below.)
  if (
    labour &&
    (input.service_type === "local_move" ||
      input.service_type === "long_distance") &&
    typeof labour.crewSize === "number"
  ) {
    const { floorMoversByMoveSize: _floorMov } = await import(
      "@/lib/quotes/crew-and-truck-minimums"
    );
    const flooredCrew = _floorMov(labour.crewSize, input.move_size);
    if (flooredCrew !== labour.crewSize) {
      labour = { ...labour, crewSize: flooredCrew };
    }
  }

  // Operator overrides — applied AFTER the move-size floor so the floor
  // still acts as a safety net, but coordinator wins for tighter values.
  // Pin crew / hours / truck when set. The hours-range string is
  // recomputed so the live preview shows the override (not the stale
  // engine estimate). Recorded in factors_applied.operator_overrides
  // for the audit trail.
  const operatorOverridesApplied: {
    crew?: { from: number; to: number };
    hours?: { from: number; to: number };
    truck?: { from: string; to: string };
  } = {};
  if (
    labour &&
    (input.service_type === "local_move" ||
      input.service_type === "long_distance")
  ) {
    if (
      typeof input.crew_size_override === "number" &&
      Number.isFinite(input.crew_size_override) &&
      input.crew_size_override >= 1 &&
      input.crew_size_override <= 8 &&
      input.crew_size_override !== labour.crewSize
    ) {
      operatorOverridesApplied.crew = {
        from: labour.crewSize,
        to: Math.round(input.crew_size_override),
      };
      labour = {
        ...labour,
        crewSize: Math.round(input.crew_size_override),
      };
    }
    if (
      typeof input.est_hours_override === "number" &&
      Number.isFinite(input.est_hours_override) &&
      input.est_hours_override >= 1 &&
      input.est_hours_override <= 24 &&
      Math.abs(input.est_hours_override - labour.estimatedHours) > 0.01
    ) {
      const newHours = Math.round(input.est_hours_override * 2) / 2;
      const lo = Math.max(1, Math.round((newHours * 0.93) * 2) / 2);
      const hi = Math.round((newHours * 1.07) * 2) / 2;
      operatorOverridesApplied.hours = {
        from: labour.estimatedHours,
        to: newHours,
      };
      labour = {
        ...labour,
        estimatedHours: newHours,
        hoursRange:
          lo === hi ? `${lo} hours` : `${lo}–${hi} hours`,
      };
    }
    if (
      typeof input.truck_size_override === "string" &&
      input.truck_size_override.trim() &&
      input.truck_size_override.trim() !== labour.truckSize
    ) {
      const tk = input.truck_size_override.trim();
      operatorOverridesApplied.truck = {
        from: labour.truckSize,
        to: tk,
      };
      labour = { ...labour, truckSize: tk };
    }
    // Mirror the same overrides onto the no-assembly variant used for
    // Essential tier pricing so the operator's crew/hours pin doesn't
    // get bypassed when assembly is required.
    if (labourClientNoAssembly) {
      if (operatorOverridesApplied.crew) {
        labourClientNoAssembly = {
          ...labourClientNoAssembly,
          crewSize: operatorOverridesApplied.crew.to,
        };
      }
      if (operatorOverridesApplied.hours) {
        labourClientNoAssembly = {
          ...labourClientNoAssembly,
          estimatedHours: operatorOverridesApplied.hours.to,
        };
      }
      if (operatorOverridesApplied.truck) {
        labourClientNoAssembly = {
          ...labourClientNoAssembly,
          truckSize: operatorOverridesApplied.truck.to,
        };
      }
    }
  }

  // Residential tier math must use the same labour model as `labour` in the JSON response
  // (client on-job hours). A separate ops-only estimate (full cycle / return) inflated preview
  // and new saves vs the crew/hours line coordinators see.
  const labourForResidential = labour;

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
  // Office scope tiers (Essential/Signature/Priority). Kept OUT of the
  // residential `tiers` variable on purpose — that block is hardcoded to
  // essential/signature/estate and would crash on office's `priority` key.
  // Persisted directly alongside custom_price (= the recommended Priority tier).
  let officeTiers: Record<string, TierResult> | undefined;
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
        labourClientNoAssembly ?? labourForResidential,
      );
      tiers = res.tiers;
      factors = res.factors;
      residentialCratingTotal = res.cratingTotal;
      estateSuppliesAllowance = res.estateSuppliesAllowance;
      // Use labour (inventory-based or base_rates fallback) when available so quote shows correct crew/hours
      displayCrew = labour ? labour.crewSize : res.minCrew;
      displayHours = labour ? labour.estimatedHours : res.estHours;
      // Audit: stash operator overrides into factors_applied so the
      // admin detail page can show "Crew 2 (override; engine wanted 3)"
      // and so re-quote can re-read the override on edit. Only present
      // when something was actually overridden.
      if (Object.keys(operatorOverridesApplied).length > 0) {
        factors = {
          ...factors,
          operator_overrides: operatorOverridesApplied,
        };
      }
      break;
    }
    case "office_move": {
      const officeInv = (input.office_inventory ?? []).filter(
        (l) => l && l.slug && Number(l.quantity) > 0,
      );
      if (officeInv.length > 0) {
        // Inventory-driven scope tiers (Essential / Signature / Priority).
        const oq = buildOfficeTierQuote(
          officeInv,
          {
            afterHours: !!input.office_after_hours,
            weekend: !!input.office_weekend,
            partialMove: !!input.office_partial_move,
            movingSqft: input.office_moving_sqft ?? null,
            totalOriginSqft: input.square_footage ?? null,
            distanceKm: distInfo?.distance_km ?? undefined,
          },
          {},
        );
        officeTiers = oq.tiers;
        // Recommended (Priority) tier is the single-price headline / deposit
        // source until the office layout renders all three (Phase 5).
        custom_price = oq.recommended;
        factors = oq.factors;
      } else {
        // Legacy workstation single-price (no inventory provided).
        const res = await calcOffice(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
        custom_price = res.custom_price;
        factors = res.factors;
      }
      break;
    }
    case "long_distance": {
      const res = await calcLongDistance(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      // Operator overrides audit (same shape as local_move). Long-
      // distance doesn't currently consume labour overrides in its own
      // calc, but we still surface the audit trail so the operator can
      // see what they pinned.
      if (Object.keys(operatorOverridesApplied).length > 0) {
        factors = {
          ...factors,
          operator_overrides: operatorOverridesApplied,
        };
      }
      break;
    }
    case "single_item": {
      const res = await calcSingleItem(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "white_glove": {
      const res = await calcWhiteGlove(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      const wf = res.factors as {
        white_glove_crew?: number;
        white_glove_hours?: number;
        truck_recommended?: string;
      };
      displayCrew = wf.white_glove_crew ?? 2;
      displayHours = wf.white_glove_hours ?? 2;
      labour = {
        crewSize: displayCrew,
        estimatedHours: displayHours,
        hoursRange: `${displayHours}hr`,
        truckSize: wf.truck_recommended ?? "sprinter",
      };
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

  let estimatedDaysForQuoteRow = 1;
  let dayBreakdownForQuoteRow: unknown[] = [];

  if (svcType === "local_move" && tiers) {
    const addonSlugs = addonResult.breakdown.map((b) => b.slug);
    const msScope = computeMoveScopeAddonPreTax(config, {
      tier: normalizeRecommendedTierForDb(input.recommended_tier),
      move_size: input.move_size ?? "2br",
      specialty_items: input.specialty_items,
      crating_required: !!(input.crating_pieces && input.crating_pieces.length > 0),
      addon_slugs: addonSlugs,
      estimated_days_override: clampEstimatedDaysOverride(input.move_scope?.estimated_days_override),
      optional_additional_volume_day: !!input.move_scope?.optional_additional_volume_day,
    });
    estimatedDaysForQuoteRow = msScope.effectiveDays;
    dayBreakdownForQuoteRow = msScope.breakdownJson;
    if (msScope.totalAddonPreTax > 0) {
      const bumped = applyMoveScopeAddonToResidentialTiers(
        {
          essential: tiers.essential,
          signature: tiers.signature,
          estate: tiers.estate,
        },
        msScope.totalAddonPreTax,
        config,
      );
      tiers = {
        essential: bumped.essential,
        signature: bumped.signature,
        estate: bumped.estate,
      };
    }
    const clientMoveScopeSchedule = buildMoveScopeClientSchedule({
      breakdown: msScope.breakdownJson,
    })
    factors = {
      ...factors,
      move_scope_addon_lines: msScope.lines,
      move_scope_addon_pre_tax_total: msScope.totalAddonPreTax,
      move_scope_detected_days: msScope.detectedDays,
      move_scope_effective_days: msScope.effectiveDays,
      move_scope_day_summary: msScope.daySummaryParts,
      ...(clientMoveScopeSchedule.dayLines.length > 0
        ? {
            move_scope_client_service_label: clientMoveScopeSchedule.serviceLabel,
            move_scope_client_day_lines: clientMoveScopeSchedule.dayLines,
          }
        : {}),
    };
  }

  if (svcType === "long_distance" && custom_price) {
    const addonSlugsLd = addonResult.breakdown.map((b) => b.slug);
    const msScopeLd = computeMoveScopeAddonPreTax(config, {
      tier: normalizeRecommendedTierForDb(input.recommended_tier),
      move_size: input.move_size ?? "2br",
      specialty_items: input.specialty_items,
      crating_required: !!(input.crating_pieces && input.crating_pieces.length > 0),
      addon_slugs: addonSlugsLd,
      estimated_days_override: clampEstimatedDaysOverride(input.move_scope?.estimated_days_override),
      optional_additional_volume_day: !!input.move_scope?.optional_additional_volume_day,
    });
    estimatedDaysForQuoteRow = msScopeLd.effectiveDays;
    dayBreakdownForQuoteRow = msScopeLd.breakdownJson;
    if (msScopeLd.totalAddonPreTax > 0) {
      const taxRLd = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
      const newPriceLd = custom_price.price + msScopeLd.totalAddonPreTax;
      const newTaxLd = Math.round(newPriceLd * taxRLd);
      custom_price = {
        ...custom_price,
        price: newPriceLd,
        tax: newTaxLd,
        total: newPriceLd + newTaxLd,
      };
    }
    const clientMoveScopeScheduleLd = buildMoveScopeClientSchedule({
      breakdown: msScopeLd.breakdownJson,
    });
    factors = {
      ...factors,
      move_scope_addon_lines: msScopeLd.lines,
      move_scope_addon_pre_tax_total: msScopeLd.totalAddonPreTax,
      move_scope_detected_days: msScopeLd.detectedDays,
      move_scope_effective_days: msScopeLd.effectiveDays,
      move_scope_day_summary: msScopeLd.daySummaryParts,
      ...(clientMoveScopeScheduleLd.dayLines.length > 0
        ? {
            move_scope_client_service_label: clientMoveScopeScheduleLd.serviceLabel,
            move_scope_client_day_lines: clientMoveScopeScheduleLd.dayLines,
          }
        : {}),
    };
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

  if (factors && factors.truck_recommended != null && factors.truck_breakdown_line == null) {
    const tk = normalizeTruckType(String(factors.truck_recommended));
    factors = { ...factors, truck_breakdown_line: formatTruckBreakdownLine(tk, config) };
  }

  // For non-residential custom_price quotes, add coordinator crating lines to subtotal
  if (custom_price && globalCratingTotal > 0) {
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

  if (svcType === "event" && custom_price) {
    const evOvr = parsePositivePreTaxOverride(input.event_pre_tax_override);
    if (evOvr !== undefined) {
      const evReason = String(input.event_pre_tax_override_reason || "").trim();
      const taxR = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
      const minEvDep = cfgNum(config, "event_min_deposit", 300);
      factors = {
        ...factors,
        event_system_pre_tax_total_before_override: custom_price.price,
        event_pre_tax_override_applied: true,
        event_pre_tax_override: evOvr,
        event_pre_tax_override_reason: evReason || null,
      };
      custom_price = {
        ...custom_price,
        price: evOvr,
        tax: Math.round(evOvr * taxR),
        total: evOvr + Math.round(evOvr * taxR),
        deposit: Math.max(minEvDep, Math.ceil(evOvr * 0.25)),
      };
    }
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
    "16ft": "16ft fully equipped truck",
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
    // The truck label that gets stored on quote.truck_primary (and
    // shown in MOVE DETAILS) is residentialPricedTruck — derived from
    // factors.truck_recommended in calcResidential. allocateTruck()
    // and recTruck can disagree (e.g. 3BR with light inventory: pricing
    // truck = 24ft, allocator = 20ft). The previous code used the
    // allocator value here, so MOVE DETAILS read 24ft while the tier
    // bullet said "20ft dedicated moving truck" — clients saw the
    // contradiction. Always prefer the priced truck when it's set;
    // fall back to the allocator only when the priced truck is missing.
    const preferredTruckKey =
      residentialPricedTruck && residentialPricedTruck !== "none"
        ? residentialPricedTruck
        : truckResult.primary.vehicle_type;
    const primaryDisplay =
      TRUCK_DISPLAY[preferredTruckKey] ||
      TRUCK_DISPLAY[truckResult.primary.vehicle_type] ||
      truckResult.primary.display_name;
    const truckLine = truckResult.isMultiVehicle && truckResult.secondary
      ? `${primaryDisplay} + support van`
      : primaryDisplay;
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

  const moveProjectParsed = moveProjectPayloadSchema.safeParse(input.move_project);
  if (
    moveProjectParsed.success &&
    svcType !== "local_move" &&
    (svcType === "long_distance" ||
      svcType === "office_move" ||
      svcType === "white_glove")
  ) {
    const fObj = factors as Record<string, unknown>;
    // Fallback bumped from 55 → 65 to match the new luxury Essential baseline
    // (2026-06-11). See migration 20260611000000_labour_rate_luxury_calibration.
    const labourRate =
      typeof fObj.labour_rate === "number" && Number.isFinite(fObj.labour_rate)
        ? fObj.labour_rate
        : cfgNum(config, "labour_rate_per_mover_hour", 65);
    const pricing = computeMoveProjectPricingPreview(moveProjectParsed.data, {
      labourRatePerMoverHour: labourRate,
      truckDayRate: cfgNum(config, "move_project_truck_day_rate", 135),
      fuelFlat: cfgNum(config, "move_project_fuel_flat", 45),
      workstationRatePerSeat: cfgNum(config, "move_project_workstation_rate", 85),
      serverRoomFlat: cfgNum(config, "move_project_server_room_flat", 2500),
      boardroomFlatEach: cfgNum(config, "move_project_boardroom_each", 600),
      breakRoomFlat: cfgNum(config, "move_project_break_room_flat", 800),
      receptionFlat: cfgNum(config, "move_project_reception_flat", 600),
    });
    const marginFrac = cfgNum(config, "margin_target_estate", 45) / 100;
    factors = {
      ...factors,
      move_project_pricing_preview: {
        labour_subtotal: pricing.labourSubtotal,
        office_commercial_subtotal: pricing.officeCommercialSubtotal,
        truck_subtotal: pricing.truckSubtotal,
        fuel: pricing.fuel,
        total_cost_estimate: pricing.totalCostEstimate,
        lines: pricing.lines,
        suggested_pre_tax_at_estate_margin: priceFromCostAndMargin(pricing.totalCostEstimate, marginFrac),
      },
    };
    if ((svcType === "long_distance" || svcType === "office_move") && tiers) {
      const br = buildResidentialProjectQuoteBreakdown({
        config,
        recommendedTier: normalizeRecommendedTierForDb(input.recommended_tier),
        primaryMoveSize: input.move_size ?? "2br",
        tiers: {
          essential: { price: tiers.essential.price },
          signature: { price: tiers.signature.price },
          estate: { price: tiers.estate.price },
        },
        moveProject: moveProjectParsed.data,
        inventoryItems: (input.inventory_items ?? []) as Parameters<
          typeof buildResidentialProjectQuoteBreakdown
        >[0]["inventoryItems"],
      });
      factors = { ...factors, project_quote_breakdown: br };
    }
  }

  const enginePreTaxHeadline = tiers ? tiers.essential.price : custom_price?.price ?? 0;
  factors = { ...factors, system_price: enginePreTaxHeadline };

  // ── Per-tier price overrides ────────────────────────────────────────
  // Apply BEFORE the global ratio-based override so the two systems
  // compose cleanly: per-tier targets a specific tier with an absolute
  // price (e.g. "Estate at $6,000 to match a competitor"); global
  // proportionally scales whatever is left.
  //
  // Validation:
  //   - residential tiered quotes only (tiers is null for custom_price)
  //   - each override price must be a positive finite number
  //   - reason must be ≥ 3 chars (mirrors global override rule)
  //   - unknown tier keys are ignored silently
  if (
    tiers &&
    input.tier_price_overrides &&
    typeof input.tier_price_overrides === "object"
  ) {
    const taxRateLocal = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
    const depKeyLocal: string = (() => {
      switch (svcType) {
        case "local_move":
          return "residential";
        case "long_distance":
          return "long_distance";
        case "office_move":
          return "office";
        case "single_item":
          return "single_item";
        case "white_glove":
          return "white_glove";
        case "specialty":
          return "specialty";
        default:
          return "residential";
      }
    })();
    const tierOverridesApplied: Array<{
      tier: string;
      original: number;
      override: number;
      reason: string;
    }> = [];
    const nextTiers: Record<string, TierResult> = { ...tiers };
    for (const tk of ["essential", "signature", "estate"] as const) {
      const ovEntry = input.tier_price_overrides[tk];
      if (!ovEntry || typeof ovEntry !== "object") continue;
      const ovPrice = Number(ovEntry.price);
      if (!Number.isFinite(ovPrice) || ovPrice <= 0) continue;
      const ovReason = String(ovEntry.reason ?? "").trim();
      if (ovReason.length < 3) {
        return NextResponse.json(
          {
            error: `Per-tier override on ${tk} requires a reason (at least 3 characters).`,
          },
          { status: 400 },
        );
      }
      const t = tiers[tk];
      if (!t) continue;
      const newPrice = Math.round(ovPrice);
      const newDeposit = await calculateDeposit(sb, depKeyLocal, newPrice, input.move_date);
      nextTiers[tk] = {
        ...t,
        price: newPrice,
        tax: Math.round(newPrice * taxRateLocal),
        total: Math.round(newPrice * (1 + taxRateLocal)),
        deposit: newDeposit,
      };
      tierOverridesApplied.push({
        tier: tk,
        original: t.price,
        override: newPrice,
        reason: ovReason,
      });
    }
    if (tierOverridesApplied.length > 0) {
      tiers = nextTiers;
      factors = {
        ...factors,
        tier_overrides_applied: tierOverridesApplied,
      };
    }
  }

  const quoteOvr = parsePositivePreTaxOverride(input.quote_price_override);
  const quoteOvrReason = String(input.quote_price_override_reason ?? "").trim();
  if (quoteOvr !== undefined) {
    if (quoteOvrReason.length < 3) {
      return NextResponse.json(
        { error: "Price override requires a reason (at least 3 characters)" },
        { status: 400 },
      );
    }
    if (svcType === "b2b_delivery" || svcType === "b2b_oneoff") {
      return NextResponse.json(
        {
          error:
            "Global quote override is not used for B2B — use the dimensional override fields.",
        },
        { status: 400 },
      );
    }
    const taxOvr = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
    const depositSvcMap: Record<string, string> = {
      local_move: "residential",
      long_distance: "long_distance",
      office_move: "office",
      single_item: "single_item",
      white_glove: "white_glove",
      specialty: "specialty",
    };
    const depKey = depositSvcMap[svcType] ?? "specialty";

    // Short-notice rule shared with the main engine path (see top of
    // calculateDeposit). Centralises so an override doesn't accidentally
    // bypass the 4-day full-payment cutoff.
    const moveDateForDep = input.move_date ?? null;
    let daysOutForDep = Infinity;
    if (moveDateForDep) {
      const target = new Date(`${String(moveDateForDep).slice(0, 10)}T00:00:00`);
      if (!Number.isNaN(target.getTime())) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        daysOutForDep = Math.floor(
          (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
        );
      }
    }
    async function depositAfterOverride(preTax: number): Promise<number> {
      const tot = Math.round(preTax * (1 + taxOvr));
      if (daysOutForDep < 4) return tot;
      if (svcType === "event") {
        const minDeposit = cfgNum(config, "event_min_deposit", 300);
        return Math.max(minDeposit, Math.ceil(preTax * 0.25));
      }
      if (svcType === "labour_only") {
        // Flat $150 deposit when booked 4+ days out (operator change
        // 2026-06-11 — old 50% rule was too aggressive). Under-4-days
        // already returned `tot` above.
        return tot < 550 ? tot : 150;
      }
      return calculateDeposit(sb, depKey, preTax, moveDateForDep);
    }

    if (custom_price && !tiers) {
      const depO = await depositAfterOverride(quoteOvr);
      custom_price = {
        ...custom_price,
        price: quoteOvr,
        tax: Math.round(quoteOvr * taxOvr),
        total: Math.round(quoteOvr * (1 + taxOvr)),
        deposit: depO,
      };
    } else if (tiers?.essential && tiers.essential.price > 0) {
      const ratio = quoteOvr / tiers.essential.price;
      const nextTiers: Record<string, TierResult> = { ...tiers };
      for (const tk of ["essential", "signature", "estate"] as const) {
        const t = tiers[tk];
        if (!t) continue;
        const np = Math.max(0, Math.round(t.price * ratio));
        const nd = Math.max(0, Math.round(t.deposit * ratio));
        nextTiers[tk] = {
          ...t,
          price: np,
          tax: Math.round(np * taxOvr),
          total: Math.round(np * (1 + taxOvr)),
          deposit: nd,
        };
      }
      tiers = nextTiers;
    }
    // Zero out engine-computed surcharge fields. The override sets a
    // new headline price that ignores the engine's per-component math,
    // but the old surcharge values stay in factors_applied unless we
    // explicitly clear them. Left in place, they confused the client
    // quote page (e.g. "Distance $1,850" rendered above a $1,100 total)
    // and made audit logs / admin tools show contradictory numbers.
    // Setting to 0 makes downstream `f?.xxx_surcharge && {...}` checks
    // falsy so they drop out of breakdown tables cleanly. We keep
    // descriptive fields (project_base, truck_recommended, building
    // requirements, access difficulty, system_price) since they're
    // factual context, not pricing claims.
    const engineSurchargeFields = [
      "distance_surcharge",
      "crating_surcharge",
      "climate_surcharge",
      "equipment_surcharge",
      "custom_crating_surcharge",
      "climate_control_surcharge",
      "timeline_surcharge",
      "parking_long_carry_total",
      "truck_surcharge",
      "base_estimate",
      "weight_surcharge",
      "access_surcharge",
      "long_carry_surcharge",
      "stairs_surcharge",
    ] as const;
    const cleared: Record<string, number> = {};
    for (const field of engineSurchargeFields) {
      if (field in (factors as Record<string, unknown>)) cleared[field] = 0;
    }
    factors = {
      ...factors,
      ...cleared,
      override_price_pre_tax: quoteOvr,
      override_reason: quoteOvrReason,
    };
  }

  // ── Recompute margin %s against FINAL tier prices ───────────────────
  // estimated_margin_* was first computed inside calcResidential using
  // the pre-addon tier prices (lines ~1999-2003). Several price-changing
  // steps happen after that:
  //   1. applyMoveScopeAddonToResidentialTiers bumps Essential/Signature
  //   2. Per-tier overrides (tier_price_overrides)
  //   3. Global override (quote_price_override)
  // Without this recompute the persisted margin% reflects pre-addon
  // prices — e.g. Essential showed 7% when actual margin on the final
  // $3,100 price is ~46%. We use the same cost basis as calcResidential
  // (estimated_cost.total for Essential/Signature; total_estate_ops for
  // Estate which uses estateLoadedLabourCost).
  if (tiers) {
    const fr = factors as Record<string, unknown>;
    const cost = fr.estimated_cost as
      | { total?: number; total_estate_ops?: number }
      | undefined;
    const costTotal =
      cost && typeof cost.total === "number" ? cost.total : null;
    const costTotalEstateOps =
      cost && typeof cost.total_estate_ops === "number"
        ? cost.total_estate_ops
        : costTotal;
    const marginFor = (price: number, c: number | null): number | null => {
      if (c == null || price <= 0) return null;
      return Math.round(((price - c) / price) * 100);
    };
    const essPrice = tiers.essential?.price ?? 0;
    const sigPrice = tiers.signature?.price ?? 0;
    const estPriceFinal = tiers.estate?.price ?? 0;
    const newEssMargin = marginFor(essPrice, costTotal);
    const newSigMargin = marginFor(sigPrice, costTotal);
    const newEstMargin = marginFor(estPriceFinal, costTotalEstateOps);
    factors = {
      ...factors,
      ...(newEssMargin != null
        ? {
            estimated_margin_essential: newEssMargin,
            estimated_margin_curated: newEssMargin, // legacy alias
          }
        : {}),
      ...(newSigMargin != null
        ? { estimated_margin_signature: newSigMargin }
        : {}),
      ...(newEstMargin != null
        ? { estimated_margin_estate: newEstMargin }
        : {}),
    };
  }

  // Persist the coordinator's name into factors_applied so the
  // booking → move-create path can copy it onto moves.coordinator_name.
  // Kept as a string (never the literal "false") — empty trims become null.
  if (typeof input.coordinator_name === "string") {
    const trimmed = input.coordinator_name.trim();
    (factors as Record<string, unknown>).coordinator_name =
      trimmed.length > 0 ? trimmed : null;
  }

  const factorsRecord = factors as Record<string, unknown>
  const distKmLabour = distInfo?.distance_km ?? 0
  const svcForLabour =
    svcType === "b2b_oneoff" ? "b2b_delivery" : svcType
  const accessLabour = aggregateAccessSurchargesForLabourValidation(factorsRecord)
  const specialtyLabour = aggregateSpecialtySurchargesForLabourValidation(svcType, factorsRecord)
  const truckLabour = truckTypeForLabourValidation(factorsRecord)
  const { crewSize: labCrew, estimatedHours: labHours } = resolveLabourValidationCrewHours(
    svcType,
    labour,
    displayCrew,
    displayHours,
    factorsRecord,
  )

  let labour_validation_by_tier: Record<string, LabourValidationResult> | undefined
  let labour_validation_primary: LabourValidationResult

  if (tiers) {
    labour_validation_by_tier = {}
    for (const tk of ["essential", "signature", "estate"] as const) {
      const tierRow = tiers[tk]
      if (!tierRow) continue
      labour_validation_by_tier[tk] = validateLabourRate(
        {
          serviceType: svcForLabour,
          tier: tk,
          totalPrice: tierRow.price,
          crewSize: labCrew,
          estimatedHours: labHours,
          truckType: truckLabour,
          distanceKm: distKmLabour,
          specialtySurcharges: specialtyLabour,
          accessSurcharges: accessLabour,
        },
        config,
      )
    }
    labour_validation_primary =
      labour_validation_by_tier.essential ??
      labour_validation_by_tier.signature ??
      Object.values(labour_validation_by_tier)[0] ??
      validateLabourRate(
        {
          serviceType: svcForLabour,
          tier: "essential",
          totalPrice: 0,
          crewSize: Math.max(1, labCrew),
          estimatedHours: Math.max(0.25, labHours),
          truckType: truckLabour,
          distanceKm: distKmLabour,
          specialtySurcharges: specialtyLabour,
          accessSurcharges: accessLabour,
        },
        config,
      )
  } else if (custom_price) {
    labour_validation_primary = validateLabourRate(
      {
        serviceType: svcForLabour,
        tier: "essential",
        totalPrice: custom_price.price,
        crewSize: labCrew,
        estimatedHours: labHours,
        truckType: truckLabour,
        distanceKm: distKmLabour,
        specialtySurcharges: specialtyLabour,
        accessSurcharges: accessLabour,
      },
      config,
    )
  } else {
    labour_validation_primary = validateLabourRate(
      {
        serviceType: svcForLabour,
        tier: "essential",
        totalPrice: enginePreTaxHeadline,
        crewSize: Math.max(1, labCrew),
        estimatedHours: Math.max(0.25, labHours),
        truckType: truckLabour,
        distanceKm: distKmLabour,
        specialtySurcharges: specialtyLabour,
        accessSurcharges: accessLabour,
      },
      config,
    )
  }

  factors = {
    ...factors,
    labour_validation: labour_validation_primary,
    ...(labour_validation_by_tier ? { labour_validation_by_tier } : {}),
  }

  const isUpdate = !isPreview && !!input.quote_id?.trim();
  let quoteId: string;
  // For in-place updates, fetch the full current row so we can snapshot it before overwriting.
  let existingQuoteSnapshot: Record<string, unknown> | null = null;
  if (isPreview) {
    quoteId = "PREVIEW";
  } else if (isUpdate) {
    const { data: existing } = await sb.from("quotes").select("*").eq("quote_id", input.quote_id!.trim()).maybeSingle();
    quoteId = existing?.quote_id ?? (await generateNextQuoteId(sb, nextQuoteIdOpts));
    existingQuoteSnapshot = existing as Record<string, unknown> | null;
  } else {
    quoteId = await generateNextQuoteId(sb, nextQuoteIdOpts);
  }

  const primaryPrice = tiers ? tiers.essential.price : custom_price!.price;
  const storedTaxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const primaryTotal = primaryPrice + Math.round(primaryPrice * storedTaxRate);
  const computedDeposit = tiers ? tiers.essential.deposit : custom_price!.deposit;
  // Global rule: any quote under $550 (total with tax) requires full payment at booking.
  const depositAmount = primaryTotal < 550 ? primaryTotal : computedDeposit;

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

  // R2: per-service-type quote validity. Reads quote_expiry_policy first;
  // falls back to the global platform_config default if no row exists.
  // The wholesale verticals (white_glove_swap, b2b_delivery) need a much
  // longer horizon than the 7-day residential default.
  let expiryDays = cfgNum(config, "quote_expiry_days", 7);
  {
    const expiryServiceKey =
      svcType === "b2b_oneoff" ? "b2b_delivery" : svcType;
    const { data: policyRow } = await sb
      .from("quote_expiry_policy")
      .select("days")
      .eq("service_type", expiryServiceKey)
      .maybeSingle();
    if (policyRow?.days && Number.isFinite(Number(policyRow.days))) {
      expiryDays = Number(policyRow.days);
    }
  }

  if (!isPreview) {
    const mpForFlags = moveProjectPayloadSchema.safeParse(input.move_project);
    const extraPickCount =
      input.additional_pickup_addresses?.filter((a) => String(a.address ?? "").trim()).length ?? 0;
    const extraDropCount =
      input.additional_dropoff_addresses?.filter((a) => String(a.address ?? "").trim()).length ?? 0;
    const multiLocQuote = extraPickCount > 0 || extraDropCount > 0;
    const isProjectQuote =
      mpForFlags.success ||
      ((svcType === "local_move" || svcType === "long_distance") &&
        (estimatedDaysForQuoteRow > 1 || multiLocQuote));

    const quotePayload = {
      hubspot_deal_id: input.hubspot_deal_id || null,
      quote_source: input.quote_source?.trim() || null,
      source_request_id: input.source_request_id?.trim() || null,
      contact_id: contactId,
      service_type: svcType === "b2b_oneoff" ? "b2b_delivery" : svcType === "event" ? "event" : svcType === "labour_only" ? "labour_only" : svcType,
      status: "draft",
      is_project: isProjectQuote,
      origin_count: mpForFlags.success
        ? mpForFlags.data.origins.length
        : svcType === "local_move" || svcType === "long_distance"
          ? 1 + extraPickCount
          : null,
      destination_count: mpForFlags.success
        ? mpForFlags.data.destinations.length
        : svcType === "local_move" || svcType === "long_distance"
          ? 1 + extraDropCount
          : null,
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
      preferred_time: input.preferred_time?.trim() || null,
      arrival_window: input.arrival_window?.trim() || null,
      move_size: input.move_size || null,
      distance_km: distInfo?.distance_km ?? null,
      drive_time_min: distInfo?.drive_time_min ?? null,
      specialty_items: input.specialty_items ?? [],
      tiers: tiers ?? officeTiers ?? null,
      custom_price: custom_price?.price ?? null,
      system_price: enginePreTaxHeadline,
      override_price: quoteOvr !== undefined ? quoteOvr : null,
      override_reason: quoteOvr !== undefined ? quoteOvrReason : null,
      override_by: quoteOvr !== undefined ? authUser?.id ?? null : null,
      // Per-tier price overrides — sanitised copy of what was applied.
      // Cleared (set to null) when the input doesn't carry any overrides
      // so regenerating a quote can also REMOVE overrides cleanly.
      tier_price_overrides: (() => {
        const map = input.tier_price_overrides;
        if (!map || typeof map !== "object") return null;
        const out: Record<string, { price: number; reason: string }> = {};
        for (const tk of ["essential", "signature", "estate"] as const) {
          const ov = map[tk];
          if (!ov || typeof ov !== "object") continue;
          const p = Number(ov.price);
          const r = String(ov.reason ?? "").trim();
          if (!Number.isFinite(p) || p <= 0 || r.length < 3) continue;
          out[tk] = { price: Math.round(p), reason: r };
        }
        return Object.keys(out).length > 0 ? out : null;
      })(),
      // R2: structured override-reason code from controlled taxonomy.
      // Only persisted when an override is applied; null otherwise.
      override_reason_code:
        quoteOvr !== undefined
          ? input.quote_price_override_reason_code?.trim() || null
          : null,
      // Presentation mode — only respected when recommended_tier is
      // 'estate' and service is residential/long-distance; otherwise
      // forced to 'comparison' so the column never carries a
      // non-meaningful state for non-Estate quotes.
      //
      // Default for Estate quotes: when the admin form doesn't send an
      // explicit presentation_mode, fall back to 'estate_featured' (not
      // 'comparison'). Reason: an Estate recommendation already says
      // "this is the right tier for the client" — comparison mode then
      // anchors the email on Essential's lower price, which is the
      // opposite of what the operator's recommendation intended. Older
      // quotes that explicitly chose 'comparison' still get it.
      presentation_mode: (() => {
        const requested = input.presentation_mode;
        const tierOk =
          normalizeRecommendedTierForDb(input.recommended_tier) === "estate";
        const serviceOk =
          svcType === "local_move" || svcType === "long_distance";
        if (!tierOk || !serviceOk) return "comparison";
        if (
          requested === "comparison" ||
          requested === "estate_featured" ||
          requested === "estate_only"
        ) {
          return requested;
        }
        // No explicit mode + Estate recommendation = estate_featured.
        return "estate_featured";
      })(),
      // R2: declared cargo value at quote time (mirrors moves.declared_value).
      declared_value:
        typeof input.declared_value === "number" && Number.isFinite(input.declared_value)
          ? input.declared_value
          : null,
      // R2: bill-to vs deliver-to consignee separation.
      deliver_to_name: input.deliver_to_name?.trim() || null,
      deliver_to_email: input.deliver_to_email?.trim() || null,
      deliver_to_phone: input.deliver_to_phone?.trim() || null,
      deliver_to_notes: input.deliver_to_notes?.trim() || null,
      // R2: inbound shipment link for receive-and-deliver scopes.
      inbound_shipment_id: input.inbound_shipment_id?.trim() || null,
      deposit_amount: depositAmount,
      factors_applied: factors,
      selected_addons: addonResult.breakdown,
      expires_at: new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
      inventory_items: input.inventory_items ?? [],
      client_box_count: input.client_box_count ?? null,
      inventory_warnings: inventoryWarnings.length > 0 ? inventoryWarnings : [],
      // Assembly auto-detection (residential)
      assembly_required:
        input.assembly_required !== undefined ? input.assembly_required : null,
      assembly_auto_detected: input.assembly_auto_detected ?? false,
      assembly_items: input.assembly_items ?? [],
      assembly_override:
        input.assembly_override !== undefined ? input.assembly_override : null,
      assembly_minutes: input.assembly_minutes ?? null,
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
      // Single-item is non-tiered — never stamp a residential tier on it (was
      // defaulting to 'signature', which then leaked into confirmation emails).
      recommended_tier:
        svcType === "single_item"
          ? null
          : normalizeRecommendedTierForDb(input.recommended_tier),
      crating_pieces: input.crating_pieces ?? [],
      crating_total: cratingForDisplay,
      supplies_allowance: estateSuppliesAllowance,
      labour_rate_per_mover: labour_validation_primary.effectiveRate,
      labour_validation_status: labour_validation_primary.status,
      labour_validation_message: labour_validation_primary.message,
      labour_component: labour_validation_primary.labourComponent,
      non_labour_component: labour_validation_primary.nonLabourComponent,
      estimated_days:
        svcType === "local_move" || svcType === "long_distance"
          ? estimatedDaysForQuoteRow
          : 1,
      day_breakdown:
        svcType === "local_move" || svcType === "long_distance" ? dayBreakdownForQuoteRow : [],
      multi_location: multiLocQuote,
      additional_origins: input.additional_pickup_addresses ?? [],
      additional_destinations: input.additional_dropoff_addresses ?? [],
      // ── Single-item multi-line + junk-removal stop (Phase 1 schema) ───
      // For non-single_item service types these are empty/null defaults, which
      // is what the columns already are. We always write them on single_item
      // so re-saves don't leave stale per-line data.
      ...(svcType === "single_item"
        ? {
            quote_items: Array.isArray(input.quote_items)
              ? input.quote_items
              : [],
            junk_pickup_from: input.junk_pickup_from ?? null,
            junk_items_description:
              input.junk_items_description?.trim() || null,
            junk_items_count:
              typeof input.junk_items_count === "number" &&
              input.junk_items_count > 0
                ? Math.floor(input.junk_items_count)
                : null,
          }
        : {}),
      // ── Version tracking (in-place updates only) ──────────────────────
      ...(isUpdate && existingQuoteSnapshot ? {
        version: ((existingQuoteSnapshot.version as number) ?? 1) + 1,
        last_regenerated_at: new Date().toISOString(),
        last_regenerated_by: authUser?.id ?? null,
        is_revised: ["sent", "viewed"].includes(String(existingQuoteSnapshot.status ?? "")),
      } : {}),
      // ── Tier ops snapshot (residential) — freezes the service contract at booking time ──
      ...(svcType === "local_move" || svcType === "long_distance"
        ? {
            tier_ops_snapshot: {
              essential: TIER_DEFINITIONS.essential.ops,
              signature: TIER_DEFINITIONS.signature.ops,
              estate: TIER_DEFINITIONS.estate.ops,
            },
          }
        : {}),
    };

    if (isUpdate) {
      // Snapshot the current quote row before overwriting it
      if (existingQuoteSnapshot?.id) {
        const currentVersion = (existingQuoteSnapshot.version as number) ?? 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any).from("quote_versions").insert({
          quote_id: existingQuoteSnapshot.id as string,
          version_number: currentVersion,
          snapshot: existingQuoteSnapshot,
          regenerated_by: authUser?.id ?? null,
          created_at: new Date().toISOString(),
        }).then(() => {}).catch(() => {}); // non-fatal, fire-and-forget
      }

      const { error: updateErr } = await sb.from("quotes").update(quotePayload).eq("quote_id", quoteId);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      // Propagate est_hours change to any linked move so the move page always
      // displays the same duration as the quote page.
      const newEstHours = quotePayload.est_hours as number | null;
      if (newEstHours != null && Number.isFinite(newEstHours) && newEstHours > 0) {
        const { data: qRow } = await sb.from("quotes").select("id").eq("quote_id", quoteId).maybeSingle();
        if (qRow?.id) {
          const newMins = Math.round(newEstHours * 60);
          await sb
            .from("moves")
            .update({
              est_hours: newEstHours,
              estimated_duration_minutes: newMins,
            })
            .eq("quote_id", qRow.id)
            .in("status", ["pending", "pending_approval", "confirmed"]);
        }
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

    const { data: qUuidRow } = await sb.from("quotes").select("id").eq("quote_id", quoteId).maybeSingle();
    if (qUuidRow?.id) {
      if (svcType === "local_move") {
        await clearMoveProjectFromQuote(sb, qUuidRow.id);
      } else if (input.clear_move_project) {
        await clearMoveProjectFromQuote(sb, qUuidRow.id);
      } else if (input.move_project != null && typeof input.move_project === "object") {
        const parsedMp = moveProjectPayloadSchema.safeParse(input.move_project);
        if (parsedMp.success) {
          try {
            const fa = factors as Record<string, unknown>;
            const br = fa.project_quote_breakdown as ProjectQuoteBreakdown | undefined;
            let mpPayload = parsedMp.data;
            if (br && typeof br.subtotal_pre_tax === "number") {
              mpPayload = {
                ...mpPayload,
                total_price: br.subtotal_pre_tax,
                deposit: br.deposit,
                payment_schedule: br.payment_schedule,
              };
            }
            await upsertMoveProjectForQuote(sb, {
              quoteUuid: qUuidRow.id,
              contactId,
              partnerId: null,
              payload: mpPayload,
              persist: true,
            });
          } catch (e) {
            console.error("[quotes/generate] move_project persist:", e);
            return NextResponse.json(
              { error: e instanceof Error ? e.message : "Failed to save move project" },
              { status: 500 },
            );
          }
        }
      }
    }

    const reqId = input.source_request_id?.trim();
    if (reqId && qUuidRow?.id) {
      await sb
        .from("quote_requests")
        .update({
          quote_id: qUuidRow.id,
          converted_at: new Date().toISOString(),
          status: "quote_sent",
        })
        .eq("id", reqId);
    }

    // ── Multi-scenario: persist scenarios and flag the quote ──
    if (!isPreview && qUuidRow?.id && input.is_multi_scenario && Array.isArray(input.scenarios) && input.scenarios.length >= 2) {
      await sb.from("quote_scenarios").delete().eq("quote_id", qUuidRow.id);
      const HST_RATE = 0.13;
      const rows = input.scenarios.map((s) => {
        const priceNum = typeof s.price === "number" && s.price > 0 ? s.price : null;
        const hst = priceNum != null ? Math.round(priceNum * HST_RATE) : null;
        const totalPrice = priceNum != null ? priceNum + (hst ?? 0) : null;
        return {
          quote_id: qUuidRow.id,
          scenario_number: s.scenario_number,
          label: s.label?.trim() || `Option ${s.scenario_number}`,
          description: s.description?.trim() || null,
          is_recommended: s.is_recommended ?? false,
          scenario_date: s.scenario_date || null,
          scenario_time: s.scenario_time || null,
          price: priceNum,
          hst,
          total_price: totalPrice,
          conditions_note: s.conditions_note?.trim() || null,
          status: "pending",
        };
      });
      await sb.from("quote_scenarios").insert(rows);
      await sb.from("quotes").update({ is_multi_scenario: true }).eq("id", qUuidRow.id);
    } else if (!isPreview && qUuidRow?.id && !input.is_multi_scenario) {
      // Cleared multi-scenario on regenerate
      await sb.from("quotes").update({ is_multi_scenario: false, accepted_scenario_id: null }).eq("id", qUuidRow.id);
    }
  }

  const expiresAtStr = new Date(Date.now() + expiryDays * 86_400_000).toISOString();

  const marginFieldsForCaller = isSuperAdminEmail(authUser?.email);

  let moveProjectIdOut: string | null = null;
  if (!isPreview && quoteId !== "PREVIEW") {
    const { data: qMp } = await sb
      .from("quotes")
      .select("move_project_id")
      .eq("quote_id", quoteId)
      .maybeSingle();
    moveProjectIdOut = (qMp?.move_project_id as string | null) ?? null;
  }

  const newVersion = isUpdate && existingQuoteSnapshot
    ? ((existingQuoteSnapshot.version as number) ?? 1) + 1
    : null;

  const response: Record<string, unknown> = {
    quote_id: quoteId,
    quoteId,
    move_project_id: moveProjectIdOut,
    preview: isPreview,
    // Version tracking (present on in-place updates)
    ...(newVersion !== null ? {
      version: newVersion,
      is_revised: ["sent", "viewed"].includes(String(existingQuoteSnapshot?.status ?? "")),
      price_before: (existingQuoteSnapshot?.tiers as Record<string, { price: number }> | null)?.essential?.price
        ?? (existingQuoteSnapshot?.tiers as Record<string, { price: number }> | null)?.essentials?.price
        ?? (existingQuoteSnapshot?.custom_price as number | null)
        ?? null,
    } : {}),
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

  response.labour_validation = labour_validation_primary;
  if (labour_validation_by_tier) {
    response.labour_validation_by_tier = labour_validation_by_tier;
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
