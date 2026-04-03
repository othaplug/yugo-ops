"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import MultiStopAddressField, { type StopEntry } from "@/components/ui/MultiStopAddressField";
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
  House,
  Buildings,
  OfficeChair,
  Star,
  Palette,
  CalendarBlank,
  Recycle,
  MagnifyingGlass,
  Lightbulb,
  ListChecks,
  Info,
  XCircle,
  CheckCircle,
  X,
  Wrench,
  type IconProps,
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
import B2BJobsDeliveryForm, { type B2BJobsEmbedSnapshot } from "@/components/admin/b2b/B2BJobsDeliveryForm";
import { calculateBinRentalPrice, BIN_RENTAL_BUNDLE_SPECS } from "@/lib/pricing/bin-rental";
import {
  calculateB2BDimensionalPrice,
  isMoveDateWeekend,
  synthesizeStopsFromAddresses,
  type B2BDimensionalQuoteInput,
  type B2BQuoteLineItem,
  type B2BWeightCategory,
  type DeliveryVerticalRow,
} from "@/lib/pricing/b2b-dimensional";
import { mergeBundleTierIntoMergedRates } from "@/lib/b2b-bundle-line-items";
import { prepareB2bLineItemsForDimensionalEngine } from "@/lib/b2b-dimensional-quote-prep";
import { suggestB2bWeightTierFromDescription } from "@/lib/pricing/b2b-weight-helpers";
import { QUOTE_SERVICE_TYPE_DEFINITIONS } from "@/lib/quote-service-types";
import InventoryInput, { type InventoryItemEntry } from "@/components/inventory/InventoryInput";
import { mapSpecialtyToQuoteTypes, type SpecialtyDetected } from "@/lib/leads/specialty-detect";
import {
  moveSizeInventoryMismatchMessage,
  moveSizeLabel,
  suggestMoveSizeFromInventory,
} from "@/lib/pricing/move-size-suggestion";
import { getVisibleAddons, ESTATE_ADDON_UI_LINES } from "@/lib/quotes/addon-visibility";
import {
  buildEstateScheduleLines,
  calculateEstateDays,
  estateLoadedLabourCost,
} from "@/lib/quotes/estate-schedule";
import { pickupLocationsFromQuote, accessLabel, abbreviateLocationRows, dropoffLocationsFromQuote } from "@/lib/quotes/quote-address-display";
import { formatAddressForDisplay } from "@/lib/format-text";
import {
  quoteDetailDateLabel,
  quoteFormSchedulingSectionTitle,
  quoteFormServiceDateLabel,
} from "@/lib/quotes/quote-field-labels";

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
  event_return_rate_preset: "auto" | "65" | "85" | "100" | "custom";
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
  inventory?: { modifier: number; score: number; benchmark: number; totalItems: number; boxCount?: number | null };
  labour?: { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null;
  truck?: {
    primary: { vehicle_type: string; display_name: string; cargo_cubic_ft: number } | null;
    secondary: { vehicle_type: string; display_name: string; cargo_cubic_ft: number } | null;
    isMultiVehicle: boolean;
    notes: string | null;
    range: string;
  } | null;
  valuation?: {
    included: Record<string, string>;
    upgrades: Record<string, { price: number; to_tier: string; assumed_shipment_value: number } | null>;
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

// ─── Constants ──────────────────────────────────

const SERVICE_TYPE_ICONS = {
  House,
  Buildings,
  OfficeChair,
  Star,
  Palette,
  CalendarBlank,
  Truck,
  Users,
  Recycle,
} as const;

const SERVICE_TYPES: {
  value: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<IconProps>;
}[] = QUOTE_SERVICE_TYPE_DEFINITIONS.map((d) => ({
  value: d.value,
  label: d.label,
  desc: d.description,
  Icon: SERVICE_TYPE_ICONS[d.iconName],
}));

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
  { value: "studio", label: "Studio", detail: "15 bins, 2 wardrobe boxes — $99" },
  { value: "1br", label: "1 Bedroom", detail: "30 bins, 4 wardrobe boxes — $179" },
  { value: "2br", label: "2 Bedroom", detail: "50 bins, 6 wardrobe boxes — $279", popular: true },
  { value: "3br", label: "3 Bedroom", detail: "70 bins, 8 wardrobe boxes — $399" },
  { value: "4br_plus", label: "4 Bedroom+", detail: "90 bins, 10 wardrobe boxes — $529" },
  { value: "custom", label: "Custom", detail: "Enter bin count (min 5) at per-bin rate" },
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

const EVENT_TRUCK_OPTIONS = [
  { value: "sprinter", label: "Sprinter (base)" },
  { value: "16ft", label: "16ft (+$75)" },
  { value: "20ft", label: "20ft (+$150)" },
  { value: "26ft", label: "26ft (+$250)" },
  { value: "none", label: "No truck (on-site)" },
] as const;

const EVENT_LEG_RETURN_RATE_OPTIONS = [
  { value: "auto", label: "Auto (65% different addresses · 85% same venue)" },
  { value: "65", label: "65% (standard delivery–return)" },
  { value: "85", label: "85% (on-site event)" },
  { value: "100", label: "100% (same effort both days)" },
  { value: "custom", label: "Custom %" },
] as const;

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
  "piano_upright", "piano_grand", "pool_table", "safe_under_300lbs", "safe_over_300lbs",
  "hot_tub", "artwork_per_piece", "antique_per_piece", "wine_collection",
  "gym_equipment_per_piece", "motorcycle", "aquarium",
];

const SPECIALTY_TYPES = [
  { value: "piano_upright",   label: "Piano (upright)" },
  { value: "piano_grand",     label: "Piano (grand)" },
  { value: "art_sculpture",   label: "Art / Sculpture" },
  { value: "antiques_estate", label: "Antiques / Estate Contents" },
  { value: "safe_vault",      label: "Safe / Vault" },
  { value: "pool_table",      label: "Pool Table" },
  { value: "hot_tub",         label: "Hot Tub / Spa" },
  { value: "wine_collection", label: "Wine Collection" },
  { value: "aquarium",        label: "Aquarium" },
  { value: "trade_show",      label: "Trade Show / Exhibition Materials" },
  { value: "medical_lab",     label: "Medical / Lab Equipment" },
  { value: "other",           label: "Other (describe below)" },
];

const SPECIALTY_WEIGHT_OPTIONS = [
  { value: "under_100",   label: "Under 100 lbs" },
  { value: "100_250",     label: "100–250 lbs" },
  { value: "250_500",     label: "250–500 lbs" },
  { value: "500_1000",    label: "500–1000 lbs" },
  { value: "over_1000",   label: "Over 1000 lbs" },
];

const SPECIALTY_REQUIREMENTS = [
  { value: "custom_crating",         label: "Custom crating required" },
  { value: "climate_controlled",     label: "Climate-controlled transport" },
  { value: "white_glove_handling",   label: "White glove handling" },
  { value: "elevated_insurance",     label: "Insurance above standard coverage" },
  { value: "disassembly_reassembly", label: "Disassembly / reassembly" },
  { value: "crane_rigging",          label: "Crane or rigging needed" },
];

const SPECIALTY_BASE_PRICES: Record<string, { min: number; max: number }> = {
  piano_upright:   { min: 400,  max: 800 },
  piano_grand:     { min: 800,  max: 2000 },
  art_sculpture:   { min: 300,  max: 1500 },
  antiques_estate: { min: 500,  max: 3000 },
  safe_vault:      { min: 400,  max: 1200 },
  pool_table:      { min: 600,  max: 1500 },
  hot_tub:         { min: 800,  max: 2000 },
  wine_collection: { min: 400,  max: 1500 },
  aquarium:        { min: 500,  max: 1500 },
  trade_show:      { min: 500,  max: 2000 },
  medical_lab:     { min: 600,  max: 2500 },
  other:           { min: 300,  max: 2000 },
};

const SPECIALTY_WEIGHT_PREVIEW_MULT: Record<string, number> = {
  under_100: 0.94,
  100_250: 0.97,
  250_500: 1,
  500_1000: 1.06,
  over_1000: 1.12,
};

const ITEM_CATEGORIES = [
  { value: "standard_furniture", label: "Standard furniture" },
  { value: "large_heavy", label: "Large / heavy" },
  { value: "fragile_specialty", label: "Fragile / specialty" },
  { value: "appliance", label: "Appliance" },
  { value: "multiple_2_to_5", label: "Multiple (2-5 items)" },
  { value: "oversized", label: "Oversized" },
];

const WEIGHT_CLASSES = ["Under 50 lbs", "50-150 lbs", "150-300 lbs", "300-500 lbs", "Over 500 lbs"];
const ASSEMBLY_OPTIONS = ["None", "Disassembly at pickup", "Assembly at delivery", "Both"];
const PROJECT_TYPES = [
  "Art installation", "Trade show", "Estate cleanout", "Home staging",
  "Wine transport", "Medical equipment", "Piano move", "Event setup/teardown", "Custom",
];
const TIMING_PREFS = ["Weekday business hours", "Evening/night", "Weekend", "Phased multi-day"];

const TAX_RATE = 0.13;

// ─── Helpers ────────────────────────────────────

const fieldInput = "field-input-compact w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
function parseB2bQuoteFormFields(v: QuoteDeliveryVertical | null): B2bQuoteFormField[] {
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
        placeholder: typeof o.placeholder === "string" ? o.placeholder : undefined,
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

function mapB2bEmbedLinesToQuoteRows(s: B2BJobsEmbedSnapshot): B2bLineRow[] {
  return s.lines.map((l) => ({
    description: l.description,
    qty: l.quantity,
    weight_category: l.weight_category,
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
  if (pickups.length >= 1 && drops.length >= 1 && pickups.length + drops.length === 2) {
    return synthesizeStopsFromAddresses(pickups[0]!, drops[0]!, fromAccess, toAccess);
  }
  if (pickups.length + drops.length < 2) {
    return synthesizeStopsFromAddresses(fromAddress, toAddress, fromAccess, toAccess);
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
  if (vertical.code === "flooring" && typeof legacyBox === "number" && legacyBox >= 1) {
    return [{ description: "Flooring / building materials", qty: legacyBox }];
  }
  return lines;
}

function parseCfgJson<T>(config: Record<string, string>, key: string, fallback: T): T {
  try { const v = config[key]; return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
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
  const accessMap = parseCfgJson<Record<string, number>>(config, "b2b_access_surcharges", {});
  const accessKey = (k: string | undefined): string => (k === "no_parking_nearby" ? "no_parking" : (k ?? ""));
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
  const parkingRates = parseCfgJson<Record<string, number>>(config, "parking_surcharges", {
    dedicated: 0,
    street: 0,
    no_dedicated: 75,
  });
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
const CRATING_SIZE_FALLBACK: Record<string, number> = { small: 175, medium: 250, large: 350, oversized: 500 };

// Default inventory scores by move size when no items have been entered yet
const DEFAULT_INVENTORY_SCORE: Record<string, number> = {
  studio: 8, "1br": 16, "2br": 28, "3br": 45, "4br": 60, "5br_plus": 80, partial: 6,
};

// Mirrors DEFAULT_DAY_OF_WEEK_MULTIPLIER from generate/route.ts
const DOW_MULTIPLIER: Record<string, number> = {
  sunday: 1.10,
  monday: 1.0,
  tuesday: 1.0,
  wednesday: 1.0,
  thursday: 1.0,
  friday: 1.05,
  saturday: 1.10,
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
): { essential: number; signature: number; estate: number } | null {
  if (serviceType !== "local_move" && serviceType !== "long_distance") return null;
  if (!moveSize.trim()) return null;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  const labourRate = cfgNum(config, "labour_rate_per_mover_hour", 45);
  const minAmt = cfgNum(config, "minimum_job_amount", 549);

  const score = (inventoryScore ?? 0) > 0 ? inventoryScore! : (DEFAULT_INVENTORY_SCORE[moveSize] ?? 28);

  // Crew size from inventory score
  let crew = 2;
  if (score >= 30) crew = 3;
  if (score >= 55) crew = 4;
  if (score >= 80) crew = 5;

  // Specialty item crew bumps
  const heavy = ["piano_grand", "pool_table", "safe_over_300", "safe_over_300lbs", "hot_tub"];
  if (specialtyItems?.some((i) => heavy.includes(i.type) && i.qty > 0)) crew = Math.max(crew, 4);
  else if (specialtyItems?.some((i) => i.qty > 0)) crew = Math.max(crew, 3);

  // Hard access crew bump
  const hardAccess = ["walk_up_3", "walk_up_3rd", "walk_up_4_plus", "walk_up_4plus", "walk_up_4th", "walk_up_4th_plus"];
  if (fromAccess && hardAccess.includes(fromAccess)) crew += 1;
  if (toAccess && hardAccess.includes(toAccess)) crew += 1;
  crew = Math.min(6, crew);

  // Hours estimate (no drive time — preview only)
  const DISASSEMBLY: Record<string, number> = { studio: 0.25, "1br": 0.5, "2br": 0.75, "3br": 1.0, "4br": 1.25, "5br_plus": 1.5, partial: 0.25 };
  const MIN_HRS: Record<string, number> = { studio: 2.5, "1br": 3.5, "2br": 4.5, "3br": 5.5, "4br": 7.0, "5br_plus": 8.5, partial: 2.0 };
  const loadHrs = score / 12;
  const unloadHrs = loadHrs * 0.75;
  const disassemblyHrs = DISASSEMBLY[moveSize] ?? 0.5;
  const accessPenalty = (ACCESS_PENALTY[fromAccess ?? ""] ?? 0) + (ACCESS_PENALTY[toAccess ?? ""] ?? 0);
  let totalHrs = 0.75 + loadHrs + unloadHrs + disassemblyHrs + accessPenalty;
  totalHrs = Math.round(totalHrs * 2) / 2;
  totalHrs = Math.max(MIN_HRS[moveSize] ?? 3.0, totalHrs);

  // Day-of-week multiplier (matches server-side DEFAULT_DAY_OF_WEEK_MULTIPLIER)
  let dateMult = 1.0;
  if (moveDate) {
    const d = new Date(moveDate + "T00:00:00");
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];
    dateMult = DOW_MULTIPLIER[dayName] ?? 1.0;
  }

  const baseLabour = crew * totalHrs * labourRate * dateMult;
  const curBase = Math.max(roundTo(baseLabour, rounding), minAmt);
  const sig = roundTo(curBase * cfgNum(config, "tier_signature_multiplier", cfgNum(config, "tier_premier_multiplier", 1.50)), rounding);
  const loadedRate = cfgNum(config, "crew_loaded_hourly_rate", cfgNum(config, "labour_rate_per_mover_hour", 28));
  const estatePlan = calculateEstateDays(moveSize, score);
  const estateMultiLoaded = estateLoadedLabourCost(estatePlan, loadedRate);
  const singleLoadedPreview = Math.round(crew * totalHrs * loadedRate);
  const estateLabourUplift = Math.max(0, estateMultiLoaded - singleLoadedPreview);
  const est =
    roundTo(curBase * cfgNum(config, "tier_estate_multiplier", 3.15), rounding) + roundTo(estateLabourUplift, rounding);

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
  const distSur = km > distBaseKm ? Math.round((km - distBaseKm) * distRateKm) : 0;
  const extras =
    (opts.craneRigging ? 750 : 0) + (opts.climateControlled ? 150 : 0) + opts.cratingSum;
  const min = roundTo(range.min * wMult + distSur + extras, rounding);
  const max = roundTo(range.max * wMult + distSur + extras, rounding);
  return { min, max, distSur, km };
}

function fmtPrice(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
  binInventorySnapshot?: { total: number; out: number; available: number } | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const hubspotDealId = searchParams.get("hubspot_deal_id") || "";
  const leadIdParam = searchParams.get("lead_id")?.trim() || "";
  const specialtyBuilderQs = searchParams.get("specialty_builder") === "1";

  // ── Form state ────────────────────────────
  const [serviceType, setServiceType] = useState("local_move");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Client dedup / contact search state ──────────────────────────────────
  const [clientSearching, setClientSearching] = useState(false);
  const [clientDedupResult, setClientDedupResult] = useState<{
    hubspot: { hubspot_id: string; first_name: string; last_name: string; email: string; phone: string; company: string; deal_ids: string[] } | null;
    square: { square_id: string; card_on_file: boolean; card_last_four: string; card_brand: string; card_id: string } | null;
    opsClient: { id: string; name: string; email: string } | null;
    opsPrevMove: { move_number: string; move_date: string; move_size: string; from_address: string; to_address: string } | null;
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
  const [fromParking, setFromParking] = useState<"dedicated" | "street" | "no_dedicated">("dedicated");
  const [toParking, setToParking] = useState<"dedicated" | "street" | "no_dedicated">("dedicated");
  const [fromLongCarry, setFromLongCarry] = useState(false);
  const [toLongCarry, setToLongCarry] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState(() => TIME_WINDOW_OPTIONS[1] ?? TIME_WINDOW_OPTIONS[0] ?? "");
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

  // Specialty items
  const [specialtyItems, setSpecialtyItems] = useState<{ type: string; qty: number }[]>([]);

  // Office fields
  const [sqft, setSqft] = useState("");
  const [wsCount, setWsCount] = useState("");
  const [hasIt, setHasIt] = useState(false);
  const [hasConf, setHasConf] = useState(false);
  const [hasReception, setHasReception] = useState(false);
  const [timingPref, setTimingPref] = useState("");
  const [officeCrewSize, setOfficeCrewSize] = useState(2);
  const [officeEstHours, setOfficeEstHours] = useState(5);

  // Single item fields
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("standard_furniture");
  const [itemWeight, setItemWeight] = useState("");
  const [assembly, setAssembly] = useState("None");
  const [stairCarry, setStairCarry] = useState(false);
  const [stairFlights, setStairFlights] = useState(1);
  const [numItems, setNumItems] = useState(1);
  const [singleItemSpecialHandling, setSingleItemSpecialHandling] = useState("");

  // White glove
  const [declaredValue, setDeclaredValue] = useState("");

  // Specialty (dedicated item move)
  const [specialtyType, setSpecialtyType] = useState("");
  const [specialtyItemDescription, setSpecialtyItemDescription] = useState("");
  const [specialtyDimL, setSpecialtyDimL] = useState("");
  const [specialtyDimW, setSpecialtyDimW] = useState("");
  const [specialtyDimH, setSpecialtyDimH] = useState("");
  const [specialtyWeightClass, setSpecialtyWeightClass] = useState("");
  const [specialtyRequirements, setSpecialtyRequirements] = useState<string[]>([]);
  const [specialtyNotes, setSpecialtyNotes] = useState("");
  const [specialtyBuildingReqs, setSpecialtyBuildingReqs] = useState<string[]>([]);
  const [specialtyAccessDifficulty, setSpecialtyAccessDifficulty] = useState("");

  // Event fields
  const [eventName, setEventName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [extraVenueStops, setExtraVenueStops] = useState<StopEntry[]>([]);
  const [eventReturnDate, setEventReturnDate] = useState("");
  const [eventSetupRequired, setEventSetupRequired] = useState(false);
  const [eventSetupHours, setEventSetupHours] = useState(2);
  const [eventSetupInstructions, setEventSetupInstructions] = useState("");
  const [eventSameDay, setEventSameDay] = useState(false);
  const [eventPickupTimeAfter, setEventPickupTimeAfter] = useState("Evening 6–9 PM");
  const [eventItems, setEventItems] = useState<{ name: string; quantity: number; weight_category: "light" | "medium" | "heavy" }[]>([]);
  const [eventAdditionalServices, setEventAdditionalServices] = useState<string[]>([]);
  const [eventMulti, setEventMulti] = useState(false);
  const [eventLuxury, setEventLuxury] = useState(false);
  const [eventComplexSetup, setEventComplexSetup] = useState(false);
  const [eventTruckType, setEventTruckType] = useState("sprinter");
  const [eventSameLocationSingle, setEventSameLocationSingle] = useState(false);
  const [eventReturnRateSingle, setEventReturnRateSingle] = useState<"auto" | "65" | "85" | "100" | "custom">("auto");
  const [eventReturnRateCustomSingle, setEventReturnRateCustomSingle] = useState("");
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
  const [specialtyRouteLoading, setSpecialtyRouteLoading] = useState(false);

  // B2B One-Off fields (dimensional engine)
  const [b2bBusinessName, setB2bBusinessName] = useState("");
  const [b2bVerticalCode, setB2bVerticalCode] = useState("");
  const [b2bPartnerOrgId, setB2bPartnerOrgId] = useState("");
  const [b2bLines, setB2bLines] = useState<B2bLineRow[]>([]);
  const [b2bTimeBand, setB2bTimeBand] = useState<"morning" | "afternoon" | "after_hours">("morning");
  const [b2bCatalogOpenIdx, setB2bCatalogOpenIdx] = useState<number | null>(null);
  const [b2bPriceOverrideOn, setB2bPriceOverrideOn] = useState(false);
  const [b2bPreTaxOverrideAmount, setB2bPreTaxOverrideAmount] = useState("");
  const [b2bPartnersList, setB2bPartnersList] = useState<{ id: string; name: string }[]>([]);
  const [b2bPartnerVerticals, setB2bPartnerVerticals] = useState<{ code: string; name: string }[]>([]);
  const [b2bWeightCategory, setB2bWeightCategory] = useState("standard");
  const [b2bSpecialInstructions, setB2bSpecialInstructions] = useState("");
  const [b2bOverrideReason, setB2bOverrideReason] = useState("");
  const [b2bArtHangingCount, setB2bArtHangingCount] = useState("");
  const [b2bCratingPieces, setB2bCratingPieces] = useState("");
  const [b2bPreviewDistanceKm, setB2bPreviewDistanceKm] = useState<number | null>(null);
  const [b2bPreviewDriveMin, setB2bPreviewDriveMin] = useState<number | null>(null);
  const [b2bDeliveryKmFromGta, setB2bDeliveryKmFromGta] = useState<number | null>(null);
  const [b2bRouteLoading, setB2bRouteLoading] = useState(false);
  const [b2bSubmitErrors, setB2bSubmitErrors] = useState<Record<string, string>>({});
  const [b2bVerticalExtras, setB2bVerticalExtras] = useState<Record<string, number>>({});
  const [b2bEmbedSnapshot, setB2bEmbedSnapshot] = useState<B2BJobsEmbedSnapshot | null>(null);

  /** Prefer live embed vertical so sidebar preview matches the B2B form (same rules as partner-filtered dropdown). */
  const effectiveB2bVerticalCode = useMemo(() => {
    const fromSnap = b2bEmbedSnapshot?.verticalCode?.trim();
    if (fromSnap && deliveryVerticals.some((v) => v.code === fromSnap)) return fromSnap;
    const fromState = b2bVerticalCode.trim();
    if (fromState && deliveryVerticals.some((v) => v.code === fromState)) return fromState;
    const noOffice = (v: QuoteDeliveryVertical) => !B2B_OFFICE_VERTICAL_CODES.has(v.code.trim().toLowerCase());
    let pool = deliveryVerticals.filter(noOffice);
    if (b2bPartnerOrgId.trim() && b2bPartnerVerticals.length > 0) {
      const allow = new Set(b2bPartnerVerticals.map((v) => v.code));
      pool = pool.filter((v) => allow.has(v.code));
    }
    return pool[0]?.code ?? "custom";
  }, [b2bEmbedSnapshot?.verticalCode, b2bVerticalCode, deliveryVerticals, b2bPartnerOrgId, b2bPartnerVerticals]);

  const selectedB2bVertical = useMemo(
    () => deliveryVerticals.find((v) => v.code === effectiveB2bVerticalCode) ?? null,
    [deliveryVerticals, effectiveB2bVerticalCode],
  );

  const b2bAfterHoursDerived = b2bTimeBand === "after_hours";

  const b2bLivePreviewTitle = useMemo(() => {
    if (!selectedB2bVertical) return "B2B Delivery";
    return B2B_PREVIEW_HEADER_BY_CODE[selectedB2bVertical.code] ?? selectedB2bVertical.name;
  }, [selectedB2bVertical]);

  const b2bAutoSameDay = useMemo(() => {
    if ((serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") || !selectedB2bVertical || !moveDate.trim())
      return false;
    if (!isMoveDateTodayToronto(moveDate)) return false;
    const merged = selectedB2bVertical.default_config as Record<string, unknown>;
    const sched = (merged.schedule_surcharges || {}) as Record<string, unknown>;
    const sd = typeof sched.same_day === "number" ? sched.same_day : Number(sched.same_day);
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
    if (wlr && typeof wlr === "object" && !Array.isArray(wlr) && Object.keys(wlr as object).length > 0) return true;
    const wt = dc.weight_tiers;
    return Boolean(wt && typeof wt === "object" && !Array.isArray(wt) && Object.keys(wt as object).length > 0);
  }, [selectedB2bVertical]);

  const b2bShowArtCratingFields = useMemo(() => {
    if (!selectedB2bVertical) return false;
    if (selectedB2bVertical.code === "art_gallery") return true;
    const p = selectedB2bVertical.default_config?.complexity_premiums;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const pr = p as Record<string, unknown>;
      const hang = Number(pr.art_hanging_per_piece);
      const cr = Number(pr.crating_per_piece);
      return (Number.isFinite(hang) && hang > 0) || (Number.isFinite(cr) && cr > 0);
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
    if (s.lines.length === 0 && s.verticalCode === "flooring" && Number.isFinite(box) && box >= 1) {
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
          list.map((p: { id: string; name: string }) => ({ id: String(p.id), name: String(p.name || "") })),
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
    fetch(`/api/admin/organizations/${encodeURIComponent(id)}/partner-b2b-verticals`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.verticals) ? d.verticals : [];
        setB2bPartnerVerticals(
          list.map((x: { code: string; name: string }) => ({ code: String(x.code), name: String(x.name || x.code) })),
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

  // Bin rental
  const [binPickupSameAsDelivery, setBinPickupSameAsDelivery] = useState(true);
  const [binBundleType, setBinBundleType] = useState<"studio" | "1br" | "2br" | "3br" | "4br_plus" | "custom">("2br");
  const [binCustomCount, setBinCustomCount] = useState(10);
  const [binExtraBins, setBinExtraBins] = useState(0);
  const [binPackingPaper, setBinPackingPaper] = useState(false);
  const [binMaterialDelivery, setBinMaterialDelivery] = useState(true);
  const [binLinkedMoveId, setBinLinkedMoveId] = useState("");
  const [binDeliveryNotes, setBinDeliveryNotes] = useState("");
  const [binInternalNotes, setBinInternalNotes] = useState("");

  // Custom crating (all service types — coordinator decides per quote)
  const [cratingRequired, setCratingRequired] = useState(false);
  const [cratingItems, setCratingItems] = useState<{ description: string; size: "small" | "medium" | "large" | "oversized" }[]>([]);

  // Recommended tier (coordinator judgment)
  const [recommendedTier, setRecommendedTier] = useState<"essential" | "signature" | "estate">("signature");

  // Add-ons
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(new Map());

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>([]);
  const [leadIntelSummary, setLeadIntelSummary] = useState<string | null>(null);
  const [leadInventoryReview, setLeadInventoryReview] = useState<LeadInvReviewRow[]>([]);
  const leadInventoryPrefillSigRef = useRef<string>("");
  const leadSpecialtyPrefillSigRef = useRef<string>("");

  // Referral code
  const [referralCode, setReferralCode] = useState("");
  const [referralId, setReferralId] = useState<string | null>(null);
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [referralMsg, setReferralMsg] = useState("");
  const [referralDiscount, setReferralDiscount] = useState(0);

  // Draft auto-save
  const quoteDraftState = useMemo(() => ({
    serviceType, firstName, lastName, email, phone,
    fromAddress, toAddress, fromAccess, toAccess,
    moveDate, preferredTime, arrivalWindow, moveSize,
    b2bBusinessName, eventName, labourDescription,
    itemDescription, specialtyType, declaredValue,
  }), [serviceType, firstName, lastName, email, phone, fromAddress, toAddress, fromAccess, toAccess, moveDate, preferredTime, arrivalWindow, moveSize, b2bBusinessName, eventName, labourDescription, itemDescription, specialtyType, declaredValue]);

  const quoteDraftTitleFn = useCallback((s: typeof quoteDraftState) => {
    const name = [s.firstName, s.lastName].filter(Boolean).join(" ");
    return name || s.b2bBusinessName || s.eventName || "Quote";
  }, []);

  const applyQuoteDraftFromStorage = useCallback((d: Record<string, unknown>) => {
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
    if (d.labourDescription) setLabourDescription(d.labourDescription as string);
    if (d.itemDescription) setItemDescription(d.itemDescription as string);
    if (d.specialtyType) setSpecialtyType(d.specialtyType as string);
    if (d.declaredValue) setDeclaredValue(d.declaredValue as string);
  }, []);

  const { hasDraft: quoteHasDraft, restoreDraft: quoteRestoreDraft, dismissDraft: quoteDismissDraft, clearDraft: quoteClearDraft } = useFormDraft("quote", quoteDraftState, quoteDraftTitleFn, {
    applySaved: applyQuoteDraftFromStorage as (data: typeof quoteDraftState) => void,
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

      const [opsRes, hubspotRes, squareRes] = await Promise.allSettled([opsP, hubspotP, squareP]);

      const ops = opsRes.status === "fulfilled" ? opsRes.value : null;
      const hubspot = hubspotRes.status === "fulfilled" ? hubspotRes.value?.contact ?? null : null;
      const square = squareRes.status === "fulfilled" ? squareRes.value?.customer ?? null : null;

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
      if (hubspot.email && !email.trim()) setEmail(hubspot.email.trim().toLowerCase());
      if (hubspot.phone && !phone) {
          setPhone(formatPhone(hubspot.phone));
      }
      if (serviceType === "b2b_delivery" && hubspot.company && !b2bBusinessName.trim()) {
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
        setReferralMsg(`Valid! $${data.discount || 75} off. Referred by ${data.referrer_name}.`);
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

  // Quote result (set only after successful generate; required for Send)
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const [hubspotLoaded, setHubspotLoaded] = useState(false);
  const [hubspotBanner, setHubspotBanner] = useState("");
  const [leadQuoteBanner, setLeadQuoteBanner] = useState("");
  const [leadRequiresSpecialtyQuote, setLeadRequiresSpecialtyQuote] = useState(false);
  const [leadParsedWeightMax, setLeadParsedWeightMax] = useState<number | null>(null);
  const [leadParsedDimensions, setLeadParsedDimensions] = useState("");
  const [leadCompletenessPath, setLeadCompletenessPath] = useState<string | null>(null);
  const [specialtyBuilderOpen, setSpecialtyBuilderOpen] = useState(false);
  const [specialtyBannerDismissed, setSpecialtyBannerDismissed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const prefillDone = useRef(false);

  // Contact search for auto-fill (same as Create Move)
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [dbContacts, setDbContacts] = useState<
    { hubspot_id: string; name: string; email: string; phone: string; company: string; address: string; postal: string }[]
  >([]);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const contactSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (contactSearchTimerRef.current) clearTimeout(contactSearchTimerRef.current);
    if (!contactSearch || contactSearch.length < 2) {
      setDbContacts([]);
      return;
    }
    contactSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(contactSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setDbContacts(data.contacts || []);
        }
      } catch {
        /* ignore */
      }
    }, 300);
    return () => {
      if (contactSearchTimerRef.current) clearTimeout(contactSearchTimerRef.current);
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

  const inventoryScore = useMemo(() => {
    return inventoryItems.reduce((sum, i) => sum + i.weight_score * i.quantity, 0);
  }, [inventoryItems]);

  const inventoryTotalItems = useMemo(() => {
    return inventoryItems.reduce((sum, i) => sum + i.quantity, 0);
  }, [inventoryItems]);

  const clientBoxCountNum = Number(clientBoxCount) || 0;
  const boxScore = clientBoxCountNum * 0.3;
  const inventoryScoreWithBoxes = inventoryScore + boxScore;

  const moveSizeSuggestion = useMemo(() => {
    if (inventoryItems.length === 0) return null;
    return suggestMoveSizeFromInventory(
      inventoryItems.map((i) => ({ name: i.name, quantity: i.quantity })),
      clientBoxCountNum,
      inventoryScore,
    );
  }, [inventoryItems, clientBoxCountNum, inventoryScore]);

  useEffect(() => {
    if (
      serviceType !== "local_move" &&
      serviceType !== "long_distance" &&
      serviceType !== "white_glove"
    ) {
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
        const res = await fetch(`/api/hubspot/get-deal?dealId=${encodeURIComponent(hubspotDealId)}`);
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
        setHubspotBanner(`Pre-filled from HubSpot Deal #${d.jobNo || hubspotDealId}`);
        setHubspotLoaded(true);
      } catch {
        /* ignore */
      }
    })();
  }, [hubspotDealId]);

  // ── Lead pre-fill (Send Quote from Leads dashboard) ────
  useEffect(() => {
    if (!leadIdParam) {
      setLeadQuoteBanner("");
      setLeadIntelSummary(null);
      setLeadInventoryReview([]);
      setLeadRequiresSpecialtyQuote(false);
      setLeadParsedWeightMax(null);
      setLeadParsedDimensions("");
      setLeadCompletenessPath(null);
      leadInventoryPrefillSigRef.current = "";
      leadSpecialtyPrefillSigRef.current = "";
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadIdParam)}`);
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
          setLeadQuoteBanner(nm ? `Creating quote for lead ${num} — ${nm}` : `Creating quote for lead ${num}`);
        }
        if (fn) setFirstName(fn);
        if (ln) setLastName(ln);
        if (str(L.email)) setEmail(str(L.email).toLowerCase());
        if (str(L.phone)) setPhone(formatPhone(str(L.phone)));
        const st = str(L.service_type);
        if (st === "b2b_oneoff") {
          setServiceType("b2b_delivery");
        } else if (st && SERVICE_TYPES.some((x) => x.value === st)) {
          setServiceType(st);
        }
        setLeadRequiresSpecialtyQuote(!!L.requires_specialty_quote);
        setLeadCompletenessPath(str(L.completeness_path) || null);
        const pwm = L.parsed_weight_lbs_max != null ? Number(L.parsed_weight_lbs_max) : NaN;
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
        if (rt === "estate") setRecommendedTier("estate");
        else if (rt === "signature") setRecommendedTier("signature");
        else if (rt === "curated") setRecommendedTier("essential");
        const pbc = L.parsed_box_count != null ? Number(L.parsed_box_count) : NaN;
        if (!Number.isNaN(pbc) && pbc > 0) setClientBoxCount(String(pbc));
        const an = str(L.assembly_needed).toLowerCase();
        if (an === "both") setAssembly("Both");
        else if (an === "yes" || an === "true") setAssembly("Both");

        const summary = str(L.intelligence_summary);
        setLeadIntelSummary(summary || null);

        const rawInv = L.parsed_inventory;
        const review: LeadInvReviewRow[] = [];
        const autoItems: InventoryItemEntry[] = [];
        const invSig =
          Array.isArray(rawInv) && rawInv.length > 0
            ? `${leadIdParam}:${itemWeights.length}:${JSON.stringify(rawInv)}`
            : `empty:${leadIdParam}`;
        if (invSig !== leadInventoryPrefillSigRef.current) {
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
                autoItems.push({
                  slug: slug!,
                  name: w?.item_name || String(row.matched_name || slug),
                  quantity: qty,
                  weight_score: Number(w?.weight_score ?? row.weight_score ?? 1),
                  fragile: false,
                });
              } else {
                review.push({
                  raw_text: String(row.raw_text || ""),
                  matched_item: slug,
                  matched_name: row.matched_name ? String(row.matched_name) : null,
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
        }

        const specRaw = L.specialty_items_detected;
        const specSig =
          Array.isArray(specRaw) && specRaw.length > 0
            ? `${leadIdParam}:${JSON.stringify(specRaw)}`
            : `empty:${leadIdParam}`;
        if (specSig !== leadSpecialtyPrefillSigRef.current) {
          if (!Array.isArray(specRaw) || specRaw.length === 0) {
            setSpecialtyItems([]);
          } else {
            const blob = `${str(L.raw_inventory_text)} ${str(L.message)}`;
            const mapped = mapSpecialtyToQuoteTypes(specRaw as SpecialtyDetected[], blob);
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
  }, [leadIdParam, itemWeights]);

  useEffect(() => {
    if (specialtyBuilderQs) setSpecialtyBuilderOpen(true);
  }, [specialtyBuilderQs]);

  const singleItemLbs = useMemo(() => {
    const n = parseFloat(String(itemWeight).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [itemWeight]);

  const showSpecialtyQuoteBanner = useMemo(() => {
    if (userRole === "viewer") return false;
    if (specialtyBannerDismissed) return false;
    return (
      leadRequiresSpecialtyQuote ||
      (leadCompletenessPath === "manual_review" && !!leadIdParam) ||
      serviceType === "specialty" ||
      serviceType === "b2b_delivery" ||
      (serviceType === "single_item" && singleItemLbs > 300)
    );
  }, [
    userRole,
    specialtyBannerDismissed,
    leadRequiresSpecialtyQuote,
    leadCompletenessPath,
    leadIdParam,
    serviceType,
    singleItemLbs,
  ]);

  const specialtyBuilderItemDescription = useMemo(() => {
    if (serviceType === "single_item" && itemDescription.trim()) return itemDescription.trim();
    if (serviceType === "specialty" && specialtyItemDescription.trim()) return specialtyItemDescription.trim();
    return itemDescription.trim() || specialtyItemDescription.trim();
  }, [serviceType, itemDescription, specialtyItemDescription]);

  const specialtyBuilderWeightStr = useMemo(() => {
    if (serviceType === "single_item" && itemWeight.trim()) return itemWeight.trim();
    if (leadParsedWeightMax != null) return String(Math.round(leadParsedWeightMax));
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
        const entry: InventoryItemEntry = {
          slug: row.matched_item,
          name: w?.item_name || row.matched_name || row.matched_item,
          quantity: row.quantity,
          weight_score: Number(w?.weight_score ?? 1),
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
    const base = [...allAddons.filter((a) => a.applicable_service_types.includes(serviceType))].sort(
      (a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0),
    );
    if (serviceType === "local_move" || serviceType === "long_distance") {
      return getVisibleAddons(base, recommendedTier);
    }
    return base;
  }, [allAddons, serviceType, recommendedTier]);
  const popularAddons = useMemo(() => applicableAddons.filter((a) => a.is_popular), [applicableAddons]);
  const otherAddons = useMemo(() => applicableAddons.filter((a) => !a.is_popular), [applicableAddons]);
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
    setB2bLines([]);
    setSqft("");
    setWsCount("");
    setHasIt(false);
    setHasConf(false);
    setHasReception(false);
    setTimingPref("");
    setOfficeCrewSize(2);
    setOfficeEstHours(5);
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
    if (serviceType !== "specialty") {
      setSpecialtyRouteKm(null);
      return;
    }
    const from = fromAddress.trim();
    const to = toAddress.trim();
    if (from.length < 8 || to.length < 8) {
      setSpecialtyRouteKm(null);
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
        const data = await res.json();
        if (res.ok && typeof data.distance_km === "number") {
          setSpecialtyRouteKm(data.distance_km);
        } else {
          setSpecialtyRouteKm(null);
        }
      } catch {
        setSpecialtyRouteKm(null);
      } finally {
        setSpecialtyRouteLoading(false);
      }
    }, 750);
    return () => clearTimeout(handle);
  }, [serviceType, fromAddress, toAddress]);

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

  /** Specialty suggested $ range: base band × weight + distance (Mapbox) + crane/climate/crating */
  const specialtyLivePreview = useMemo(() => {
    if (serviceType !== "specialty" || !specialtyType) return null;
    const range = SPECIALTY_BASE_PRICES[specialtyType];
    if (!range) return null;
    const priceMap = parseCfgJson<Record<string, number>>(config, "crating_prices", CRATING_SIZE_FALLBACK);
    const cratingSum =
      cratingRequired && cratingItems.length > 0
        ? cratingItems.reduce((sum, p) => sum + (priceMap[p.size] ?? CRATING_SIZE_FALLBACK[p.size] ?? 250), 0)
        : 0;
    const band = specialtyPreviewBand(config, range, {
      weightClass: specialtyWeightClass,
      distanceKm: specialtyRouteKm,
      craneRigging: specialtyRequirements.includes("crane_rigging"),
      climateControlled: specialtyRequirements.includes("climate_controlled"),
      cratingSum,
    });
    const typeLabel = SPECIALTY_TYPES.find((t) => t.value === specialtyType)?.label ?? specialtyType;
    const weightLabel = SPECIALTY_WEIGHT_OPTIONS.find((w) => w.value === specialtyWeightClass)?.label;
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

  // ── Quick optimistic estimate — updates on ANY pricing-relevant change ──────
  const liveEstimate = useMemo(
    () => quickEstimate(
      config,
      serviceType,
      moveSize,
      addonSubtotal,
      fromAccess || undefined,
      toAccess || undefined,
      inventoryScoreWithBoxes > 0 ? inventoryScoreWithBoxes : undefined,
      specialtyItems.length > 0 ? specialtyItems : undefined,
      moveDate || undefined,
    ),
    [config, serviceType, moveSize, addonSubtotal, fromAccess, toAccess, inventoryScoreWithBoxes, specialtyItems, moveDate],
  );

  const configMap = useMemo(() => new Map(Object.entries(config)), [config]);

  const binLivePreview = useMemo(() => {
    if (serviceType !== "bin_rental") return null;
    const linked = binLinkedMoveId.trim() || null;
    const fleetCap = cfgNum(config, "bin_total_inventory", 500);
    const avail =
      binInventorySnapshot != null && Number.isFinite(binInventorySnapshot.available)
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
  ]);

  useEffect(() => {
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") return;
    const handle = window.setTimeout(() => {
      const run = async () => {
        let body: Record<string, unknown>;
        const route = b2bRouteAddressesFromForm(fromAddress, toAddress, extraFromStops, extraToStops);
        if (route.length >= 2) {
          body = route.length > 2 ? { b2b_stops: route } : { from_address: route[0], to_address: route[route.length - 1] };
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
              typeof data.drive_time_min === "number" ? data.drive_time_min : null,
            );
            setB2bDeliveryKmFromGta(
              typeof data.delivery_km_from_gta_core === "number" ? data.delivery_km_from_gta_core : null,
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
    () => getEffectiveB2bLines(b2bLines, selectedB2bVertical, b2bVerticalExtras),
    [b2bLines, selectedB2bVertical, b2bVerticalExtras],
  );

  const [debouncedB2bLines, setDebouncedB2bLines] = useState<B2bLineRow[]>(b2bLines);
  useEffect(() => {
    const h = window.setTimeout(() => setDebouncedB2bLines(b2bLines), 300);
    return () => clearTimeout(h);
  }, [b2bLines]);

  const effectiveB2bLinesPreview = useMemo(
    () => getEffectiveB2bLines(debouncedB2bLines, selectedB2bVertical, b2bVerticalExtras),
    [debouncedB2bLines, selectedB2bVertical, b2bVerticalExtras],
  );

  /** Straight-line km from GTA core → platform zone surcharges (always applied on top of route pricing). */
  const b2bPlatformGtaZoneLines = useMemo(() => {
    const km = b2bDeliveryKmFromGta;
    const z2 = cfgNum(config, "b2b_gta_zone2_surcharge", 75);
    const z3 = cfgNum(config, "b2b_gta_zone3_surcharge", 150);
    const lines: { label: string; amount: number }[] = [];
    if (km != null) {
      if (km >= 80) {
        if (z3 > 0) lines.push({ label: "Outside GTA core (zone 3: 80+ km)", amount: z3 });
      } else if (km >= 40) {
        if (z2 > 0) lines.push({ label: "Outside GTA core (zone 2: 40–80 km)", amount: z2 });
      }
    }
    return lines;
  }, [b2bDeliveryKmFromGta, config]);

  const b2bPlatformWeekendLine = useMemo(() => {
    const wk = cfgNum(config, "b2b_weekend_surcharge", 40);
    if (!isMoveDateWeekend(moveDate) || wk <= 0) return null;
    return { label: "Weekend delivery", amount: wk };
  }, [moveDate, config]);

  const b2bDimensionalPreview = useMemo(() => {
    if ((serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") || !selectedB2bVertical) return null;
    const merged = mergeBundleTierIntoMergedRates({
      ...(selectedB2bVertical.default_config as Record<string, unknown>),
    });
    const useVerticalZoneSchedule = String(merged.distance_mode || "") === "zones";
    const sched = (merged.schedule_surcharges || {}) as Record<string, unknown>;
    const schedWeekend = typeof sched.weekend === "number" ? sched.weekend : Number(sched.weekend);
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
      ...(verticalHandlesWeekend ? [] : b2bPlatformWeekendLine ? [b2bPlatformWeekendLine] : []),
    ];
    const rawLines = effectiveB2bLinesPreview.filter((l) => l.description.trim() && l.qty >= 1);
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
        weight_category: l.weight_category as B2BWeightCategory | undefined,
        weight_lbs:
          typeof l.weight_lbs === "number" && Number.isFinite(l.weight_lbs) && l.weight_lbs > 0
            ? l.weight_lbs
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
    const stops: B2BDimensionalQuoteInput["stops"] = b2bDimensionalStopsFromForm(
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
    const stairsParsed = snap?.stairsFlights?.trim() ? Number(snap.stairsFlights.trim()) : NaN;
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
      stairs_flights: Number.isFinite(stairsParsed) && stairsParsed > 0 ? stairsParsed : undefined,
      addons: addons.length > 0 ? addons : undefined,
      skid_count: (() => {
        const n = snap?.skidCount?.trim() ? Number(snap.skidCount.trim()) : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      total_load_weight_lbs: (() => {
        const n = snap?.totalLoadWeightLbs?.trim() ? Number(snap.totalLoadWeightLbs.trim()) : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      haul_away_units: (() => {
        const n = snap?.haulAwayUnits?.trim() ? Number(snap.haulAwayUnits.trim()) : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),
      returns_pickup: snap?.returnsPickup ?? false,
      art_hanging_count: Number.isFinite(artN) && artN > 0 ? artN : undefined,
      crating_pieces: Number.isFinite(crateN) && crateN > 0 ? crateN : undefined,
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
    });
    const taxRate = cfgNum(config, "tax_rate", TAX_RATE);
    const access = b2bAccessSurchargeFromConfig(config, fromAccess, toAccess);
    const engineSubtotal = dim.subtotal;
    const fullOv = b2bPriceOverrideOn ? parsePositivePreTaxOverride(b2bPreTaxOverrideAmount) : undefined;
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
        fullOverrideApplied && b2bOverrideReason.trim().length >= 3 ? b2bOverrideReason.trim() : "",
      calculatedPreTaxBeforeOverride: dimensionalPreTax + access + addonSubtotal,
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
    if (serviceType !== "b2b_delivery" && serviceType !== "b2b_oneoff") return "";
    const minChars = 8;
    const route = b2bRouteAddressesFromForm(fromAddress, toAddress, extraFromStops, extraToStops);
    if (route.length < 2) return "Distance: Calculating…";
    if (route.length === 2) {
      const f = String(route[0] ?? "").trim();
      const t = String(route[1] ?? "").trim();
      if (f.length < minChars || t.length < minChars) return "Distance: Calculating…";
    }
    if (b2bRouteLoading) return "Distance: Calculating…";
    if (b2bPreviewDistanceKm != null) return `Distance: ${b2bPreviewDistanceKm} km`;
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
    const dropBefore = Math.max(1, Math.floor(cfgNum(config, "bin_rental_drop_off_days_before", 7)));
    const pickupAfter = Math.max(1, Math.floor(cfgNum(config, "bin_rental_pickup_days_after", 5)));
    const rentalDays = Math.max(1, Math.floor(cfgNum(config, "bin_rental_rental_days", 12)));
    const d = new Date(`${moveDate}T12:00:00`);
    const drop = new Date(d);
    drop.setDate(drop.getDate() - dropBefore);
    const pick = new Date(d);
    pick.setDate(pick.getDate() + pickupAfter);
    const fmt = (x: Date) =>
      x.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
    return { delivery: fmt(drop), move: fmt(d), pickup: fmt(pick), cycle: rentalDays };
  }, [serviceType, moveDate, config]);

  // ── Toggle add-on ─────────────────────────
  const toggleAddon = useCallback((addon: Addon) => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      if (next.has(addon.id)) {
        next.delete(addon.id);
      } else {
        next.set(addon.id, { addon_id: addon.id, slug: addon.slug, quantity: 1, tier_index: 0 });
      }
      return next;
    });
  }, [moveSize]);

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
      const packingAddon = allAddons.find((a) => a.slug === "packing_materials_kit" || a.name.toLowerCase().includes("packing materials"));
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
  const buildPayload = useCallback((opts?: { serviceAreaOverride?: boolean }) => {
    const clientName = [firstName, lastName].filter(Boolean).join(" ");
    const base: Record<string, unknown> = {
      service_type: serviceType,
      from_address: fromAddress,
      to_address: toAddress,
      from_access: fromAccess || undefined,
      to_access: toAccess || undefined,
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
        clientBoxCount !== "" && clientBoxCount != null ? Number(clientBoxCount) : 0;
      base.specialty_items = specialtyItems.length > 0 ? specialtyItems : undefined;
      if (inventoryItems.length > 0) {
        base.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
          fragile: i.fragile,
        }));
      }
    }
    if (serviceType === "local_move" || serviceType === "long_distance" || serviceType === "white_glove") {
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
      base.has_it_equipment = hasIt;
      base.has_conference_room = hasConf;
      base.has_reception_area = hasReception;
      base.timing_preference = timingPref || undefined;
      base.office_crew_size = officeCrewSize || undefined;
      base.office_estimated_hours = officeEstHours || undefined;
      if (inventoryItems.length > 0) {
        base.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
          fragile: i.fragile,
        }));
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
      base.single_item_special_handling = singleItemSpecialHandling.trim() || undefined;
    }
    if (serviceType === "white_glove") {
      base.move_size = moveSize || undefined;
      base.item_description = itemDescription.trim() || undefined;
      base.item_category = itemCategory;
      base.item_weight_class = itemWeight || undefined;
      base.declared_value = Number(declaredValue) || undefined;
      base.stair_carry = stairCarry;
      base.stair_flights = stairFlights;
      if (inventoryItems.length > 0) {
        base.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
          fragile: i.fragile,
        }));
      }
      base.client_box_count =
        clientBoxCount !== "" && clientBoxCount != null ? Number(clientBoxCount) : 0;
    }
    if (serviceType === "specialty") {
      base.project_type = specialtyType || "other";
      base.item_description = specialtyItemDescription.trim() || undefined;
      base.item_weight_class = specialtyWeightClass || undefined;
      base.climate_control = specialtyRequirements.includes("climate_controlled");
      base.special_equipment = specialtyRequirements.includes("crane_rigging") ? ["crane_rigging"] : undefined;
      base.specialty_item_description = specialtyItemDescription.trim() || undefined;
      base.specialty_requirements = specialtyRequirements.length > 0 ? specialtyRequirements : undefined;
      base.specialty_notes = specialtyNotes.trim() || undefined;
      base.specialty_building_requirements = specialtyBuildingReqs.length > 0 ? specialtyBuildingReqs : undefined;
      base.specialty_access_difficulty = specialtyAccessDifficulty || undefined;
      const dims = [specialtyDimL, specialtyDimW, specialtyDimH].filter(Boolean);
      base.specialty_dimensions = dims.length === 3 ? `${specialtyDimL}×${specialtyDimW}×${specialtyDimH} in` : undefined;
    }
    if (serviceType === "event") {
      base.event_is_luxury = eventLuxury;
      base.event_truck_type = eventSameLocationSingle && !eventMulti ? "none" : eventTruckType;
      base.event_name = eventName.trim() || undefined;
      base.event_complex_setup_required = eventLuxury ? eventComplexSetup : undefined;
      base.event_setup_required = eventLuxury ? eventComplexSetup : eventSetupRequired;
      base.event_setup_hours =
        (eventLuxury ? eventComplexSetup : eventSetupRequired) ? eventSetupHours : undefined;
      base.event_setup_instructions = eventSetupInstructions.trim() || undefined;
      base.event_items = eventItems.length > 0 ? eventItems : undefined;
      base.event_additional_services = eventAdditionalServices.length > 0 ? eventAdditionalServices : undefined;
      if (eventMulti && eventLegs.length >= 2) {
        base.event_mode = "multi";
        base.event_legs = eventLegs.map((leg) => ({
          label: leg.label.trim() || undefined,
          from_address: leg.from_address.trim(),
          to_address: leg.event_same_location_onsite ? leg.from_address.trim() : leg.to_address.trim(),
          from_access: leg.from_access || undefined,
          to_access: leg.to_access || undefined,
          move_date: leg.move_date,
          event_return_date: leg.event_same_day ? leg.move_date : leg.event_return_date,
          event_same_day: leg.event_same_day,
          event_same_location_onsite: leg.event_same_location_onsite,
          event_leg_truck_type: leg.event_same_location_onsite ? "none" : leg.event_leg_truck_type,
          event_return_rate_preset: leg.event_return_rate_preset,
          event_return_rate_custom:
            leg.event_return_rate_preset === "custom" && leg.event_return_rate_custom.trim()
              ? Number(leg.event_return_rate_custom)
              : undefined,
        }));
        const first = eventLegs[0];
        base.from_address = first.from_address.trim();
        base.to_address = first.to_address.trim();
        base.from_access = first.from_access || undefined;
        base.to_access = first.to_access || undefined;
        base.move_date = first.move_date;
        base.event_return_date = first.event_same_day ? first.move_date : first.event_return_date;
        base.event_same_day = first.event_same_day;
        base.event_pickup_time_after = first.event_same_day ? eventPickupTimeAfter : undefined;
      } else {
        base.from_address = fromAddress;
        base.to_address = eventSameLocationSingle ? fromAddress : (venueAddress || toAddress);
        base.event_return_date = eventSameDay ? moveDate : (eventReturnDate || undefined);
        base.event_same_day = eventSameDay;
        base.event_pickup_time_after = eventSameDay ? eventPickupTimeAfter : undefined;
        base.event_same_location_onsite = eventSameLocationSingle;
        base.event_return_rate_preset = eventReturnRateSingle;
        base.event_return_rate_custom =
          eventReturnRateSingle === "custom" && eventReturnRateCustomSingle.trim()
            ? Number(eventReturnRateCustomSingle)
            : undefined;
      }
    }
    if (serviceType === "labour_only") {
      // from_address = to_address = work address
      base.from_address = workAddress || fromAddress;
      base.to_address = workAddress || fromAddress;
      base.from_access = workAccess || fromAccess || undefined;
      base.labour_crew_size = labourCrewSize;
      base.labour_hours = labourHours;
      base.labour_truck_required = labourTruckRequired;
      base.labour_visits = labourVisits;
      base.labour_second_visit_date = labourVisits >= 2 ? labourSecondVisitDate : undefined;
      base.labour_description = labourDescription.trim() || undefined;
      base.labour_storage_needed = labourStorageNeeded;
      base.labour_storage_weeks = labourStorageNeeded ? labourStorageWeeks : undefined;
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
                l.bundled ?? (vcode === "flooring" ? isFlooringBundledAccessory(desc, vcode) : false);
              const is_skid = l.is_skid ?? isSkidCatalogLabel(desc);
              return {
                description: desc,
                quantity: Math.max(1, l.qty),
                weight_category: (l.weight_category || undefined) as
                  | "light"
                  | "medium"
                  | "heavy"
                  | "extra_heavy"
                  | undefined,
                weight_lbs:
                  typeof l.weight_lbs === "number" && Number.isFinite(l.weight_lbs) && l.weight_lbs > 0
                    ? Math.round(l.weight_lbs)
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
          ? effectiveB2bLines.map((i) => `${i.description.trim()}${i.qty > 1 ? ` ×${i.qty}` : ""}`)
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
      base.b2b_special_instructions = b2bSpecialInstructions.trim() || undefined;
      const artHangN = parseInt(String(b2bArtHangingCount).trim(), 10);
      if (Number.isFinite(artHangN) && artHangN > 0) {
        base.b2b_art_hanging_count = artHangN;
      }
      const cratePiecesN = parseInt(String(b2bCratingPieces).trim(), 10);
      if (Number.isFinite(cratePiecesN) && cratePiecesN > 0) {
        base.b2b_crating_pieces = cratePiecesN;
      }
      const fullOv = Number(String(b2bPreTaxOverrideAmount).trim().replace(/,/g, ""));
      if (b2bPriceOverrideOn && Number.isFinite(fullOv) && fullOv > 0) {
        base.b2b_full_pre_tax_override = fullOv;
      }
      const ovReason = b2bOverrideReason.trim();
      if (ovReason.length >= 3 && b2bPriceOverrideOn && Number.isFinite(fullOv) && fullOv > 0) {
        base.b2b_subtotal_override_reason = ovReason;
      }
    }
    if (serviceType === "bin_rental") {
      base.bin_bundle_type = binBundleType;
      base.bin_custom_count = binBundleType === "custom" ? binCustomCount : undefined;
      base.bin_extra_bins = binExtraBins;
      base.bin_packing_paper = binPackingPaper;
      base.bin_material_delivery = binMaterialDelivery;
      base.bin_linked_move_id = binLinkedMoveId.trim() || null;
      base.bin_delivery_notes = binDeliveryNotes.trim() || undefined;
      base.internal_notes = binInternalNotes.trim() || undefined;
    }
    if (opts?.serviceAreaOverride || serviceAreaOverride) base.service_area_override = true;
    return base;
  }, [
    serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, preferredTime, arrivalWindow, hubspotDealId,
    selectedAddons, recommendedTier, moveSize, clientBoxCount, serviceAreaOverride, specialtyItems, inventoryItems, sqft, wsCount, hasIt, hasConf,
    extraFromStops, extraToStops,
    hasReception, timingPref, itemDescription, itemCategory, itemWeight, assembly, stairCarry, stairFlights,
    numItems, declaredValue, specialtyType, specialtyItemDescription, specialtyWeightClass, specialtyRequirements,
    specialtyNotes, specialtyDimL, specialtyDimW, specialtyDimH,
    firstName, lastName, email, phone, cratingRequired, cratingItems,
    fromParking, toParking, fromLongCarry, toLongCarry,
    eventName, venueAddress, eventReturnDate, eventSetupRequired, eventSetupHours, eventSetupInstructions,
    eventLuxury, eventComplexSetup, eventTruckType,
    eventSameDay, eventPickupTimeAfter, eventItems, eventAdditionalServices, eventMulti, eventLegs,
    eventSameLocationSingle, eventReturnRateSingle, eventReturnRateCustomSingle,
    workAddress, workAccess, labourDescription, labourCrewSize, labourHours, labourTruckRequired,
    labourVisits, labourSecondVisitDate, labourStorageNeeded, labourStorageWeeks, labourContext,
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
    singleItemSpecialHandling, specialtyBuildingReqs, specialtyAccessDifficulty,
    binBundleType, binCustomCount, binExtraBins, binPackingPaper, binMaterialDelivery, binLinkedMoveId,
    binDeliveryNotes, binInternalNotes,
  ]);

  // ── Generate quote (Step 1: creates quote in DB, returns quote_id) ────────────────────────
  const handleGenerate = async (opts?: { serviceAreaOverride?: boolean }) => {
    if (serviceType === "b2b_delivery" || serviceType === "b2b_oneoff") {
      toast("Build and generate B2B quotes from B2B Jobs under Deliveries.", "info");
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
          const toOk = leg.event_same_location_onsite ? leg.from_address?.trim() : leg.to_address?.trim();
          if (!leg.from_address?.trim() || !toOk || !leg.move_date) {
            toast(`Event ${i + 1}: fill origin, venue, and delivery date`, "alertTriangle");
            return;
          }
          if (!leg.event_same_day && !leg.event_return_date?.trim()) {
            toast(`Event ${i + 1}: return date or same-day required`, "alertTriangle");
            return;
          }
        }
      } else {
        if (!fromAddress || (!eventSameLocationSingle && !venueAddress) || !moveDate) {
          toast("Please fill Origin, Venue address and Delivery date", "alertTriangle");
          return;
        }
        if (!eventSameDay && !eventReturnDate) {
          toast("Please fill Return date (or check Same Day)", "alertTriangle");
          return;
        }
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
        toast("Enter a pickup address or check same as delivery", "alertTriangle");
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
    if (
      (serviceType === "local_move" ||
        serviceType === "long_distance" ||
        serviceType === "white_glove") &&
      !moveSize.trim()
    ) {
      toast("Select a move size or add inventory to auto-detect.", "alertTriangle");
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
        toast(data.message || "Outside Yugo service area — quote not generated.", "alertTriangle");
        return;
      }
      setServiceAreaBlock(null);
      if (opts?.serviceAreaOverride) setServiceAreaOverride(true);
      if (!res.ok) throw new Error(data.error || "Quote generation failed");
      const id = data.quote_id ?? data.quoteId;
      if (!id) throw new Error("Generate did not return a quote_id");
      setQuoteResult(data);
      setQuoteId(id);
      setB2bSubmitErrors({});
      quoteClearDraft();
      toast(`Quote ${id} generated`, "check");

      // Persist additional stops if any were added
      const extraPickups = extraFromStops
        .filter((s) => s.address.trim())
        .map((s, i) => ({ ...s, stop_type: "pickup" as const, sort_order: i + 1 }));
      const extraDropoffsBase = extraToStops
        .filter((s) => s.address.trim())
        .map((s, i) => ({ ...s, stop_type: "dropoff" as const, sort_order: i + 1 }));
      const extraVenueDropoffs =
        serviceType === "event" && !eventMulti
          ? extraVenueStops.filter((s) => s.address.trim()).map((s, i) => ({ ...s, stop_type: "dropoff" as const, sort_order: i + 1 }))
          : [];
      const extraLabourDropoffs =
        serviceType === "labour_only"
          ? extraWorkStops.filter((s) => s.address.trim()).map((s, i) => ({ ...s, stop_type: "dropoff" as const, sort_order: i + 1 }))
          : [];
      const allExtraStops = [...extraPickups, ...extraDropoffsBase, ...extraVenueDropoffs, ...extraLabourDropoffs];
      if (allExtraStops.length > 0) {
        fetch("/api/admin/job-stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_type: "quote", job_id: id, stops: allExtraStops }),
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

      // Push quote data back to HubSpot deal (price + deal fields for left column)
      if (hubspotDealId && quoteResult) {
        const essentialTier = quoteResult.tiers?.essential ?? quoteResult.tiers?.curated ?? quoteResult.tiers?.essentials;
        const price = essentialTier?.price ?? quoteResult.custom_price?.price ?? null;
        const tax = essentialTier?.tax ?? quoteResult.custom_price?.tax ?? null;
        const total = essentialTier?.total ?? quoteResult.custom_price?.total ?? null;

        const dealProps: Record<string, unknown> = {
          amount: price,
          total_price: total,
          taxes: tax,
          quote_url: `${window.location.origin}/quote/${quoteId}`,
          dealstage: "quote_sent",
        };
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

  // ── Render ────────────────────────────────
  return (
    <div
      className="transition-opacity duration-700 ease-out"
      style={{ opacity: dissolving ? 0 : 1 }}
    >
      <div className="mb-4">
        <BackButton label="Back" />
      </div>

      {quoteHasDraft && <div className="mb-4"><DraftBanner onRestore={handleRestoreQuoteDraft} onDismiss={quoteDismissDraft} /></div>}

      {hubspotBanner && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {hubspotBanner}
        </div>
      )}

      {leadQuoteBanner && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[var(--gold)]/12 border border-[var(--gold)]/35 text-[12px] font-medium text-[var(--tx)] flex items-center gap-2">
          <Users className="w-4 h-4 shrink-0 text-[var(--gold)]" aria-hidden />
          {leadQuoteBanner}
        </div>
      )}

      {showSpecialtyQuoteBanner && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-[var(--brd)] bg-[var(--card)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Wrench className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5" weight="duotone" aria-hidden />
            <div className="min-w-0 text-[12px] text-[var(--tx2)]">
              <p className="font-bold text-[var(--tx)]">Specialty Quote Builder</p>
              <p className="text-[11px] mt-0.5 leading-snug">
                One-off B2B or heavy transport: use the cost builder, then send the quote from the quote page. Full payment at
                confirmation on the client quote.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSpecialtyBuilderOpen(true)}
              className="px-3 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
            >
              Open builder
            </button>
            <button
              type="button"
              onClick={() => setSpecialtyBannerDismissed(true)}
              className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {leadIntelSummary && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] flex gap-3">
          <Lightbulb className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5" weight="fill" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">Lead intelligence</p>
            <p className="leading-snug">{leadIntelSummary}</p>
          </div>
        </div>
      )}

      {leadInventoryReview.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-500/20 flex items-center gap-2 bg-amber-500/10">
            <ListChecks className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden />
            <p className="text-[11px] font-semibold text-[var(--tx)]">Review parsed inventory</p>
            <span className="text-[10px] text-[var(--tx3)]">Accept the suggested line items or skip if wrong.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-[var(--brd)] text-[var(--tx3)] uppercase tracking-wide">
                  <th className="px-4 py-2 font-semibold">Client wrote</th>
                  <th className="px-4 py-2 font-semibold">Suggested match</th>
                  <th className="px-4 py-2 font-semibold">Confidence</th>
                  <th className="px-4 py-2 font-semibold w-[1%] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leadInventoryReview.map((row, idx) => (
                  <tr key={`${row.raw_text}-${idx}`} className="border-b border-[var(--brd)]/60 align-top">
                    <td className="px-4 py-2.5 text-[var(--tx)]">
                      <span className="font-medium">{row.raw_text || "—"}</span>
                      {row.note ? <p className="text-[10px] text-[var(--tx3)] mt-1">{row.note}</p> : null}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--tx)]">
                      {row.matched_name || row.matched_item ? (
                        <>
                          {row.matched_name || row.matched_item}
                          <span className="text-[var(--tx3)]"> ×{row.quantity}</span>
                        </>
                      ) : (
                        <span className="text-[var(--tx3)]">No match</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 uppercase text-[var(--tx3)]">{row.confidence || "—"}</td>
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
        <div className={`flex flex-col transition-all duration-300 max-w-4xl w-full ${previewOpen ? "min-[480px]:w-[60%] min-w-0" : "min-[480px]:w-full"}`}>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-t-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--brd)]">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Sales</p>
              <h1 className="admin-page-hero text-[var(--tx)]">Generate Quote</h1>
              <p className="text-[11px] text-[var(--tx3)] mt-1.5">
                Fill in the details and generate a quote. The live preview updates as you type.
              </p>
            </div>

            <div className="p-5 space-y-0">
              {/* ── 1. Service type ── */}
              <div>
                <label className="block text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Service Type</label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {SERVICE_TYPES.map((card) => {
                    const sel = serviceType === card.value;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        onClick={() => setServiceType(card.value)}
                        className={`relative text-left px-3 py-2 rounded-lg border transition-all duration-200 ${
                          sel
                            ? "bg-gradient-to-br from-[#B8962E] to-[#8B7332] border-[#B8962E] shadow-md shadow-[#B8962E]/15"
                            : "bg-[var(--card)] border-[var(--brd)] hover:border-[var(--gold)]/40 hover:bg-[var(--bg)]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <card.Icon
                            className={`w-4 h-4 shrink-0 mt-0.5 ${sel ? "text-white" : "text-[var(--gold)]"}`}
                            weight="regular"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className={`text-[11px] leading-tight tracking-tight font-semibold ${sel ? "text-white" : "text-[var(--tx)]"}`}>
                              {card.label}
                            </div>
                            <div className={`text-[9px] mt-0.5 leading-snug ${sel ? "text-white/90" : "text-[var(--tx3)]"}`}>
                              {card.desc}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 2. Client ── */}
              {serviceType !== "b2b_delivery" && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Client</h3>
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
                        <div className="px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] bg-[var(--bg)]">Contacts</div>
                        {dbContacts.map((c) => (
                          <button
                            key={c.hubspot_id}
                            type="button"
                            onClick={() => {
                              const parts = (c.name || "").trim().split(/\s+/);
                              setFirstName(parts[0] || "");
                              setLastName(parts.slice(1).join(" ") || "");
                              setEmail(c.email || "");
                              setPhone(c.phone ? formatPhone(c.phone) : "");
                              if (c.address) setFromAddress(c.address);
                              const biz = (c.company || "").trim();
                              if (biz && (serviceType === "b2b_delivery" || serviceType === "b2b_oneoff")) {
                                setB2bBusinessName(biz);
                              }
                              setContactSearch("");
                              setShowContactDropdown(false);
                              setDbContacts([]);
                            }}
                            className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                          >
                            {c.name}
                            {c.email && <span className="text-[var(--tx3)] ml-1">- {c.email}</span>}
                            {c.phone && <span className="text-[var(--tx3)] ml-1">- {formatPhone(c.phone)}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {showContactDropdown && contactSearch.length >= 2 && dbContacts.length === 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 px-3 py-2 text-[11px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
                        No matches
                      </div>
                    )}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    id={serviceType === "b2b_delivery" ? "b2b-err-contact" : undefined}
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
                    {serviceType === "b2b_delivery" && b2bSubmitErrors.contact ? (
                      <p className="text-[10px] text-red-600 dark:text-red-400 col-span-2">{b2bSubmitErrors.contact}</p>
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
                    id={serviceType === "b2b_delivery" ? "b2b-err-phone" : undefined}
                    className={serviceType === "b2b_delivery" && b2bSubmitErrors.phone ? "rounded-lg border-2 border-red-500/45 p-2 -m-0.5" : ""}
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
                    {serviceType === "b2b_delivery" && b2bSubmitErrors.phone ? (
                      <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{b2bSubmitErrors.phone}</p>
                    ) : null}
                  </div>
                </div>
                {clientSearching && (
                  <p className="text-[10px] text-[var(--tx3)]">Checking HubSpot, Square, and OPS+ for existing contacts…</p>
                )}

                {/* ── Client dedup banner ── */}
                {!clientBannerDismissed && clientDedupResult && (
                  clientDedupResult.opsClient ? (
                    /* Returning client — show history and offer auto-fill */
                    <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <MagnifyingGlass size={16} className="text-[var(--gold)] shrink-0" weight="duotone" aria-hidden />
                        <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--gold)]">
                          Returning Client
                        </p>
                      </div>
                      <p className="text-[12px] text-[var(--tx2)] mb-0.5">
                        <strong>{clientDedupResult.opsClient.name}</strong> has moved with Yugo before
                        (matching email or phone).
                      </p>
                      {clientDedupResult.opsPrevMove && (
                        <p className="text-[11px] text-[var(--tx3)] mb-2">
                          Previous move: {clientDedupResult.opsPrevMove.move_number}
                          {clientDedupResult.opsPrevMove.move_date && `, ${clientDedupResult.opsPrevMove.move_date}`}
                          {clientDedupResult.opsPrevMove.from_address && `, ${clientDedupResult.opsPrevMove.from_address}`}
                          {clientDedupResult.opsPrevMove.to_address && ` → ${clientDedupResult.opsPrevMove.to_address}`}
                        </p>
                      )}
                      {clientDedupResult.square?.card_on_file && (
                        <p className="text-[11px] text-[var(--tx3)] mb-2">
                          Card on file: {clientDedupResult.square.card_brand} ****{clientDedupResult.square.card_last_four}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleClientAutoFill}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
                        >
                          Auto-fill
                        </button>
                        <button
                          type="button"
                          onClick={() => setClientBannerDismissed(true)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/40 transition-colors"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* External contact found (HubSpot/Square) */
                    <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <MagnifyingGlass size={16} className="text-[var(--gold)] shrink-0" weight="duotone" aria-hidden />
                        <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--gold)]">
                          Existing Contact Found
                        </p>
                      </div>
                      {clientDedupResult.hubspot && (
                        <p className="text-[12px] text-[var(--tx2)] mb-0.5">
                          <span className="font-semibold">HubSpot:</span>{" "}
                          {[clientDedupResult.hubspot.first_name, clientDedupResult.hubspot.last_name].filter(Boolean).join(" ") || clientDedupResult.hubspot.email}
                          {clientDedupResult.hubspot.company && (
                            <span className="text-[var(--tx3)]">, {clientDedupResult.hubspot.company}</span>
                          )}
                          {clientDedupResult.hubspot.deal_ids.length > 0 && (
                            <span className="text-[var(--tx3)]"> ({clientDedupResult.hubspot.deal_ids.length} deal{clientDedupResult.hubspot.deal_ids.length !== 1 ? "s" : ""})</span>
                          )}
                        </p>
                      )}
                      {clientDedupResult.square?.card_on_file && (
                        <p className="text-[11px] text-[var(--tx3)] mb-2">
                          Card on file: {clientDedupResult.square.card_brand} ****{clientDedupResult.square.card_last_four}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleClientAutoFill}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
                        >
                          Auto-fill from HubSpot
                        </button>
                        <button
                          type="button"
                          onClick={() => setClientBannerDismissed(true)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/40 transition-colors"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
              )}

              {/* ── Referral Code ── */}
              {serviceType !== "b2b_delivery" && (
              <div className="border-t border-[var(--brd)]/30 pt-4 pb-1">
                <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Referral Code</h3>
                <div className="flex gap-2">
                  <input
                    value={referralCode}
                    onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus("idle"); setReferralMsg(""); }}
                    placeholder="YUGO-NAME-XXXX"
                    className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] font-mono text-[var(--tx)] placeholder:text-[var(--tx2)] focus:border-[var(--gold)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={verifyReferral}
                    disabled={!referralCode.trim()}
                    className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50 transition-all"
                  >
                    Verify
                  </button>
                </div>
                {referralMsg && (
                  <p className={`mt-1.5 text-[11px] ${referralStatus === "valid" ? "text-[#2D9F5A]" : "text-red-500"}`}>
                    {referralStatus === "valid" ? "✓ " : "✗ "}{referralMsg}
                  </p>
                )}
              </div>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 3. Addresses ── */}
              {serviceType !== "b2b_delivery" && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
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
                    Each event has its own origin and venue in the Event section.
                  </p>
                )}

                {serviceType === "bin_rental" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                      <div className="flex-1 min-w-0 w-full max-w-2xl">
                        <MultiStopAddressField
                          label="Delivery address *"
                          placeholder="Where bins are delivered"
                          stops={[{ address: toAddress }]}
                          onChange={(stops) => {
                            setToAddress(stops[0]?.address ?? "");
                          }}
                          inputClassName={fieldInput}
                        />
                      </div>
                      <div className="w-full sm:w-[150px] shrink-0">
                        <Field label="Access">
                          <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={fieldInput}>
                            {BIN_RENTAL_ACCESS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>
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
                        onChange={(e) => setBinPickupSameAsDelivery(e.target.checked)}
                        className="accent-[var(--gold)]"
                      />
                      Same as delivery address
                    </label>
                    <p className="text-[10px] text-[var(--tx3)] leading-snug -mt-1">
                      If the client is moving, bins are picked up from the new address. Uncheck and enter the destination.
                    </p>
                    {!binPickupSameAsDelivery && (
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="flex-1 min-w-0 w-full max-w-2xl">
                          <MultiStopAddressField
                            label="Pickup address *"
                            placeholder="Where bins are collected"
                            stops={[{ address: fromAddress }]}
                            onChange={(stops) => {
                              setFromAddress(stops[0]?.address ?? "");
                            }}
                            inputClassName={fieldInput}
                          />
                        </div>
                        <div className="w-full sm:w-[150px] shrink-0">
                          <Field label="Access">
                            <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={fieldInput}>
                              {BIN_RENTAL_ACCESS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Event single: origin here; multi: per-leg below. Labour Only: own section. */}
                {serviceType !== "labour_only" &&
                  !(serviceType === "event" && eventMulti) &&
                  serviceType !== "bin_rental" && (
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 min-w-0 w-full max-w-2xl">
                    <MultiStopAddressField
                      label={serviceType === "event" ? "Origin Address *" : "From"}
                      placeholder={serviceType === "event" ? "Where items come from (office/warehouse/home)" : "Origin address"}
                      stops={[{ address: fromAddress }, ...extraFromStops]}
                      onChange={(stops) => {
                        setFromAddress(stops[0]?.address ?? "");
                        setExtraFromStops(stops.slice(1));
                      }}
                      inputClassName={fieldInput}
                    />
                  </div>
                  <div className="w-full sm:w-[150px] shrink-0">
                    <Field label="From Access">
                      <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={fieldInput}>
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                )}
                {serviceType !== "event" &&
                  serviceType !== "labour_only" &&
                  serviceType !== "bin_rental" && (
                <div className="flex flex-wrap flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 min-w-0 w-full max-w-2xl">
                    <MultiStopAddressField
                      label="To"
                      placeholder="Destination address"
                      stops={[{ address: toAddress }, ...extraToStops]}
                      onChange={(stops) => {
                        setToAddress(stops[0]?.address ?? "");
                        setExtraToStops(stops.slice(1));
                      }}
                      inputClassName={fieldInput}
                    />
                  </div>
                  <div className="w-full sm:w-[150px] shrink-0">
                    <Field label="To Access">
                      <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={fieldInput}>
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                )}
                {serviceType !== "labour_only" && serviceType !== "bin_rental" && (
                  <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-3 pt-2">
                    <Field label="From address parking">
                      <select
                        value={fromParking}
                        onChange={(e) => setFromParking(e.target.value as "dedicated" | "street" | "no_dedicated")}
                        className={fieldInput}
                      >
                        {PARKING_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="To address parking">
                      <select
                        value={toParking}
                        onChange={(e) => setToParking(e.target.value as "dedicated" | "street" | "no_dedicated")}
                        className={fieldInput}
                      >
                        {PARKING_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </Field>
                    <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] col-span-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fromLongCarry}
                        onChange={(e) => setFromLongCarry(e.target.checked)}
                        className="accent-[var(--gold)]"
                      />
                      From address: Long carry (50m+ from truck to entrance) (+$75)
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] col-span-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={toLongCarry}
                        onChange={(e) => setToLongCarry(e.target.checked)}
                        className="accent-[var(--gold)]"
                      />
                      To address: Long carry (50m+ from truck to entrance) (+$75)
                    </label>
                  </div>
                )}
              </div>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 4. Move details ── */}
              {/* Event and labour_only manage their own date fields */}
              {serviceType !== "event" && serviceType !== "b2b_delivery" && (
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">
                  {quoteFormSchedulingSectionTitle(serviceType)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    id={serviceType === "b2b_delivery" ? "b2b-err-date" : undefined}
                    className={`space-y-1 ${serviceType === "b2b_delivery" && b2bSubmitErrors.date ? "rounded-lg border-2 border-red-500/45 p-2 -m-0.5" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Field label={quoteFormServiceDateLabel(serviceType)}>
                        <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} required className={fieldInput} />
                      </Field>
                      {serviceType === "b2b_delivery" && moveDate.trim() && isMoveDateWeekend(moveDate) ? (
                        <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-1 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 self-end mb-0.5">
                          WEEKEND +{fmtPrice(cfgNum(config, "b2b_weekend_surcharge", 40))}
                        </span>
                      ) : null}
                    </div>
                    {serviceType === "b2b_delivery" && b2bSubmitErrors.date ? (
                      <p className="text-[10px] text-red-600 dark:text-red-400">{b2bSubmitErrors.date}</p>
                    ) : null}
                  </div>
                  <Field label="Preferred Time">
                    <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={fieldInput} />
                  </Field>
                  {serviceType !== "labour_only" && serviceType !== "bin_rental" && (
                  <Field label="Arrival Window">
                    <select value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className={fieldInput}>
                      {TIME_WINDOW_OPTIONS.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  )}
                  {(serviceType === "local_move" || serviceType === "long_distance" || serviceType === "white_glove") && (
                    <Field label="Move Size">
                      <select
                        value={moveSize}
                        onChange={(e) => {
                          moveSizeUserTouchedRef.current = true;
                          setMoveSize(e.target.value);
                        }}
                        className={fieldInput}
                      >
                        <option value="">Select move size or add inventory to auto-detect</option>
                        {MOVE_SIZES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {moveSizeSuggestion && inventoryItems.length > 0 && (
                        <p className="mt-1.5 text-[10px] text-[var(--tx3)] flex items-start gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 shrink-0 text-[var(--gold)] mt-0.5" aria-hidden />
                          <span>
                            Detected: {moveSizeLabel(moveSizeSuggestion.suggested)}
                            {moveSizeSuggestion.confidence === "high" ? " (high confidence)" : " (medium confidence)"}
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
                          return (
                            <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/8 p-2.5 text-[10px] text-[var(--tx2)] space-y-2">
                              <p className="flex items-start gap-1.5">
                                <Warning className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" aria-hidden />
                                <span>{msg}</span>
                              </p>
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                                onClick={() => {
                                  moveSizeUserTouchedRef.current = false;
                                  setMoveSize(moveSizeSuggestion.suggested);
                                }}
                              >
                                Use {moveSizeLabel(moveSizeSuggestion.suggested)} instead
                              </button>
                            </div>
                          );
                        })()}
                    </Field>
                  )}
                {serviceType === "local_move" && !ecoBinsUpsellDismissed && (
                  <div className="col-span-full relative rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/5 p-4 pr-11 sm:pr-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Recycle className="w-6 h-6 shrink-0 text-[var(--gold)]" weight="regular" aria-hidden />
                      <div>
                        <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--gold)]">Add eco-friendly bins</p>
                        <p className="text-[11px] text-[var(--tx2)] mt-1 leading-snug">
                          Skip the cardboard. Reusable bins delivered 7 days before your move, picked up 5 days after.
                          2 Bedroom: {fmtPrice(cfgNum(config, "bin_bundle_2br", 279))} — delivery is free when coordinated with your move (uncheck material delivery or link the move when booked).
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
                      className="shrink-0 px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-95 transition-opacity"
                    >
                      Add to quote
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.setItem("yugo_dismiss_eco_bins_quote_upsell", "1");
                        } catch {
                          /* ignore */
                        }
                        setEcoBinsUpsellDismissed(true);
                      }}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--gold)]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]/50"
                      aria-label="Dismiss eco bins suggestion"
                    >
                      <X size={18} weight="regular" className="text-current" aria-hidden />
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
                            onChange={(e) => setRecommendedTier(e.target.value as "essential" | "signature" | "estate")}
                            className={`${fieldInput} w-full min-w-[10.5rem] max-w-[16rem] shrink-0`}
                          >
                            <option value="essential">Essential</option>
                            <option value="signature">Signature</option>
                            <option value="estate">Estate</option>
                          </select>
                          {recommendedTier !== "estate" && (
                            <button
                              type="button"
                              onClick={() => setRecommendedTier("estate")}
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--gold)] hover:text-[var(--gold2)] hover:underline underline-offset-2 transition-colors whitespace-nowrap shrink-0"
                            >
                              White glove? Estate
                              <ChevronRight className="w-3.5 h-3.5 shrink-0" weight="bold" aria-hidden />
                            </button>
                          )}
                        </div>
                      </Field>
                    </div>
                    {recommendedTier === "estate" &&
                      ["2br", "3br", "4br", "5br_plus"].includes(moveSize) &&
                      moveDate.trim() &&
                      (() => {
                        const plan = calculateEstateDays(moveSize, inventoryScoreWithBoxes);
                        if (plan.days <= 1) return null;
                        const lines = buildEstateScheduleLines(plan, moveDate.trim(), "20ft dedicated moving truck");
                        return (
                          <div className="col-span-full rounded-xl border border-[var(--tx)]/[0.08] bg-[#F9F9F8] dark:bg-white/[0.04] dark:border-white/[0.08] px-4 py-3 space-y-2 text-[11px] text-[var(--tx2)]">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--tx3)]">
                              Estate schedule preview
                            </p>
                            <p className="text-[var(--tx)] font-medium leading-snug">
                              This move typically needs {plan.days} days. Pack day is usually the day before the move
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
                              Coordinators can adjust timing (for example same weekend only, or pack Thursday and move
                              Saturday).
                            </p>
                          </div>
                        );
                      })()}
                  </>
                  )}
                  {/* Box count moved into InventoryInput when inventory is shown */}
                  {(serviceType === "local_move" || serviceType === "long_distance") && itemWeights.length === 0 && (
                    <Field label="Number of Boxes">
                      <div className="space-y-1.5">
                        <select
                          value={clientBoxCount === "" ? "" : (["5","10","20","30","40","50","75"].includes(clientBoxCount) ? clientBoxCount : "custom")}
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
                        {!["","5","10","20","30","40","50","75"].includes(clientBoxCount) && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={9999}
                              value={clientBoxCount}
                              onChange={(e) => setClientBoxCount(e.target.value)}
                              placeholder="Enter exact count"
                              className={`${fieldInput} focus:border-[var(--gold)]`}
                              autoFocus
                            />
                            <span className="text-[11px] text-[var(--tx3)] shrink-0">boxes</span>
                          </div>
                        )}
                      </div>
                    </Field>
                  )}
                </div>

                {serviceType === "bin_rental" && binSchedulePreview && (
                  <div className="mt-3 p-3 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[11px] space-y-1">
                    <p className="font-semibold text-[var(--tx)]">Based on your move date</p>
                    <p>
                      <span className="text-[var(--tx3)]">Delivery:</span> {binSchedulePreview.delivery}
                    </p>
                    <p>
                      <span className="text-[var(--tx3)]">Move day:</span> {binSchedulePreview.move}
                    </p>
                    <p>
                      <span className="text-[var(--tx3)]">Pickup:</span> {binSchedulePreview.pickup}
                    </p>
                    <p className="text-[var(--tx3)] pt-1">Rental cycle: {binSchedulePreview.cycle} days total</p>
                  </div>
                )}

                {serviceType === "local_move" && (
                  <p className="text-[9px] text-[var(--tx3)] mt-1.5">
                    The recommended tier highlights that package on the client&apos;s quote page and email.
                  </p>
                )}
              </div>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 5. Specialty items ── */}
              {(serviceType === "local_move" || serviceType === "long_distance") && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty Items</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {SPECIALTY_ITEM_TYPES.map((type) => {
                      const active = specialtyItems.some((i) => i.type === type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleSpecialtyItem(type)}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
                            active
                              ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
                              : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"
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
                        <div key={item.type} className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--tx)] flex-1">{toTitleCase(item.type)}</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={item.qty}
                            onChange={(e) => updateSpecialtyQty(item.type, parseInt(e.target.value) || 1)}
                            className="w-14 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-center text-[var(--tx)]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 5b. Custom crating (all service types, coordinator decides) ── */}
              {(serviceType === "local_move" || serviceType === "long_distance" || serviceType === "white_glove" || serviceType === "specialty") && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Custom Crating</h3>
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
                      <span className="text-[11px] text-[var(--tx2)]">Crating required</span>
                    </label>
                  </div>

                  {cratingRequired && (
                    <div className="space-y-2 pl-1">
                      {cratingItems.map((piece, idx) => {
                        const priceMap = parseCfgJson<Record<string, number>>(config, "crating_prices", CRATING_SIZE_FALLBACK);
                        const piecePrice = priceMap[piece.size] ?? CRATING_SIZE_FALLBACK[piece.size] ?? 250;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[10px] text-[var(--tx3)] w-14 shrink-0">Piece {idx + 1}</span>
                            <input
                              type="text"
                              value={piece.description}
                              onChange={(e) => setCratingItems((prev) => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                              placeholder="e.g. Painting 48x36"
                              className={`${fieldInput} flex-1 min-w-0`}
                            />
                            <select
                              value={piece.size}
                              onChange={(e) => setCratingItems((prev) => prev.map((p, i) => i === idx ? { ...p, size: e.target.value as "small" | "medium" | "large" | "oversized" } : p))}
                              className={`${fieldInput} w-40 shrink-0`}
                            >
                              {Object.entries(CRATING_SIZE_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>{label}, ${(priceMap[k] ?? CRATING_SIZE_FALLBACK[k]).toLocaleString()}</option>
                              ))}
                            </select>
                            <span className="text-[10px] text-[var(--gold)] w-14 text-right shrink-0">${piecePrice.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => setCratingItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-[var(--tx3)] hover:text-red-400 text-[13px] shrink-0"
                              title="Remove"
                            >×</button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCratingItems((prev) => [...prev, { description: "", size: "medium" }])}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
                      >
                        <Plus className="w-3 h-3" /> Add piece
                      </button>
                      {cratingItems.length > 0 && (
                        <p className="text-[10px] text-[var(--tx3)]">
                          Crating total: <strong className="text-[var(--gold)]">
                            ${cratingItems.reduce((sum, p) => {
                              const pm = parseCfgJson<Record<string, number>>(config, "crating_prices", CRATING_SIZE_FALLBACK);
                              return sum + (pm[p.size] ?? CRATING_SIZE_FALLBACK[p.size] ?? 250);
                            }, 0).toLocaleString()}
                          </strong> ({cratingItems.length} piece{cratingItems.length !== 1 ? "s" : ""})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── 5c. Inventory (Residential / Long distance / Office) ── */}
              {(serviceType === "local_move" || serviceType === "long_distance" || serviceType === "office_move" || serviceType === "white_glove") && itemWeights.length > 0 && (
                <>
              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />
                <InventoryInput
                  itemWeights={itemWeights as { slug: string; item_name: string; weight_score: number; category: string; room?: string; is_common: boolean; display_order?: number; active?: boolean }[]}
                  value={inventoryItems}
                  onChange={setInventoryItems}
                  moveSize={moveSize || moveSizeSuggestion?.suggested || "partial"}
                  fromAccess={fromAccess}
                  toAccess={toAccess}
                  showLabourEstimate={
                    (!!moveSize || !!moveSizeSuggestion || inventoryItems.length > 0) &&
                    (serviceType === "local_move" ||
                      serviceType === "long_distance" ||
                      serviceType === "white_glove" ||
                      serviceType === "office_move")
                  }
                  boxCount={Number(clientBoxCount) || 0}
                  onBoxCountChange={(n) => setClientBoxCount(n > 0 ? String(n) : "")}
                  mode={serviceType === "office_move" ? "commercial" : "residential"}
                />
                </>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── Office fields ── */}
              {serviceType === "office_move" && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Office Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Billable hours (crew block)">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={officeEstHours}
                        onChange={(e) => setOfficeEstHours(Number(e.target.value) || 5)}
                        className={`${fieldInput} min-w-0`}
                      />
                      <p className="text-[9px] text-[var(--tx3)] mt-0.5">Hourly rate × hours (default 5). Distance &amp; surcharges added separately.</p>
                    </Field>
                    <Field label="Crew size (reference)">
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={officeCrewSize}
                        onChange={(e) => setOfficeCrewSize(Number(e.target.value) || 2)}
                        className={`${fieldInput} min-w-0`}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Field label="Square Footage">
                      <input type="number" min={0} value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="2500" className={`${fieldInput} min-w-0`} />
                    </Field>
                    <Field label="Workstations">
                      <input type="number" min={0} value={wsCount} onChange={(e) => setWsCount(e.target.value)} placeholder="20" className={`${fieldInput} min-w-0`} />
                    </Field>
                    <Field label="Timing Preference">
                      <select value={timingPref} onChange={(e) => setTimingPref(e.target.value)} className={`${fieldInput} min-w-0`}>
                        <option value="">Select…</option>
                        {TIMING_PREFS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {[
                      { label: "IT Equipment", val: hasIt, set: setHasIt },
                      { label: "Conference Room", val: hasConf, set: setHasConf },
                      { label: "Reception Area", val: hasReception, set: setHasReception },
                    ].map((tog) => (
                      <div key={tog.label} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-[var(--tx)]">{tog.label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={tog.val}
                          onClick={() => tog.set(!tog.val)}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${tog.val ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${tog.val ? "translate-x-4" : ""}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Single item fields ── */}
              {serviceType === "single_item" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Items</h3>
                  <div className="rounded-xl border-2 border-[var(--gold)]/40 bg-[var(--gold)]/8 px-3 py-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">Special handling instructions</p>
                    <p className="text-[9px] text-[var(--tx3)] leading-snug">
                      Shown on the client quote and to crew, fragile areas, disassembly, narrow access, orientation, etc.
                    </p>
                    <textarea
                      value={singleItemSpecialHandling}
                      onChange={(e) => setSingleItemSpecialHandling(e.target.value)}
                      rows={4}
                      placeholder="e.g. Glass top, keep upright; marble base; 32&quot; door clearance; do not lay flat…"
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
                      <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={`${fieldInput} min-w-0`}>
                        {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Weight Class">
                      <select value={itemWeight} onChange={(e) => setItemWeight(e.target.value)} className={`${fieldInput} min-w-0`}>
                        <option value="">Select…</option>
                        {WEIGHT_CLASSES.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </Field>
                    <Field label="Number of Items">
                      <input type="number" min={1} max={5} value={numItems} onChange={(e) => setNumItems(Number(e.target.value) || 1)} className={`${fieldInput} w-14 min-w-0`} />
                    </Field>
                    <Field label="Assembly">
                      <select value={assembly} onChange={(e) => setAssembly(e.target.value)} className={`${fieldInput} min-w-0`}>
                        {ASSEMBLY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase text-[var(--tx3)] shrink-0">Stair Carry</span>
                      <button type="button" role="switch" aria-checked={stairCarry} onClick={() => setStairCarry(!stairCarry)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${stairCarry ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${stairCarry ? "translate-x-4" : ""}`} />
                      </button>
                      {stairCarry && (
                        <input type="number" min={1} max={10} value={stairFlights} onChange={(e) => setStairFlights(Number(e.target.value) || 1)} className={`${fieldInput} w-12 py-1 min-w-0`} title="Flights" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── White glove fields ── */}
              {serviceType === "white_glove" && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">White Glove, Items</h3>
                  <Field label="Item description *">
                    <input
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="e.g. Antique dresser, Grand piano, Art piece"
                      className={fieldInput}
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                    <Field label="Item Category">
                      <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={`${fieldInput} min-w-0`}>
                        {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Weight Class">
                      <select value={itemWeight} onChange={(e) => setItemWeight(e.target.value)} className={`${fieldInput} min-w-0`}>
                        <option value="">Select…</option>
                        {WEIGHT_CLASSES.map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </Field>
                    <Field label="Declared Value ($)">
                      <input type="number" min={0} value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} placeholder="For insurance" className={`${fieldInput} w-24 min-w-0`} />
                    </Field>
                    <Field label="Assembly">
                      <select value={assembly} onChange={(e) => setAssembly(e.target.value)} className={`${fieldInput} min-w-0`}>
                        {ASSEMBLY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase text-[var(--tx3)] shrink-0">Stair Carry</span>
                      <button type="button" role="switch" aria-checked={stairCarry} onClick={() => setStairCarry(!stairCarry)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${stairCarry ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${stairCarry ? "translate-x-4" : ""}`} />
                      </button>
                      {stairCarry && (
                        <input type="number" min={1} max={10} value={stairFlights} onChange={(e) => setStairFlights(Number(e.target.value) || 1)} className={`${fieldInput} w-12 py-1 min-w-0`} title="Flights" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Specialty fields ── */}
              {serviceType === "specialty" && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty Move</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Specialty Type">
                      <select value={specialtyType} onChange={(e) => setSpecialtyType(e.target.value)} className={`${fieldInput} min-w-0`}>
                        <option value="">Select…</option>
                        {SPECIALTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Estimated Weight">
                      <select value={specialtyWeightClass} onChange={(e) => setSpecialtyWeightClass(e.target.value)} className={`${fieldInput} min-w-0`}>
                        <option value="">Select…</option>
                        {SPECIALTY_WEIGHT_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Item Description *">
                    <textarea
                      value={specialtyItemDescription}
                      onChange={(e) => setSpecialtyItemDescription(e.target.value)}
                      rows={3}
                      placeholder="Grand piano, Steinway Model B, approximately 700 lbs. Currently on main floor, needs to go through patio door."
                      className={`${fieldInput} resize-none`}
                      required
                    />
                  </Field>

                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Item Dimensions (optional)</label>
                    <div className="flex items-center gap-2">
                      <input type="text" value={specialtyDimL} onChange={(e) => setSpecialtyDimL(e.target.value)} placeholder="L" className={`${fieldInput} w-16 text-center`} />
                      <span className="text-[var(--tx3)] text-[11px]">×</span>
                      <input type="text" value={specialtyDimW} onChange={(e) => setSpecialtyDimW(e.target.value)} placeholder="W" className={`${fieldInput} w-16 text-center`} />
                      <span className="text-[var(--tx3)] text-[11px]">×</span>
                      <input type="text" value={specialtyDimH} onChange={(e) => setSpecialtyDimH(e.target.value)} placeholder="H" className={`${fieldInput} w-16 text-center`} />
                      <span className="text-[10px] text-[var(--tx3)]">inches</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Special Requirements</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {SPECIALTY_REQUIREMENTS.map((req) => (
                        <label key={req.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={specialtyRequirements.includes(req.value)}
                            onChange={(e) => setSpecialtyRequirements((prev) =>
                              e.target.checked ? [...prev, req.value] : prev.filter((r) => r !== req.value)
                            )}
                            className="accent-[var(--gold)] w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-[11px] text-[var(--tx2)]">{req.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Building Requirements</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {SPECIALTY_BUILDING_REQUIREMENTS.map((req) => (
                        <label key={req.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={specialtyBuildingReqs.includes(req.value)}
                            onChange={(e) =>
                              setSpecialtyBuildingReqs((prev) =>
                                e.target.checked ? [...prev, req.value] : prev.filter((r) => r !== req.value),
                              )
                            }
                            className="accent-[var(--gold)] w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-[11px] text-[var(--tx2)]">{req.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Field label="Access difficulty">
                    <select
                      value={specialtyAccessDifficulty}
                      onChange={(e) => setSpecialtyAccessDifficulty(e.target.value)}
                      className={fieldInput}
                    >
                      <option value="">Select…</option>
                      {SPECIALTY_ACCESS_DIFFICULTY.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {specialtyAccessDifficulty === "requires_rigging_or_crane" ? (
                      <p className="text-[10px] text-amber-700 mt-1.5">
                        Crane/rigging adds $1,500–3,000. Coordinator will confirm exact cost.
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
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Event Details</h3>
                    <Field label="Event Name">
                      <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. L'Oréal Beauty Event" className={fieldInput} />
                    </Field>
                    <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                      <input
                        type="checkbox"
                        checked={eventLuxury}
                        onChange={(e) => setEventLuxury(e.target.checked)}
                        className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                      />
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--tx)]">Luxury / White glove event</span>
                        <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                          High-value furniture, art, or premium brand events, uses white glove crew rate.
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
                              if (on) setEventReturnRateSingle("85");
                              else if (eventReturnRateSingle === "85") setEventReturnRateSingle("auto");
                            }}
                            className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                          />
                          <div>
                            <span className="text-[11px] font-semibold text-[var(--tx)]">Same location, items moved within venue</span>
                            <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                              On-site event: no road transit, no truck surcharge, return day priced at a reduced rate (default 85%).
                            </p>
                          </div>
                        </label>
                        <Field label="Return rate (return day vs delivery day)">
                          <select
                            value={eventReturnRateSingle}
                            onChange={(e) => setEventReturnRateSingle(e.target.value as typeof eventReturnRateSingle)}
                            className={fieldInput}
                          >
                            {EVENT_LEG_RETURN_RATE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {eventReturnRateSingle === "custom" ? (
                            <input
                              type="number"
                              min={25}
                              max={100}
                              value={eventReturnRateCustomSingle}
                              onChange={(e) => setEventReturnRateCustomSingle(e.target.value)}
                              placeholder="% of delivery day"
                              className={`${fieldInput} mt-1 max-w-[200px]`}
                            />
                          ) : null}
                        </Field>
                      </>
                    )}
                    {!eventMulti && !eventSameLocationSingle && (
                      <Field label="Truck type">
                        <select value={eventTruckType} onChange={(e) => setEventTruckType(e.target.value)} className={fieldInput}>
                          {EVENT_TRUCK_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <p className="text-[9px] text-[var(--tx3)] mt-1">Select 20ft+ for large events with significant inventory.</p>
                      </Field>
                    )}
                    {!eventMulti && eventSameLocationSingle ? (
                      <p className="text-[10px] text-[var(--tx2)] rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]">
                        Truck: <strong className="text-[var(--tx)]">No truck</strong>, on-site event (no road transit for this program).
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
                                event_return_date: eventSameDay ? moveDate : eventReturnDate,
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
                        <span className="text-[11px] font-semibold text-[var(--tx)]">Multi-event quote</span>
                        <p className="text-[10px] text-[var(--tx2)] mt-0.5 leading-snug">
                          Bundle 2+ delivery & return pairs (different venues or dates) into one quote and one total.
                        </p>
                      </div>
                    </label>
                  </div>

                  {!eventMulti && (
                    <>
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Venue</h3>
                        {eventSameLocationSingle ? (
                          <p className="text-[11px] text-[var(--tx2)] rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)]">
                            Venue matches origin, on-site event (no separate venue address).
                          </p>
                        ) : (
                          <MultiStopAddressField
                            label="Venue / Event Address *"
                            placeholder="Restaurant XYZ, 100 King St W"
                            stops={[{ address: venueAddress }, ...extraVenueStops]}
                            onChange={(stops) => {
                              setVenueAddress(stops[0]?.address ?? "");
                              setExtraVenueStops(stops.slice(1));
                            }}
                            inputClassName={fieldInput}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Delivery (Day 1)</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Delivery Date *">
                            <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} required className={fieldInput} />
                          </Field>
                          <Field label="Delivery Time">
                            <select value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className={fieldInput}>
                              {TIME_WINDOW_OPTIONS.map((label) => (
                                <option key={label} value={label}>{label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        {eventLuxury ? (
                          <div className="rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)] space-y-2">
                            <p className="text-[11px] text-[var(--tx)] font-medium">Basic setup and placement: Included with luxury rate.</p>
                            <p className="text-[10px] text-[var(--tx2)]">
                              Add complex setup (staging, signage, assembly) for an additional fee:
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eventComplexSetup}
                                onChange={(e) => setEventComplexSetup(e.target.checked)}
                                className="accent-[var(--gold)] w-3.5 h-3.5"
                              />
                              <span className="text-[11px] text-[var(--tx2)]">Complex setup (paid add-on)</span>
                            </label>
                            {eventComplexSetup && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Complex setup duration">
                                  <select value={eventSetupHours} onChange={(e) => setEventSetupHours(Number(e.target.value))} className={`${fieldInput} w-40`}>
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Setup Instructions">
                                  <textarea value={eventSetupInstructions} onChange={(e) => setEventSetupInstructions(e.target.value)} rows={2} placeholder="Staging, signage, assembly details…" className={`${fieldInput} resize-none`} />
                                </Field>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-medium text-[var(--tx)]">Setup required (paid)</span>
                              <button type="button" role="switch" aria-checked={eventSetupRequired} onClick={() => setEventSetupRequired(!eventSetupRequired)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${eventSetupRequired ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${eventSetupRequired ? "translate-x-4" : ""}`} />
                              </button>
                            </div>
                            {eventSetupRequired && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Setup Duration">
                                  <select value={eventSetupHours} onChange={(e) => setEventSetupHours(Number(e.target.value))} className={`${fieldInput} w-40`}>
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Setup Instructions">
                                  <textarea value={eventSetupInstructions} onChange={(e) => setEventSetupInstructions(e.target.value)} rows={2} placeholder="Arrange display tables, hang banners, etc." className={`${fieldInput} resize-none`} />
                                </Field>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Return (Day 2+)</h3>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={eventSameDay} onChange={(e) => setEventSameDay(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                          <span className="text-[11px] text-[var(--tx2)]">Same Day Event, delivery and return on same day</span>
                        </label>
                        {!eventSameDay ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Return Date *">
                              <input type="date" value={eventReturnDate} onChange={(e) => setEventReturnDate(e.target.value)} required={!eventSameDay} className={fieldInput} />
                            </Field>
                            <Field label="Return Time">
                              <select value={preferredTime || "morning"} onChange={(e) => setPreferredTime(e.target.value)} className={fieldInput}>
                                <option value="morning">Morning (7 AM – 12 PM)</option>
                                <option value="afternoon">Afternoon (12 PM – 5 PM)</option>
                                <option value="evening">Evening (5 PM – 9 PM)</option>
                              </select>
                            </Field>
                          </div>
                        ) : (
                          <Field label="Pickup Time After Event">
                            <select value={eventPickupTimeAfter} onChange={(e) => setEventPickupTimeAfter(e.target.value)} className={`${fieldInput} w-56`}>
                              <option value="Evening 6–9 PM">Evening 6–9 PM</option>
                              <option value="Evening 8–10 PM">Evening 8–10 PM</option>
                              <option value="After midnight">After midnight</option>
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
                          Each row is one round trip (origin → venue → return). Event items below apply to all legs unless you add per-leg items later.
                        </p>
                        <button
                          type="button"
                          onClick={addEventLeg}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 shrink-0"
                        >
                          <Plus className="w-3 h-3" aria-hidden /> Add event
                        </button>
                      </div>
                      {eventLegs.map((leg, idx) => (
                        <div key={idx} className="rounded-xl border border-[var(--brd)] p-3 space-y-3 bg-[var(--card)]/30">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--brd)]/50">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">
                              Round trip {idx + 1}
                              {leg.label?.trim() ? <span className="text-[var(--tx2)] font-semibold normal-case">, {leg.label.trim()}</span> : null}
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
                                setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, label: e.target.value } : L)))
                              }
                              placeholder={`Event ${idx + 1}`}
                              className={fieldInput}
                            />
                          </Field>
                          <AddressAutocomplete
                            value={leg.from_address}
                            onRawChange={(v) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, from_address: v } : L)))}
                            onChange={(r) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, from_address: r.fullAddress } : L)))}
                            placeholder="Origin / warehouse"
                            label="Origin *"
                            required
                            className={fieldInput}
                          />
                          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2">
                            <Field label="Origin access">
                              <select
                                value={leg.from_access}
                                onChange={(e) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, from_access: e.target.value } : L)))}
                                className={fieldInput}
                              >
                                {ACCESS_OPTIONS.map((o) => (
                                  <option key={o.value || "empty"} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Venue access">
                              <select
                                value={leg.to_access}
                                onChange={(e) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, to_access: e.target.value } : L)))}
                                className={fieldInput}
                              >
                                {ACCESS_OPTIONS.map((o) => (
                                  <option key={`v-${o.value || "empty"}`} value={o.value}>
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
                                          to_address: on ? L.from_address : L.to_address,
                                          event_return_rate_preset: on ? "85" : L.event_return_rate_preset === "85" ? "auto" : L.event_return_rate_preset,
                                        }
                                      : L,
                                  ),
                                );
                              }}
                              className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                            />
                            <span className="text-[11px] text-[var(--tx2)] leading-snug">
                              Same location, items moved within venue (on-site event)
                            </span>
                          </label>
                          {!leg.event_same_location_onsite ? (
                            <AddressAutocomplete
                              value={leg.to_address}
                              onRawChange={(v) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, to_address: v } : L)))}
                              onChange={(r) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, to_address: r.fullAddress } : L)))}
                              placeholder="Venue address"
                              label="Venue *"
                              required
                              className={fieldInput}
                            />
                          ) : (
                            <p className="text-[10px] text-[var(--tx3)] rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]">
                              Venue same as origin, no road transit for this leg.
                            </p>
                          )}
                          {!leg.event_same_location_onsite && (
                            <Field label="Truck (this leg)">
                              <select
                                value={leg.event_leg_truck_type}
                                onChange={(e) =>
                                  setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, event_leg_truck_type: e.target.value } : L)))
                                }
                                className={fieldInput}
                              >
                                {EVENT_TRUCK_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
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
                                      ? { ...L, event_return_rate_preset: e.target.value as EventLegForm["event_return_rate_preset"] }
                                      : L,
                                  ),
                                )
                              }
                              className={fieldInput}
                            >
                              {EVENT_LEG_RETURN_RATE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {leg.event_return_rate_preset === "custom" ? (
                              <input
                                type="number"
                                min={25}
                                max={100}
                                value={leg.event_return_rate_custom}
                                onChange={(e) =>
                                  setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, event_return_rate_custom: e.target.value } : L)))
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
                                onChange={(e) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, move_date: e.target.value } : L)))}
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
                                  prev.map((L, i) => (i === idx ? { ...L, event_same_day: e.target.checked } : L)),
                                )
                              }
                              className="accent-[var(--gold)] w-3.5 h-3.5"
                            />
                            <span className="text-[11px] text-[var(--tx2)]">Same-day return</span>
                          </label>
                          {!leg.event_same_day ? (
                            <Field label="Return date *">
                              <input
                                type="date"
                                value={leg.event_return_date}
                                onChange={(e) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, event_return_date: e.target.value } : L)))}
                                className={fieldInput}
                              />
                            </Field>
                          ) : null}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addEventLeg}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold border border-dashed border-[var(--gold)]/60 text-[var(--gold)] hover:bg-[var(--gold)]/10"
                      >
                        <Plus className="w-4 h-4" aria-hidden /> Add event
                      </button>

                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Setup (program)</h3>
                        <p className="text-[10px] text-[var(--tx3)]">One setup fee for the bundled program (not per venue).</p>
                        {eventLuxury ? (
                          <div className="rounded-lg border border-[var(--brd)] px-3 py-2.5 bg-[var(--bg)] space-y-2">
                            <p className="text-[11px] text-[var(--tx)] font-medium">Basic setup and placement: Included with luxury rate.</p>
                            <p className="text-[10px] text-[var(--tx2)]">
                              Add complex setup (staging, signage, assembly) for an additional fee:
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eventComplexSetup}
                                onChange={(e) => setEventComplexSetup(e.target.checked)}
                                className="accent-[var(--gold)] w-3.5 h-3.5"
                              />
                              <span className="text-[11px] text-[var(--tx2)]">Complex setup</span>
                            </label>
                            {eventComplexSetup && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Complex setup duration">
                                  <select value={eventSetupHours} onChange={(e) => setEventSetupHours(Number(e.target.value))} className={`${fieldInput} w-40`}>
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Instructions">
                                  <textarea value={eventSetupInstructions} onChange={(e) => setEventSetupInstructions(e.target.value)} rows={2} className={`${fieldInput} resize-none`} />
                                </Field>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-medium text-[var(--tx)]">Setup required (paid)</span>
                              <button type="button" role="switch" aria-checked={eventSetupRequired} onClick={() => setEventSetupRequired(!eventSetupRequired)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${eventSetupRequired ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${eventSetupRequired ? "translate-x-4" : ""}`} />
                              </button>
                            </div>
                            {eventSetupRequired && (
                              <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                                <Field label="Setup Duration">
                                  <select value={eventSetupHours} onChange={(e) => setEventSetupHours(Number(e.target.value))} className={`${fieldInput} w-40`}>
                                    <option value={1}>1 hour, $150</option>
                                    <option value={2}>2 hours, $275</option>
                                    <option value={3}>3 hours, $400</option>
                                    <option value={99}>Half day, $600</option>
                                  </select>
                                </Field>
                                <Field label="Setup Instructions">
                                  <textarea value={eventSetupInstructions} onChange={(e) => setEventSetupInstructions(e.target.value)} rows={2} placeholder="Arrange display tables, hang banners, etc." className={`${fieldInput} resize-none`} />
                                </Field>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <Field label="Pickup time after event (same-day legs)">
                        <select value={eventPickupTimeAfter} onChange={(e) => setEventPickupTimeAfter(e.target.value)} className={`${fieldInput} max-w-xs`}>
                          <option value="Evening 6–9 PM">Evening 6–9 PM</option>
                          <option value="Evening 8–10 PM">Evening 8–10 PM</option>
                          <option value="After midnight">After midnight</option>
                          <option value="Next morning">Next morning</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  {/* Event Items */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Event Items</h3>
                    <div className="space-y-1.5">
                      {eventItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => setEventItems((prev) => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                            placeholder="e.g. Display tables"
                            className={`${fieldInput} flex-1 min-w-0`}
                          />
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => setEventItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) || 1 } : it))}
                            className="w-14 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-center text-[var(--tx)]"
                          />
                          <select
                            value={item.weight_category}
                            onChange={(e) => setEventItems((prev) => prev.map((it, i) => i === idx ? { ...it, weight_category: e.target.value as "light" | "medium" | "heavy" } : it))}
                            className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                          >
                            <option value="light">Light</option>
                            <option value="medium">Medium</option>
                            <option value="heavy">Heavy</option>
                          </select>
                          <button type="button" onClick={() => setEventItems((prev) => prev.filter((_, i) => i !== idx))} className="text-[var(--tx3)] hover:text-red-400 text-[var(--text-base)] shrink-0">×</button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEventItems((prev) => [...prev, { name: "", quantity: 1, weight_category: "medium" }])}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
                      >
                        <Plus className="w-3 h-3" /> Add item
                      </button>
                    </div>
                  </div>

                  {/* Additional Services */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Additional Services</h3>
                    {[
                      "Furniture assembly at venue",
                      "Signage installation",
                      "Staging and arrangement",
                      "Overnight storage at Yugo facility",
                    ].map((svc) => (
                      <label key={svc} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eventAdditionalServices.includes(svc)}
                          onChange={(e) => setEventAdditionalServices((prev) =>
                            e.target.checked ? [...prev, svc] : prev.filter((s) => s !== svc)
                          )}
                          className="accent-[var(--gold)] w-3.5 h-3.5"
                        />
                        <span className="text-[11px] text-[var(--tx2)]">{svc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Labour Only fields ── */}
              {serviceType === "labour_only" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Labour Only</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <MultiStopAddressField
                        label="Work Address *"
                        placeholder="55 Avenue Rd, Unit 2801"
                        stops={[{ address: workAddress }, ...extraWorkStops]}
                        onChange={(stops) => {
                          setWorkAddress(stops[0]?.address ?? "");
                          setExtraWorkStops(stops.slice(1));
                        }}
                        inputClassName={fieldInput}
                      />
                    </div>
                    <div className="w-full sm:w-[150px] shrink-0">
                      <Field label="Access">
                        <select value={workAccess} onChange={(e) => setWorkAccess(e.target.value)} className={fieldInput}>
                          {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </Field>
                    </div>
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
                      <select value={labourCrewSize} onChange={(e) => setLabourCrewSize(Number(e.target.value))} className={fieldInput}>
                        <option value={2}>2-Person Crew</option>
                        <option value={3}>3-Person Crew</option>
                        <option value={4}>4-Person Crew</option>
                        <option value={5}>5-Person Crew</option>
                      </select>
                    </Field>
                    <Field label="Estimated Hours">
                      <select value={labourHours} onChange={(e) => setLabourHours(Number(e.target.value))} className={fieldInput}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                          <option key={h} value={h}>{h === 8 ? "Full day (8h)" : `${h} hour${h > 1 ? "s" : ""}`}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Truck Required">
                      <select value={labourTruckRequired ? "yes" : "no"} onChange={(e) => setLabourTruckRequired(e.target.value === "yes")} className={fieldInput}>
                        <option value="no">No truck</option>
                        <option value="yes">Yes, truck needed</option>
                      </select>
                    </Field>
                    <Field label="Number of Visits">
                      <select value={labourVisits} onChange={(e) => setLabourVisits(Number(e.target.value))} className={fieldInput}>
                        <option value={1}>1 visit</option>
                        <option value={2}>2 visits (return)</option>
                      </select>
                    </Field>
                  </div>
                  {labourVisits >= 2 && (
                    <Field label="Second Visit Date">
                      <input type="date" value={labourSecondVisitDate} onChange={(e) => setLabourSecondVisitDate(e.target.value)} className={`${fieldInput} w-40`} />
                    </Field>
                  )}
                  <div className="rounded-lg border border-[var(--brd)] px-3 py-2.5 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={labourStorageNeeded}
                        onChange={(e) => setLabourStorageNeeded(e.target.checked)}
                        className="accent-[var(--gold)] w-3.5 h-3.5"
                      />
                      <span className="text-[11px] text-[var(--tx2)]">Storage needed between visits?</span>
                    </label>
                    {labourStorageNeeded && (
                      <div className="pl-5 space-y-1">
                        <Field label="Estimated storage duration (weeks)">
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={labourStorageWeeks}
                            onChange={(e) => setLabourStorageWeeks(Math.max(1, Number(e.target.value) || 1))}
                            className={`${fieldInput} w-28`}
                          />
                        </Field>
                        <p className="text-[10px] text-[var(--tx3)]">
                          Storage fee on quote uses platform <code className="text-[9px]">storage_weekly_rate</code> (default $75/wk) × weeks, coordinator refines volume if needed.
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

              {(serviceType === "b2b_delivery" || serviceType === "b2b_oneoff") && (
                <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 md:p-6 space-y-4 max-w-[720px]">
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60">B2B delivery (single form)</p>
                  <p className="text-[12px] text-[var(--tx3)] leading-relaxed">
                    Same B2B Jobs form as Deliveries: verticals, dimensional pricing, multi-stop routes, draft / quote / schedule.
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

              {serviceType === "bin_rental" && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Bundle & pricing</h3>
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
                          <span className="text-[12px] font-semibold text-[var(--tx)]">{b.label}</span>
                          {b.popular && (
                            <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--gold)]">Popular</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--tx3)] mt-0.5">{b.detail}</p>
                      </button>
                    ))}
                  </div>
                  {binBundleType === "custom" && (
                    <Field label="Number of bins (min 5)">
                      <input
                        type="number"
                        min={5}
                        value={binCustomCount}
                        onChange={(e) => setBinCustomCount(Math.max(5, Number(e.target.value) || 5))}
                        className={`${fieldInput} w-32`}
                      />
                    </Field>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Extra bins</span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-[var(--brd)] text-[11px]"
                      onClick={() => setBinExtraBins((n) => Math.max(0, n - 1))}
                    >
                      −
                    </button>
                    <span className="text-[12px] font-mono w-8 text-center">{binExtraBins}</span>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-[var(--brd)] text-[11px]"
                      onClick={() => setBinExtraBins((n) => n + 1)}
                    >
                      +
                    </button>
                    <span className="text-[11px] text-[var(--tx2)]">
                      × {fmtPrice(cfgNum(config, "bin_individual_price", cfgNum(config, "bin_rental_individual_price", 6)))} each
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binPackingPaper}
                      onChange={(e) => setBinPackingPaper(e.target.checked)}
                      className="accent-[var(--gold)]"
                    />
                    Packing paper — {fmtPrice(cfgNum(config, "bin_packing_paper_fee", 20))}
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binMaterialDelivery}
                      onChange={(e) => setBinMaterialDelivery(e.target.checked)}
                      className="accent-[var(--gold)]"
                    />
                    Material delivery charge — {fmtPrice(cfgNum(config, "bin_delivery_charge", 20))}{" "}
                    <span className="text-[10px] text-[var(--tx3)]">
                      (waived if bins are being delivered with a Yugo move — link move ID or uncheck)
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
                      <p className="font-semibold text-[var(--tx)]">Inventory</p>
                      {quoteResult?.bin_inventory ? (
                        <p className="text-[var(--tx2)]">
                          Available bins: {quoteResult.bin_inventory.available} of {quoteResult.bin_inventory.total} (
                          {quoteResult.bin_inventory.out_on_rental} currently out on rental)
                        </p>
                      ) : binInventorySnapshot ? (
                        <p className="text-[var(--tx2)]">
                          Available bins: {binInventorySnapshot.available} of {binInventorySnapshot.total} (
                          {binInventorySnapshot.out} currently out on rental)
                        </p>
                      ) : (
                        <p className="text-[var(--tx2)]">
                          Fleet capacity: {binLivePreview.cap} bins total — generate quote to confirm live availability
                        </p>
                      )}
                      {binLivePreview.error && (
                        <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <Warning className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                          {binLivePreview.error}
                        </p>
                      )}
                      {binLivePreview.available != null &&
                        !binLivePreview.error &&
                        binLivePreview.need > binLivePreview.available && (
                          <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
                            <Warning className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                            Only {binLivePreview.available} bins available.
                            {BIN_RENTAL_BUNDLE_SPECS[binBundleType as keyof typeof BIN_RENTAL_BUNDLE_SPECS]
                              ? ` This ${BIN_BUNDLE_OPTIONS.find((b) => b.value === binBundleType)?.label ?? ""} bundle needs ${binLivePreview.need}.`
                              : ""}
                          </p>
                        )}
                      {binLivePreview.invOk && binLivePreview.subtotal != null && !binLivePreview.error && (
                        <p className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" weight="bold" aria-hidden />
                          Sufficient inventory
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 6. Add-ons (popular first, show all expander) ── */}
              {applicableAddons.length > 0 && serviceType !== "bin_rental" && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Add-Ons</h3>
                  {recommendedTier === "estate" && serviceType === "local_move" && (
                    <div className="text-[10px] text-[var(--tx2)] bg-[var(--bg)] rounded-lg px-3 py-2.5 border border-[var(--brd)] space-y-1.5">
                      <p className="font-bold tracking-wide text-[var(--tx)]">{ESTATE_ADDON_UI_LINES[0]}</p>
                      <p className="leading-snug">{ESTATE_ADDON_UI_LINES[1]}</p>
                      <p className="font-semibold text-[var(--tx)] pt-0.5">{ESTATE_ADDON_UI_LINES[2]}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {popularAddons.map((addon) => {
                      const sel = selectedAddons.get(addon.id);
                      const isSelected = !!sel;
                      let displayPrice = "";
                      if (addon.price_type === "flat") displayPrice = fmtPrice(addon.price);
                      else if (addon.price_type === "per_unit") displayPrice = `${fmtPrice(addon.price)} ${addon.unit_label ?? "each"}`;
                      else if (addon.price_type === "tiered") displayPrice = "varies";
                      else if (addon.price_type === "percent") displayPrice = `${((addon.percent_value ?? 0) * 100).toFixed(0)}%`;
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
                                <span className="text-[12px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{addon.name}</span>
                                {addon.is_popular && (
                                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">Popular</span>
                                )}
                                <span className="text-[11px] text-[var(--tx3)] ml-auto shrink-0">{displayPrice}</span>
                              </div>
                              {addon.description && (
                                <p className="text-[10px] text-[var(--tx3)] mt-0.5 leading-snug">{addon.description}</p>
                              )}
                            </div>
                          </label>
                          {isSelected && addon.price_type === "per_unit" && (
                            <div className="ml-6 flex items-center gap-2">
                              <span className="text-[10px] text-[var(--tx3)]">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={sel!.quantity}
                                onChange={(e) => updateAddonQty(addon.id, parseInt(e.target.value) || 1)}
                                className="w-16 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
                              />
                              <span className="text-[10px] text-[var(--tx3)]">= {fmtPrice(addon.price * (sel!.quantity || 1))}</span>
                            </div>
                          )}
                          {isSelected && addon.price_type === "tiered" && addon.tiers && (
                            <div className="ml-6 flex items-center gap-2">
                              <select
                                value={sel!.tier_index}
                                onChange={(e) => updateAddonTier(addon.id, parseInt(e.target.value))}
                                className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
                              >
                                {addon.tiers.map((t, i) => (
                                  <option key={i} value={i}>{t.label}, {fmtPrice(t.price)}</option>
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
                        {showAllAddons ? "Hide other add-ons" : "Show all add-ons ▾"}
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAllAddons ? "rotate-90" : ""}`} />
                      </button>
                    )}
                    {showAllAddons && otherAddons.map((addon) => {
                      const sel = selectedAddons.get(addon.id);
                      const isSelected = !!sel;
                      let displayPrice = "";
                      if (addon.price_type === "flat") displayPrice = fmtPrice(addon.price);
                      else if (addon.price_type === "per_unit") displayPrice = `${fmtPrice(addon.price)} ${addon.unit_label ?? "each"}`;
                      else if (addon.price_type === "tiered") displayPrice = "varies";
                      else if (addon.price_type === "percent") displayPrice = `${((addon.percent_value ?? 0) * 100).toFixed(0)}%`;
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
                                <span className="text-[12px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{addon.name}</span>
                                {addon.is_popular && (
                                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">Popular</span>
                                )}
                                <span className="text-[11px] text-[var(--tx3)] ml-auto shrink-0">{displayPrice}</span>
                              </div>
                              {addon.description && (
                                <p className="text-[10px] text-[var(--tx3)] mt-0.5 leading-snug">{addon.description}</p>
                              )}
                            </div>
                          </label>
                          {isSelected && addon.price_type === "per_unit" && (
                            <div className="ml-6 flex items-center gap-2">
                              <span className="text-[10px] text-[var(--tx3)]">Qty:</span>
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={sel!.quantity}
                                onChange={(e) => updateAddonQty(addon.id, parseInt(e.target.value) || 1)}
                                className="w-16 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
                              />
                              <span className="text-[10px] text-[var(--tx3)]">= {fmtPrice(addon.price * (sel!.quantity || 1))}</span>
                            </div>
                          )}
                          {isSelected && addon.price_type === "tiered" && addon.tiers && (
                            <div className="ml-6 flex items-center gap-2">
                              <select
                                value={sel!.tier_index}
                                onChange={(e) => updateAddonTier(addon.id, parseInt(e.target.value))}
                                className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
                              >
                                {addon.tiers.map((t, i) => (
                                  <option key={i} value={i}>{t.label}, {fmtPrice(t.price)}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-3 border-t border-[var(--brd)] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--tx)]">Add-ons total</span>
                    <span className="text-[var(--text-base)] font-bold text-[var(--gold)]">{fmtPrice(addonSubtotal)}</span>
                  </div>
                </div>
              )}

              <div className="h-4" />
            </div>
          </div>

          {/* ── Sticky bottom button bar ── */}
          <div className="sticky bottom-0 z-10 py-3 px-5 bg-[var(--card)] border border-[var(--brd)] border-t-[var(--brd)] rounded-b-xl">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={
                  generating ||
                  serviceType === "b2b_delivery" ||
                  serviceType === "b2b_oneoff"
                }
                className="flex-1 py-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-2 bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
                  </>
                ) : serviceType === "b2b_delivery" || serviceType === "b2b_oneoff" ? (
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
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold border-2 flex items-center justify-center gap-2 ${
                  sendSuccess
                    ? "border-[var(--grn)] bg-[var(--grn)]/10 text-[var(--grn)] cursor-default"
                    : "border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 disabled:opacity-40"
                }`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
                  </>
                ) : sendSuccess ? (
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" weight="bold" aria-hidden />
                    Sent
                  </span>
                ) : serviceType === "b2b_delivery" || serviceType === "b2b_oneoff" ? (
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
                onClick={() => quoteResult && window.open(`/quote/${quoteResult.quote_id}`, "_blank")}
                disabled={!quoteResult}
                className="py-2.5 px-4 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT PANEL, Live Quote Preview ═══ */}

        {/* Collapsed toggle tab */}
        {!previewOpen && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="hidden min-[480px]:flex fixed right-0 top-24 z-20 items-center gap-1.5 px-2 py-4 rounded-l-lg bg-[var(--card)] border border-r-0 border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-colors shadow-lg"
            title="Show preview"
          >
            <PanelRightOpen className="w-4 h-4" />
            <span className="text-[9px] font-bold tracking-wider uppercase [writing-mode:vertical-lr]">Preview</span>
          </button>
        )}

        <div className={`transition-all duration-300 shrink-0 ${previewOpen ? "w-full min-[480px]:w-[40%] min-[480px]:min-w-[240px]" : "hidden min-[480px]:block min-[480px]:w-0 min-[480px]:overflow-hidden min-[480px]:opacity-0 pointer-events-none"}`}>
          <div className="sticky top-6 space-y-4">
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--brd)] flex items-center justify-between">
                <div>
                  <h2 className="admin-section-h2">
                    {quoteResult ? `Quote ${quoteResult.quote_id}` : "Live Quote Preview"}
                  </h2>
                  {!quoteResult && (
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">Updates as you fill in the form</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="hidden min-[480px]:flex p-1.5 rounded-lg text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--bg)] transition-colors"
                  title="Collapse preview"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {serviceAreaBlock?.quote_blocked && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-3 text-[11px]">
                    <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Warning size={14} className="shrink-0" weight="bold" aria-hidden />
                      Outside service area
                    </p>
                    <p className="text-[var(--tx2)]">{serviceAreaBlock.message}</p>
                    <p className="text-[10px] text-[var(--tx3)]">
                      Quote generation is paused. Use override only for subcontracting, partner crews, or another
                      confirmed arrangement — not for a standard Toronto-base move.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleGenerate({ serviceAreaOverride: true })}
                        disabled={generating}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
                      >
                        Quote anyway (manual override)
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceAreaBlock(null)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Official result (after Generate) ── */}
                {quoteResult ? (
                  <>
                    {quoteResult.tiers ? (
                      <TiersDisplay
                        tiers={quoteResult.tiers}
                        recommendedTier={recommendedTier}
                        estateMultiDayUplift={(() => {
                          const f = quoteResult.factors as Record<string, unknown> | undefined;
                          const u = f?.estate_multi_day_labour_uplift;
                          return typeof u === "number" && u > 0 ? u : 0;
                        })()}
                      />
                    ) : quoteResult.custom_price && serviceType === "event" ? (
                      <EventPriceDisplay price={quoteResult.custom_price} factors={quoteResult.factors as Record<string, unknown>} />
                    ) : quoteResult.custom_price && serviceType === "bin_rental" ? (
                      <BinRentalPriceDisplay price={quoteResult.custom_price} factors={quoteResult.factors as Record<string, unknown>} />
                    ) : quoteResult.custom_price && serviceType === "labour_only" ? (
                      <LabourOnlyPriceDisplay price={quoteResult.custom_price} factors={quoteResult.factors as Record<string, unknown>} />
                    ) : quoteResult.custom_price && (serviceType === "b2b_delivery" || serviceType === "b2b_oneoff") ? (
                      <B2BPriceDisplay price={quoteResult.custom_price} factors={quoteResult.factors as Record<string, unknown>} />
                    ) : quoteResult.custom_price ? (
                      <SinglePriceDisplay price={quoteResult.custom_price} label={toTitleCase(serviceType)} />
                    ) : null}

                    {quoteResult.addons && quoteResult.addons.items.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Add-Ons</h4>
                        {quoteResult.addons.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--tx2)]">{item.name}</span>
                            <span className="text-[var(--tx)] font-medium">{fmtPrice(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {quoteResult.factors &&
                      serviceType === "local_move" &&
                      recommendedTier === "estate" &&
                      (() => {
                        const f = quoteResult.factors as Record<string, unknown>;
                        const plan = f.estate_day_plan as { days?: number } | undefined;
                        const lines = f.estate_schedule_lines as string[] | undefined;
                        const head = f.estate_schedule_headline as string | undefined;
                        if (!plan || (plan.days ?? 0) <= 1 || !lines?.length) return null;
                        return (
                          <div className="rounded-xl border border-[var(--tx)]/[0.08] bg-[#F9F9F8] dark:bg-white/[0.04] dark:border-white/[0.08] p-3.5 space-y-2 text-[11px] text-[var(--tx2)]">
                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--tx3)]">
                              Estate schedule
                            </p>
                            <p className="text-[var(--tx)] font-medium leading-snug">{head}</p>
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
                      showMultipliers={userRole === "owner" || userRole === "admin"}
                      tiers={quoteResult.tiers}
                      moveSize={moveSize}
                    />

                    {/* FIX 6: Algorithm anomaly warnings for coordinator review */}
                    {quoteResult.factors && quoteResult.factors.deadhead_capped === true && (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5 text-[11px] text-[var(--tx2)]">
                        <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <Warning size={12} className="shrink-0" weight="bold" aria-hidden />
                          Deadhead distance capped
                        </p>
                        <p>
                          Pickup is{" "}
                          <span className="font-medium text-[var(--tx)]">
                            {Number(quoteResult.factors.deadhead_km_actual ?? 0).toLocaleString()}
                          </span>{" "}
                          km from base. Surcharge uses a cap of{" "}
                          <span className="font-medium text-[var(--tx)]">
                            {Number(quoteResult.factors.deadhead_cap_km ?? 100)}
                          </span>{" "}
                          km. Manual pricing review recommended.
                        </p>
                      </div>
                    )}

                    {(quoteResult.inventory_warnings?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5 text-[11px]">
                        <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Warning size={12} className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
                          Check inventory quantities
                        </p>
                        <ul className="list-disc list-inside text-[var(--tx2)]">
                          {quoteResult.inventory_warnings!.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {quoteResult.factors && typeof quoteResult.factors.inventory_modifier === "number" && typeof quoteResult.factors.inventory_max_modifier === "number" && quoteResult.factors.inventory_modifier >= quoteResult.factors.inventory_max_modifier && (
                      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-[var(--tx2)]">
                        <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Info size={14} className="shrink-0 text-blue-500" weight="bold" aria-hidden />
                          Inventory at volume ceiling (×{Number(quoteResult.factors.inventory_max_modifier).toFixed(2)})
                        </p>
                        <p className="mt-0.5">Price is capped, consider manual adjustment for this move.</p>
                      </div>
                    )}
                    {quoteResult.factors && typeof quoteResult.factors.labour_component === "number" && typeof quoteResult.factors.subtotal_before_labour === "number" && (quoteResult.factors.subtotal_before_labour as number) > 0 && (quoteResult.factors.labour_component as number) > 0.5 * (quoteResult.factors.subtotal_before_labour as number) && (
                      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-[var(--tx2)]">
                        <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Info size={14} className="shrink-0 text-blue-500" weight="bold" aria-hidden />
                          High labour component: {fmtPrice(quoteResult.factors.labour_component as number)}
                        </p>
                        <p className="mt-0.5">This move needs significantly more crew/time than standard.</p>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Optimistic live preview ── */
                  <>
                    {liveEstimate && "essential" in liveEstimate ? (
                      <OptimisticTiers est={liveEstimate} isLongDistance={serviceType === "long_distance"} />
                    ) : (serviceType === "local_move" || serviceType === "long_distance") && !liveEstimate ? (
                      <div className="rounded-xl border border-[var(--brd)]/60 bg-[var(--card)]/40 p-4 text-[11px] text-[var(--tx2)]">
                        <p className="flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5" aria-hidden />
                          <span>Select move size or add inventory to see a rough tier preview. Generate quote for exact pricing.</span>
                        </p>
                      </div>
                    ) : serviceType === "bin_rental" && binLivePreview && binLivePreview.subtotal != null && !binLivePreview.error ? (
                      <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 space-y-2">
                        <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Bin rental (estimate)</p>
                        {binLivePreview.lines.map((l, i) => (
                          <div key={i} className="flex justify-between text-[11px]">
                            <span className="text-[var(--tx2)]">{l.label}</span>
                            <span className="text-[var(--tx)] font-medium">{fmtPrice(l.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                          <span className="text-[var(--tx3)]">Subtotal</span>
                          <span className="font-semibold">{fmtPrice(binLivePreview.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--tx3)]">HST</span>
                          <span>{fmtPrice(binLivePreview.tax ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-[12px] font-bold">
                          <span>Total</span>
                          <span className="text-[var(--gold)]">{fmtPrice(binLivePreview.total ?? 0)}</span>
                        </div>
                        <p className="text-[9px] text-[var(--tx3)]">Generate for live inventory and final totals.</p>
                      </div>
                    ) : (serviceType === "b2b_delivery" || serviceType === "b2b_oneoff") && b2bDimensionalPreview ? (
                      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)]/80 p-4 space-y-2">
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
                          <span>Crew: {String(b2bDimensionalPreview.dim.crew)}</span>
                          <span>Est. hours: {String(b2bDimensionalPreview.dim.estimatedHours)}</span>
                        </p>
                        {b2bDeliveryKmFromGta != null ? (
                          <p className="text-[10px] text-[var(--tx3)]">
                            {b2bDeliveryKmFromGta.toFixed(1)} Km From GTA Core (Straight-Line).
                          </p>
                        ) : null}
                        {effectiveB2bLinesPreview.some((l) => l.description.trim()) ? (
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
                            <Warning className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                            Add Line Items To Include Unit Pricing In This Preview.
                          </p>
                        ) : null}
                        {b2bDimensionalPreview.dim.breakdown
                          .filter((l) => l.amount !== 0)
                          .map((l, i) => (
                            <div key={i} className="flex justify-between text-[11px] gap-2">
                              <span className="text-[var(--tx2)] min-w-0 break-words pr-2">{l.label}</span>
                              <span className="text-[var(--tx)] font-medium shrink-0">{fmtPrice(l.amount)}</span>
                            </div>
                          ))}
                        {b2bDimensionalPreview.access > 0 && !b2bDimensionalPreview.fullOverrideApplied ? (
                          <div className="flex justify-between text-[11px] gap-2">
                            <span className="text-[var(--tx2)]">Access Surcharge</span>
                            <span className="text-[var(--tx)] font-medium shrink-0">
                              {fmtPrice(b2bDimensionalPreview.access)}
                            </span>
                          </div>
                        ) : null}
                        {addonSubtotal > 0 && !b2bDimensionalPreview.fullOverrideApplied ? (
                          <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                            <span className="text-[var(--tx3)]">Add-Ons (Selected)</span>
                            <span className="text-[var(--tx)] font-medium">{fmtPrice(addonSubtotal)}</span>
                          </div>
                        ) : null}
                        {b2bDimensionalPreview.fullOverrideApplied ? (
                          <div className="pt-1 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">
                              Price Override: {fmtPrice(b2bDimensionalPreview.preTaxTotal)}
                            </p>
                            {b2bDimensionalPreview.overrideReason ? (
                              <p className="text-[9px] text-[var(--tx3)]">{b2bDimensionalPreview.overrideReason}</p>
                            ) : null}
                            <p className="text-[10px] text-[var(--tx3)] line-through">
                              Calculated Pre-Tax:{" "}
                              {fmtPrice(b2bDimensionalPreview.calculatedPreTaxBeforeOverride ?? b2bDimensionalPreview.engineSubtotal)}
                            </p>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--brd)]/40">
                          <span className="text-[var(--tx3)]">Subtotal (Pre-Tax)</span>
                          <span className="font-semibold">{fmtPrice(b2bDimensionalPreview.preTaxTotal)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--tx3)]">HST</span>
                          <span>{fmtPrice(b2bDimensionalPreview.tax)}</span>
                        </div>
                        <div className="flex justify-between text-[12px] font-bold text-[var(--tx)]">
                          <span>Total</span>
                          <span className="tabular-nums">{fmtPrice(b2bDimensionalPreview.total)}</span>
                        </div>
                        <p className="text-[9px] text-[var(--tx3)] leading-snug">
                          Generate For Server Pricing, Partner Rates, And Final Breakdown.
                        </p>
                      </div>
                    ) : serviceType === "b2b_delivery" || serviceType === "b2b_oneoff" ? (
                      <div className="rounded-xl border border-[var(--brd)]/60 bg-[var(--card)]/40 p-4 text-[11px] text-[var(--tx2)]">
                        <p className="flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 text-[var(--gold)] mt-0.5" aria-hidden />
                          <span>Add active delivery verticals under Platform settings to enable live B2B pricing preview.</span>
                        </p>
                      </div>
                    ) : specialtyLivePreview ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3">
                          <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Suggested Range</p>
                          <p className="text-[18px] font-bold text-[var(--gold)]">
                            {fmtPrice(specialtyLivePreview.min)} – {fmtPrice(specialtyLivePreview.max)}
                          </p>
                          <p className="text-[10px] text-[var(--tx3)] mt-1 leading-snug">
                            Based on: {specialtyLivePreview.typeLabel}
                            {specialtyLivePreview.weightLabel ? `, ${specialtyLivePreview.weightLabel}` : ""}
                            {specialtyRouteKm != null
                              ? `, ${specialtyRouteKm} km route`
                              : specialtyRouteLoading
                                ? ", calculating distance…"
                                : ", add addresses for distance adjustment"}
                            {specialtyLivePreview.distSur > 0
                              ? ` (+${fmtPrice(specialtyLivePreview.distSur)} distance)`
                              : ""}
                            {specialtyRequirements.includes("crane_rigging") ? " + crane/rigging" : ""}
                            {specialtyRequirements.includes("climate_controlled") ? " + climate" : ""}
                            {cratingRequired && cratingItems.length > 0 ? " + crating" : ""}
                          </p>
                        </div>
                        <p className="text-[9px] text-[var(--tx3)] leading-snug">
                          Click Generate for the final priced quote (includes timeline and server pricing rules).
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-2">
                          <ChevronDown className="w-4 h-4 text-[var(--tx3)]" />
                        </div>
                        <p className="text-[11px] text-[var(--tx3)]">Fill in the form to see a live estimate</p>
                      </div>
                    )}

                    {addonSubtotal > 0 && serviceType !== "b2b_delivery" && (
                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--brd)]">
                        <span className="text-[var(--tx3)]">Add-ons</span>
                        <span className="text-[var(--tx)] font-medium">+{fmtPrice(addonSubtotal)}</span>
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
                  <span className="font-mono font-bold text-[var(--tx)]">{quoteResult.quote_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Expires</span>
                  <ExpiryLabel expiresAt={quoteResult.expires_at} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Distance</span>
                  <span className="text-[var(--tx)]">
                    {quoteResult.service_type === "event" &&
                    typeof quoteResult.factors?.event_distance_summary === "string" &&
                    quoteResult.factors.event_distance_summary.trim()
                      ? String(quoteResult.factors.event_distance_summary)
                      : quoteResult.distance_km
                        ? `${quoteResult.distance_km} km`
                        : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Drive Time</span>
                  <span className="text-[var(--tx)]">{quoteResult.drive_time_min ? `${quoteResult.drive_time_min} min` : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">{quoteDetailDateLabel(serviceType)}</span>
                  <span className="text-[var(--tx)]">{quoteResult.move_date || "-"}</span>
                </div>
                {(serviceType === "local_move" ||
                  serviceType === "long_distance" ||
                  serviceType === "white_glove") && (
                  <div className="pt-2 border-t border-[var(--brd)]/50 space-y-2">
                    <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Route preview</p>
                    {(() => {
                      const fac = quoteResult.factors as Record<string, unknown> | null | undefined;
                      const pickups = abbreviateLocationRows(
                        pickupLocationsFromQuote(fac ?? null, fromAddress, fromAccess),
                      );
                      const dropoffs = abbreviateLocationRows(
                        dropoffLocationsFromQuote(fac ?? null, toAddress, toAccess),
                      );
                      return (
                        <>
                          <div>
                            <p className="text-[9px] font-semibold text-[var(--tx3)] mb-1">
                              Pickup{pickups.length > 1 ? ` locations (${pickups.length})` : ""}
                            </p>
                            <ul className="space-y-1.5">
                              {pickups.map((row, i) => (
                                <li key={i} className="flex gap-2 text-[10px] text-[var(--tx)]">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--gold)] mt-0.5" aria-hidden />
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
                                {pickups.length} pickup locations — crew will visit each stop.
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[9px] font-semibold text-[var(--tx3)] mb-1">Destination</p>
                            <ul className="space-y-1.5">
                              {dropoffs.map((row, i) => (
                                <li key={i} className="flex gap-2 text-[10px] text-[var(--tx)]">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--gold)] mt-0.5" aria-hidden />
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
                    <span className="text-[var(--tx)] font-medium">On-site Event</span>
                  </div>
                )}
                {hubspotDealId && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">HubSpot Deal</span>
                    <span className="font-mono text-[var(--tx)]">#{hubspotDealId}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Labour estimate (coordinator-only) ── */}
            {quoteResult?.labour && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2.5 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Labour Estimate</h4>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="text-[var(--tx)]">{quoteResult.labour.crewSize}-person crew <span className="text-[var(--tx3)]">(recommended)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="text-[var(--tx)]">{quoteResult.labour.hoursRange}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="text-[var(--tx)]">1 × {quoteResult.labour.truckSize}</span>
                </div>
                {quoteResult.inventory && (quoteResult.inventory.modifier !== 1.0 || (quoteResult.inventory.boxCount ?? 0) > 0) && (
                  <div className="pt-2 border-t border-[var(--brd)]/50 flex items-center justify-between text-[10px]">
                    <span className="text-[var(--tx3)]">
                      Inventory volume
                      <span className="ml-1 text-[var(--tx)]">
                        ({quoteResult.inventory.totalItems} items
                        {(quoteResult.inventory.boxCount ?? 0) > 0 && ` + ${quoteResult.inventory.boxCount} boxes`}
                        {quoteResult.inventory.modifier !== 1.0 && `, ${quoteResult.inventory.modifier < 1 ? "below" : "above"} standard`})
                      </span>
                    </span>
                    <span className={`font-mono font-bold ${quoteResult.inventory.modifier < 1 ? "text-emerald-400" : "text-orange-400"}`}>
                      Score {quoteResult.inventory.score.toFixed(1)}
                      {quoteResult.inventory.modifier !== 1.0 && ` · ×${quoteResult.inventory.modifier.toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Fleet allocation (after generate) ── */}
            {quoteResult?.truck?.primary && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2.5 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Fleet Allocation</h4>
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <div>
                    <span className="text-[var(--tx)] font-medium">{quoteResult.truck.primary.display_name}</span>
                    <span className="text-[var(--tx3)] ml-1.5">{quoteResult.truck.primary.cargo_cubic_ft.toLocaleString()} cu ft</span>
                  </div>
                </div>
                {quoteResult.truck.secondary && (
                  <div className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <div>
                      <span className="text-[var(--tx)] font-medium">{quoteResult.truck.secondary.display_name}</span>
                      <span className="text-[var(--tx3)] ml-1"> (support)</span>
                    </div>
                  </div>
                )}
                {quoteResult.truck.notes && (
                  <p className="text-[10px] text-[var(--tx3)] italic">{quoteResult.truck.notes}</p>
                )}
              </div>
            )}

            {/* ── Valuation protection (after generate) ── */}
            {quoteResult?.valuation && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2.5 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Valuation Protection</h4>
                {["essential", "signature", "estate"].map((pkg) => {
                  const included = { essential: "Released Value", signature: "Enhanced Value", estate: "Full Replacement" }[pkg] ?? pkg;
                  const upgrade = quoteResult.valuation?.upgrades?.[pkg];
                  return (
                    <div key={pkg} className="flex items-center justify-between">
                      <span className="text-[var(--tx3)] uppercase">{pkg}</span>
                      <span className="text-[var(--tx)]">
                        {included}
                        {upgrade ? <span className="text-[var(--gold)] ml-1">(+{fmtPrice(upgrade.price)} upgrade)</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Margin estimate, super-admin only; API omits fields for others ── */}
            {quoteResult?.factors &&
              isSuperAdmin &&
              (typeof (quoteResult.factors as Record<string, unknown>).estimated_margin_essential === "number" ||
               typeof (quoteResult.factors as Record<string, unknown>).estimated_margin_curated === "number") && (
              <div className="bg-[var(--bg2)] border border-[var(--brd)] rounded-xl p-4 space-y-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Margin Estimate</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-[var(--tx3)]/20 text-[var(--tx3)] px-1.5 py-0.5 rounded">Super Admin</span>
                </div>
                {(() => {
                  const f = quoteResult.factors as Record<string, unknown>;
                  const cost = (f.estimated_cost as { labour?: number; truck?: number; fuel?: number; supplies?: number; total?: number } | undefined);
                  const tiers = quoteResult.tiers as Record<string, { price: number }> | undefined;
                  const curPrice = tiers?.essential?.price ?? tiers?.curated?.price ?? tiers?.essentials?.price ?? 0;
                  const sigPrice = tiers?.signature?.price ?? tiers?.premier?.price ?? 0;
                  const estPrice = tiers?.estate?.price ?? 0;
                  const estTotalCost = cost?.total ?? 0;
                  const margins = [
                    { label: "Essential", price: curPrice, margin: typeof f.estimated_margin_essential === "number" ? f.estimated_margin_essential : (typeof f.estimated_margin_curated === "number" ? f.estimated_margin_curated : 0) },
                    { label: "Signature", price: sigPrice, margin: typeof f.estimated_margin_signature === "number" ? f.estimated_margin_signature : 0 },
                    { label: "Estate", price: estPrice, margin: typeof f.estimated_margin_estate === "number" ? f.estimated_margin_estate : 0 },
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
                      cls: "text-emerald-400",
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
                          <div key={label} className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--brd)]/40 last:border-0">
                            <div>
                              <span className="text-[var(--tx2)] font-medium">{label}</span>
                              <span className="text-[var(--tx3)] ml-1.5">{fmtPrice(price)}</span>
                            </div>
                            <div className="text-right shrink-0 max-w-[min(100%,12rem)]">
                              <span className={`inline-flex items-center gap-1.5 font-bold tabular-nums ${alert.cls}`}>
                                {margin}%
                                <AlertIcon className="w-3.5 h-3.5 shrink-0" weight="bold" aria-hidden />
                              </span>
                              <p className="text-[9px] text-[var(--tx3)] leading-snug">{alert.hint}</p>
                              <p className="text-[9px] text-[var(--tx3)]">profit {fmtPrice(profit)}</p>
                            </div>
                          </div>
                        );
                      })}
                      {cost && (
                        <div className="pt-1 text-[10px] text-[var(--tx3)] space-y-0.5">
                          <div className="flex justify-between">
                            <span>Est. cost</span>
                            <span className="tabular-nums text-[var(--tx2)]">{fmtPrice(estTotalCost)}</span>
                          </div>
                          <div className="flex justify-between text-[9px]">
                            <span>
                              Labour {fmtPrice(cost.labour ?? 0)} · Truck {fmtPrice(cost.truck ?? 0)} · Fuel{" "}
                              {fmtPrice(cost.fuel ?? 0)} · Supplies {fmtPrice(cost.supplies ?? 0)}
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
            {quoteResult?.margin_warning && isSuperAdmin && (() => {
              const mw = quoteResult.margin_warning as { level: string; message: string; estimated_margin: number; target_margin: number; signature_margin: number | null };
              const isCritical = mw.level === "critical";
              const isWarning = mw.level === "warning";
              const borderCls = isCritical
                ? "border-red-400/40 bg-red-400/6"
                : isWarning
                  ? "border-orange-400/40 bg-orange-400/6"
                  : "border-amber-400/40 bg-amber-400/6";
              const titleCls = isCritical ? "text-red-400" : isWarning ? "text-orange-500" : "text-amber-600";
              const IconCmp = isCritical ? XCircle : Warning;
              const title =
                mw.level === "critical" ? "Margin alert" : mw.level === "warning" ? "Low margin" : "Margin note";
              return (
                <div className={`rounded-xl border px-4 py-3.5 ${borderCls}`}>
                  <div className="flex items-start gap-2.5">
                    <IconCmp size={16} weight="bold" className={`shrink-0 mt-0.5 ${titleCls}`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${titleCls}`}>
                        {title}
                      </p>
                      <p className={`text-[11px] mt-1 ${isCritical ? "text-red-400/90" : "text-[var(--tx2)]"}`}>
                        {mw.message}
                      </p>
                      <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                        Essential margin: <strong className="text-[var(--tx)]">{mw.estimated_margin}%</strong>
                        {" · "}
                        target {mw.target_margin}%
                      </p>
                      {mw.signature_margin !== null && (
                        <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                          Signature margin: <strong className="text-emerald-500">{mw.signature_margin}%</strong>. Consider recommending Signature for this move.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Live inventory score (before generate) ── */}
            {!quoteResult && inventoryItems.length > 0 && (serviceType === "local_move" || serviceType === "long_distance" || serviceType === "office_move") && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-2 text-[11px]">
                <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Inventory Summary</h4>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--tx3)]">Items</span>
                  <span className="text-[var(--tx)] font-medium">{inventoryTotalItems}{clientBoxCountNum > 0 ? ` + ${clientBoxCountNum} boxes` : ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--tx3)]">Score</span>
                  <span className="text-[var(--tx)] font-medium tabular-nums">{inventoryScoreWithBoxes.toFixed(1)}</span>
                </div>
                <p className="text-[9px] text-[var(--tx3)] italic">Generate quote to see volume modifier and labour estimate.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SpecialtyTransportQuoteBuilder
        open={specialtyBuilderOpen}
        onClose={() => setSpecialtyBuilderOpen(false)}
        onCreated={(id) => router.push(`/admin/quotes/${encodeURIComponent(id)}`)}
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
  const tierOrder = ["essential", "signature", "estate"] as const;
  const tierColors: Record<string, { bg: string; border: string; accent: string; muted: string; body: string; list: string }> = {
    essential: {
      bg: "bg-[var(--bg)]",
      border: "border-[var(--brd)]",
      accent: "text-[var(--tx)]",
      muted: "text-[var(--tx3)]",
      body: "text-[var(--tx)]",
      list: "text-[var(--tx2)]",
    },
    signature: {
      bg: "bg-[#FAF7F2] dark:bg-[#2A2520]",
      border: "border-2 border-[#B8962E]/40 border-l-4 border-l-[var(--gold)]",
      accent: "text-[#B8962E]",
      muted: PRICE_CARD.muted,
      body: PRICE_CARD.body,
      list: PRICE_CARD.list,
    },
    estate: {
      bg: "bg-[#1a1a2e] dark:bg-[#1a1a2e]",
      border: "border-[#C9A84C]/60",
      accent: "text-[#C9A84C]",
      muted: "text-[#B8B3A8]",
      body: "text-[#F4F1E8]",
      list: "text-[#D4CFC4]",
    },
  };
  const tierLabels: Record<string, string> = { essential: "Essential", signature: "Signature", estate: "Estate" };

  return (
    <div className="space-y-3">
      {tierOrder.map((name) => {
        const t = tiers[name];
        if (!t) return null;
        const c = tierColors[name];
        const isRecommended = name === recommendedTier;
        return (
          <div key={name} className={`rounded-xl border-2 ${c.border} ${c.bg} p-5 space-y-2`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-extrabold tracking-tight ${c.accent}`}>{tierLabels[name]}</span>
                {isRecommended && (
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                    Recommended
                  </span>
                )}
              </div>
              <span className={`text-3xl font-black tabular-nums ${c.accent}`}>{fmtPrice(t.price)}</span>
            </div>
            {name === "estate" && estateMultiDayUplift > 0 && (
              <p className={`text-[10px] leading-snug ${c.muted}`}>
                Includes <span className={`font-semibold ${c.body}`}>{fmtPrice(estateMultiDayUplift)}</span> multi-day
                loaded labour (pack + move schedule vs single-day baseline). Already in the Estate price above.
              </p>
            )}
            <div className={`flex items-center justify-between text-[11px] ${c.muted}`}>
              <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
              <span className={`font-bold ${c.body}`}>Total: {fmtPrice(t.total)}</span>
            </div>
            <div className={`flex items-center justify-between text-[11px] ${c.muted}`}>
              <span>Deposit to book</span>
              <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
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
                    <li key={i} className={`text-[10px] flex items-start gap-1.5 ${c.list}`}>
                      <Check className="w-3 h-3 text-[var(--grn)] shrink-0 mt-0.5" />
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

function SinglePriceDisplay({ price: t, label }: { price: TierResult; label: string }) {
  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E] uppercase">{label}</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className={`font-bold ${PRICE_CARD.body}`}>Total: {fmtPrice(t.total)}</span>
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>Deposit to book</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
      {t.includes.length > 0 && (
        <details className="group">
          <summary
            className={`text-[9px] font-bold uppercase cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden ${PRICE_CARD.muted}`}
          >
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
            What&apos;s included ▾
          </summary>
          <ul className="mt-1.5 space-y-0.5 pl-5">
            {t.includes.map((inc, i) => (
              <li key={i} className={`text-[10px] flex items-start gap-1.5 ${PRICE_CARD.list}`}>
                <Check className="w-3 h-3 text-[var(--grn)] shrink-0 mt-0.5" />
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

function EventPriceDisplay({ price: t, factors }: { price: TierResult; factors: Record<string, unknown> }) {
  const deliveryCharge = factors.delivery_charge as number | undefined;
  const returnCharge = factors.return_charge as number | undefined;
  const setupFee = factors.setup_fee as number | undefined;
  const returnDiscount = factors.return_discount as number | undefined;
  const eventCrew = factors.event_crew as number | undefined;
  const eventHours = factors.event_hours as number | undefined;
  const returnDate = factors.return_date as string | undefined;
  const deliveryDate = factors.delivery_date as string | undefined;

  const isMulti =
    factors.event_mode === "multi" && Array.isArray(factors.event_legs);
  const eventLegs = isMulti ? (factors.event_legs as AdminEventLegFactor[]) : [];

  const totalsFooter = (
    <>
      <div className={`pt-1.5 flex justify-between font-semibold ${PRICE_CARD.borderTop}`}>
        <span className={PRICE_CARD.muted}>Subtotal</span>
        <span className={PRICE_CARD.body}>{fmtPrice(t.price)}</span>
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className={`font-bold ${PRICE_CARD.body}`}>Total: {fmtPrice(t.total)}</span>
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>Deposit (25% pre-tax)</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
    </>
  );

  const includesBlock =
    t.includes.length > 0 ? (
      <details className="group pt-1">
        <summary
          className={`text-[9px] font-bold uppercase cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden ${PRICE_CARD.muted}`}
        >
          <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
          What&apos;s included ▾
        </summary>
        <ul className="mt-1.5 space-y-0.5 pl-5">
          {t.includes.map((inc, i) => (
            <li key={i} className={`text-[10px] flex items-start gap-1.5 ${PRICE_CARD.list}`}>
              <Check className="w-3 h-3 text-[var(--grn)] shrink-0 mt-0.5" />
              {inc}
            </li>
          ))}
        </ul>
      </details>
    ) : null;

  if (isMulti && eventLegs.length > 0) {
    return (
      <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[13px] font-bold text-[#B8962E]">Event quote</span>
            <p className={`text-[9px] mt-0.5 font-medium uppercase tracking-wide ${PRICE_CARD.muted}`}>
              Multi-event bundle, {eventLegs.length} round trip{eventLegs.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-[#B8962E] shrink-0">
            {fmtPrice(t.price)}
          </span>
        </div>
        <div className="space-y-3 text-[11px]">
          {eventLegs.map((leg, idx) => (
            <div key={idx} className={`p-3 space-y-2 ${PRICE_CARD.legPanel}`}>
              <p className="text-[9px] font-bold tracking-wider uppercase text-[#B8962E]">
                {leg.label?.trim() || `Event ${idx + 1}`}
              </p>
              {(leg.from_address || leg.to_address) && (
                <p className={`text-[9px] leading-snug opacity-90 ${PRICE_CARD.muted}`}>
                  {leg.from_address || "Origin"} → {leg.to_address || "Venue"}
                </p>
              )}
              <p className={`text-[9px] opacity-80 ${PRICE_CARD.muted}`}>
                Deliver {fmtShortEventAdmin(leg.delivery_date)} → Return {fmtShortEventAdmin(leg.return_date)}
                {leg.same_day ? " (same day)" : ""}
                {leg.is_on_site ? (
                  <span className={`ml-1 font-semibold ${PRICE_CARD.body}`}>· On-site Event</span>
                ) : null}
              </p>
              <div className="flex justify-between gap-2">
                <span className={PRICE_CARD.muted}>
                  Delivery ({fmtShortEventAdmin(leg.delivery_date)})
                  {leg.event_crew && leg.event_hours ? (
                    <span className="ml-1 opacity-75">{leg.event_crew}-person crew, {leg.event_hours}hr</span>
                  ) : null}
                </span>
                <span className={`font-medium tabular-nums shrink-0 ${PRICE_CARD.body}`}>
                  {fmtPrice(leg.delivery_charge ?? 0)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={PRICE_CARD.muted}>
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
                <span className={`font-medium tabular-nums shrink-0 ${PRICE_CARD.body}`}>
                  {fmtPrice(leg.return_charge ?? 0)}
                </span>
              </div>
            </div>
          ))}
          {(setupFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className={PRICE_CARD.muted}>Setup service (program)</span>
              <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(setupFee!)}</span>
            </div>
          )}
        </div>
        {totalsFooter}
        {includesBlock}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E]">Event Quote</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      {/* Breakdown, single round trip */}
      <div className="space-y-1.5 text-[11px]">
        {deliveryCharge !== undefined && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>
              Delivery ({deliveryDate ?? "TBD"})
              {eventCrew && eventHours ? (
                <span className="ml-1 opacity-75">{eventCrew}-person crew, {eventHours}hr</span>
              ) : null}
            </span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(deliveryCharge)}</span>
          </div>
        )}
        {(setupFee ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Setup service</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(setupFee!)}</span>
          </div>
        )}
        {returnCharge !== undefined && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>
              Return ({returnDate ?? "TBD"})
              {returnDiscount !== undefined ? (
                <span className="ml-1 opacity-75">{Math.round(returnDiscount * 100)}% of delivery</span>
              ) : null}
            </span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(returnCharge)}</span>
          </div>
        )}
      </div>
      {totalsFooter}
      {includesBlock}
    </div>
  );
}

function B2BPriceDisplay({ price: t, factors }: { price: TierResult; factors: Record<string, unknown> }) {
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
    ? (factors.b2b_standard_price_breakdown as { label?: string; amount?: number }[])
    : [];
  const verticalName = (factors.b2b_vertical_name as string) || "";
  const usingPartnerRates = factors.b2b_using_partner_rates === true;
  const standardPreTax = factors.b2b_standard_price_pre_tax as number | undefined;
  const partnerDiscountPct = factors.b2b_partner_discount_percent as number | undefined;
  const engineSub = factors.b2b_engine_subtotal as number | undefined;
  const subOvr = factors.b2b_subtotal_override as number | null | undefined;
  const ovrReason =
    typeof factors.b2b_subtotal_override_reason === "string"
      ? factors.b2b_subtotal_override_reason.trim()
      : "";
  const fullOverrideApplied = factors.b2b_full_pre_tax_override_applied === true;

  return (
    <div className="rounded-xl border-2 border-[var(--brd)] bg-[var(--card)]/90 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[var(--gold)]">B2B One-Off</span>
        <span className="text-3xl font-black tabular-nums text-[var(--tx)]">{fmtPrice(t.price)}</span>
      </div>
      {dimensional && verticalName ? (
        <p className="text-[11px] font-semibold text-[var(--tx2)]">{verticalName}</p>
      ) : null}
      <div className="space-y-1.5 text-[11px]">
        {usingPartnerRates && dimensional && verticalName ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#66143D] pb-1">Partner Rate</p>
        ) : null}
        {dimensional && breakdown.length > 0 ? (
          breakdown.map((line, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className={PRICE_CARD.muted}>{line.label ?? "—"}</span>
              <span className={`font-medium shrink-0 ${PRICE_CARD.body}`}>{fmtPrice(Number(line.amount) || 0)}</span>
            </div>
          ))
        ) : (
          <>
            {baseFee !== undefined && distMod !== undefined && (
              <div className="flex justify-between">
                <span className={PRICE_CARD.muted}>
                  Base ${baseFee} × {distMod.toFixed(2)} (distance)
                </span>
                <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(Math.round(baseFee * distMod))}</span>
              </div>
            )}
            {accessSurcharge > 0 && (
              <div className="flex justify-between">
                <span className={PRICE_CARD.muted}>Access surcharge</span>
                <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(accessSurcharge)}</span>
              </div>
            )}
            {weightSurcharge > 0 && (
              <div className="flex justify-between">
                <span className={PRICE_CARD.muted}>Weight ({weightCategory ?? "-"})</span>
                <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(weightSurcharge)}</span>
              </div>
            )}
          </>
        )}
        {!dimensional &&
        typeof factors.truck_breakdown_line === "string" &&
        factors.truck_breakdown_line.trim().length > 0 ? (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Vehicle</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{factors.truck_breakdown_line.trim()}</span>
          </div>
        ) : null}
        {dimensional && accessSurcharge > 0 ? (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Access surcharge</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(accessSurcharge)}</span>
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
          <p className="font-semibold text-[var(--tx2)]">List pricing (same job)</p>
          {standardBreakdown.length > 0 ? (
            <div className="space-y-0.5">
              {standardBreakdown.map((line, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className={PRICE_CARD.muted}>{line.label ?? "—"}</span>
                  <span className={`font-medium shrink-0 ${PRICE_CARD.body}`}>{fmtPrice(Number(line.amount) || 0)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex justify-between gap-2 pt-1 border-t border-[var(--brd)]/40">
            <span className={PRICE_CARD.muted}>Subtotal (before HST)</span>
            <span className={`font-semibold ${PRICE_CARD.body}`}>{fmtPrice(standardPreTax)}</span>
          </div>
          {partnerDiscountPct != null && partnerDiscountPct > 0 ? (
            <p className="text-[var(--grn)] font-medium">
              Partner discount vs list: {partnerDiscountPct}%
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className={`font-bold ${PRICE_CARD.body}`}>Total: {fmtPrice(t.total)}</span>
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>Deposit to book</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
    </div>
  );
}

function BinRentalPriceDisplay({ price: t, factors }: { price: TierResult; factors: Record<string, unknown> }) {
  const lines = Array.isArray(factors.bin_line_items)
    ? (factors.bin_line_items as { key?: string; label?: string; amount?: number }[])
    : [];
  const bundleKey = factors.bin_bundle_type as string | undefined;
  const bundleSpec =
    bundleKey && bundleKey !== "custom"
      ? BIN_RENTAL_BUNDLE_SPECS[bundleKey as keyof typeof BIN_RENTAL_BUNDLE_SPECS]
      : null;
  const drop = factors.bin_drop_off_date as string | undefined;
  const pick = factors.bin_pickup_date as string | undefined;
  const move = factors.bin_move_date as string | undefined;
  const cycle = factors.bin_rental_cycle_days as number | undefined;
  const fmtShort = (d: string | undefined) =>
    d
      ? new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })
      : "—";
  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E]">Bin Rental</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.total)}</span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {lines.map((l, i) => (
          <div key={i}>
            <div className="flex justify-between gap-2">
              <span className={PRICE_CARD.muted}>{l.label}</span>
              <span className={`font-medium shrink-0 ${PRICE_CARD.body}`}>{fmtPrice(Number(l.amount) || 0)}</span>
            </div>
            {l.key === "bundle" && bundleSpec ? (
              <p className={`${PRICE_CARD.muted} pl-0 pt-0.5 text-[10px]`}>
                {bundleSpec.bins} bins + {bundleSpec.wardrobeBoxes} wardrobe boxes
              </p>
            ) : null}
          </div>
        ))}
        <div className={`flex justify-between pt-1 font-semibold ${PRICE_CARD.borderTop}`}>
          <span className={PRICE_CARD.muted}>Subtotal</span>
          <span className={PRICE_CARD.body}>{fmtPrice(t.price)}</span>
        </div>
      </div>
      <div className={`text-[11px] space-y-0.5 ${PRICE_CARD.muted}`}>
        <div className="flex justify-between">
          <span>HST ({(TAX_RATE * 100).toFixed(0)}%)</span>
          <span>{fmtPrice(t.tax)}</span>
        </div>
        <div className={`flex justify-between font-bold ${PRICE_CARD.body}`}>
          <span>Total</span>
          <span>{fmtPrice(t.total)}</span>
        </div>
      </div>
      <p className="text-[10px] text-[var(--tx3)]">Payment: Full at booking</p>
      <div className="text-[10px] space-y-0.5 pt-2 border-t border-[var(--brd)]/40">
        <p>
          <span className={PRICE_CARD.muted}>Delivery:</span> {fmtShort(drop)}
        </p>
        <p>
          <span className={PRICE_CARD.muted}>Move:</span> {fmtShort(move)}
        </p>
        <p>
          <span className={PRICE_CARD.muted}>Pickup:</span> {fmtShort(pick)}
        </p>
        {cycle != null && <p className="text-[var(--tx3)]">Rental cycle: {cycle} days</p>}
      </div>
    </div>
  );
}

function LabourOnlyPriceDisplay({ price: t, factors }: { price: TierResult; factors: Record<string, unknown> }) {
  const crewSize = factors.crew_size as number | undefined;
  const hours = factors.hours as number | undefined;
  const labourRate = factors.labour_rate as number | undefined;
  const truckFee = (factors.truck_fee as number | undefined) ?? 0;
  const accessSurcharge = (factors.access_surcharge as number | undefined) ?? 0;
  const visits = (factors.visits as number | undefined) ?? 1;
  const visit1Price = factors.visit1_price as number | undefined;
  const visit2Price = factors.visit2_price as number | undefined;
  const visit2Date = factors.visit2_date as string | undefined;
  const labourStorageFee = (factors.labour_storage_fee as number | undefined) ?? 0;
  const storageWeeks = typeof factors.labour_storage_weeks === "number" ? factors.labour_storage_weeks : null;
  const storageWeeklyRate = typeof factors.storage_weekly_rate === "number" ? factors.storage_weekly_rate : null;

  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E]">Labour Only</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {crewSize && hours && labourRate && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>
              {crewSize}-person crew × {hours}hr × ${labourRate}/hr
            </span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(crewSize * hours * labourRate)}</span>
          </div>
        )}
        {truckFee > 0 && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Truck</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(truckFee)}</span>
          </div>
        )}
        {accessSurcharge > 0 && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Access surcharge</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(accessSurcharge)}</span>
          </div>
        )}
        {labourStorageFee > 0 && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>
              Storage
              {storageWeeks != null && storageWeeklyRate != null
                ? ` (${storageWeeks} wk × ${fmtPrice(storageWeeklyRate)}/wk)`
                : null}
            </span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(labourStorageFee)}</span>
          </div>
        )}
        {visits >= 2 && visit2Price !== undefined && (
          <div className="flex justify-between">
            <span className={PRICE_CARD.muted}>Visit 2 ({visit2Date ?? "TBD"}), return discount</span>
            <span className={`font-medium ${PRICE_CARD.body}`}>{fmtPrice(visit2Price)}</span>
          </div>
        )}
        {visits >= 2 && visit1Price !== undefined && (
          <div className={`pt-1 flex justify-between font-semibold ${PRICE_CARD.borderTop}`}>
            <span className={PRICE_CARD.muted}>Subtotal</span>
            <span className={PRICE_CARD.body}>{fmtPrice(t.price)}</span>
          </div>
        )}
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className={`font-bold ${PRICE_CARD.body}`}>Total: {fmtPrice(t.total)}</span>
      </div>
      <div className={`flex items-center justify-between text-[11px] ${PRICE_CARD.muted}`}>
        <span>Deposit to book</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
    </div>
  );
}

function OptimisticTiers({ est, isLongDistance }: { est: { essential: number; signature: number; estate: number }; isLongDistance?: boolean }) {
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
          <div key={t.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
            <span className="text-[12px] font-semibold text-[var(--tx)]">{t.name}</span>
            <div className="text-right">
              <span className="text-[16px] font-black tabular-nums text-[var(--tx)]">{fmtPrice(t.price)}</span>
              <span className="text-[9px] text-[var(--tx3)] ml-1.5">+{fmtPrice(tax)} HST</span>
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
  const color = v < 1 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  return <span className={`font-semibold ${color}`}>×{v.toFixed(2)} ({pct > 0 ? "+" : ""}{pct}%)</span>;
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
  const baseRate      = typeof factors.base_rate === "number" ? factors.base_rate : null;
  const invMod        = typeof factors.inventory_modifier === "number" ? factors.inventory_modifier : null;
  const distMod       = typeof factors.distance_modifier === "number" ? factors.distance_modifier : null;
  const dateMult      = typeof factors.date_multiplier === "number" ? factors.date_multiplier : null;
  const neighMult     = typeof factors.neighbourhood_multiplier === "number" ? factors.neighbourhood_multiplier : null;
  const neighTier     = typeof factors.neighbourhood_tier === "string" ? factors.neighbourhood_tier : null;
  const accessSurch   = typeof factors.access_surcharge === "number" ? factors.access_surcharge : 0;
  const specialtySurch = typeof factors.specialty_surcharge === "number" ? factors.specialty_surcharge : 0;
  const labourDelta   = typeof factors.labour_delta === "number" ? factors.labour_delta : null;
  const labourMH      = typeof factors.labour_extra_man_hours === "number" ? factors.labour_extra_man_hours : null;
  const labourRate    = typeof factors.labour_rate_per_mover_hour === "number" ? factors.labour_rate_per_mover_hour : null;
  const deadheadSurch = typeof factors.deadhead_surcharge === "number" ? factors.deadhead_surcharge : 0;
  const deadheadKm    = typeof factors.deadhead_km === "number" ? factors.deadhead_km : 0;
  const packingSupplies = typeof factors.packing_supplies_included === "number" ? factors.packing_supplies_included : null;
  const subtotalPre   = typeof factors.subtotal_before_labour === "number" ? factors.subtotal_before_labour : null;
  const invScore      = typeof factors.inventory_score === "number" ? factors.inventory_score : null;
  const invBenchmark  = typeof factors.inventory_benchmark === "number" ? factors.inventory_benchmark : null;
  const cratingTotal  = typeof factors.crating_total === "number" ? factors.crating_total : 0;
  const parkingLc     = typeof factors.parking_long_carry_total === "number" ? factors.parking_long_carry_total : 0;
  const truckLine     =
    typeof factors.truck_breakdown_line === "string" && factors.truck_breakdown_line.trim().length > 0
      ? factors.truck_breakdown_line.trim()
      : null;
  const truckSurcharge =
    typeof factors.truck_surcharge === "number" ? factors.truck_surcharge : null;

  // Inventory label
  let invLabel = "standard";
  if (invMod !== null) {
    if (invMod < 0.80) invLabel = "light";
    else if (invMod > 1.20) invLabel = "heavy";
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

  const Row = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium text-[var(--tx2)]">{label}</span>
        {sub != null && sub !== "" && (
          <div className="mt-0.5 text-[10px] leading-snug text-[var(--tx3)]">{sub}</div>
        )}
      </div>
      <div className="text-[11px] text-right shrink-0 tabular-nums max-w-[55%] pt-0.5">{value}</div>
    </div>
  );

  const BreakdownCard = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)]/40 overflow-hidden divide-y divide-[var(--brd)]/80">
      {children}
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-semibold tracking-wide text-[var(--tx3)] mb-1.5">{children}</p>
  );

  return (
    <div className="space-y-3 text-[10px]">
      <div>
        <SectionTitle>Base &amp; multipliers</SectionTitle>
        <BreakdownCard>
          {distance != null && (
            <Row
              label="Route"
              value={<span className="font-medium text-[var(--tx)]">{distance} km</span>}
              sub={time != null ? `${time} min drive` : undefined}
            />
          )}
          {baseRate !== null && (
            <Row
              label={`Base rate${moveSize ? ` (${moveSize.replace("br", "BR").replace("_plus", "+")})` : ""}`}
              value={<span className="font-semibold text-[var(--tx)]">{fmtPrice(baseRate)}</span>}
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
          {distMod !== null && <Row label="Distance modifier" value={fmtMod(distMod)} sub={distLabel || undefined} />}
          {dateMult !== null && <Row label="Date factor" value={fmtMod(dateMult)} />}
          {neighMult !== null && (
            <Row label="Neighbourhood tier" value={fmtMod(neighMult)} sub={neighTier ?? undefined} />
          )}
          {subtotalPre !== null && (
            <div className="bg-[var(--gdim)]/40 border-t border-[var(--brd)]">
              <Row
                label="Subtotal (multiplied)"
                value={<span className="font-bold text-[var(--tx)]">{fmtPrice(subtotalPre)}</span>}
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
                <span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(accessSurch)}</span>
              ) : (
                <span className="text-[var(--tx3)]">$0</span>
              )
            }
            sub={accessSurch > 0 ? undefined : "No hard access"}
          />
          {specialtySurch > 0 && (
            <Row label="Specialty surcharge" value={<span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(specialtySurch)}</span>} />
          )}
          <Row
            label="Parking & long carry"
            value={
              parkingLc > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(parkingLc)}</span>
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
                  <span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(truckSurcharge)}</span>
                ) : (
                  <span className="text-[var(--tx3)]">$0</span>
                )
              }
              sub={
                <span className="inline-flex items-center gap-1.5">
                  <Truck size={12} weight="regular" className="shrink-0 opacity-70" aria-hidden />
                  {truckLine}
                </span>
              }
            />
          ) : null}
          <Row
            label="Labour delta"
            value={
              labourDelta != null && labourDelta > 0 ? (
                <span className="font-semibold text-[var(--gold)]">+{fmtPrice(labourDelta)}</span>
              ) : (
                <span className="text-[var(--tx3)]">
                  $0, below baseline
                  {labourDelta === 0 && labourMH != null ? ` (${labourMH} extra hr)` : ""}
                </span>
              )
            }
            sub={
              labourDelta != null && labourDelta > 0 && labourMH != null && labourRate != null
                ? `${labourMH} extra man-hours × $${labourRate}/hr`
                : undefined
            }
          />
          <Row
            label="Deadhead surcharge"
            value={
              deadheadSurch > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(deadheadSurch)}</span>
              ) : (
                <span className="text-[var(--tx3)]">$0</span>
              )
            }
            sub={deadheadKm > 0 && deadheadSurch <= 0 ? `${deadheadKm.toFixed(1)} km · within free zone` : undefined}
          />
          {cratingTotal > 0 && (
            <Row label="Custom crating" value={<span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(cratingTotal)}</span>} />
          )}
          {packingSupplies != null && packingSupplies > 0 && (
            <Row
              label="Packing supplies (Estate)"
              value={<span className="font-semibold text-[var(--gold)]">+{fmtPrice(packingSupplies)}</span>}
            />
          )}
        </BreakdownCard>
      </div>

      {essentialPrice != null && (
        <div>
          <SectionTitle>Tier prices</SectionTitle>
          <BreakdownCard>
            <Row label="Essential (×1.0)" value={<span className="font-bold text-[var(--gold)]">{fmtPrice(essentialPrice)}</span>} />
            {signaturePrice != null && (
              <Row label="Signature (×1.50)" value={<span className="font-bold text-[var(--gold)]">{fmtPrice(signaturePrice)}</span>} />
            )}
            {estatePrice != null && (
              <Row label="Estate (×3.15)" value={<span className="font-bold text-[var(--gold)]">{fmtPrice(estatePrice)}</span>} />
            )}
          </BreakdownCard>
        </div>
      )}
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
  // Use rich residential breakdown when the new formula fields are present (distance_modifier)
  const isNewResidential = typeof factors.distance_modifier === "number";
  const hasContent = Object.keys(factors).length > 0 || distance != null;
  if (!hasContent) return null;

  return (
    <details className="pt-3 border-t border-[var(--brd)] group" defaultValue={undefined}>
      <summary className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
        Price Breakdown
      </summary>
      <div className="mt-2">
        {isNewResidential ? (
          <PriceBreakdownResidential
            factors={factors}
            distance={distance}
            time={time}
            moveSize={moveSize}
            curatedPrice={tiers?.essential?.price ?? tiers?.curated?.price}
            signaturePrice={tiers?.signature?.price}
            estatePrice={tiers?.estate?.price}
          />
        ) : (
          <LegacyFactorsDisplay factors={factors} distance={distance} time={time} showMultipliers={showMultipliers} />
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
    "labour_delta", "labour_component", "labour_actual_crew", "labour_actual_hours",
    "labour_baseline_crew", "labour_baseline_hours", "labour_rate", "labour_rate_per_mover_hour", "labour_extra_man_hours",
    "packing_supplies_included", "distance_modifier", "inventory_modifier", "deadhead_km", "return_km",
    "subtotal_before_labour",
    "event_legs", "event_leg_distances", "includes",
    "event_distance_summary",
    "truck_breakdown_line", "truck_surcharge", "truck_recommended", "truck_type_selected",
  ]);
  const entries = Object.entries(factors).filter(
    ([key, v]) => !HIDDEN_KEYS.has(key) && v !== null && v !== undefined && v !== 0 && v !== 1
  );
  const labourDelta = typeof factors.labour_delta === "number" ? factors.labour_delta
    : typeof factors.labour_component === "number" ? factors.labour_component : null;
  const labourExtraManHours = typeof factors.labour_extra_man_hours === "number" ? factors.labour_extra_man_hours : null;
  const labourRate = typeof factors.labour_rate_per_mover_hour === "number" ? factors.labour_rate_per_mover_hour : null;

  const eventDist =
    typeof factors.event_distance_summary === "string" && (factors.event_distance_summary as string).trim().length > 0
      ? (factors.event_distance_summary as string)
      : null;

  const truckBreakdownLine =
    typeof factors.truck_breakdown_line === "string" && factors.truck_breakdown_line.trim().length > 0
      ? factors.truck_breakdown_line.trim()
      : null;

  return (
    <div className="space-y-1.5">
      {truckBreakdownLine ? (
        <div className="text-[10px] text-[var(--tx)] font-medium">{truckBreakdownLine}</div>
      ) : null}
      {eventDist ? (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">Distance</span>
          <span className="text-[var(--tx)] font-medium">{eventDist}</span>
        </div>
      ) : distance != null ? (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">Distance</span>
          <span className="text-[var(--tx)] font-medium">{distance} km ({time ?? "-"} min)</span>
        </div>
      ) : null}
      {labourDelta !== null && (
        <div className="flex flex-col gap-0.5 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--tx3)]">Labour adjustment</span>
            <span className={labourDelta > 0 ? "font-semibold text-[var(--gold)]" : "text-[var(--tx3)]"}>
              {labourDelta > 0 ? `+${fmtPrice(labourDelta)}` : "$0"}
            </span>
          </div>
          {labourDelta > 0 && labourExtraManHours != null && labourRate != null && (
            <p className="text-[9px] text-[var(--gold)]/90">({labourExtraManHours} extra man-hours × ${labourRate})</p>
          )}
          {labourDelta === 0 && <p className="text-[9px] text-[var(--tx3)]">(within baseline)</p>}
        </div>
      )}
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">{toTitleCase(key)}</span>
          <span className="text-[var(--tx)] font-medium">
            {showMultipliers
              ? typeof val === "number" ? val >= 10 ? fmtPrice(val) : `×${val}` : String(val)
              : typeof val === "number" && val < 10 ? "Applied" : typeof val === "number" ? fmtPrice(val) : String(val)}
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
  const dateStr = exp.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  if (daysLeft <= 0) return <span className="text-[var(--red)] font-semibold">Expired</span>;
  if (daysLeft <= 2) return <span className="text-[var(--red)] font-semibold">Expires {dateStr}</span>;
  return <span className="text-[var(--tx)]">Expires in {daysLeft} days</span>;
}
