"use client";

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import MultiStopAddressField, {
  type StopEntry,
} from "@/components/ui/MultiStopAddressField";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { useFormDraft } from "@/hooks/useFormDraft";
import DraftBanner from "@/components/ui/DraftBanner";
import { toTitleCase } from "@/lib/format-text";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import {
  CaretDown as ChevronDown,
  Check,
  PaperPlaneTilt as Send,
  Eye,
  CircleNotch as Loader2,
  CaretRight as ChevronRight,
  SidebarSimple as PanelRightOpen,
  Users,
  Clock,
  Truck,
  MapPin,
  Plus,
  Trash as Trash2,
  Warning,
  Recycle,
  MagnifyingGlass,
  Lightbulb,
  ListChecks,
  Info,
  XCircle,
  CheckCircle,
  X,
} from "@phosphor-icons/react";
import {
  B2B_ACCESS_PILLS,
  B2B_PARKING_PILLS,
  B2B_PREVIEW_HEADER_BY_CODE,
  B2B_VERTICAL_DROPDOWN_LABEL,
  B2B_OFFICE_VERTICAL_CODES,
  B2bAddItemCircle,
  B2bFieldLabel,
  B2bItemRowView,
  B2bPill,
  B2bSectionTitle,
  b2bInputStyleProps,
  b2bItemCatalogForVertical,
  isFlooringBundledAccessory,
  isMoveDateTodayToronto,
  isSkidCatalogLabel,
} from "./b2b-one-off-ui";
import SpecialtyTransportQuoteBuilder from "./SpecialtyTransportQuoteBuilder";
import MoveScopeSection from "./MoveScopeSection";
import {
  WhiteGloveItemsEditor,
  createDefaultWhiteGloveItem,
  type WhiteGloveItemRow,
} from "@/components/admin/WhiteGloveItemsEditor";
import { computeWhiteGlovePricingBreakdown, estimateWhiteGloveHours, recommendWhiteGloveCrew } from "@/lib/quotes/white-glove-pricing";
import OfficeMoveScopeSection from "./OfficeMoveScopeSection";
import BuildingProfileQuoteAlert from "./BuildingProfileQuoteAlert";
import type { BuildingAccessFlag } from "@/lib/buildings/types";
import type { ProjectQuoteBreakdown } from "@/lib/move-projects/residential-project-quote-lines";
import type { LabourValidationResult } from "@/lib/pricing/labour-validation";
import B2BJobsDeliveryForm, {
  type B2BJobsEmbedSnapshot,
} from "@/components/admin/b2b/B2BJobsDeliveryForm";
import {
  calculateBinRentalPrice,
  BIN_RENTAL_BUNDLE_SPECS,
  haversineKmBin,
  YUGO_HQ_LAT,
  YUGO_HQ_LNG,
} from "@/lib/pricing/bin-rental";
import {
  calculateB2BDimensionalPrice,
  isMoveDateWeekend,
  synthesizeStopsFromAddresses,
  type B2BDimensionalQuoteInput,
  type B2BQuoteLineItem,
  type DeliveryVerticalRow,
} from "@/lib/pricing/b2b-dimensional";
import { formatTruckOptionLabel } from "@/lib/pricing/truck-fees";
import { mergeBundleTierIntoMergedRates } from "@/lib/b2b-bundle-line-items";
import { prepareB2bLineItemsForDimensionalEngine } from "@/lib/b2b-dimensional-quote-prep";
import { suggestB2bWeightTierFromDescription } from "@/lib/pricing/b2b-weight-helpers";
import {
  hasExtremeWeightCategory,
  inferWeightTierFromLegacyScore,
  residentialInventoryLineScore,
  tierRequiresActualWeight,
  weightTierSelectOptions,
} from "@/lib/pricing/weight-tiers";
import { QUOTE_SERVICE_TYPE_DEFINITIONS } from "@/lib/quote-service-types";
import { quoteNumericSuffixForHubSpot } from "@/lib/quotes/quote-id";
import InventoryInput, {
  type InventoryItemEntry,
} from "@/components/inventory/InventoryInput";
import {
  mapSpecialtyToQuoteTypes,
  type SpecialtyDetected,
} from "@/lib/leads/specialty-detect";
import {
  expectedScoreRangeForMoveSize,
  moveSizeInventoryMismatchMessage,
  moveSizeLabel,
  suggestMoveSizeFromInventory,
} from "@/lib/pricing/move-size-suggestion";
import {
  getVisibleAddons,
  ESTATE_ADDON_UI_LINES,
} from "@/lib/quotes/addon-visibility";
import {
  buildEstateScheduleLines,
  calculateEstateDays,
  estateLoadedLabourCost,
} from "@/lib/quotes/estate-schedule";
import {
  pickupLocationsFromQuote,
  accessLabel,
  abbreviateLocationRows,
  dropoffLocationsFromQuote,
} from "@/lib/quotes/quote-address-display";
import { formatAddressForDisplay } from "@/lib/format-text";
import {
  quoteDetailDateLabel,
  quoteFormSchedulingSectionTitle,
  quoteFormServiceDateLabel,
} from "@/lib/quotes/quote-field-labels";
import {
  calcAssemblyMinutes,
  detectAssemblyRequired,
} from "@/lib/quotes/assembly-detection";

const PanelRightClose = PanelRightOpen;

// ─── Types ──────────────────────────────────────

interface Addon {
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

interface AddonSelection {
  addon_id: string;
  slug: string;
  quantity: number;
  tier_index: number;
}

/** One delivery + return pair in a multi-event quote */
interface EventLegForm {
  label: string;
  from_address: string;
  to_address: string;
  from_access: string;
  to_access: string;
  move_date: string;
  event_return_date: string;
  event_same_day: boolean;
  event_same_location_onsite: boolean;
  event_leg_truck_type: string;
  event_return_rate_preset:
    | "auto"
    | "60"
    | "65"
    | "80"
    | "85"
    | "100"
    | "custom";
  event_return_rate_custom: string;
}

interface TierResult {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

interface QuoteResult {
  quote_id: string;
  service_type: string;
  tiers?: Record<string, TierResult>;
  custom_price?: TierResult;
  distance_km: number | null;
  drive_time_min: number | null;
  move_date: string;
  expires_at?: string;
  factors: Record<string, unknown>;
  addons: { items: { name: string; subtotal: number }[]; total: number };
  inventory?: {
    modifier: number;
    score: number;
    benchmark: number;
    totalItems: number;
    boxCount?: number | null;
  };
  labour?: {
    crewSize: number;
    estimatedHours: number;
    hoursRange: string;
    truckSize: string;
  } | null;
  truck?: {
    primary: {
      vehicle_type: string;
      display_name: string;
      cargo_cubic_ft: number;
    } | null;
    secondary: {
      vehicle_type: string;
      display_name: string;
      cargo_cubic_ft: number;
    } | null;
    isMultiVehicle: boolean;
    notes: string | null;
    range: string;
  } | null;
  valuation?: {
    included: Record<string, string>;
    upgrades: Record<
      string,
      { price: number; to_tier: string; assumed_shipment_value: number } | null
    >;
    tiers: unknown[];
  };
  inventory_warnings?: string[];
  margin_warning?: {
    level: string;
    message: string;
    estimated_margin: number;
    target_margin: number;
    signature_margin: number | null;
  } | null;
  labour_validation?: LabourValidationResult;
  labour_validation_by_tier?: Record<string, LabourValidationResult>;
  bin_inventory?: { total: number; out_on_rental: number; available: number };
}

interface ItemWeight {
  slug: string;
  item_name: string;
  weight_score: number;
  category: string;
  room?: string;
  is_common: boolean;
  display_order?: number;
  active?: boolean;
  assembly_complexity?: string | null;
  disassembly_required?: boolean | null;
}

/** Parsed inventory line from a lead — needs coordinator review when not high confidence */
interface LeadInvReviewRow {
  raw_text: string;
  matched_item: string | null;
  matched_name: string | null;
  quantity: number;
  confidence: string;
  note?: string;
}

/**
 * Caches the photo review → new quote `sessionStorage` handoff so React 18 Strict
 * Mode (mount, unmount, remount) can re-read the same JSON after the first pass
 * schedules removal without losing the handoff.
 */
const quotePhotoReviewHandoffJsonByLeadId = new Map<string, string>();

type PhotoReviewQuoteHandoffShape = {
  items: InventoryItemEntry[];
  service_type?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  from_address?: string;
  to_address?: string;
  preferred_date?: string;
  move_size?: string;
};

// ─── Constants ──────────────────────────────────

/** Shown on Step 1 service grid only (other flows may still set these via URL, copy-prefill, or lead). */
const QUOTE_SERVICE_TYPES_HIDDEN_FROM_STEP1_PICKER = new Set([
  "b2b_delivery",
  "bin_rental",
]);

const SERVICE_TYPES: {
  value: string
  label: string
  desc: string
}[] = QUOTE_SERVICE_TYPE_DEFINITIONS.filter(
  (d) => !QUOTE_SERVICE_TYPES_HIDDEN_FROM_STEP1_PICKER.has(d.value),
).map((d) => ({
  value: d.value,
  label: d.label,
  desc: d.description,
}));


function isDefinedQuoteServiceType(value: string): boolean {
  return QUOTE_SERVICE_TYPE_DEFINITIONS.some((d) => d.value === value);
}

const MOVE_SIZES = [
  { value: "studio", label: "Studio" },
  { value: "1br", label: "1 Bedroom" },
  { value: "2br", label: "2 Bedroom" },
  { value: "3br", label: "3 Bedroom" },
  { value: "4br", label: "4 Bedroom" },
  { value: "5br_plus", label: "5+ Bedroom" },
  { value: "partial", label: "Partial Move" },
];

const BIN_BUNDLE_OPTIONS: {
  value: "studio" | "1br" | "2br" | "3br" | "4br_plus" | "custom";
  label: string;
  detail: string;
  popular?: boolean;
}[] = [
  {
    value: "studio",
    label: "Studio",
    detail: "15 bins, 2 wardrobe boxes — $99",
  },
  {
    value: "1br",
    label: "1 Bedroom",
    detail: "30 bins, 4 wardrobe boxes — $179",
  },
  {
    value: "2br",
    label: "2 Bedroom",
    detail: "50 bins, 6 wardrobe boxes — $279",
    popular: true,
  },
  {
    value: "3br",
    label: "3 Bedroom",
    detail: "70 bins, 8 wardrobe boxes — $399",
  },
  {
    value: "4br_plus",
    label: "4 Bedroom+",
    detail: "90 bins, 10 wardrobe boxes — $529",
  },
  {
    value: "custom",
    label: "Custom",
    detail: "Enter bin count (min 5) at per-bin rate",
  },
];

/** Legacy platform_config weight keys when vertical DB unavailable */
const B2B_WEIGHT_OPTIONS = [
  { value: "standard", label: "Standard (under 100 lbs)" },
  { value: "heavy", label: "Heavy (100–250 lbs)" },
  { value: "very_heavy", label: "Very Heavy (250–500 lbs)" },
  { value: "oversized_fragile", label: "Oversized / Fragile" },
];

const B2B_LINE_WEIGHT_OPTIONS = [
  { value: "light", label: "Light (under 30 lb)" },
  { value: "medium", label: "Medium (30–60 lb)" },
  { value: "heavy", label: "Heavy (60 lb+)" },
  { value: "extra_heavy", label: "Extra Heavy (300+ lb)" },
];

export type QuoteDeliveryVertical = {
  code: string;
  name: string;
  pricing_method: string;
  base_rate: number;
  default_config: Record<string, unknown>;
};

const ACCESS_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "elevator", label: "Elevator" },
  { value: "concierge", label: "Concierge" },
  { value: "ground_floor", label: "Ground floor" },
  { value: "loading_dock", label: "Loading dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+)" },
  { value: "long_carry", label: "Long carry" },
  { value: "narrow_stairs", label: "Narrow stairs" },
  { value: "no_parking_nearby", label: "No parking nearby" },
];

/** Bin rental delivery / pickup access (values must exist in ACCESS_OPTIONS). */
const BIN_RENTAL_ACCESS_OPTIONS: { value: string; label: string }[] = [
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground" },
  { value: "walk_up_2nd", label: "Walk-up" },
  { value: "concierge", label: "Concierge" },
];

const PARKING_OPTIONS = [
  { value: "dedicated", label: "Dedicated / loading dock" },
  { value: "street", label: "Street parking" },
  { value: "no_dedicated", label: "No dedicated parking (+$75)" },
] as const;

const EVENT_LEG_RETURN_RATE_OPTIONS = [
  { value: "auto", label: "Auto (60% different addresses · 80% same venue)" },
  { value: "60", label: "60% (standard delivery–return)" },
  { value: "80", label: "80% (same venue / reduced return)" },
  { value: "65", label: "65% (legacy preset)" },
  { value: "85", label: "85% (legacy preset)" },
  { value: "100", label: "100% (same effort both days)" },
  { value: "custom", label: "Custom %" },
] as const;

type EventItemFormRow = {
  name: string;
  quantity: number;
  weight_category: string;
  actual_weight_lbs?: number;
  item_type: string;
  requires_wrapping: boolean;
  requires_protection: boolean;
  notes: string;
};

const EVENT_ITEM_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "box_light", label: "Light boxes (books, supplies, decor)" },
  { value: "box_heavy", label: "Heavy boxes (equipment, materials)" },
  { value: "furniture", label: "Furniture / tables (standard)" },
  { value: "fragile", label: "Fragile (glass, porcelain, marble)" },
  { value: "equipment", label: "AV / equipment" },
  { value: "custom", label: "Custom / other" },
];

const EVENT_QUICK_ADD_PRESETS: {
  name: string;
  item_type: string;
  weight_category: string;
  requires_wrapping: boolean;
}[] = [
  {
    name: "Light boxes (books, supplies, decor)",
    item_type: "box_light",
    weight_category: "light",
    requires_wrapping: false,
  },
  {
    name: "Heavy boxes (equipment, materials)",
    item_type: "box_heavy",
    weight_category: "standard",
    requires_wrapping: false,
  },
  {
    name: "Tables (standard)",
    item_type: "furniture",
    weight_category: "standard",
    requires_wrapping: false,
  },
  {
    name: "Tables (fragile — glass, porcelain, marble)",
    item_type: "fragile",
    weight_category: "heavy",
    requires_wrapping: true,
  },
  {
    name: "Chairs",
    item_type: "furniture",
    weight_category: "light",
    requires_wrapping: false,
  },
  {
    name: "Display fixtures",
    item_type: "furniture",
    weight_category: "standard",
    requires_wrapping: true,
  },
  {
    name: "AV equipment",
    item_type: "equipment",
    weight_category: "heavy",
    requires_wrapping: true,
  },
  {
    name: "Staging panels / backdrops",
    item_type: "furniture",
    weight_category: "standard",
    requires_wrapping: false,
  },
  {
    name: "Signage / banners",
    item_type: "box_light",
    weight_category: "light",
    requires_wrapping: false,
  },
  {
    name: "Custom item",
    item_type: "custom",
    weight_category: "standard",
    requires_wrapping: false,
  },
];

const SPECIALTY_BUILDING_REQUIREMENTS = [
  { value: "elevator_booking", label: "Elevator booking required" },
  { value: "insurance_certificate", label: "Insurance certificate required" },
  { value: "restricted_hours", label: "Restricted move hours" },
  { value: "loading_dock_booking", label: "Loading dock booking required" },
] as const;

const SPECIALTY_ACCESS_DIFFICULTY = [
  { value: "straight_path", label: "Straight path" },
  { value: "one_turn", label: "One turn" },
  { value: "multiple_turns", label: "Multiple turns" },
  { value: "tight_staircase", label: "Tight staircase" },
  { value: "requires_rigging_or_crane", label: "Requires rigging or crane" },
] as const;

const SPECIALTY_ITEM_TYPES = [
  "piano_upright",
  "piano_grand",
  "pool_table",
  "safe_under_300lbs",
  "safe_over_300lbs",
  "hot_tub",
  "artwork_per_piece",
  "antique_per_piece",
  "wine_collection",
  "gym_equipment_per_piece",
  "motorcycle",
  "aquarium",
];

const SPECIALTY_TYPES = [
  { value: "piano_upright", label: "Piano (upright)" },
  { value: "piano_grand", label: "Piano (grand)" },
  { value: "art_sculpture", label: "Art / Sculpture" },
  { value: "antiques_estate", label: "Antiques / Estate Contents" },
  { value: "safe_vault", label: "Safe / Vault" },
  { value: "pool_table", label: "Pool Table (non-slate)" },
  { value: "pool_table_slate", label: "Pool Table (slate)" },
  { value: "hot_tub", label: "Hot Tub / Spa" },
  { value: "wine_collection", label: "Wine Collection" },
  { value: "aquarium", label: "Aquarium" },
  { value: "trade_show", label: "Trade Show / Exhibition Materials" },
  { value: "medical_lab", label: "Medical / Lab Equipment" },
  { value: "other", label: "Other (describe below)" },
];

const SPECIALTY_WEIGHT_OPTIONS = [
  { value: "under_100", label: "Under 100 lbs" },
  { value: "100_250", label: "100–250 lbs" },
  { value: "250_500", label: "250–500 lbs" },
  { value: "500_1000", label: "500–1000 lbs" },
  { value: "over_1000", label: "Over 1000 lbs" },
];

const SPECIALTY_REQUIREMENTS = [
  { value: "custom_crating", label: "Custom crating required" },
  { value: "climate_controlled", label: "Climate-controlled transport" },
  { value: "white_glove_handling", label: "White glove handling" },
  { value: "elevated_insurance", label: "Insurance above standard coverage" },
  { value: "disassembly_reassembly", label: "Disassembly / reassembly" },
  { value: "crane_rigging", label: "Crane or rigging needed" },
];

const SPECIALTY_BASE_PRICES: Record<string, { min: number; max: number }> = {
  piano_upright: { min: 400, max: 800 },
  piano_grand: { min: 800, max: 2000 },
  art_sculpture: { min: 300, max: 1500 },
  antiques_estate: { min: 500, max: 3000 },
  safe_vault: { min: 400, max: 1200 },
  pool_table: { min: 600, max: 1500 },
  hot_tub: { min: 800, max: 2000 },
  wine_collection: { min: 400, max: 1500 },
  aquarium: { min: 500, max: 1500 },
  trade_show: { min: 500, max: 2000 },
  medical_lab: { min: 600, max: 2500 },
  other: { min: 300, max: 2000 },
};

const SPECIALTY_WEIGHT_PREVIEW_MULT: Record<string, number> = {
  under_100: 0.94,
  100_250: 0.97,
  250_500: 1,
  500_1000: 1.06,
  over_1000: 1.12,
};

const ITEM_CATEGORIES = [
  { value: "small_light", label: "Small / light (lamp, side table, box)" },
  { value: "standard_furniture", label: "Medium (dresser, bookshelf, desk)" },
  { value: "large_heavy", label: "Large (sofa, dining table, bed)" },
  { value: "appliance", label: "Heavy appliance (fridge, washer, dryer)" },
  { value: "oversized", label: "Extra heavy (piano, safe, pool table)" },
  { value: "fragile_specialty", label: "Fragile (art, antique, glass)" },
  { value: "multiple_2_to_5", label: "Multiple (2–5 items)" },
];

const SINGLE_ITEM_CATEGORIES = ITEM_CATEGORIES.filter(
  (c) => c.value !== "multiple_2_to_5",
);

const WEIGHT_CLASSES = [
  "Under 50 lbs",
  "50-150 lbs",
  "150-300 lbs",
  "300-500 lbs",
  "Over 500 lbs",
];
const ASSEMBLY_OPTIONS = [
  "None",
  "Disassembly at pickup",
  "Assembly at delivery",
  "Both",
];
const PROJECT_TYPES = [
  "Art installation",
  "Trade show",
  "Estate cleanout",
  "Home staging",
  "Wine transport",
  "Medical equipment",
  "Piano move",
  "Event setup/teardown",
  "Custom",
];
const TIMING_PREFS = [
  "Weekday business hours",
  "Evening/night",
  "Weekend",
  "Phased multi-day",
];

const TAX_RATE = 0.13;

/** No fourth-step catalog add-ons or coordinator pre-tax override; pricing options live in job details. */
const SKIP_CATALOG_ADDONS_QUOTE_STEP = new Set<string>(["bin_rental"]);

const QuoteFormV2Context = React.createContext(false);

function useQuoteFormIsV2(): boolean {
  return useContext(QuoteFormV2Context);
}

// ─── Helpers ────────────────────────────────────

const fieldInput = "field-input-compact w-full";
const accessSelectClass = `${fieldInput} text-left text-[12px] text-[var(--tx)]`;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function cfgNum(config: Record<string, string>, key: string, fb: number) {
  const v = config[key];
  return v !== undefined ? Number(v) : fb;
}

function toDeliveryVerticalRow(v: QuoteDeliveryVertical): DeliveryVerticalRow {
  return {
    id: v.code,
    code: v.code,
    name: v.name,
    description: null,
    icon: null,
    base_rate: v.base_rate,
    pricing_method: v.pricing_method,
    default_config: v.default_config,
    active: true,
    sort_order: 0,
  };
}

type B2bQuoteFormField = {
  id: string;
  label: string;
  type: "number";
  min?: number;
  placeholder?: string;
  help?: string;
};

/** Optional `default_config.quote_form_fields` (or aliases) or built-ins (e.g. flooring box count). */
function parseB2bQuoteFormFields(
  v: QuoteDeliveryVertical | null,
): B2bQuoteFormField[] {
  if (!v) return [];
  const dc = (v.default_config || {}) as Record<string, unknown>;
  let raw: unknown = dc.quote_form_fields;
  if (!Array.isArray(raw)) raw = dc.b2b_quote_form_fields;
  if (!Array.isArray(raw)) raw = dc.form_fields;
  if (Array.isArray(raw)) {
    const out: B2bQuoteFormField[] = [];
    for (const x of raw) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.label !== "string") continue;
      out.push({
        id: o.id,
        label: o.label,
        type: "number",
        min: typeof o.min === "number" ? o.min : undefined,
        placeholder:
          typeof o.placeholder === "string" ? o.placeholder : undefined,
        help: typeof o.help === "string" ? o.help : undefined,
      });
    }
    if (out.length > 0) return out;
  }
  if (v.code === "flooring") {
    return [
      {
        id: "box_count",
        label: "Total box count",
        type: "number",
        min: 1,
        help: "Used for pricing when you have not added line items yet.",
      },
    ];
  }
  return [];
}

type B2bLineRow = {
  description: string;
  qty: number;
  weight_category?: string;
  weight_lbs?: number;
  actual_weight_lbs?: number;
  fragile?: boolean;
  handling_type?: string;
  assembly_required?: boolean;
  debris_removal?: boolean;
  haul_away?: boolean;
  bundled?: boolean;
  is_skid?: boolean;
  unit_type?: string;
  stop_assignment?: string;
  serial_number?: string;
  declared_value?: string;
  crating_required?: boolean;
  hookup_required?: boolean;
};

function inventoryItemToPayload(i: InventoryItemEntry, originIndex?: number) {
  const ox =
    typeof originIndex === "number"
      ? originIndex
      : typeof i.origin_index === "number"
        ? i.origin_index
        : undefined
  return {
    slug: i.slug,
    name: i.name,
    quantity: i.quantity,
    weight_score: i.weight_score,
    fragile: i.fragile,
    ...(ox !== undefined ? { origin_index: ox } : {}),
    ...(i.weight_tier_code ? { weight_tier_code: i.weight_tier_code } : {}),
    ...(i.actual_weight_lbs != null && i.actual_weight_lbs > 0
      ? { actual_weight_lbs: Math.round(i.actual_weight_lbs) }
      : {}),
  };
}

function mapB2bEmbedLinesToQuoteRows(s: B2BJobsEmbedSnapshot): B2bLineRow[] {
  return s.lines.map((l) => ({
    description: l.description,
    qty: l.quantity,
    weight_category: l.weight_category,
    actual_weight_lbs: l.actual_weight_lbs,
    fragile: l.fragile,
    handling_type: s.handlingType,
    unit_type: l.unit_type,
    stop_assignment: l.stop_assignment,
    serial_number: l.serial_number,
    declared_value: l.declared_value,
    crating_required: l.crating_required,
    hookup_required: l.hookup_required,
    haul_away: l.haul_away_line,
    assembly_required: l.line_assembly_required,
  }));
}

function b2bRouteAddressesFromForm(
  fromAddress: string,
  toAddress: string,
  extraFrom: StopEntry[],
  extraTo: StopEntry[],
): string[] {
  const pickups = [fromAddress, ...extraFrom.map((s) => s.address)]
    .map((a) => a.trim())
    .filter(Boolean);
  const drops = [toAddress, ...extraTo.map((s) => s.address)]
    .map((a) => a.trim())
    .filter(Boolean);
  return [...pickups, ...drops];
}

function b2bDimensionalStopsFromForm(
  fromAddress: string,
  toAddress: string,
  fromAccess: string,
  toAccess: string,
  extraFrom: StopEntry[],
  extraTo: StopEntry[],
): B2BDimensionalQuoteInput["stops"] {
  const pickups = [fromAddress, ...extraFrom.map((s) => s.address)]
    .map((a) => a.trim())
    .filter(Boolean);
  const drops = [toAddress, ...extraTo.map((s) => s.address)]
    .map((a) => a.trim())
    .filter(Boolean);
  if (
    pickups.length >= 1 &&
    drops.length >= 1 &&
    pickups.length + drops.length === 2
  ) {
    return synthesizeStopsFromAddresses(
      pickups[0]!,
      drops[0]!,
      fromAccess,
      toAccess,
    );
  }
  if (pickups.length + drops.length < 2) {
    return synthesizeStopsFromAddresses(
      fromAddress,
      toAddress,
      fromAccess,
      toAccess,
    );
  }
  return [
    ...pickups.map((address) => ({
      type: "pickup" as const,
      address,
      access: fromAccess.trim() || undefined,
    })),
    ...drops.map((address) => ({
      type: "delivery" as const,
      address,
      access: toAccess.trim() || undefined,
    })),
  ];
}

function b2bMasterHandlingType(lines: B2bLineRow[]): string {
  const row = lines.find((l) => l.description.trim());
  const h = row?.handling_type?.trim();
  if (h) return h.toLowerCase();
  return "threshold";
}

function getEffectiveB2bLines(
  lines: B2bLineRow[],
  vertical: QuoteDeliveryVertical | null,
  extras: Record<string, number>,
): B2bLineRow[] {
  if (lines.length > 0) return lines;
  if (!vertical) return lines;
  const fields = parseB2bQuoteFormFields(vertical);
  for (const f of fields) {
    const n = extras[f.id];
    const lo = f.min ?? 1;
    if (typeof n === "number" && Number.isFinite(n) && n >= lo) {
      const qty = Math.max(lo, Math.floor(n));
      return [{ description: f.label.trim() || "Units", qty }];
    }
  }
  const legacyBox = extras["box_count"];
  if (
    vertical.code === "flooring" &&
    typeof legacyBox === "number" &&
    legacyBox >= 1
  ) {
    return [{ description: "Flooring / building materials", qty: legacyBox }];
  }
  return lines;
}

function parseCfgJson<T>(
  config: Record<string, string>,
  key: string,
  fallback: T,
): T {
  try {
    const v = config[key];
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function parsePositivePreTaxOverride(raw: string): number | undefined {
  const t = String(raw).trim().replace(/,/g, "");
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function b2bAccessSurchargeFromConfig(
  config: Record<string, string>,
  fromAccess: string,
  toAccess: string,
): number {
  const accessMap = parseCfgJson<Record<string, number>>(
    config,
    "b2b_access_surcharges",
    {},
  );
  const accessKey = (k: string | undefined): string =>
    k === "no_parking_nearby" ? "no_parking" : (k ?? "");
  const fa = fromAccess ? (accessMap[accessKey(fromAccess)] ?? 0) : 0;
  const ta = toAccess ? (accessMap[accessKey(toAccess)] ?? 0) : 0;
  return fa + ta;
}

function b2bParkingLongCarryTotalFromConfig(
  config: Record<string, string>,
  fromParking: string,
  toParking: string,
  fromLongCarry: boolean,
  toLongCarry: boolean,
): number {
  const parkingRates = parseCfgJson<Record<string, number>>(
    config,
    "parking_surcharges",
    {
      dedicated: 0,
      street: 0,
      no_dedicated: 75,
    },
  );
  const lc = cfgNum(config, "long_carry_surcharge", 75);
  const fp = parkingRates[fromParking] ?? 0;
  const tp = parkingRates[toParking] ?? 0;
  return fp + tp + (fromLongCarry ? lc : 0) + (toLongCarry ? lc : 0);
}

const CRATING_SIZE_LABELS: Record<string, string> = {
  small: 'Small (under 24")',
  medium: 'Medium (24–48")',
  large: 'Large (48–72")',
  oversized: 'Oversized (72"+)',
};
const CRATING_SIZE_FALLBACK: Record<string, number> = {
  small: 175,
  medium: 250,
  large: 350,
  oversized: 500,
};

// Default inventory scores by move size when no items have been entered yet
const DEFAULT_INVENTORY_SCORE: Record<string, number> = {
  studio: 8,
  "1br": 16,
  "2br": 28,
  "3br": 45,
  "4br": 60,
  "5br_plus": 80,
  partial: 6,
};

// Mirrors DEFAULT_DAY_OF_WEEK_MULTIPLIER from generate/route.ts
const DOW_MULTIPLIER: Record<string, number> = {
  sunday: 1.1,
  monday: 1.0,
  tuesday: 1.0,
  wednesday: 1.0,
  thursday: 1.0,
  friday: 1.05,
  saturday: 1.1,
};

// Access type time penalty (hours added to estimate)
const ACCESS_PENALTY: Record<string, number> = {
  elevator: 0.25,
  walk_up_2: 0.25,
  walk_up_2nd: 0.25,
  walk_up_3: 0.5,
  walk_up_3rd: 0.5,
  walk_up_4_plus: 1.0,
  walk_up_4plus: 1.0,
  walk_up_4th: 1.0,
  walk_up_4th_plus: 1.0,
  long_carry: 0.5,
  no_parking: 0.25,
};

/**
 * Frontend-only quick estimate — recalculates instantly on any pricing-relevant change.
 * Uses estimateLabourFromScore for inventory/crew/access accuracy.
 * No distance factor (only available after API call with actual addresses).
 */
function quickEstimate(
  config: Record<string, string>,
  serviceType: string,
  moveSize: string,
  addonTotal: number,
  fromAccess?: string,
  toAccess?: string,
  inventoryScore?: number,
  specialtyItems?: { type: string; qty: number }[],
  moveDate?: string,
  inventoryItemsForAssembly?: { slug?: string; name?: string; quantity?: number }[],
  itemWeightsForAssembly?: ItemWeight[],
): { essential: number; signature: number; estate: number } | null {
  if (serviceType !== "local_move" && serviceType !== "long_distance")
    return null;
  if (!moveSize.trim()) return null;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  const labourRate = cfgNum(config, "labour_rate_per_mover_hour", 45);
  const minAmt = cfgNum(config, "minimum_job_amount", 549);

  const score =
    (inventoryScore ?? 0) > 0
      ? inventoryScore!
      : (DEFAULT_INVENTORY_SCORE[moveSize] ?? 28);

  // Crew size from inventory score
  let crew = 2;
  if (score >= 30) crew = 3;
  if (score >= 55) crew = 4;
  if (score >= 80) crew = 5;

  // Specialty item crew bumps
  const heavy = [
    "piano_grand",
    "pool_table",
    "safe_over_300",
    "safe_over_300lbs",
    "hot_tub",
  ];
  if (specialtyItems?.some((i) => heavy.includes(i.type) && i.qty > 0))
    crew = Math.max(crew, 4);
  else if (specialtyItems?.some((i) => i.qty > 0)) crew = Math.max(crew, 3);

  // Hard access crew bump
  const hardAccess = [
    "walk_up_3",
    "walk_up_3rd",
    "walk_up_4_plus",
    "walk_up_4plus",
    "walk_up_4th",
    "walk_up_4th_plus",
  ];
  if (fromAccess && hardAccess.includes(fromAccess)) crew += 1;
  if (toAccess && hardAccess.includes(toAccess)) crew += 1;
  crew = Math.min(6, crew);

  // Hours estimate (no drive time — preview only)
  const DISASSEMBLY: Record<string, number> = {
    studio: 0.25,
    "1br": 0.5,
    "2br": 0.75,
    "3br": 1.0,
    "4br": 1.25,
    "5br_plus": 1.5,
    partial: 0.25,
  };
  const MIN_HRS: Record<string, number> = {
    studio: 2.5,
    "1br": 3.5,
    "2br": 4.5,
    "3br": 5.5,
    "4br": 7.0,
    "5br_plus": 8.5,
    partial: 2.0,
  };
  const loadHrs = score / 12;
  const unloadHrs = loadHrs * 0.75;
  const baseDisassemblyHrs = DISASSEMBLY[moveSize] ?? 0.5;
  // If we have real inventory with assembly data, use item-specific minutes (floored at base estimate).
  let disassemblyHrs = baseDisassemblyHrs;
  if (inventoryItemsForAssembly?.length && itemWeightsForAssembly?.length) {
    const { totalMinutes } = calcAssemblyMinutes(inventoryItemsForAssembly, itemWeightsForAssembly);
    if (totalMinutes > 0) {
      disassemblyHrs = Math.max(baseDisassemblyHrs, totalMinutes / 60);
    }
  }
  const accessPenalty =
    (ACCESS_PENALTY[fromAccess ?? ""] ?? 0) +
    (ACCESS_PENALTY[toAccess ?? ""] ?? 0);
  let totalHrs = 0.75 + loadHrs + unloadHrs + disassemblyHrs + accessPenalty;
  totalHrs = Math.round(totalHrs * 2) / 2;
  totalHrs = Math.max(MIN_HRS[moveSize] ?? 3.0, totalHrs);

  // Day-of-week multiplier (matches server-side DEFAULT_DAY_OF_WEEK_MULTIPLIER)
  let dateMult = 1.0;
  if (moveDate) {
    const d = new Date(moveDate + "T00:00:00");
    const dayName = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][d.getDay()];
    dateMult = DOW_MULTIPLIER[dayName] ?? 1.0;
  }

  const baseLabour = crew * totalHrs * labourRate * dateMult;
  const curBase = Math.max(roundTo(baseLabour, rounding), minAmt);
  const sig = roundTo(
    curBase *
      cfgNum(
        config,
        "tier_signature_multiplier",
        cfgNum(config, "tier_premier_multiplier", 1.5),
      ),
    rounding,
  );
  const loadedRate = cfgNum(
    config,
    "crew_loaded_hourly_rate",
    cfgNum(config, "labour_rate_per_mover_hour", 28),
  );
  const estatePlan = calculateEstateDays(moveSize, score);
  const estateMultiLoaded = estateLoadedLabourCost(estatePlan, loadedRate);
  const singleLoadedPreview = Math.round(crew * totalHrs * loadedRate);
  const estateLabourUplift = Math.max(
    0,
    estateMultiLoaded - singleLoadedPreview,
  );
  const est =
    roundTo(
      curBase * cfgNum(config, "tier_estate_multiplier", 3.15),
      rounding,
    ) + roundTo(estateLabourUplift, rounding);

  return {
    essential: curBase + addonTotal,
    signature: sig + addonTotal,
    estate: est + addonTotal,
  };
}

function roundTo(n: number, nearest: number) {
  return Math.round(n / nearest) * nearest;
}

/** Live specialty preview: base band × weight + Mapbox distance surcharge (matches generate/route calcSpecialty style) + surcharges */
function specialtyPreviewBand(
  config: Record<string, string>,
  range: { min: number; max: number },
  opts: {
    weightClass: string;
    distanceKm: number | null;
    craneRigging: boolean;
    climateControlled: boolean;
    cratingSum: number;
  },
) {
  const rounding = cfgNum(config, "rounding_nearest", 50);
  const distBaseKm = cfgNum(config, "distance_base_km", 30);
  const distRateKm = cfgNum(config, "distance_rate_per_km", 4.5);
  const wMult = SPECIALTY_WEIGHT_PREVIEW_MULT[opts.weightClass] ?? 1;
  const km = opts.distanceKm ?? 0;
  const distSur =
    km > distBaseKm ? Math.round((km - distBaseKm) * distRateKm) : 0;
  const extras =
    (opts.craneRigging ? 750 : 0) +
    (opts.climateControlled ? 150 : 0) +
    opts.cratingSum;
  const min = roundTo(range.min * wMult + distSur + extras, rounding);
  const max = roundTo(range.max * wMult + distSur + extras, rounding);
  return { min, max, distSur, km };
}

function fmtPrice(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Component ──────────────────────────────────

type QuoteB2BJobsOrg = { id: string; name: string; type?: string | null };
type QuoteB2BJobsCrew = { id: string; name: string; members?: string[] };

export default function QuoteFormClient({
  addons: allAddons,
  config,
  itemWeights = [],
  deliveryVerticals = [],
  b2bOrganizations = [],
  b2bCrews = [],
  userRole = "coordinator",
  isSuperAdmin = false,
  binInventorySnapshot = null,
  /** When `"v2"`, Yugo+ admin shell tokens (surface, line, purple accent) replace legacy gold/wine. */
  uiVariant = "v1",
  backFallback = "/admin",
}: {
  addons: Addon[];
  config: Record<string, string>;
  itemWeights?: ItemWeight[];
  /** Active rows from delivery_verticals for B2B dimensional quotes */
  deliveryVerticals?: QuoteDeliveryVertical[];
  b2bOrganizations?: QuoteB2BJobsOrg[];
  b2bCrews?: QuoteB2BJobsCrew[];
  userRole?: string;
  /** Margin/cost preview — super-admin emails only (see isSuperAdminEmail). */
  isSuperAdmin?: boolean;
  /** Server-computed bin fleet availability for live preview */
  binInventorySnapshot?: {
    total: number;
    out: number;
    available: number;
  } | null;
  uiVariant?: "v1" | "v2";
  /** Used when `router.back()` has no history. */
  backFallback?: string;
}) {
  const isV2 = uiVariant === "v2";
  const checkboxAccentClass = isV2
    ? "accent-[var(--color-accent)]"
    : "accent-[#2C3E2D]";
  const buildingElevatorPanelClass = isV2
    ? "rounded-lg border border-line bg-accent-subtle/50 px-3 py-3 space-y-2"
    : "rounded-lg border border-[var(--brd)] bg-[#F9F0E8] px-3 py-3 space-y-2";
  const eventQuickAddBtnClass = isV2
    ? "inline-flex items-center rounded-md border border-line px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-fg hover:bg-accent/10"
    : "inline-flex items-center rounded-md border border-[#2C3E2D]/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--tx)] hover:bg-[#2C3E2D]/8";
  const addressSectionHeadingClass = isV2
    ? "text-[11px] font-bold tracking-[0.12em] uppercase text-fg"
    : "text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)]";
  const addressStopTitleClass = isV2
    ? "text-[10px] font-bold uppercase tracking-[0.12em] text-fg-subtle"
    : "text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)]";
  const addressMicroLabelClass = isV2
    ? "block text-[9px] font-bold uppercase tracking-[0.1em] text-fg-subtle mb-1"
    : "block text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)] mb-1";
  const addressUnitPlaceholderClass = isV2
    ? "flex min-h-[38px] items-center rounded-md border border-dashed border-line/70 bg-surface-sunken/40 px-2.5 text-[11px] text-fg-subtle"
    : "flex min-h-[38px] items-center rounded-md border border-dashed border-[var(--brd)]/60 bg-[var(--card)]/50 px-2.5 text-[11px] text-[var(--tx3)]";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const hubspotDealId = searchParams.get("hubspot_deal_id") || "";
  const leadIdParam = searchParams.get("lead_id")?.trim() || "";
  const widgetRequestIdParam =
    searchParams.get("widget_request_id")?.trim() || "";
  const specialtyBuilderQs = searchParams.get("specialty_builder") === "1";
  /** Deep link from admin (e.g. Bin Rentals → Generate quote uses `?service=bin_rental`). */
  const serviceTypeFromUrl = searchParams.get("service")?.trim() || "";
  const fromPhotoReview = searchParams.get("from_photo_review") === "1";
  /** Re-run handoff when Next hydrates `useSearchParams` (first paint can be empty). */
  const photoHandoffQueryKey = [
    searchParams.get("lead_id") ?? "",
    searchParams.get("from_photo_review") ?? "",
  ].join("|");

  // ── Form state ────────────────────────────
  const [serviceType, setServiceType] = useState("local_move");
  const serviceTypeUrlAppliedRef = useRef(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quoteFlowStep, setQuoteFlowStep] = useState(0);
  const quoteFlowContentRef = useRef<HTMLDivElement>(null);

  // ── Client dedup / contact search state ──────────────────────────────────
  const [clientSearching, setClientSearching] = useState(false);
  const [clientDedupResult, setClientDedupResult] = useState<{
    hubspot: {
      hubspot_id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      company: string;
      deal_ids: string[];
    } | null;
    square: {
      square_id: string;
      card_on_file: boolean;
      card_last_four: string;
      card_brand: string;
      card_id: string;
    } | null;
    opsClient: { id: string; name: string; email: string } | null;
    opsPrevMove: {
      move_number: string;
      move_date: string;
      move_size: string;
      from_address: string;
      to_address: string;
    } | null;
  } | null>(null);
  const [clientBannerDismissed, setClientBannerDismissed] = useState(false);
  const [ecoBinsUpsellDismissed, setEcoBinsUpsellDismissed] = useState(false);
  const [clientSquareId, setClientSquareId] = useState("");
  const [clientSquareCardId, setClientSquareCardId] = useState("");
  const [clientHubspotId, setClientHubspotId] = useState("");
  const [clientCardOnFile, setClientCardOnFile] = useState(false);
  const [clientCardLastFour, setClientCardLastFour] = useState("");
  const [clientCardBrand, setClientCardBrand] = useState("");

  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [extraFromStops, setExtraFromStops] = useState<StopEntry[]>([]);
  const [extraToStops, setExtraToStops] = useState<StopEntry[]>([]);
  const [fromAccess, setFromAccess] = useState("");
  const [toAccess, setToAccess] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [fromFloor, setFromFloor] = useState("");
  const [toUnit, setToUnit] = useState("");
  const [toFloor, setToFloor] = useState("");
  const [fromParking, setFromParking] = useState<
    "dedicated" | "street" | "no_dedicated"
  >("dedicated");
  const [toParking, setToParking] = useState<
    "dedicated" | "street" | "no_dedicated"
  >("dedicated");
  const [fromLongCarry, setFromLongCarry] = useState(false);
  const [toLongCarry, setToLongCarry] = useState(false);
  const [fromLat, setFromLat] = useState<number | null>(null);
  const [fromLng, setFromLng] = useState<number | null>(null);
  const [toLat, setToLat] = useState<number | null>(null);
  const [toLng, setToLng] = useState<number | null>(null);
  const [fromBuildingMatch, setFromBuildingMatch] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [toBuildingMatch, setToBuildingMatch] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [originBuildingFlags, setOriginBuildingFlags] = useState<string[]>([]);
  const [destBuildingFlags, setDestBuildingFlags] = useState<string[]>([]);
  const [originFloor, setOriginFloor] = useState("");
  const [destFloor, setDestFloor] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState(
    () => TIME_WINDOW_OPTIONS[1] ?? TIME_WINDOW_OPTIONS[0] ?? "",
  );
  const [moveSize, setMoveSize] = useState("");
  const moveSizeUserTouchedRef = useRef(false);
  const [clientBoxCount, setClientBoxCount] = useState("");
  const [serviceAreaBlock, setServiceAreaBlock] = useState<{
    quote_blocked?: boolean;
    block_reason?: string;
    message?: string;
    service_area?: {
      type: string;
      serviceable: boolean;
      warning?: string;
      from_prefix: string | null;
      to_prefix: string | null;
    };
  } | null>(null);
  /** Coordinator confirms subcontract / remote crew for out-of-area moves. */
  const [serviceAreaOverride, setServiceAreaOverride] = useState(false);

  const phoneInput = usePhoneInput(phone, setPhone);

  useEffect(() => {
    setServiceAreaOverride(false);
    setServiceAreaBlock(null);
  }, [fromAddress, toAddress]);

  const toggleOriginFlag = useCallback((f: BuildingAccessFlag) => {
    setOriginBuildingFlags((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }, []);

  const toggleDestFlag = useCallback((f: BuildingAccessFlag) => {
    setDestBuildingFlags((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }, []);

  useEffect(() => {
    if (serviceType !== "local_move" && serviceType !== "long_distance") return;
    if (fromAddress.trim().length < 10) {
      setFromBuildingMatch(null);
      return;
    }
    const t = window.setTimeout(() => {
      fetch("/api/admin/buildings/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: fromAddress,
          lat: fromLat,
          lng: fromLng,
        }),
      })
        .then((r) => r.json())
        .then((d: { profile?: Record<string, unknown> | null }) =>
          setFromBuildingMatch(d.profile ?? null),
        )
        .catch(() => setFromBuildingMatch(null));
    }, 500);
    return () => window.clearTimeout(t);
  }, [fromAddress, fromLat, fromLng, serviceType]);

  useEffect(() => {
    if (serviceType !== "local_move" && serviceType !== "long_distance") return;
    if (toAddress.trim().length < 10) {
      setToBuildingMatch(null);
      return;
    }
    const t = window.setTimeout(() => {
      fetch("/api/admin/buildings/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: toAddress,
          lat: toLat,
          lng: toLng,
        }),
      })
        .then((r) => r.json())
        .then((d: { profile?: Record<string, unknown> | null }) =>
          setToBuildingMatch(d.profile ?? null),
        )
        .catch(() => setToBuildingMatch(null));
    }, 500);
    return () => window.clearTimeout(t);
  }, [toAddress, toLat, toLng, serviceType]);

  useEffect(() => {
    if (serviceTypeUrlAppliedRef.current) return;
    if (!serviceTypeFromUrl) return;
    if (!isDefinedQuoteServiceType(serviceTypeFromUrl)) return;
    serviceTypeUrlAppliedRef.current = true;
    setServiceType(serviceTypeFromUrl);
  }, [serviceTypeFromUrl]);

  // Specialty items
  const [specialtyItems, setSpecialtyItems] = useState<
    { type: string; qty: number }[]
  >([]);

  // Office fields
  const [sqft, setSqft] = useState("");
  const [wsCount, setWsCount] = useState("");
  const [hasIt, setHasIt] = useState(false);
  const [hasConf, setHasConf] = useState(false);
  const [hasReception, setHasReception] = useState(false);
  const [timingPref, setTimingPref] = useState("");
  const [officeCrewSize, setOfficeCrewSize] = useState(2);
  const [officeEstHours, setOfficeEstHours] = useState(5);
  const [officeDesks, setOfficeDesks] = useState("");
  const [officeChairs, setOfficeChairs] = useState("");
  const [officeFiling, setOfficeFiling] = useState("");
  const [officeBoardroomCount, setOfficeBoardroomCount] = useState(1);
  const [officeKitchen, setOfficeKitchen] = useState(false);
  const [officeTruckCount, setOfficeTruckCount] = useState(1);

  // Residential assembly auto-detection — null = use auto, true/false = coordinator override
  const [assemblyOverride, setAssemblyOverride] = useState<boolean | null>(null);
  // Tracks coordinator's explicit confirmation when overriding a significant size mismatch.
  const [sizeOverrideConfirmed, setSizeOverrideConfirmed] = useState(false);

  // Single item fields
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("standard_furniture");
  const [itemWeight, setItemWeight] = useState("");
  const [assembly, setAssembly] = useState("None");
  const [stairCarry, setStairCarry] = useState(false);
  const [stairFlights, setStairFlights] = useState(1);
  const [numItems, setNumItems] = useState(1);
  const [singleItemSpecialHandling, setSingleItemSpecialHandling] =
    useState("");

  // White glove
  const [declaredValue, setDeclaredValue] = useState("");
  const [whiteGloveItemRows, setWhiteGloveItemRows] = useState<
    WhiteGloveItemRow[]
  >([]);
  const [wgGuaranteedWindow, setWgGuaranteedWindow] = useState(false);
  const [wgGuaranteedWindowHours, setWgGuaranteedWindowHours] = useState<
    2 | 3 | 4
  >(2);
  const [wgDebrisRemoval, setWgDebrisRemoval] = useState(false);
  const [wgBuildingReqs, setWgBuildingReqs] = useState<string[]>([]);
  const [wgBuildingNote, setWgBuildingNote] = useState("");
  const [wgDeliveryInstructions, setWgDeliveryInstructions] = useState("");

  // Specialty (dedicated item move)
  const [specialtyType, setSpecialtyType] = useState("");
  const [specialtyItemDescription, setSpecialtyItemDescription] = useState("");
  const [specialtyDimL, setSpecialtyDimL] = useState("");
  const [specialtyDimW, setSpecialtyDimW] = useState("");
  const [specialtyDimH, setSpecialtyDimH] = useState("");
  const [specialtyWeightClass, setSpecialtyWeightClass] = useState("");
  const [specialtyRequirements, setSpecialtyRequirements] = useState<string[]>(
    [],
  );
  const [specialtyNotes, setSpecialtyNotes] = useState("");
  const [specialtyBuildingReqs, setSpecialtyBuildingReqs] = useState<string[]>(
    [],
  );
  const [specialtyAccessDifficulty, setSpecialtyAccessDifficulty] =
    useState("");

  // Event fields
  const [eventName, setEventName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [extraVenueStops, setExtraVenueStops] = useState<StopEntry[]>([]);
  const [eventReturnDate, setEventReturnDate] = useState("");
  const [eventSetupRequired, setEventSetupRequired] = useState(false);
  const [eventSetupHours, setEventSetupHours] = useState(2);
  const [eventSetupInstructions, setEventSetupInstructions] = useState("");
  const [eventSameDay, setEventSameDay] = useState(false);
  const [eventPickupTimeAfter, setEventPickupTimeAfter] =
    useState("Evening 6–9 PM");
  const [eventItems, setEventItems] = useState<EventItemFormRow[]>([]);
  const [eventCrewOverride, setEventCrewOverride] = useState("");
  const [eventHoursOverride, setEventHoursOverride] = useState("");
  const [eventPreTaxOverride, setEventPreTaxOverride] = useState("");
  const [eventOverrideReason, setEventOverrideReason] = useState("");
  const eventWeightTierOpts = useMemo(() => weightTierSelectOptions(), []);
  const [eventAdditionalServices, setEventAdditionalServices] = useState<
    string[]
  >([]);
  const [eventMulti, setEventMulti] = useState(false);
  const [eventLuxury, setEventLuxury] = useState(false);
  const [eventComplexSetup, setEventComplexSetup] = useState(false);
  const [eventTruckType, setEventTruckType] = useState("sprinter");
  const [eventSameLocationSingle, setEventSameLocationSingle] = useState(false);
  const [eventReturnRateSingle, setEventReturnRateSingle] = useState<
    "auto" | "60" | "65" | "80" | "85" | "100" | "custom"
  >("auto");
  const [eventReturnRateCustomSingle, setEventReturnRateCustomSingle] =
    useState("");
  const [eventLegs, setEventLegs] = useState<EventLegForm[]>(() => [
    {
      label: "Event 1",
      from_address: "",
      to_address: "",
      from_access: "",
      to_access: "",
      move_date: "",
      event_return_date: "",
      event_same_day: false,
      event_same_location_onsite: false,
      event_leg_truck_type: "sprinter",
      event_return_rate_preset: "auto",
      event_return_rate_custom: "",
    },
    {
      label: "Event 2",
      from_address: "",
      to_address: "",
      from_access: "",
      to_access: "",
      move_date: "",
      event_return_date: "",
      event_same_day: false,
      event_same_location_onsite: false,
      event_leg_truck_type: "sprinter",
      event_return_rate_preset: "auto",
      event_return_rate_custom: "",
    },
  ]);

  const addEventLeg = useCallback(() => {
    setEventLegs((prev) => [
      ...prev,
      {
        label: `Event ${prev.length + 1}`,
        from_address: "",
        to_address: "",
        from_access: fromAccess,
        to_access: toAccess,
        move_date: "",
        event_return_date: "",
        event_same_day: false,
        event_same_location_onsite: false,
        event_leg_truck_type: "sprinter",
        event_return_rate_preset: "auto",
        event_return_rate_custom: "",
      },
    ]);
  }, [fromAccess, toAccess]);

  const removeEventLeg = useCallback(
    (idx: number) => {
      setEventLegs((prev) => {
        if (prev.length <= 1) {
          toast("Keep at least one event in the list.", "alertTriangle");
          return prev;
        }
        return prev.filter((_, i) => i !== idx);
      });
    },
    [toast],
  );

  /** Mapbox driving distance for specialty suggested range (km) */
  const [specialtyRouteKm, setSpecialtyRouteKm] = useState<number | null>(null);
  const [specialtyDriveMin, setSpecialtyDriveMin] = useState<number | null>(null);
  const [specialtyRouteLoading, setSpecialtyRouteLoading] = useState(false);

  // B2B One-Off fields (dimensional engine)
  const [b2bBusinessName, setB2bBusinessName] = useState("");
  const [b2bVerticalCode, setB2bVerticalCode] = useState("");
  const [b2bPartnerOrgId, setB2bPartnerOrgId] = useState("");
  const [b2bLines, setB2bLines] = useState<B2bLineRow[]>([]);
  const [b2bTimeBand, setB2bTimeBand] = useState<
    "morning" | "afternoon" | "after_hours"
  >("morning");
  const [b2bCatalogOpenIdx, setB2bCatalogOpenIdx] = useState<number | null>(
    null,
  );
  const [b2bPriceOverrideOn, setB2bPriceOverrideOn] = useState(false);
  const [b2bPreTaxOverrideAmount, setB2bPreTaxOverrideAmount] = useState("");
  const [b2bPartnersList, setB2bPartnersList] = useState<
    { id: string; name: string }[]
  >([]);
  const [b2bPartnerVerticals, setB2bPartnerVerticals] = useState<
    { code: string; name: string }[]
  >([]);
  const [b2bWeightCategory, setB2bWeightCategory] = useState("standard");
  const [b2bSpecialInstructions, setB2bSpecialInstructions] = useState("");
  const [b2bOverrideReason, setB2bOverrideReason] = useState("");
  const [b2bArtHangingCount, setB2bArtHangingCount] = useState("");
  const [b2bCratingPieces, setB2bCratingPieces] = useState("");
  const [b2bPreviewDistanceKm, setB2bPreviewDistanceKm] = useState<
    number | null
  >(null);
  const [b2bPreviewDriveMin, setB2bPreviewDriveMin] = useState<number | null>(
    null,
  );
  const [b2bDeliveryKmFromGta, setB2bDeliveryKmFromGta] = useState<
    number | null
  >(null);
  const [b2bRouteLoading, setB2bRouteLoading] = useState(false);
  const [b2bSubmitErrors, setB2bSubmitErrors] = useState<
    Record<string, string>
  >({});
  const [b2bVerticalExtras, setB2bVerticalExtras] = useState<
    Record<string, number>
  >({});
  const [b2bEmbedSnapshot, setB2bEmbedSnapshot] =
    useState<B2BJobsEmbedSnapshot | null>(null);

  /** Prefer live embed vertical so sidebar preview matches the B2B form (same rules as partner-filtered dropdown). */
  const effectiveB2bVerticalCode = useMemo(() => {
    const fromSnap = b2bEmbedSnapshot?.verticalCode?.trim();
    if (fromSnap && deliveryVerticals.some((v) => v.code === fromSnap))
      return fromSnap;
    const fromState = b2bVerticalCode.trim();
    if (fromState && deliveryVerticals.some((v) => v.code === fromState))
      return fromState;
    const noOffice = (v: QuoteDeliveryVertical) =>
      !B2B_OFFICE_VERTICAL_CODES.has(v.code.trim().toLowerCase());
    let pool = deliveryVerticals.filter(noOffice);
    if (b2bPartnerOrgId.trim() && b2bPartnerVerticals.length > 0) {
      const allow = new Set(b2bPartnerVerticals.map((v) => v.code));
      pool = pool.filter((v) => allow.has(v.code));
    }
    return pool[0]?.code ?? "custom";
  }, [
    b2bEmbedSnapshot?.verticalCode,
    b2bVerticalCode,
    deliveryVerticals,
    b2bPartnerOrgId,
    b2bPartnerVerticals,
  ]);

  const selectedB2bVertical = useMemo(
    () =>
      deliveryVerticals.find((v) => v.code === effectiveB2bVerticalCode) ??
      null,
    [deliveryVerticals, effectiveB2bVerticalCode],
  );

  const b2bAfterHoursDerived = b2bTimeBand === "after_hours";

  const b2bLivePreviewTitle = useMemo(() => {
    if (!selectedB2bVertical) return "B2B Delivery";
    return (
      B2B_PREVIEW_HEADER_BY_CODE[selectedB2bVertical.code] ??
      selectedB2bVertical.name
    );
  }, [selectedB2bVertical]);

  const b2bAutoSameDay = useMemo(() => {
    if (
      (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") ||
      !selectedB2bVertical ||
      !moveDate.trim()
    )
      return false;
    if (!isMoveDateTodayToronto(moveDate)) return false;
    const merged = selectedB2bVertical.default_config as Record<
      string,
      unknown
    >;
    const sched = (merged.schedule_surcharges || {}) as Record<string, unknown>;
    const sd =
      typeof sched.same_day === "number"
        ? sched.same_day
        : Number(sched.same_day);
    return Number.isFinite(sd) && sd > 0;
  }, [serviceType, selectedB2bVertical, moveDate]);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") return;
    if (b2bTimeBand === "morning") setPreferredTime("09:00");
    else if (b2bTimeBand === "afternoon") setPreferredTime("13:00");
    else setPreferredTime("18:00");
  }, [serviceType, b2bTimeBand]);

  const b2bShowLineWeights = useMemo(() => {
    const dc = selectedB2bVertical?.default_config;
    if (!dc || typeof dc !== "object") return false;
    const wlr = dc.weight_line_rates;
    if (
      wlr &&
      typeof wlr === "object" &&
      !Array.isArray(wlr) &&
      Object.keys(wlr as object).length > 0
    )
      return true;
    const wt = dc.weight_tiers;
    return Boolean(
      wt &&
      typeof wt === "object" &&
      !Array.isArray(wt) &&
      Object.keys(wt as object).length > 0,
    );
  }, [selectedB2bVertical]);

  const b2bShowArtCratingFields = useMemo(() => {
    if (!selectedB2bVertical) return false;
    if (selectedB2bVertical.code === "art_gallery") return true;
    const p = selectedB2bVertical.default_config?.complexity_premiums;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const pr = p as Record<string, unknown>;
      const hang = Number(pr.art_hanging_per_piece);
      const cr = Number(pr.crating_per_piece);
      return (
        (Number.isFinite(hang) && hang > 0) || (Number.isFinite(cr) && cr > 0)
      );
    }
    return false;
  }, [selectedB2bVertical]);

  const b2bVerticalSelectOptions = useMemo(() => {
    const noOffice = (v: QuoteDeliveryVertical) =>
      !B2B_OFFICE_VERTICAL_CODES.has(v.code.trim().toLowerCase());
    if (b2bPartnerOrgId.trim() && b2bPartnerVerticals.length > 0) {
      const allow = new Set(b2bPartnerVerticals.map((v) => v.code));
      return deliveryVerticals.filter((v) => allow.has(v.code) && noOffice(v));
    }
    return deliveryVerticals.filter(noOffice);
  }, [b2bPartnerOrgId, b2bPartnerVerticals, deliveryVerticals]);

  const handleB2bEmbedStateChange = useCallback((s: B2BJobsEmbedSnapshot) => {
    setB2bEmbedSnapshot(s);
    setB2bVerticalCode(s.verticalCode);
    setB2bLines(mapB2bEmbedLinesToQuoteRows(s));
    setFromAddress(s.pickupAddress);
    setToAddress(s.deliveryAddress);
    setExtraFromStops(s.extraPickupAddresses.map((address) => ({ address })));
    setExtraToStops(s.extraDeliveryAddresses.map((address) => ({ address })));
    if (s.pickupAccess.trim()) setFromAccess(s.pickupAccess);
    if (s.deliveryAccess.trim()) setToAccess(s.deliveryAccess);
    setB2bPartnerOrgId(s.partnerOrgId);
    setB2bBusinessName(s.businessName);
    const box = parseInt(s.boxCount, 10);
    if (
      s.lines.length === 0 &&
      s.verticalCode === "flooring" &&
      Number.isFinite(box) &&
      box >= 1
    ) {
      setB2bVerticalExtras({ box_count: box });
    } else {
      setB2bVerticalExtras({});
    }
  }, []);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") {
      setB2bEmbedSnapshot(null);
    }
  }, [serviceType]);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") return;
    fetch("/api/admin/partners/b2b-list", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.partners) ? d.partners : [];
        setB2bPartnersList(
          list.map((p: { id: string; name: string }) => ({
            id: String(p.id),
            name: String(p.name || ""),
          })),
        );
      })
      .catch(() => setB2bPartnersList([]));
  }, [serviceType]);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") return;
    const id = b2bPartnerOrgId.trim();
    if (!id) {
      setB2bPartnerVerticals([]);
      return;
    }
    fetch(
      `/api/admin/organizations/${encodeURIComponent(id)}/partner-b2b-verticals`,
      {
        credentials: "same-origin",
      },
    )
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.verticals) ? d.verticals : [];
        setB2bPartnerVerticals(
          list.map((x: { code: string; name: string }) => ({
            code: String(x.code),
            name: String(x.name || x.code),
          })),
        );
      })
      .catch(() => setB2bPartnerVerticals([]));
  }, [serviceType, b2bPartnerOrgId]);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") {
      setB2bPreviewDistanceKm(null);
      setB2bPreviewDriveMin(null);
      setB2bDeliveryKmFromGta(null);
      setB2bRouteLoading(false);
    }
  }, [serviceType]);

  useEffect(() => {
    if (b2bVerticalSelectOptions.length === 0) return;
    if (!b2bVerticalSelectOptions.some((v) => v.code === b2bVerticalCode)) {
      setB2bVerticalCode(b2bVerticalSelectOptions[0]!.code);
    }
  }, [b2bVerticalSelectOptions, b2bVerticalCode]);

  // Labour Only fields
  const [workAddress, setWorkAddress] = useState("");
  const [extraWorkStops, setExtraWorkStops] = useState<StopEntry[]>([]);
  const [workAccess, setWorkAccess] = useState("");
  const [labourDescription, setLabourDescription] = useState("");
  const [labourCrewSize, setLabourCrewSize] = useState(2);
  const [labourHours, setLabourHours] = useState(3);
  const [labourTruckRequired, setLabourTruckRequired] = useState(false);
  const [labourVisits, setLabourVisits] = useState(1);
  const [labourSecondVisitDate, setLabourSecondVisitDate] = useState("");
  const [labourStorageNeeded, setLabourStorageNeeded] = useState(false);
  const [labourStorageWeeks, setLabourStorageWeeks] = useState(1);
  const [labourContext, setLabourContext] = useState("");
  const [labourWeekend, setLabourWeekend] = useState(false);
  const [labourAfterHours, setLabourAfterHours] = useState(false);

  // Bin rental
  const [binPickupSameAsDelivery, setBinPickupSameAsDelivery] = useState(true);
  const [binBundleType, setBinBundleType] = useState<
    "studio" | "1br" | "2br" | "3br" | "4br_plus" | "custom"
  >("2br");
  const [binCustomCount, setBinCustomCount] = useState(10);
  const [binExtraBins, setBinExtraBins] = useState(0);
  const [binPackingPaper, setBinPackingPaper] = useState(false);
  const [binMaterialDelivery, setBinMaterialDelivery] = useState(true);
  const [binLinkedMoveId, setBinLinkedMoveId] = useState("");
  const [binDeliveryNotes, setBinDeliveryNotes] = useState("");
  const [binInternalNotes, setBinInternalNotes] = useState("");
  const [binHubDeliveryKm, setBinHubDeliveryKm] = useState<number | null>(null);
  const [binHubPickupKm, setBinHubPickupKm] = useState<number | null>(null);
  const [binDistanceGeoFailed, setBinDistanceGeoFailed] = useState(false);

  // Custom crating (all service types — coordinator decides per quote)
  const [cratingRequired, setCratingRequired] = useState(false);
  const [cratingItems, setCratingItems] = useState<
    { description: string; size: "small" | "medium" | "large" | "oversized" }[]
  >([]);

  // Recommended tier (coordinator judgment)
  const [recommendedTier, setRecommendedTier] = useState<
    "essential" | "signature" | "estate"
  >("signature");

  /** Pre-tax override sent to /api/quotes/generate (not used for B2B / bin rental). */
  const [quotePreTaxOverride, setQuotePreTaxOverride] = useState("");
  const [quotePreTaxOverrideReason, setQuotePreTaxOverrideReason] =
    useState("");

  // Add-ons
  const [selectedAddons, setSelectedAddons] = useState<
    Map<string, AddonSelection>
  >(new Map());

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>(
    [],
  );
  /** When there are multiple pickup addresses, inventory is captured per pickup. */
  const [perPickupInventory, setPerPickupInventory] = useState<
    InventoryItemEntry[][]
  >([]);
  const pickupAddressList = useMemo(
    () =>
      [fromAddress, ...extraFromStops.map((s) => s.address)]
        .map((a) => a.trim())
        .filter(Boolean),
    [fromAddress, extraFromStops],
  );
  const dropAddressList = useMemo(
    () =>
      [toAddress, ...extraToStops.map((s) => s.address)]
        .map((a) => a.trim())
        .filter(Boolean),
    [toAddress, extraToStops],
  );
  const pickupCount = pickupAddressList.length;
  const multiPickupInventoryMode = useMemo(
    () =>
      pickupCount > 1 &&
      (serviceType === "local_move" ||
        serviceType === "long_distance" ||
        serviceType === "white_glove" ||
        serviceType === "office_move"),
    [pickupCount, serviceType],
  );

  const [leadIntelSummary, setLeadIntelSummary] = useState<string | null>(null);
  const [leadInventoryReview, setLeadInventoryReview] = useState<
    LeadInvReviewRow[]
  >([]);
  const leadInventoryPrefillSigRef = useRef<string>("");
  const leadSpecialtyPrefillSigRef = useRef<string>("");
  /** Strips `from_photo_review` on load; then lead re-fetch can overwrite session inventory without this. */
  const photoReviewInventoryHandoffRef = useRef(false);
  const prevLeadIdForHandoffRef = useRef<string | null>(null);

  // Referral code
  const [referralCode, setReferralCode] = useState("");
  const [referralId, setReferralId] = useState<string | null>(null);
  const [referralStatus, setReferralStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [referralMsg, setReferralMsg] = useState("");
  const [referralDiscount, setReferralDiscount] = useState(0);

  const [savedMoveProjectId, setSavedMoveProjectId] = useState<string | null>(
    null,
  );

  /** Office move scope strip (replacing Generate Quote planner). */
  const [officeMoveScopeDaysOverride, setOfficeMoveScopeDaysOverride] =
    useState<number | null>(null);
  const [officeScopeAdditionalMoveDay, setOfficeScopeAdditionalMoveDay] =
    useState(false);
  /** Coordinator override for quotes.estimated_days (local / long-distance scope flow). */
  const [moveScopeDaysOverride, setMoveScopeDaysOverride] = useState<number | null>(
    null,
  );
  const [moveScopeExtraVolumeDay, setMoveScopeExtraVolumeDay] = useState(false);

  // Draft auto-save
  const quoteDraftState = useMemo(
    () => ({
      serviceType,
      firstName,
      lastName,
      email,
      phone,
      fromAddress,
      toAddress,
      fromAccess,
      toAccess,
      moveDate,
      preferredTime,
      arrivalWindow,
      moveSize,
      b2bBusinessName,
      eventName,
      labourDescription,
      itemDescription,
      specialtyType,
      declaredValue,
    }),
    [
      serviceType,
      firstName,
      lastName,
      email,
      phone,
      fromAddress,
      toAddress,
      fromAccess,
      toAccess,
      moveDate,
      preferredTime,
      arrivalWindow,
      moveSize,
      b2bBusinessName,
      eventName,
      labourDescription,
      itemDescription,
      specialtyType,
      declaredValue,
    ],
  );

  const quoteDraftTitleFn = useCallback((s: typeof quoteDraftState) => {
    const name = [s.firstName, s.lastName].filter(Boolean).join(" ");
    return name || s.b2bBusinessName || s.eventName || "Quote";
  }, []);

  const applyQuoteDraftFromStorage = useCallback(
    (d: Record<string, unknown>) => {
      if (d.serviceType) setServiceType(d.serviceType as string);
      if (d.firstName) setFirstName(d.firstName as string);
      if (d.lastName) setLastName(d.lastName as string);
      if (d.email) setEmail(d.email as string);
      if (d.phone) setPhone(d.phone as string);
      if (d.fromAddress) setFromAddress(d.fromAddress as string);
      if (d.toAddress) setToAddress(d.toAddress as string);
      if (d.fromAccess) setFromAccess(d.fromAccess as string);
      if (d.toAccess) setToAccess(d.toAccess as string);
      if (d.moveDate) setMoveDate(d.moveDate as string);
      if (d.preferredTime) setPreferredTime(d.preferredTime as string);
      if (d.arrivalWindow) setArrivalWindow(d.arrivalWindow as string);
      if (d.moveSize) {
        setMoveSize(d.moveSize as string);
        moveSizeUserTouchedRef.current = true;
      }
      if (d.b2bBusinessName) setB2bBusinessName(d.b2bBusinessName as string);
      if (d.eventName) setEventName(d.eventName as string);
      if (d.labourDescription)
        setLabourDescription(d.labourDescription as string);
      if (d.itemDescription) setItemDescription(d.itemDescription as string);
      if (d.specialtyType) setSpecialtyType(d.specialtyType as string);
      if (d.declaredValue) setDeclaredValue(d.declaredValue as string);
    },
    [],
  );

  const {
    hasDraft: quoteHasDraft,
    restoreDraft: quoteRestoreDraft,
    dismissDraft: quoteDismissDraft,
    clearDraft: quoteClearDraft,
  } = useFormDraft("quote", quoteDraftState, quoteDraftTitleFn, {
    applySaved: applyQuoteDraftFromStorage as (
      data: typeof quoteDraftState,
    ) => void,
  });

  const handleRestoreQuoteDraft = useCallback(() => {
    const d = quoteRestoreDraft();
    if (!d) return;
    applyQuoteDraftFromStorage(d as Record<string, unknown>);
  }, [quoteRestoreDraft, applyQuoteDraftFromStorage]);

  const handleClientDedupBlur = useCallback(async () => {
    const emailTrim = email.trim().toLowerCase();
    const phoneNorm = normalizePhone(phone);
    const hasEmail = emailTrim.includes("@");
    const hasPhone = phoneNorm.length === 10;
    const isB2bQuote = serviceType === "b2b_delivery";
    const biz = isB2bQuote ? b2bBusinessName.trim() : "";
    const contactName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const canHubSpot =
      hasEmail ||
      hasPhone ||
      (biz.length >= 2 && contactName.length >= 2) ||
      biz.length >= 3;
    const canOps = hasEmail || hasPhone;

    if (!canHubSpot && !canOps) return;

    setClientBannerDismissed(false);
    setClientSearching(true);
    setClientDedupResult(null);

    try {
      const opsP = canOps
        ? fetch("/api/admin/clients/search-by-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: hasEmail ? emailTrim : undefined,
              phone: hasPhone ? phoneNorm : undefined,
            }),
          }).then((r) => r.json())
        : Promise.resolve({ client: null, prev_move: null });

      const hubspotP = canHubSpot
        ? fetch("/api/hubspot/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: hasEmail ? emailTrim : undefined,
              phone: hasPhone ? phone : undefined,
              company: biz || undefined,
              contact_name: contactName || undefined,
            }),
          }).then((r) => r.json())
        : Promise.resolve({ contact: null });

      const squareP = hasEmail
        ? fetch("/api/square/search-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailTrim }),
          }).then((r) => r.json())
        : Promise.resolve({ customer: null });

      const [opsRes, hubspotRes, squareRes] = await Promise.allSettled([
        opsP,
        hubspotP,
        squareP,
      ]);

      const ops = opsRes.status === "fulfilled" ? opsRes.value : null;
      const hubspot =
        hubspotRes.status === "fulfilled"
          ? (hubspotRes.value?.contact ?? null)
          : null;
      const square =
        squareRes.status === "fulfilled"
          ? (squareRes.value?.customer ?? null)
          : null;

      if (!ops?.client && !hubspot && !square) {
        setClientSearching(false);
        return;
      }

      setClientDedupResult({
        hubspot,
        square,
        opsClient: ops?.client ?? null,
        opsPrevMove: ops?.prev_move ?? null,
      });
    } catch {
      // silently continue
    } finally {
      setClientSearching(false);
    }
  }, [email, phone, firstName, lastName, serviceType, b2bBusinessName]);

  const handleClientAutoFill = () => {
    if (!clientDedupResult) return;
    const { hubspot, square, opsClient, opsPrevMove } = clientDedupResult;

    if (hubspot) {
      if (hubspot.first_name && !firstName) setFirstName(hubspot.first_name);
      if (hubspot.last_name && !lastName) setLastName(hubspot.last_name);
      if (hubspot.email && !email.trim())
        setEmail(hubspot.email.trim().toLowerCase());
      if (hubspot.phone && !phone) {
        setPhone(formatPhone(hubspot.phone));
      }
      if (
        serviceType === "b2b_delivery" &&
        hubspot.company &&
        !b2bBusinessName.trim()
      ) {
        setB2bBusinessName(hubspot.company);
      }
      setClientHubspotId(hubspot.hubspot_id);
    }

    if (square) {
      setClientSquareId(square.square_id);
      if (square.card_id) setClientSquareCardId(square.card_id);
      setClientCardOnFile(square.card_on_file);
      if (square.card_last_four) setClientCardLastFour(square.card_last_four);
      if (square.card_brand) setClientCardBrand(square.card_brand);
    }

    if (opsClient && opsPrevMove?.from_address && !fromAddress) {
      setFromAddress(opsPrevMove.from_address);
    }

    setClientBannerDismissed(true);
  };

  const verifyReferral = async () => {
    if (!referralCode.trim()) return;
    try {
      const res = await fetch("/api/referrals/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setReferralId(data.referral_id);
        setReferralDiscount(data.discount || 75);
        setReferralStatus("valid");
        setReferralMsg(
          `Valid! $${data.discount || 75} off. Referred by ${data.referrer_name}.`,
        );
      } else {
        setReferralId(null);
        setReferralDiscount(0);
        setReferralStatus("invalid");
        setReferralMsg(data.error || "Invalid code");
      }
    } catch {
      setReferralStatus("invalid");
      setReferralMsg("Verification failed");
    }
  };

  // Multi-scenario state
  interface ScenarioInput {
    label: string;
    description: string;
    scenario_date: string;
    scenario_time: string;
    price: string;
    is_recommended: boolean;
  }
  const emptyScenario = (n: number): ScenarioInput => ({
    label: `Option ${n}`,
    description: "",
    scenario_date: "",
    scenario_time: "",
    price: "",
    is_recommended: n === 1,
  });
  const [isMultiScenario, setIsMultiScenario] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([emptyScenario(1), emptyScenario(2)]);

  const updateScenario = (idx: number, patch: Partial<ScenarioInput>) => {
    setScenarios((prev) => {
      const next = prev.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      if (patch.is_recommended === true) {
        return next.map((s, i) => ({ ...s, is_recommended: i === idx }));
      }
      return next;
    });
  };

  // Quote result (set only after successful generate; required for Send)
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const [hubspotLoaded, setHubspotLoaded] = useState(false);
  const [hubspotBanner, setHubspotBanner] = useState("");
  const [hubspotDuplicateBanner, setHubspotDuplicateBanner] = useState<{
    dealId: string;
    dealName: string;
    dealStageId: string;
  } | null>(null);
  const [hubspotDuplicateBusy, setHubspotDuplicateBusy] = useState(false);
  const [leadQuoteBanner, setLeadQuoteBanner] = useState("");
  const [widgetQuoteBanner, setWidgetQuoteBanner] = useState("");
  const [leadParsedWeightMax, setLeadParsedWeightMax] = useState<number | null>(
    null,
  );
  const [leadParsedDimensions, setLeadParsedDimensions] = useState("");
  const [specialtyBuilderOpen, setSpecialtyBuilderOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const prefillDone = useRef(false);

  // Contact search for auto-fill (same as Create Move)
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [dbContacts, setDbContacts] = useState<
    {
      hubspot_id: string;
      name: string;
      email: string;
      phone: string;
      company: string;
      address: string;
      postal: string;
    }[]
  >([]);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const contactSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(e.target as Node)
      ) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (contactSearchTimerRef.current)
      clearTimeout(contactSearchTimerRef.current);
    if (!contactSearch || contactSearch.length < 2) {
      setDbContacts([]);
      return;
    }
    contactSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/contacts/search?q=${encodeURIComponent(contactSearch)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setDbContacts(data.contacts || []);
        }
      } catch {
        /* ignore */
      }
    }, 300);
    return () => {
      if (contactSearchTimerRef.current)
        clearTimeout(contactSearchTimerRef.current);
    };
  }, [contactSearch]);

  useEffect(() => {
    try {
      if (localStorage.getItem("yugo_dismiss_eco_bins_quote_upsell") === "1") {
        setEcoBinsUpsellDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const inventoryLinesForScore = useMemo(() => {
    if (multiPickupInventoryMode && perPickupInventory.length > 0) {
      return perPickupInventory.flat();
    }
    return inventoryItems;
  }, [multiPickupInventoryMode, perPickupInventory, inventoryItems]);

  const inventoryScore = useMemo(() => {
    return inventoryLinesForScore.reduce(
      (sum, i) => sum + residentialInventoryLineScore(i),
      0,
    );
  }, [inventoryLinesForScore]);

  const inventoryTotalItems = useMemo(() => {
    return inventoryLinesForScore.reduce((sum, i) => sum + i.quantity, 0);
  }, [inventoryLinesForScore]);

  const clientBoxCountNum = Number(clientBoxCount) || 0;
  const boxScore = clientBoxCountNum * 0.3;
  const inventoryScoreWithBoxes = inventoryScore + boxScore;

  const scopeAddonSlugs = useMemo(() => {
    const slugs: string[] = [];
    for (const sel of selectedAddons.values()) {
      const row = allAddons.find((a) => a.id === sel.addon_id);
      if (row?.slug) slugs.push(row.slug);
    }
    return slugs;
  }, [selectedAddons, allAddons]);

  const workstationCountN = Number(wsCount) || 0;
  const extraPickupStopCount = extraFromStops.filter((s) =>
    s.address.trim(),
  ).length;
  const extraDropoffStopCount = extraToStops.filter((s) =>
    s.address.trim(),
  ).length;

  const handleMoveScopeToggleMultiPickup = useCallback((want: boolean) => {
    if (want) {
      setExtraFromStops((prev) => (prev.length === 0 ? [{ address: "" }] : prev));
    } else {
      setExtraFromStops([]);
    }
  }, []);

  const handleMoveScopeToggleMultiDelivery = useCallback((want: boolean) => {
    if (want) {
      setExtraToStops((prev) => (prev.length === 0 ? [{ address: "" }] : prev));
    } else {
      setExtraToStops([]);
    }
  }, []);

  const officeTimingAfterHoursHint = useMemo(() => {
    const t = (timingPref || "").toLowerCase();
    return (
      t.includes("evening") ||
      t.includes("night") ||
      t.includes("weekend")
    );
  }, [timingPref]);

  useEffect(() => {
    if (serviceType === "office_move") return;
    setOfficeMoveScopeDaysOverride(null);
    setOfficeScopeAdditionalMoveDay(false);
  }, [serviceType]);

  useEffect(() => {
    if (serviceType !== "single_item") return;
    if (itemCategory === "multiple_2_to_5") setItemCategory("standard_furniture");
  }, [serviceType, itemCategory]);

  useEffect(() => {
    if (!multiPickupInventoryMode) {
      if (perPickupInventory.length > 0) {
        const merged = perPickupInventory.flat();
        if (merged.length > 0) setInventoryItems(merged);
        setPerPickupInventory([]);
      }
      return;
    }
    setPerPickupInventory((prev) => {
      const n = pickupCount;
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => {
        if (i < prev.length) return prev[i]!;
        if (prev.length === 0 && i === 0) return inventoryItems;
        return [];
      });
    });
  }, [multiPickupInventoryMode, pickupCount, inventoryItems]);

  const moveSizeSuggestion = useMemo(() => {
    if (inventoryLinesForScore.length === 0) return null;
    return suggestMoveSizeFromInventory(
      inventoryLinesForScore.map((i) => ({ name: i.name, quantity: i.quantity })),
      clientBoxCountNum,
      inventoryScore,
    );
  }, [inventoryLinesForScore, clientBoxCountNum, inventoryScore]);

  useEffect(() => {
    if (serviceType !== "local_move" && serviceType !== "long_distance") {
      return;
    }
    if (inventoryItems.length === 0) return;
    if (moveSizeUserTouchedRef.current) return;
    if (moveSize.trim()) return;
    const s = moveSizeSuggestion;
    if (!s) return;
    setMoveSize(s.suggested);
  }, [serviceType, inventoryItems.length, moveSize, moveSizeSuggestion]);

  // ── HubSpot pre-fill ──────────────────────
  useEffect(() => {
    if (!hubspotDealId || prefillDone.current) return;
    prefillDone.current = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/hubspot/get-deal?dealId=${encodeURIComponent(hubspotDealId)}`,
        );
        if (!res.ok) return;
        const d = await res.json();
        if (d.serviceType) setServiceType(d.serviceType);
        if (d.fromAddress) setFromAddress(d.fromAddress);
        if (d.toAddress) setToAddress(d.toAddress);
        if (d.fromAccess) setFromAccess(d.fromAccess);
        if (d.toAccess) setToAccess(d.toAccess);
        if (d.moveDate) setMoveDate(d.moveDate);
        if (d.moveSize) {
          setMoveSize(d.moveSize);
          moveSizeUserTouchedRef.current = true;
        }
        if (d.firstName) setFirstName(d.firstName);
        if (d.lastName) setLastName(d.lastName);
        if (d.email) setEmail(d.email);
        if (d.phone) setPhone(formatPhone(d.phone));
        if (d.squareFootage) setSqft(d.squareFootage);
        if (d.workstationCount) setWsCount(d.workstationCount);
        setHubspotBanner(
          `Pre-filled from HubSpot Deal #${d.jobNo || hubspotDealId}`,
        );
        setHubspotLoaded(true);
      } catch {
        /* ignore */
      }
    })();
  }, [hubspotDealId]);

  const copyQuoteParam = searchParams.get("copy_quote")?.trim() || "";
  const copyQuotePrefillDone = useRef(false);

  // ── Copy from existing quote (B2B / commercial edit entry) ─────────────
  useEffect(() => {
    if (!copyQuoteParam || copyQuotePrefillDone.current) return;
    copyQuotePrefillDone.current = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/quotes/copy-prefill?quote_id=${encodeURIComponent(copyQuoteParam)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { quote?: Record<string, unknown> };
        const Q = data.quote;
        if (!Q) return;
        const st = String(Q.service_type || "");
        const nextService =
          st === "b2b_oneoff" || st === "b2b_delivery" ? "b2b_delivery" : st;
        if (nextService && isDefinedQuoteServiceType(nextService)) {
          setServiceType(nextService);
        }
        const contacts = Q.contacts as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null
          | undefined;
        const contact = Array.isArray(contacts) ? contacts[0] : contacts;
        const cStr = (v: unknown) => (v != null ? String(v).trim() : "");
        const nm = cStr(contact?.name);
        if (nm) {
          const parts = nm.split(/\s+/);
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }
        if (cStr(contact?.email)) setEmail(cStr(contact?.email).toLowerCase());
        if (cStr(contact?.phone)) setPhone(formatPhone(cStr(contact?.phone)));
        if (cStr(Q.from_address)) setFromAddress(cStr(Q.from_address));
        if (cStr(Q.to_address)) setToAddress(cStr(Q.to_address));
        if (cStr(Q.move_date)) setMoveDate(cStr(Q.move_date).slice(0, 10));
        if (cStr(Q.from_access)) setFromAccess(cStr(Q.from_access));
        if (cStr(Q.to_access)) setToAccess(cStr(Q.to_access));

        const fa =
          Q.factors_applied &&
          typeof Q.factors_applied === "object" &&
          !Array.isArray(Q.factors_applied)
            ? (Q.factors_applied as Record<string, unknown>)
            : null;
        if (fa) {
          const vc = cStr(fa.b2b_vertical_code);
          if (vc) setB2bVerticalCode(vc);
          const linesRaw = fa.b2b_line_items;
          if (Array.isArray(linesRaw) && linesRaw.length > 0) {
            const mapped: B2bLineRow[] = linesRaw.map((row) => {
              const r = row as Record<string, unknown>;
              const qtyRaw = r.quantity ?? r.qty;
              const qty = Math.max(1, Number(qtyRaw) || 1);
              return {
                description: cStr(r.description) || "Item",
                qty,
                fragile: Boolean(r.fragile),
                handling_type: cStr(fa.b2b_handling_type) || undefined,
              };
            });
            setB2bLines(mapped);
          }
          const biz = cStr(fa.b2b_retailer_source);
          if (biz) setB2bBusinessName(biz);
        }

        setLeadQuoteBanner(
          `Loaded ${cStr(Q.quote_id) || copyQuoteParam}. Review fields, adjust pricing, then generate.`,
        );
      } catch {
        /* ignore */
      }
    })();
  }, [copyQuoteParam]);

  useEffect(() => {
    const leadForPrev =
      (leadIdParam || "").trim() ||
      (typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("lead_id") || "")
            .trim()
        : "");
    if (
      prevLeadIdForHandoffRef.current != null &&
      prevLeadIdForHandoffRef.current !== leadForPrev
    ) {
      photoReviewInventoryHandoffRef.current = false;
    }
    prevLeadIdForHandoffRef.current = leadForPrev || null;
  }, [leadIdParam, photoHandoffQueryKey]);

  // ── Lead pre-fill (Send Quote from Leads dashboard) ────
  useEffect(() => {
    // `useSearchParams()` can be empty for one frame while `window.location` already
    // has `?lead_id=` (App Router hydration). If we treat that as "no lead", we run
    // the cleanup below *after* the photo handoff `useLayoutEffect` and wipe
    // `photoReviewInventoryHandoffRef` + pre-filled inventory.
    const leadIdForEffect =
      leadIdParam ||
      (typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("lead_id") || "")
            .trim()
        : "");
    if (!leadIdForEffect) {
      setLeadQuoteBanner("");
      setLeadIntelSummary(null);
      setLeadInventoryReview([]);
      setLeadParsedWeightMax(null);
      setLeadParsedDimensions("");
      leadInventoryPrefillSigRef.current = "";
      leadSpecialtyPrefillSigRef.current = "";
      photoReviewInventoryHandoffRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/leads/${encodeURIComponent(leadIdForEffect)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const L = data.lead as Record<string, unknown> | undefined;
        if (!L || cancelled) return;
        const str = (v: unknown) => (v != null ? String(v).trim() : "");
        const num = str(L.lead_number);
        const fn = str(L.first_name);
        const ln = str(L.last_name);
        const nm = [fn, ln].filter(Boolean).join(" ");
        if (num) {
          setLeadQuoteBanner(
            nm
              ? `Creating quote for lead ${num} · ${nm}`
              : `Creating quote for lead ${num}`,
          );
        }
        if (fn) setFirstName(fn);
        if (ln) setLastName(ln);
        if (str(L.email)) setEmail(str(L.email).toLowerCase());
        if (str(L.phone)) setPhone(formatPhone(str(L.phone)));
        const st = str(L.service_type);
        if (st === "b2b_oneoff") {
          setServiceType("b2b_delivery");
        } else if (st && isDefinedQuoteServiceType(st)) {
          setServiceType(st);
        }
        const pwm =
          L.parsed_weight_lbs_max != null
            ? Number(L.parsed_weight_lbs_max)
            : NaN;
        setLeadParsedWeightMax(Number.isFinite(pwm) ? pwm : null);
        setLeadParsedDimensions(str(L.parsed_dimensions_text));
        const ms = str(L.move_size);
        if (ms && MOVE_SIZES.some((x) => x.value === ms)) {
          setMoveSize(ms);
          moveSizeUserTouchedRef.current = true;
        }
        if (str(L.from_address)) setFromAddress(str(L.from_address));
        if (str(L.to_address)) setToAddress(str(L.to_address));
        const pd = str(L.preferred_date);
        if (pd) setMoveDate(pd.slice(0, 10));
        if (str(L.from_access)) setFromAccess(str(L.from_access));
        if (str(L.to_access)) setToAccess(str(L.to_access));
        if (str(L.preferred_time)) setPreferredTime(str(L.preferred_time));
        const rt = str(L.recommended_tier).toLowerCase();
        if (rt === "estate") {
          // Estate is only warranted for large homes (3BR+) or moves with specialty items.
          // If the lead recommends estate for a 1BR/2BR without specialty items, downgrade
          // to signature to prevent grossly over-scoped quotes like YG-30229.
          const msKey = str(L.move_size).toLowerCase().trim().replace(/\s+/g, "_").replace(/bedroom/g, "br");
          const isLargeHome = ["3br", "4br", "5br_plus"].includes(msKey);
          const hasSpecialty =
            Array.isArray(L.specialty_items_detected) && L.specialty_items_detected.length > 0;
          if (isLargeHome || hasSpecialty) {
            setRecommendedTier("estate");
          } else {
            setRecommendedTier("signature");
          }
        } else if (rt === "signature") setRecommendedTier("signature");
        else if (rt === "curated") setRecommendedTier("essential");
        const pbc =
          L.parsed_box_count != null ? Number(L.parsed_box_count) : NaN;
        if (!Number.isNaN(pbc) && pbc > 0) setClientBoxCount(String(pbc));
        const an = str(L.assembly_needed).toLowerCase().trim();
        // Broaden assembly intake matching — "Both", "yes", "assembly", "disassembly",
        // "reassembly" all confirm that the client wants assembly service.
        const anIsYes =
          an === "yes" ||
          an === "true" ||
          an === "both" ||
          an.includes("both") ||
          an.includes("assembly") ||
          an.includes("disassembly") ||
          an.includes("reassembly");
        if (anIsYes) setAssembly("Both");
        // Residential assembly override mapping: client's intake answer beats auto-detection.
        //   "none" / "no" / "no thank you" / "not required" → assembly_override = false
        //   confirmed-yes patterns above                    → assembly_override = true
        //   anything else / empty                          → leave null (use auto-detection)
        if (
          an.includes("none") ||
          an === "no" ||
          an === "false" ||
          an.includes("not required") ||
          an.includes("no thank")
        ) {
          setAssemblyOverride(false);
        } else if (anIsYes) {
          setAssemblyOverride(true);
        }

        const summary = str(L.intelligence_summary);
        setLeadIntelSummary(summary || null);

        const rawInv = L.parsed_inventory;
        const review: LeadInvReviewRow[] = [];
        const autoItems: InventoryItemEntry[] = [];
        const invSig =
          Array.isArray(rawInv) && rawInv.length > 0
            ? `${leadIdForEffect}:${itemWeights.length}:${JSON.stringify(rawInv)}`
            : `empty:${leadIdForEffect}`;
        if (photoReviewInventoryHandoffRef.current) {
          leadInventoryPrefillSigRef.current = invSig;
        } else if (!fromPhotoReview && invSig !== leadInventoryPrefillSigRef.current) {
          if (!Array.isArray(rawInv) || rawInv.length === 0) {
            setInventoryItems([]);
            setLeadInventoryReview([]);
          } else {
            for (const row of rawInv as Record<string, unknown>[]) {
              const conf = String(row.confidence || "");
              const slug = row.matched_item ? String(row.matched_item) : null;
              const qty = Math.max(1, Number(row.quantity) || 1);
              const highOk = slug && conf === "high";
              if (highOk) {
                const w = itemWeights.find((x) => x.slug === slug);
                const ws = Number(w?.weight_score ?? row.weight_score ?? 1);
                autoItems.push({
                  slug: slug!,
                  name: w?.item_name || String(row.matched_name || slug),
                  quantity: qty,
                  weight_score: ws,
                  weight_tier_code: inferWeightTierFromLegacyScore(ws),
                  fragile: false,
                });
              } else {
                review.push({
                  raw_text: String(row.raw_text || ""),
                  matched_item: slug,
                  matched_name: row.matched_name
                    ? String(row.matched_name)
                    : null,
                  quantity: qty,
                  confidence: conf,
                  note: row.note ? String(row.note) : undefined,
                });
              }
            }
            setInventoryItems(autoItems);
            setLeadInventoryReview(review);
          }
          leadInventoryPrefillSigRef.current = invSig;
        } else if (fromPhotoReview) {
          leadInventoryPrefillSigRef.current = invSig;
        }

        const specRaw = L.specialty_items_detected;
        const specSig =
          Array.isArray(specRaw) && specRaw.length > 0
            ? `${leadIdForEffect}:${JSON.stringify(specRaw)}`
            : `empty:${leadIdForEffect}`;
        if (specSig !== leadSpecialtyPrefillSigRef.current) {
          if (!Array.isArray(specRaw) || specRaw.length === 0) {
            setSpecialtyItems([]);
          } else {
            const blob = `${str(L.raw_inventory_text)} ${str(L.message)}`;
            const mapped = mapSpecialtyToQuoteTypes(
              specRaw as SpecialtyDetected[],
              blob,
            );
            if (mapped.length > 0) setSpecialtyItems(mapped);
          }
          leadSpecialtyPrefillSigRef.current = specSig;
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadIdParam, itemWeights, fromPhotoReview, photoHandoffQueryKey]);

  // Photo review: hand off inventory + lead fields via sessionStorage. We read
  // `window.location.search` (not only `useSearchParams`) so the first client
  // render cannot skip the handoff when the hook is still empty or stale.
  const applyPhotoReviewHandoff = useCallback(() => {
    if (typeof window === "undefined") return;
    const wsp = new URLSearchParams(window.location.search);
    const fromReview = wsp.get("from_photo_review") === "1";
    const leadForHandoff = (wsp.get("lead_id") || "").trim();
    if (!fromReview || !leadForHandoff) return;
    const k = `quote_inv_prefill_v1_${leadForHandoff}`;

    const stripParamFromUrl = () => {
      if (new URLSearchParams(window.location.search).get("from_photo_review") !== "1")
        return;
      const u = new URL(window.location.href);
      u.searchParams.delete("from_photo_review");
      const next = `${u.pathname}${u.search ? `?${u.search}` : ""}${u.hash}`;
      router.replace(next);
    };

    let raw: string | null = quotePhotoReviewHandoffJsonByLeadId.get(leadForHandoff) ?? null;
    if (raw == null) {
      try {
        raw = window.sessionStorage.getItem(k);
      } catch {
        raw = null;
      }
      if (raw) quotePhotoReviewHandoffJsonByLeadId.set(leadForHandoff, raw);
    }

    if (!raw) {
      stripParamFromUrl();
      return;
    }
    const strH = (v: unknown) => (v != null ? String(v).trim() : "");
    try {
      const parsed: unknown = JSON.parse(raw);
      let items: InventoryItemEntry[] = [];
      let serviceFromHandoff: string | null = null;
      if (Array.isArray(parsed)) {
        items = parsed as InventoryItemEntry[];
      } else if (parsed && typeof parsed === "object" && "items" in (parsed as object)) {
        const p = parsed as PhotoReviewQuoteHandoffShape;
        if (!Array.isArray(p.items)) {
          stripParamFromUrl();
          return;
        }
        items = p.items;
        const stHand = p.service_type;
        if (
          typeof stHand === "string" &&
          stHand.trim() &&
          isDefinedQuoteServiceType(stHand.trim())
        ) {
          serviceFromHandoff = stHand.trim();
        }
        if (strH(p.first_name)) setFirstName(strH(p.first_name));
        if (strH(p.last_name)) setLastName(strH(p.last_name));
        if (strH(p.email)) setEmail(strH(p.email).toLowerCase());
        if (strH(p.phone)) setPhone(formatPhone(strH(p.phone)));
        if (strH(p.from_address)) setFromAddress(strH(p.from_address));
        if (strH(p.to_address)) setToAddress(strH(p.to_address));
        if (strH(p.preferred_date)) setMoveDate(strH(p.preferred_date).slice(0, 10));
        const msH = strH(p.move_size);
        if (msH && MOVE_SIZES.some((x) => x.value === msH)) {
          setMoveSize(msH);
          moveSizeUserTouchedRef.current = true;
        }
      } else {
        stripParamFromUrl();
        return;
      }
      if (Array.isArray(items) && items.length > 0) {
        setInventoryItems(items);
        setLeadInventoryReview([]);
        photoReviewInventoryHandoffRef.current = true;
        setLeadQuoteBanner(
          (prev) => (prev ? `${prev} · From photo review` : "From photo review"),
        );
        if (serviceFromHandoff) {
          setServiceType(serviceFromHandoff);
          serviceTypeUrlAppliedRef.current = true;
        }
      } else if (serviceFromHandoff) {
        setServiceType(serviceFromHandoff);
        serviceTypeUrlAppliedRef.current = true;
      }
    } catch {
      stripParamFromUrl();
      return;
    }
    window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(k);
      } catch {
        /* ignore */
      }
      quotePhotoReviewHandoffJsonByLeadId.delete(leadForHandoff);
    }, 0);
    stripParamFromUrl();
  }, [router]);

  useLayoutEffect(() => {
    applyPhotoReviewHandoff();
  }, [applyPhotoReviewHandoff, photoHandoffQueryKey]);

  useEffect(() => {
    applyPhotoReviewHandoff();
  }, [applyPhotoReviewHandoff, photoHandoffQueryKey]);

  useEffect(() => {
    if (specialtyBuilderQs) setSpecialtyBuilderOpen(true);
  }, [specialtyBuilderQs]);

  useEffect(() => {
    if (!widgetRequestIdParam) {
      setWidgetQuoteBanner("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/widget-leads?id=${encodeURIComponent(widgetRequestIdParam)}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { lead?: Record<string, unknown> };
        const L = data.lead;
        if (!L || cancelled) return;
        const str = (v: unknown) => (v != null ? String(v).trim() : "");
        const nm = str(L.name);
        if (nm) {
          const parts = nm.split(/\s+/).filter(Boolean);
          if (parts[0]) setFirstName(parts[0]);
          if (parts.length > 1) setLastName(parts.slice(1).join(" "));
        }
        if (str(L.email)) setEmail(str(L.email).toLowerCase());
        if (str(L.phone)) setPhone(formatPhone(str(L.phone)));
        const fp = str(L.from_postal);
        const tp = str(L.to_postal);
        if (fp) setFromAddress(fp.toUpperCase());
        if (tp) setToAddress(tp.toUpperCase());
        const ms = str(L.move_size);
        if (ms && MOVE_SIZES.some((x) => x.value === ms)) {
          setMoveSize(ms);
          moveSizeUserTouchedRef.current = true;
        }
        const md = L.move_date;
        if (typeof md === "string" && md.trim())
          setMoveDate(md.trim().slice(0, 10));
        setServiceType("local_move");
        setWidgetQuoteBanner(
          `Pre-filled from widget lead ${str(L.lead_number) || ""}`.trim(),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [widgetRequestIdParam]);

  const specialtyBuilderItemDescription = useMemo(() => {
    if (serviceType === "single_item" && itemDescription.trim())
      return itemDescription.trim();
    if (serviceType === "specialty" && specialtyItemDescription.trim())
      return specialtyItemDescription.trim();
    return itemDescription.trim() || specialtyItemDescription.trim();
  }, [serviceType, itemDescription, specialtyItemDescription]);

  const specialtyBuilderWeightStr = useMemo(() => {
    if (serviceType === "single_item" && itemWeight.trim())
      return itemWeight.trim();
    if (leadParsedWeightMax != null)
      return String(Math.round(leadParsedWeightMax));
    return itemWeight.trim();
  }, [serviceType, itemWeight, leadParsedWeightMax]);

  const specialtyBuilderDimensions = useMemo(() => {
    const l = specialtyDimL.trim();
    const w = specialtyDimW.trim();
    const h = specialtyDimH.trim();
    if (l && w && h) return `${l}" x ${w}" x ${h}"`;
    if (l && w) return `${l}" x ${w}"`;
    return leadParsedDimensions.trim();
  }, [specialtyDimL, specialtyDimW, specialtyDimH, leadParsedDimensions]);

  const acceptLeadReviewRow = useCallback(
    (index: number) => {
      setLeadInventoryReview((prev) => {
        const row = prev[index];
        if (!row?.matched_item) return prev;
        const w = itemWeights.find((x) => x.slug === row.matched_item);
        const ws = Number(w?.weight_score ?? 1);
        const entry: InventoryItemEntry = {
          slug: row.matched_item,
          name: w?.item_name || row.matched_name || row.matched_item,
          quantity: row.quantity,
          weight_score: ws,
          weight_tier_code: inferWeightTierFromLegacyScore(ws),
          fragile: false,
        };
        setInventoryItems((inv) => [...inv, entry]);
        return prev.filter((_, i) => i !== index);
      });
    },
    [itemWeights],
  );

  const dismissLeadReviewRow = useCallback((index: number) => {
    setLeadInventoryReview((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Applicable add-ons (popular first; tier hides items bundled in Signature/Estate) ────
  const applicableAddons = useMemo(() => {
    const base = [
      ...allAddons.filter((a) =>
        a.applicable_service_types.includes(serviceType),
      ),
    ].sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0));
    if (serviceType === "local_move" || serviceType === "long_distance") {
      return getVisibleAddons(base, recommendedTier);
    }
    return base;
  }, [allAddons, serviceType, recommendedTier]);
  const popularAddons = useMemo(
    () => applicableAddons.filter((a) => a.is_popular),
    [applicableAddons],
  );
  const otherAddons = useMemo(
    () => applicableAddons.filter((a) => !a.is_popular),
    [applicableAddons],
  );
  const [showAllAddons, setShowAllAddons] = useState(false);

  // After quote is sent: slow dissolve then navigate to quote detail
  useEffect(() => {
    if (!dissolving || !quoteId) return;
    const t = setTimeout(() => {
      router.push(`/admin/quotes/${quoteId}`);
    }, 900);
    return () => clearTimeout(t);
  }, [dissolving, quoteId, router]);

  // When service type changes, clear add-ons that no longer apply
  useEffect(() => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      for (const [id] of next) {
        const addon = allAddons.find((a) => a.id === id);
        if (addon && !addon.applicable_service_types.includes(serviceType)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [serviceType, allAddons]);

  useEffect(() => {
    if (serviceType !== "event") setEventMulti(false);
  }, [serviceType]);

  const prevServiceTypeRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevServiceTypeRef.current === null) {
      prevServiceTypeRef.current = serviceType;
      return;
    }
    if (prevServiceTypeRef.current === serviceType) return;
    const previousServiceType = prevServiceTypeRef.current;
    prevServiceTypeRef.current = serviceType;

    setQuoteResult(null);
    setQuoteId(null);
    setSendSuccess(false);
    setGenerating(false);
    setInventoryItems([]);
    setClientBoxCount("");
    setSpecialtyItems([]);
    setEventItems([]);
    setEventCrewOverride("");
    setEventHoursOverride("");
    setEventPreTaxOverride("");
    setEventOverrideReason("");
    setB2bLines([]);
    setSqft("");
    setWsCount("");
    setHasIt(false);
    setHasConf(false);
    setHasReception(false);
    setTimingPref("");
    setOfficeCrewSize(2);
    setOfficeEstHours(5);
    setOfficeDesks("");
    setOfficeChairs("");
    setOfficeFiling("");
    setOfficeBoardroomCount(1);
    setOfficeKitchen(false);
    setOfficeTruckCount(1);
    setItemDescription("");
    setItemCategory("standard_furniture");
    setItemWeight("");
    setAssembly("None");
    setStairCarry(false);
    setStairFlights(1);
    setNumItems(1);
    setSingleItemSpecialHandling("");
    setDeclaredValue("");
    setSpecialtyType("");
    setSpecialtyItemDescription("");
    setSpecialtyDimL("");
    setSpecialtyDimW("");
    setSpecialtyDimH("");
    setSpecialtyWeightClass("");
    setSpecialtyRequirements([]);
    setSpecialtyNotes("");
    setSpecialtyBuildingReqs([]);
    setSpecialtyAccessDifficulty("");
    setEventName("");
    setVenueAddress("");
    setEventReturnDate("");
    setEventSetupRequired(false);
    setB2bBusinessName("");
    setB2bTimeBand("morning");
    setB2bPriceOverrideOn(false);
    setB2bPreTaxOverrideAmount("");
    setB2bCatalogOpenIdx(null);
    setB2bWeightCategory("standard");
    setCratingRequired(false);
    setCratingItems([]);
    setReferralCode("");
    setReferralId(null);
    setReferralStatus("idle");
    setReferralMsg("");
    setReferralDiscount(0);
    setArrivalWindow(TIME_WINDOW_OPTIONS[1] ?? TIME_WINDOW_OPTIONS[0] ?? "");

    if (serviceType === "bin_rental") {
      setBinPickupSameAsDelivery(true);
      setBinBundleType("2br");
      setBinCustomCount(10);
      setBinExtraBins(0);
      setBinPackingPaper(false);
      setBinMaterialDelivery(previousServiceType !== "local_move");
      setBinLinkedMoveId("");
      setBinDeliveryNotes("");
      setBinInternalNotes("");
    } else if (previousServiceType === "bin_rental") {
      setBinPickupSameAsDelivery(true);
      setBinBundleType("2br");
      setBinCustomCount(10);
      setBinExtraBins(0);
      setBinPackingPaper(false);
      setBinMaterialDelivery(true);
      setBinLinkedMoveId("");
      setBinDeliveryNotes("");
      setBinInternalNotes("");
    }
  }, [serviceType]);

  useEffect(() => {
    if (serviceType !== "bin_rental" || !binPickupSameAsDelivery) return;
    setFromAddress(toAddress);
  }, [serviceType, binPickupSameAsDelivery, toAddress]);

  useEffect(() => {
    if (serviceType !== "bin_rental" || !binPickupSameAsDelivery) return;
    setFromAccess(toAccess);
  }, [serviceType, binPickupSameAsDelivery, toAccess]);

  useEffect(() => {
    if (serviceType !== "bin_rental") return;
    const allowed = new Set(BIN_RENTAL_ACCESS_OPTIONS.map((o) => o.value));
    if (!allowed.has(toAccess)) setToAccess("elevator");
    if (!allowed.has(fromAccess)) setFromAccess("elevator");
  }, [serviceType, toAccess, fromAccess]);

  useEffect(() => {
    if (serviceType !== "specialty" && serviceType !== "white_glove") {
      setSpecialtyRouteKm(null);
      setSpecialtyDriveMin(null);
      return;
    }
    const from = fromAddress.trim();
    const to = toAddress.trim();
    if (from.length < 8 || to.length < 8) {
      setSpecialtyRouteKm(null);
      setSpecialtyDriveMin(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSpecialtyRouteLoading(true);
      try {
        const res = await fetch("/api/quotes/preview-distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from_address: from, to_address: to }),
        });
        const data = (await res.json()) as {
          distance_km?: number
          drive_time_min?: number
        };
        if (res.ok && typeof data.distance_km === "number") {
          setSpecialtyRouteKm(data.distance_km);
          setSpecialtyDriveMin(
            typeof data.drive_time_min === "number"
              ? data.drive_time_min
              : null,
          );
        } else {
          setSpecialtyRouteKm(null);
          setSpecialtyDriveMin(null);
        }
      } catch {
        setSpecialtyRouteKm(null);
        setSpecialtyDriveMin(null);
      } finally {
        setSpecialtyRouteLoading(false);
      }
    }, 750);
    return () => clearTimeout(handle);
  }, [serviceType, fromAddress, toAddress]);

  const wgPrevServiceTypeRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      serviceType === "white_glove" &&
      wgPrevServiceTypeRef.current !== "white_glove"
    ) {
      setWhiteGloveItemRows((rows) =>
        rows.length > 0 ? rows : [createDefaultWhiteGloveItem()],
      );
    }
    wgPrevServiceTypeRef.current = serviceType;
  }, [serviceType]);

  // ── Add-on subtotal ───────────────────────
  const addonSubtotal = useMemo(() => {
    let total = 0;
    for (const [id, sel] of selectedAddons) {
      const addon = allAddons.find((a) => a.id === id);
      if (!addon) continue;
      switch (addon.price_type) {
        case "flat":
          total += addon.price;
          break;
        case "per_unit":
          total += addon.price * (sel.quantity || 1);
          break;
        case "tiered":
          total += addon.tiers?.[sel.tier_index ?? 0]?.price ?? 0;
          break;
        case "percent":
          total += Math.round(1199 * (addon.percent_value ?? 0));
          break;
      }
    }
    return total;
  }, [selectedAddons, allAddons]);

  const configMap = useMemo(() => new Map(Object.entries(config)), [config]);

  /** Specialty suggested $ range: base band × weight + distance (Mapbox) + crane/climate/crating */
  const specialtyLivePreview = useMemo(() => {
    if (serviceType !== "specialty" || !specialtyType) return null;
    const range = SPECIALTY_BASE_PRICES[specialtyType];
    if (!range) return null;
    const priceMap = parseCfgJson<Record<string, number>>(
      config,
      "crating_prices",
      CRATING_SIZE_FALLBACK,
    );
    const cratingSum =
      cratingRequired && cratingItems.length > 0
        ? cratingItems.reduce(
            (sum, p) =>
              sum + (priceMap[p.size] ?? CRATING_SIZE_FALLBACK[p.size] ?? 250),
            0,
          )
        : 0;
    const band = specialtyPreviewBand(config, range, {
      weightClass: specialtyWeightClass,
      distanceKm: specialtyRouteKm,
      craneRigging: specialtyRequirements.includes("crane_rigging"),
      climateControlled: specialtyRequirements.includes("climate_controlled"),
      cratingSum,
    });
    const typeLabel =
      SPECIALTY_TYPES.find((t) => t.value === specialtyType)?.label ??
      specialtyType;
    const weightLabel = SPECIALTY_WEIGHT_OPTIONS.find(
      (w) => w.value === specialtyWeightClass,
    )?.label;
    return { ...band, typeLabel, weightLabel };
  }, [
    serviceType,
    specialtyType,
    config,
    specialtyWeightClass,
    specialtyRouteKm,
    specialtyRequirements,
    cratingRequired,
    cratingItems,
  ]);

  const whiteGloveLivePreview = useMemo(() => {
    if (serviceType !== "white_glove") return null;
    const items = whiteGloveItemRows
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description.trim(),
        quantity: r.quantity,
        category: r.category,
        weight_class: r.weight_class,
        assembly: r.assembly,
        is_fragile: r.is_fragile,
        is_high_value: r.is_high_value,
        notes: r.notes,
      }));
    if (items.length === 0) return null;
    const parkingRates = parseCfgJson<Record<string, number>>(
      config,
      "parking_surcharges",
      {
        dedicated: 0,
        street: 0,
        no_dedicated: 75,
      },
    );
    const lc = cfgNum(config, "long_carry_surcharge", 75);
    const plcTotal =
      (parkingRates[fromParking] ?? 0) +
      (parkingRates[toParking] ?? 0) +
      (fromLongCarry ? lc : 0) +
      (toLongCarry ? lc : 0);
    const bd = computeWhiteGlovePricingBreakdown(configMap, items, {
      distKm: specialtyRouteKm ?? 0,
      fromAccessCharge: 0,
      toAccessCharge: 0,
      parkingLongCarryTotal: plcTotal,
      declaredValue: Number(declaredValue) || 0,
      debrisRemoval: wgDebrisRemoval,
      guaranteedNarrowWindowhours: wgGuaranteedWindow
        ? wgGuaranteedWindowHours
        : null,
      truckType: "sprinter",
    });
    const crew = recommendWhiteGloveCrew(items);
    const hours = estimateWhiteGloveHours(
      items,
      specialtyRouteKm ?? 0,
      crew,
      specialtyDriveMin,
    );
    const taxR = cfgNum(config, "tax_rate", TAX_RATE);
    const tax = Math.round(bd.subtotalPreTax * taxR * 100) / 100;
    return {
      bd,
      crew,
      hours,
      tax,
      total: bd.subtotalPreTax + tax,
      distKm: specialtyRouteKm,
      distLoading: specialtyRouteLoading,
    };
  }, [
    serviceType,
    whiteGloveItemRows,
    config,
    configMap,
    fromParking,
    toParking,
    fromLongCarry,
    toLongCarry,
    declaredValue,
    wgDebrisRemoval,
    wgGuaranteedWindow,
    wgGuaranteedWindowHours,
    specialtyRouteKm,
    specialtyDriveMin,
    specialtyRouteLoading,
  ]);

  // ── Live assembly auto-detection from inventory ──────────────────────────────
  const assemblyDetection = useMemo(
    () => detectAssemblyRequired(inventoryItems, itemWeights),
    [inventoryItems, itemWeights],
  );
  // Effective value passed downstream: override beats auto-detection
  const effectiveAssemblyRequired =
    assemblyOverride !== null ? assemblyOverride : assemblyDetection.required;

  // ── Quick optimistic estimate — updates on ANY pricing-relevant change ──────
  const liveEstimate = useMemo(
    () =>
      quickEstimate(
        config,
        serviceType,
        moveSize,
        addonSubtotal,
        fromAccess || undefined,
        toAccess || undefined,
        inventoryScoreWithBoxes > 0 ? inventoryScoreWithBoxes : undefined,
        specialtyItems.length > 0 ? specialtyItems : undefined,
        moveDate || undefined,
        // Pass inventory ONLY when assembly is effectively required.
        effectiveAssemblyRequired && inventoryItems.length > 0 ? inventoryItems : undefined,
        effectiveAssemblyRequired && itemWeights.length > 0 ? itemWeights : undefined,
      ),
    [
      config,
      serviceType,
      moveSize,
      addonSubtotal,
      fromAccess,
      toAccess,
      inventoryScoreWithBoxes,
      specialtyItems,
      moveDate,
      inventoryItems,
      itemWeights,
      effectiveAssemblyRequired,
    ],
  );

  useEffect(() => {
    if (serviceType !== "bin_rental") return;
    const delivery = toAddress.trim();
    const pickup =
      binPickupSameAsDelivery || !fromAddress.trim()
        ? delivery
        : fromAddress.trim();
    if (!delivery) {
      setBinHubDeliveryKm(null);
      setBinHubPickupKm(null);
      setBinDistanceGeoFailed(false);
      return;
    }
    const t = window.setTimeout(() => {
      const coordsFromGeocode = async (
        q: string,
      ): Promise<{ lat: number; lng: number } | null> => {
        try {
          const res = await fetch(
            `/api/mapbox/geocode?q=${encodeURIComponent(q)}&limit=1&country=CA`,
            { credentials: "include" },
          );
          const data = (await res.json()) as {
            features?: { geometry?: { coordinates?: number[] } }[];
          };
          const c = data.features?.[0]?.geometry?.coordinates;
          if (
            Array.isArray(c) &&
            c.length >= 2 &&
            typeof c[0] === "number" &&
            typeof c[1] === "number"
          ) {
            return { lng: c[0], lat: c[1] };
          }
        } catch {
          /* ignore */
        }
        return null;
      };
      void (async () => {
        const dCoord = await coordsFromGeocode(delivery);
        const pCoord =
          pickup === delivery ? dCoord : await coordsFromGeocode(pickup);
        if (!dCoord || !pCoord) {
          setBinDistanceGeoFailed(true);
          setBinHubDeliveryKm(null);
          setBinHubPickupKm(null);
          return;
        }
        setBinDistanceGeoFailed(false);
        const dk = haversineKmBin(
          YUGO_HQ_LAT,
          YUGO_HQ_LNG,
          dCoord.lat,
          dCoord.lng,
        );
        const pk = haversineKmBin(
          YUGO_HQ_LAT,
          YUGO_HQ_LNG,
          pCoord.lat,
          pCoord.lng,
        );
        setBinHubDeliveryKm(dk);
        setBinHubPickupKm(pk);
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [serviceType, toAddress, fromAddress, binPickupSameAsDelivery]);

  const binLivePreview = useMemo(() => {
    if (serviceType !== "bin_rental") return null;
    const linked = binLinkedMoveId.trim() || null;
    const fleetCap = cfgNum(config, "bin_total_inventory", 500);
    const avail =
      binInventorySnapshot != null &&
      Number.isFinite(binInventorySnapshot.available)
        ? Math.max(0, Math.floor(binInventorySnapshot.available))
        : null;
    const r = calculateBinRentalPrice(
      {
        bundle_type: binBundleType,
        bin_count: binCustomCount,
        extra_bins: binExtraBins,
        packing_paper: binPackingPaper,
        material_delivery_charge: binMaterialDelivery,
        linked_move_id: linked,
        available_bins: avail,
        hub_distance: binDistanceGeoFailed
          ? {
              delivery_km_from_hub: null,
              pickup_km_from_hub: null,
              distance_pricing_unavailable: true,
            }
          : {
              delivery_km_from_hub: binHubDeliveryKm,
              pickup_km_from_hub: binHubPickupKm,
              distance_pricing_unavailable: false,
            },
      },
      configMap,
    );
    if (!r.ok) {
      return {
        error: r.error,
        subtotal: null as number | null,
        tax: null as number | null,
        total: null as number | null,
        lines: [] as { label: string; amount: number }[],
        need: r.requiredBins ?? 0,
        cap: fleetCap,
        available: avail as number | null,
        invOk: false,
      };
    }
    const taxRate = cfgNum(config, "tax_rate", TAX_RATE);
    const tax = Math.round(r.subtotal * taxRate);
    const total = r.subtotal + tax;
    const need = r.totalBins;
    const invOk = avail == null || need <= avail;
    return {
      error: null as string | null,
      subtotal: r.subtotal,
      tax,
      total,
      lines: r.lines.map((l) => ({ label: l.label, amount: l.amount })),
      need,
      cap: fleetCap,
      available: avail,
      invOk,
      dropOff: "",
      moveD: moveDate,
      pickup: "",
    };
  }, [
    serviceType,
    binBundleType,
    binCustomCount,
    binExtraBins,
    binPackingPaper,
    binMaterialDelivery,
    binLinkedMoveId,
    config,
    configMap,
    moveDate,
    binInventorySnapshot,
    binHubDeliveryKm,
    binHubPickupKm,
    binDistanceGeoFailed,
  ]);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") return;
    const handle = window.setTimeout(() => {
      const run = async () => {
        let body: Record<string, unknown>;
        const route = b2bRouteAddressesFromForm(
          fromAddress,
          toAddress,
          extraFromStops,
          extraToStops,
        );
        if (route.length >= 2) {
          body =
            route.length > 2
              ? { b2b_stops: route }
              : { from_address: route[0], to_address: route[route.length - 1] };
        } else {
          setB2bPreviewDistanceKm(null);
          setB2bPreviewDriveMin(null);
          setB2bDeliveryKmFromGta(null);
          setB2bRouteLoading(false);
          return;
        }
        const minLen = 8;
        if (route.length === 2) {
          const f = String(route[0] ?? "").trim();
          const t = String(route[route.length - 1] ?? "").trim();
          if (f.length < minLen || t.length < minLen) {
            setB2bPreviewDistanceKm(null);
            setB2bPreviewDriveMin(null);
            setB2bDeliveryKmFromGta(null);
            setB2bRouteLoading(false);
            return;
          }
        }
        setB2bRouteLoading(true);
        try {
          const res = await fetch("/api/quotes/preview-distance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body),
          });
          const data = (await res.json()) as {
            distance_km?: number;
            drive_time_min?: number;
            delivery_km_from_gta_core?: number | null;
          };
          if (res.ok && typeof data.distance_km === "number") {
            setB2bPreviewDistanceKm(data.distance_km);
            setB2bPreviewDriveMin(
              typeof data.drive_time_min === "number"
                ? data.drive_time_min
                : null,
            );
            setB2bDeliveryKmFromGta(
              typeof data.delivery_km_from_gta_core === "number"
                ? data.delivery_km_from_gta_core
                : null,
            );
          } else {
            setB2bPreviewDistanceKm(null);
            setB2bPreviewDriveMin(null);
            setB2bDeliveryKmFromGta(null);
          }
        } catch {
          setB2bPreviewDistanceKm(null);
          setB2bPreviewDriveMin(null);
          setB2bDeliveryKmFromGta(null);
        } finally {
          setB2bRouteLoading(false);
        }
      };
      void run();
    }, 300);
    return () => clearTimeout(handle);
  }, [serviceType, fromAddress, toAddress, extraFromStops, extraToStops]);

  const effectiveB2bLines = useMemo(
    () =>
      getEffectiveB2bLines(b2bLines, selectedB2bVertical, b2bVerticalExtras),
    [b2bLines, selectedB2bVertical, b2bVerticalExtras],
  );

  const [debouncedB2bLines, setDebouncedB2bLines] =
    useState<B2bLineRow[]>(b2bLines);
  useEffect(() => {
    const h = window.setTimeout(() => setDebouncedB2bLines(b2bLines), 300);
    return () => clearTimeout(h);
  }, [b2bLines]);

  const effectiveB2bLinesPreview = useMemo(
    () =>
      getEffectiveB2bLines(
        debouncedB2bLines,
        selectedB2bVertical,
        b2bVerticalExtras,
      ),
    [debouncedB2bLines, selectedB2bVertical, b2bVerticalExtras],
  );

  const b2bHasExtremeWeight = useMemo(
    () =>
      hasExtremeWeightCategory(
        effectiveB2bLinesPreview
          .filter((l) => l.description.trim() && l.qty >= 1)
          .map((l) => ({ weight_category: l.weight_category })),
      ),
    [effectiveB2bLinesPreview],
  );

  /** Straight-line km from GTA core → platform zone surcharges (always applied on top of route pricing). */
  const b2bPlatformGtaZoneLines = useMemo(() => {
    const km = b2bDeliveryKmFromGta;
    const z2 = cfgNum(config, "b2b_gta_zone2_surcharge", 75);
    const z3 = cfgNum(config, "b2b_gta_zone3_surcharge", 150);
    const lines: { label: string; amount: number }[] = [];
    if (km != null) {
      if (km >= 80) {
        if (z3 > 0)
          lines.push({
            label: "Outside GTA core (zone 3: 80+ km)",
            amount: z3,
          });
      } else if (km >= 40) {
        if (z2 > 0)
          lines.push({
            label: "Outside GTA core (zone 2: 40–80 km)",
            amount: z2,
          });
      }
    }
    return lines;
  }, [b2bDeliveryKmFromGta, config]);

  const b2bPlatformWeekendLine = useMemo(() => {
    const wk = cfgNum(config, "b2b_weekend_surcharge", 40);
    if (!isMoveDateWeekend(moveDate) || wk <= 0) return null;
    return { label: "Weekend delivery", amount: wk };
  }, [moveDate, config]);

  const eventTruckOptions = useMemo(
    () => [
      { value: "sprinter", label: formatTruckOptionLabel("sprinter", config) },
      { value: "16ft", label: formatTruckOptionLabel("16ft", config) },
      { value: "20ft", label: formatTruckOptionLabel("20ft", config) },
      { value: "26ft", label: formatTruckOptionLabel("26ft", config) },
      { value: "none", label: "No truck (on-site)" },
    ],
    [config],
  );

  const b2bDimensionalPreview = useMemo(() => {
    if (
      (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") ||
      !selectedB2bVertical
    )
      return null;
    const merged = mergeBundleTierIntoMergedRates({
      ...(selectedB2bVertical.default_config as Record<string, unknown>),
    });
    const useVerticalZoneSchedule =
      String(merged.distance_mode || "") === "zones";
    const sched = (merged.schedule_surcharges || {}) as Record<string, unknown>;
    const schedWeekend =
      typeof sched.weekend === "number" ? sched.weekend : Number(sched.weekend);
    const schedCombo =
      typeof sched.weekend_or_after_hours_combined === "number"
        ? sched.weekend_or_after_hours_combined
        : Number(sched.weekend_or_after_hours_combined);
    const medCombo = merged.medical_combined_schedule === true;
    const verticalHandlesWeekend =
      useVerticalZoneSchedule &&
      ((Number.isFinite(schedWeekend) && schedWeekend > 0) ||
        (medCombo === true && Number.isFinite(schedCombo) && schedCombo > 0));
    const pricingExtras = [
      ...b2bPlatformGtaZoneLines,
      ...(verticalHandlesWeekend
        ? []
        : b2bPlatformWeekendLine
          ? [b2bPlatformWeekendLine]
          : []),
    ];
    const rawLines = effectiveB2bLinesPreview.filter(
      (l) => l.description.trim() && l.qty >= 1,
    );
    const rawItems: B2BQuoteLineItem[] = rawLines.map((l) => {
      const desc = l.description.trim();
      const bundled =
        l.bundled ??
        (selectedB2bVertical.code === "flooring"
          ? isFlooringBundledAccessory(desc, selectedB2bVertical.code)
          : false);
      const is_skid = l.is_skid ?? isSkidCatalogLabel(desc);
      return {
        description: desc,
        quantity: Math.max(1, l.qty),
        weight_category: l.weight_category || undefined,
        weight_lbs:
          typeof l.weight_lbs === "number" &&
          Number.isFinite(l.weight_lbs) &&
          l.weight_lbs > 0
            ? l.weight_lbs
            : undefined,
        actual_weight_lbs:
          typeof l.actual_weight_lbs === "number" &&
          Number.isFinite(l.actual_weight_lbs) &&
          l.actual_weight_lbs > 0
            ? Math.round(l.actual_weight_lbs)
            : undefined,
        fragile: !!l.fragile,
        handling_type: l.handling_type?.trim() || undefined,
        bundled: bundled || undefined,
        assembly_required: l.assembly_required || undefined,
        debris_removal: l.debris_removal || undefined,
        haul_away: l.haul_away || undefined,
        is_skid: is_skid || undefined,
        unit_type: l.unit_type?.trim() || undefined,
        serial_number: l.serial_number?.trim() || undefined,
        stop_assignment: l.stop_assignment?.trim() || undefined,
        declared_value: l.declared_value?.trim() || undefined,
        crating_required: l.crating_required || undefined,
        hookup_required: l.hookup_required || undefined,
      };
    });
    const handlingForEngine =
      b2bEmbedSnapshot?.handlingType?.trim().toLowerCase() ||
      b2bMasterHandlingType(effectiveB2bLinesPreview);
    const items = prepareB2bLineItemsForDimensionalEngine(
      rawItems,
      selectedB2bVertical.code,
      handlingForEngine,
      merged,
    );
    const stops: B2BDimensionalQuoteInput["stops"] =
      b2bDimensionalStopsFromForm(
        fromAddress,
        toAddress,
        fromAccess,
        toAccess,
        extraFromStops,
        extraToStops,
      );
    const artN = parseInt(String(b2bArtHangingCount).trim(), 10);
    const crateN = parseInt(String(b2bCratingPieces).trim(), 10);
    const snap = b2bEmbedSnapshot;
    const stairsParsed = snap?.stairsFlights?.trim()
      ? Number(snap.stairsFlights.trim())
      : NaN;
    const addons: string[] = [
      ...(snap?.highValue ? ["high_value"] : []),
      ...(snap?.artwork ? ["artwork"] : []),
      ...(snap?.antiques ? ["antiques"] : []),
    ];
    const dimInput: B2BDimensionalQuoteInput = {
      vertical_code: selectedB2bVertical.code,
      items,
      handling_type: handlingForEngine,
      stops,
      weekend: isMoveDateWeekend(moveDate),
      after_hours: b2bAfterHoursDerived,
      same_day: snap?.sameDay ?? b2bAutoSameDay,
      time_sensitive: snap?.timeSensitive ?? false,
      assembly_required: snap?.assemblyRequired ?? false,
      debris_removal: snap?.debrisRemoval ?? false,
      stairs_flights:
        Number.isFinite(stairsParsed) && stairsParsed > 0
          ? stairsParsed
          : undefined,
      addons: addons.length > 0 ? addons : undefined,
      skid_count: (() => {
        const n = snap?.skidCount?.trim() ? Number(snap.skidCount.trim()) : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      total_load_weight_lbs: (() => {
        const n = snap?.totalLoadWeightLbs?.trim()
          ? Number(snap.totalLoadWeightLbs.trim())
          : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      haul_away_units: (() => {
        const n = snap?.haulAwayUnits?.trim()
          ? Number(snap.haulAwayUnits.trim())
          : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      returns_pickup: snap?.returnsPickup ?? false,
      art_hanging_count: Number.isFinite(artN) && artN > 0 ? artN : undefined,
      crating_pieces:
        Number.isFinite(crateN) && crateN > 0 ? crateN : undefined,
    };
    const distKm = b2bPreviewDistanceKm ?? 0;
    const plcTotal = b2bParkingLongCarryTotalFromConfig(
      config,
      fromParking,
      toParking,
      fromLongCarry,
      toLongCarry,
    );
    const rounding = cfgNum(config, "rounding_nearest", 25);
    const dim = calculateB2BDimensionalPrice({
      vertical: toDeliveryVerticalRow(selectedB2bVertical),
      mergedRates: merged,
      input: dimInput,
      totalDistanceKm: distKm,
      roundingNearest: rounding,
      parkingLongCarryTotal: plcTotal,
      pricingExtras,
      platformConfig: config,
    });
    const taxRate = cfgNum(config, "tax_rate", TAX_RATE);
    const access = b2bAccessSurchargeFromConfig(config, fromAccess, toAccess);
    const engineSubtotal = dim.subtotal;
    const fullOv = b2bPriceOverrideOn
      ? parsePositivePreTaxOverride(b2bPreTaxOverrideAmount)
      : undefined;
    const dimensionalPreTax = engineSubtotal;
    let preTaxTotal: number;
    let fullOverrideApplied = false;
    if (fullOv !== undefined) {
      preTaxTotal = roundTo(fullOv, rounding);
      fullOverrideApplied = true;
    } else {
      preTaxTotal = dimensionalPreTax + access + addonSubtotal;
    }
    const tax = Math.round(preTaxTotal * taxRate);
    return {
      dim,
      access,
      engineSubtotal,
      dimensionalPreTax,
      preTaxTotal,
      tax,
      total: preTaxTotal + tax,
      hasRealItems: rawLines.length > 0,
      fullOverrideApplied,
      overrideReason:
        fullOverrideApplied && b2bOverrideReason.trim().length >= 3
          ? b2bOverrideReason.trim()
          : "",
      calculatedPreTaxBeforeOverride:
        dimensionalPreTax + access + addonSubtotal,
    };
  }, [
    serviceType,
    selectedB2bVertical,
    fromAddress,
    toAddress,
    fromAccess,
    toAccess,
    extraFromStops,
    extraToStops,
    b2bPreviewDistanceKm,
    b2bPlatformGtaZoneLines,
    b2bPlatformWeekendLine,
    effectiveB2bLinesPreview,
    b2bEmbedSnapshot,
    moveDate,
    b2bAfterHoursDerived,
    b2bAutoSameDay,
    b2bArtHangingCount,
    b2bCratingPieces,
    b2bPriceOverrideOn,
    b2bPreTaxOverrideAmount,
    b2bOverrideReason,
    b2bShowLineWeights,
    b2bWeightCategory,
    fromParking,
    toParking,
    fromLongCarry,
    toLongCarry,
    config,
    addonSubtotal,
  ]);

  const b2bPreviewDistanceLabel = useMemo(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff")
      return "";
    const minChars = 8;
    const route = b2bRouteAddressesFromForm(
      fromAddress,
      toAddress,
      extraFromStops,
      extraToStops,
    );
    if (route.length < 2) return "Distance: Calculating…";
    if (route.length === 2) {
      const f = String(route[0] ?? "").trim();
      const t = String(route[1] ?? "").trim();
      if (f.length < minChars || t.length < minChars)
        return "Distance: Calculating…";
    }
    if (b2bRouteLoading) return "Distance: Calculating…";
    if (b2bPreviewDistanceKm != null)
      return `Distance: ${b2bPreviewDistanceKm} km`;
    return "Distance: Calculating…";
  }, [
    serviceType,
    fromAddress,
    toAddress,
    extraFromStops,
    extraToStops,
    b2bRouteLoading,
    b2bPreviewDistanceKm,
  ]);

  const binSchedulePreview = useMemo(() => {
    if (serviceType !== "bin_rental" || !moveDate) return null;
    const dropBefore = Math.max(
      1,
      Math.floor(cfgNum(config, "bin_rental_drop_off_days_before", 7)),
    );
    const pickupAfter = Math.max(
      1,
      Math.floor(cfgNum(config, "bin_rental_pickup_days_after", 5)),
    );
    const rentalDays = Math.max(
      1,
      Math.floor(cfgNum(config, "bin_rental_rental_days", 12)),
    );
    const d = new Date(`${moveDate}T12:00:00`);
    const drop = new Date(d);
    drop.setDate(drop.getDate() - dropBefore);
    const pick = new Date(d);
    pick.setDate(pick.getDate() + pickupAfter);
    const fmt = (x: Date) =>
      x.toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    return {
      delivery: fmt(drop),
      move: fmt(d),
      pickup: fmt(pick),
      cycle: rentalDays,
    };
  }, [serviceType, moveDate, config]);

  // ── Toggle add-on ─────────────────────────
  const toggleAddon = useCallback(
    (addon: Addon) => {
      setSelectedAddons((prev) => {
        const next = new Map(prev);
        if (next.has(addon.id)) {
          next.delete(addon.id);
        } else {
          next.set(addon.id, {
            addon_id: addon.id,
            slug: addon.slug,
            quantity: 1,
            tier_index: 0,
          });
        }
        return next;
      });
    },
    [moveSize],
  );

  const updateAddonQty = useCallback((id: string, qty: number) => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, quantity: Math.max(1, qty) });
      return next;
    });
  }, []);

  const updateAddonTier = useCallback((id: string, idx: number) => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, tier_index: idx });
      return next;
    });
  }, []);

  // ── Auto-remove packing materials kit when Estate is recommended ─────────────
  useEffect(() => {
    if (recommendedTier === "estate") {
      const packingAddon = allAddons.find(
        (a) =>
          a.slug === "packing_materials_kit" ||
          a.name.toLowerCase().includes("packing materials"),
      );
      if (packingAddon) {
        setSelectedAddons((prev) => {
          if (!prev.has(packingAddon.id)) return prev;
          const next = new Map(prev);
          next.delete(packingAddon.id);
          return next;
        });
      }
    }
  }, [recommendedTier, allAddons]);

  // ── Toggle specialty item ─────────────────
  const toggleSpecialtyItem = useCallback((type: string) => {
    setSpecialtyItems((prev) => {
      const existing = prev.find((i) => i.type === type);
      if (existing) return prev.filter((i) => i.type !== type);
      return [...prev, { type, qty: 1 }];
    });
  }, []);

  const updateSpecialtyQty = useCallback((type: string, qty: number) => {
    setSpecialtyItems((prev) =>
      prev.map((i) => (i.type === type ? { ...i, qty: Math.max(1, qty) } : i)),
    );
  }, []);

  // ── Build API payload ─────────────────────
  const buildPayload = useCallback(
    (opts?: { serviceAreaOverride?: boolean }) => {
      const clientName = [firstName, lastName].filter(Boolean).join(" ");
      const base: Record<string, unknown> = {
        service_type: serviceType,
        from_address: fromAddress,
        to_address: toAddress,
        from_access: fromAccess || undefined,
        to_access: toAccess || undefined,
        from_unit: fromUnit || undefined,
        from_floor: fromFloor || undefined,
        to_unit: toUnit || undefined,
        to_floor: toFloor || undefined,
        move_date: moveDate,
        preferred_time: preferredTime || undefined,
        arrival_window: arrivalWindow || undefined,
        hubspot_deal_id: hubspotDealId || undefined,
        selected_addons: Array.from(selectedAddons.values()),
        recommended_tier: recommendedTier,
        client_name: clientName || undefined,
        client_email: email || undefined,
        client_phone: phone ? normalizePhone(phone) : undefined,
        referral_id: referralId || undefined,
        from_parking: fromParking,
        to_parking: toParking,
        from_long_carry: fromLongCarry,
        to_long_carry: toLongCarry,
      };

      if (serviceType === "local_move" || serviceType === "long_distance") {
        base.move_size = moveSize;
        base.client_box_count =
          clientBoxCount !== "" && clientBoxCount != null
            ? Number(clientBoxCount)
            : 0;
        base.specialty_items =
          specialtyItems.length > 0 ? specialtyItems : undefined;
        if (multiPickupInventoryMode && perPickupInventory.length > 0) {
          base.inventory_items = perPickupInventory.flatMap((items, idx) =>
            items.map((it) => inventoryItemToPayload(it, idx)),
          );
        } else if (inventoryItems.length > 0) {
          base.inventory_items = inventoryItems.map((i) =>
            inventoryItemToPayload(i),
          );
        }
        // Assembly auto-detection — store results so the client quote page + API can use them
        if (inventoryItems.length > 0 && itemWeights.length > 0) {
          const { totalMinutes, breakdown } = calcAssemblyMinutes(inventoryItems, itemWeights);
          base.assembly_auto_detected = true;
          base.assembly_required = totalMinutes > 0;
          base.assembly_minutes = totalMinutes > 0 ? totalMinutes : null;
          base.assembly_items = breakdown.map((b) => b.itemName);
          // Coordinator override (null = use auto)
          base.assembly_override = assemblyOverride;
        }
        // Size override confirmation — stored for audit when coordinator explicitly keeps
        // a stated move size that conflicts significantly with the inventory score.
        if (sizeOverrideConfirmed) {
          base.size_override_confirmed = true;
        }
        if (fromLat != null && Number.isFinite(fromLat)) base.from_lat = fromLat;
        if (fromLng != null && Number.isFinite(fromLng)) base.from_lng = fromLng;
        if (toLat != null && Number.isFinite(toLat)) base.to_lat = toLat;
        if (toLng != null && Number.isFinite(toLng)) base.to_lng = toLng;
        if (originBuildingFlags.length > 0) {
          base.origin_building_access_flags = originBuildingFlags;
        }
        if (destBuildingFlags.length > 0) {
          base.destination_building_access_flags = destBuildingFlags;
        }
      }
      if (
        serviceType === "local_move" ||
        serviceType === "long_distance" ||
        serviceType === "white_glove"
      ) {
        const extraPick = extraFromStops
          .map((s) => ({ address: s.address.trim() }))
          .filter((x) => x.address.length > 0);
        const extraDrop = extraToStops
          .map((s) => ({ address: s.address.trim() }))
          .filter((x) => x.address.length > 0);
        if (extraPick.length > 0) base.additional_pickup_addresses = extraPick;
        if (extraDrop.length > 0) base.additional_dropoff_addresses = extraDrop;
      }
      // Custom crating applies to all service types
      if (cratingRequired && cratingItems.length > 0) {
        base.crating_pieces = cratingItems;
      }
      if (serviceType === "office_move") {
        base.square_footage = Number(sqft) || undefined;
        base.workstation_count = Number(wsCount) || undefined;
        base.office_desks_count = officeDesks.trim()
          ? Number(officeDesks)
          : undefined;
        base.office_chairs_count = officeChairs.trim()
          ? Number(officeChairs)
          : undefined;
        base.office_filing_cabinets_count = officeFiling.trim()
          ? Number(officeFiling)
          : undefined;
        base.has_it_equipment = hasIt;
        base.office_server_room = hasIt || undefined;
        base.has_conference_room = hasConf;
        base.office_boardroom_count = hasConf
          ? officeBoardroomCount
          : undefined;
        base.office_kitchen_break_room = officeKitchen || undefined;
        base.has_reception_area = hasReception;
        base.timing_preference = timingPref || undefined;
        base.office_crew_size = officeCrewSize || undefined;
        base.office_estimated_hours = officeEstHours || undefined;
        base.office_truck_count =
          officeTruckCount >= 2 ? officeTruckCount : undefined;
        if (multiPickupInventoryMode && perPickupInventory.length > 0) {
          base.inventory_items = perPickupInventory.flatMap((items, idx) =>
            items.map((it) => inventoryItemToPayload(it, idx)),
          );
        } else if (inventoryItems.length > 0) {
          base.inventory_items = inventoryItems.map((i) =>
            inventoryItemToPayload(i),
          );
        }
      }
      if (serviceType === "single_item") {
        base.item_description = itemDescription.trim() || undefined;
        base.item_category = itemCategory;
        base.item_weight_class = itemWeight || undefined;
        base.assembly_needed = assembly;
        base.stair_carry = stairCarry;
        base.stair_flights = stairFlights;
        base.number_of_items = numItems;
        base.single_item_special_handling =
          singleItemSpecialHandling.trim() || undefined;
      }
      if (serviceType === "white_glove") {
        const items = whiteGloveItemRows
          .filter((r) => r.description.trim())
          .map((r) => ({
            description: r.description.trim(),
            quantity: r.quantity,
            category: r.category,
            weight_class: r.weight_class,
            assembly: r.assembly,
            is_fragile: r.is_fragile,
            is_high_value: r.is_high_value,
            notes: r.notes?.trim() || undefined,
            slug: r.slug?.trim() || undefined,
            is_custom: r.is_custom === true ? true : undefined,
          }));
        base.white_glove_items = items.length > 0 ? items : undefined;
        base.declared_value = Number(declaredValue) || undefined;
        if (wgDebrisRemoval) base.white_glove_debris_removal = true;
        if (
          wgGuaranteedWindow &&
          wgGuaranteedWindowHours != null &&
          Number(wgGuaranteedWindowHours) > 0
        ) {
          base.white_glove_guaranteed_window_hours = Number(
            wgGuaranteedWindowHours,
          );
        }
        if (wgBuildingReqs.length > 0) {
          base.specialty_building_requirements = wgBuildingReqs;
        }
        if (wgBuildingNote.trim()) {
          base.white_glove_building_requirements_note = wgBuildingNote.trim();
        }
        if (wgDeliveryInstructions.trim()) {
          base.white_glove_delivery_instructions =
            wgDeliveryInstructions.trim();
        }
        if (fromLat != null && Number.isFinite(fromLat)) base.from_lat = fromLat;
        if (fromLng != null && Number.isFinite(fromLng)) base.from_lng = fromLng;
        if (toLat != null && Number.isFinite(toLat)) base.to_lat = toLat;
        if (toLng != null && Number.isFinite(toLng)) base.to_lng = toLng;
      }
      if (serviceType === "specialty") {
        base.project_type = specialtyType || "other";
        base.item_description = specialtyItemDescription.trim() || undefined;
        base.item_weight_class = specialtyWeightClass || undefined;
        base.climate_control =
          specialtyRequirements.includes("climate_controlled");
        base.special_equipment = specialtyRequirements.includes("crane_rigging")
          ? ["crane_rigging"]
          : undefined;
        base.specialty_item_description =
          specialtyItemDescription.trim() || undefined;
        base.specialty_requirements =
          specialtyRequirements.length > 0 ? specialtyRequirements : undefined;
        base.specialty_notes = specialtyNotes.trim() || undefined;
        base.specialty_building_requirements =
          specialtyBuildingReqs.length > 0 ? specialtyBuildingReqs : undefined;
        base.specialty_access_difficulty =
          specialtyAccessDifficulty || undefined;
        const dims = [specialtyDimL, specialtyDimW, specialtyDimH].filter(
          Boolean,
        );
        base.specialty_dimensions =
          dims.length === 3
            ? `${specialtyDimL}×${specialtyDimW}×${specialtyDimH} in`
            : undefined;
      }
      if (serviceType === "event") {
        base.event_is_luxury = eventLuxury;
        base.event_truck_type =
          eventSameLocationSingle && !eventMulti ? "none" : eventTruckType;
        base.event_name = eventName.trim() || undefined;
        base.event_complex_setup_required = eventLuxury
          ? eventComplexSetup
          : undefined;
        base.event_setup_required = eventLuxury
          ? eventComplexSetup
          : eventSetupRequired;
        base.event_setup_hours = (
          eventLuxury ? eventComplexSetup : eventSetupRequired
        )
          ? eventSetupHours
          : undefined;
        base.event_setup_instructions =
          eventSetupInstructions.trim() || undefined;
        base.event_items = eventItems.length > 0 ? eventItems : undefined;
        base.event_additional_services =
          eventAdditionalServices.length > 0
            ? eventAdditionalServices
            : undefined;
        if (eventMulti && eventLegs.length >= 2) {
          base.event_mode = "multi";
          base.event_legs = eventLegs.map((leg) => ({
            label: leg.label.trim() || undefined,
            from_address: leg.from_address.trim(),
            to_address: leg.event_same_location_onsite
              ? leg.from_address.trim()
              : leg.to_address.trim(),
            from_access: leg.from_access || undefined,
            to_access: leg.to_access || undefined,
            move_date: leg.move_date,
            event_return_date: leg.event_same_day
              ? leg.move_date
              : leg.event_return_date,
            event_same_day: leg.event_same_day,
            event_same_location_onsite: leg.event_same_location_onsite,
            event_leg_truck_type: leg.event_same_location_onsite
              ? "none"
              : leg.event_leg_truck_type,
            event_return_rate_preset: leg.event_return_rate_preset,
            event_return_rate_custom:
              leg.event_return_rate_preset === "custom" &&
              leg.event_return_rate_custom.trim()
                ? Number(leg.event_return_rate_custom)
                : undefined,
          }));
          const first = eventLegs[0];
          base.from_address = first.from_address.trim();
          base.to_address = first.to_address.trim();
          base.from_access = first.from_access || undefined;
          base.to_access = first.to_access || undefined;
          base.move_date = first.move_date;
          base.event_return_date = first.event_same_day
            ? first.move_date
            : first.event_return_date;
          base.event_same_day = first.event_same_day;
          base.event_pickup_time_after = first.event_same_day
            ? eventPickupTimeAfter
            : undefined;
        } else {
          base.from_address = fromAddress;
          base.to_address = eventSameLocationSingle
            ? fromAddress
            : venueAddress || toAddress;
          base.event_return_date = eventSameDay
            ? moveDate
            : eventReturnDate || undefined;
          base.event_same_day = eventSameDay;
          base.event_pickup_time_after = eventSameDay
            ? eventPickupTimeAfter
            : undefined;
          base.event_same_location_onsite = eventSameLocationSingle;
          base.event_return_rate_preset = eventReturnRateSingle;
          base.event_return_rate_custom =
            eventReturnRateSingle === "custom" &&
            eventReturnRateCustomSingle.trim()
              ? Number(eventReturnRateCustomSingle)
              : undefined;
        }
      }
      if (serviceType === "labour_only") {
        base.labour_weekend = labourWeekend || undefined;
        base.labour_after_hours = labourAfterHours || undefined;
        // from_address = to_address = work address
        base.from_address = workAddress || fromAddress;
        base.to_address = workAddress || fromAddress;
        base.from_access = workAccess || fromAccess || undefined;
        base.labour_crew_size = labourCrewSize;
        base.labour_hours = labourHours;
        base.labour_truck_required = labourTruckRequired;
        base.labour_visits = labourVisits;
        base.labour_second_visit_date =
          labourVisits >= 2 ? labourSecondVisitDate : undefined;
        base.labour_description = labourDescription.trim() || undefined;
        base.labour_storage_needed = labourStorageNeeded;
        base.labour_storage_weeks = labourStorageNeeded
          ? labourStorageWeeks
          : undefined;
      }
      if (serviceType === "b2b_delivery") {
        base.b2b_business_name = b2bBusinessName.trim() || undefined;
        base.b2b_vertical_code = effectiveB2bVerticalCode || undefined;
        base.b2b_partner_organization_id = b2bPartnerOrgId.trim() || undefined;
        base.b2b_handling_type =
          b2bEmbedSnapshot?.handlingType?.trim().toLowerCase() ||
          b2bMasterHandlingType(effectiveB2bLines) ||
          undefined;
        base.b2b_line_items =
          effectiveB2bLines.length > 0
            ? effectiveB2bLines.map((l) => {
                const desc = l.description.trim();
                const vcode = selectedB2bVertical?.code ?? "";
                const bundled =
                  l.bundled ??
                  (vcode === "flooring"
                    ? isFlooringBundledAccessory(desc, vcode)
                    : false);
                const is_skid = l.is_skid ?? isSkidCatalogLabel(desc);
                return {
                  description: desc,
                  quantity: Math.max(1, l.qty),
                  weight_category: l.weight_category || undefined,
                  weight_lbs:
                    typeof l.weight_lbs === "number" &&
                    Number.isFinite(l.weight_lbs) &&
                    l.weight_lbs > 0
                      ? Math.round(l.weight_lbs)
                      : undefined,
                  actual_weight_lbs:
                    typeof l.actual_weight_lbs === "number" &&
                    Number.isFinite(l.actual_weight_lbs) &&
                    l.actual_weight_lbs > 0
                      ? Math.round(l.actual_weight_lbs)
                      : undefined,
                  fragile: l.fragile ? true : undefined,
                  handling_type: l.handling_type?.trim() || undefined,
                  bundled: bundled ? true : undefined,
                  assembly_required: l.assembly_required ? true : undefined,
                  debris_removal: l.debris_removal ? true : undefined,
                  haul_away: l.haul_away ? true : undefined,
                  is_skid: is_skid ? true : undefined,
                  unit_type: l.unit_type?.trim() || undefined,
                  serial_number: l.serial_number?.trim() || undefined,
                  stop_assignment: l.stop_assignment?.trim() || undefined,
                  declared_value: l.declared_value?.trim() || undefined,
                  crating_required: l.crating_required ? true : undefined,
                  hookup_required: l.hookup_required ? true : undefined,
                };
              })
            : undefined;
        base.b2b_items =
          effectiveB2bLines.length > 0
            ? effectiveB2bLines.map(
                (i) =>
                  `${i.description.trim()}${i.qty > 1 ? ` ×${i.qty}` : ""}`,
              )
            : undefined;
        if (!b2bShowLineWeights && b2bWeightCategory) {
          base.b2b_weight_category = b2bWeightCategory;
        }
        base.b2b_after_hours = b2bAfterHoursDerived || undefined;
        base.b2b_same_day = b2bAutoSameDay || undefined;
        const multiStops = b2bDimensionalStopsFromForm(
          fromAddress,
          toAddress,
          fromAccess,
          toAccess,
          extraFromStops,
          extraToStops,
        );
        if (multiStops.length > 2) {
          base.b2b_stops = multiStops.map((s) => ({
            address: s.address.trim(),
            type: s.type,
            access: s.access?.trim() || undefined,
            time_window: s.time_window?.trim() || undefined,
          }));
        }
        base.b2b_special_instructions =
          b2bSpecialInstructions.trim() || undefined;
        const artHangN = parseInt(String(b2bArtHangingCount).trim(), 10);
        if (Number.isFinite(artHangN) && artHangN > 0) {
          base.b2b_art_hanging_count = artHangN;
        }
        const cratePiecesN = parseInt(String(b2bCratingPieces).trim(), 10);
        if (Number.isFinite(cratePiecesN) && cratePiecesN > 0) {
          base.b2b_crating_pieces = cratePiecesN;
        }
        const fullOv = Number(
          String(b2bPreTaxOverrideAmount).trim().replace(/,/g, ""),
        );
        if (b2bPriceOverrideOn && Number.isFinite(fullOv) && fullOv > 0) {
          base.b2b_full_pre_tax_override = fullOv;
        }
        const ovReason = b2bOverrideReason.trim();
        if (
          ovReason.length >= 3 &&
          b2bPriceOverrideOn &&
          Number.isFinite(fullOv) &&
          fullOv > 0
        ) {
          base.b2b_subtotal_override_reason = ovReason;
        }
      }
      if (serviceType === "bin_rental") {
        base.bin_bundle_type = binBundleType;
        base.bin_custom_count =
          binBundleType === "custom" ? binCustomCount : undefined;
        base.bin_extra_bins = binExtraBins;
        base.bin_packing_paper = binPackingPaper;
        base.bin_material_delivery = binMaterialDelivery;
        base.bin_linked_move_id = binLinkedMoveId.trim() || null;
        base.bin_delivery_notes = binDeliveryNotes.trim() || undefined;
        base.internal_notes = binInternalNotes.trim() || undefined;
      }
      if (
        serviceType !== "bin_rental" &&
        serviceType !== "b2b_delivery" &&
        serviceType !== "b2b_oneoff"
      ) {
        const qo = parsePositivePreTaxOverride(quotePreTaxOverride);
        if (qo !== undefined) {
          base.quote_price_override = qo;
          base.quote_price_override_reason = quotePreTaxOverrideReason.trim();
        }
      }

      if (opts?.serviceAreaOverride || serviceAreaOverride)
        base.service_area_override = true;

      if (savedMoveProjectId && serviceType === "office_move") {
        base.clear_move_project = true;
      }

      if (serviceType === "local_move" || serviceType === "long_distance") {
        base.move_scope = {
          estimated_days_override: moveScopeDaysOverride ?? undefined,
          optional_additional_volume_day: moveScopeExtraVolumeDay
            ? true
            : undefined,
        };
      }

      if (widgetRequestIdParam) {
        base.quote_source = "widget";
        base.source_request_id = widgetRequestIdParam;
      }

      // Multi-scenario
      if (isMultiScenario && scenarios.length >= 2) {
        base.is_multi_scenario = true;
        base.scenarios = scenarios.map((s, i) => ({
          scenario_number: i + 1,
          label: s.label.trim() || `Option ${i + 1}`,
          description: s.description.trim() || undefined,
          is_recommended: s.is_recommended,
          scenario_date: s.scenario_date || undefined,
          scenario_time: s.scenario_time || undefined,
          price: s.price.trim() ? Number(s.price.trim()) : undefined,
          conditions_note: undefined,
        }));
      }

      return base;
    },
    [
      serviceType,
      fromAddress,
      toAddress,
      fromLat,
      fromLng,
      toLat,
      toLng,
      originBuildingFlags,
      destBuildingFlags,
      fromAccess,
      toAccess,
      moveDate,
      preferredTime,
      arrivalWindow,
      hubspotDealId,
      selectedAddons,
      recommendedTier,
      moveSize,
      clientBoxCount,
      serviceAreaOverride,
      specialtyItems,
      inventoryItems,
      multiPickupInventoryMode,
      perPickupInventory,
      sqft,
      wsCount,
      hasIt,
      hasConf,
      extraFromStops,
      extraToStops,
      hasReception,
      timingPref,
      officeDesks,
      officeChairs,
      officeFiling,
      officeBoardroomCount,
      officeKitchen,
      officeTruckCount,
      officeCrewSize,
      officeEstHours,
      quotePreTaxOverride,
      quotePreTaxOverrideReason,
      itemDescription,
      itemCategory,
      itemWeight,
      assembly,
      stairCarry,
      stairFlights,
      numItems,
      declaredValue,
      specialtyType,
      specialtyItemDescription,
      specialtyWeightClass,
      specialtyRequirements,
      specialtyNotes,
      specialtyDimL,
      specialtyDimW,
      specialtyDimH,
      firstName,
      lastName,
      email,
      phone,
      cratingRequired,
      cratingItems,
      fromParking,
      toParking,
      fromLongCarry,
      toLongCarry,
      eventName,
      venueAddress,
      eventReturnDate,
      eventSetupRequired,
      eventSetupHours,
      eventSetupInstructions,
      eventLuxury,
      eventComplexSetup,
      eventTruckType,
      eventSameDay,
      eventPickupTimeAfter,
      eventItems,
      eventAdditionalServices,
      eventMulti,
      eventLegs,
      eventSameLocationSingle,
      eventReturnRateSingle,
      eventReturnRateCustomSingle,
      eventCrewOverride,
      eventHoursOverride,
      eventPreTaxOverride,
      eventOverrideReason,
      workAddress,
      workAccess,
      labourDescription,
      labourCrewSize,
      labourHours,
      labourTruckRequired,
      labourVisits,
      labourSecondVisitDate,
      labourStorageNeeded,
      labourStorageWeeks,
      labourContext,
      labourWeekend,
      labourAfterHours,
      b2bBusinessName,
      effectiveB2bVerticalCode,
      b2bPartnerOrgId,
      b2bLines,
      effectiveB2bLines,
      selectedB2bVertical,
      b2bShowLineWeights,
      b2bWeightCategory,
      b2bSpecialInstructions,
      b2bArtHangingCount,
      b2bCratingPieces,
      b2bAfterHoursDerived,
      b2bAutoSameDay,
      b2bPriceOverrideOn,
      b2bPreTaxOverrideAmount,
      b2bOverrideReason,
      b2bEmbedSnapshot,
      singleItemSpecialHandling,
      specialtyBuildingReqs,
      specialtyAccessDifficulty,
      binBundleType,
      binCustomCount,
      binExtraBins,
      binPackingPaper,
      binMaterialDelivery,
      binLinkedMoveId,
      binDeliveryNotes,
      binInternalNotes,
      moveScopeDaysOverride,
      moveScopeExtraVolumeDay,
      savedMoveProjectId,
      widgetRequestIdParam,
      whiteGloveItemRows,
      wgDebrisRemoval,
      wgGuaranteedWindow,
      wgGuaranteedWindowHours,
      wgBuildingReqs,
      wgBuildingNote,
      wgDeliveryInstructions,
      isMultiScenario,
      scenarios,
    ],
  );

  // ── Generate quote (Step 1: creates quote in DB, returns quote_id) ────────────────────────
  const handleGenerate = async (opts?: { serviceAreaOverride?: boolean }) => {
    if (serviceType === "b2b_delivery" || serviceType === "b2b_oneoff") {
      toast(
        "Build and generate B2B quotes from B2B Jobs under Deliveries.",
        "info",
      );
      return;
    }
    if (serviceType === "event") {
      if (eventMulti) {
        if (eventLegs.length < 2) {
          toast("Multi-event needs at least 2 events", "alertTriangle");
          return;
        }
        for (let i = 0; i < eventLegs.length; i++) {
          const leg = eventLegs[i];
          const toOk = leg.event_same_location_onsite
            ? leg.from_address?.trim()
            : leg.to_address?.trim();
          if (!leg.from_address?.trim() || !toOk || !leg.move_date) {
            toast(
              `Event ${i + 1}: fill origin, venue, and delivery date`,
              "alertTriangle",
            );
            return;
          }
          if (!leg.event_same_day && !leg.event_return_date?.trim()) {
            toast(
              `Event ${i + 1}: return date or same-day required`,
              "alertTriangle",
            );
            return;
          }
        }
      } else {
        if (
          !fromAddress ||
          (!eventSameLocationSingle && !venueAddress) ||
          !moveDate
        ) {
          toast(
            "Please fill Origin, Venue address and Delivery date",
            "alertTriangle",
          );
          return;
        }
        if (!eventSameDay && !eventReturnDate) {
          toast("Please fill Return date (or check Same Day)", "alertTriangle");
          return;
        }
      }
      const preOvCheck = eventPreTaxOverride.trim()
        ? Number(eventPreTaxOverride)
        : NaN;
      if (
        Number.isFinite(preOvCheck) &&
        preOvCheck > 0 &&
        eventOverrideReason.trim().length < 3
      ) {
        toast(
          "Event price override requires a reason (at least 3 characters).",
          "alertTriangle",
        );
        return;
      }
    } else if (serviceType === "labour_only") {
      if (!workAddress || !moveDate) {
        toast(
          `Please fill work address and ${quoteDetailDateLabel(serviceType).toLowerCase()}`,
          "alertTriangle",
        );
        return;
      }
    } else if (serviceType === "bin_rental") {
      const clientName = [firstName, lastName].filter(Boolean).join(" ");
      if (!toAddress.trim() || !moveDate) {
        toast(
          `Please fill delivery address and ${quoteDetailDateLabel(serviceType).toLowerCase()}`,
          "alertTriangle",
        );
        return;
      }
      if (!binPickupSameAsDelivery && !fromAddress.trim()) {
        toast(
          "Enter a pickup address or check same as delivery",
          "alertTriangle",
        );
        return;
      }
      if (!clientName.trim() || !email?.trim() || !phone?.trim()) {
        toast("Please fill contact name, email, and phone", "alertTriangle");
        return;
      }
      if (binBundleType === "custom" && binCustomCount < 5) {
        toast("Custom orders need at least 5 bins", "alertTriangle");
        return;
      }
    } else if (!fromAddress || !toAddress || !moveDate) {
      toast(
        `Please fill addresses and ${quoteDetailDateLabel(serviceType).toLowerCase()}`,
        "alertTriangle",
      );
      return;
    }
    if (serviceType === "white_glove") {
      const hasItem = whiteGloveItemRows.some((r) => r.description.trim());
      if (!hasItem) {
        toast(
          "Add at least one delivery item with a description.",
          "alertTriangle",
        );
        return;
      }
    }
    if (
      (serviceType === "local_move" || serviceType === "long_distance") &&
      !moveSize.trim()
    ) {
      toast(
        "Select a move size or add inventory to auto-detect.",
        "alertTriangle",
      );
      return;
    }
    const qOv = parsePositivePreTaxOverride(quotePreTaxOverride);
    if (qOv !== undefined && quotePreTaxOverrideReason.trim().length < 3) {
      toast(
        "Price override requires a reason (at least 3 characters).",
        "alertTriangle",
      );
      return;
    }
    setGenerating(true);
    setSendSuccess(false);
    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(opts)),
      });
      const data = await res.json();
      if (data.quote_blocked) {
        setServiceAreaBlock(data);
        toast(
          data.message || "Outside Yugo service area — quote not generated.",
          "alertTriangle",
        );
        return;
      }
      setServiceAreaBlock(null);
      if (opts?.serviceAreaOverride) setServiceAreaOverride(true);
      if (!res.ok) throw new Error(data.error || "Quote generation failed");
      const id = data.quote_id ?? data.quoteId;
      if (!id) throw new Error("Generate did not return a quote_id");
      setQuoteResult(data);
      setQuoteId(id);
      setSavedMoveProjectId(
        typeof data.move_project_id === "string" ? data.move_project_id : null,
      );
      quoteClearDraft();
      toast(`Quote ${id} generated`, "check");

      // Persist additional stops if any were added
      const extraPickups = extraFromStops
        .filter((s) => s.address.trim())
        .map((s, i) => ({
          ...s,
          stop_type: "pickup" as const,
          sort_order: i + 1,
        }));
      const extraDropoffsBase = extraToStops
        .filter((s) => s.address.trim())
        .map((s, i) => ({
          ...s,
          stop_type: "dropoff" as const,
          sort_order: i + 1,
        }));
      const extraVenueDropoffs =
        serviceType === "event" && !eventMulti
          ? extraVenueStops
              .filter((s) => s.address.trim())
              .map((s, i) => ({
                ...s,
                stop_type: "dropoff" as const,
                sort_order: i + 1,
              }))
          : [];
      const extraLabourDropoffs =
        serviceType === "labour_only"
          ? extraWorkStops
              .filter((s) => s.address.trim())
              .map((s, i) => ({
                ...s,
                stop_type: "dropoff" as const,
                sort_order: i + 1,
              }))
          : [];
      const allExtraStops = [
        ...extraPickups,
        ...extraDropoffsBase,
        ...extraVenueDropoffs,
        ...extraLabourDropoffs,
      ];
      if (allExtraStops.length > 0) {
        fetch("/api/admin/job-stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_type: "quote",
            job_id: id,
            stops: allExtraStops,
          }),
        }).catch(() => {});
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setGenerating(false);
    }
  };

  // ── Send quote (Step 2: only after generate; requires quoteId from state) ────────────────────────────
  const handleSend = async () => {
    if (!quoteId) {
      toast("Generate a quote first", "alertTriangle");
      return;
    }
    if (!email) {
      toast("Client email is required to send", "alertTriangle");
      return;
    }
    // Guard: if Essential tier is above the market ceiling rate, require explicit confirmation
    // before sending. Catches coordinator errors where a small move was priced too high.
    const essentialVal = quoteResult?.labour_validation_by_tier?.["essential"];
    if (essentialVal?.status === "above_ceiling") {
      const confirmed = window.confirm(
        `Essential tier is above the market ceiling rate (${essentialVal.effectiveRate?.toFixed(0) ?? "??"}/hr vs ceiling ${essentialVal.ceiling ?? "??"}/hr).\n\nAre you sure you want to send this quote?`,
      );
      if (!confirmed) return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          quote_id: quoteId,
          email,
          client_phone: phone?.trim() ? normalizePhone(phone) : undefined,
          client_name: [firstName, lastName].filter(Boolean).join(" "),
          hubspot_deal_id: hubspotDealId || undefined,
          lead_id: leadIdParam || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      if (data.hubspotDuplicate) {
        setHubspotDuplicateBanner({
          dealId: data.hubspotDuplicate.dealId,
          dealName: data.hubspotDuplicate.dealName,
          dealStageId: data.hubspotDuplicate.dealStageId,
        });
        toast(
          "Quote sent. HubSpot already has an open deal for this contact. Link it or create a new deal below.",
          "alertTriangle",
        );
      } else {
        setHubspotDuplicateBanner(null);
      }

      if (data.hubspotAutoCreateFailed) {
        toast(
          "Quote sent, but HubSpot did not create a deal automatically. Check App Settings for HubSpot pipeline and stage IDs, the access token, and server logs.",
          "alertTriangle",
        );
      }

      // Push quote data back to HubSpot deal (price + deal fields for left column)
      if (hubspotDealId && quoteResult) {
        const essentialTier =
          quoteResult.tiers?.essential ??
          quoteResult.tiers?.curated ??
          quoteResult.tiers?.essentials;
        const price =
          essentialTier?.price ?? quoteResult.custom_price?.price ?? null;
        const tax = essentialTier?.tax ?? quoteResult.custom_price?.tax ?? null;
        const total =
          essentialTier?.total ?? quoteResult.custom_price?.total ?? null;

        const dealProps: Record<string, unknown> = {
          amount: price,
          total_price: total,
          taxes: tax,
          quote_url: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/quote/${quoteId}`,
          dealstage: "quote_sent",
        };
        const idPrefix = (config.quote_id_prefix || "YG-").trim() || "YG-";
        const jobNoHs = quoteNumericSuffixForHubSpot(quoteId, idPrefix);
        if (jobNoHs) dealProps.job_no = jobNoHs;
        if (firstName?.trim()) dealProps.firstname = firstName.trim();
        if (lastName?.trim()) dealProps.lastname = lastName.trim();
        if (fromAddress?.trim()) dealProps.pick_up_address = fromAddress.trim();
        if (toAddress?.trim()) dealProps.drop_off_address = toAddress.trim();
        if (fromAccess?.trim()) dealProps.access_from = fromAccess.trim();
        if (toAccess?.trim()) dealProps.access_to = toAccess.trim();
        if (serviceType?.trim()) dealProps.service_type = serviceType.trim();
        if (moveSize?.trim()) dealProps.move_size = moveSize.trim();
        if (moveDate?.trim()) dealProps.move_date = moveDate.trim();

        fetch("/api/hubspot/update-deal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: hubspotDealId,
            properties: dealProps,
          }),
        }).catch(() => {});
      }

      setSendSuccess(true);
      toast(`Quote ${quoteId} sent to ${email}`, "mail");
      setDissolving(true);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to send", "x");
    } finally {
      setSending(false);
    }
  };

  const handleHubspotDuplicateLink = async () => {
    if (!quoteId || !hubspotDuplicateBanner) return;
    setHubspotDuplicateBusy(true);
    try {
      const res = await fetch(
        `/api/admin/quotes/${encodeURIComponent(quoteId)}/hubspot-duplicate-resolution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "link" }),
        },
      );
      const j = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(j.message || "Could not link deal");
      setHubspotDuplicateBanner(null);
      toast("Linked this quote to the existing HubSpot deal.", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setHubspotDuplicateBusy(false);
    }
  };

  const handleHubspotDuplicateCreateNew = async () => {
    if (!quoteId) return;
    setHubspotDuplicateBusy(true);
    try {
      const res = await fetch(
        `/api/admin/quotes/${encodeURIComponent(quoteId)}/hubspot-duplicate-resolution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_new" }),
        },
      );
      const j = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(j.message || "Could not create deal");
      setHubspotDuplicateBanner(null);
      toast("Created a new HubSpot deal for this quote.", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setHubspotDuplicateBusy(false);
    }
  };

  const isB2bEmbed = serviceType === "b2b_delivery" || serviceType === "b2b_oneoff";
  const skipsCatalogAddonsQuoteStep =
    SKIP_CATALOG_ADDONS_QUOTE_STEP.has(serviceType);

  useEffect(() => {
    setQuoteFlowStep(0);
  }, [serviceType]);

  useEffect(() => {
    if (!skipsCatalogAddonsQuoteStep) return;
    setQuoteFlowStep((s) => (s > 2 ? 2 : s));
  }, [skipsCatalogAddonsQuoteStep]);

  useEffect(() => {
    quoteFlowContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [quoteFlowStep]);

  const handleQuoteFlowBack = () => {
    setQuoteFlowStep((s) => Math.max(0, s - 1));
  };

  const handleQuoteFlowContinue = () => {
    if (isB2bEmbed) {
      if (quoteFlowStep >= 1) return;
      setQuoteFlowStep(1);
      return;
    }
    if (quoteFlowStep === 0) {
      setQuoteFlowStep(1);
      return;
    }
    if (quoteFlowStep === 1) {
      if (!firstName.trim() && !lastName.trim()) {
        toast("Enter at least a first or last name", "x");
        return;
      }
      setQuoteFlowStep(2);
      return;
    }
    if (quoteFlowStep === 2) {
      if (skipsCatalogAddonsQuoteStep) return;
      setQuoteFlowStep(3);
    }
  };

  const showQuoteFlowNav =
    (isB2bEmbed && quoteFlowStep < 1) ||
    (!isB2bEmbed &&
      quoteFlowStep < (skipsCatalogAddonsQuoteStep ? 2 : 3));
  const showQuoteGenerateActions =
    (isB2bEmbed && quoteFlowStep >= 1) ||
    (!isB2bEmbed &&
      quoteFlowStep >= (skipsCatalogAddonsQuoteStep ? 2 : 3));

  const quoteFlowNavLabels = isB2bEmbed
    ? (["Service type", "B2B job"] as const)
    : skipsCatalogAddonsQuoteStep
      ? (["Service type", "Client", "Job details & generate"] as const)
      : (["Service type", "Client", "Job details", "Add-ons & generate"] as const);

  // ── Render ────────────────────────────────
  return (
    <QuoteFormV2Context.Provider value={isV2}>
    <div
      className={`transition-opacity duration-700 ease-out${isV2 ? " quote-form-v2-scope" : ""}`}
      style={{ opacity: dissolving ? 0 : 1 }}
    >
      <div className="mb-4">
        <BackButton
          label="Back"
          variant={isV2 ? "v2" : "v1"}
          fallback={backFallback}
        />
      </div>

      {quoteHasDraft && (
        <div className="mb-2">
          <DraftBanner
            onRestore={handleRestoreQuoteDraft}
            onDismiss={quoteDismissDraft}
            variant={isV2 ? "v2" : "v1"}
          />
        </div>
      )}

      {hubspotBanner && (
        <div
          className={
            isV2
              ? "mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-4 py-2.5 text-[12px] font-medium text-fg"
              : "mb-4 px-4 py-2.5 rounded-lg bg-[rgba(250,247,242,0.08)] border border-[rgba(250,247,242,0.22)] text-[12px] font-medium text-[#EDE6DC] flex items-center gap-2"
          }
        >
          <Check className="w-4 h-4 shrink-0" />
          {hubspotBanner}
        </div>
      )}

      {hubspotDuplicateBanner && (
        <div
          className={
            isV2
              ? "mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[12px] text-fg"
              : "mb-4 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-[12px] text-[#EDE6DC]"
          }
          role="status"
        >
          <p className="font-semibold text-amber-200">Existing open deal in HubSpot</p>
          <p className="mt-1 text-[11px] leading-snug text-amber-100/90">
            {hubspotDuplicateBanner.dealName || "Unnamed deal"}{" "}
            <span className="text-amber-200/80">(stage id: {hubspotDuplicateBanner.dealStageId})</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={hubspotDuplicateBusy}
              onClick={handleHubspotDuplicateLink}
              className={
                isV2
                  ? "rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
                  : "rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
              }
            >
              Link to this deal
            </button>
            <button
              type="button"
              disabled={hubspotDuplicateBusy}
              onClick={handleHubspotDuplicateCreateNew}
              className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-100 disabled:opacity-40"
            >
              Create new deal
            </button>
          </div>
        </div>
      )}

      {leadInventoryReview.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-500/20 flex items-center gap-2 bg-amber-500/10">
            <ListChecks
              className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0"
              aria-hidden
            />
            <p className="text-[11px] font-semibold text-[var(--tx)]">
              Review parsed inventory
            </p>
            <span className="text-[10px] text-[var(--tx3)]">
              Accept the suggested line items or skip if wrong.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-[var(--brd)] text-[var(--tx3)] uppercase tracking-wide">
                  <th className="px-4 py-2 font-semibold">Client wrote</th>
                  <th className="px-4 py-2 font-semibold">Suggested match</th>
                  <th className="px-4 py-2 font-semibold">Confidence</th>
                  <th className="px-4 py-2 font-semibold w-[1%] whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {leadInventoryReview.map((row, idx) => (
                  <tr
                    key={`${row.raw_text}-${idx}`}
                    className="border-b border-[var(--brd)]/60 align-top"
                  >
                    <td className="px-4 py-2.5 text-[var(--tx)]">
                      <span className="font-medium">{row.raw_text || "—"}</span>
                      {row.note ? (
                        <p className="text-[10px] text-[var(--tx3)] mt-1">
                          {row.note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--tx)]">
                      {row.matched_name || row.matched_item ? (
                        <>
                          {row.matched_name || row.matched_item}
                          <span className="text-[var(--tx3)]">
                            {" "}
                            ×{row.quantity}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--tx3)]">No match</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 uppercase text-[var(--tx3)]">
                      {row.confidence || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button
                          type="button"
                          disabled={!row.matched_item}
                          onClick={() => acceptLeadReviewRow(idx)}
                          className="px-2 py-1 rounded-md bg-[var(--gold)]/20 text-[var(--tx)] font-medium border border-[var(--gold)]/40 hover:bg-[var(--gold)]/30 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissLeadReviewRow(idx)}
                          className="px-2 py-1 rounded-md border border-[var(--brd)] text-[var(--tx3)] hover:bg-[var(--bg)]"
                        >
                          Skip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side-by-side from 480px so preview is on the right even with sidebar (no dependency on hubspot_deal_id at paint) */}
      <div className="flex flex-col min-[480px]:flex-row gap-5 relative">
        {/* ═══ LEFT PANEL, Form ═══ */}
        <div
          className={`flex flex-col transition-all duration-300 w-full max-w-none min-w-0 ${previewOpen ? "min-[480px]:w-[60%]" : "min-[480px]:w-full"}`}
        >
          <div
            className="mb-6 pb-6"
          >
            <p
              className={
                isV2
                  ? "mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-subtle"
                  : "text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx2)] mb-1.5"
              }
            >
              Sales
            </p>
            <h1
              className={isV2 ? "text-fg" : "admin-page-hero text-[var(--tx)]"}
            >
              Generate Quote
            </h1>
            <p
              className={
                isV2
                  ? "body-sm text-fg-muted mt-1.5 max-w-2xl leading-relaxed"
                  : "text-[11px] text-[var(--tx2)] mt-1.5 max-w-2xl leading-relaxed"
              }
            >
              Move through each step in order. The live preview updates as you type.
            </p>
            {(leadQuoteBanner ||
              widgetQuoteBanner ||
              leadIntelSummary) && (
              <div
                className={
                  isV2
                    ? "mt-4 space-y-2.5 rounded-lg border border-line/50 bg-surface-subtle/50 px-3 py-2.5"
                    : "mt-4 space-y-2.5 rounded-lg border border-[var(--brd)]/70 bg-[var(--bg)]/50 px-3 py-2.5"
                }
                role="region"
                aria-label="Context for this quote"
              >
                {leadQuoteBanner ? (
                  <div
                    className={
                      isV2
                        ? "flex items-start gap-2 text-[12px] font-medium text-fg"
                        : "flex items-start gap-2 text-[12px] font-medium text-[var(--tx)]"
                    }
                  >
                    <Users
                      className={
                        isV2
                          ? "mt-0.5 h-4 w-4 shrink-0 text-accent"
                          : "mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]"
                      }
                      aria-hidden
                    />
                    <span>{leadQuoteBanner}</span>
                  </div>
                ) : null}
                {widgetQuoteBanner ? (
                  <div
                    className={
                      isV2
                        ? "flex flex-wrap items-start gap-x-2 gap-y-1 text-[12px] font-medium text-fg"
                        : "flex flex-wrap items-start gap-x-2 gap-y-1 text-[12px] font-medium text-[var(--tx)]"
                    }
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{widgetQuoteBanner}</span>
                    <span
                      className={
                        isV2
                          ? "w-full text-[11px] font-normal text-fg-muted sm:w-auto"
                          : "w-full text-[11px] font-normal text-[var(--tx3)] sm:w-auto"
                      }
                    >
                      Review details before generating the quote.
                    </span>
                  </div>
                ) : null}
                {leadIntelSummary ? (
                  <div
                    className={
                      isV2
                        ? "flex gap-2 text-[12px] text-fg"
                        : "flex gap-2 text-[12px] text-[var(--tx)]"
                    }
                  >
                    <Lightbulb
                      className={
                        isV2
                          ? "mt-0.5 h-4 w-4 shrink-0 text-accent"
                          : "mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]"
                      }
                      weight="fill"
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p
                        className={
                          isV2
                            ? "text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle"
                            : "text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]"
                        }
                      >
                        Lead intelligence
                      </p>
                      <p className="leading-snug">{leadIntelSummary}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <nav className="mt-5 w-full" aria-label="Quote form steps">
              <div className="flex w-full min-w-0 items-start gap-0">
                {quoteFlowNavLabels.map((label, i) => {
                  const done = i < quoteFlowStep;
                  const active = i === quoteFlowStep;
                  const canJumpBack = i < quoteFlowStep;
                  const segmentFilled = quoteFlowStep > i;
                  const stepCircleV2 = active
                    ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-wine)] ring-2 ring-[var(--yu3-wine)]/30 ring-offset-2 ring-offset-[var(--color-canvas)]"
                    : done
                      ? "border border-line bg-surface text-[var(--yu3-wine)]"
                      : "border border-line bg-surface text-fg-muted"
                  const stepCircleV1 = active
                    ? "bg-[#FAF7F2] text-[#3D1624] shadow-md shadow-black/20 ring-2 ring-[rgba(250,247,242,0.45)] ring-offset-2 ring-offset-[var(--bg)]"
                    : done
                      ? "bg-[#FAF7F2] text-[#3D1624]"
                      : "border border-[var(--brd)] bg-[var(--card)] text-[var(--tx2)]"
                  const connectorTrack = isV2
                    ? "bg-line/60"
                    : "bg-[var(--brd)]/65"
                  const connectorFill = isV2
                    ? "bg-gradient-to-r from-[var(--yu3-wine)]/50 via-[var(--yu3-wine)]/30 to-[var(--yu3-wine)]/15"
                    : "bg-gradient-to-r from-[#FAF7F2] via-[#EDE4DA] to-[#D8CDC1] shadow-[0_0_12px_rgba(250,247,242,0.12)]"
                  const textTone = isV2
                    ? active
                      ? "text-fg"
                      : done
                        ? "text-fg-muted"
                        : "text-fg-subtle/90"
                    : active
                      ? "text-[var(--tx)]"
                      : done
                        ? "text-[var(--tx2)]"
                        : "text-[var(--tx2)]/85"
                  const textHoverV2 = canJumpBack ? "hover:text-fg" : ""
                  const textHoverV1 = canJumpBack ? "hover:text-[var(--tx)]" : ""
                  const stepNavCursor = canJumpBack
                    ? `cursor-pointer ${isV2 ? textHoverV2 : textHoverV1}`
                    : !active
                      ? "cursor-default"
                      : ""
                  return (
                    <React.Fragment key={label}>
                      <button
                        type="button"
                        onClick={() => {
                          if (canJumpBack) setQuoteFlowStep(i);
                        }}
                        disabled={!canJumpBack && !active}
                        aria-current={active ? "step" : undefined}
                        className={`flex min-w-0 flex-1 flex-col items-center gap-2 px-0.5 text-center transition-colors duration-300 ${textTone} ${stepNavCursor}`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
                            isV2 ? stepCircleV2 : stepCircleV1
                          }`}
                        >
                          {done ? (
                            <Check className="w-3.5 h-3.5" weight="bold" aria-hidden />
                          ) : (
                            <span aria-hidden>{i + 1}</span>
                          )}
                        </span>
                        <span className="text-[9px] min-[480px]:text-[10px] font-bold uppercase tracking-[0.12em] leading-snug max-w-[100%]">
                          {label}
                        </span>
                      </button>
                      {i < quoteFlowNavLabels.length - 1 ? (
                        <div
                          className={`pointer-events-none mt-[13px] h-[3px] w-2 min-[380px]:w-4 sm:flex-1 sm:max-w-[6rem] shrink-0 self-start overflow-hidden rounded-full ${connectorTrack}`}
                          aria-hidden
                        >
                          <div
                            className={`h-full w-full origin-left rounded-full transition-transform duration-700 ease-out [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${connectorFill}`}
                            style={{
                              transform: segmentFilled ? "scaleX(1)" : "scaleX(0)",
                            }}
                          />
                        </div>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </div>
            </nav>
          </div>

          <div
            className={
              isV2
                ? "flex min-w-0 flex-col overflow-hidden rounded-[var(--yu3-r-xl)] border border-line bg-surface shadow-sm"
                : "flex min-w-0 flex-col"
            }
          >
          <div ref={quoteFlowContentRef} className="min-w-0">
            <div className="p-5 space-y-0">
              {/* ── 1. Service type ── */}
              {quoteFlowStep === 0 && (
                <div className="pb-1 sm:pb-2">
                  <label className="block text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">
                    Service Type
                  </label>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {SERVICE_TYPES.map((card) => {
                      const sel = serviceType === card.value;
                      return (
                        <button
                          key={card.value}
                          type="button"
                          onClick={() => {
                            setServiceType(card.value);
                            if (card.value === "specialty") {
                              setSpecialtyBuilderOpen(true);
                            }
                          }}
                          className={`relative min-w-[min(100%,9.5rem)] flex-1 sm:max-w-[calc(50%-0.25rem)] lg:max-w-[calc(25%-0.375rem)] text-left px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                            sel
                              ? "bg-gradient-to-br from-[#2C3E2D] to-[#5C1A33] border-[#2C3E2D] shadow-md shadow-[#2C3E2D]/15"
                              : "bg-[var(--card)] border-[var(--brd)] hover:border-[#2C3E2D]/40 hover:bg-[var(--bg)]"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div
                              className={`text-[11px] leading-tight tracking-tight font-semibold ${sel ? "text-white" : "text-[var(--tx)]"}`}
                            >
                              {card.label}
                            </div>
                            <div
                              className={`text-[9px] leading-snug ${sel ? "text-white/80" : "text-[var(--tx3)]"}`}
                            >
                              {card.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isB2bEmbed && quoteFlowStep === 1 && (
              <>
              <div className="mt-10 pt-2 sm:mt-14" aria-hidden />

              {/* ── 2. Client ── */}
              <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Client
                  </h3>
                  <Field label="Select to auto fill">
                    <div ref={contactDropdownRef} className="relative">
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          setShowContactDropdown(true);
                        }}
                        onFocus={() => setShowContactDropdown(true)}
                        placeholder="Search by name, email, or phone…"
                        className={fieldInput}
                      />
                      {showContactDropdown && dbContacts.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
                          <div className="px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] bg-[var(--bg)]">
                            Contacts
                          </div>
                          {dbContacts.map((c) => (
                            <button
                              key={c.hubspot_id}
                              type="button"
                              onClick={() => {
                                const parts = (c.name || "")
                                  .trim()
                                  .split(/\s+/);
                                setFirstName(parts[0] || "");
                                setLastName(parts.slice(1).join(" ") || "");
                                setEmail(c.email || "");
                                setPhone(c.phone ? formatPhone(c.phone) : "");
                                if (c.address) setFromAddress(c.address);
                                const biz = (c.company || "").trim();
                                if (
                                  biz &&
                                  (serviceType === "b2b_delivery" ||
                                    serviceType === "b2b_oneoff")
                                ) {
                                  setB2bBusinessName(biz);
                                }
                                setContactSearch("");
                                setShowContactDropdown(false);
                                setDbContacts([]);
                              }}
                              className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                            >
                              {c.name}
                              {c.email && (
                                <span className="text-[var(--tx3)] ml-1">
                                  - {c.email}
                                </span>
                              )}
                              {c.phone && (
                                <span className="text-[var(--tx3)] ml-1">
                                  - {formatPhone(c.phone)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {showContactDropdown &&
                        contactSearch.length >= 2 &&
                        dbContacts.length === 0 && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 px-3 py-2 text-[11px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
                            No matches
                          </div>
                        )}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      id={
                        serviceType === "b2b_delivery"
                          ? "b2b-err-contact"
                          : undefined
                      }
                      className={`col-span-2 grid grid-cols-2 gap-2 ${serviceType === "b2b_delivery" && b2bSubmitErrors.contact ? "rounded-lg border-2 border-red-500/45 p-2 -m-0.5" : ""}`}
                    >
                      <Field label="First Name">
                        <input
                          value={firstName}
                          onChange={(e) => {
                            setFirstName(e.target.value);
                            setClientDedupResult(null);
                            setClientBannerDismissed(false);
                          }}
                          onBlur={handleClientDedupBlur}
                          placeholder="First name"
                          className={fieldInput}
                        />
                      </Field>
                      <Field label="Last Name">
                        <input
                          value={lastName}
                          onChange={(e) => {
                            setLastName(e.target.value);
                            setClientDedupResult(null);
                            setClientBannerDismissed(false);
                          }}
                          onBlur={handleClientDedupBlur}
                          placeholder="Last name"
                          className={fieldInput}
                        />
                      </Field>
                      {serviceType === "b2b_delivery" &&
                      b2bSubmitErrors.contact ? (
                        <p className="text-[10px] text-red-600 dark:text-red-400 col-span-2">
                          {b2bSubmitErrors.contact}
                        </p>
                      ) : null}
                    </div>
                    <Field label="Email">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setClientDedupResult(null);
                          setClientBannerDismissed(false);
                        }}
                        onBlur={handleClientDedupBlur}
                        placeholder="client@email.com"
                        className={fieldInput}
                      />
                    </Field>
                    <div
                      id={
                        serviceType === "b2b_delivery"
                          ? "b2b-err-phone"
                          : undefined
                      }
                      className={
                        serviceType === "b2b_delivery" && b2bSubmitErrors.phone
                          ? "rounded-lg border-2 border-red-500/45 p-2 -m-0.5"
                          : ""
                      }
                    >
                      <Field label="Phone">
                        <input
                          ref={phoneInput.ref}
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            phoneInput.onChange(e);
                            setClientDedupResult(null);
                            setClientBannerDismissed(false);
                          }}
                          onBlur={handleClientDedupBlur}
                          placeholder={PHONE_PLACEHOLDER}
                          className={fieldInput}
                        />
                      </Field>
                      {serviceType === "b2b_delivery" &&
                      b2bSubmitErrors.phone ? (
                        <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">
                          {b2bSubmitErrors.phone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {clientSearching && (
                    <p className="text-[10px] text-[var(--tx3)]">
                      Checking HubSpot, Square, and OPS+ for existing contacts…
                    </p>
                  )}

                  {/* ── Client dedup banner ── */}
                  {!clientBannerDismissed &&
                    clientDedupResult &&
                    (clientDedupResult.opsClient ? (
                      /* Returning client — show history and offer auto-fill */
                      <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MagnifyingGlass
                            size={16}
                            className="text-[var(--gold)] shrink-0"
                            weight="duotone"
                            aria-hidden
                          />
                          <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--gold)]">
                            Returning Client
                          </p>
                        </div>
                        <p className="text-[12px] text-[var(--tx2)] mb-0.5">
                          <strong>{clientDedupResult.opsClient.name}</strong>{" "}
                          has moved with Yugo before (matching email or phone).
                        </p>
                        {clientDedupResult.opsPrevMove && (
                          <p className="text-[11px] text-[var(--tx3)] mb-2">
                            Previous move:{" "}
                            {clientDedupResult.opsPrevMove.move_number}
                            {clientDedupResult.opsPrevMove.move_date &&
                              `, ${clientDedupResult.opsPrevMove.move_date}`}
                            {clientDedupResult.opsPrevMove.from_address &&
                              `, ${clientDedupResult.opsPrevMove.from_address}`}
                            {clientDedupResult.opsPrevMove.to_address &&
                              ` → ${clientDedupResult.opsPrevMove.to_address}`}
                          </p>
                        )}
                        {clientDedupResult.square?.card_on_file && (
                          <p className="text-[11px] text-[var(--tx3)] mb-2">
                            Card on file: {clientDedupResult.square.card_brand}{" "}
                            ****{clientDedupResult.square.card_last_four}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleClientAutoFill}
                            className="admin-btn admin-btn-sm admin-btn-primary"
                          >
                            Auto-fill
                          </button>
                          <button
                            type="button"
                            onClick={() => setClientBannerDismissed(true)}
                            className="admin-btn admin-btn-sm admin-btn-secondary"
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* External contact found (HubSpot/Square) */
                      <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MagnifyingGlass
                            size={16}
                            className="text-[var(--gold)] shrink-0"
                            weight="duotone"
                            aria-hidden
                          />
                          <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--gold)]">
                            Existing Contact Found
                          </p>
                        </div>
                        {clientDedupResult.hubspot && (
                          <p className="text-[12px] text-[var(--tx2)] mb-0.5">
                            <span className="font-semibold">HubSpot:</span>{" "}
                            {[
                              clientDedupResult.hubspot.first_name,
                              clientDedupResult.hubspot.last_name,
                            ]
                              .filter(Boolean)
                              .join(" ") || clientDedupResult.hubspot.email}
                            {clientDedupResult.hubspot.company && (
                              <span className="text-[var(--tx3)]">
                                , {clientDedupResult.hubspot.company}
                              </span>
                            )}
                            {clientDedupResult.hubspot.deal_ids.length > 0 && (
                              <span className="text-[var(--tx3)]">
                                {" "}
                                ({
                                  clientDedupResult.hubspot.deal_ids.length
                                }{" "}
                                deal
                                {clientDedupResult.hubspot.deal_ids.length !== 1
                                  ? "s"
                                  : ""}
                                )
                              </span>
                            )}
                          </p>
                        )}
                        {clientDedupResult.square?.card_on_file && (
                          <p className="text-[11px] text-[var(--tx3)] mb-2">
                            Card on file: {clientDedupResult.square.card_brand}{" "}
                            ****{clientDedupResult.square.card_last_four}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleClientAutoFill}
                            className="admin-btn admin-btn-sm admin-btn-primary"
                          >
                            Auto-fill from HubSpot
                          </button>
                          <button
                            type="button"
                            onClick={() => setClientBannerDismissed(true)}
                            className="admin-btn admin-btn-sm admin-btn-secondary"
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

              {/* ── Referral Code ── */}
                <div className="pt-6 pb-1">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-3">
                    Referral Code
                  </h3>
                  <div className="flex gap-2">
                    <input
                      value={referralCode}
                      onChange={(e) => {
                        setReferralCode(e.target.value.toUpperCase());
                        setReferralStatus("idle");
                        setReferralMsg("");
                      }}
                      placeholder="YUGO-NAME-XXXX"
                      className="admin-premium-input flex-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={verifyReferral}
                      disabled={!referralCode.trim()}
                      className="admin-btn admin-btn-sm admin-btn-secondary"
                    >
                      Verify
                    </button>
                  </div>
                  {referralMsg && (
                    <p
                      className={`mt-1.5 text-[11px] ${referralStatus === "valid" ? "text-[#2D9F5A]" : "text-red-500"}`}
                    >
                      {referralStatus === "valid" ? "✓ " : "✗ "}
                      {referralMsg}
                    </p>
                  )}
                </div>

              </>
              )}

              {!isB2bEmbed && quoteFlowStep === 2 && (
              <>
              <div className="mt-8 pt-2 sm:mt-10" aria-hidden />

              {/* ── 3. Addresses ── */}
              <div className="space-y-6">
                  <h3 className={addressSectionHeadingClass}>
                    {serviceType === "event" && eventMulti
                      ? "Addresses (per event below)"
                      : serviceType === "event"
                        ? "Origin"
                        : serviceType === "labour_only"
                          ? "Work Location"
                          : serviceType === "bin_rental"
                            ? "Delivery & pickup"
                            : "Addresses"}
                  </h3>
                  {serviceType === "event" && eventMulti && (
                    <p className="text-[11px] text-[var(--tx2)] -mt-1 mb-1">
                      Each event has its own origin and venue in the Event
                      section.
                    </p>
                  )}

                  {serviceType === "bin_rental" && (
                    <div className="max-w-4xl space-y-3">
                      <MultiStopAddressField
                        label="Delivery"
                        labelVisibility="sr-only"
                        placeholder="Delivery address * (where bins are delivered)"
                        stops={[{ address: toAddress }]}
                        onChange={(stops) => {
                          const p = stops[0];
                          setToAddress(p?.address ?? "");
                          setToLat(p?.lat ?? null);
                          setToLng(p?.lng ?? null);
                        }}
                        inputClassName={fieldInput}
                        trailingOnFirstRow={
                          <>
                            <label
                              htmlFor="quote-bin-to-access"
                              className="sr-only"
                            >
                              To access
                            </label>
                            <select
                              id="quote-bin-to-access"
                              value={toAccess}
                              onChange={(e) => setToAccess(e.target.value)}
                              className={accessSelectClass}
                              aria-label="Delivery location access"
                            >
                              {BIN_RENTAL_ACCESS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </>
                        }
                      />
                      <Field label="Delivery notes">
                        <textarea
                          value={binDeliveryNotes}
                          onChange={(e) => setBinDeliveryNotes(e.target.value)}
                          placeholder="Leave at concierge / Ring unit 2801"
                          rows={2}
                          className={fieldInput}
                        />
                      </Field>
                      <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={binPickupSameAsDelivery}
                          onChange={(e) =>
                            setBinPickupSameAsDelivery(e.target.checked)
                          }
                          className="accent-[var(--gold)]"
                        />
                        Same as delivery address
                      </label>
                      <p className="text-[10px] text-[var(--tx3)] leading-snug -mt-1">
                        If the client is moving, bins are picked up from the new
                        address. Uncheck and enter the destination.
                      </p>
                      {!binPickupSameAsDelivery && (
                        <MultiStopAddressField
                          label="Pickup"
                          labelVisibility="sr-only"
                          placeholder="Pickup address * (where bins are collected)"
                          stops={[{ address: fromAddress }]}
                          onChange={(stops) => {
                            const p = stops[0];
                            setFromAddress(p?.address ?? "");
                            setFromLat(p?.lat ?? null);
                            setFromLng(p?.lng ?? null);
                          }}
                          inputClassName={fieldInput}
                          trailingOnFirstRow={
                            <>
                              <label
                                htmlFor="quote-bin-from-access"
                                className="sr-only"
                              >
                                From access
                              </label>
                              <select
                                id="quote-bin-from-access"
                                value={fromAccess}
                                onChange={(e) => setFromAccess(e.target.value)}
                                className={accessSelectClass}
                                aria-label="Pickup location access"
                              >
                                {BIN_RENTAL_ACCESS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </>
                          }
                        />
                      )}
                    </div>
                  )}

                  {/* Event single: origin here; multi: per-leg below. Labour Only: own section. */}
                  {serviceType !== "labour_only" &&
                    !(serviceType === "event" && eventMulti) &&
                    serviceType !== "bin_rental" && (
                      <div className="max-w-4xl space-y-3">
                        <p className={addressStopTitleClass}>
                          {serviceType === "event"
                            ? "Origin"
                            : serviceType === "white_glove"
                              ? "Pickup location"
                              : "From"}
                        </p>
                        <MultiStopAddressField
                          label={
                            serviceType === "event"
                              ? "Origin Address *"
                              : "From"
                          }
                          labelVisibility="sr-only"
                          placeholder={
                            serviceType === "event"
                              ? "Where items come from (office/warehouse/home)"
                              : serviceType === "white_glove"
                                ? "Pickup location*"
                                : "From address*"
                          }
                          stops={[
                            { address: fromAddress },
                            ...extraFromStops,
                          ]}
                          onChange={(stops) => {
                            const p = stops[0];
                            setFromAddress(p?.address ?? "");
                            setFromLat(p?.lat ?? null);
                            setFromLng(p?.lng ?? null);
                            setExtraFromStops(stops.slice(1));
                          }}
                          inputClassName={fieldInput}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4">
                          <div className="w-full min-w-0 sm:w-[7.25rem] sm:shrink-0">
                            <label
                              htmlFor={
                                ["elevator", "concierge", "loading_dock"].includes(
                                  fromAccess,
                                )
                                  ? "quote-from-unit"
                                  : "quote-from-unit-ph"
                              }
                              className={addressMicroLabelClass}
                            >
                              Unit
                            </label>
                            {["elevator", "concierge", "loading_dock"].includes(
                              fromAccess,
                            ) ? (
                              <input
                                id="quote-from-unit"
                                type="text"
                                value={fromUnit}
                                onChange={(e) => setFromUnit(e.target.value)}
                                placeholder="e.g. 1201"
                                className={fieldInput}
                                aria-label="Origin unit or suite"
                              />
                            ) : (
                              <div
                                id="quote-from-unit-ph"
                                className={addressUnitPlaceholderClass}
                                role="status"
                              >
                                Not required for this access type
                              </div>
                            )}
                          </div>
                          <div className="w-full min-w-0 sm:w-[11rem] sm:max-w-[13rem] sm:shrink-0">
                            <label
                              htmlFor="quote-from-access"
                              className={addressMicroLabelClass}
                            >
                              Access
                            </label>
                            <select
                              id="quote-from-access"
                              value={fromAccess}
                              onChange={(e) => setFromAccess(e.target.value)}
                              className={accessSelectClass}
                              aria-label="From access"
                            >
                              {ACCESS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-full min-w-0 sm:min-w-[12rem] sm:max-w-[20rem] sm:flex-1">
                            <label
                              htmlFor="quote-from-parking"
                              className={addressMicroLabelClass}
                            >
                              Parking
                            </label>
                            <select
                              id="quote-from-parking"
                              value={fromParking}
                              onChange={(e) =>
                                setFromParking(
                                  e.target.value as
                                    | "dedicated"
                                    | "street"
                                    | "no_dedicated",
                                )
                              }
                              className={fieldInput}
                              aria-label="From address parking"
                            >
                              {PARKING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="mt-1 flex w-full min-w-full cursor-pointer items-center gap-2 text-[12px] text-[var(--tx2)] basis-full sm:mt-2">
                            <input
                              type="checkbox"
                              checked={fromLongCarry}
                              onChange={(e) =>
                                setFromLongCarry(e.target.checked)
                              }
                              className={checkboxAccentClass}
                            />
                            {serviceType === "white_glove"
                              ? "Pickup location: Long carry (50m+ from truck to entrance) (+$75)"
                              : "From address: Long carry (50m+ from truck to entrance) (+$75)"}
                          </label>
                        </div>
                      </div>
                    )}
                  {serviceType === "event" &&
                    !eventMulti && (
                      <div className="max-w-4xl space-y-3">
                        <p className={addressStopTitleClass}>
                          Destination / venue
                        </p>
                        <div className="max-w-xl space-y-1.5">
                          <label
                            htmlFor="quote-event-venue-parking"
                            className={addressMicroLabelClass}
                          >
                            Parking
                          </label>
                          <select
                            id="quote-event-venue-parking"
                            value={toParking}
                            onChange={(e) =>
                              setToParking(
                                e.target.value as
                                  | "dedicated"
                                  | "street"
                                  | "no_dedicated",
                              )
                            }
                            className={fieldInput}
                            aria-label="To address parking"
                          >
                            {PARKING_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[var(--tx2)]">
                          <input
                            type="checkbox"
                            checked={toLongCarry}
                            onChange={(e) =>
                              setToLongCarry(e.target.checked)
                            }
                            className={checkboxAccentClass}
                          />
                          To address: Long carry (50m+ from truck to entrance)
                          (+$75)
                        </label>
                      </div>
                    )}
                  {serviceType !== "event" &&
                    serviceType !== "labour_only" &&
                    serviceType !== "bin_rental" && (
                      <div className="max-w-4xl space-y-3">
                        <p className={addressStopTitleClass}>
                          {serviceType === "white_glove"
                            ? "Delivery location"
                            : "To"}
                        </p>
                        <MultiStopAddressField
                          label="To"
                          labelVisibility="sr-only"
                          placeholder={
                            serviceType === "white_glove"
                              ? "Delivery location*"
                              : "To address*"
                          }
                          stops={[{ address: toAddress }, ...extraToStops]}
                          onChange={(stops) => {
                            const p = stops[0];
                            setToAddress(p?.address ?? "");
                            setToLat(p?.lat ?? null);
                            setToLng(p?.lng ?? null);
                            setExtraToStops(stops.slice(1));
                          }}
                          inputClassName={fieldInput}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4">
                          <div className="w-full min-w-0 sm:w-[7.25rem] sm:shrink-0">
                            <label
                              htmlFor={
                                ["elevator", "concierge", "loading_dock"].includes(
                                  toAccess,
                                )
                                  ? "quote-to-unit"
                                  : "quote-to-unit-ph"
                              }
                              className={addressMicroLabelClass}
                            >
                              Unit
                            </label>
                            {["elevator", "concierge", "loading_dock"].includes(
                              toAccess,
                            ) ? (
                              <input
                                id="quote-to-unit"
                                type="text"
                                value={toUnit}
                                onChange={(e) => setToUnit(e.target.value)}
                                placeholder="e.g. 1201"
                                className={fieldInput}
                                aria-label="Destination unit or suite"
                              />
                            ) : (
                              <div
                                id="quote-to-unit-ph"
                                className={addressUnitPlaceholderClass}
                                role="status"
                              >
                                Not required for this access type
                              </div>
                            )}
                          </div>
                          <div className="w-full min-w-0 sm:w-[11rem] sm:max-w-[13rem] sm:shrink-0">
                            <label
                              htmlFor="quote-to-access"
                              className={addressMicroLabelClass}
                            >
                              Access
                            </label>
                            <select
                              id="quote-to-access"
                              value={toAccess}
                              onChange={(e) => setToAccess(e.target.value)}
                              className={accessSelectClass}
                              aria-label="To access"
                            >
                              {ACCESS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-full min-w-0 sm:min-w-[12rem] sm:max-w-[20rem] sm:flex-1">
                            <label
                              htmlFor="quote-to-parking"
                              className={addressMicroLabelClass}
                            >
                              Parking
                            </label>
                            <select
                              id="quote-to-parking"
                              value={toParking}
                              onChange={(e) =>
                                setToParking(
                                  e.target.value as
                                    | "dedicated"
                                    | "street"
                                    | "no_dedicated",
                                )
                              }
                              className={fieldInput}
                              aria-label="To address parking"
                            >
                              {PARKING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="mt-1 flex w-full min-w-full cursor-pointer items-center gap-2 text-[12px] text-[var(--tx2)] basis-full sm:mt-2">
                            <input
                              type="checkbox"
                              checked={toLongCarry}
                              onChange={(e) =>
                                setToLongCarry(e.target.checked)
                              }
                              className={checkboxAccentClass}
                            />
                            {serviceType === "white_glove"
                              ? "Delivery location: Long carry (50m+ from truck to entrance) (+$75)"
                              : "To address: Long carry (50m+ from truck to entrance) (+$75)"}
                          </label>
                        </div>
                      </div>
                    )}
                  {serviceType === "event" &&
                    eventMulti && (
                      <div className="flex max-w-4xl flex-col gap-3 min-[500px]:flex-row min-[500px]:flex-wrap min-[500px]:items-end min-[500px]:gap-x-4">
                        <div className="w-full min-w-0 min-[500px]:max-w-[20rem]">
                          <label
                            htmlFor="quote-ev-multi-from-parking"
                            className={addressMicroLabelClass}
                          >
                            From parking
                          </label>
                          <select
                            id="quote-ev-multi-from-parking"
                            value={fromParking}
                            onChange={(e) =>
                              setFromParking(
                                e.target.value as
                                  | "dedicated"
                                  | "street"
                                  | "no_dedicated",
                              )
                            }
                            className={fieldInput}
                            aria-label="From address parking"
                          >
                            {PARKING_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full min-w-0 min-[500px]:max-w-[20rem]">
                          <label
                            htmlFor="quote-ev-multi-to-parking"
                            className={addressMicroLabelClass}
                          >
                            To parking
                          </label>
                          <select
                            id="quote-ev-multi-to-parking"
                            value={toParking}
                            onChange={(e) =>
                              setToParking(
                                e.target.value as
                                  | "dedicated"
                                  | "street"
                                  | "no_dedicated",
                              )
                            }
                            className={fieldInput}
                            aria-label="To address parking"
                          >
                            {PARKING_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex min-[500px]:basis-full cursor-pointer items-center gap-2 text-[12px] text-[var(--tx2)]">
                          <input
                            type="checkbox"
                            checked={fromLongCarry}
                            onChange={(e) =>
                              setFromLongCarry(e.target.checked)
                            }
                            className={checkboxAccentClass}
                          />
                          From address: Long carry (50m+ from truck to entrance)
                          (+$75)
                        </label>
                        <label className="flex min-[500px]:basis-full cursor-pointer items-center gap-2 text-[12px] text-[var(--tx2)]">
                          <input
                            type="checkbox"
                            checked={toLongCarry}
                            onChange={(e) =>
                              setToLongCarry(e.target.checked)
                            }
                            className={checkboxAccentClass}
                          />
                          To address: Long carry (50m+ from truck to entrance)
                          (+$75)
                        </label>
                      </div>
                    )}
                  {(serviceType === "local_move" ||
                    serviceType === "long_distance") && (
                    <div className="space-y-3 pt-2">
                      <BuildingProfileQuoteAlert
                        profile={fromBuildingMatch}
                        end="origin"
                        inventoryScore={inventoryScoreWithBoxes}
                      />
                      <BuildingProfileQuoteAlert
                        profile={toBuildingMatch}
                        end="destination"
                        inventoryScore={inventoryScoreWithBoxes}
                      />
                      {!fromBuildingMatch && fromAccess === "elevator" && (
                        <div className={buildingElevatorPanelClass}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
                            Origin building details
                          </p>
                          <p className="text-[10px] text-[var(--tx2)] leading-snug">
                            Help us plan accurately. These details affect crew time and pricing when
                            no building profile is on file.
                          </p>
                          <label className="flex items-start gap-2.5 text-[11px] text-[var(--tx)] cursor-pointer">
                            <input
                              type="checkbox"
                              className={`mt-0.5 ${checkboxAccentClass}`}
                              checked={originBuildingFlags.includes(
                                "commercial_tenants",
                              )}
                              onChange={() =>
                                toggleOriginFlag("commercial_tenants")
                              }
                            />
                            <span>Building has commercial stores (grocery, retail, restaurants)</span>
                          </label>
                          {originBuildingFlags.includes("commercial_tenants") && (
                            <div className="ml-6 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-[10px] leading-relaxed text-amber-950">
                              Mixed-use buildings often use split elevator systems with transfers
                              between freight and residential elevators. That can add significant move
                              time. We may add a building access surcharge when no verified profile
                              exists yet.
                            </div>
                          )}
                          <label className="flex items-start gap-2.5 text-[11px] text-[var(--tx)] cursor-pointer">
                            <input
                              type="checkbox"
                              className={`mt-0.5 ${checkboxAccentClass}`}
                              checked={originBuildingFlags.includes(
                                "multi_elevator_transfer",
                              )}
                              onChange={() =>
                                toggleOriginFlag("multi_elevator_transfer")
                              }
                            />
                            <span>Multiple elevator transfers needed to reach the unit</span>
                          </label>
                          <label className="flex items-start gap-2.5 text-[11px] text-[var(--tx)] cursor-pointer">
                            <input
                              type="checkbox"
                              className={`mt-0.5 ${checkboxAccentClass}`}
                              checked={originBuildingFlags.includes(
                                "dock_restrictions",
                              )}
                              onChange={() => toggleOriginFlag("dock_restrictions")}
                            />
                            <span>Loading dock has time restrictions or is shared</span>
                          </label>
                          <div>
                            <label className="text-[10px] text-[var(--tx3)] block mb-1">
                              Floor number (optional)
                            </label>
                            <input
                              type="number"
                              value={originFloor}
                              onChange={(e) => setOriginFloor(e.target.value)}
                              placeholder="e.g. 32"
                              className={`${fieldInput} max-w-[120px]`}
                            />
                          </div>
                        </div>
                      )}
                      {!toBuildingMatch && toAccess === "elevator" && (
                        <div className={buildingElevatorPanelClass}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
                            Destination building details
                          </p>
                          <p className="text-[10px] text-[var(--tx2)] leading-snug">
                            Help us plan accurately when no building profile is on file.
                          </p>
                          <label className="flex items-start gap-2.5 text-[11px] text-[var(--tx)] cursor-pointer">
                            <input
                              type="checkbox"
                              className={`mt-0.5 ${checkboxAccentClass}`}
                              checked={destBuildingFlags.includes(
                                "commercial_tenants",
                              )}
                              onChange={() => toggleDestFlag("commercial_tenants")}
                            />
                            <span>Building has commercial stores (grocery, retail, restaurants)</span>
                          </label>
                          {destBuildingFlags.includes("commercial_tenants") && (
                            <div className="ml-6 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-[10px] leading-relaxed text-amber-950">
                              Mixed-use buildings often use split elevator systems with transfers
                              between freight and residential elevators. That can add significant move
                              time. We may add a building access surcharge when no verified profile
                              exists yet.
                            </div>
                          )}
                          <label className="flex items-start gap-2.5 text-[11px] text-[var(--tx)] cursor-pointer">
                            <input
                              type="checkbox"
                              className={`mt-0.5 ${checkboxAccentClass}`}
                              checked={destBuildingFlags.includes(
                                "multi_elevator_transfer",
                              )}
                              onChange={() =>
                                toggleDestFlag("multi_elevator_transfer")
                              }
                            />
                            <span>Multiple elevator transfers needed to reach the unit</span>
                          </label>
                          <label className="flex items-start gap-2.5 text-[11px] text-[var(--tx)] cursor-pointer">
                            <input
                              type="checkbox"
                              className={`mt-0.5 ${checkboxAccentClass}`}
                              checked={destBuildingFlags.includes("dock_restrictions")}
                              onChange={() => toggleDestFlag("dock_restrictions")}
                            />
                            <span>Loading dock has time restrictions or is shared</span>
                          </label>
                          <div>
                            <label className="text-[10px] text-[var(--tx3)] block mb-1">
                              Floor number (optional)
                            </label>
                            <input
                              type="number"
                              value={destFloor}
                              onChange={(e) => setDestFloor(e.target.value)}
                              placeholder="e.g. 32"
                              className={`${fieldInput} max-w-[120px]`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              <div className="mt-8 pt-6 sm:mt-10" aria-hidden />

              {/* ── 4. Move details ── */}
              {/* Event and labour_only manage their own date fields */}
              {serviceType !== "event" && serviceType !== "b2b_delivery" && (
                <div>
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-3">
                    {quoteFormSchedulingSectionTitle(serviceType)}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div
                      id={
                        serviceType === "b2b_delivery"
                          ? "b2b-err-date"
                          : undefined
                      }
                      className={`space-y-1 ${serviceType === "b2b_delivery" && b2bSubmitErrors.date ? "rounded-lg border-2 border-red-500/45 p-2 -m-0.5" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Field label={quoteFormServiceDateLabel(serviceType)}>
                          <input
                            type="date"
                            value={moveDate}
                            onChange={(e) => setMoveDate(e.target.value)}
                            required
                            className={fieldInput}
                          />
                        </Field>
                        {serviceType === "b2b_delivery" &&
                        moveDate.trim() &&
                        isMoveDateWeekend(moveDate) ? (
                          <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-1 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 self-end mb-0.5">
                            WEEKEND +
                            {fmtPrice(
                              cfgNum(config, "b2b_weekend_surcharge", 40),
                            )}
                          </span>
                        ) : null}
                      </div>
                      {serviceType === "b2b_delivery" &&
                      b2bSubmitErrors.date ? (
                        <p className="text-[10px] text-red-600 dark:text-red-400">
                          {b2bSubmitErrors.date}
                        </p>
                      ) : null}
                    </div>
                    <Field label="Preferred Time">
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className={fieldInput}
                      />
                    </Field>
                    {serviceType !== "labour_only" &&
                      serviceType !== "bin_rental" && (
                        <Field label="Arrival Window">
                          <select
                            value={arrivalWindow}
                            onChange={(e) => setArrivalWindow(e.target.value)}
                            className={fieldInput}
                          >
                            {TIME_WINDOW_OPTIONS.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    {(serviceType === "local_move" ||
                      serviceType === "long_distance") && (
                      <Field label="Move Size">
                        <select
                          value={moveSize}
                          onChange={(e) => {
                            moveSizeUserTouchedRef.current = true;
                            setMoveSize(e.target.value);
                          }}
                          className={fieldInput}
                        >
                          <option value="">
                            Select move size or add inventory to auto-detect
                          </option>
                          {MOVE_SIZES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {moveSizeSuggestion && inventoryItems.length > 0 && (
                          <p className="mt-1.5 text-[10px] text-[var(--tx3)] flex items-start gap-1.5">
                            <Lightbulb
                              className="w-3.5 h-3.5 shrink-0 text-[var(--gold)] mt-0.5"
                              aria-hidden
                            />
                            <span>
                              Detected:{" "}
                              {moveSizeLabel(moveSizeSuggestion.suggested)}
                              {moveSizeSuggestion.confidence === "high"
                                ? " (high confidence)"
                                : " (medium confidence)"}
                              {" — "}
                              {moveSizeSuggestion.reason}
                            </span>
                          </p>
                        )}
                        {moveSize.trim() &&
                          moveSizeSuggestion &&
                          moveSize !== moveSizeSuggestion.suggested &&
                          inventoryItems.length > 0 &&
                          (() => {
                            const msg = moveSizeInventoryMismatchMessage(
                              moveSize,
                              inventoryScoreWithBoxes,
                              moveSizeSuggestion.suggested,
                            );
                            if (!msg) return null;
                            const range = expectedScoreRangeForMoveSize(moveSize);
                            // Significant mismatch: score is >30% below the typical minimum for the stated size.
                            // This produces a hard two-button warning that requires an explicit coordinator decision.
                            const isSignificantMismatch =
                              !!range && inventoryScoreWithBoxes < range.min * 0.70;

                            if (!isSignificantMismatch) {
                              // Slight mismatch — soft informational warning
                              return (
                                <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/8 p-2.5 text-[10px] text-[var(--tx2)] space-y-2">
                                  <p className="flex items-start gap-1.5">
                                    <Warning
                                      className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5"
                                      aria-hidden
                                    />
                                    <span>{msg}</span>
                                  </p>
                                  <button
                                    type="button"
                                    className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                                    onClick={() => {
                                      moveSizeUserTouchedRef.current = false;
                                      setMoveSize(moveSizeSuggestion.suggested);
                                      setSizeOverrideConfirmed(false);
                                    }}
                                  >
                                    Use{" "}
                                    {moveSizeLabel(moveSizeSuggestion.suggested)}{" "}
                                    instead
                                  </button>
                                </div>
                              );
                            }

                            // Significant mismatch — hard warning that requires explicit coordinator decision
                            return (
                              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                                <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                                  <Warning className="w-3.5 h-3.5 shrink-0" aria-hidden />
                                  Size mismatch detected
                                </p>
                                <p className="text-[10px] text-amber-700 leading-snug">
                                  Inventory scores{" "}
                                  <strong>{inventoryScoreWithBoxes.toFixed(1)}</strong> — typical for{" "}
                                  {moveSizeLabel(moveSizeSuggestion.suggested)}, not{" "}
                                  {moveSizeLabel(moveSize)} (typical:{" "}
                                  {range?.min}–{range?.max}). Using{" "}
                                  {moveSizeLabel(moveSize)} pricing will significantly overprice this quote.
                                </p>
                                {!sizeOverrideConfirmed ? (
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      className="flex-1 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-semibold"
                                      onClick={() => {
                                        moveSizeUserTouchedRef.current = false;
                                        setMoveSize(moveSizeSuggestion.suggested);
                                        setSizeOverrideConfirmed(false);
                                      }}
                                    >
                                      Use {moveSizeLabel(moveSizeSuggestion.suggested)} (recommended)
                                    </button>
                                    <button
                                      type="button"
                                      className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg text-[10px] font-medium"
                                      onClick={() => setSizeOverrideConfirmed(true)}
                                    >
                                      Keep {moveSizeLabel(moveSize)} — I&apos;ve verified this
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-amber-600 font-medium">
                                    ✓ Override confirmed. Coordinator verified this is a {moveSizeLabel(moveSize)} move.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                      </Field>
                    )}
                    {serviceType === "white_glove" && (
                      <div className="col-span-full space-y-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3">
                        <label className="flex items-start gap-2 text-[11px] text-[var(--tx2)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wgGuaranteedWindow}
                            onChange={(e) =>
                              setWgGuaranteedWindow(e.target.checked)
                            }
                            className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                          />
                          <span>
                            <span className="font-medium text-[var(--tx)]">
                              Guaranteed time window
                            </span>
                            <span className="block text-[10px] text-[var(--tx3)] mt-0.5">
                              Client requires delivery within a specific time
                              slot
                            </span>
                          </span>
                        </label>
                        {wgGuaranteedWindow && (
                          <div className="pl-6 space-y-2">
                            <Field label="Window">
                              <select
                                value={String(wgGuaranteedWindowHours)}
                                onChange={(e) =>
                                  setWgGuaranteedWindowHours(
                                    Number(e.target.value) as 2 | 3 | 4,
                                  )
                                }
                                className={fieldInput}
                              >
                                <option value="2">2 hours</option>
                                <option value="3">3 hours</option>
                                <option value="4">4 hours</option>
                              </select>
                            </Field>
                            <p className="text-[10px] text-[var(--tx3)] leading-snug">
                              Condo buildings often require a booked elevator
                              slot. We will arrive within your confirmed window.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {serviceType === "local_move" &&
                      !ecoBinsUpsellDismissed && (
                        <div className="col-span-full relative rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/5 p-4 pr-11 sm:pr-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <Recycle
                              className="w-6 h-6 shrink-0 text-[var(--gold)]"
                              weight="regular"
                              aria-hidden
                            />
                            <div>
                              <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--gold)]">
                                Add eco-friendly bins
                              </p>
                              <p className="text-[11px] text-[var(--tx2)] mt-1 leading-snug">
                                Skip the cardboard. Reusable bins delivered 7
                                days before your move, picked up 5 days after. 2
                                Bedroom:{" "}
                                {fmtPrice(
                                  cfgNum(config, "bin_bundle_2br", 279),
                                )}{" "}
                                — delivery is free when coordinated with your
                                move (uncheck material delivery or link the move
                                when booked).
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setServiceType("bin_rental");
                              setBinBundleType("2br");
                              setBinMaterialDelivery(false);
                              setBinLinkedMoveId("");
                            }}
                            className="admin-btn admin-btn-sm admin-btn-primary shrink-0"
                          >
                            Add to quote
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                localStorage.setItem(
                                  "yugo_dismiss_eco_bins_quote_upsell",
                                  "1",
                                );
                              } catch {
                                /* ignore */
                              }
                              setEcoBinsUpsellDismissed(true);
                            }}
                            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--gold)]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]/50"
                            aria-label="Dismiss eco bins suggestion"
                          >
                            <X
                              size={18}
                              weight="regular"
                              className="text-current"
                              aria-hidden
                            />
                          </button>
                        </div>
                      )}
                    {serviceType === "local_move" && (
                      <>
                        <div className="col-span-full">
                          <Field label="Recommend Tier">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={recommendedTier}
                                onChange={(e) =>
                                  setRecommendedTier(
                                    e.target.value as
                                      | "essential"
                                      | "signature"
                                      | "estate",
                                  )
                                }
                                className={`${fieldInput} w-full min-w-[10.5rem] max-w-[16rem] shrink-0`}
                              >
                                <option value="essential">Curated</option>
                                <option value="signature">Signature</option>
                                <option value="estate">Estate</option>
                              </select>
                            </div>
                          </Field>
                        </div>
                        {recommendedTier === "estate" &&
                          ["2br", "3br", "4br", "5br_plus"].includes(
                            moveSize,
                          ) &&
                          moveDate.trim() &&
                          (() => {
                            const plan = calculateEstateDays(
                              moveSize,
                              inventoryScoreWithBoxes,
                            );
                            if (plan.days <= 1) return null;
                            const lines = buildEstateScheduleLines(
                              plan,
                              moveDate.trim(),
                              "20ft dedicated moving truck",
                            );
                            return (
                              <div className="col-span-full rounded-xl border border-[var(--tx)]/[0.08] bg-[#F9F9F8] dark:bg-white/[0.04] dark:border-white/[0.08] px-4 py-3 space-y-2 text-[11px] text-[var(--tx2)]">
                                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--tx3)]">
                                  Estate schedule preview
                                </p>
                                <p className="text-[var(--tx)] font-medium leading-snug">
                                  This move typically needs {plan.days} days.
                                  Pack day is usually the day before the move
                                  unless the coordinator arranges otherwise.
                                </p>
                                <div className="space-y-2">
                                  {lines.map((ln, i) => (
                                    <p
                                      key={i}
                                      className="leading-relaxed pl-2.5 border-l-2 border-[var(--gold)]/40 text-[var(--tx2)]"
                                    >
                                      {ln}
                                    </p>
                                  ))}
                                </div>
                                <p className="text-[10px] text-[var(--tx3)] leading-snug">
                                  Coordinators can adjust timing (for example
                                  same weekend only, or pack Thursday and move
                                  Saturday).
                                </p>
                              </div>
                            );
                          })()}
                      </>
                    )}
                    {/* Box count moved into InventoryInput when inventory is shown */}
                    {(serviceType === "local_move" ||
                      serviceType === "long_distance") &&
                      itemWeights.length === 0 && (
                        <Field label="Number of Boxes">
                          <div className="space-y-1.5">
                            <select
                              value={
                                clientBoxCount === ""
                                  ? ""
                                  : [
                                        "5",
                                        "10",
                                        "20",
                                        "30",
                                        "40",
                                        "50",
                                        "75",
                                      ].includes(clientBoxCount)
                                    ? clientBoxCount
                                    : "custom"
                              }
                              onChange={(e) => {
                                if (e.target.value === "custom") {
                                  setClientBoxCount("");
                                } else {
                                  setClientBoxCount(e.target.value);
                                }
                              }}
                              className={fieldInput}
                            >
                              <option value="">Not specified</option>
                              <option value="5">1–5 boxes</option>
                              <option value="10">5–10 boxes</option>
                              <option value="20">10–20 boxes</option>
                              <option value="30">20–30 boxes</option>
                              <option value="40">30–40 boxes</option>
                              <option value="50">40–50 boxes</option>
                              <option value="75">50–100 boxes</option>
                              <option value="custom">Custom amount…</option>
                            </select>
                            {![
                              "",
                              "5",
                              "10",
                              "20",
                              "30",
                              "40",
                              "50",
                              "75",
                            ].includes(clientBoxCount) && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={9999}
                                  value={clientBoxCount}
                                  onChange={(e) =>
                                    setClientBoxCount(e.target.value)
                                  }
                                  placeholder="Enter exact count"
                                  className={`${fieldInput} focus:border-[var(--gold)]`}
                                  autoFocus
                                />
                                <span className="text-[11px] text-[var(--tx3)] shrink-0">
                                  boxes
                                </span>
                              </div>
                            )}
                          </div>
                        </Field>
                      )}
                  </div>

                  {serviceType === "bin_rental" && binSchedulePreview && (
                    <div className="mt-3 p-3 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[11px] space-y-1">
                      <p className="font-semibold text-[var(--tx)]">
                        Based on your move date
                      </p>
                      <p>
                        <span className="text-[var(--tx3)]">Delivery:</span>{" "}
                        {binSchedulePreview.delivery}
                      </p>
                      <p>
                        <span className="text-[var(--tx3)]">Move day:</span>{" "}
                        {binSchedulePreview.move}
                      </p>
                      <p>
                        <span className="text-[var(--tx3)]">Pickup:</span>{" "}
                        {binSchedulePreview.pickup}
                      </p>
                      <p className="text-[var(--tx3)] pt-1">
                        Rental cycle: {binSchedulePreview.cycle} days total
                      </p>
                    </div>
                  )}

                  {serviceType === "local_move" && (
                    <p className="text-[9px] text-[var(--tx3)] mt-1.5">
                      The recommended tier highlights that package on the
                      client&apos;s quote page and email.
                    </p>
                  )}
                </div>
              )}

              {serviceType !== "b2b_delivery" && (
                <div className="pt-5 pb-5" aria-hidden />
              )}

              {/* ── 5. Specialty items ── */}
              {(serviceType === "local_move" ||
                serviceType === "long_distance") && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Specialty Items
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {SPECIALTY_ITEM_TYPES.map((type) => {
                      const active = specialtyItems.some(
                        (i) => i.type === type,
                      );
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleSpecialtyItem(type)}
                          className={`px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-colors ${
                            active
                              ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                              : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                          }`}
                        >
                          {toTitleCase(type)}
                        </button>
                      );
                    })}
                  </div>
                  {specialtyItems.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {specialtyItems.map((item) => (
                        <div
                          key={item.type}
                          className="flex items-center gap-2"
                        >
                          <span className="text-[11px] text-[var(--tx)] flex-1">
                            {toTitleCase(item.type)}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={item.qty}
                            onChange={(e) =>
                              updateSpecialtyQty(
                                item.type,
                                parseInt(e.target.value) || 1,
                              )
                            }
                            className="w-14 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-center text-[var(--tx)]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 5b. Custom crating (all service types, coordinator decides) ── */}
              {(serviceType === "local_move" ||
                serviceType === "long_distance" ||
                serviceType === "white_glove" ||
                serviceType === "specialty") && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Custom Crating
                    </h3>
                    <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cratingRequired}
                        onChange={(e) => {
                          setCratingRequired(e.target.checked);
                          if (!e.target.checked) setCratingItems([]);
                        }}
                        className="accent-[var(--gold)] w-3.5 h-3.5"
                      />
                      <span className="text-[11px] text-[var(--tx2)]">
                        Crating required
                      </span>
                    </label>
                  </div>

                  {cratingRequired && (
                    <div className="space-y-2 pl-1">
                      {cratingItems.map((piece, idx) => {
                        const priceMap = parseCfgJson<Record<string, number>>(
                          config,
                          "crating_prices",
                          CRATING_SIZE_FALLBACK,
                        );
                        const piecePrice =
                          priceMap[piece.size] ??
                          CRATING_SIZE_FALLBACK[piece.size] ??
                          250;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--tx3)] w-14 shrink-0">
                              Piece {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={piece.description}
                              onChange={(e) =>
                                setCratingItems((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, description: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                              placeholder="e.g. Painting 48x36"
                              className={`${fieldInput} flex-1 min-w-0`}
                            />
                            <select
                              value={piece.size}
                              onChange={(e) =>
                                setCratingItems((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? {
                                          ...p,
                                          size: e.target.value as
                                            | "small"
                                            | "medium"
                                            | "large"
                                            | "oversized",
                                        }
                                      : p,
                                  ),
                                )
                              }
                              className={`${fieldInput} w-40 shrink-0`}
                            >
                              {Object.entries(CRATING_SIZE_LABELS).map(
                                ([k, label]) => (
                                  <option key={k} value={k}>
                                    {label}, $
                                    {(
                                      priceMap[k] ?? CRATING_SIZE_FALLBACK[k]
                                    ).toLocaleString()}
                                  </option>
                                ),
                              )}
                            </select>
                            <span className="text-[10px] text-[var(--gold)] w-14 text-right shrink-0">
                              ${piecePrice.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCratingItems((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="text-[var(--tx3)] hover:text-red-400 text-[13px] shrink-0"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setCratingItems((prev) => [
                            ...prev,
                            { description: "", size: "medium" },
                          ])
                        }
                        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
                      >
                        <Plus className="w-3 h-3" /> Add piece
                      </button>
                      {cratingItems.length > 0 && (
                        <p className="text-[10px] text-[var(--tx3)]">
                          Crating total:{" "}
                          <strong className="text-[var(--gold)]">
                            $
                            {cratingItems
                              .reduce((sum, p) => {
                                const pm = parseCfgJson<Record<string, number>>(
                                  config,
                                  "crating_prices",
                                  CRATING_SIZE_FALLBACK,
                                );
                                return (
                                  sum +
                                  (pm[p.size] ??
                                    CRATING_SIZE_FALLBACK[p.size] ??
                                    250)
                                );
                              }, 0)
                              .toLocaleString()}
                          </strong>{" "}
                          ({cratingItems.length} piece
                          {cratingItems.length !== 1 ? "s" : ""})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── 5c. Inventory (Residential / Long distance / Office) ── */}
              {(serviceType === "local_move" ||
                serviceType === "long_distance" ||
                serviceType === "office_move") &&
                itemWeights.length > 0 && (
                  <>
                    <div className="pt-5 pb-5" aria-hidden />
                    {multiPickupInventoryMode ? (
                      <div className="space-y-6">
                        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">
                          Inventory by pickup
                        </p>
                        {pickupAddressList.map((addr, idx) => (
                          <div
                            key={`pickup-inv-${idx}`}
                            className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3 space-y-2"
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gdim)] text-[10px] font-bold text-[var(--tx)]">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-[11px] font-semibold text-[var(--tx)]">
                                    Pickup {idx + 1}
                                  </p>
                                </div>
                                <p className="text-[10px] text-[var(--tx3)] break-words">
                                  {addr || "Add this pickup above"}
                                </p>
                              </div>
                            </div>
                            <InventoryInput
                              itemWeights={
                                itemWeights as {
                                  slug: string;
                                  item_name: string;
                                  weight_score: number;
                                  category: string;
                                  room?: string;
                                  is_common: boolean;
                                  display_order?: number;
                                  active?: boolean;
                                }[]
                              }
                              value={perPickupInventory[idx] ?? []}
                              onChange={(next) => {
                                setPerPickupInventory((prev) => {
                                  const copy = [...prev];
                                  while (copy.length <= idx) copy.push([]);
                                  copy[idx] = next;
                                  return copy;
                                });
                              }}
                              moveSize={
                                moveSize ||
                                moveSizeSuggestion?.suggested ||
                                "partial"
                              }
                              fromAccess={fromAccess}
                              toAccess={toAccess}
                              showLabourEstimate={false}
                              boxCount={
                                idx === 0 ? Number(clientBoxCount) || 0 : 0
                              }
                              onBoxCountChange={
                                idx === 0
                                  ? (n) =>
                                      setClientBoxCount(n > 0 ? String(n) : "")
                                  : undefined
                              }
                              mode={
                                serviceType === "office_move"
                                  ? "commercial"
                                  : "residential"
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <InventoryInput
                        itemWeights={
                          itemWeights as {
                            slug: string;
                            item_name: string;
                            weight_score: number;
                            category: string;
                            room?: string;
                            is_common: boolean;
                            display_order?: number;
                            active?: boolean;
                          }[]
                        }
                        value={inventoryItems}
                        onChange={setInventoryItems}
                        moveSize={
                          moveSize || moveSizeSuggestion?.suggested || "partial"
                        }
                        fromAccess={fromAccess}
                        toAccess={toAccess}
                        showLabourEstimate={
                          (!!moveSize ||
                            !!moveSizeSuggestion ||
                            inventoryItems.length > 0) &&
                          ["local_move", "long_distance", "office_move"].includes(
                            serviceType,
                          )
                        }
                        boxCount={Number(clientBoxCount) || 0}
                        onBoxCountChange={(n) =>
                          setClientBoxCount(n > 0 ? String(n) : "")
                        }
                        mode={
                          serviceType === "office_move"
                            ? "commercial"
                            : "residential"
                        }
                      />
                    )}
                  </>
                )}

              {/* ── Assembly auto-detection toggle (residential / long-distance) ── */}
              {(serviceType === "local_move" || serviceType === "long_distance") &&
                inventoryItems.length > 0 && (
                  <div className="mt-4 mb-4 rounded-md border border-line bg-surface px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="label-md text-fg">Assembly / disassembly</span>
                          {assemblyOverride !== null && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                              Manual override
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--tx3)] mt-0.5 leading-snug">
                          {assemblyDetection.required && assemblyDetection.confidence === "certain"
                            ? `Auto-detected: ${assemblyDetection.itemsRequiringAssembly.slice(0, 2).join(", ")}${
                                assemblyDetection.itemsRequiringAssembly.length > 2
                                  ? ` +${assemblyDetection.itemsRequiringAssembly.length - 2} more`
                                  : ""
                              } need assembly`
                            : assemblyDetection.required && assemblyDetection.confidence === "likely"
                              ? "Some items may need assembly — confirm with client"
                              : "No assembly items detected in inventory"}
                        </p>
                        {assemblyOverride !== null && (
                          <p className="text-[10px] text-amber-600 mt-1">
                            ⚡ Auto-detection suggested:{" "}
                            {assemblyDetection.required ? "required" : "not required"}
                          </p>
                        )}
                        {/* Operational guard: client declined assembly but inventory has items requiring it. */}
                        {assemblyOverride === false && assemblyDetection.required && (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                            <p className="text-[11px] font-semibold text-amber-800">
                              Client declined assembly — verify on move day
                            </p>
                            <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
                              {assemblyDetection.itemsRequiringAssembly.slice(0, 3).join(", ")}
                              {assemblyDetection.itemsRequiringAssembly.length > 3
                                ? ` +${assemblyDetection.itemsRequiringAssembly.length - 3} more`
                                : ""}{" "}
                              normally require assembly. Confirm the client will handle disassembly
                              before move day. If the crew has to assist, this will affect the
                              price.
                            </p>
                          </div>
                        )}
                        {/* Intake override: client requested assembly but inventory shows none detected. */}
                        {assemblyOverride === true && !assemblyDetection.required && (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                            <p className="text-[11px] font-semibold text-amber-800">
                              Assembly requested — not detected in inventory
                            </p>
                            <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
                              Client indicated assembly on their intake form, but no assembly items
                              were found in the inventory list. Confirm with the client before
                              sending — if no assembly is needed, reset to auto.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {assemblyOverride !== null && (
                          <button
                            type="button"
                            onClick={() => setAssemblyOverride(null)}
                            className="text-[10px] text-[var(--tx3)] hover:text-[var(--tx)] underline underline-offset-2"
                          >
                            Reset to auto
                          </button>
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={effectiveAssemblyRequired}
                          onClick={() => setAssemblyOverride(!effectiveAssemblyRequired)}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                            effectiveAssemblyRequired
                              ? assemblyOverride !== null
                                ? "bg-amber-500"
                                : "bg-[var(--admin-primary-fill)]"
                              : "bg-[var(--brd)]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              effectiveAssemblyRequired ? "translate-x-4" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {serviceType !== "b2b_delivery" && (
                <div className="pt-5 pb-5" aria-hidden />
              )}

              {/* ── Office fields ── */}
              {serviceType === "office_move" && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Office move details
                  </h3>
                  <p className="text-[10px] text-[var(--tx3)] leading-snug">
                    Pricing is workstation-based (not residential). Desks/chairs
                    help derive workstation count when the total field is blank.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Billable hours (override, optional)">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={officeEstHours}
                        onChange={(e) =>
                          setOfficeEstHours(Number(e.target.value) || 5)
                        }
                        className={`${fieldInput} min-w-0`}
                      />
                      <p className="text-[9px] text-[var(--tx3)] mt-0.5">
                        Leave default to use hours estimated from workstations
                        and specialty areas.
                      </p>
                    </Field>
                    <Field label="Crew size (override, optional)">
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={officeCrewSize}
                        onChange={(e) =>
                          setOfficeCrewSize(Number(e.target.value) || 2)
                        }
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field label="Square footage">
                      <input
                        type="number"
                        min={0}
                        value={sqft}
                        onChange={(e) => setSqft(e.target.value)}
                        placeholder="2500"
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                    <Field label="Workstations (total)">
                      <input
                        type="number"
                        min={0}
                        value={wsCount}
                        onChange={(e) => setWsCount(e.target.value)}
                        placeholder="20"
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                    <Field label="Trucks">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={officeTruckCount}
                        onChange={(e) =>
                          setOfficeTruckCount(
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field label="Desks">
                      <input
                        type="number"
                        min={0}
                        value={officeDesks}
                        onChange={(e) => setOfficeDesks(e.target.value)}
                        placeholder="15"
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                    <Field label="Chairs">
                      <input
                        type="number"
                        min={0}
                        value={officeChairs}
                        onChange={(e) => setOfficeChairs(e.target.value)}
                        placeholder="15"
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                    <Field label="Filing cabinets">
                      <input
                        type="number"
                        min={0}
                        value={officeFiling}
                        onChange={(e) => setOfficeFiling(e.target.value)}
                        placeholder="8"
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                  </div>
                  <Field label="Schedule">
                    <select
                      value={timingPref}
                      onChange={(e) => setTimingPref(e.target.value)}
                      className={`${fieldInput} min-w-0`}
                    >
                      <option value="">Select…</option>
                      {TIMING_PREFS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-[var(--tx3)] mt-0.5">
                      Evening/night applies after-hours multiplier; weekend adds
                      a flat surcharge.
                    </p>
                  </Field>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {[
                      {
                        label: "Server room / IT closet",
                        val: hasIt,
                        set: setHasIt,
                      },
                      { label: "Boardroom(s)", val: hasConf, set: setHasConf },
                      {
                        label: "Kitchen / break room",
                        val: officeKitchen,
                        set: setOfficeKitchen,
                      },
                      {
                        label: "Reception area",
                        val: hasReception,
                        set: setHasReception,
                      },
                    ].map((tog) => (
                      <div key={tog.label} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-[var(--tx)]">
                          {tog.label}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={tog.val}
                          onClick={() => tog.set(!tog.val)}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${tog.val ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${tog.val ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  {hasConf && (
                    <Field label="Boardroom count">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={officeBoardroomCount}
                        onChange={(e) =>
                          setOfficeBoardroomCount(
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        className={`${fieldInput} w-24 min-w-0`}
                      />
                    </Field>
                  )}
                </div>
              )}

              {(serviceType === "local_move" ||
                serviceType === "long_distance") && (
                <div className="col-span-full space-y-3">
                  <MoveScopeSection
                    recommendedTier={recommendedTier}
                    moveSize={moveSize || moveSizeSuggestion?.suggested || "2br"}
                    specialtyItems={specialtyItems}
                    cratingRequired={cratingRequired}
                    addonSlugs={scopeAddonSlugs}
                    extraPickupStopCount={extraPickupStopCount}
                    extraDropoffStopCount={extraDropoffStopCount}
                    moveScopeDaysOverride={moveScopeDaysOverride}
                    onDaysOverrideChange={setMoveScopeDaysOverride}
                    config={config}
                    optionalExtraVolumeDay={moveScopeExtraVolumeDay}
                    onOptionalExtraVolumeDayChange={setMoveScopeExtraVolumeDay}
                    onToggleMultiPickup={handleMoveScopeToggleMultiPickup}
                    onToggleMultiDelivery={handleMoveScopeToggleMultiDelivery}
                  />
                </div>
              )}

              {serviceType === "office_move" && (
                <div className="col-span-full space-y-3">
                  <OfficeMoveScopeSection
                    workstationsTotal={workstationCountN}
                    squareFootageStr={sqft}
                    serverRoom={hasIt}
                    scheduleLabel={timingPref}
                    afterHoursContext={officeTimingAfterHoursHint}
                    extraPickupStopCount={extraPickupStopCount}
                    extraDropoffStopCount={extraDropoffStopCount}
                    daysOverride={officeMoveScopeDaysOverride}
                    onDaysOverrideChange={setOfficeMoveScopeDaysOverride}
                    additionalMoveDay={officeScopeAdditionalMoveDay}
                    onAdditionalMoveDayChange={setOfficeScopeAdditionalMoveDay}
                    config={config}
                    onToggleMultiPickup={handleMoveScopeToggleMultiPickup}
                    onToggleMultiDelivery={handleMoveScopeToggleMultiDelivery}
                  />
                </div>
              )}

              {/* ── Single item fields ── */}
              {serviceType === "single_item" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Items
                  </h3>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--tx)]">
                      Special handling instructions
                    </p>
                    <p className="text-[9px] text-[var(--tx3)] leading-snug">
                      Shown on the client quote and to crew, fragile areas,
                      disassembly, narrow access, orientation, etc.
                    </p>
                    <textarea
                      value={singleItemSpecialHandling}
                      onChange={(e) =>
                        setSingleItemSpecialHandling(e.target.value)
                      }
                      rows={4}
                      placeholder='e.g. Glass top, keep upright; marble base; 32" door clearance; do not lay flat…'
                      className={`${fieldInput} resize-y min-h-[88px]`}
                    />
                  </div>
                  <Field label="Item description *">
                    <input
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="e.g. Leather sectional sofa, Dining table, Queen bed"
                      className={fieldInput}
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <Field label="Category">
                      <select
                        value={itemCategory}
                        onChange={(e) => setItemCategory(e.target.value)}
                        className={`${fieldInput} min-w-0`}
                      >
                        {SINGLE_ITEM_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Weight Class">
                      <select
                        value={itemWeight}
                        onChange={(e) => setItemWeight(e.target.value)}
                        className={`${fieldInput} min-w-0`}
                      >
                        <option value="">Select…</option>
                        {WEIGHT_CLASSES.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Number of Items">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={numItems}
                        onChange={(e) =>
                          setNumItems(Number(e.target.value) || 1)
                        }
                        className={`${fieldInput} w-14 min-w-0`}
                      />
                    </Field>
                    <Field label="Assembly">
                      <select
                        value={assembly}
                        onChange={(e) => setAssembly(e.target.value)}
                        className={`${fieldInput} min-w-0`}
                      >
                        {ASSEMBLY_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase text-[var(--tx3)] shrink-0">
                        Stair Carry
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={stairCarry}
                        onClick={() => setStairCarry(!stairCarry)}
                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${stairCarry ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${stairCarry ? "translate-x-4" : ""}`}
                        />
                      </button>
                      {stairCarry && (
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={stairFlights}
                          onChange={(e) =>
                            setStairFlights(Number(e.target.value) || 1)
                          }
                          className={`${fieldInput} w-12 py-1 min-w-0`}
                          title="Flights"
                        />
                      )}
                    </div>
                  </div>
                  {numItems >= 3 && (
                    <p className="text-[10px] text-[var(--tx3)] mt-1 max-w-md leading-snug">
                      For 3+ items of different types, our{" "}
                      <button
                        type="button"
                        onClick={() => setServiceType("white_glove")}
                        className="font-semibold text-[var(--admin-primary-fill)] underline underline-offset-2 hover:opacity-90"
                      >
                        White Glove service
                      </button>{" "}
                      offers itemized pricing with assembly and premium handling.
                    </p>
                  )}
                </div>
              )}

              {/* ── White glove fields ── */}
              {serviceType === "white_glove" && (
                <div className="space-y-4">
                  <WhiteGloveItemsEditor
                    value={whiteGloveItemRows}
                    onChange={setWhiteGloveItemRows}
                    fieldInputClass={fieldInput}
                    itemWeights={itemWeights}
                    cargoCoverageHint="For insurance purposes. Standard cargo coverage is $100K."
                    declaredValue={declaredValue}
                    onDeclaredValueChange={setDeclaredValue}
                    debrisRemoval={wgDebrisRemoval}
                    onDebrisRemovalChange={setWgDebrisRemoval}
                  />
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Building / access requirements
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {SPECIALTY_BUILDING_REQUIREMENTS.map((req) => {
                        const active = wgBuildingReqs.includes(req.value);
                        return (
                          <button
                            key={req.value}
                            type="button"
                            onClick={() =>
                              setWgBuildingReqs((prev) =>
                                active
                                  ? prev.filter((v) => v !== req.value)
                                  : [...prev, req.value],
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-colors ${
                              active
                                ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                                : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                            }`}
                          >
                            {req.label}
                          </button>
                        );
                      })}
                    </div>
                    {wgBuildingReqs.length > 0 && (
                      <Field label="Building requirements note">
                        <textarea
                          value={wgBuildingNote}
                          onChange={(e) => setWgBuildingNote(e.target.value)}
                          rows={2}
                          placeholder="COI details, dock booking, hours…"
                          className={fieldInput}
                        />
                      </Field>
                    )}
                  </div>
                  <Field label="Delivery instructions">
                    <textarea
                      value={wgDeliveryInstructions}
                      onChange={(e) =>
                        setWgDeliveryInstructions(e.target.value)
                      }
                      rows={3}
                      placeholder="Store pickup coordination, placement, other notes"
                      className={`${fieldInput} resize-y min-h-[72px]`}
                    />
                  </Field>
                </div>
              )}

              {/* ── Specialty fields ── */}
              {serviceType === "specialty" && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Specialty Move
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Specialty Type">
                      <select
                        value={specialtyType}
                        onChange={(e) => setSpecialtyType(e.target.value)}
                        className={`${fieldInput} min-w-0`}
                      >
                        <option value="">Select…</option>
                        {SPECIALTY_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Estimated Weight">
                      <select
                        value={specialtyWeightClass}
                        onChange={(e) =>
                          setSpecialtyWeightClass(e.target.value)
                        }
                        className={`${fieldInput} min-w-0`}
                      >
                        <option value="">Select…</option>
                        {SPECIALTY_WEIGHT_OPTIONS.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Item Description *">
                    <textarea
                      value={specialtyItemDescription}
                      onChange={(e) =>
                        setSpecialtyItemDescription(e.target.value)
                      }
                      rows={3}
                      placeholder="Grand piano, Steinway Model B, approximately 700 lbs. Currently on main floor, needs to go through patio door."
                      className={`${fieldInput} resize-none`}
                      required
                    />
                  </Field>

                  <div>
                    <label className="admin-premium-label admin-premium-label--tight">
                      Item Dimensions (optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={specialtyDimL}
                        onChange={(e) => setSpecialtyDimL(e.target.value)}
                        placeholder="L"
                        className={`${fieldInput} w-16 text-center`}
                      />
                      <span className="text-[var(--tx3)] text-[11px]">×</span>
                      <input
                        type="text"
                        value={specialtyDimW}
                        onChange={(e) => setSpecialtyDimW(e.target.value)}
                        placeholder="W"
                        className={`${fieldInput} w-16 text-center`}
                      />
                      <span className="text-[var(--tx3)] text-[11px]">×</span>
                      <input
                        type="text"
                        value={specialtyDimH}
                        onChange={(e) => setSpecialtyDimH(e.target.value)}
                        placeholder="H"
                        className={`${fieldInput} w-16 text-center`}
                      />
                      <span className="text-[10px] text-[var(--tx3)]">
                        inches
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="admin-premium-label admin-premium-label--tight">
                      Special Requirements
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {SPECIALTY_REQUIREMENTS.map((req) => (
                        <label
                          key={req.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={specialtyRequirements.includes(req.value)}
                            onChange={(e) =>
                              setSpecialtyRequirements((prev) =>
                                e.target.checked
                                  ? [...prev, req.value]
                                  : prev.filter((r) => r !== req.value),
                              )
                            }
                            className="accent-[var(--gold)] w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-[11px] text-[var(--tx2)]">
                            {req.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="admin-premium-label admin-premium-label--tight">
                      Building Requirements
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {SPECIALTY_BUILDING_REQUIREMENTS.map((req) => (
                        <label
                          key={req.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={specialtyBuildingReqs.includes(req.value)}
                            onChange={(e) =>
                              setSpecialtyBuildingReqs((prev) =>
                                e.target.checked
                                  ? [...prev, req.value]
                                  : prev.filter((r) => r !== req.value),
                              )
                            }
                            className="accent-[var(--gold)] w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-[11px] text-[var(--tx2)]">
                            {req.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Field label="Access difficulty">
                    <select
                      value={specialtyAccessDifficulty}
                      onChange={(e) =>
                        setSpecialtyAccessDifficulty(e.target.value)
                      }
                      className={fieldInput}
                    >
                      <option value="">Select…</option>
                      {SPECIALTY_ACCESS_DIFFICULTY.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {specialtyAccessDifficulty ===
                    "requires_rigging_or_crane" ? (
                      <p className="text-[10px] text-amber-700 mt-1.5">
                        Crane/rigging adds $1,500–3,000. Coordinator will
                        confirm exact cost.
                      </p>
                    ) : null}
                  </Field>

                  <Field label="Additional Notes">
                    <textarea
                      value={specialtyNotes}
                      onChange={(e) => setSpecialtyNotes(e.target.value)}
                      rows={2}
                      placeholder="Narrow hallway, 90-degree turn at landing. Building requires certificate of insurance before move day."
                      className={`${fieldInput} resize-none`}
                    />
                  </Field>
                </div>
              )}

              {/* ── Event fields ── */}
              {serviceType === "event" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Event Details
                    </h3>
                    <Field label="Event Name">
                      <input
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        placeholder="e.g. L'Oréal Beauty Event"
                        className={fieldInput}
                      />
                    </Field>
                    <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                      <input
                        type="checkbox"
                        checked={eventLuxury}
                        onChange={(e) => setEventLuxury(e.target.checked)}
                        className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                      />
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--tx)]">
                          Luxury / White glove event
                        </span>
                        <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                          High-value furniture, art, or premium brand events,
                          uses white glove crew rate.
                        </p>
                      </div>
                    </label>
                    {!eventMulti && (
                      <>
                        <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                          <input
                            type="checkbox"
                            checked={eventSameLocationSingle}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setEventSameLocationSingle(on);
                              if (on) setEventReturnRateSingle("80");
                              else if (
                                eventReturnRateSingle === "80" ||
                                eventReturnRateSingle === "85"
                              )
                                setEventReturnRateSingle("auto");
                            }}
                            className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                          />
                          <div>
                            <span className="text-[11px] font-semibold text-[var(--tx)]">
                              Same location, items moved within venue
                            </span>
                            <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                              On-site event: no road transit, no truck
                              surcharge, return day priced at a reduced rate
                              (default 85%).
                            </p>
                          </div>
                        </label>
                        <Field label="Return rate (return day vs delivery day)">
                          <select
                            value={eventReturnRateSingle}
                            onChange={(e) =>
                              setEventReturnRateSingle(
                                e.target.value as typeof eventReturnRateSingle,
                              )
                            }
                            className={fieldInput}
                          >
                            {EVENT_LEG_RETURN_RATE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {eventReturnRateSingle === "custom" ? (
                            <input
                              type="number"
                              min={25}
                              max={100}
                              value={eventReturnRateCustomSingle}
                              onChange={(e) =>
                                setEventReturnRateCustomSingle(e.target.value)
                              }
                              placeholder="% of delivery day"
                              className={`${fieldInput} mt-1 max-w-[200px]`}
                            />
                          ) : null}
                        </Field>
                      </>
                    )}
                    {!eventMulti && !eventSameLocationSingle && (
                      <Field label="Truck type">
                        <select
                          value={eventTruckType}
                          onChange={(e) => setEventTruckType(e.target.value)}
                          className={fieldInput}
                        >
                          {eventTruckOptions.filter(
                            (o) => o.value !== "none",
                          ).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-[var(--tx3)] mt-1">
                          Select 20ft+ for large events with significant
                          inventory.
                        </p>
                      </Field>
                    )}
                    {!eventMulti && eventSameLocationSingle ? (
                      <p className="text-[10px] text-[var(--tx2)] rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]">
                        Truck:{" "}
                        <strong className="text-[var(--tx)]">No truck</strong>,
                        on-site event (no road transit for this program).
                      </p>
                    ) : null}
                    <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                      <input
                        type="checkbox"
                        checked={eventMulti}
                        onChange={(e) => {
                          const on = e.target.checked;
                          if (on) {
                            setEventLegs([
                              {
                                label: "Event 1",
                                from_address: fromAddress,
                                to_address: venueAddress,
                                from_access: fromAccess,
                                to_access: toAccess,
                                move_date: moveDate,
                                event_return_date: eventSameDay
                                  ? moveDate
                                  : eventReturnDate,
                                event_same_day: eventSameDay,
                                event_same_location_onsite: false,
                                event_leg_truck_type: eventTruckType,
                                event_return_rate_preset: "auto",
                                event_return_rate_custom: "",
                              },
                              {
                                label: "Event 2",
                                from_address: "",
                                to_address: "",
                                from_access: fromAccess,
                                to_access: toAccess,
                                move_date: "",
                                event_return_date: "",
                                event_same_day: false,
                                event_same_location_onsite: false,
                                event_leg_truck_type: "sprinter",
                                event_return_rate_preset: "auto",
                                event_return_rate_custom: "",
                              },
                            ]);
                          } else if (eventLegs[0]) {
                            const z = eventLegs[0];
                            setFromAddress(z.from_address);
                            setVenueAddress(z.to_address);
                            setFromAccess(z.from_access);
                            setToAccess(z.to_access);
                            setMoveDate(z.move_date);
                            setEventReturnDate(z.event_return_date);
                            setEventSameDay(z.event_same_day);
                          }
                          setEventMulti(on);
                        }}
                        className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                      />
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--tx)]">
                          Multi-event quote
                        </span>
                        <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                          Bundle 2+ delivery & return pairs (different venues or
                          dates) into one quote and one total.
                        </p>
                      </div>
                    </label>
                  </div>

                  {!eventMulti && (
                    <>
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                          Venue
                        </h3>
                        {eventSameLocationSingle ? (
                          <p className="text-[11px] text-[var(--tx2)] rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                            Venue matches origin, on-site event (no separate
                            venue address).
                          </p>
                        ) : (
                          <MultiStopAddressField
                            label="Venue / Event Address *"
                            placeholder="Restaurant XYZ, 100 King St W"
                            stops={[
                              { address: venueAddress },
                              ...extraVenueStops,
                            ]}
                            onChange={(stops) => {
                              setVenueAddress(stops[0]?.address ?? "");
                              setExtraVenueStops(stops.slice(1));
                            }}
                            inputClassName={fieldInput}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                          Delivery (Day 1)
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Delivery Date *">
                            <input
                              type="date"
                              value={moveDate}
                              onChange={(e) => setMoveDate(e.target.value)}
                              required
                              className={fieldInput}
                            />
                          </Field>
                          <Field label="Delivery Time">
                            <select
                              value={arrivalWindow}
                              onChange={(e) => setArrivalWindow(e.target.value)}
                              className={fieldInput}
                            >
                              {TIME_WINDOW_OPTIONS.map((label) => (
                                <option key={label} value={label}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        {eventLuxury ? (
                          <div className="rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)] space-y-2">
                            <p className="text-[11px] text-[var(--tx)] font-medium">
                              Basic setup and placement: Included with luxury
                              rate.
                            </p>
                            <p className="text-[10px] text-[var(--tx2)]">
                              Add complex setup (staging, signage, assembly) for
                              an additional fee:
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eventComplexSetup}
                                onChange={(e) =>
                                  setEventComplexSetup(e.target.checked)
                                }
                                className="accent-[var(--gold)] w-3.5 h-3.5"
                              />
                              <span className="text-[11px] text-[var(--tx2)]">
                                Complex setup (paid add-on)
                              </span>
                            </label>
                            {eventComplexSetup && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Complex setup duration">
                                  <select
                                    value={eventSetupHours}
                                    onChange={(e) =>
                                      setEventSetupHours(Number(e.target.value))
                                    }
                                    className={`${fieldInput} w-40`}
                                  >
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Setup Instructions">
                                  <textarea
                                    value={eventSetupInstructions}
                                    onChange={(e) =>
                                      setEventSetupInstructions(e.target.value)
                                    }
                                    rows={2}
                                    placeholder="Staging, signage, assembly details…"
                                    className={`${fieldInput} resize-none`}
                                  />
                                </Field>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-medium text-[var(--tx)]">
                                Setup required (paid)
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={eventSetupRequired}
                                onClick={() =>
                                  setEventSetupRequired(!eventSetupRequired)
                                }
                                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${eventSetupRequired ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${eventSetupRequired ? "translate-x-4" : ""}`}
                                />
                              </button>
                            </div>
                            {eventSetupRequired && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Setup Duration">
                                  <select
                                    value={eventSetupHours}
                                    onChange={(e) =>
                                      setEventSetupHours(Number(e.target.value))
                                    }
                                    className={`${fieldInput} w-40`}
                                  >
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Setup Instructions">
                                  <textarea
                                    value={eventSetupInstructions}
                                    onChange={(e) =>
                                      setEventSetupInstructions(e.target.value)
                                    }
                                    rows={2}
                                    placeholder="Arrange display tables, hang banners, etc."
                                    className={`${fieldInput} resize-none`}
                                  />
                                </Field>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                          Return (Day 2+)
                        </h3>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={eventSameDay}
                            onChange={(e) => setEventSameDay(e.target.checked)}
                            className="accent-[var(--gold)] w-3.5 h-3.5"
                          />
                          <span className="text-[11px] text-[var(--tx2)]">
                            Same Day Event, delivery and return on same day
                          </span>
                        </label>
                        {!eventSameDay ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Return Date *">
                              <input
                                type="date"
                                value={eventReturnDate}
                                onChange={(e) =>
                                  setEventReturnDate(e.target.value)
                                }
                                required={!eventSameDay}
                                className={fieldInput}
                              />
                            </Field>
                            <Field label="Return Time">
                              <select
                                value={preferredTime || "morning"}
                                onChange={(e) =>
                                  setPreferredTime(e.target.value)
                                }
                                className={fieldInput}
                              >
                                <option value="morning">
                                  Morning (7 AM – 12 PM)
                                </option>
                                <option value="afternoon">
                                  Afternoon (12 PM – 5 PM)
                                </option>
                                <option value="evening">
                                  Evening (5 PM – 9 PM)
                                </option>
                              </select>
                            </Field>
                          </div>
                        ) : (
                          <Field label="Pickup Time After Event">
                            <select
                              value={eventPickupTimeAfter}
                              onChange={(e) =>
                                setEventPickupTimeAfter(e.target.value)
                              }
                              className={`${fieldInput} w-56`}
                            >
                              <option value="Evening 6–9 PM">
                                Evening 6–9 PM
                              </option>
                              <option value="Evening 8–10 PM">
                                Evening 8–10 PM
                              </option>
                              <option value="After midnight">
                                After midnight
                              </option>
                              <option value="Next morning">Next morning</option>
                            </select>
                          </Field>
                        )}
                      </div>
                    </>
                  )}

                  {eventMulti && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-[11px] text-[var(--tx2)] leading-snug">
                          Each row is one round trip (origin → venue → return).
                          Event items below apply to all legs unless you add
                          per-leg items later.
                        </p>
                        <button
                          type="button"
                          onClick={addEventLeg}
                          className="admin-btn admin-btn-sm admin-btn-secondary shrink-0"
                        >
                          <Plus className="w-3 h-3" aria-hidden /> Add event
                        </button>
                      </div>
                      {eventLegs.map((leg, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-[var(--brd)] p-3 space-y-3 bg-[var(--card)]/30"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--brd)]/50">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">
                              Round trip {idx + 1}
                              {leg.label?.trim() ? (
                                <span className="text-[var(--tx2)] font-semibold normal-case">
                                  , {leg.label.trim()}
                                </span>
                              ) : null}
                            </span>
                            {eventLegs.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeEventLeg(idx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
                                aria-label={`Delete ${leg.label?.trim() || `event ${idx + 1}`}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                                Delete
                              </button>
                            ) : null}
                          </div>
                          <Field label="Label">
                            <input
                              value={leg.label}
                              onChange={(e) =>
                                setEventLegs((prev) =>
                                  prev.map((L, i) =>
                                    i === idx
                                      ? { ...L, label: e.target.value }
                                      : L,
                                  ),
                                )
                              }
                              placeholder={`Event ${idx + 1}`}
                              className={fieldInput}
                            />
                          </Field>
                          <AddressAutocomplete
                            value={leg.from_address}
                            onRawChange={(v) =>
                              setEventLegs((prev) =>
                                prev.map((L, i) =>
                                  i === idx ? { ...L, from_address: v } : L,
                                ),
                              )
                            }
                            onChange={(r) =>
                              setEventLegs((prev) =>
                                prev.map((L, i) =>
                                  i === idx
                                    ? { ...L, from_address: r.fullAddress }
                                    : L,
                                ),
                              )
                            }
                            placeholder="Origin / warehouse"
                            label="Origin *"
                            required
                            className={fieldInput}
                          />
                          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2">
                            <Field label="Origin access">
                              <select
                                value={leg.from_access}
                                onChange={(e) =>
                                  setEventLegs((prev) =>
                                    prev.map((L, i) =>
                                      i === idx
                                        ? { ...L, from_access: e.target.value }
                                        : L,
                                    ),
                                  )
                                }
                                className={fieldInput}
                              >
                                {ACCESS_OPTIONS.map((o) => (
                                  <option
                                    key={o.value || "empty"}
                                    value={o.value}
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Venue access">
                              <select
                                value={leg.to_access}
                                onChange={(e) =>
                                  setEventLegs((prev) =>
                                    prev.map((L, i) =>
                                      i === idx
                                        ? { ...L, to_access: e.target.value }
                                        : L,
                                    ),
                                  )
                                }
                                className={fieldInput}
                              >
                                {ACCESS_OPTIONS.map((o) => (
                                  <option
                                    key={`v-${o.value || "empty"}`}
                                    value={o.value}
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={leg.event_same_location_onsite}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setEventLegs((prev) =>
                                  prev.map((L, i) =>
                                    i === idx
                                      ? {
                                          ...L,
                                          event_same_location_onsite: on,
                                          to_address: on
                                            ? L.from_address
                                            : L.to_address,
                                          event_return_rate_preset: on
                                            ? "80"
                                            : L.event_return_rate_preset ===
                                                  "80" ||
                                                L.event_return_rate_preset ===
                                                  "85"
                                              ? "auto"
                                              : L.event_return_rate_preset,
                                        }
                                      : L,
                                  ),
                                );
                              }}
                              className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                            />
                            <span className="text-[11px] text-[var(--tx2)] leading-snug">
                              Same location, items moved within venue (on-site
                              event)
                            </span>
                          </label>
                          {!leg.event_same_location_onsite ? (
                            <AddressAutocomplete
                              value={leg.to_address}
                              onRawChange={(v) =>
                                setEventLegs((prev) =>
                                  prev.map((L, i) =>
                                    i === idx ? { ...L, to_address: v } : L,
                                  ),
                                )
                              }
                              onChange={(r) =>
                                setEventLegs((prev) =>
                                  prev.map((L, i) =>
                                    i === idx
                                      ? { ...L, to_address: r.fullAddress }
                                      : L,
                                  ),
                                )
                              }
                              placeholder="Venue address"
                              label="Venue *"
                              required
                              className={fieldInput}
                            />
                          ) : (
                            <p className="text-[10px] text-[var(--tx3)] rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]">
                              Venue same as origin, no road transit for this
                              leg.
                            </p>
                          )}
                          {!leg.event_same_location_onsite && (
                            <Field label="Truck (this leg)">
                              <select
                                value={leg.event_leg_truck_type}
                                onChange={(e) =>
                                  setEventLegs((prev) =>
                                    prev.map((L, i) =>
                                      i === idx
                                        ? {
                                            ...L,
                                            event_leg_truck_type:
                                              e.target.value,
                                          }
                                        : L,
                                    ),
                                  )
                                }
                                className={fieldInput}
                              >
                                {eventTruckOptions.filter(
                                  (o) => o.value !== "none",
                                ).map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          )}
                          <Field label="Return rate">
                            <select
                              value={leg.event_return_rate_preset}
                              onChange={(e) =>
                                setEventLegs((prev) =>
                                  prev.map((L, i) =>
                                    i === idx
                                      ? {
                                          ...L,
                                          event_return_rate_preset: e.target
                                            .value as EventLegForm["event_return_rate_preset"],
                                        }
                                      : L,
                                  ),
                                )
                              }
                              className={fieldInput}
                            >
                              {EVENT_LEG_RETURN_RATE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            {leg.event_return_rate_preset === "custom" ? (
                              <input
                                type="number"
                                min={25}
                                max={100}
                                value={leg.event_return_rate_custom}
                                onChange={(e) =>
                                  setEventLegs((prev) =>
                                    prev.map((L, i) =>
                                      i === idx
                                        ? {
                                            ...L,
                                            event_return_rate_custom:
                                              e.target.value,
                                          }
                                        : L,
                                    ),
                                  )
                                }
                                placeholder="% of delivery day"
                                className={`${fieldInput} mt-1 max-w-[200px]`}
                              />
                            ) : null}
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Delivery date *">
                              <input
                                type="date"
                                value={leg.move_date}
                                onChange={(e) =>
                                  setEventLegs((prev) =>
                                    prev.map((L, i) =>
                                      i === idx
                                        ? { ...L, move_date: e.target.value }
                                        : L,
                                    ),
                                  )
                                }
                                className={fieldInput}
                              />
                            </Field>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={leg.event_same_day}
                              onChange={(e) =>
                                setEventLegs((prev) =>
                                  prev.map((L, i) =>
                                    i === idx
                                      ? {
                                          ...L,
                                          event_same_day: e.target.checked,
                                        }
                                      : L,
                                  ),
                                )
                              }
                              className="accent-[var(--gold)] w-3.5 h-3.5"
                            />
                            <span className="text-[11px] text-[var(--tx2)]">
                              Same-day return
                            </span>
                          </label>
                          {!leg.event_same_day ? (
                            <Field label="Return date *">
                              <input
                                type="date"
                                value={leg.event_return_date}
                                onChange={(e) =>
                                  setEventLegs((prev) =>
                                    prev.map((L, i) =>
                                      i === idx
                                        ? {
                                            ...L,
                                            event_return_date: e.target.value,
                                          }
                                        : L,
                                    ),
                                  )
                                }
                                className={fieldInput}
                              />
                            </Field>
                          ) : null}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addEventLeg}
                        className="admin-btn admin-btn-secondary w-full border-dashed"
                      >
                        <Plus className="w-4 h-4" aria-hidden /> Add event
                      </button>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                          Setup (program)
                        </h3>
                        <p className="text-[10px] text-[var(--tx3)]">
                          One setup fee for the bundled program (not per venue).
                        </p>
                        {eventLuxury ? (
                          <div className="rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)] space-y-2">
                            <p className="text-[11px] text-[var(--tx)] font-medium">
                              Basic setup and placement: Included with luxury
                              rate.
                            </p>
                            <p className="text-[10px] text-[var(--tx2)]">
                              Add complex setup (staging, signage, assembly) for
                              an additional fee:
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eventComplexSetup}
                                onChange={(e) =>
                                  setEventComplexSetup(e.target.checked)
                                }
                                className="accent-[var(--gold)] w-3.5 h-3.5"
                              />
                              <span className="text-[11px] text-[var(--tx2)]">
                                Complex setup
                              </span>
                            </label>
                            {eventComplexSetup && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Complex setup duration">
                                  <select
                                    value={eventSetupHours}
                                    onChange={(e) =>
                                      setEventSetupHours(Number(e.target.value))
                                    }
                                    className={`${fieldInput} w-40`}
                                  >
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Instructions">
                                  <textarea
                                    value={eventSetupInstructions}
                                    onChange={(e) =>
                                      setEventSetupInstructions(e.target.value)
                                    }
                                    rows={2}
                                    className={`${fieldInput} resize-none`}
                                  />
                                </Field>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-medium text-[var(--tx)]">
                                Setup required (paid)
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={eventSetupRequired}
                                onClick={() =>
                                  setEventSetupRequired(!eventSetupRequired)
                                }
                                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${eventSetupRequired ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${eventSetupRequired ? "translate-x-4" : ""}`}
                                />
                              </button>
                            </div>
                            {eventSetupRequired && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Setup Duration">
                                  <select
                                    value={eventSetupHours}
                                    onChange={(e) =>
                                      setEventSetupHours(Number(e.target.value))
                                    }
                                    className={`${fieldInput} w-40`}
                                  >
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Setup Instructions">
                                  <textarea
                                    value={eventSetupInstructions}
                                    onChange={(e) =>
                                      setEventSetupInstructions(e.target.value)
                                    }
                                    rows={2}
                                    placeholder="Arrange display tables, hang banners, etc."
                                    className={`${fieldInput} resize-none`}
                                  />
                                </Field>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <Field label="Pickup time after event (same-day legs)">
                        <select
                          value={eventPickupTimeAfter}
                          onChange={(e) =>
                            setEventPickupTimeAfter(e.target.value)
                          }
                          className={`${fieldInput} max-w-xs`}
                        >
                          <option value="Evening 6–9 PM">Evening 6–9 PM</option>
                          <option value="Evening 8–10 PM">
                            Evening 8–10 PM
                          </option>
                          <option value="After midnight">After midnight</option>
                          <option value="Next morning">Next morning</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  <div className="space-y-2 rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Crew & hours
                    </h3>
                    <p className="text-[10px] text-[var(--tx2)] leading-snug">
                      Pricing is hours-based: crew × hours × rate, plus truck,
                      distance, and wrapping surcharges. Override crew or hours
                      when you have a better read than the system estimate.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Crew override (optional)">
                        <input
                          type="number"
                          min={2}
                          max={8}
                          step={1}
                          value={eventCrewOverride}
                          onChange={(e) => setEventCrewOverride(e.target.value)}
                          placeholder="e.g. 3"
                          className={fieldInput}
                        />
                      </Field>
                      <Field label="Billable hours override (optional)">
                        <input
                          type="number"
                          min={0.5}
                          max={24}
                          step={0.5}
                          value={eventHoursOverride}
                          onChange={(e) =>
                            setEventHoursOverride(e.target.value)
                          }
                          placeholder="e.g. 3.5"
                          className={fieldInput}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Event Items */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Event items
                    </h3>
                    <p className="text-[10px] text-[var(--tx2)] leading-snug">
                      Use item type and &ldquo;Needs wrapping&rdquo; so the
                      engine can price light box runs differently from porcelain
                      or AV that needs protection both ways.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {EVENT_QUICK_ADD_PRESETS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() =>
                            setEventItems((prev) => [
                              ...prev,
                              {
                                name: p.name,
                                quantity: 1,
                                weight_category: p.weight_category,
                                item_type: p.item_type,
                                requires_wrapping: p.requires_wrapping,
                                requires_protection: p.requires_wrapping,
                                notes: "",
                              },
                            ])
                          }
                          className={eventQuickAddBtnClass}
                        >
                          <Plus
                            className="w-3 h-3 mr-0.5 shrink-0"
                            aria-hidden
                          />
                          <span className="text-left leading-tight max-w-[11rem]">
                            {p.name}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {eventItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[var(--brd)] p-2.5 space-y-2 bg-[var(--card)]/40"
                        >
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                setEventItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? { ...it, name: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                              placeholder="Description"
                              className={`${fieldInput} flex-1 min-w-0`}
                            />
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                setEventItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          quantity: Number(e.target.value) || 1,
                                        }
                                      : it,
                                  ),
                                )
                              }
                              className="w-16 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-center text-[var(--tx)] shrink-0"
                              aria-label="Quantity"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEventItems((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="text-[var(--tx3)] hover:text-red-400 text-sm shrink-0 self-start sm:self-center"
                              aria-label="Remove item"
                            >
                              ×
                            </button>
                          </div>
                          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2">
                            <Field label="Item type (handling)">
                              <select
                                value={item.item_type || "furniture"}
                                onChange={(e) =>
                                  setEventItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? { ...it, item_type: e.target.value }
                                        : it,
                                    ),
                                  )
                                }
                                className={fieldInput}
                              >
                                {EVENT_ITEM_TYPE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Weight tier">
                              <select
                                value={item.weight_category || "standard"}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEventItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            weight_category: v,
                                            ...(!tierRequiresActualWeight(v)
                                              ? { actual_weight_lbs: undefined }
                                              : {}),
                                          }
                                        : it,
                                    ),
                                  );
                                }}
                                className={fieldInput}
                              >
                                {eventWeightTierOpts.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                    {o.shortHint !== "Base"
                                      ? ` (${o.shortHint})`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          {tierRequiresActualWeight(
                            item.weight_category || "",
                          ) ? (
                            <Field label="Actual weight (lbs)">
                              <input
                                type="number"
                                min={1}
                                placeholder="lbs"
                                value={item.actual_weight_lbs ?? ""}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  setEventItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            actual_weight_lbs:
                                              Number.isFinite(n) && n > 0
                                                ? Math.round(n)
                                                : undefined,
                                          }
                                        : it,
                                    ),
                                  );
                                }}
                                className={fieldInput}
                              />
                            </Field>
                          ) : null}
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.requires_wrapping}
                                onChange={(e) =>
                                  setEventItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            requires_wrapping: e.target.checked,
                                          }
                                        : it,
                                    ),
                                  )
                                }
                                className={`${checkboxAccentClass} w-3.5 h-3.5`}
                              />
                              <span className="text-[11px] text-[var(--tx2)]">
                                Needs wrapping / white-glove handling
                              </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.requires_protection}
                                onChange={(e) =>
                                  setEventItems((prev) =>
                                    prev.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            requires_protection:
                                              e.target.checked,
                                          }
                                        : it,
                                    ),
                                  )
                                }
                                className={`${checkboxAccentClass} w-3.5 h-3.5`}
                              />
                              <span className="text-[11px] text-[var(--tx2)]">
                                Extra protection (pads / vault)
                              </span>
                            </label>
                          </div>
                          <Field label="Notes (optional)">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) =>
                                setEventItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? { ...it, notes: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                              placeholder="Access, dock, client expectations…"
                              className={fieldInput}
                            />
                          </Field>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setEventItems((prev) => [
                            ...prev,
                            {
                              name: "",
                              quantity: 1,
                              weight_category: "standard",
                              item_type: "furniture",
                              requires_wrapping: false,
                              requires_protection: false,
                              notes: "",
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--tx)] hover:underline"
                      >
                        <Plus className="w-3 h-3" aria-hidden /> Add blank row
                      </button>
                    </div>
                  </div>

                  {/* Additional Services */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Additional Services
                    </h3>
                    {[
                      "Furniture assembly at venue",
                      "Signage installation",
                      "Staging and arrangement",
                      "Overnight storage at Yugo facility",
                    ].map((svc) => (
                      <label
                        key={svc}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={eventAdditionalServices.includes(svc)}
                          onChange={(e) =>
                            setEventAdditionalServices((prev) =>
                              e.target.checked
                                ? [...prev, svc]
                                : prev.filter((s) => s !== svc),
                            )
                          }
                          className="accent-[var(--gold)] w-3.5 h-3.5"
                        />
                        <span className="text-[11px] text-[var(--tx2)]">
                          {svc}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2 rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Pricing
                    </h3>
                    <p className="text-[10px] text-[var(--tx2)] leading-snug">
                      After you generate, the card shows the system pre-tax
                      total. Use an override only when the model does not match
                      reality — reasons are stored on the quote for reporting.
                    </p>
                    <Field label="Admin pre-tax override (optional)">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={eventPreTaxOverride}
                        onChange={(e) => setEventPreTaxOverride(e.target.value)}
                        placeholder="e.g. 1100"
                        className={fieldInput}
                      />
                    </Field>
                    <Field label="Override reason (required if overriding)">
                      <textarea
                        value={eventOverrideReason}
                        onChange={(e) => setEventOverrideReason(e.target.value)}
                        rows={2}
                        placeholder="e.g. Negotiated rate for repeat client; matching competitor; similar job was 2.5 hrs"
                        className={`${fieldInput} resize-none`}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Labour Only fields ── */}
              {serviceType === "labour_only" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Labour Only
                  </h3>
                  <div className="max-w-4xl">
                    <MultiStopAddressField
                      label="Work"
                      labelVisibility="sr-only"
                      placeholder="Work address*"
                      stops={[{ address: workAddress }, ...extraWorkStops]}
                      onChange={(stops) => {
                        setWorkAddress(stops[0]?.address ?? "");
                        setExtraWorkStops(stops.slice(1));
                      }}
                      inputClassName={fieldInput}
                      trailingOnFirstRow={
                        <>
                          <label
                            htmlFor="quote-labour-work-access"
                            className="sr-only"
                          >
                            Site access
                          </label>
                          <select
                            id="quote-labour-work-access"
                            value={workAccess}
                            onChange={(e) => setWorkAccess(e.target.value)}
                            className={accessSelectClass}
                            aria-label="Work site access"
                          >
                            {ACCESS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </>
                      }
                    />
                  </div>
                  <Field label="Description of Work *">
                    <textarea
                      value={labourDescription}
                      onChange={(e) => setLabourDescription(e.target.value)}
                      rows={3}
                      placeholder="Rearrange living room furniture, assemble new bookshelf…"
                      className={`${fieldInput} resize-none`}
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Field label="Crew Size">
                      <select
                        value={labourCrewSize}
                        onChange={(e) =>
                          setLabourCrewSize(Number(e.target.value))
                        }
                        className={fieldInput}
                      >
                        <option value={2}>2-Person Crew</option>
                        <option value={3}>3-Person Crew</option>
                        <option value={4}>4-Person Crew</option>
                        <option value={5}>5-Person Crew</option>
                      </select>
                    </Field>
                    <Field label="Estimated Hours">
                      <select
                        value={labourHours}
                        onChange={(e) => setLabourHours(Number(e.target.value))}
                        className={fieldInput}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                          <option key={h} value={h}>
                            {h === 8
                              ? "Full day (8h)"
                              : `${h} hour${h > 1 ? "s" : ""}`}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Truck Required">
                      <select
                        value={labourTruckRequired ? "yes" : "no"}
                        onChange={(e) =>
                          setLabourTruckRequired(e.target.value === "yes")
                        }
                        className={fieldInput}
                      >
                        <option value="no">No truck</option>
                        <option value="yes">Yes, truck needed</option>
                      </select>
                    </Field>
                    <Field label="Number of Visits">
                      <select
                        value={labourVisits}
                        onChange={(e) =>
                          setLabourVisits(Number(e.target.value))
                        }
                        className={fieldInput}
                      >
                        <option value={1}>1 visit</option>
                        <option value={2}>2 visits (return)</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labourWeekend}
                        onChange={(e) => setLabourWeekend(e.target.checked)}
                        className="accent-[var(--admin-primary-fill)] w-3.5 h-3.5"
                      />
                      <span className="text-[11px] text-[var(--tx2)]">
                        Weekend surcharge
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labourAfterHours}
                        onChange={(e) => setLabourAfterHours(e.target.checked)}
                        className="accent-[var(--admin-primary-fill)] w-3.5 h-3.5"
                      />
                      <span className="text-[11px] text-[var(--tx2)]">
                        After-hours multiplier
                      </span>
                    </label>
                  </div>
                  <p className="text-[9px] text-[var(--tx3)]">
                    Weekend can also be inferred from the job date when left
                    unchecked.
                  </p>
                  {labourVisits >= 2 && (
                    <Field label="Second Visit Date">
                      <input
                        type="date"
                        value={labourSecondVisitDate}
                        onChange={(e) =>
                          setLabourSecondVisitDate(e.target.value)
                        }
                        className={`${fieldInput} w-40`}
                      />
                    </Field>
                  )}
                  <div className="rounded-lg border border-[var(--brd)] px-3 py-2.5 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labourStorageNeeded}
                        onChange={(e) =>
                          setLabourStorageNeeded(e.target.checked)
                        }
                        className="accent-[var(--gold)] w-3.5 h-3.5"
                      />
                      <span className="text-[11px] text-[var(--tx2)]">
                        Storage needed between visits?
                      </span>
                    </label>
                    {labourStorageNeeded && (
                      <div className="pl-5 space-y-1">
                        <Field label="Estimated storage duration (weeks)">
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={labourStorageWeeks}
                            onChange={(e) =>
                              setLabourStorageWeeks(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className={`${fieldInput} w-28`}
                          />
                        </Field>
                        <p className="text-[10px] text-[var(--tx3)]">
                          Storage fee on quote uses platform{" "}
                          <code className="text-[9px]">
                            storage_weekly_rate
                          </code>{" "}
                          (default $75/wk) × weeks, coordinator refines volume
                          if needed.
                        </p>
                      </div>
                    )}
                  </div>
                  <Field label="Additional Context (for coordinator)">
                    <textarea
                      value={labourContext}
                      onChange={(e) => setLabourContext(e.target.value)}
                      rows={2}
                      placeholder="Client is renovating kitchen. Moving all kitchen items to garage temporarily…"
                      className={`${fieldInput} resize-none`}
                    />
                  </Field>
                </div>
              )}

              {serviceType === "bin_rental" && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Bundle & pricing
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BIN_BUNDLE_OPTIONS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setBinBundleType(b.value)}
                        className={`text-left px-3 py-2 rounded-lg border transition-all ${
                          binBundleType === b.value
                            ? "border-[var(--gold)] bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]/30"
                            : "border-[var(--brd)] hover:border-[var(--gold)]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-[var(--tx)]">
                            {b.label}
                          </span>
                          {b.popular && (
                            <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--gold)]">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                          {b.detail}
                        </p>
                      </button>
                    ))}
                  </div>
                  {binBundleType === "custom" && (
                    <Field label="Number of bins (min 5)">
                      <input
                        type="number"
                        min={5}
                        value={binCustomCount}
                        onChange={(e) =>
                          setBinCustomCount(
                            Math.max(5, Number(e.target.value) || 5),
                          )
                        }
                        className={`${fieldInput} w-32`}
                      />
                    </Field>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
                      Extra bins
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-[var(--brd)] text-[11px]"
                      onClick={() => setBinExtraBins((n) => Math.max(0, n - 1))}
                    >
                      −
                    </button>
                    <span className="text-[12px] font-mono w-8 text-center">
                      {binExtraBins}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-[var(--brd)] text-[11px]"
                      onClick={() => setBinExtraBins((n) => n + 1)}
                    >
                      +
                    </button>
                    <span className="text-[11px] text-[var(--tx2)]">
                      ×{" "}
                      {fmtPrice(
                        cfgNum(
                          config,
                          "bin_individual_price",
                          cfgNum(config, "bin_rental_individual_price", 6),
                        ),
                      )}{" "}
                      each
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binPackingPaper}
                      onChange={(e) => setBinPackingPaper(e.target.checked)}
                      className="accent-[var(--gold)]"
                    />
                    Packing paper —{" "}
                    {fmtPrice(cfgNum(config, "bin_packing_paper_fee", 20))}
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binMaterialDelivery}
                      onChange={(e) => setBinMaterialDelivery(e.target.checked)}
                      className="accent-[var(--gold)]"
                    />
                    Material delivery charge —{" "}
                    {fmtPrice(cfgNum(config, "bin_delivery_charge", 20))}{" "}
                    <span className="text-[10px] text-[var(--tx3)]">
                      (waived if bins are being delivered with a Yugo move —
                      link move ID or uncheck)
                    </span>
                  </label>
                  <Field label="Linked move ID (optional — waives delivery when set)">
                    <input
                      value={binLinkedMoveId}
                      onChange={(e) => setBinLinkedMoveId(e.target.value)}
                      placeholder="UUID of existing move, if bins ship with a booked move"
                      className={fieldInput}
                    />
                  </Field>
                  <Field label="Internal notes (coordinator)">
                    <textarea
                      value={binInternalNotes}
                      onChange={(e) => setBinInternalNotes(e.target.value)}
                      rows={2}
                      className={`${fieldInput} resize-none`}
                    />
                  </Field>
                  {binLivePreview && (
                    <div className="rounded-lg border border-[var(--brd)] p-3 text-[11px] space-y-1">
                      <p className="font-semibold text-[var(--tx)]">
                        Inventory
                      </p>
                      {quoteResult?.bin_inventory ? (
                        <p className="text-[var(--tx2)]">
                          Available bins: {quoteResult.bin_inventory.available}{" "}
                          of {quoteResult.bin_inventory.total} (
                          {quoteResult.bin_inventory.out_on_rental} currently
                          out on rental)
                        </p>
                      ) : binInventorySnapshot ? (
                        <p className="text-[var(--tx2)]">
                          Available bins: {binInventorySnapshot.available} of{" "}
                          {binInventorySnapshot.total} (
                          {binInventorySnapshot.out} currently out on rental)
                        </p>
                      ) : (
                        <p className="text-[var(--tx2)]">
                          Fleet capacity: {binLivePreview.cap} bins total —
                          generate quote to confirm live availability
                        </p>
                      )}
                      {binDistanceGeoFailed && toAddress.trim().length > 0 && (
                        <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1 text-[10px]">
                          <Warning
                            className="w-3.5 h-3.5 shrink-0 mt-0.5"
                            aria-hidden
                          />
                          Could not determine distance. Coordinator will verify
                          pricing.
                        </p>
                      )}
                      {!binDistanceGeoFailed &&
                        binHubDeliveryKm != null &&
                        binHubPickupKm != null && (
                          <div className="text-[10px] text-[var(--tx2)] space-y-0.5 pt-1">
                            <div className="flex justify-between gap-2">
                              <span className="text-[var(--tx3)]">
                                Delivery distance
                              </span>
                              <span className="tabular-nums">
                                {binHubDeliveryKm.toFixed(1)} km
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-[var(--tx3)]">
                                Pickup distance
                              </span>
                              <span className="tabular-nums">
                                {binHubPickupKm.toFixed(1)} km
                              </span>
                            </div>
                          </div>
                        )}
                      {binLivePreview.error && (
                        <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <Warning
                            className="w-3.5 h-3.5 shrink-0 mt-0.5"
                            aria-hidden
                          />
                          {binLivePreview.error}
                        </p>
                      )}
                      {binLivePreview.available != null &&
                        !binLivePreview.error &&
                        binLivePreview.need > binLivePreview.available && (
                          <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
                            <Warning
                              className="w-3.5 h-3.5 shrink-0 mt-0.5"
                              aria-hidden
                            />
                            Only {binLivePreview.available} bins available.
                            {BIN_RENTAL_BUNDLE_SPECS[
                              binBundleType as keyof typeof BIN_RENTAL_BUNDLE_SPECS
                            ]
                              ? ` This ${BIN_BUNDLE_OPTIONS.find((b) => b.value === binBundleType)?.label ?? ""} bundle needs ${binLivePreview.need}.`
                              : ""}
                          </p>
                        )}
                      {binLivePreview.invOk &&
                        binLivePreview.subtotal != null &&
                        !binLivePreview.error && (
                          <p className="text-[#EDE6DC] flex items-center gap-1">
                            <Check
                              className="w-3.5 h-3.5"
                              weight="bold"
                              aria-hidden
                            />
                            Sufficient inventory
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}

              </>
              )}

              {isB2bEmbed && quoteFlowStep === 1 && (
                <div
                  className={`rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 md:p-6 space-y-4 max-w-[720px]${serviceType === "b2b_delivery" ? " mt-5" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82">
                    B2B delivery (single form)
                  </p>
                  <p className="text-[12px] text-[var(--tx3)] leading-relaxed">
                    Same B2B Jobs form as Deliveries: verticals, dimensional
                    pricing, multi-stop routes, draft / quote / schedule.
                  </p>
                  <B2BJobsDeliveryForm
                    embed
                    verticals={deliveryVerticals}
                    organizations={b2bOrganizations}
                    crews={b2bCrews}
                    onEmbedStateChange={handleB2bEmbedStateChange}
                  />
                </div>
              )}

              {!isB2bEmbed &&
                quoteFlowStep === 3 &&
                !skipsCatalogAddonsQuoteStep && (
              <>
              <div className="pt-5 pb-5" aria-hidden />

              {/* ── 6. Add-ons (popular first, show all expander) ── */}
              {applicableAddons.length > 0 && serviceType !== "bin_rental" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Add-Ons
                  </h3>
                  {recommendedTier === "estate" &&
                    serviceType === "local_move" && (
                      <div className="text-[10px] text-[var(--tx2)] bg-[var(--bg)] rounded-lg px-3 py-2.5 border border-[var(--brd)] space-y-1.5">
                        <p className="font-bold tracking-wide text-[var(--tx)]">
                          {ESTATE_ADDON_UI_LINES[0]}
                        </p>
                        <p className="leading-snug">
                          {ESTATE_ADDON_UI_LINES[1]}
                        </p>
                        <p className="font-semibold text-[var(--tx)] pt-0.5">
                          {ESTATE_ADDON_UI_LINES[2]}
                        </p>
                      </div>
                    )}
                  <div className="space-y-2">
                    {popularAddons.map((addon) => {
                      const sel = selectedAddons.get(addon.id);
                      const isSelected = !!sel;
                      let displayPrice = "";
                      if (addon.price_type === "flat")
                        displayPrice = fmtPrice(addon.price);
                      else if (addon.price_type === "per_unit")
                        displayPrice = `${fmtPrice(addon.price)} ${addon.unit_label ?? "each"}`;
                      else if (addon.price_type === "tiered")
                        displayPrice = "varies";
                      else if (addon.price_type === "percent")
                        displayPrice = `${((addon.percent_value ?? 0) * 100).toFixed(0)}%`;
                      return (
                        <div key={addon.id} className="space-y-1">
                          <label className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAddon(addon)}
                              className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
                                  {addon.name}
                                </span>
                                {addon.is_popular && (
                                  <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                                    Popular
                                  </span>
                                )}
                                <span className="text-[11px] text-[var(--tx3)] ml-auto shrink-0">
                                  {displayPrice}
                                </span>
                              </div>
                              {addon.description && (
                                <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                                  {addon.description}
                                </p>
                              )}
                            </div>
                          </label>
                          {isSelected && addon.price_type === "per_unit" && (
                            <div className="ml-6 flex items-center gap-2">
                              <span className="text-[10px] text-[var(--tx3)]">
                                Qty:
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={sel!.quantity}
                                onChange={(e) =>
                                  updateAddonQty(
                                    addon.id,
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                                className="w-16 text-[11px] bg-[var(--card)] border border-[rgba(250,247,242,0.22)] rounded px-2 py-1 text-[var(--tx)]"
                              />
                              <span className="text-[10px] text-[var(--tx3)]">
                                = {fmtPrice(addon.price * (sel!.quantity || 1))}
                              </span>
                            </div>
                          )}
                          {isSelected &&
                            addon.price_type === "tiered" &&
                            addon.tiers && (
                              <div className="ml-6 flex items-center gap-2">
                                <select
                                  value={sel!.tier_index}
                                  onChange={(e) =>
                                    updateAddonTier(
                                      addon.id,
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="text-[11px] bg-[var(--card)] border border-[rgba(250,247,242,0.22)] rounded px-2 py-1 text-[var(--tx)]"
                                >
                                  {addon.tiers.map((t, i) => (
                                    <option key={i} value={i}>
                                      {t.label}, {fmtPrice(t.price)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                        </div>
                      );
                    })}
                    {otherAddons.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAddons((v) => !v)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gold)] hover:text-[var(--gold2)] transition-colors py-1.5"
                      >
                        {showAllAddons
                          ? "Hide other add-ons"
                          : "Show all add-ons ▾"}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${showAllAddons ? "rotate-90" : ""}`}
                        />
                      </button>
                    )}
                    {showAllAddons &&
                      otherAddons.map((addon) => {
                        const sel = selectedAddons.get(addon.id);
                        const isSelected = !!sel;
                        let displayPrice = "";
                        if (addon.price_type === "flat")
                          displayPrice = fmtPrice(addon.price);
                        else if (addon.price_type === "per_unit")
                          displayPrice = `${fmtPrice(addon.price)} ${addon.unit_label ?? "each"}`;
                        else if (addon.price_type === "tiered")
                          displayPrice = "varies";
                        else if (addon.price_type === "percent")
                          displayPrice = `${((addon.percent_value ?? 0) * 100).toFixed(0)}%`;
                        return (
                          <div key={addon.id} className="space-y-1">
                            <label className="flex items-start gap-2.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAddon(addon)}
                                className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
                                    {addon.name}
                                  </span>
                                  {addon.is_popular && (
                                    <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                                      Popular
                                    </span>
                                  )}
                                  <span className="text-[11px] text-[var(--tx3)] ml-auto shrink-0">
                                    {displayPrice}
                                  </span>
                                </div>
                                {addon.description && (
                                  <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                                    {addon.description}
                                  </p>
                                )}
                              </div>
                            </label>
                            {isSelected && addon.price_type === "per_unit" && (
                              <div className="ml-6 flex items-center gap-2">
                                <span className="text-[10px] text-[var(--tx3)]">
                                  Qty:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={sel!.quantity}
                                  onChange={(e) =>
                                    updateAddonQty(
                                      addon.id,
                                      parseInt(e.target.value) || 1,
                                    )
                                  }
                                  className="w-16 text-[11px] bg-[var(--card)] border border-[rgba(250,247,242,0.22)] rounded px-2 py-1 text-[var(--tx)]"
                                />
                                <span className="text-[10px] text-[var(--tx3)]">
                                  ={" "}
                                  {fmtPrice(addon.price * (sel!.quantity || 1))}
                                </span>
                              </div>
                            )}
                            {isSelected &&
                              addon.price_type === "tiered" &&
                              addon.tiers && (
                                <div className="ml-6 flex items-center gap-2">
                                  <select
                                    value={sel!.tier_index}
                                    onChange={(e) =>
                                      updateAddonTier(
                                        addon.id,
                                        parseInt(e.target.value),
                                      )
                                    }
                                    className="text-[11px] bg-[var(--card)] border border-[rgba(250,247,242,0.22)] rounded px-2 py-1 text-[var(--tx)]"
                                  >
                                    {addon.tiers.map((t, i) => (
                                      <option key={i} value={i}>
                                        {t.label}, {fmtPrice(t.price)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                          </div>
                        );
                      })}
                  </div>
                  <div className="pt-3 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--tx)]">
                      Add-ons total
                    </span>
                    <span className="text-[var(--text-base)] font-bold text-[var(--gold)]">
                      {fmtPrice(addonSubtotal)}
                    </span>
                  </div>
                </div>
              )}

          {serviceType !== "bin_rental" &&
            serviceType !== "b2b_delivery" &&
            serviceType !== "b2b_oneoff" && (
              <div className="px-0 sm:px-0 pb-3 space-y-2 pt-4 mt-2">
                <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                  Coordinator price override (pre-tax)
                </h3>
                <p className="text-[10px] text-[var(--tx3)] leading-snug">
                  Optional. System price is always stored for reporting. Reason
                  is required when an override amount is set.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Field label="Override amount ($)">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={quotePreTaxOverride}
                      onChange={(e) => setQuotePreTaxOverride(e.target.value)}
                      placeholder="Leave blank for engine price"
                      className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                    />
                  </Field>
                  <Field label="Reason (required if overriding)">
                    <input
                      type="text"
                      value={quotePreTaxOverrideReason}
                      onChange={(e) =>
                        setQuotePreTaxOverrideReason(e.target.value)
                      }
                      placeholder="e.g. Competitive match, stairs not in model…"
                      className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                    />
                  </Field>
                </div>
              </div>
            )}

              <div className="h-4" />

              {/* ── Multi-scenario scheduling options ── */}
              {serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff" && (
                <div className="px-0 sm:px-0 pb-3 space-y-3 pt-2 mt-2 border-t border-[var(--brd)]/40">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isMultiScenario}
                      onChange={(e) => setIsMultiScenario(e.target.checked)}
                      className="accent-[var(--admin-primary-fill)] w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Multi-scenario quote
                    </span>
                    <span className="text-[10px] text-[var(--tx3)]">— offer 2+ scheduling options</span>
                  </label>

                  {isMultiScenario && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-[var(--tx3)] leading-snug">
                        Each scenario is a separate date/price option the client picks from. Leave price blank to inherit the generated quote price.
                      </p>
                      {scenarios.map((sc, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                                Scenario {idx + 1}
                              </span>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="scenario_recommended"
                                  checked={sc.is_recommended}
                                  onChange={() => updateScenario(idx, { is_recommended: true })}
                                  className="accent-[var(--admin-primary-fill)]"
                                />
                                <span className="text-[10px] text-[var(--tx3)]">Recommended</span>
                              </label>
                            </div>
                            {scenarios.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setScenarios((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-[10px] text-[var(--tx3)] hover:text-[var(--red)] transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Field label="Label">
                              <input
                                type="text"
                                value={sc.label}
                                onChange={(e) => updateScenario(idx, { label: e.target.value })}
                                placeholder={`Option ${idx + 1}`}
                                className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                              />
                            </Field>
                            <Field label="Date">
                              <input
                                type="date"
                                value={sc.scenario_date}
                                onChange={(e) => updateScenario(idx, { scenario_date: e.target.value })}
                                className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                              />
                            </Field>
                            <Field label="Start time">
                              <input
                                type="time"
                                value={sc.scenario_time}
                                onChange={(e) => updateScenario(idx, { scenario_time: e.target.value })}
                                className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                              />
                            </Field>
                            <Field label="Price override ($, pre-tax)">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={sc.price}
                                onChange={(e) => updateScenario(idx, { price: e.target.value })}
                                placeholder="Leave blank to use generated price"
                                className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                              />
                            </Field>
                          </div>
                          <Field label="Description / conditions (optional)">
                            <input
                              type="text"
                              value={sc.description}
                              onChange={(e) => updateScenario(idx, { description: e.target.value })}
                              placeholder="e.g. Peak weekend rate, includes full packing"
                              className={`${fieldInput} border-b-[rgba(250,247,242,0.42)] focus:border-b-[rgba(250,247,242,0.88)]`}
                            />
                          </Field>
                        </div>
                      ))}
                      {scenarios.length < 4 && (
                        <button
                          type="button"
                          onClick={() => setScenarios((prev) => [...prev, emptyScenario(prev.length + 1)])}
                          className="text-[10px] font-semibold text-[var(--admin-primary-fill)] hover:opacity-80 transition-opacity"
                        >
                          + Add another scenario
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              </>
              )}
            </div>
          </div>

          {/* ── Form actions (document flow — not sticky: sticky bottom-0 overlapped fields while scrolling) ── */}
          <div
            className={
              isV2
                ? "px-4 py-3 sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
                : "py-3 px-4 sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
            }
          >
            {showQuoteFlowNav ? (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:items-stretch">
              <button
                type="button"
                onClick={() => {
                  if (quoteFlowStep === 0) router.back();
                  else handleQuoteFlowBack();
                }}
                className="admin-btn admin-btn-secondary flex-1"
              >
                {quoteFlowStep === 0 ? "Cancel" : "Back"}
              </button>
              <button
                type="button"
                onClick={handleQuoteFlowContinue}
                className="admin-btn admin-btn-primary flex-1"
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" weight="bold" aria-hidden />
              </button>
            </div>
            ) : (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-stretch">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={
                  generating ||
                  serviceType === "b2b_delivery" ||
                  serviceType === "b2b_oneoff"
                }
                className="admin-btn admin-btn-primary admin-btn-lg flex-1"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
                  </>
                ) : serviceType === "b2b_delivery" ||
                  serviceType === "b2b_oneoff" ? (
                  "Use B2B Jobs"
                ) : quoteId ? (
                  "Regenerate"
                ) : (
                  "Generate Quote"
                )}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={
                  sending ||
                  !quoteId ||
                  sendSuccess ||
                  !email?.trim() ||
                  serviceType === "b2b_delivery" ||
                  serviceType === "b2b_oneoff"
                }
                className={`admin-btn admin-btn-lg flex-1 ${
                  sendSuccess
                    ? "border-[var(--grn)] bg-[var(--grn)]/10 text-[var(--grn)] cursor-default"
                    : "admin-btn-secondary"
                }`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
                  </>
                ) : sendSuccess ? (
                  <span className="flex items-center gap-1.5">
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      weight="bold"
                      aria-hidden
                    />
                    Sent
                  </span>
                ) : serviceType === "b2b_delivery" ||
                  serviceType === "b2b_oneoff" ? (
                  "Use B2B Jobs"
                ) : quoteId && !email?.trim() ? (
                  "Add client email"
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> SEND QUOTE
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  quoteResult &&
                  window.open(`/quote/${quoteResult.quote_id}`, "_blank")
                }
                disabled={!quoteResult}
                className="admin-btn admin-btn-lg admin-btn-secondary w-full sm:w-auto sm:shrink-0"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
            )}
          </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL, Live Quote Preview ═══ */}

        {/* Collapsed toggle tab */}
        {!previewOpen && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={
              isV2
                ? "fixed right-0 top-24 z-20 hidden min-[480px]:flex items-center gap-1.5 rounded-l-lg border border-r-0 border-line bg-surface px-2 py-4 text-fg-subtle shadow-lg transition-colors hover:border-accent/40 hover:text-accent"
                : "hidden min-[480px]:flex fixed right-0 top-24 z-20 items-center gap-1.5 px-2 py-4 rounded-l-lg bg-[var(--card)] border border-r-0 border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-colors shadow-lg"
            }
            title="Show preview"
          >
            <PanelRightOpen className="w-4 h-4" />
            <span className="text-[9px] font-bold tracking-wider uppercase [writing-mode:vertical-lr]">
              Preview
            </span>
          </button>
        )}

        <div
          className={`transition-all duration-300 shrink-0 ${previewOpen ? "w-full min-[480px]:w-[40%] min-[480px]:min-w-[240px]" : "hidden min-[480px]:block min-[480px]:w-0 min-[480px]:overflow-hidden min-[480px]:opacity-0 pointer-events-none"}`}
        >
          <div className="sticky top-6 space-y-4">
            <div
              className={
                isV2
                  ? "overflow-hidden rounded-xl border border-line bg-surface"
                  : "bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden"
              }
            >
              <div
                className={
                  isV2
                    ? "flex items-center justify-between border-b border-line px-5 py-3"
                    : "px-5 py-3 border-b border-[var(--brd)] flex items-center justify-between"
                }
              >
                <div>
                  <h2
                    className={
                      isV2
                        ? "text-base font-semibold text-fg"
                        : "admin-section-h2"
                    }
                  >
                    {quoteResult
                      ? `Quote ${quoteResult.quote_id}`
                      : "Live Quote Preview"}
                  </h2>
                  {!quoteResult && (
                    <p
                      className={
                        isV2
                          ? "body-xs text-fg-muted mt-0.5"
                          : "text-[10px] text-[var(--tx2)] mt-0.5"
                      }
                    >
                      Updates as you fill in the form
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className={
                    isV2
                      ? "hidden min-[480px]:flex rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface-subtle hover:text-accent"
                      : "hidden min-[480px]:flex p-1.5 rounded-lg text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--bg)] transition-colors"
                  }
                  title="Collapse preview"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {serviceAreaBlock?.quote_blocked && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-3 text-[11px]">
                    <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Warning
                        size={14}
                        className="shrink-0"
                        weight="bold"
                        aria-hidden
                      />
                      Outside service area
                    </p>
                    <p className="text-[var(--tx2)]">
                      {serviceAreaBlock.message}
                    </p>
                    <p className="text-[10px] text-[var(--tx3)]">
                      Quote generation is paused. Use override only for
                      subcontracting, partner crews, or another confirmed
                      arrangement — not for a standard Toronto-base move.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleGenerate({ serviceAreaOverride: true })
                        }
                        disabled={generating}
                        className="admin-btn admin-btn-sm admin-btn-primary"
                      >
                        Quote anyway (manual override)
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceAreaBlock(null)}
                        className="admin-btn admin-btn-sm admin-btn-secondary"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Multi-scenario preview ── */}
                {isMultiScenario && scenarios.length >= 2 && (
                  <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
                      Scenarios ({scenarios.length})
                    </p>
                    {scenarios.map((sc, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px]">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-[var(--admin-primary-fill)]" />
                        <div className="min-w-0">
                          <span className="font-medium text-[var(--tx)]">{sc.label || `Option ${idx + 1}`}</span>
                          {sc.scenario_date && <span className="text-[var(--tx3)] ml-1.5">· {sc.scenario_date}</span>}
                          {sc.price && <span className="text-[var(--tx2)] ml-1.5">· ${sc.price}</span>}
                          {sc.is_recommended && <span className="ml-1.5 text-[9px] font-semibold text-[var(--admin-primary-fill)] uppercase tracking-wider">Recommended</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Official result (after Generate) ── */}
                {quoteResult ? (
                  <>
                    {quoteResult.tiers ? (
                      <>
                        <TiersDisplay
                          tiers={quoteResult.tiers}
                          recommendedTier={recommendedTier}
                          estateMultiDayUplift={(() => {
                            const f = quoteResult.factors as
                              | Record<string, unknown>
                              | undefined;
                            const u = f?.estate_multi_day_labour_uplift;
                            return typeof u === "number" && u > 0 ? u : 0;
                          })()}
                        />
                        {quoteResult.factors &&
                          serviceType === "local_move" &&
                          typeof (quoteResult.factors as Record<string, unknown>)
                            .building_complexity_surcharge === "number" &&
                          ((quoteResult.factors as Record<string, unknown>)
                            .building_complexity_surcharge as number) > 0 && (
                            <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 mt-2 space-y-1">
                              <div className="flex justify-between text-[11px] text-[var(--tx2)]">
                                <span>Building access complexity (pre-tax)</span>
                                <span className="font-medium text-[var(--tx)]">
                                  {fmtPrice(
                                    (quoteResult.factors as Record<string, unknown>)
                                      .building_complexity_surcharge as number,
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        {quoteResult.factors &&
                          serviceType === "local_move" &&
                          (() => {
                            const fac = quoteResult.factors as Record<
                              string,
                              unknown
                            >;
                            const eff =
                              typeof fac.move_scope_effective_days === "number"
                                ? Number(fac.move_scope_effective_days)
                                : 1;
                            const addonLines = Array.isArray(fac.move_scope_addon_lines)
                              ? (fac.move_scope_addon_lines as {
                                  label?: string;
                                  amount?: number;
                                }[])
                              : [];
                            const clientDayLines = Array.isArray(
                              fac.move_scope_client_day_lines,
                            )
                              ? (fac.move_scope_client_day_lines as string[])
                              : [];
                            if (eff <= 1 && addonLines.length === 0) return null;
                            return (
                            <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 mt-2 space-y-2">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
                                Move duration
                              </p>
                              {typeof fac.move_scope_effective_days === "number" && (
                                <p className="text-[11px] text-[var(--tx)] font-semibold">
                                  {String(fac.move_scope_client_service_label ?? "").trim() ||
                                    `Duration: ${eff} days`}
                                </p>
                              )}
                              {clientDayLines.map((ln, i) => (
                                <p
                                  key={i}
                                  className="text-[10px] text-[var(--tx2)] border-l border-[var(--brd)] pl-2"
                                >
                                  {ln}
                                </p>
                              ))}
                              {(() => {
                                if (!addonLines.length) return null;
                                const total =
                                  typeof fac.move_scope_addon_pre_tax_total ===
                                  "number"
                                    ? Number(fac.move_scope_addon_pre_tax_total)
                                    : addonLines.reduce(
                                        (s, l) => s + Number(l.amount || 0),
                                        0,
                                      );
                                return (
                                  <>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] pt-1 border-t border-[var(--brd)]/50">
                                      Day-rate add-ons (pre-tax)
                                    </p>
                                    {addonLines.map((ln, i) => (
                                      <div
                                        key={`${ln.label}-${i}`}
                                        className="flex justify-between gap-2 text-[10px] text-[var(--tx2)]"
                                      >
                                        <span>{ln.label}</span>
                                        <span className="font-medium text-[var(--tx)] shrink-0">
                                          {fmtPrice(Number(ln.amount || 0))}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between gap-2 text-[10px] font-semibold text-[var(--tx)]">
                                      <span>Scope schedule subtotal</span>
                                      <span>{fmtPrice(total)}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                            );
                          })()}
                        {(serviceType === "local_move" ||
                          serviceType === "long_distance") &&
                          (() => {
                            const br = (quoteResult.factors as
                              | Record<string, unknown>
                              | undefined)?.project_quote_breakdown as
                              | ProjectQuoteBreakdown
                              | undefined;
                            if (!br?.line_items?.length) return null;
                            return (
                              <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 space-y-2 text-[11px]">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
                                  Project estimate (line items)
                                </p>
                                <ul className="space-y-1.5">
                                  {br.line_items.map((ln, i) => (
                                    <li
                                      key={i}
                                      className="flex justify-between gap-2 text-[var(--tx2)]"
                                    >
                                      <span className="min-w-0">
                                        <span className="block font-medium text-[var(--tx)]">
                                          {ln.description}
                                        </span>
                                        {ln.detail ? (
                                          <span className="block text-[10px] text-[var(--tx3)]">
                                            {ln.detail}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="shrink-0 font-medium text-[var(--tx)]">
                                        {fmtPrice(ln.amount)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                <div className="pt-2 border-t border-[var(--brd)]/60 space-y-1">
                                  <div className="flex justify-between text-[var(--tx2)]">
                                    <span>Subtotal (pre-tax)</span>
                                    <span className="font-medium text-[var(--tx)]">
                                      {fmtPrice(br.subtotal_pre_tax)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[var(--tx3)]">
                                    <span>HST</span>
                                    <span>{fmtPrice(br.hst)}</span>
                                  </div>
                                  <div className="flex justify-between font-semibold text-[var(--tx)]">
                                    <span>Total with tax</span>
                                    <span>{fmtPrice(br.total_with_tax)}</span>
                                  </div>
                                  <div className="flex justify-between text-[var(--tx2)]">
                                    <span>Deposit</span>
                                    <span className="font-medium">
                                      {fmtPrice(br.deposit)}
                                    </span>
                                  </div>
                                </div>
                                {br.payment_schedule?.length ? (
                                  <div className="pt-2 border-t border-[var(--brd)]/60">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">
                                      Payment schedule
                                    </p>
                                    <ul className="space-y-1 text-[10px] text-[var(--tx2)]">
                                      {br.payment_schedule.map((m, i) => (
                                        <li
                                          key={i}
                                          className="flex justify-between gap-2"
                                        >
                                          <span>
                                            {m.milestone}
                                            {m.due ? (
                                              <span className="text-[var(--tx3)]">
                                                {" "}
                                                ({m.due})
                                              </span>
                                            ) : null}
                                          </span>
                                          <span className="font-medium text-[var(--tx)]">
                                            {fmtPrice(m.amount)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                      </>
                    ) : quoteResult.custom_price && serviceType === "event" ? (
                      <EventPriceDisplay
                        price={quoteResult.custom_price}
                        factors={quoteResult.factors as Record<string, unknown>}
                      />
                    ) : quoteResult.custom_price &&
                      serviceType === "bin_rental" ? (
                      <BinRentalPriceDisplay
                        price={quoteResult.custom_price}
                        factors={quoteResult.factors as Record<string, unknown>}
                      />
                    ) : quoteResult.custom_price &&
                      serviceType === "labour_only" ? (
                      <LabourOnlyPriceDisplay
                        price={quoteResult.custom_price}
                        factors={quoteResult.factors as Record<string, unknown>}
                      />
                    ) : quoteResult.custom_price &&
                      (serviceType === "b2b_delivery" ||
                        serviceType === "b2b_oneoff") ? (
                      <B2BPriceDisplay
                        price={quoteResult.custom_price}
                        factors={quoteResult.factors as Record<string, unknown>}
                      />
                    ) : quoteResult.custom_price ? (
                      <SinglePriceDisplay
                        price={quoteResult.custom_price}
                        label={toTitleCase(serviceType)}
                      />
                    ) : null}

                    {quoteResult.factors &&
                      typeof (quoteResult.factors as Record<string, unknown>)
                        .system_price === "number" &&
                      typeof (quoteResult.factors as Record<string, unknown>)
                        .override_price_pre_tax === "number" && (
                        <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 space-y-1 text-[11px]">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
                            Pricing override
                          </p>
                          <div className="flex justify-between gap-2 text-[var(--tx2)]">
                            <span>System (engine)</span>
                            <span className="font-medium text-[var(--tx)]">
                              {fmtPrice(
                                (quoteResult.factors as Record<string, unknown>)
                                  .system_price as number,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2 text-[var(--tx2)]">
                            <span>Override (pre-tax)</span>
                            <span className="font-medium text-[var(--tx)]">
                              {fmtPrice(
                                (quoteResult.factors as Record<string, unknown>)
                                  .override_price_pre_tax as number,
                              )}
                            </span>
                          </div>
                          {(quoteResult.factors as Record<string, unknown>)
                            .override_reason ? (
                            <p className="text-[10px] text-[var(--tx3)] pt-1 border-t border-[var(--brd)]/50">
                              {
                                (quoteResult.factors as Record<string, unknown>)
                                  .override_reason as string
                              }
                            </p>
                          ) : null}
                        </div>
                      )}

                    {quoteResult.addons &&
                      quoteResult.addons.items.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                            Add-Ons
                          </h4>
                          {quoteResult.addons.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span className="text-[var(--tx2)]">
                                {item.name}
                              </span>
                              <span className="text-[var(--tx)] font-medium">
                                {fmtPrice(item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    {quoteResult.factors &&
                      serviceType === "local_move" &&
                      recommendedTier === "estate" &&
                      (() => {
                        const f = quoteResult.factors as Record<
                          string,
                          unknown
                        >;
                        const plan = f.estate_day_plan as
                          | { days?: number }
                          | undefined;
                        const lines = f.estate_schedule_lines as
                          | string[]
                          | undefined;
                        const head = f.estate_schedule_headline as
                          | string
                          | undefined;
                        if (!plan || (plan.days ?? 0) <= 1 || !lines?.length)
                          return null;
                        return (
                          <div className="rounded-xl border border-[var(--tx)]/[0.08] bg-[#F9F9F8] dark:bg-white/[0.04] dark:border-white/[0.08] p-3.5 space-y-2 text-[11px] text-[var(--tx2)]">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--tx3)]">
                              Estate schedule
                            </p>
                            <p className="text-[var(--tx)] font-medium leading-snug">
                              {head}
                            </p>
                            <div className="space-y-2">
                              {lines.map((ln, i) => (
                                <p
                                  key={i}
                                  className="leading-relaxed pl-2.5 border-l-2 border-[var(--gold)]/40 text-[var(--tx2)]"
                                >
                                  {ln}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                    <FactorsDisplayCollapsible
                      factors={quoteResult.factors}
                      distance={quoteResult.distance_km}
                      time={quoteResult.drive_time_min}
                      showMultipliers={
                        userRole === "owner" || userRole === "admin"
                      }
                      tiers={quoteResult.tiers}
                      moveSize={moveSize}
                    />

                    {/* FIX 6: Algorithm anomaly warnings for coordinator review */}
                    {quoteResult.factors &&
                      quoteResult.factors.deadhead_capped === true && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5 text-[11px] text-[var(--tx2)]">
                          <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <Warning
                              size={12}
                              className="shrink-0"
                              weight="bold"
                              aria-hidden
                            />
                            Deadhead distance capped
                          </p>
                          <p>
                            Pickup is{" "}
                            <span className="font-medium text-[var(--tx)]">
                              {Number(
                                quoteResult.factors.deadhead_km_actual ?? 0,
                              ).toLocaleString()}
                            </span>{" "}
                            km from base. Surcharge uses a cap of{" "}
                            <span className="font-medium text-[var(--tx)]">
                              {Number(
                                quoteResult.factors.deadhead_cap_km ?? 100,
                              )}
                            </span>{" "}
                            km. Manual pricing review recommended.
                          </p>
                        </div>
                      )}

                    {(quoteResult.inventory_warnings?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5 text-[11px]">
                        <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Warning
                            size={12}
                            className="text-amber-600 dark:text-amber-400 shrink-0"
                            aria-hidden
                          />
                          Check inventory quantities
                        </p>
                        <ul className="list-disc list-inside text-[var(--tx2)]">
                          {quoteResult.inventory_warnings!.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {quoteResult.factors &&
                      typeof quoteResult.factors.inventory_modifier ===
                        "number" &&
                      typeof quoteResult.factors.inventory_max_modifier ===
                        "number" &&
                      quoteResult.factors.inventory_modifier >=
                        quoteResult.factors.inventory_max_modifier && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-[var(--tx2)]">
                          <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                            <Info
                              size={14}
                              className="shrink-0 text-blue-500"
                              weight="bold"
                              aria-hidden
                            />
                            Inventory at volume ceiling (×
                            {Number(
                              quoteResult.factors.inventory_max_modifier,
                            ).toFixed(2)}
                            )
                          </p>
                          <p className="mt-0.5">
                            Price is capped, consider manual adjustment for this
                            move.
                          </p>
                        </div>
                      )}
                    {quoteResult.factors &&
                      typeof quoteResult.factors.labour_component ===
                        "number" &&
                      typeof quoteResult.factors.subtotal_before_labour ===
                        "number" &&
                      (quoteResult.factors.subtotal_before_labour as number) >
                        0 &&
                      (quoteResult.factors.labour_component as number) >
                        0.5 *
                          (quoteResult.factors
                            .subtotal_before_labour as number) && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-[var(--tx2)]">
                          <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                            <Info
                              size={14}
                              className="shrink-0 text-blue-500"
                              weight="bold"
                              aria-hidden
                            />
                            High labour component:{" "}
                            {fmtPrice(
                              quoteResult.factors.labour_component as number,
                            )}
                          </p>
                          <p className="mt-0.5">
                            This move needs significantly more crew/time than
                            standard.
                          </p>
                        </div>
                      )}
                  </>
                ) : (
                  /* ── Optimistic live preview ── */
                  <>
                    {liveEstimate && "essential" in liveEstimate ? (
                      <>
                        <OptimisticTiers
                          est={liveEstimate}
                          isLongDistance={serviceType === "long_distance"}
                        />
                        {/* Coordinator preview: assembly contribution to labour estimate */}
                        {(serviceType === "local_move" || serviceType === "long_distance") &&
                          inventoryItems.length > 0 &&
                          itemWeights.length > 0 &&
                          effectiveAssemblyRequired && (
                            <AssemblyLabourPreview
                              minutes={
                                calcAssemblyMinutes(inventoryItems, itemWeights).totalMinutes
                              }
                              itemCount={
                                assemblyDetection.itemsRequiringAssembly.length
                              }
                            />
                          )}
                      </>
                    ) : (serviceType === "local_move" ||
                        serviceType === "long_distance") &&
                      !liveEstimate ? (
                      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4 text-[11px] text-[var(--tx)]">
                        <p className="flex items-start gap-2">
                          <Info
                            className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5"
                            aria-hidden
                          />
                          <span className="leading-snug">
                            Select move size or add inventory to see a rough
                            tier preview. Generate quote for exact pricing.
                          </span>
                        </p>
                      </div>
                    ) : serviceType === "bin_rental" &&
                      binLivePreview &&
                      binLivePreview.subtotal != null &&
                      !binLivePreview.error ? (
                      <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 space-y-2">
                        <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                          Bin rental (estimate)
                        </p>
                        {binLivePreview.lines.map((l, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-[11px]"
                          >
                            <span className="text-[var(--tx2)]">{l.label}</span>
                            <span className="text-[var(--tx)] font-medium">
                              {fmtPrice(l.amount)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                          <span className="text-[var(--tx3)]">Subtotal</span>
                          <span className="font-semibold">
                            {fmtPrice(binLivePreview.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--tx3)]">HST</span>
                          <span>{fmtPrice(binLivePreview.tax ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-[12px] font-bold">
                          <span>Total</span>
                          <span className="text-[var(--gold)]">
                            {fmtPrice(binLivePreview.total ?? 0)}
                          </span>
                        </div>
                        <p className="text-[9px] text-[var(--tx3)]">
                          Generate for live inventory and final totals.
                        </p>
                      </div>
                    ) : (serviceType === "b2b_delivery" ||
                        serviceType === "b2b_oneoff") &&
                      b2bDimensionalPreview ? (
                      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)]/80 p-4 space-y-2">
                        {b2bHasExtremeWeight ? (
                          <div className="p-3 border border-amber-500/50 bg-amber-500/10 dark:bg-amber-900/20 rounded-lg">
                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                              <Warning
                                className="w-3.5 h-3.5 shrink-0"
                                aria-hidden
                              />
                              Admin review recommended
                            </p>
                            <p className="text-[10px] text-amber-800/90 dark:text-amber-200/90 mt-1 leading-snug">
                              This quote includes at least one item over 800 lbs
                              (extreme tier). Verify crew, equipment (lift gate,
                              hydraulic lift, or crane), and pricing before
                              sending.
                            </p>
                          </div>
                        ) : null}
                        <p className="text-[11px] font-bold tracking-wide text-[var(--gold)]">
                          {b2bLivePreviewTitle}
                        </p>
                        <p className="text-[10px] text-[var(--tx2)] uppercase tracking-wide">
                          {b2bPreviewDistanceKm != null
                            ? `${b2bPreviewDistanceKm} Km · ~${b2bPreviewDriveMin ?? "—"} Min Drive`
                            : b2bPreviewDistanceLabel}
                        </p>
                        <p className="text-[10px] text-[var(--tx3)] flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Truck: {b2bDimensionalPreview.dim.truck}</span>
                          <span>
                            Crew: {String(b2bDimensionalPreview.dim.crew)}
                          </span>
                          <span>
                            Est. hours:{" "}
                            {String(b2bDimensionalPreview.dim.estimatedHours)}
                          </span>
                        </p>
                        {b2bDeliveryKmFromGta != null ? (
                          <p className="text-[10px] text-[var(--tx3)]">
                            {b2bDeliveryKmFromGta.toFixed(1)} Km From GTA Core
                            (Straight-Line).
                          </p>
                        ) : null}
                        {effectiveB2bLinesPreview.some((l) =>
                          l.description.trim(),
                        ) ? (
                          <ul className="text-[11px] text-[var(--tx2)] space-y-0.5 list-disc pl-4">
                            {effectiveB2bLinesPreview
                              .filter((l) => l.description.trim() && l.qty >= 1)
                              .map((l, i) => (
                                <li key={i}>
                                  {l.qty}× {l.description.trim()}
                                </li>
                              ))}
                          </ul>
                        ) : null}
                        {!b2bDimensionalPreview.hasRealItems ? (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                            <Warning
                              className="w-3.5 h-3.5 shrink-0 mt-0.5"
                              aria-hidden
                            />
                            Add Line Items To Include Unit Pricing In This
                            Preview.
                          </p>
                        ) : null}
                        {b2bDimensionalPreview.dim.breakdown
                          .filter((l) => l.amount !== 0)
                          .map((l, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-[11px] gap-2"
                            >
                              <span className="text-[var(--tx2)] min-w-0 break-words pr-2">
                                {l.label}
                              </span>
                              <span className="text-[var(--tx)] font-medium shrink-0">
                                {fmtPrice(l.amount)}
                              </span>
                            </div>
                          ))}
                        {b2bDimensionalPreview.access > 0 &&
                        !b2bDimensionalPreview.fullOverrideApplied ? (
                          <div className="flex justify-between text-[11px] gap-2">
                            <span className="text-[var(--tx2)]">
                              Access Surcharge
                            </span>
                            <span className="text-[var(--tx)] font-medium shrink-0">
                              {fmtPrice(b2bDimensionalPreview.access)}
                            </span>
                          </div>
                        ) : null}
                        {addonSubtotal > 0 &&
                        !b2bDimensionalPreview.fullOverrideApplied ? (
                          <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                            <span className="text-[var(--tx3)]">
                              Add-Ons (Selected)
                            </span>
                            <span className="text-[var(--tx)] font-medium">
                              {fmtPrice(addonSubtotal)}
                            </span>
                          </div>
                        ) : null}
                        {b2bDimensionalPreview.fullOverrideApplied ? (
                          <div className="pt-1 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">
                              Price Override:{" "}
                              {fmtPrice(b2bDimensionalPreview.preTaxTotal)}
                            </p>
                            {b2bDimensionalPreview.overrideReason ? (
                              <p className="text-[9px] text-[var(--tx3)]">
                                {b2bDimensionalPreview.overrideReason}
                              </p>
                            ) : null}
                            <p className="text-[10px] text-[var(--tx3)] line-through">
                              Calculated Pre-Tax:{" "}
                              {fmtPrice(
                                b2bDimensionalPreview.calculatedPreTaxBeforeOverride ??
                                  b2bDimensionalPreview.engineSubtotal,
                              )}
                            </p>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                          <span className="text-[var(--tx3)]">
                            Subtotal (Pre-Tax)
                          </span>
                          <span className="font-semibold">
                            {fmtPrice(b2bDimensionalPreview.preTaxTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--tx3)]">HST</span>
                          <span>{fmtPrice(b2bDimensionalPreview.tax)}</span>
                        </div>
                        <div className="flex justify-between text-[12px] font-bold text-[var(--tx)]">
                          <span>Total</span>
                          <span className="tabular-nums">
                            {fmtPrice(b2bDimensionalPreview.total)}
                          </span>
                        </div>
                        <p className="text-[9px] text-[var(--tx3)] leading-snug">
                          Generate For Server Pricing, Partner Rates, And Final
                          Breakdown.
                        </p>
                      </div>
                    ) : serviceType === "b2b_delivery" ||
                      serviceType === "b2b_oneoff" ? (
                      <div className="rounded-xl border border-[var(--brd)]/60 bg-[var(--card)]/40 p-4 text-[11px] text-[var(--tx2)]">
                        <p className="flex items-start gap-2">
                          <Info
                            className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5"
                            aria-hidden
                          />
                          <span>
                            Add active delivery verticals under Platform
                            settings to enable live B2B pricing preview.
                          </span>
                        </p>
                      </div>
                    ) : specialtyLivePreview ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3">
                          <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">
                            Suggested Range
                          </p>
                          <p className="text-[18px] font-bold text-[var(--gold)]">
                            {fmtPrice(specialtyLivePreview.min)} –{" "}
                            {fmtPrice(specialtyLivePreview.max)}
                          </p>
                          <p className="text-[10px] text-[var(--tx3)] mt-1 leading-snug">
                            Based on: {specialtyLivePreview.typeLabel}
                            {specialtyLivePreview.weightLabel
                              ? `, ${specialtyLivePreview.weightLabel}`
                              : ""}
                            {specialtyRouteKm != null
                              ? `, ${specialtyRouteKm} km route`
                              : specialtyRouteLoading
                                ? ", calculating distance…"
                                : ", add addresses for distance adjustment"}
                            {specialtyLivePreview.distSur > 0
                              ? ` (+${fmtPrice(specialtyLivePreview.distSur)} distance)`
                              : ""}
                            {specialtyRequirements.includes("crane_rigging")
                              ? " + crane/rigging"
                              : ""}
                            {specialtyRequirements.includes(
                              "climate_controlled",
                            )
                              ? " + climate"
                              : ""}
                            {cratingRequired && cratingItems.length > 0
                              ? " + crating"
                              : ""}
                          </p>
                        </div>
                        <p className="text-[9px] text-[var(--tx3)] leading-snug">
                          Click Generate for the final priced quote (includes
                          timeline and server pricing rules).
                        </p>
                      </div>
                    ) : whiteGloveLivePreview ? (
                      <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 space-y-2">
                        <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                          White glove delivery (estimate)
                        </p>
                        <p className="text-[10px] text-[var(--tx2)]">
                          {whiteGloveLivePreview.distKm != null
                            ? `${whiteGloveLivePreview.distKm} km route`
                            : whiteGloveLivePreview.distLoading
                              ? "Calculating distance…"
                              : "Add addresses for distance adjustment"}
                        </p>
                        <p className="text-[10px] text-[var(--tx2)]">
                          Suggested crew / hours (estimate):{" "}
                          <span className="font-medium text-[var(--tx)]">
                            {whiteGloveLivePreview.crew} movers ·{" "}
                            {whiteGloveLivePreview.hours} hr
                          </span>
                        </p>
                        {whiteGloveLivePreview.bd.itemLines.length > 0 ? (
                          <ul className="text-[11px] text-[var(--tx2)] space-y-0.5 list-disc pl-4">
                            {whiteGloveLivePreview.bd.itemLines.map(
                              (ln, i) => (
                                <li key={i}>
                                  {ln.quantity}× {ln.description}
                                  {ln.assemblyAmount > 0
                                    ? ` (${ln.assemblyNote ?? "assembly"})`
                                    : ""}
                                </li>
                              ),
                            )}
                          </ul>
                        ) : null}
                        {[
                          {
                            label: "Item handling (minimum may apply)",
                            amount: whiteGloveLivePreview.bd.itemsOrMinimum,
                          },
                          {
                            label: "Assembly / disassembly",
                            amount: whiteGloveLivePreview.bd.assemblyTotal,
                          },
                          {
                            label: "Parking and access",
                            amount: whiteGloveLivePreview.bd.accessTotal,
                          },
                          {
                            label: "Distance",
                            amount: whiteGloveLivePreview.bd.distanceSurcharge,
                          },
                          {
                            label: "Debris removal",
                            amount: whiteGloveLivePreview.bd.debrisFee,
                          },
                          {
                            label: "Declared value premium",
                            amount:
                              whiteGloveLivePreview.bd.declaredValuePremium,
                          },
                          {
                            label: "Guaranteed window",
                            amount:
                              whiteGloveLivePreview.bd.guaranteedWindowFee,
                          },
                          {
                            label: "Truck",
                            amount: whiteGloveLivePreview.bd.truckSurcharge,
                          },
                        ]
                          .filter((row) => row.amount > 0)
                          .map((row, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-[11px] gap-2"
                            >
                              <span className="text-[var(--tx2)] min-w-0 break-words pr-2">
                                {row.label}
                              </span>
                              <span className="text-[var(--tx)] font-medium shrink-0">
                                {fmtPrice(row.amount)}
                              </span>
                            </div>
                          ))}
                        <p className="text-[9px] text-[var(--tx3)] leading-snug pt-1">
                          Stairs surcharges on the quote use server rules.
                          Generate for final pricing.
                        </p>
                        <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                          <span className="text-[var(--tx3)]">
                            Subtotal (pre-tax)
                          </span>
                          <span className="font-semibold">
                            {fmtPrice(whiteGloveLivePreview.bd.subtotalPreTax)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--tx3)]">HST</span>
                          <span>
                            {fmtPrice(whiteGloveLivePreview.tax ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[12px] font-bold">
                          <span>Total</span>
                          <span className="text-[var(--gold)]">
                            {fmtPrice(whiteGloveLivePreview.total ?? 0)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-2">
                          <ChevronDown className="w-4 h-4 text-[var(--tx3)]" />
                        </div>
                        <p className="text-[11px] text-[var(--tx3)]">
                          Fill in the form to see a live estimate
                        </p>
                      </div>
                    )}

                    {addonSubtotal > 0 && serviceType !== "b2b_delivery" && (
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--brd)]">
                        <span className="text-[var(--tx3)]">Add-ons</span>
                        <span className="text-[var(--tx)] font-medium">
                          +{fmtPrice(addonSubtotal)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Quote metadata ── */}
            {quoteResult && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Quote ID</span>
                  <span className="font-mono font-bold text-[var(--tx)]">
                    {quoteResult.quote_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Expires</span>
                  <ExpiryLabel expiresAt={quoteResult.expires_at} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Distance</span>
                  <span className="text-[var(--tx)]">
                    {quoteResult.service_type === "event" &&
                    typeof quoteResult.factors?.event_distance_summary ===
                      "string" &&
                    quoteResult.factors.event_distance_summary.trim()
                      ? String(quoteResult.factors.event_distance_summary)
                      : quoteResult.distance_km
                        ? `${quoteResult.distance_km} km`
                        : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Drive Time</span>
                  <span className="text-[var(--tx)]">
                    {quoteResult.drive_time_min
                      ? `${quoteResult.drive_time_min} min`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">
                    {quoteDetailDateLabel(serviceType)}
                  </span>
                  <span className="text-[var(--tx)]">
                    {quoteResult.move_date || "-"}
                  </span>
                </div>
                {quoteResult.service_type === "white_glove" &&
                  Array.isArray(
                    (quoteResult.factors as Record<string, unknown> | null)
                      ?.white_glove_items,
                  ) &&
                  (
                    (quoteResult.factors as Record<string, unknown>)
                      .white_glove_items as unknown[]
                  ).length > 0 && (
                    <div className="pt-2 border-t border-[var(--brd)]/50">
                      <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">
                        Quoted items
                      </p>
                      <ol className="space-y-2 list-decimal pl-4 text-[10px] text-[var(--tx)]">
                        {(
                          (quoteResult.factors as Record<string, unknown>)
                            .white_glove_items as Array<Record<string, unknown>>
                        ).flatMap((row, idx) => {
                          const desc = String(row.description ?? "").trim();
                          if (!desc) return [];
                          const qty = Math.max(
                            1,
                            Math.min(99, Number(row.quantity) || 1),
                          );
                          const flags: string[] = [];
                          if (row.is_fragile === true) flags.push("Fragile");
                          if (row.is_high_value === true)
                            flags.push("High value");
                          const asmRaw = String(row.assembly ?? "none");
                          if (
                            asmRaw &&
                            asmRaw !== "none" &&
                            asmRaw.toLowerCase() !== "none"
                          ) {
                            flags.push("Assembly");
                          }
                          return [
                            <li key={`${idx}-${desc.slice(0, 24)}`}>
                              <span className="font-medium">
                                {qty}× {desc}
                              </span>
                              {flags.length > 0 ? (
                                <span className="text-[var(--tx3)]">
                                  {" "}
                                  ({flags.join(", ")})
                                </span>
                              ) : null}
                            </li>,
                          ];
                        })}
                      </ol>
                    </div>
                  )}
                {(serviceType === "local_move" ||
                  serviceType === "long_distance" ||
                  serviceType === "white_glove") && (
                  <div className="pt-2 border-t border-[var(--brd)]/50 space-y-2">
                    <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                      Route preview
                    </p>
                    {(() => {
                      const fac = quoteResult.factors as
                        | Record<string, unknown>
                        | null
                        | undefined;
                      const pickups = abbreviateLocationRows(
                        pickupLocationsFromQuote(
                          fac ?? null,
                          fromAddress,
                          fromAccess,
                        ),
                      );
                      const dropoffs = abbreviateLocationRows(
                        dropoffLocationsFromQuote(
                          fac ?? null,
                          toAddress,
                          toAccess,
                        ),
                      );
                      return (
                        <>
                          <div>
                            <p className="text-[9px] font-semibold text-[var(--tx3)] mb-1">
                              Pickup
                              {pickups.length > 1
                                ? ` locations (${pickups.length})`
                                : ""}
                            </p>
                            <ul className="space-y-1.5">
                              {pickups.map((row, i) => (
                                <li
                                  key={i}
                                  className="flex gap-2 text-[10px] text-[var(--tx)]"
                                >
                                  <MapPin
                                    className="w-3.5 h-3.5 shrink-0 text-[var(--gold)] mt-0.5"
                                    aria-hidden
                                  />
                                  <span>
                                    {formatAddressForDisplay(row.address)}
                                    {accessLabel(row.access) ? (
                                      <span className="block text-[var(--tx3)] mt-0.5">
                                        Access: {accessLabel(row.access)}
                                      </span>
                                    ) : null}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {pickups.length > 1 && (
                              <p className="text-[9px] text-[var(--tx3)] mt-1">
                                {pickups.length} pickup locations — crew will
                                visit each stop.
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-[var(--tx3)] mb-1">
                              Destination
                            </p>
                            <ul className="space-y-1.5">
                              {dropoffs.map((row, i) => (
                                <li
                                  key={i}
                                  className="flex gap-2 text-[10px] text-[var(--tx)]"
                                >
                                  <MapPin
                                    className="w-3.5 h-3.5 shrink-0 text-[var(--gold)] mt-0.5"
                                    aria-hidden
                                  />
                                  <span>
                                    {formatAddressForDisplay(row.address)}
                                    {accessLabel(row.access) ? (
                                      <span className="block text-[var(--tx3)] mt-0.5">
                                        Access: {accessLabel(row.access)}
                                      </span>
                                    ) : null}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                {quoteResult.service_type === "event" &&
                  (quoteResult.factors?.event_same_location_onsite === true ||
                    quoteResult.factors?.event_has_on_site_leg === true) && (
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Event type</span>
                      <span className="text-[var(--tx)] font-medium">
                        On-site Event
                      </span>
                    </div>
                  )}
                {hubspotDealId && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">HubSpot Deal</span>
                    <span className="font-mono text-[var(--tx)]">
                      #{hubspotDealId}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Labour estimate (coordinator-only) ── */}
            {quoteResult?.labour && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2.5 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                  Labour Estimate
                </h4>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="text-[var(--tx)]">
                    {quoteResult.labour.crewSize}-person crew{" "}
                    <span className="text-[var(--tx3)]">(recommended)</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="text-[var(--tx)]">
                    {quoteResult.labour.hoursRange}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="text-[var(--tx)]">
                    1 × {quoteResult.labour.truckSize}
                  </span>
                </div>
                {quoteResult.inventory &&
                  (quoteResult.inventory.modifier !== 1.0 ||
                    (quoteResult.inventory.boxCount ?? 0) > 0) && (
                    <div className="pt-2 border-t border-[var(--brd)]/50 flex items-center justify-between text-[10px]">
                      <span className="text-[var(--tx3)]">
                        Inventory volume
                        <span className="ml-1 text-[var(--tx)]">
                          ({quoteResult.inventory.totalItems} items
                          {(quoteResult.inventory.boxCount ?? 0) > 0 &&
                            ` + ${quoteResult.inventory.boxCount} boxes`}
                          {quoteResult.inventory.modifier !== 1.0 &&
                            `, ${quoteResult.inventory.modifier < 1 ? "below" : "above"} standard`}
                          )
                        </span>
                      </span>
                      <span
                        className={`font-mono font-bold ${quoteResult.inventory.modifier < 1 ? "text-emerald-400" : "text-orange-400"}`}
                      >
                        Score {quoteResult.inventory.score.toFixed(1)}
                        {quoteResult.inventory.modifier !== 1.0 &&
                          ` · ×${quoteResult.inventory.modifier.toFixed(2)}`}
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* ── Fleet allocation (after generate) ── */}
            {quoteResult?.truck?.primary && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2.5 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                  Fleet Allocation
                </h4>
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <div>
                    <span className="text-[var(--tx)] font-medium">
                      {quoteResult.truck.primary.display_name}
                    </span>
                    <span className="text-[var(--tx3)] ml-1.5">
                      {quoteResult.truck.primary.cargo_cubic_ft.toLocaleString()}{" "}
                      cu ft
                    </span>
                  </div>
                </div>
                {quoteResult.truck.secondary && (
                  <div className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <div>
                      <span className="text-[var(--tx)] font-medium">
                        {quoteResult.truck.secondary.display_name}
                      </span>
                      <span className="text-[var(--tx3)] ml-1"> (support)</span>
                    </div>
                  </div>
                )}
                {quoteResult.truck.notes && (
                  <p className="text-[10px] text-[var(--tx3)] italic">
                    {quoteResult.truck.notes}
                  </p>
                )}
              </div>
            )}

            {/* ── Valuation protection (after generate); not applicable to bin rental ── */}
            {quoteResult?.valuation && serviceType !== "bin_rental" && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2.5 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                  Valuation Protection
                </h4>
                {serviceType === "white_glove"
                  ? (() => {
                      type ValTierRow = {
                        tier_slug?: string;
                        display_name?: string;
                        rate_description?: string;
                      };
                      const tiers = (quoteResult.valuation?.tiers ??
                        []) as ValTierRow[];
                      const order = [
                        "released",
                        "enhanced",
                        "full_replacement",
                      ] as const;
                      const labelFor = (slug: string) => {
                        if (slug === "released") return "Standard";
                        if (slug === "enhanced") return "Enhanced";
                        if (slug === "full_replacement")
                          return "Full replacement";
                        return slug.replace(/_/g, " ");
                      };
                      const rows = order
                        .map((slug) => {
                          const t = tiers.find(
                            (x) =>
                              String(x.tier_slug ?? "").toLowerCase() === slug,
                          );
                          if (!t) return null;
                          const body =
                            typeof t.rate_description === "string" &&
                            t.rate_description.trim()
                              ? t.rate_description.trim()
                              : typeof t.display_name === "string" &&
                                  t.display_name.trim()
                                ? t.display_name.trim()
                                : null;
                          return {
                            slug,
                            title: labelFor(slug),
                            body,
                          };
                        })
                        .filter(
                          (
                            r,
                          ): r is {
                            slug: (typeof order)[number];
                            title: string;
                            body: string | null;
                          } => r != null,
                        );
                      if (rows.length === 0) {
                        return (
                          <p className="text-[10px] text-[var(--tx3)] leading-snug">
                            Valuation catalogue rows not loaded. Regenerate the
                            quote or check valuation tiers in admin.
                          </p>
                        );
                      }
                      return rows.map((row) => (
                        <div
                          key={row.slug}
                          className="flex items-start justify-between gap-3"
                        >
                          <span className="text-[var(--tx3)] font-medium shrink-0">
                            {row.title}
                          </span>
                          <span className="text-[var(--tx)] text-right text-[10px] leading-snug max-w-[65%]">
                            {row.body ?? (
                              <span className="text-[var(--tx3)]">
                                See Your Protection on the client quote
                              </span>
                            )}
                          </span>
                        </div>
                      ));
                    })()
                  : ["essential", "signature", "estate"].map((pkg) => {
                  const included =
                    {
                      essential: "Released Value",
                      signature: "Enhanced Value",
                      estate: "Full Replacement",
                    }[pkg] ?? pkg;
                  const upgrade = quoteResult.valuation?.upgrades?.[pkg];
                  return (
                    <div
                      key={pkg}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[var(--tx3)] uppercase">{pkg}</span>
                      <span className="text-[var(--tx)]">
                        {included}
                        {upgrade ? (
                          <span className="text-[var(--gold)] ml-1">
                            (+{fmtPrice(upgrade.price)} upgrade)
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Margin estimate, super-admin only; API omits fields for others ── */}
            {quoteResult?.factors &&
              isSuperAdmin &&
              (typeof (quoteResult.factors as Record<string, unknown>)
                .estimated_margin_essential === "number" ||
                typeof (quoteResult.factors as Record<string, unknown>)
                  .estimated_margin_curated === "number") && (
                <div className="bg-[var(--bg2)] border border-[var(--brd)] rounded-xl p-4 space-y-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                      Margin Estimate
                    </h4>
                    <span className="dt-badge text-[var(--tx3)]">
                      Super Admin
                    </span>
                  </div>
                  {(() => {
                    const f = quoteResult.factors as Record<string, unknown>;
                    const cost = f.estimated_cost as
                      | {
                          labour?: number;
                          truck?: number;
                          fuel?: number;
                          supplies?: number;
                          total?: number;
                        }
                      | undefined;
                    const tiers = quoteResult.tiers as
                      | Record<string, { price: number }>
                      | undefined;
                    const curPrice =
                      tiers?.essential?.price ??
                      tiers?.curated?.price ??
                      tiers?.essentials?.price ??
                      0;
                    const sigPrice =
                      tiers?.signature?.price ?? tiers?.premier?.price ?? 0;
                    const estPrice = tiers?.estate?.price ?? 0;
                    const estTotalCost = cost?.total ?? 0;
                    const margins = [
                      {
                        label: "Essential",
                        price: curPrice,
                        margin:
                          typeof f.estimated_margin_essential === "number"
                            ? f.estimated_margin_essential
                            : typeof f.estimated_margin_curated === "number"
                              ? f.estimated_margin_curated
                              : 0,
                      },
                      {
                        label: "Signature",
                        price: sigPrice,
                        margin:
                          typeof f.estimated_margin_signature === "number"
                            ? f.estimated_margin_signature
                            : 0,
                      },
                      {
                        label: "Estate",
                        price: estPrice,
                        margin:
                          typeof f.estimated_margin_estate === "number"
                            ? f.estimated_margin_estate
                            : 0,
                      },
                    ].filter((t) => t.price > 0);

                    function marginAlertStyle(m: number) {
                      if (m < 15) {
                        return {
                          cls: "text-red-400",
                          Icon: XCircle,
                          hint: "Unprofitable — review pricing before sending.",
                        };
                      }
                      if (m < 25) {
                        return {
                          cls: "text-orange-400",
                          Icon: Warning,
                          hint: "Low margin. Consider recommending a higher tier.",
                        };
                      }
                      if (m < 35) {
                        return {
                          cls: "text-[var(--gold)]",
                          Icon: Warning,
                          hint: "Below target. Acceptable for volume or strategic moves.",
                        };
                      }
                      return {
                        cls: "text-[#E8E0D5]",
                        Icon: CheckCircle,
                        hint: "Healthy margin.",
                      };
                    }

                    return (
                      <>
                        {margins.map(({ label, price, margin }) => {
                          const alert = marginAlertStyle(margin);
                          const profit = price - estTotalCost;
                          const AlertIcon = alert.Icon;
                          return (
                            <div
                              key={label}
                              className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--brd)]/40 last:border-0"
                            >
                              <div>
                                <span className="text-[var(--tx2)] font-medium">
                                  {label}
                                </span>
                                <span className="text-[var(--tx3)] ml-1.5">
                                  {fmtPrice(price)}
                                </span>
                              </div>
                              <div className="text-right shrink-0 max-w-[min(100%,12rem)]">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-bold tabular-nums ${alert.cls}`}
                                >
                                  {margin}%
                                  <AlertIcon
                                    className="w-3.5 h-3.5 shrink-0"
                                    weight="bold"
                                    aria-hidden
                                  />
                                </span>
                                <p className="text-[9px] text-[var(--tx3)] leading-snug">
                                  {alert.hint}
                                </p>
                                <p className="text-[9px] text-[var(--tx3)]">
                                  profit {fmtPrice(profit)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {cost && (
                          <div className="pt-1 text-[10px] text-[var(--tx3)] space-y-0.5">
                            <div className="flex justify-between">
                              <span>Est. cost</span>
                              <span className="tabular-nums text-[var(--tx2)]">
                                {fmtPrice(estTotalCost)}
                              </span>
                            </div>
                            <div className="flex justify-between text-[9px]">
                              <span>
                                Labour {fmtPrice(cost.labour ?? 0)} · Truck{" "}
                                {fmtPrice(cost.truck ?? 0)} · Fuel{" "}
                                {fmtPrice(cost.fuel ?? 0)} · Supplies{" "}
                                {fmtPrice(cost.supplies ?? 0)}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

            {/* ── Margin warning (super-admin only) ── */}
            {quoteResult?.margin_warning &&
              isSuperAdmin &&
              (() => {
                const mw = quoteResult.margin_warning as {
                  level: string;
                  message: string;
                  estimated_margin: number;
                  target_margin: number;
                  signature_margin: number | null;
                };
                const isCritical = mw.level === "critical";
                const isWarning = mw.level === "warning";
                const borderCls = isCritical
                  ? "border-red-400/40 bg-red-400/6"
                  : isWarning
                    ? "border-orange-400/40 bg-orange-400/6"
                    : "border-amber-400/40 bg-amber-400/6";
                const titleCls = isCritical
                  ? "text-red-400"
                  : isWarning
                    ? "text-orange-500"
                    : "text-amber-600";
                const IconCmp = isCritical ? XCircle : Warning;
                const title =
                  mw.level === "critical"
                    ? "Margin alert"
                    : mw.level === "warning"
                      ? "Low margin"
                      : "Margin note";
                return (
                  <div className={`rounded-xl border px-4 py-3.5 ${borderCls}`}>
                    <div className="flex items-start gap-2.5">
                      <IconCmp
                        size={16}
                        weight="bold"
                        className={`shrink-0 mt-0.5 ${titleCls}`}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[11px] font-bold uppercase tracking-wider ${titleCls}`}
                        >
                          {title}
                        </p>
                        <p
                          className={`text-[11px] mt-1 ${isCritical ? "text-red-400/90" : "text-[var(--tx2)]"}`}
                        >
                          {mw.message}
                        </p>
                        <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                          Essential margin:{" "}
                          <strong className="text-[var(--tx)]">
                            {mw.estimated_margin}%
                          </strong>
                          {" · "}
                          target {mw.target_margin}%
                        </p>
                        {mw.signature_margin !== null && (
                          <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                            Signature margin:{" "}
                            <strong className="text-[#EDE6DC]">
                              {mw.signature_margin}%
                            </strong>
                            . Consider recommending Signature for this move.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {quoteResult?.labour_validation && (
              <div
                className={[
                  "p-3 rounded-lg mt-3 text-sm border",
                  quoteResult.labour_validation.status === "above_ceiling"
                    ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                    : "",
                  quoteResult.labour_validation.status === "below_floor"
                    ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                    : "",
                  quoteResult.labour_validation.status === "within_range"
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                    : "",
                  quoteResult.labour_validation.status === "not_applicable"
                    ? "bg-[var(--bg2)] border-[var(--brd)]"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex justify-between items-center gap-2">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--tx3)]">
                    Labour rate check
                  </p>
                  <span
                    className={[
                      "text-[9px] px-2 py-0.5 rounded-full font-semibold",
                      quoteResult.labour_validation.status === "within_range"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                        : "",
                      quoteResult.labour_validation.status === "above_ceiling"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                        : "",
                      quoteResult.labour_validation.status === "below_floor"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                        : "",
                      quoteResult.labour_validation.status === "not_applicable"
                        ? "bg-[var(--bg)] text-[var(--tx3)]"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {quoteResult.labour_validation.status === "within_range"
                      ? "Competitive"
                      : quoteResult.labour_validation.status === "above_ceiling"
                        ? "Above ceiling"
                        : quoteResult.labour_validation.status === "below_floor"
                          ? "Underpriced"
                          : "Not enforced"}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px] gap-2">
                    <span className="text-[var(--tx3)]">Effective rate</span>
                    <span className="font-medium text-[var(--tx)] tabular-nums">
                      ${quoteResult.labour_validation.effectiveRate.toFixed(0)}/hr per mover
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] gap-2">
                    <span className="text-[var(--tx3)]">Band (floor to ceiling)</span>
                    <span className="text-[var(--tx)] tabular-nums">
                      ${quoteResult.labour_validation.floor}–${quoteResult.labour_validation.ceiling}/hr
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] gap-2">
                    <span className="text-[var(--tx3)]">Labour portion</span>
                    <span className="text-[var(--tx)] tabular-nums">
                      ${quoteResult.labour_validation.labourComponent}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] gap-2">
                    <span className="text-[var(--tx3)]">Non-labour (est.)</span>
                    <span className="text-[var(--tx)] tabular-nums">
                      ${quoteResult.labour_validation.nonLabourComponent}
                    </span>
                  </div>
                </div>
                {quoteResult.labour_validation_by_tier &&
                  quoteResult.service_type === "local_move" && (
                    <div className="mt-3 pt-2 border-t border-[var(--brd)]/60 space-y-1">
                      <p className="text-[9px] uppercase tracking-wider text-[var(--tx3)] mb-1">
                        By tier
                      </p>
                      {(["essential", "signature", "estate"] as const).map((tk) => {
                        const row = quoteResult.labour_validation_by_tier?.[tk];
                        if (!row) return null;
                        const tierStatusLabel =
                          row.status === "within_range"
                            ? "Competitive"
                            : row.status === "above_ceiling"
                              ? "Above ceiling"
                              : row.status === "below_floor"
                                ? "Underpriced"
                                : "Not enforced";
                        return (
                          <div
                            key={tk}
                            className="flex justify-between text-[10px] gap-2"
                          >
                            <span className="text-[var(--tx3)] capitalize">{tk}</span>
                            <span className="text-[var(--tx)] tabular-nums">
                              ${row.effectiveRate.toFixed(0)}/hr · {tierStatusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                {quoteResult.labour_validation.message && (
                  <p
                    className={[
                      "text-[10px] mt-2 leading-relaxed",
                      quoteResult.labour_validation.status === "above_ceiling"
                        ? "text-amber-800 dark:text-amber-200/90"
                        : "text-red-800 dark:text-red-200/90",
                    ].join(" ")}
                  >
                    {quoteResult.labour_validation.message}
                  </p>
                )}
              </div>
            )}

            {/* ── Live inventory score (before generate) ── */}
            {!quoteResult &&
              inventoryItems.length > 0 &&
              (serviceType === "local_move" ||
                serviceType === "long_distance" ||
                serviceType === "office_move") && (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2 text-[11px]">
                  <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                    Inventory Summary
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--tx3)]">Items</span>
                    <span className="text-[var(--tx)] font-medium">
                      {inventoryTotalItems}
                      {clientBoxCountNum > 0
                        ? ` + ${clientBoxCountNum} boxes`
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--tx3)]">Score</span>
                    <span className="text-[var(--tx)] font-medium tabular-nums">
                      {inventoryScoreWithBoxes.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[9px] text-[var(--tx3)] italic">
                    Generate quote to see volume modifier and labour estimate.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      <SpecialtyTransportQuoteBuilder
        open={specialtyBuilderOpen}
        onClose={() => setSpecialtyBuilderOpen(false)}
        onCreated={(id) =>
          router.push(`/admin/quotes/${encodeURIComponent(id)}`)
        }
        leadId={leadIdParam || undefined}
        firstName={firstName}
        lastName={lastName}
        email={email}
        phone={phone}
        fromAddress={fromAddress}
        toAddress={toAddress}
        fromAccess={fromAccess}
        toAccess={toAccess}
        moveDate={moveDate}
        itemDescription={specialtyBuilderItemDescription}
        itemWeightLbs={specialtyBuilderWeightStr}
        dimensionsText={specialtyBuilderDimensions}
        toast={toast}
      />
    </div>
    </QuoteFormV2Context.Provider>
  );
}

// ─── Sub-Components ─────────────────────────────

/** Cream / dark-brown (#2A2520) price cards: `--tx*` follows app theme and can stay dark when system `dark:` paints the card. */
const PRICE_CARD = {
  muted: "text-[var(--tx3)]",
  body: "text-[var(--tx)]",
  list: "text-[var(--tx2)]",
  border: "border-[var(--brd)]/50",
  borderTop: "border-t border-[var(--brd)]/50",
  legPanel: "rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)]/40",
} as const;

/** Legacy admin (v1) cream / wine ink for quote preview cards. */
const CREAM_TIER_INK_V1 = {
  accent: "text-[#241820] dark:text-[#F4F1E8]",
  muted: "text-[#4a4039] dark:text-[#B8B3A8]",
  body: "text-[#2A1F24] dark:text-[#F4F1E8]",
  list: "text-[#3d3530] dark:text-[#D4CFC4]",
  border: "border-[#5C1A33]/28 dark:border-[#2C3E2D]/40",
  deposit: "font-bold text-[#5C1A33] dark:text-[var(--gold)]",
  check: "text-[#5C1A33] dark:text-[#C9A84C]",
} as const;

const CREAM_CARD_PREVIEW_V1 = {
  muted: CREAM_TIER_INK_V1.muted,
  body: CREAM_TIER_INK_V1.body,
  list: CREAM_TIER_INK_V1.list,
  borderTop: "border-t border-[rgba(36,24,32,0.15)] dark:border-[var(--brd)]/50",
  legPanel:
    "rounded-lg border border-[rgba(36,24,32,0.2)] dark:border-[var(--brd)]/60 bg-[rgba(255,251,247,0.45)] dark:bg-[var(--bg)]/40",
} as const;

type CreamTierInk = {
  accent: string;
  muted: string;
  body: string;
  list: string;
  border: string;
  deposit: string;
  check: string;
};

function getCreamTierInk(v2: boolean): CreamTierInk {
  if (v2) {
    return {
      accent: "text-fg",
      muted: "text-fg-muted",
      body: "text-fg",
      list: "text-fg-muted",
      border: "border-line",
      deposit: "font-bold text-accent",
      check: "text-accent",
    };
  }
  return CREAM_TIER_INK_V1;
}

type CreamCardPreview = {
  muted: string;
  body: string;
  list: string;
  borderTop: string;
  legPanel: string;
};

function getCreamCardPreview(v2: boolean): CreamCardPreview {
  if (v2) {
    return {
      muted: "text-fg-muted",
      body: "text-fg",
      list: "text-fg-muted",
      borderTop: "border-t border-line/80",
      legPanel:
        "rounded-lg border border-line bg-surface-subtle/90",
    };
  }
  return CREAM_CARD_PREVIEW_V1;
}

/** Shell for “cream” price panels (local move tiers, event, bin, labour single card). */
function getQuotePricePanelShell(v2: boolean): string {
  if (v2) {
    return "rounded-xl border-2 border-line bg-surface p-5";
  }
  return "rounded-xl border-2 border-[#5C1A33]/28 dark:border-[#2C3E2D]/40 bg-[#F9EDE4] dark:bg-[#2A2520] p-5";
}

function getAdminOverrideCalloutShell(v2: boolean): string {
  if (v2) {
    return "rounded-lg border border-line bg-surface-subtle px-3 py-2 text-[10px] space-y-1";
  }
  return "rounded-lg border border-[#5C1A33]/25 px-3 py-2 text-[10px] space-y-1";
}

type TierCardStyle = {
  bg: string;
  border: string;
  accent: string;
  muted: string;
  body: string;
  list: string;
  deposit: string;
  check: string;
};

function getResidentialTierCardStyles(v2: boolean): Record<string, TierCardStyle> {
  if (!v2) {
    return {
      essential: {
        bg: "bg-[var(--bg)]",
        border: "border-[var(--brd)]",
        accent: "text-[var(--tx)]",
        muted: "text-[var(--tx3)]",
        body: "text-[var(--tx)]",
        list: "text-[var(--tx2)]",
        deposit: "font-bold text-[var(--gold)]",
        check: "text-[#EDE6DC]",
      },
      signature: {
        bg: "bg-[#F9EDE4] dark:bg-[#2A2520]",
        border: `border-2 ${CREAM_TIER_INK_V1.border} border-l-4 border-l-[#5C1A33]/45 dark:border-l-[var(--gold)]`,
        accent: CREAM_TIER_INK_V1.accent,
        muted: CREAM_TIER_INK_V1.muted,
        body: CREAM_TIER_INK_V1.body,
        list: CREAM_TIER_INK_V1.list,
        deposit: CREAM_TIER_INK_V1.deposit,
        check: CREAM_TIER_INK_V1.check,
      },
      estate: {
        bg: "bg-[#1a1a2e] dark:bg-[#1a1a2e]",
        border: "border-[#C9A84C]/60",
        accent: "text-[#C9A84C]",
        muted: "text-[#B8B3A8]",
        body: "text-[#F4F1E8]",
        list: "text-[#D4CFC4]",
        deposit: "font-bold text-[#C9A84C]",
        check: "text-[#C9A84C]",
      },
    };
  }
  return {
    essential: {
      bg: "bg-surface-subtle",
      border: "border-line",
      accent: "text-fg",
      muted: "text-fg-muted",
      body: "text-fg",
      list: "text-fg-muted",
      deposit: "font-bold text-accent",
      check: "text-accent",
    },
    signature: {
      bg: "bg-accent-subtle",
      border: "border-2 border-line border-l-4 border-l-accent/45",
      accent: "text-fg",
      muted: "text-fg-muted",
      body: "text-fg",
      list: "text-fg-muted",
      deposit: "font-bold text-accent",
      check: "text-accent",
    },
    estate: {
      bg: "bg-surface-sunken",
      border: "border-2 border-line border-l-4 border-l-accent/35",
      accent: "text-fg",
      muted: "text-fg-muted",
      body: "text-fg",
      list: "text-fg-muted",
      deposit: "font-bold text-accent",
      check: "text-accent",
    },
  };
}

function TiersDisplay({
  tiers,
  recommendedTier = "signature",
  estateMultiDayUplift = 0,
}: {
  tiers: Record<string, TierResult>;
  recommendedTier?: string;
  /** Pre-tax amount included in Estate tier for multi-day loaded labour vs single-day baseline (from generate factors). */
  estateMultiDayUplift?: number;
}) {
  const isV2 = useQuoteFormIsV2();
  const tierOrder = ["essential", "signature", "estate"] as const;
  const tierColors = useMemo(
    () => getResidentialTierCardStyles(isV2),
    [isV2],
  );
  const tierLabels: Record<string, string> = {
    essential: "Essential",
    signature: "Signature",
    estate: "Estate",
  };

  return (
    <div className="space-y-3">
      {tierOrder.map((name) => {
        const t = tiers[name];
        if (!t) return null;
        const c = tierColors[name];
        const isRecommended = name === recommendedTier;
        return (
          <div
            key={name}
            className={`rounded-xl border-2 ${c.border} ${c.bg} p-5 space-y-2`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] font-extrabold tracking-tight ${c.accent}`}
                >
                  {tierLabels[name]}
                </span>
                {isRecommended && (
                  <span
                    className={
                      isV2 ? "dt-badge text-accent" : "dt-badge text-[var(--gold)]"
                    }
                  >
                    Recommended
                  </span>
                )}
              </div>
              <span className={`text-3xl font-black tabular-nums ${c.accent}`}>
                {fmtPrice(t.price)}
              </span>
            </div>
            {name === "estate" && estateMultiDayUplift > 0 && (
              <p className={`text-[10px] leading-snug ${c.muted}`}>
                Includes{" "}
                <span className={`font-semibold ${c.body}`}>
                  {fmtPrice(estateMultiDayUplift)}
                </span>{" "}
                multi-day loaded labour (pack + move schedule vs single-day
                baseline). Already in the Estate price above.
              </p>
            )}
            <div
              className={`flex items-center justify-between text-[11px] ${c.muted}`}
            >
              <span>
                HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}
              </span>
              <span className={`font-bold ${c.body}`}>
                Total: {fmtPrice(t.total)}
              </span>
            </div>
            <div
              className={`flex items-center justify-between text-[11px] ${c.muted}`}
            >
              <span>Deposit to book</span>
              <span className={c.deposit}>{fmtPrice(t.deposit)}</span>
            </div>
            {t.includes.length > 0 && (
              <details className="group">
                <summary
                  className={`text-[9px] font-bold uppercase cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden ${c.muted}`}
                >
                  <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
                  What&apos;s included ▾
                </summary>
                <ul className="mt-1.5 space-y-0.5 pl-5">
                  {t.includes.map((inc, i) => (
                    <li
                      key={i}
                      className={`text-[10px] flex items-start gap-1.5 ${c.list}`}
                    >
                      <Check
                        className={`w-3 h-3 shrink-0 mt-0.5 ${c.check}`}
                        weight="bold"
                        aria-hidden
                      />
                      {inc}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SinglePriceDisplay({
  price: t,
  label,
}: {
  price: TierResult;
  label: string;
}) {
  const isV2 = useQuoteFormIsV2();
  const ink = getCreamTierInk(isV2);
  const shell = getQuotePricePanelShell(isV2);
  return (
    <div className={`${shell} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-bold uppercase ${ink.accent}`}>
          {label}
        </span>
        <span className={`text-3xl font-black tabular-nums ${ink.accent}`}>
          {fmtPrice(t.price)}
        </span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${ink.muted}`}
      >
        <span>
          HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}
        </span>
        <span className={`font-bold ${ink.body}`}>Total: {fmtPrice(t.total)}</span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${ink.muted}`}
      >
        <span>Deposit to book</span>
        <span className={ink.deposit}>{fmtPrice(t.deposit)}</span>
      </div>
      {t.includes.length > 0 && (
        <details className="group">
          <summary
            className={`text-[9px] font-bold uppercase cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden ${ink.muted}`}
          >
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
            What&apos;s included ▾
          </summary>
          <ul className="mt-1.5 space-y-0.5 pl-5">
            {t.includes.map((inc, i) => (
              <li
                key={i}
                className={`text-[10px] flex items-start gap-1.5 ${ink.list}`}
              >
                <Check
                  className={`w-3 h-3 shrink-0 mt-0.5 ${ink.check}`}
                  weight="bold"
                  aria-hidden
                />
                {inc}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type AdminEventLegFactor = {
  label?: string;
  from_address?: string;
  to_address?: string;
  delivery_date?: string;
  return_date?: string;
  delivery_charge?: number;
  return_charge?: number;
  return_discount?: number;
  event_crew?: number;
  event_hours?: number;
  return_hours?: number;
  same_day?: boolean;
  is_on_site?: boolean;
  event_type_label?: string;
};

function fmtShortEventAdmin(d: string | null | undefined): string {
  if (!d) return "TBD";
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function EventPriceDisplay({
  price: t,
  factors,
}: {
  price: TierResult;
  factors: Record<string, unknown>;
}) {
  const deliveryCharge = factors.delivery_charge as number | undefined;
  const returnCharge = factors.return_charge as number | undefined;
  const setupFee = factors.setup_fee as number | undefined;
  const returnDiscount = factors.return_discount as number | undefined;
  const eventCrew = factors.event_crew as number | undefined;
  const eventHours = factors.event_hours as number | undefined;
  const returnDate = factors.return_date as string | undefined;
  const deliveryDate = factors.delivery_date as string | undefined;
  const sysEstHours = factors.event_hours_system_estimate as number | undefined;
  const hoursOv = factors.event_hours_coordinator_override === true;
  const crewOv = factors.event_crew_coordinator_override === true;
  const labourLine = factors.event_delivery_labour as number | undefined;
  const distSur = factors.event_distance_surcharge as number | undefined;
  const wrapSur = factors.event_wrapping_surcharge as number | undefined;
  const moverRate = factors.crew_hourly_rate as number | undefined;
  const overrideApplied = factors.event_pre_tax_override_applied === true;
  const systemPreTax = factors.event_system_pre_tax_total_before_override as
    | number
    | undefined;
  const overrideReason =
    typeof factors.event_pre_tax_override_reason === "string"
      ? factors.event_pre_tax_override_reason.trim()
      : "";

  const isMulti =
    factors.event_mode === "multi" && Array.isArray(factors.event_legs);
  const eventLegs = isMulti
    ? (factors.event_legs as AdminEventLegFactor[])
    : [];

  const isV2 = useQuoteFormIsV2();
  const ink = getCreamTierInk(isV2);
  const card = getCreamCardPreview(isV2);
  const pricePanelShell = getQuotePricePanelShell(isV2);
  const overrideCallout = getAdminOverrideCalloutShell(isV2);

  const totalsFooter = (
    <>
      <div
        className={`pt-1.5 flex justify-between font-semibold ${card.borderTop}`}
      >
        <span className={card.muted}>Subtotal</span>
        <span className={card.body}>{fmtPrice(t.price)}</span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${card.muted}`}
      >
        <span>
          HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}
        </span>
        <span className={`font-bold ${card.body}`}>
          Total: {fmtPrice(t.total)}
        </span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${card.muted}`}
      >
        <span>Deposit (25% pre-tax)</span>
        <span className={ink.deposit}>{fmtPrice(t.deposit)}</span>
      </div>
    </>
  );

  const includesBlock =
    t.includes.length > 0 ? (
      <details className="group pt-1">
        <summary
          className={`text-[9px] font-bold uppercase cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden ${card.muted}`}
        >
          <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
          What&apos;s included ▾
        </summary>
        <ul className="mt-1.5 space-y-0.5 pl-5">
          {t.includes.map((inc, i) => (
            <li
              key={i}
              className={`text-[10px] flex items-start gap-1.5 ${card.list}`}
            >
              <Check
                className={`w-3 h-3 shrink-0 mt-0.5 ${ink.check}`}
                weight="bold"
                aria-hidden
              />
              {inc}
            </li>
          ))}
        </ul>
      </details>
    ) : null;

  if (isMulti && eventLegs.length > 0) {
    return (
      <div className={`${pricePanelShell} space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className={`text-[13px] font-bold ${ink.accent}`}>
              Event quote
            </span>
            <p
              className={`text-[9px] mt-0.5 font-medium uppercase tracking-wide ${card.muted}`}
            >
              Multi-event bundle, {eventLegs.length} round trip
              {eventLegs.length === 1 ? "" : "s"}
            </p>
          </div>
          <span
            className={`text-2xl sm:text-3xl font-black tabular-nums shrink-0 ${ink.accent}`}
          >
            {fmtPrice(t.price)}
          </span>
        </div>
        <div className="space-y-3 text-[11px]">
          {eventLegs.map((leg, idx) => (
            <div key={idx} className={`p-3 space-y-2 ${card.legPanel}`}>
              <p
                className={`text-[9px] font-bold tracking-wider uppercase ${ink.accent}`}
              >
                {leg.label?.trim() || `Event ${idx + 1}`}
              </p>
              {(leg.from_address || leg.to_address) && (
                <p
                  className={`text-[9px] leading-snug opacity-90 ${card.muted}`}
                >
                  {leg.from_address || "Origin"} → {leg.to_address || "Venue"}
                </p>
              )}
              <p className={`text-[9px] opacity-80 ${card.muted}`}>
                Deliver {fmtShortEventAdmin(leg.delivery_date)} → Return{" "}
                {fmtShortEventAdmin(leg.return_date)}
                {leg.same_day ? " (same day)" : ""}
                {leg.is_on_site ? (
                  <span className={`ml-1 font-semibold ${card.body}`}>
                    · On-site Event
                  </span>
                ) : null}
              </p>
              <div className="flex justify-between gap-2">
                <span className={card.muted}>
                  Delivery ({fmtShortEventAdmin(leg.delivery_date)})
                  {leg.event_crew && leg.event_hours ? (
                    <span className="ml-1 opacity-75">
                      {leg.event_crew}-person crew, {leg.event_hours}hr
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-medium tabular-nums shrink-0 ${card.body}`}
                >
                  {fmtPrice(leg.delivery_charge ?? 0)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={card.muted}>
                  Return ({fmtShortEventAdmin(leg.return_date)})
                  {leg.return_discount !== undefined ? (
                    <span className="ml-1 opacity-75">
                      {Math.round(leg.return_discount * 100)}% of leg delivery
                    </span>
                  ) : returnDiscount !== undefined ? (
                    <span className="ml-1 opacity-75">
                      {Math.round(returnDiscount * 100)}% of leg delivery
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-medium tabular-nums shrink-0 ${card.body}`}
                >
                  {fmtPrice(leg.return_charge ?? 0)}
                </span>
              </div>
            </div>
          ))}
          {(setupFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className={card.muted}>Setup service (program)</span>
              <span className={`font-medium ${card.body}`}>
                {fmtPrice(setupFee!)}
              </span>
            </div>
          )}
        </div>
        {totalsFooter}
        {includesBlock}
      </div>
    );
  }

  return (
    <div className={`${pricePanelShell} space-y-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-bold ${ink.accent}`}>
          Event Quote
        </span>
        <span className={`text-3xl font-black tabular-nums ${ink.accent}`}>
          {fmtPrice(t.price)}
        </span>
      </div>
      {/* Breakdown, single round trip */}
      <div className="space-y-1.5 text-[11px]">
        {typeof sysEstHours === "number" && sysEstHours > 0 && (
          <p className={`text-[9px] leading-snug ${card.muted}`}>
            System hours estimate: {sysEstHours}h
            {typeof eventHours === "number" ? (
              <>
                {" "}
                · Billed: {eventHours}h
                {hoursOv ? " (coordinator override)" : ""}
              </>
            ) : null}
            {typeof moverRate === "number" ? ` · $${moverRate}/mover/hr` : null}
            {crewOv ? " · Crew overridden" : null}
          </p>
        )}
        {typeof labourLine === "number" && labourLine > 0 && (
          <div className="flex justify-between gap-2">
            <span className={card.muted}>
              Delivery labour (crew × hours × rate)
            </span>
            <span
              className={`font-medium tabular-nums shrink-0 ${card.body}`}
            >
              {fmtPrice(labourLine)}
            </span>
          </div>
        )}
        {typeof distSur === "number" && distSur > 0 && (
          <div className="flex justify-between gap-2">
            <span className={card.muted}>Distance (over free km)</span>
            <span
              className={`font-medium tabular-nums shrink-0 ${card.body}`}
            >
              {fmtPrice(distSur)}
            </span>
          </div>
        )}
        {typeof wrapSur === "number" && wrapSur > 0 && (
          <div className="flex justify-between gap-2">
            <span className={card.muted}>
              Wrapping / handling surcharge
            </span>
            <span
              className={`font-medium tabular-nums shrink-0 ${card.body}`}
            >
              {fmtPrice(wrapSur)}
            </span>
          </div>
        )}
        {deliveryCharge !== undefined && (
          <div className="flex justify-between">
            <span className={card.muted}>
              Delivery day total ({deliveryDate ?? "TBD"})
              {eventCrew && eventHours ? (
                <span className="ml-1 opacity-75">
                  {eventCrew}-person crew, {eventHours}hr
                </span>
              ) : null}
            </span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(deliveryCharge)}
            </span>
          </div>
        )}
        {(setupFee ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className={card.muted}>Setup service</span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(setupFee!)}
            </span>
          </div>
        )}
        {returnCharge !== undefined && (
          <div className="flex justify-between">
            <span className={card.muted}>
              Return ({returnDate ?? "TBD"})
              {returnDiscount !== undefined ? (
                <span className="ml-1 opacity-75">
                  {Math.round(returnDiscount * 100)}% of delivery
                </span>
              ) : null}
            </span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(returnCharge)}
            </span>
          </div>
        )}
      </div>
      {overrideApplied && typeof systemPreTax === "number" ? (
        <div className={`${overrideCallout} ${card.muted}`}>
          <p className={`font-semibold ${ink.accent}`}>
            Admin pre-tax override applied
          </p>
          <p>System total before override: {fmtPrice(systemPreTax)}</p>
          {overrideReason ? (
            <p className="italic">Reason: {overrideReason}</p>
          ) : null}
        </div>
      ) : null}
      {totalsFooter}
      {includesBlock}
    </div>
  );
}

function B2BPriceDisplay({
  price: t,
  factors,
}: {
  price: TierResult;
  factors: Record<string, unknown>;
}) {
  const baseFee = factors.base_fee as number | undefined;
  const distMod = factors.distance_modifier as number | undefined;
  const distKm = factors.distance_km as number | undefined;
  const accessSurcharge = (factors.access_surcharge as number | undefined) ?? 0;
  const weightSurcharge = (factors.weight_surcharge as number | undefined) ?? 0;
  const weightCategory = factors.weight_category as string | undefined;
  const dimensional = factors.b2b_dimensional === true;
  const breakdown = Array.isArray(factors.b2b_price_breakdown)
    ? (factors.b2b_price_breakdown as { label?: string; amount?: number }[])
    : [];
  const standardBreakdown = Array.isArray(factors.b2b_standard_price_breakdown)
    ? (factors.b2b_standard_price_breakdown as {
        label?: string;
        amount?: number;
      }[])
    : [];
  const verticalName = (factors.b2b_vertical_name as string) || "";
  const usingPartnerRates = factors.b2b_using_partner_rates === true;
  const standardPreTax = factors.b2b_standard_price_pre_tax as
    | number
    | undefined;
  const partnerDiscountPct = factors.b2b_partner_discount_percent as
    | number
    | undefined;
  const engineSub = factors.b2b_engine_subtotal as number | undefined;
  const subOvr = factors.b2b_subtotal_override as number | null | undefined;
  const ovrReason =
    typeof factors.b2b_subtotal_override_reason === "string"
      ? factors.b2b_subtotal_override_reason.trim()
      : "";
  const fullOverrideApplied =
    factors.b2b_full_pre_tax_override_applied === true;

  const isV2 = useQuoteFormIsV2();

  return (
    <div
      className={
        isV2
          ? "rounded-xl border-2 border-line bg-surface p-5 space-y-3"
          : "rounded-xl border-2 border-[var(--brd)] bg-[var(--card)]/90 p-5 space-y-3"
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            isV2
              ? "text-[13px] font-bold text-accent"
              : "text-[13px] font-bold text-[var(--gold)]"
          }
        >
          B2B One-Off
        </span>
        <span className="text-3xl font-black tabular-nums text-[var(--tx)]">
          {fmtPrice(t.price)}
        </span>
      </div>
      {dimensional && verticalName ? (
        <p className="text-[11px] font-semibold text-[var(--tx2)]">
          {verticalName}
        </p>
      ) : null}
      <div className="space-y-1.5 text-[11px]">
        {usingPartnerRates && dimensional && verticalName ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--tx)] pb-1">
            Partner Rate
          </p>
        ) : null}
        {dimensional && breakdown.length > 0 ? (
          breakdown.map((line, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className={PRICE_CARD.muted}>{line.label ?? "—"}</span>
              <span className={`font-medium shrink-0 ${PRICE_CARD.body}`}>
                {fmtPrice(Number(line.amount) || 0)}
              </span>
            </div>
          ))
        ) : (
          <>
            {baseFee !== undefined && distMod !== undefined && (
              <div className="flex justify-between">
                <span className={PRICE_CARD.muted}>
                  Base ${baseFee} × {distMod.toFixed(2)} (distance)
                </span>
                <span className={`font-medium ${PRICE_CARD.body}`}>
                  {fmtPrice(Math.round(baseFee * distMod))}
                </span>
              </div>
            )}
            {accessSurcharge > 0 && (
              <div className="flex justify-between">
                <span className={PRICE_CARD.muted}>Access surcharge</span>
                <span className={`font-medium ${PRICE_CARD.body}`}>
                  {fmtPrice(accessSurcharge)}
                </span>
              </div>
            )}
            {weightSurcharge > 0 && (
              <div className="flex justify-between">
                <span className={PRICE_CARD.muted}>
                  Weight ({weightCategory ?? "-"})
                </span>
                <span className={`font-medium ${PRICE_CARD.body}`}>
                  {fmtPrice(weightSurcharge)}
                </span>
              </div>
            )}
          </>
        )}
        {!dimensional &&
        typeof factors.truck_breakdown_line === "string" &&
        factors.truck_breakdown_line.trim().length > 0 ? (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Vehicle</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>
              {factors.truck_breakdown_line.trim()}
            </span>
          </div>
        ) : null}
        {dimensional && accessSurcharge > 0 ? (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Access surcharge</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>
              {fmtPrice(accessSurcharge)}
            </span>
          </div>
        ) : null}
        {distKm !== undefined && distKm > 0 && (
          <div className={PRICE_CARD.muted}>{distKm.toFixed(1)} km</div>
        )}
      </div>
      {usingPartnerRates &&
      standardPreTax != null &&
      standardPreTax > 0 &&
      typeof t.price === "number" &&
      standardPreTax > t.price ? (
        <div className="rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)]/50 px-3 py-2.5 space-y-1.5 text-[10px]">
          <p className="font-semibold text-[var(--tx2)]">
            List pricing (same job)
          </p>
          {standardBreakdown.length > 0 ? (
            <div className="space-y-0.5">
              {standardBreakdown.map((line, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className={PRICE_CARD.muted}>{line.label ?? "—"}</span>
                  <span className={`font-medium shrink-0 ${PRICE_CARD.body}`}>
                    {fmtPrice(Number(line.amount) || 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-between gap-2 pt-1 border-t border-[var(--brd)]/40">
            <span className={PRICE_CARD.muted}>Subtotal (before HST)</span>
            <span className={`font-semibold ${PRICE_CARD.body}`}>
              {fmtPrice(standardPreTax)}
            </span>
          </div>
          {partnerDiscountPct != null && partnerDiscountPct > 0 ? (
            <p
              className={
                isV2
                  ? "text-fg-muted font-medium"
                  : "text-[#EDE6DC] font-medium"
              }
            >
              Partner discount vs list: {partnerDiscountPct}%
            </p>
          ) : null}
        </div>
      ) : null}
      <div
        className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}
      >
        <span>
          HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}
        </span>
        <span className={`font-bold ${PRICE_CARD.body}`}>
          Total: {fmtPrice(t.total)}
        </span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}
      >
        <span>Deposit to book</span>
        <span
          className={
            isV2 ? "font-bold text-accent" : "font-bold text-[var(--gold)]"
          }
        >
          {fmtPrice(t.deposit)}
        </span>
      </div>
    </div>
  );
}

function BinRentalPriceDisplay({
  price: t,
  factors,
}: {
  price: TierResult;
  factors: Record<string, unknown>;
}) {
  const lines = Array.isArray(factors.bin_line_items)
    ? (factors.bin_line_items as {
        key?: string;
        label?: string;
        amount?: number;
      }[])
    : [];
  const bundleKey = factors.bin_bundle_type as string | undefined;
  const bundleSpec =
    bundleKey && bundleKey !== "custom"
      ? BIN_RENTAL_BUNDLE_SPECS[
          bundleKey as keyof typeof BIN_RENTAL_BUNDLE_SPECS
        ]
      : null;
  const drop = factors.bin_drop_off_date as string | undefined;
  const pick = factors.bin_pickup_date as string | undefined;
  const move = factors.bin_move_date as string | undefined;
  const cycle = factors.bin_rental_cycle_days as number | undefined;
  const fmtShort = (d: string | undefined) =>
    d
      ? new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
          month: "short",
          day: "numeric",
        })
      : "—";
  const isV2 = useQuoteFormIsV2();
  const ink = getCreamTierInk(isV2);
  const card = getCreamCardPreview(isV2);
  const pricePanelShell = getQuotePricePanelShell(isV2);
  return (
    <div className={`${pricePanelShell} space-y-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-bold ${ink.accent}`}>
          Bin Rental
        </span>
        <span className={`text-3xl font-black tabular-nums ${ink.accent}`}>
          {fmtPrice(t.total)}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {lines.map((l, i) => (
          <div key={i}>
            <div className="flex justify-between gap-2">
              <span className={card.muted}>{l.label}</span>
              <span className={`font-medium shrink-0 ${card.body}`}>
                {fmtPrice(Number(l.amount) || 0)}
              </span>
            </div>
            {l.key === "bundle" && bundleSpec ? (
              <p className={`${card.muted} pl-0 pt-0.5 text-[10px]`}>
                {bundleSpec.bins} bins + {bundleSpec.wardrobeBoxes} wardrobe
                boxes
              </p>
            ) : null}
          </div>
        ))}
        <div
          className={`flex justify-between pt-1 font-semibold ${card.borderTop}`}
        >
          <span className={card.muted}>Subtotal</span>
          <span className={card.body}>{fmtPrice(t.price)}</span>
        </div>
      </div>
      <div className={`text-[11px] space-y-0.5 ${card.muted}`}>
        <div className="flex justify-between">
          <span>HST ({(TAX_RATE * 100).toFixed(0)}%)</span>
          <span>{fmtPrice(t.tax)}</span>
        </div>
        <div className={`flex justify-between font-bold ${card.body}`}>
          <span>Total</span>
          <span>{fmtPrice(t.total)}</span>
        </div>
      </div>
      <p className={`text-[10px] ${card.muted}`}>
        Payment: Full at booking
      </p>
      <div className="text-[10px] space-y-0.5 pt-2 border-t border-[var(--brd)]/40">
        <p>
          <span className={card.muted}>Delivery:</span> {fmtShort(drop)}
        </p>
        <p>
          <span className={card.muted}>Move:</span> {fmtShort(move)}
        </p>
        <p>
          <span className={card.muted}>Pickup:</span> {fmtShort(pick)}
        </p>
        {cycle != null && (
          <p className="text-[var(--tx3)]">Rental cycle: {cycle} days</p>
        )}
      </div>
    </div>
  );
}

function LabourOnlyPriceDisplay({
  price: t,
  factors,
}: {
  price: TierResult;
  factors: Record<string, unknown>;
}) {
  const crewSize = factors.crew_size as number | undefined;
  const hours = factors.hours as number | undefined;
  const labourRate = factors.labour_rate as number | undefined;
  const truckFee = (factors.truck_fee as number | undefined) ?? 0;
  const accessSurcharge = (factors.access_surcharge as number | undefined) ?? 0;
  const visits = (factors.visits as number | undefined) ?? 1;
  const visit1Price = factors.visit1_price as number | undefined;
  const visit2Price = factors.visit2_price as number | undefined;
  const visit2Date = factors.visit2_date as string | undefined;
  const labourStorageFee =
    (factors.labour_storage_fee as number | undefined) ?? 0;
  const storageWeeks =
    typeof factors.labour_storage_weeks === "number"
      ? factors.labour_storage_weeks
      : null;
  const storageWeeklyRate =
    typeof factors.storage_weekly_rate === "number"
      ? factors.storage_weekly_rate
      : null;

  const isV2 = useQuoteFormIsV2();
  const ink = getCreamTierInk(isV2);
  const card = getCreamCardPreview(isV2);
  const pricePanelShell = getQuotePricePanelShell(isV2);
  return (
    <div className={`${pricePanelShell} space-y-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-bold ${ink.accent}`}>
          Labour Only
        </span>
        <span className={`text-3xl font-black tabular-nums ${ink.accent}`}>
          {fmtPrice(t.price)}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {crewSize && hours && labourRate && (
          <div className="flex justify-between">
            <span className={card.muted}>
              {crewSize}-person crew × {hours}hr × ${labourRate}/hr
            </span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(crewSize * hours * labourRate)}
            </span>
          </div>
        )}
        {truckFee > 0 && (
          <div className="flex justify-between">
            <span className={card.muted}>Truck</span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(truckFee)}
            </span>
          </div>
        )}
        {accessSurcharge > 0 && (
          <div className="flex justify-between">
            <span className={card.muted}>Access surcharge</span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(accessSurcharge)}
            </span>
          </div>
        )}
        {labourStorageFee > 0 && (
          <div className="flex justify-between">
            <span className={card.muted}>
              Storage
              {storageWeeks != null && storageWeeklyRate != null
                ? ` (${storageWeeks} wk × ${fmtPrice(storageWeeklyRate)}/wk)`
                : null}
            </span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(labourStorageFee)}
            </span>
          </div>
        )}
        {visits >= 2 && visit2Price !== undefined && (
          <div className="flex justify-between">
            <span className={card.muted}>
              Visit 2 ({visit2Date ?? "TBD"}), return discount
            </span>
            <span className={`font-medium ${card.body}`}>
              {fmtPrice(visit2Price)}
            </span>
          </div>
        )}
        {visits >= 2 && visit1Price !== undefined && (
          <div
            className={`pt-1 flex justify-between font-semibold ${card.borderTop}`}
          >
            <span className={card.muted}>Subtotal</span>
            <span className={card.body}>{fmtPrice(t.price)}</span>
          </div>
        )}
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${card.muted}`}
      >
        <span>
          HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}
        </span>
        <span className={`font-bold ${card.body}`}>
          Total: {fmtPrice(t.total)}
        </span>
      </div>
      <div
        className={`flex items-center justify-between text-[11px] ${card.muted}`}
      >
        <span>Deposit to book</span>
        <span className={ink.deposit}>{fmtPrice(t.deposit)}</span>
      </div>
    </div>
  );
}

/**
 * Coordinator-only preview row that shows how many minutes of the labour estimate are
 * coming from item-intelligence assembly detection. The client quote page never sees this.
 */
function AssemblyLabourPreview({
  minutes,
  itemCount,
}: {
  minutes: number;
  itemCount: number;
}) {
  if (minutes <= 0) return null;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return (
    <div className="mt-3 rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-3 text-[11px] space-y-1.5">
      <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
        Labour estimate · assembly contribution
      </p>
      <div className="flex justify-between text-[var(--tx)]">
        <span>
          Assembly / disassembly{" "}
          <span className="text-[var(--tx3)]">
            ({itemCount} item{itemCount !== 1 ? "s" : ""})
          </span>
        </span>
        <span className="tabular-nums font-semibold">+{minutes}m · ~{hours}h</span>
      </div>
      <p className="text-[10px] text-[var(--tx3)] leading-snug">
        Assembly is not a separate fee — it inflates labour hours which feeds the quoted
        price. Toggle off above to remove.
      </p>
    </div>
  );
}

function OptimisticTiers({
  est,
  isLongDistance,
}: {
  est: { essential: number; signature: number; estate: number };
  isLongDistance?: boolean;
}) {
  const tiers = [
    { name: "Essential", price: est.essential },
    { name: "Signature", price: est.signature },
    { name: "Estate", price: est.estate },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
        Estimated Pricing{isLongDistance ? " (excl. drive time)" : ""}
      </p>
      {tiers.map((t) => {
        const tax = Math.round(t.price * TAX_RATE);
        return (
          <div
            key={t.name}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]"
          >
            <span className="text-[12px] font-semibold text-[var(--tx)]">
              {t.name}
            </span>
            <div className="text-right">
              <span className="text-[16px] font-black tabular-nums text-[var(--tx)]">
                {fmtPrice(t.price)}
              </span>
              <span className="text-[9px] text-[var(--tx3)] ml-1.5">
                +{fmtPrice(tax)} HST
              </span>
            </div>
          </div>
        );
      })}
      <p className="text-[9px] text-[var(--tx3)] italic text-center">
        {isLongDistance
          ? "Drive time not included, generate for exact long-distance pricing"
          : "Estimate only, generate quote for exact pricing with distance factor"}
      </p>
    </div>
  );
}

// ─── Price Breakdown (Coordinator view, Section 8) ──────────────────────────

function fmtMod(v: number) {
  if (v === 1.0) return <span className="text-[var(--tx3)]">×1.0</span>;
  const pct = Math.round((v - 1) * 100);
  const color =
    v < 1
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-amber-600 dark:text-amber-400";
  return (
    <span className={`font-semibold ${color}`}>
      ×{v.toFixed(2)} ({pct > 0 ? "+" : ""}
      {pct}%)
    </span>
  );
}

function PriceBreakdownResidential({
  factors,
  distance,
  time,
  moveSize,
  curatedPrice: essentialPrice,
  signaturePrice,
  estatePrice,
}: {
  factors: Record<string, unknown>;
  distance: number | null;
  time: number | null;
  moveSize?: string | null;
  curatedPrice?: number;
  signaturePrice?: number;
  estatePrice?: number;
}) {
  const baseRate =
    typeof factors.base_rate === "number" ? factors.base_rate : null;
  const invMod =
    typeof factors.inventory_modifier === "number"
      ? factors.inventory_modifier
      : null;
  const distMod =
    typeof factors.distance_modifier === "number"
      ? factors.distance_modifier
      : null;
  const dateMult =
    typeof factors.date_multiplier === "number"
      ? factors.date_multiplier
      : null;
  const neighMult =
    typeof factors.neighbourhood_multiplier === "number"
      ? factors.neighbourhood_multiplier
      : null;
  const neighTier =
    typeof factors.neighbourhood_tier === "string"
      ? factors.neighbourhood_tier
      : null;
  const accessSurch =
    typeof factors.access_surcharge === "number" ? factors.access_surcharge : 0;
  const specialtySurch =
    typeof factors.specialty_surcharge === "number"
      ? factors.specialty_surcharge
      : 0;
  const labourDelta =
    typeof factors.labour_delta === "number" ? factors.labour_delta : null;
  const labourMH =
    typeof factors.labour_extra_man_hours === "number"
      ? factors.labour_extra_man_hours
      : null;
  const labourRate =
    typeof factors.labour_rate_per_mover_hour === "number"
      ? factors.labour_rate_per_mover_hour
      : null;
  const deadheadSurch =
    typeof factors.deadhead_surcharge === "number"
      ? factors.deadhead_surcharge
      : 0;
  const deadheadKm =
    typeof factors.deadhead_km === "number" ? factors.deadhead_km : 0;
  const packingSupplies =
    typeof factors.packing_supplies_included === "number"
      ? factors.packing_supplies_included
      : null;
  const subtotalPre =
    typeof factors.subtotal_before_labour === "number"
      ? factors.subtotal_before_labour
      : null;
  const invScore =
    typeof factors.inventory_score === "number"
      ? factors.inventory_score
      : null;
  const invBenchmark =
    typeof factors.inventory_benchmark === "number"
      ? factors.inventory_benchmark
      : null;
  const cratingTotal =
    typeof factors.crating_total === "number" ? factors.crating_total : 0;
  const parkingLc =
    typeof factors.parking_long_carry_total === "number"
      ? factors.parking_long_carry_total
      : 0;
  const truckLine =
    typeof factors.truck_breakdown_line === "string" &&
    factors.truck_breakdown_line.trim().length > 0
      ? factors.truck_breakdown_line.trim()
      : null;
  const truckSurcharge =
    typeof factors.truck_surcharge === "number"
      ? factors.truck_surcharge
      : null;

  // Inventory label
  let invLabel = "standard";
  if (invMod !== null) {
    if (invMod < 0.8) invLabel = "light";
    else if (invMod > 1.2) invLabel = "heavy";
  }

  // Distance label
  let distLabel = "";
  if (distance !== null) {
    if (distance <= 2) distLabel = "ultra-short ≤2km";
    else if (distance <= 5) distLabel = "short ≤5km";
    else if (distance <= 20) distLabel = "local baseline";
    else if (distance <= 40) distLabel = "medium ≤40km";
    else if (distance <= 60) distLabel = "long ≤60km";
    else if (distance <= 100) distLabel = "very long ≤100km";
    else distLabel = "extreme >100km";
  }

  const Row = ({
    label,
    value,
    sub,
  }: {
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium text-[var(--tx2)]">
          {label}
        </span>
        {sub != null && sub !== "" && (
          <div className="mt-0.5 text-[10px] leading-snug text-[var(--tx3)]">
            {sub}
          </div>
        )}
      </div>
      <div className="text-[11px] text-right shrink-0 tabular-nums max-w-[55%] pt-0.5">
        {value}
      </div>
    </div>
  );

  const BreakdownCard = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)]/40 overflow-hidden divide-y divide-[var(--brd)]/80">
      {children}
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-semibold tracking-wide text-[var(--tx3)] mb-1.5">
      {children}
    </p>
  );

  return (
    <div className="space-y-3 text-[10px]">
      <div>
        <SectionTitle>Base &amp; multipliers</SectionTitle>
        <BreakdownCard>
          {distance != null && (
            <Row
              label="Route"
              value={
                <span className="font-medium text-[var(--tx)]">
                  {distance} km
                </span>
              }
              sub={time != null ? `${time} min drive` : undefined}
            />
          )}
          {baseRate !== null && (
            <Row
              label={`Base rate${moveSize ? ` (${moveSize.replace("br", "BR").replace("_plus", "+")})` : ""}`}
              value={
                <span className="font-semibold text-[var(--tx)]">
                  {fmtPrice(baseRate)}
                </span>
              }
            />
          )}
          {invMod !== null && (
            <Row
              label="Inventory modifier"
              value={fmtMod(invMod)}
              sub={
                invScore != null && invBenchmark != null
                  ? `Score ${invScore.toFixed(1)} / benchmark ${invBenchmark.toFixed(1)} · ${invLabel}`
                  : invLabel
              }
            />
          )}
          {distMod !== null && (
            <Row
              label="Distance modifier"
              value={fmtMod(distMod)}
              sub={distLabel || undefined}
            />
          )}
          {dateMult !== null && (
            <Row label="Date factor" value={fmtMod(dateMult)} />
          )}
          {neighMult !== null && (
            <Row
              label="Neighbourhood tier"
              value={fmtMod(neighMult)}
              sub={neighTier ?? undefined}
            />
          )}
          {subtotalPre !== null && (
            <div className="bg-[var(--gdim)]/40 border-t border-[var(--brd)]">
              <Row
                label="Subtotal (multiplied)"
                value={
                  <span className="font-bold text-[var(--tx)]">
                    {fmtPrice(subtotalPre)}
                  </span>
                }
              />
            </div>
          )}
        </BreakdownCard>
      </div>

      <div>
        <SectionTitle>Flat additions</SectionTitle>
        <BreakdownCard>
          <Row
            label="Access surcharge"
            value={
              accessSurch > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  +{fmtPrice(accessSurch)}
                </span>
              ) : (
                <span className="text-[var(--tx3)]">$0</span>
              )
            }
            sub={accessSurch > 0 ? undefined : "No hard access"}
          />
          {specialtySurch > 0 && (
            <Row
              label="Specialty surcharge"
              value={
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  +{fmtPrice(specialtySurch)}
                </span>
              }
            />
          )}
          <Row
            label="Parking & long carry"
            value={
              parkingLc > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  +{fmtPrice(parkingLc)}
                </span>
              ) : (
                <span className="text-[var(--tx3)]">$0</span>
              )
            }
          />
          {truckLine ? (
            <Row
              label="Vehicle surcharge"
              value={
                truckSurcharge != null && truckSurcharge > 0 ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    +{fmtPrice(truckSurcharge)}
                  </span>
                ) : (
                  <span className="text-[var(--tx3)]">$0</span>
                )
              }
              sub={
                <span className="inline-flex items-center gap-1.5">
                  <Truck
                    size={12}
                    weight="regular"
                    className="shrink-0 opacity-70"
                    aria-hidden
                  />
                  {truckLine}
                </span>
              }
            />
          ) : null}
          <Row
            label="Labour delta"
            value={
              labourDelta != null && labourDelta > 0 ? (
                <span className="font-semibold text-[var(--gold)]">
                  +{fmtPrice(labourDelta)}
                </span>
              ) : (
                <span className="text-[var(--tx3)]">
                  $0, below baseline
                  {labourDelta === 0 && labourMH != null
                    ? ` (${labourMH} extra hr)`
                    : ""}
                </span>
              )
            }
            sub={
              labourDelta != null &&
              labourDelta > 0 &&
              labourMH != null &&
              labourRate != null
                ? `${labourMH} extra man-hours × $${labourRate}/hr`
                : undefined
            }
          />
          <Row
            label="Deadhead surcharge"
            value={
              deadheadSurch > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  +{fmtPrice(deadheadSurch)}
                </span>
              ) : (
                <span className="text-[var(--tx3)]">$0</span>
              )
            }
            sub={
              deadheadKm > 0 && deadheadSurch <= 0
                ? `${deadheadKm.toFixed(1)} km · within free zone`
                : undefined
            }
          />
          {cratingTotal > 0 && (
            <Row
              label="Custom crating"
              value={
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  +{fmtPrice(cratingTotal)}
                </span>
              }
            />
          )}
          {packingSupplies != null && packingSupplies > 0 && (
            <Row
              label="Packing supplies (Estate)"
              value={
                <span className="font-semibold text-[var(--gold)]">
                  +{fmtPrice(packingSupplies)}
                </span>
              }
            />
          )}
        </BreakdownCard>
      </div>

      {essentialPrice != null && (
        <div>
          <SectionTitle>Tier prices</SectionTitle>
          <BreakdownCard>
            <Row
              label="Essential (×1.0)"
              value={
                <span className="font-bold text-[var(--gold)]">
                  {fmtPrice(essentialPrice)}
                </span>
              }
            />
            {signaturePrice != null && (
              <Row
                label="Signature (×1.50)"
                value={
                  <span className="font-bold text-[var(--gold)]">
                    {fmtPrice(signaturePrice)}
                  </span>
                }
              />
            )}
            {estatePrice != null && (
              <Row
                label="Estate (×3.15)"
                value={
                  <span className="font-bold text-[var(--gold)]">
                    {fmtPrice(estatePrice)}
                  </span>
                }
              />
            )}
          </BreakdownCard>
        </div>
      )}
    </div>
  );
}

function BinRentalFactorsSummary({
  factors,
}: {
  factors: Record<string, unknown>;
}) {
  const geoFail = factors.bin_distance_geocoding_failed === true;
  const delKm = factors.bin_hub_delivery_km;
  const pKm = factors.bin_hub_pickup_km;
  const delMin = factors.bin_delivery_drive_min;
  const pMin = factors.bin_pickup_drive_min;
  const lines = Array.isArray(factors.bin_line_items)
    ? (factors.bin_line_items as { label: string; amount: number }[])
    : [];
  const sub = factors.bin_subtotal;
  const tax = factors.bin_tax;
  const grand = factors.bin_grand_total;

  return (
    <div className="space-y-2 text-[10px]">
      {geoFail && (
        <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
          <Warning className="w-3.5 h-3.5 shrink-0 mt-0.5" weight="bold" aria-hidden />
          Could not determine distance. Coordinator will verify pricing.
        </p>
      )}
      {!geoFail && typeof delKm === "number" && (
        <div className="flex items-center justify-between">
          <span className="text-[var(--tx3)]">Delivery distance</span>
          <span className="text-[var(--tx)] font-medium tabular-nums">
            {delKm} km
            {typeof delMin === "number" ? ` (${delMin} min)` : ""}
          </span>
        </div>
      )}
      {!geoFail && typeof pKm === "number" && (
        <div className="flex items-center justify-between">
          <span className="text-[var(--tx3)]">Pickup distance</span>
          <span className="text-[var(--tx)] font-medium tabular-nums">
            {pKm} km
            {typeof pMin === "number" ? ` (${pMin} min)` : ""}
          </span>
        </div>
      )}
      {lines.map((ln, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <span className="text-[var(--tx3)] text-left">{ln.label}</span>
          <span className="text-[var(--tx)] font-medium shrink-0">
            {fmtPrice(ln.amount)}
          </span>
        </div>
      ))}
      {typeof sub === "number" && (
        <div className="flex items-center justify-between pt-1 border-t border-[var(--brd)]/50">
          <span className="text-[var(--tx3)]">Subtotal</span>
          <span className="text-[var(--tx)] font-semibold">{fmtPrice(sub)}</span>
        </div>
      )}
      {typeof tax === "number" && (
        <div className="flex items-center justify-between">
          <span className="text-[var(--tx3)]">HST (13%)</span>
          <span className="text-[var(--tx)]">{fmtPrice(tax)}</span>
        </div>
      )}
      {typeof grand === "number" && (
        <div className="flex items-center justify-between">
          <span className="text-[var(--tx)] font-semibold">Total</span>
          <span className="text-[var(--tx)] font-semibold">{fmtPrice(grand)}</span>
        </div>
      )}
    </div>
  );
}

function WhiteGloveAdminFactorsSummary({
  factors,
  distance,
}: {
  factors: Record<string, unknown>;
  distance: number | null;
}) {
  const n = (k: string) =>
    typeof factors[k] === "number" && Number.isFinite(factors[k] as number)
      ? (factors[k] as number)
      : 0;
  const crew =
    typeof factors.white_glove_crew === "number" ? factors.white_glove_crew : null;
  const hours =
    typeof factors.white_glove_hours === "number"
      ? factors.white_glove_hours
      : null;
  const distKm =
    typeof factors.distance_km === "number" &&
    Number.isFinite(factors.distance_km as number)
      ? (factors.distance_km as number)
      : distance;
  const rows: { label: string; amount: number }[] = [
    {
      label: "Item handling (minimum may apply)",
      amount: n("white_glove_items_subtotal"),
    },
    { label: "Assembly / disassembly", amount: n("white_glove_assembly_total") },
    {
      label: "Building access (pickup + drop-off)",
      amount: n("access_surcharge"),
    },
    { label: "Parking / long carry", amount: n("parking_long_carry_total") },
    { label: "Distance surcharge", amount: n("white_glove_distance_surcharge") },
    { label: "Debris removal", amount: n("white_glove_debris_fee") },
    {
      label: "Declared value premium",
      amount: n("white_glove_declared_value_premium"),
    },
    { label: "Guaranteed window", amount: n("white_glove_guaranteed_window_fee") },
    { label: "Truck", amount: n("white_glove_truck_surcharge") },
  ];
  const filtered = rows.filter((r) => r.amount > 0);
  return (
    <div className="space-y-2 text-[10px]">
      {typeof distKm === "number" && (
        <div className="flex justify-between text-[var(--tx3)]">
          <span>Route distance</span>
          <span className="text-[var(--tx)] font-medium tabular-nums">
            {distKm} km
          </span>
        </div>
      )}
      {crew != null && hours != null && (
        <div className="flex justify-between text-[var(--tx3)] pb-1 border-b border-[var(--brd)]/40">
          <span>Crew / hours (estimate)</span>
          <span className="text-[var(--tx)] font-medium">
            {crew} movers · {hours} hr
          </span>
        </div>
      )}
      {filtered.map((r, i) => (
        <div key={i} className="flex justify-between gap-2">
          <span className="text-[var(--tx3)] text-left shrink min-w-0">
            {r.label}
          </span>
          <span className="text-[var(--tx)] font-medium shrink-0">
            {fmtPrice(r.amount)}
          </span>
        </div>
      ))}
      <p className="text-[9px] text-[var(--tx3)] leading-snug pt-1">
        Subtotal before tax follows server rounding. Raw pricing lists every factor key.
      </p>
    </div>
  );
}

function FactorsDisplayCollapsible({
  factors,
  distance,
  time,
  showMultipliers = true,
  tiers,
  moveSize,
}: {
  factors: Record<string, unknown>;
  distance: number | null;
  time: number | null;
  showMultipliers?: boolean;
  tiers?: Record<string, TierResult>;
  moveSize?: string | null;
}) {
  const isBinRental =
    factors.service_family === "bin_rental" ||
    typeof factors.bin_bundle_type === "string";
  const isWhiteGloveItemBased = factors.white_glove_pricing === "item_based";
  // Use rich residential breakdown when the new formula fields are present (distance_modifier)
  const isNewResidential = typeof factors.distance_modifier === "number";
  const hasContent =
    Object.keys(factors).length > 0 || distance != null;
  if (!hasContent) return null;

  return (
    <details
      className="pt-3 border-t border-[var(--brd)] group"
      defaultValue={undefined}
    >
      <summary className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
        Price Breakdown
      </summary>
      <div className="mt-2">
        {isBinRental ? (
          <BinRentalFactorsSummary factors={factors} />
        ) : isNewResidential ? (
          <PriceBreakdownResidential
            factors={factors}
            distance={distance}
            time={time}
            moveSize={moveSize}
            curatedPrice={tiers?.essential?.price ?? tiers?.curated?.price}
            signaturePrice={tiers?.signature?.price}
            estatePrice={tiers?.estate?.price}
          />
        ) : isWhiteGloveItemBased ? (
          <div className="space-y-3">
            <WhiteGloveAdminFactorsSummary
              factors={factors}
              distance={distance}
            />
            <details className="group rounded-lg border border-[var(--brd)]/60 bg-[var(--bg2)]/40">
              <summary className="cursor-pointer select-none text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
                Show raw pricing data
              </summary>
              <div className="px-3 pb-3 pt-0">
                <LegacyFactorsDisplay
                  factors={factors}
                  distance={distance}
                  time={time}
                  showMultipliers={showMultipliers}
                />
              </div>
            </details>
          </div>
        ) : (
          <LegacyFactorsDisplay
            factors={factors}
            distance={distance}
            time={time}
            showMultipliers={showMultipliers}
          />
        )}
      </div>
    </details>
  );
}

// Legacy display for non-residential / old-format quotes
function LegacyFactorsDisplay({
  factors,
  distance,
  time,
  showMultipliers = true,
}: {
  factors: Record<string, unknown>;
  distance: number | null;
  time: number | null;
  showMultipliers?: boolean;
}) {
  const HIDDEN_KEYS = new Set([
    "labour_delta",
    "labour_component",
    "labour_actual_crew",
    "labour_actual_hours",
    "labour_baseline_crew",
    "labour_baseline_hours",
    "labour_rate",
    "labour_rate_per_mover_hour",
    "labour_extra_man_hours",
    "packing_supplies_included",
    "distance_modifier",
    "inventory_modifier",
    "deadhead_km",
    "return_km",
    "subtotal_before_labour",
    "event_legs",
    "event_leg_distances",
    "includes",
    "event_distance_summary",
    "truck_breakdown_line",
    "truck_surcharge",
    "truck_recommended",
    "truck_type_selected",
    "service_family",
    "payment_full_at_booking",
    "bin_bundle_type",
    "bin_bundle_label",
    "bin_count_total",
    "bin_wardrobe_boxes",
    "bin_extra_bins",
    "bin_packing_paper",
    "bin_material_delivery_charged",
    "bin_linked_move_id",
    "bin_drop_off_date",
    "bin_pickup_date",
    "bin_move_date",
    "bin_rental_cycle_days",
    "bin_delivery_notes",
    "bin_line_items",
    "bin_subtotal",
    "bin_tax",
    "bin_grand_total",
    "bin_inventory_total",
    "bin_inventory_out",
    "bin_inventory_available",
    "bin_hub_delivery_km",
    "bin_hub_pickup_km",
    "bin_delivery_drive_min",
    "bin_pickup_drive_min",
    "bin_distance_fee_delivery",
    "bin_distance_fee_pickup",
    "bin_distance_fee_total",
    "bin_distance_geocoding_failed",
    "internal_notes",
  ]);
  const entries = Object.entries(factors).filter(([key, v]) => {
    if (HIDDEN_KEYS.has(key)) return false;
    if (v === null || v === undefined || v === 0 || v === 1) return false;
    if (typeof v === "object") return false;
    return true;
  });
  const labourDelta =
    typeof factors.labour_delta === "number"
      ? factors.labour_delta
      : typeof factors.labour_component === "number"
        ? factors.labour_component
        : null;
  const labourExtraManHours =
    typeof factors.labour_extra_man_hours === "number"
      ? factors.labour_extra_man_hours
      : null;
  const labourRate =
    typeof factors.labour_rate_per_mover_hour === "number"
      ? factors.labour_rate_per_mover_hour
      : null;

  const eventDist =
    typeof factors.event_distance_summary === "string" &&
    (factors.event_distance_summary as string).trim().length > 0
      ? (factors.event_distance_summary as string)
      : null;

  const truckBreakdownLine =
    typeof factors.truck_breakdown_line === "string" &&
    factors.truck_breakdown_line.trim().length > 0
      ? factors.truck_breakdown_line.trim()
      : null;

  return (
    <div className="space-y-1.5">
      {truckBreakdownLine ? (
        <div className="text-[10px] text-[var(--tx)] font-medium">
          {truckBreakdownLine}
        </div>
      ) : null}
      {eventDist ? (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">Distance</span>
          <span className="text-[var(--tx)] font-medium">{eventDist}</span>
        </div>
      ) : distance != null ? (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">Distance</span>
          <span className="text-[var(--tx)] font-medium">
            {distance} km ({time ?? "-"} min)
          </span>
        </div>
      ) : null}
      {labourDelta !== null && (
        <div className="flex flex-col gap-0.5 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--tx3)]">Labour adjustment</span>
            <span
              className={
                labourDelta > 0
                  ? "font-semibold text-[var(--gold)]"
                  : "text-[var(--tx3)]"
              }
            >
              {labourDelta > 0 ? `+${fmtPrice(labourDelta)}` : "$0"}
            </span>
          </div>
          {labourDelta > 0 &&
            labourExtraManHours != null &&
            labourRate != null && (
              <p className="text-[9px] text-[var(--gold)]/90">
                ({labourExtraManHours} extra man-hours × ${labourRate})
              </p>
            )}
          {labourDelta === 0 && (
            <p className="text-[9px] text-[var(--tx3)]">(within baseline)</p>
          )}
        </div>
      )}
      {entries.map(([key, val]) => (
        <div
          key={key}
          className="flex items-center justify-between text-[10px]"
        >
          <span className="text-[var(--tx3)]">{toTitleCase(key)}</span>
          <span className="text-[var(--tx)] font-medium">
            {showMultipliers
              ? typeof val === "number"
                ? val >= 10
                  ? fmtPrice(val)
                  : `×${val}`
                : String(val)
              : typeof val === "number" && val < 10
                ? "Applied"
                : typeof val === "number"
                  ? fmtPrice(val)
                  : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ExpiryLabel({ expiresAt }: { expiresAt?: string | null }) {
  if (!expiresAt) return <span className="text-[var(--tx)]">-</span>;
  const exp = new Date(expiresAt);
  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
  const dateStr = exp.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  if (daysLeft <= 0)
    return <span className="text-[var(--red)] font-semibold">Expired</span>;
  if (daysLeft <= 2)
    return (
      <span className="text-[var(--red)] font-semibold">Expires {dateStr}</span>
    );
  return <span className="text-[var(--tx)]">Expires in {daysLeft} days</span>;
}
