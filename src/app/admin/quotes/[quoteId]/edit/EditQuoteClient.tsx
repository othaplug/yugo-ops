"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowsClockwise as RefreshCw,
  CheckCircle,
} from "@phosphor-icons/react";
import InventoryInput, {
  type InventoryItemEntry,
} from "@/components/inventory/InventoryInput";
import { inferWeightTierFromLegacyScore } from "@/lib/pricing/weight-tiers";
import MultiStopAddressField, {
  type StopEntry,
} from "@/components/ui/MultiStopAddressField";
import {
  getVisibleAddons,
  ESTATE_ADDON_UI_LINES,
} from "@/lib/quotes/addon-visibility";
import { quoteFormServiceDateLabel } from "@/lib/quotes/quote-field-labels";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import TierPriceOverrideEditor, {
  type TierPriceOverrideMap,
} from "@/app/admin/quotes/new/TierPriceOverrideEditor";
import EditSection from "./EditSection";
import EditQuoteLivePreview from "./EditQuoteLivePreview";
import EditQuoteHeader from "./EditQuoteHeader";
import EditQuoteCurrentSummary from "./EditQuoteCurrentSummary";
import EditQuoteResultPanel from "./EditQuoteResultPanel";
import EditQuoteReasonField from "./EditQuoteReasonField";
import {
  QUOTE_UPDATE_REASONS,
  buildReasonText,
  type QuoteUpdateReasonValue,
} from "./quote-update-reasons";
import {
  PRICE_OVERRIDE_REASONS,
  buildPriceOverrideReasonText,
} from "@/lib/quotes/price-override-reasons";

// Local mirror of QuoteFormClient's PARKING_OPTIONS. Kept inline rather
// than exported so the create form remains the source of truth — if the
// option set grows there, this list needs the same update.
const PARKING_OPTIONS = [
  { value: "dedicated", label: "Dedicated / loading dock" },
  { value: "street", label: "Street parking" },
  { value: "no_dedicated", label: "No dedicated parking (+$75)" },
] as const;

type ParkingOption = (typeof PARKING_OPTIONS)[number]["value"];

function coerceParking(raw: unknown): ParkingOption {
  const s = String(raw ?? "").trim().toLowerCase();
  return PARKING_OPTIONS.some((o) => o.value === s)
    ? (s as ParkingOption)
    : "dedicated";
}

const RECOMMENDED_TIER_OPTIONS = [
  { value: "essential", label: "Essential" },
  { value: "signature", label: "Signature" },
  { value: "estate", label: "Estate" },
] as const;
import type {
  WhiteGloveAssembly,
  WhiteGloveItemCategory,
  WhiteGloveWeightClass,
} from "@/lib/quotes/white-glove-pricing";
import {
  normalizeWhiteGloveItemsFromQuoteInput,
  WG_ASSEMBLY_OPTIONS,
  WG_ITEM_CATEGORIES,
  WG_WEIGHT_CLASS_OPTIONS,
} from "@/lib/quotes/white-glove-pricing";
import {
  WhiteGloveItemsEditor,
  createDefaultWhiteGloveItem,
  type WhiteGloveItemRow,
} from "@/components/admin/WhiteGloveItemsEditor";

/* eslint-disable @typescript-eslint/no-explicit-any */

const WG_BUILDING_REQUIREMENT_OPTIONS = [
  { value: "elevator_booking", label: "Elevator booking required" },
  { value: "insurance_certificate", label: "Insurance certificate required" },
  { value: "restricted_hours", label: "Restricted move hours" },
  { value: "loading_dock_booking", label: "Loading dock booking required" },
] as const;

const WG_CAT_SET = new Set<string>(WG_ITEM_CATEGORIES.map((c) => c.value));
const WG_WC_SET = new Set<string>(WG_WEIGHT_CLASS_OPTIONS.map((w) => w.value));
const WG_ASM_SET = new Set<string>(WG_ASSEMBLY_OPTIONS.map((a) => a.value));

function newWhiteGloveRowId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function coerceWhiteGloveRow(raw: {
  description?: string;
  quantity?: number;
  category?: string;
  weight_class?: string;
  assembly?: string;
  is_fragile?: boolean;
  is_high_value?: boolean;
  notes?: string;
  slug?: string;
  is_custom?: boolean;
}): WhiteGloveItemRow {
  const cat = (raw.category || "medium").toLowerCase();
  const wc = (raw.weight_class || "50_150").toLowerCase();
  const asm = (raw.assembly || "none").toLowerCase();
  const slugStr =
    typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim() : undefined;
  return {
    id: newWhiteGloveRowId(),
    description: String(raw.description ?? "").trim(),
    quantity: Math.max(1, Math.min(99, Number(raw.quantity) || 1)),
    category: (WG_CAT_SET.has(cat) ? cat : "medium") as WhiteGloveItemCategory,
    weight_class: (WG_WC_SET.has(wc) ? wc : "50_150") as WhiteGloveWeightClass,
    assembly: (WG_ASM_SET.has(asm) ? asm : "none") as WhiteGloveAssembly,
    is_fragile: Boolean(raw.is_fragile),
    is_high_value: Boolean(raw.is_high_value),
    notes: String(raw.notes ?? ""),
    slug: slugStr,
    is_custom:
      raw.is_custom === true || (!slugStr && Boolean(String(raw.description ?? "").trim())),
  };
}

function initialWhiteGloveRowsFromQuote(
  factors: Record<string, any>,
  oq: any,
): WhiteGloveItemRow[] {
  if (oq.service_type !== "white_glove") return [];
  const dv =
    typeof factors.declared_value === "number"
      ? factors.declared_value
      : typeof oq.declared_value === "number"
        ? oq.declared_value
        : null;
  const normalized = normalizeWhiteGloveItemsFromQuoteInput({
    white_glove_items: factors.white_glove_items,
    item_description: factors.item_description ?? oq.item_description,
    item_category: factors.item_category ?? oq.item_category,
    item_weight_class: factors.item_weight_class ?? oq.item_weight_class,
    assembly_needed: factors.assembly_needed ?? oq.assembly_needed,
    number_of_items: factors.number_of_items ?? oq.number_of_items ?? null,
    declared_value: dv,
  });
  if (normalized.length === 0) return [createDefaultWhiteGloveItem()];
  return normalized.map(coerceWhiteGloveRow);
}

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

interface EditQuoteClientProps {
  originalQuote: any;
  addons: Addon[];
  config: Record<string, string>;
  itemWeights: ItemWeight[];
}

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
] as const;

/** Deterministic JSON for comparing pricing payloads (addon order, inventory order, etc.). */
function stableStringify(val: unknown): string {
  if (val === null || typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(stableStringify).join(",")}]`;
  const o = val as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

function stableEditQuotePayloadFingerprint(
  payload: Record<string, any>,
): string {
  const p = JSON.parse(JSON.stringify(payload)) as Record<string, any>;
  if (Array.isArray(p.selected_addons)) {
    p.selected_addons = [...p.selected_addons].sort((a, b) =>
      String(a.addon_id).localeCompare(String(b.addon_id)),
    );
  }
  if (Array.isArray(p.inventory_items)) {
    p.inventory_items = [...p.inventory_items]
      .map((i: any) => ({
        slug: i.slug ?? null,
        name: String(i.name ?? ""),
        quantity: Number(i.quantity) || 0,
        weight_score: Number(i.weight_score) || 0,
      }))
      .sort((a, b) =>
        `${a.slug ?? ""}\0${a.name}\0${a.quantity}`.localeCompare(
          `${b.slug ?? ""}\0${b.name}\0${b.quantity}`,
        ),
      );
  }
  if (Array.isArray(p.white_glove_items)) {
    p.white_glove_items = [...p.white_glove_items]
      .map((r: any) => ({
        description: String(r.description ?? "").trim(),
        quantity: Math.max(1, Math.min(99, Number(r.quantity) || 1)),
        assembly: String(r.assembly ?? ""),
        category: String(r.category ?? ""),
        weight_class: String(r.weight_class ?? ""),
        is_fragile: Boolean(r.is_fragile),
        is_high_value: Boolean(r.is_high_value),
        notes: String(r.notes ?? "").trim(),
      }))
      .sort((a, b) => a.description.localeCompare(b.description));
  }
  if (Array.isArray(p.specialty_building_requirements)) {
    p.specialty_building_requirements = [
      ...p.specialty_building_requirements,
    ]
      .map((x: any) => String(x).trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }
  if (typeof p.white_glove_building_requirements_note === "string") {
    p.white_glove_building_requirements_note = p.white_glove_building_requirements_note.trim();
  }
  if (typeof p.white_glove_delivery_instructions === "string") {
    p.white_glove_delivery_instructions =
      p.white_glove_delivery_instructions.trim();
  }
  if (Array.isArray(p.specialty_items)) {
    p.specialty_items = [...p.specialty_items]
      .map((s: any) => ({ type: String(s.type), qty: Number(s.qty) || 0 }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.qty - b.qty);
  }
  if (Array.isArray(p.additional_pickup_addresses)) {
    p.additional_pickup_addresses = [...p.additional_pickup_addresses]
      .map((x: any) =>
        String(x.address ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean)
      .sort();
  }
  if (Array.isArray(p.additional_dropoff_addresses)) {
    p.additional_dropoff_addresses = [...p.additional_dropoff_addresses]
      .map((x: any) =>
        String(x.address ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean)
      .sort();
  }
  return stableStringify(p);
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold text-[var(--tx3)] tracking-widest uppercase border-t border-[var(--brd)] pt-4 mt-1">
      {label}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </div>
      <span className="text-[13px] text-[var(--tx)]">{label}</span>
    </label>
  );
}

export default function EditQuoteClient({
  originalQuote,
  addons: allAddons,
  config: _config,
  itemWeights,
}: EditQuoteClientProps) {
  const router = useRouter();
  const oq = originalQuote;
  const contact = Array.isArray(oq.contacts) ? oq.contacts[0] : oq.contacts;
  const [serviceType] = useState<string>(oq.service_type);
  /** B2B quotes use dimensional pricing on the quote detail page — this screen only supports move-style re-quotes. */
  const isB2bQuote = serviceType === "b2b_delivery";
  const factors = (oq.factors_applied ?? {}) as Record<string, any>;

  // ── Core fields ──────────────────────────────────────────
  const [fromAddress, setFromAddress] = useState(oq.from_address || "");
  const [extraFromStops, setExtraFromStops] = useState<StopEntry[]>([]);
  const [toAddress, setToAddress] = useState(oq.to_address || "");
  const [extraToStops, setExtraToStops] = useState<StopEntry[]>([]);
  const [fromAccess, setFromAccess] = useState(oq.from_access || "");
  const [toAccess, setToAccess] = useState(oq.to_access || "");
  const [moveDate, setMoveDate] = useState(oq.move_date || "");
  const [moveSize, setMoveSize] = useState(oq.move_size || "");
  // Reason for update: dropdown (`reasonValue`) + free-text (`reasonFreeText`)
  // used only when the dropdown is "other". The legacy single-line `reason`
  // is derived via buildReasonText() and required only at send-time.
  const [reasonValue, setReasonValue] = useState<QuoteUpdateReasonValue | "">(
    "",
  );
  const [reasonFreeText, setReasonFreeText] = useState("");
  const reason = buildReasonText(reasonValue, reasonFreeText);

  // ── Scheduling / building access pre-fill ────────────────
  // All of these are persisted as top-level columns on `quotes` (verified
  // against YG-30277: preferred_time="09:30", arrival_window="Morning
  // (8:00 AM–10:00 AM)", from_parking="dedicated", etc.) but the edit
  // form used to leave them blank on load — so the operator would
  // re-generate the quote and silently lose every one of those choices.
  // State + UI + buildPayload now mirror the create form so re-quote is
  // a true round-trip.
  const [preferredTime, setPreferredTime] = useState<string>(
    typeof oq.preferred_time === "string" ? oq.preferred_time : "",
  );
  const [arrivalWindow, setArrivalWindow] = useState<string>(() => {
    const raw = typeof oq.arrival_window === "string" ? oq.arrival_window.trim() : "";
    if (raw) return raw;
    return TIME_WINDOW_OPTIONS[1] ?? TIME_WINDOW_OPTIONS[0] ?? "";
  });
  const [fromParking, setFromParking] = useState<ParkingOption>(() =>
    coerceParking(oq.from_parking),
  );
  const [toParking, setToParking] = useState<ParkingOption>(() =>
    coerceParking(oq.to_parking),
  );
  const [fromLongCarry, setFromLongCarry] = useState<boolean>(
    Boolean(oq.from_long_carry),
  );
  const [toLongCarry, setToLongCarry] = useState<boolean>(
    Boolean(oq.to_long_carry),
  );
  const [recommendedTier, setRecommendedTier] = useState<string>(() => {
    const r = String(oq.recommended_tier ?? "signature").toLowerCase().trim();
    return r === "essential" || r === "signature" || r === "estate"
      ? r
      : "signature";
  });
  // assembly_override is tri-state: true = forced on, false = forced off,
  // null = auto-detect from inventory. Persist null when the column is
  // null so the engine falls back to its own detection on re-generate.
  const [assemblyOverride, setAssemblyOverride] = useState<boolean | null>(
    () => {
      const v = oq.assembly_override;
      return typeof v === "boolean" ? v : null;
    },
  );

  // ── Operator overrides for crew / hours / truck ──────────
  // Engine auto-picks these from inventory score + access; coordinator
  // can pin them when the auto-pick is wrong (e.g. walk-up-3rd was
  // bumping a light 1BR from crew 2 → 3 on YG-30277). Empty string =
  // no override; engine auto-picks. Pre-fill from the prior overrides
  // stored in factors_applied.operator_overrides so re-quote is a
  // true round-trip.
  const priorOverrides =
    (factors.operator_overrides as
      | {
          crew?: { from: number; to: number };
          hours?: { from: number; to: number };
          truck?: { from: string; to: string };
        }
      | undefined) ?? undefined;
  const [crewOverride, setCrewOverride] = useState<string>(
    priorOverrides?.crew ? String(priorOverrides.crew.to) : "",
  );
  const [hoursOverride, setHoursOverride] = useState<string>(
    priorOverrides?.hours ? String(priorOverrides.hours.to) : "",
  );
  const [truckOverride, setTruckOverride] = useState<string>(
    priorOverrides?.truck ? priorOverrides.truck.to : "",
  );

  // ── Labour-only fields ────────────────────────────────────
  // Hydrated from factors_applied so editing a labour-only quote is a
  // true round-trip — was missing entirely before, which meant the
  // operator could only edit address/access/date and lost every other
  // labour scope decision on regenerate. Mirrors the create form
  // (QuoteFormClient line 10302+).
  const [labourJobCategory, setLabourJobCategory] = useState<string>(
    typeof factors.labour_job_category === "string"
      ? factors.labour_job_category
      : "",
  );
  const [labourDescription, setLabourDescription] = useState<string>(
    typeof factors.labour_description === "string"
      ? factors.labour_description
      : "",
  );
  const [labourComplexity, setLabourComplexity] = useState<
    "standard" | "moderate" | "complex"
  >(() => {
    const v = factors.labour_complexity;
    return v === "moderate" || v === "complex" ? v : "standard";
  });
  const [labourWeightClass, setLabourWeightClass] = useState<
    "standard" | "heavy" | "very_heavy"
  >(() => {
    const v = factors.labour_weight_class;
    return v === "heavy" || v === "very_heavy" ? v : "standard";
  });
  const [labourCrewSize, setLabourCrewSize] = useState<number>(() => {
    const v = factors.labour_crew_size;
    return typeof v === "number" && v >= 1 && v <= 5 ? v : 2;
  });
  const [labourHours, setLabourHours] = useState<number>(() => {
    const v = factors.labour_hours;
    return typeof v === "number" && v >= 1 && v <= 8 ? v : 3;
  });
  const [labourTruckRequired, setLabourTruckRequired] = useState<boolean>(
    factors.labour_truck_required === true,
  );
  const [labourVisits, setLabourVisits] = useState<number>(
    factors.labour_visits === 2 ? 2 : 1,
  );
  const [labourWeekend, setLabourWeekend] = useState<boolean>(
    factors.labour_weekend === true,
  );
  const [labourAfterHours, setLabourAfterHours] = useState<boolean>(
    factors.labour_after_hours === true,
  );
  const [labourSecondVisitDate, setLabourSecondVisitDate] = useState<string>(
    typeof factors.labour_second_visit_date === "string"
      ? factors.labour_second_visit_date
      : "",
  );
  const [labourStorageNeeded, setLabourStorageNeeded] = useState<boolean>(
    factors.labour_storage_needed === true,
  );
  const [labourStorageWeeks, setLabourStorageWeeks] = useState<number>(() => {
    const v = factors.labour_storage_weeks;
    return typeof v === "number" && v >= 1 && v <= 52 ? v : 1;
  });

  // ── Per-tier price override ──────────────────────────────
  // Operators set absolute prices for one or more tiers (e.g. match a
  // competitor on Estate without dropping Essential/Signature). Pre-
  // fill from quotes.tier_price_overrides so re-quote round-trips the
  // setting instead of forcing the operator to re-enter it. Same
  // editor component used in the create form so the UX matches.
  const [tierPriceOverrides, setTierPriceOverrides] =
    useState<TierPriceOverrideMap>(() => {
      const raw = oq.tier_price_overrides as
        | Partial<
            Record<
              "essential" | "signature" | "estate",
              { price?: number | string; reason?: string }
            >
          >
        | null
        | undefined;
      if (!raw || typeof raw !== "object") return {};
      const out: TierPriceOverrideMap = {};
      for (const tk of ["essential", "signature", "estate"] as const) {
        const e = raw[tk];
        if (!e) continue;
        const p =
          typeof e.price === "number"
            ? String(e.price)
            : typeof e.price === "string"
              ? e.price
              : "";
        const r = typeof e.reason === "string" ? e.reason : "";
        if (!p) continue;
        out[tk] = { price: p, reason: r };
      }
      return out;
    });

  // ── Coordinator global pre-tax price override ─────────────
  // Single-number override that scales all tiers proportionally
  // (distinct from the per-tier override above). Stored on quotes as
  // override_price_pre_tax + override_reason. Pre-fill so editing the
  // quote keeps the operator's earlier override intact unless they
  // explicitly clear it.
  const [quotePreTaxOverride, setQuotePreTaxOverride] = useState<string>(
    typeof oq.override_price_pre_tax === "number" &&
      oq.override_price_pre_tax > 0
      ? String(oq.override_price_pre_tax)
      : "",
  );
  const [quotePreTaxOverrideReason, setQuotePreTaxOverrideReason] =
    useState<string>(
      typeof oq.override_reason === "string" ? oq.override_reason : "",
    );

  // ── Office move fields ────────────────────────────────────
  const [squareFootage, setSquareFootage] = useState(
    String(factors.square_footage || oq.square_footage || ""),
  );
  const [workstationCount, setWorkstationCount] = useState(
    String(factors.workstation_count || oq.workstation_count || ""),
  );
  const [hasItEquipment, setHasItEquipment] = useState(
    Boolean(factors.has_it_equipment || oq.has_it_equipment),
  );
  const [hasConferenceRoom, setHasConferenceRoom] = useState(
    Boolean(factors.has_conference_room || oq.has_conference_room),
  );
  const [hasReceptionArea, setHasReceptionArea] = useState(
    Boolean(factors.has_reception_area || oq.has_reception_area),
  );
  const [timingPreference, setTimingPreference] = useState(
    factors.timing_preference || oq.timing_preference || "",
  );

  // ── Single item / White glove fields ─────────────────────
  const [itemDescription, setItemDescription] = useState(
    factors.item_description || oq.item_description || "",
  );
  const [itemCategory, setItemCategory] = useState(
    factors.item_category || oq.item_category || "",
  );
  const [itemWeightClass, setItemWeightClass] = useState(
    factors.item_weight_class || oq.item_weight_class || "",
  );
  const [assemblyNeeded, setAssemblyNeeded] = useState(
    factors.assembly_needed || oq.assembly_needed || "",
  );
  const [stairCarry, setStairCarry] = useState(
    Boolean(factors.stair_carry || oq.stair_carry),
  );
  const [stairFlights, setStairFlights] = useState(
    String(factors.stair_flights || oq.stair_flights || "1"),
  );
  const [declaredValue, setDeclaredValue] = useState(
    String(factors.declared_value || oq.declared_value || ""),
  );

  const gwHoursRaw = factors.white_glove_guaranteed_window_hours;
  const [whiteGloveItemRows, setWhiteGloveItemRows] = useState<
    WhiteGloveItemRow[]
  >(() => initialWhiteGloveRowsFromQuote(factors, oq));
  const [wgGuaranteedWindow, setWgGuaranteedWindow] = useState(
    () =>
      oq.service_type === "white_glove" &&
      typeof gwHoursRaw === "number" &&
      gwHoursRaw > 0,
  );
  const [wgGuaranteedWindowHours, setWgGuaranteedWindowHours] = useState<
    2 | 3 | 4
  >(() => {
    if (
      typeof gwHoursRaw === "number" &&
      gwHoursRaw >= 2 &&
      gwHoursRaw <= 4
    ) {
      return gwHoursRaw as 2 | 3 | 4;
    }
    return 2;
  });
  const [wgDebrisRemoval, setWgDebrisRemoval] = useState(
    () =>
      oq.service_type === "white_glove" &&
      factors.white_glove_debris_removal === true,
  );
  const [wgBuildingReqs, setWgBuildingReqs] = useState<string[]>(() => {
    const br = factors.specialty_building_requirements;
    if (oq.service_type !== "white_glove" || !Array.isArray(br)) return [];
    return br.map(String).filter(Boolean);
  });
  const [wgBuildingNote, setWgBuildingNote] = useState(() =>
    oq.service_type === "white_glove"
      ? String(factors.white_glove_building_requirements_note ?? "")
      : "",
  );
  const [wgDeliveryInstructions, setWgDeliveryInstructions] = useState(() =>
    oq.service_type === "white_glove"
      ? String(factors.white_glove_delivery_instructions ?? "")
      : "",
  );

  // ── Specialty service fields ──────────────────────────────
  const [projectType, setProjectType] = useState(
    factors.project_type || oq.project_type || "",
  );
  const [timelineHours, setTimelineHours] = useState(
    String(factors.timeline_hours || oq.timeline_hours || "4"),
  );
  const [customCratingPieces, setCustomCratingPieces] = useState(
    String(factors.custom_crating_pieces || oq.custom_crating_pieces || "0"),
  );
  const [climateControl, setClimateControl] = useState(
    Boolean(factors.climate_control || oq.climate_control),
  );

  // ── Specialty items ───────────────────────────────────────
  const [specialtyItems, setSpecialtyItems] = useState<
    { type: string; qty: number }[]
  >(() => {
    const saved = oq.specialty_items;
    if (Array.isArray(saved) && saved.length > 0) return saved;
    // Also check factors
    const fromFactors = factors.specialty_items;
    if (Array.isArray(fromFactors) && fromFactors.length > 0)
      return fromFactors;
    return [];
  });

  // ── Inventory ─────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>(
    () => {
      const saved = oq.inventory_items;
      if (!Array.isArray(saved) || saved.length === 0) return [];
      return saved.map((item: any) => {
        const iw = itemWeights.find((w) => w.slug === item.slug);
        const name = item.name || iw?.item_name || item.slug || "";
        const slug = item.slug || undefined;
        // Prefer the catalog's authoritative weight_score over whatever
        // was persisted on the line — older quote rows (e.g. YG-30277)
        // carry stale scores from before catalog re-categorisation
        // (the freezer-standalone case: catalog says score 2.5 / heavy
        // tier; the saved line had score 2.5 but tier_code "standard").
        const catalogScore = iw?.weight_score;
        const ws =
          typeof catalogScore === "number" && catalogScore > 0
            ? catalogScore
            : (item.weight_score ?? 1);
        // Re-derive the tier from the (now-authoritative) score. If the
        // saved tier_code disagrees with what the score implies AND the
        // item is from the catalog (has a slug), trust the catalog — the
        // operator can still manually downgrade in the UI if they want.
        // Custom items (no slug) keep their saved tier as-is.
        const savedTier =
          typeof item.weight_tier_code === "string" && item.weight_tier_code
            ? item.weight_tier_code
            : null;
        const inferredTier = inferWeightTierFromLegacyScore(Number(ws));
        const weight_tier_code = slug ? inferredTier : (savedTier ?? inferredTier);
        return {
          slug,
          name,
          quantity: item.quantity || 1,
          weight_score: ws,
          weight_tier_code,
          actual_weight_lbs:
            typeof item.actual_weight_lbs === "number" &&
            item.actual_weight_lbs > 0
              ? item.actual_weight_lbs
              : undefined,
          isCustom: !slug && !!name,
        };
      });
    },
  );

  // ── Box count ─────────────────────────────────────────────
  const [clientBoxCount, setClientBoxCount] = useState(
    String(oq.client_box_count || factors.client_box_count || ""),
  );

  // ── Addons ────────────────────────────────────────────────
  const [selectedAddons, setSelectedAddons] = useState<
    Map<string, AddonSelection>
  >(() => {
    const map = new Map<string, AddonSelection>();
    // oq.selected_addons is the breakdown array [{addon_id, slug, name, price, quantity, subtotal}]
    const saved: any[] = Array.isArray(oq.selected_addons)
      ? oq.selected_addons
      : [];
    for (const item of saved) {
      if (!item.addon_id) continue;
      map.set(item.addon_id, {
        addon_id: item.addon_id,
        slug: item.slug || "",
        quantity: item.quantity || 1,
        tier_index: item.tier_index ?? 0,
      });
    }
    return map;
  });
  const [showAllAddons, setShowAllAddons] = useState(false);

  // ── Flow state ────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [newQuoteResult, setNewQuoteResult] = useState<any>(null);
  const [newQuoteId, setNewQuoteId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Live preview ──────────────────────────────────────────
  const [livePreview, setLivePreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [jobStopsLoaded, setJobStopsLoaded] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Fingerprint of pricing inputs after job-stops hydrate — preview/regenerate only when this diverges. */
  const baselineFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (!oq.quote_id) {
      setJobStopsLoaded(true);
      return;
    }
    let cancelled = false;
    setJobStopsLoaded(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/job-stops?job_type=quote&job_id=${encodeURIComponent(oq.quote_id)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const rows = (data.stops ?? []) as {
          stop_type?: string;
          address?: string;
          lat?: number | null;
          lng?: number | null;
        }[];
        const pickups: StopEntry[] = [];
        const dropoffs: StopEntry[] = [];
        for (const r of rows) {
          const entry: StopEntry = {
            address: (r.address || "").trim(),
            lat: r.lat ?? null,
            lng: r.lng ?? null,
          };
          if (!entry.address) continue;
          if (r.stop_type === "pickup") pickups.push(entry);
          else if (r.stop_type === "dropoff") dropoffs.push(entry);
        }
        if (cancelled) return;
        setExtraFromStops(pickups);
        setExtraToStops(dropoffs);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setJobStopsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oq.quote_id]);

  // Resolve previous quote price: essential (current) or curated/essentials (legacy) tier, or custom_price for non-tiered
  const oldPrice =
    oq.tiers?.essential?.price ??
    oq.tiers?.curated?.price ??
    oq.tiers?.essentials?.price ??
    (typeof oq.custom_price === "number" ? oq.custom_price : null) ??
    0;

  const tierForAddons = useMemo(() => {
    // Read from live state (recommendedTier) instead of the stale
    // originalQuote value, so toggling the tier selector immediately
    // updates which add-ons are visible (Estate hides packing/unpacking
    // because they're rolled into the tier).
    const r = recommendedTier.toLowerCase().trim();
    return r === "essential" || r === "signature" || r === "estate"
      ? r
      : "signature";
  }, [recommendedTier]);

  // ── Addon helpers ─────────────────────────────────────────
  const applicableAddons = useMemo(() => {
    const base = allAddons.filter(
      (a) =>
        !a.applicable_service_types?.length ||
        a.applicable_service_types.includes(serviceType),
    );
    if (serviceType === "local_move" || serviceType === "long_distance") {
      return getVisibleAddons(base, tierForAddons);
    }
    return base;
  }, [allAddons, serviceType, tierForAddons]);
  const popularAddons = useMemo(
    () => applicableAddons.filter((a) => a.is_popular),
    [applicableAddons],
  );
  const otherAddons = useMemo(
    () => applicableAddons.filter((a) => !a.is_popular),
    [applicableAddons],
  );

  function toggleAddon(addon: Addon) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      if (next.has(addon.id)) {
        next.delete(addon.id);
        return next;
      }
      next.set(addon.id, {
        addon_id: addon.id,
        slug: addon.slug,
        quantity: 1,
        tier_index: 0,
      });
      return next;
    });
  }

  function updateAddonQty(addonId: string, qty: number) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const sel = next.get(addonId);
      if (sel) next.set(addonId, { ...sel, quantity: Math.max(1, qty) });
      return next;
    });
  }

  function updateAddonTier(addonId: string, tierIndex: number) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const sel = next.get(addonId);
      if (sel) next.set(addonId, { ...sel, tier_index: tierIndex });
      return next;
    });
  }

  function fmtPrice(n: number) {
    return n.toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  // ── Build request payload from current state ──────────────
  const buildPayload = useCallback((): Record<string, any> => {
    const payload: Record<string, any> = {
      quote_id: oq.quote_id,
      service_type: serviceType,
      from_address: fromAddress,
      to_address: toAddress,
      from_access: fromAccess || undefined,
      to_access: toAccess || undefined,
      move_date: moveDate || undefined,
      contact_id: contact?.id || oq.contact_id,
      hubspot_deal_id: oq.hubspot_deal_id || undefined,
      selected_addons: Array.from(selectedAddons.values()),
      // Scheduling / building-access fields prefilled from the original
      // quote — pass them on every regenerate so the engine doesn't drop
      // them when it recomputes prices.
      preferred_time: preferredTime || undefined,
      arrival_window: arrivalWindow || undefined,
      from_parking: fromParking,
      to_parking: toParking,
      from_long_carry: fromLongCarry,
      to_long_carry: toLongCarry,
      recommended_tier: recommendedTier,
    };
    // assembly_override is tri-state. Only send explicit booleans; null
    // tells the engine to auto-detect from inventory.
    if (assemblyOverride !== null) {
      payload.assembly_override = assemblyOverride;
    }
    // Operator overrides — pin crew / hours / truck when coordinator
    // sees the engine's auto-estimate is wrong. Empty string = auto.
    const crewN = parseInt(crewOverride, 10);
    if (Number.isFinite(crewN) && crewN >= 1 && crewN <= 8) {
      payload.crew_size_override = crewN;
    }
    const hoursN = parseFloat(hoursOverride);
    if (Number.isFinite(hoursN) && hoursN >= 1 && hoursN <= 24) {
      payload.est_hours_override = hoursN;
    }
    if (truckOverride.trim()) {
      payload.truck_size_override = truckOverride.trim();
    }
    // Per-tier price override — read from LIVE editor state (previously
    // this was a stale carry-forward of oq.tier_price_overrides, which
    // meant the operator could open the form but couldn't actually
    // change the override). Same sanitisation as the create form:
    // positive price + reason >= 3 chars or the entry is dropped.
    if (
      serviceType === "local_move" ||
      serviceType === "long_distance" ||
      serviceType === "office_move"
    ) {
      // Office added 2026-06-30: the edit form's per-tier override
      // editor is now mounted for office too, so the payload must
      // ship the office tier keys. Without this fix the operator
      // could type an override on Priority but the payload-build
      // skipped office and the server never saw it -- same root
      // cause that bit the new-quote form yesterday.
      const tierKeys: readonly ("essential" | "signature" | "estate" | "priority")[] =
        serviceType === "office_move"
          ? ["essential", "signature", "priority"]
          : ["essential", "signature", "estate"];
      const cleanedOverrides: Record<
        string,
        { price: number; reason: string }
      > = {};
      for (const tk of tierKeys) {
        const entry = tierPriceOverrides[tk];
        if (!entry) continue;
        const p = parseFloat(entry.price);
        const r = entry.reason.trim();
        if (!Number.isFinite(p) || p <= 0 || r.length < 3) continue;
        cleanedOverrides[tk] = { price: Math.round(p), reason: r };
      }
      if (Object.keys(cleanedOverrides).length > 0) {
        payload.tier_price_overrides = cleanedOverrides;
      }
    }
    // Coordinator global pre-tax override (separate field). Renders for
    // every service type now — labour-only, office, single-item,
    // specialty, white-glove all use custom_price and the operator
    // needs a direct way to set it. Only sent when a positive number
    // is entered AND a reason is provided.
    if (quotePreTaxOverride.trim()) {
      const n = parseFloat(quotePreTaxOverride.replace(/[^0-9.]/g, ""));
      if (
        Number.isFinite(n) &&
        n > 0 &&
        quotePreTaxOverrideReason.trim().length >= 3
      ) {
        payload.quote_price_override = Math.round(n);
        payload.quote_price_override_reason =
          quotePreTaxOverrideReason.trim();
      }
    }
    // Carry-forward of operator-set fields that have no dedicated UI on
    // this page. Without these, hitting Re-Generate would silently drop
    // presentation mode, valuation upgrade, and the size-conflict
    // acknowledgement that the operator already made on the create form.
    if (typeof oq.presentation_mode === "string" && oq.presentation_mode) {
      payload.presentation_mode = oq.presentation_mode;
    }
    if (typeof oq.valuation_tier === "string" && oq.valuation_tier) {
      payload.valuation_tier = oq.valuation_tier;
    }
    if (
      typeof oq.valuation_upgrade_cost === "number" &&
      oq.valuation_upgrade_cost > 0
    ) {
      payload.valuation_upgrade_cost = oq.valuation_upgrade_cost;
    }
    if (oq.size_override_confirmed === true) {
      payload.size_override_confirmed = true;
    }
    if (serviceType !== "white_glove" && moveSize) {
      payload.move_size = moveSize;
    }

    // ── Labour-only scope ──
    // Mirror create form's serialization shape (QuoteFormClient line 4953+)
    // so the engine receives the same field names it does on create.
    if (serviceType === "labour_only") {
      payload.labour_job_category = labourJobCategory || undefined;
      payload.labour_description = labourDescription.trim() || undefined;
      payload.labour_complexity =
        labourComplexity !== "standard" ? labourComplexity : undefined;
      payload.labour_weight_class =
        labourWeightClass !== "standard" ? labourWeightClass : undefined;
      payload.labour_crew_size = labourCrewSize;
      payload.labour_hours = labourHours;
      payload.labour_truck_required = labourTruckRequired;
      payload.labour_visits = labourVisits;
      payload.labour_weekend = labourWeekend || undefined;
      payload.labour_after_hours = labourAfterHours || undefined;
      payload.labour_second_visit_date =
        labourVisits >= 2 ? labourSecondVisitDate || undefined : undefined;
      payload.labour_storage_needed = labourStorageNeeded;
      payload.labour_storage_weeks = labourStorageNeeded
        ? labourStorageWeeks
        : undefined;
    }

    if (serviceType === "office_move") {
      if (squareFootage) payload.square_footage = Number(squareFootage);
      if (workstationCount)
        payload.workstation_count = Number(workstationCount);
      payload.has_it_equipment = hasItEquipment;
      payload.has_conference_room = hasConferenceRoom;
      payload.has_reception_area = hasReceptionArea;
      if (timingPreference) payload.timing_preference = timingPreference;

      // Reconstruct the office_inventory payload from saved factors so
      // the live preview engine receives real per-line data and doesn't
      // hit the $1,500 minPrice floor on every tier. Without this,
      // opening the edit form for an office quote (where inventory_items
      // is empty -- the office engine writes its lines to
      // factors_applied.office_inventory, not the inventory_items
      // column) produced Essential $1,550 / Signature $1,550 / Priority
      // $1,550 in the live preview, masking the actual $6,650/$8,650/
      // $9,400 from the saved row.
      //
      // We also forward the per-quote scope flags from factors so the
      // engine reproduces the same scenario (after-hours / weekend /
      // partial / moving sqft / distance).
      const savedOfficeInv = (factors as Record<string, unknown>)
        .office_inventory;
      if (Array.isArray(savedOfficeInv) && savedOfficeInv.length > 0) {
        payload.office_inventory = savedOfficeInv.map((row) => {
          const r = row as { slug?: string; quantity?: number };
          return {
            slug: r.slug ?? "",
            quantity: Math.max(0, Math.floor(r.quantity ?? 0)),
          };
        });
      }
      if (factors.office_after_hours === true) {
        payload.office_after_hours = true;
      }
      if (factors.office_weekend === true) {
        payload.office_weekend = true;
      }
      if (factors.office_partial_move === true) {
        payload.office_partial_move = true;
      }
      const sqft = factors.office_moving_sqft;
      if (typeof sqft === "number" && sqft > 0) {
        payload.office_moving_sqft = sqft;
      }
    }

    if (serviceType === "single_item") {
      if (itemDescription.trim())
        payload.item_description = itemDescription.trim();
      if (itemCategory) payload.item_category = itemCategory;
      if (itemWeightClass) payload.item_weight_class = itemWeightClass;
      if (assemblyNeeded) payload.assembly_needed = assemblyNeeded;
      payload.stair_carry = stairCarry;
      if (stairCarry) payload.stair_flights = Number(stairFlights);
    }

    if (serviceType === "white_glove") {
      const wgItems = whiteGloveItemRows
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
      if (wgItems.length > 0) payload.white_glove_items = wgItems;
      if (declaredValue.trim()) {
        const n = Number(String(declaredValue).replace(/,/g, ""));
        if (Number.isFinite(n) && n > 0) payload.declared_value = n;
      }
      if (wgDebrisRemoval) payload.white_glove_debris_removal = true;
      if (wgGuaranteedWindow && wgGuaranteedWindowHours > 0) {
        payload.white_glove_guaranteed_window_hours =
          wgGuaranteedWindowHours;
      }
      if (wgBuildingReqs.length > 0) {
        payload.specialty_building_requirements = wgBuildingReqs;
      }
      if (wgBuildingNote.trim()) {
        payload.white_glove_building_requirements_note =
          wgBuildingNote.trim();
      }
      if (wgDeliveryInstructions.trim()) {
        payload.white_glove_delivery_instructions =
          wgDeliveryInstructions.trim();
      }
    }

    if (serviceType === "specialty") {
      if (projectType) payload.project_type = projectType;
      if (timelineHours) payload.timeline_hours = Number(timelineHours);
      if (customCratingPieces)
        payload.custom_crating_pieces = Number(customCratingPieces);
      payload.climate_control = climateControl;
    }

    if (serviceType === "local_move" || serviceType === "long_distance") {
      if (specialtyItems.length > 0)
        payload.specialty_items = specialtyItems.filter((s) => s.qty > 0);
      if (inventoryItems.length > 0) {
        payload.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
        }));
      }
      if (clientBoxCount !== "" && clientBoxCount != null)
        payload.client_box_count = Number(clientBoxCount);
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
      if (extraPick.length > 0) payload.additional_pickup_addresses = extraPick;
      if (extraDrop.length > 0)
        payload.additional_dropoff_addresses = extraDrop;
    }

    if (serviceType === "office_move" && inventoryItems.length > 0) {
      payload.inventory_items = inventoryItems.map((i) => ({
        slug: i.slug,
        name: i.name,
        quantity: i.quantity,
        weight_score: i.weight_score,
      }));
    }

    // Carry over any remaining factors not exposed in UI
    if (factors.company_name) payload.company_name = factors.company_name;

    return payload;
  }, [
    serviceType,
    fromAddress,
    toAddress,
    fromAccess,
    toAccess,
    moveDate,
    moveSize,
    squareFootage,
    workstationCount,
    hasItEquipment,
    hasConferenceRoom,
    hasReceptionArea,
    timingPreference,
    itemDescription,
    itemCategory,
    itemWeightClass,
    assemblyNeeded,
    stairCarry,
    stairFlights,
    declaredValue,
    whiteGloveItemRows,
    wgDebrisRemoval,
    wgGuaranteedWindow,
    wgGuaranteedWindowHours,
    wgBuildingReqs,
    wgBuildingNote,
    wgDeliveryInstructions,
    projectType,
    timelineHours,
    customCratingPieces,
    climateControl,
    specialtyItems,
    inventoryItems,
    clientBoxCount,
    selectedAddons,
    contact,
    oq,
    factors,
    extraFromStops,
    extraToStops,
    preferredTime,
    arrivalWindow,
    fromParking,
    toParking,
    fromLongCarry,
    toLongCarry,
    recommendedTier,
    assemblyOverride,
    crewOverride,
    hoursOverride,
    truckOverride,
    tierPriceOverrides,
    quotePreTaxOverride,
    quotePreTaxOverrideReason,
    // Labour-only scope inputs. Without these in the dep array the
    // fingerprint never registers changes to labour fields and the
    // Save buttons stay disabled while the operator edits them.
    labourJobCategory,
    labourDescription,
    labourComplexity,
    labourWeightClass,
    labourCrewSize,
    labourHours,
    labourTruckRequired,
    labourVisits,
    labourWeekend,
    labourAfterHours,
    labourSecondVisitDate,
    labourStorageNeeded,
    labourStorageWeeks,
  ]);

  // After multi-stop rows load, capture baseline so we do not call pricing until the user changes scope.
  useEffect(() => {
    if (isB2bQuote || !jobStopsLoaded) return;
    if (!fromAddress?.trim() || !toAddress?.trim() || !moveDate?.trim()) return;
    if (baselineFingerprintRef.current !== null) return;
    baselineFingerprintRef.current =
      stableEditQuotePayloadFingerprint(buildPayload());
  }, [
    isB2bQuote,
    jobStopsLoaded,
    fromAddress,
    toAddress,
    moveDate,
    buildPayload,
  ]);

  // ── Debounced live preview (only when pricing inputs differ from post-load baseline) ──
  useEffect(() => {
    if (isB2bQuote) {
      setLivePreview(null);
      setPreviewLoading(false);
      return;
    }
    if (!jobStopsLoaded) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    if (!fromAddress || !toAddress || !moveDate) return;

    const baseline = baselineFingerprintRef.current;
    const currentFp = stableEditQuotePayloadFingerprint(buildPayload());
    if (baseline !== null && currentFp === baseline) {
      setLivePreview(null);
      setPreviewLoading(false);
      return;
    }

    previewTimerRef.current = setTimeout(async () => {
      const fp = stableEditQuotePayloadFingerprint(buildPayload());
      if (
        baselineFingerprintRef.current !== null &&
        fp === baselineFingerprintRef.current
      ) {
        setLivePreview(null);
        setPreviewLoading(false);
        return;
      }
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/quotes/generate?preview=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (res.ok) {
          const data = await res.json();
          setLivePreview(data);
        }
      } catch {
        /* silent fail */
      }
      setPreviewLoading(false);
    }, 800);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [
    isB2bQuote,
    jobStopsLoaded,
    buildPayload,
    fromAddress,
    toAddress,
    moveDate,
  ]);

  const replaceQuoteJobStops = useCallback(
    async (quoteId: string) => {
      try {
        const listRes = await fetch(
          `/api/admin/job-stops?job_type=quote&job_id=${encodeURIComponent(quoteId)}`,
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          for (const s of (listData.stops ?? []) as { id?: string }[]) {
            if (s.id) {
              await fetch(
                `/api/admin/job-stops?id=${encodeURIComponent(s.id)}`,
                { method: "DELETE" },
              );
            }
          }
        }
        const extraPickups = extraFromStops
          .filter((s) => s.address.trim())
          .map((s, i) => ({
            ...s,
            stop_type: "pickup" as const,
            sort_order: i + 1,
          }));
        const extraDropoffs = extraToStops
          .filter((s) => s.address.trim())
          .map((s, i) => ({
            ...s,
            stop_type: "dropoff" as const,
            sort_order: i + 1,
          }));
        const all = [...extraPickups, ...extraDropoffs];
        if (all.length === 0) return;
        await fetch("/api/admin/job-stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_type: "quote",
            job_id: quoteId,
            stops: all,
          }),
        });
      } catch {
        /* non-fatal */
      }
    },
    [extraFromStops, extraToStops],
  );

  // ── Finalize: generate real quote + save to DB ────────────
  const handleRegenerate = useCallback(async () => {
    setError(null);
    const payload = buildPayload();
    const fp = stableEditQuotePayloadFingerprint(payload);
    if (
      baselineFingerprintRef.current !== null &&
      fp === baselineFingerprintRef.current
    ) {
      setError(
        "No changes to quote details. Update addresses, access, inventory, add-ons, or other fields before re-generating.",
      );
      return;
    }
    if (
      serviceType === "white_glove" &&
      !whiteGloveItemRows.some((r) => r.description.trim())
    ) {
      setError(
        "Add at least one delivery item with a description before re-generating.",
      );
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate quote");
        return;
      }
      baselineFingerprintRef.current =
        stableEditQuotePayloadFingerprint(buildPayload());
      setNewQuoteResult(data);
      const id = data.quote_id ?? data.quoteId;
      const qid = typeof id === "string" && id.trim() ? id.trim() : oq.quote_id;
      setNewQuoteId(typeof id === "string" && id.trim() ? id.trim() : null);
      if (qid) await replaceQuoteJobStops(qid);
    } catch {
      setError("Network error generating quote");
    } finally {
      setGenerating(false);
    }
  }, [
    buildPayload,
    oq.quote_id,
    replaceQuoteJobStops,
    serviceType,
    whiteGloveItemRows,
  ]);

  const handleSendUpdate = useCallback(async () => {
    const quoteIdToSend = newQuoteId || oq.quote_id;
    if (!quoteIdToSend) return;
    setError(null);
    // Reason is required at send-time (resend to client). It surfaces in
    // the update email and the HubSpot timeline. Dropdown ensures it's
    // categorised; "other" falls back to free-text.
    if (!reason || reason.length < 3) {
      setError(
        "Pick a reason for the update before resending — the client sees it in the email.",
      );
      return;
    }
    // Mirror create-form guard: refuse to send when assembly_override
    // is YES but the regenerated quote shows zero assembly items /
    // minutes. Same reasoning as QuoteFormClient.handleSend — crew
    // arriving to assemble a bed nobody billed for is the failure
    // mode this catches.
    if (
      assemblyOverride === true &&
      (serviceType === "local_move" || serviceType === "long_distance")
    ) {
      const fac = (newQuoteResult?.factors ??
        {}) as Record<string, unknown>;
      const items =
        typeof fac.assembly_items_count === "number"
          ? (fac.assembly_items_count as number)
          : 0;
      const minutes =
        typeof fac.assembly_minutes === "number"
          ? (fac.assembly_minutes as number)
          : 0;
      if (items === 0 && minutes === 0) {
        setError(
          "Assembly is set to Required but no inventory items have assembly. Add the items that need assembly OR switch Assembly to Auto / No, then Re-Generate before sending.",
        );
        return;
      }
    }
    setLinking(true);
    try {
      const res = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quoteIdToSend,
          hubspot_deal_id: oq.hubspot_deal_id,
          // update_reason is read by /api/quotes/send (when wired) and
          // logged to the activity timeline + HubSpot note. Safe to send
          // even before the server reads it — unknown fields are ignored.
          update_reason: reason,
          update_reason_code: reasonValue || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send quote");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setLinking(false);
    }
  }, [
    newQuoteId,
    oq.quote_id,
    oq.hubspot_deal_id,
    assemblyOverride,
    serviceType,
    newQuoteResult,
    reason,
    reasonValue,
  ]);

  const newPrice =
    newQuoteResult?.tiers?.essential?.price ??
    newQuoteResult?.tiers?.curated?.price ??
    newQuoteResult?.tiers?.essentials?.price ??
    newQuoteResult?.custom_price?.price ??
    null;
  const livePrice =
    livePreview?.tiers?.essential?.price ??
    livePreview?.tiers?.curated?.price ??
    livePreview?.tiers?.essentials?.price ??
    livePreview?.custom_price?.price ??
    null;

  const inputClass =
    "w-full px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]/82 focus:border-[var(--brd)] focus:ring-1 focus:ring-[var(--brd)]/30 outline-none transition-all";
  const labelClass = "admin-premium-label admin-premium-label--tight mb-1";

  /** True when the form has diverged from the post-load baseline.
   *  Re-derived on every render via buildPayload so any section's
   *  state change flips it without explicit per-field bookkeeping. */
  const hasChanges = (() => {
    if (isB2bQuote) return false;
    const baseline = baselineFingerprintRef.current;
    if (baseline === null) return false;
    try {
      return stableEditQuotePayloadFingerprint(buildPayload()) !== baseline;
    } catch {
      return false;
    }
  })();

  /** Save & resend = regenerate (which persists the new version) followed
   *  immediately by send. Requires the engine result panel to have
   *  appeared so we have a `newQuoteId` to send. If the operator clicks
   *  Save & resend before a preview run, we run handleRegenerate first
   *  and then defer send to the next event-loop tick via a state flag. */
  const [pendingResend, setPendingResend] = useState(false);
  const handleSaveAndResend = useCallback(async () => {
    if (!reason || reason.length < 3) {
      setError(
        "Pick a reason for the update before resending — the client sees it in the email.",
      );
      return;
    }
    if (newQuoteResult) {
      await handleSendUpdate();
      return;
    }
    setPendingResend(true);
    await handleRegenerate();
  }, [reason, newQuoteResult, handleSendUpdate, handleRegenerate]);

  // When the regenerate finishes and we have a queued resend, fire send.
  useEffect(() => {
    if (pendingResend && newQuoteResult && newQuoteId) {
      setPendingResend(false);
      void handleSendUpdate();
    }
  }, [pendingResend, newQuoteResult, newQuoteId, handleSendUpdate]);

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--green)]/10 flex items-center justify-center">
          <CheckCircle className="text-[var(--green)]" size={28} />
        </div>
        <h1 className="text-xl font-bold text-[var(--tx)] mb-2">
          Quote Updated & Sent
        </h1>
        <p className="text-sm text-[var(--tx2)] mb-1">
          <strong className="text-[var(--gold)]">{oq.quote_id}</strong> has been
          updated and sent.
        </p>
        <p className="text-sm text-[var(--tx3)] mb-8">
          {contact?.email
            ? `The updated quote has been emailed to ${contact.email}.`
            : "The quote is ready."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/admin/quotes/${oq.quote_id}`)}
            className="admin-btn admin-btn-secondary"
          >
            Back to Quote Details
          </button>
          <button
            onClick={() => setDone(false)}
            className="admin-btn admin-btn-primary"
          >
            Edit Quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <EditQuoteHeader
        quoteId={oq.quote_id}
        version={oq.version || 1}
        hasResult={!!newQuoteResult}
        clientName={contact?.name}
        serviceType={serviceType}
        moveDate={oq.move_date}
        generating={generating}
        linking={linking}
        hasChanges={hasChanges}
        onBack={() => router.back()}
        onSaveChanges={handleRegenerate}
        onSaveAndResend={handleSaveAndResend}
      />

      {/* Main 2-col grid:
            Left (col-span 2): all editable sections + result panel
            Right (col-span 1, sticky on lg): live price preview that
              stays visible while the operator scrolls through sections.
          On narrow screens it stacks single-column with the preview
          rendered between the summary and the form. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5 min-w-0">
      {/* Current quote summary */}
      <EditQuoteCurrentSummary
        clientName={contact?.name}
        currentPrice={Number(oldPrice) || 0}
        serviceType={serviceType}
        moveDate={oq.move_date}
        status={oq.status}
      />

      {/* Live price preview is rendered in the sticky right column via {livePreviewBlock}. */}
      
      {/* Edit fields — each logical block lives in its own EditSection
          card so the page reads as a stack of focused sections, not one
          wall of fields. Order is: Route & access (always open) → service-
          type-specific → Pricing → Inventory → Add-ons → Reason. */}
      <div className="space-y-3">

        {/* ── Route & access — always open by default since these are
             the most frequently edited fields and the page makes no
             sense without them visible. */}
        <EditSection
          eyebrow="Logistics"
          title="Route & access"
          defaultOpen={true}
          summary={
            fromAddress && toAddress
              ? `${fromAddress.split(",")[0]} → ${toAddress.split(",")[0]}${moveDate ? ` · ${moveDate}` : ""}`
              : "Set addresses and date"
          }
        >
        {/* ── Core fields ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-4">
            <MultiStopAddressField
              label="From address"
              placeholder="123 Main St, Toronto, ON"
              stops={[{ address: fromAddress }, ...extraFromStops]}
              onChange={(stops) => {
                setFromAddress(stops[0]?.address ?? "");
                setExtraFromStops(stops.slice(1));
              }}
              inputClassName={inputClass}
            />
            <MultiStopAddressField
              label="To address"
              placeholder="456 Bay St, Toronto, ON"
              stops={[{ address: toAddress }, ...extraToStops]}
              onChange={(stops) => {
                setToAddress(stops[0]?.address ?? "");
                setExtraToStops(stops.slice(1));
              }}
              inputClassName={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>From Access</label>
            <select
              value={fromAccess}
              onChange={(e) => setFromAccess(e.target.value)}
              className={inputClass}
            >
              <option value="">Select access…</option>
              <option value="elevator">Elevator</option>
              <option value="ground_floor">Ground Floor</option>
              <option value="loading_dock">Loading Dock</option>
              <option value="basement">Basement</option>
              <option value="basement_stairs">Basement (Stairs)</option>
              <option value="basement_walkout">Basement (Walk-out)</option>
              <option value="walk_up_2nd">Walk-Up (2nd floor)</option>
              <option value="walk_up_3rd">Walk-Up (3rd floor)</option>
              <option value="walk_up_4th_plus">Walk-Up (4th+ floor)</option>
              <option value="long_carry">Long Carry</option>
              <option value="narrow_stairs">Narrow Stairs</option>
              <option value="no_parking_nearby">No Parking Nearby</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>To Access</label>
            <select
              value={toAccess}
              onChange={(e) => setToAccess(e.target.value)}
              className={inputClass}
            >
              <option value="">Select access…</option>
              <option value="elevator">Elevator</option>
              <option value="ground_floor">Ground Floor</option>
              <option value="loading_dock">Loading Dock</option>
              <option value="basement">Basement</option>
              <option value="basement_stairs">Basement (Stairs)</option>
              <option value="basement_walkout">Basement (Walk-out)</option>
              <option value="walk_up_2nd">Walk-Up (2nd floor)</option>
              <option value="walk_up_3rd">Walk-Up (3rd floor)</option>
              <option value="walk_up_4th_plus">Walk-Up (4th+ floor)</option>
              <option value="long_carry">Long Carry</option>
              <option value="narrow_stairs">Narrow Stairs</option>
              <option value="no_parking_nearby">No Parking Nearby</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>
              {quoteFormServiceDateLabel(serviceType).replace(" *", "")}
            </label>
            <input
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className={inputClass}
            />
          </div>
          {(serviceType === "local_move" ||
            serviceType === "long_distance") && (
            <div>
              <label className={labelClass}>Move Size</label>
              <select
                value={moveSize}
                onChange={(e) => setMoveSize(e.target.value)}
                className={inputClass}
              >
                <option value="">Select size…</option>
                <option value="studio">Studio</option>
                <option value="1br">1 Bedroom</option>
                <option value="2br">2 Bedroom</option>
                <option value="3br">3 Bedroom</option>
                <option value="4br">4 Bedroom</option>
                <option value="5br_plus">5+ Bedroom</option>
                <option value="partial">Partial Move</option>
              </select>
            </div>
          )}
          {/* Scheduling: preferred time + arrival window — mirrors the
              create form. These persist on quotes (preferred_time,
              arrival_window) and used to be silently dropped on every
              re-quote because the edit form never showed or sent them. */}
          {serviceType !== "bin_rental" && serviceType !== "labour_only" && (
            <>
              <div>
                <label className={labelClass}>Preferred Time</label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Arrival Window</label>
                <select
                  value={arrivalWindow}
                  onChange={(e) => setArrivalWindow(e.target.value)}
                  className={inputClass}
                >
                  {TIME_WINDOW_OPTIONS.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {/* Recommended tier — affects which add-ons are visible and
              which tier is highlighted on the client quote page. */}
          {(serviceType === "local_move" ||
            serviceType === "long_distance") && (
            <div>
              <label className={labelClass}>Recommended Tier</label>
              <select
                value={recommendedTier}
                onChange={(e) => setRecommendedTier(e.target.value)}
                className={inputClass}
              >
                {RECOMMENDED_TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Building access surcharges: parking + long carry. These flow
            straight into the pricing engine via from_parking / to_parking
            and from_long_carry / to_long_carry — the edit form used to
            send neither, so re-generating would reset parking back to
            "dedicated" and clear any long-carry flag. */}
        {(serviceType === "local_move" ||
          serviceType === "long_distance" ||
          serviceType === "white_glove") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className={labelClass}>From Parking</label>
              <select
                value={fromParking}
                onChange={(e) =>
                  setFromParking(e.target.value as ParkingOption)
                }
                className={inputClass}
              >
                {PARKING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="flex items-start gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={fromLongCarry}
                  onChange={(e) => setFromLongCarry(e.target.checked)}
                  className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5"
                />
                <span>
                  Add $75 long-carry surcharge for pickup
                  {fromLongCarry ? (
                    <span className="ml-1 text-emerald-600 font-medium">— applied</span>
                  ) : (
                    <span className="ml-1 text-[var(--tx3)]">— not applied</span>
                  )}
                </span>
              </label>
            </div>
            <div className="space-y-2">
              <label className={labelClass}>To Parking</label>
              <select
                value={toParking}
                onChange={(e) => setToParking(e.target.value as ParkingOption)}
                className={inputClass}
              >
                {PARKING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="flex items-start gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={toLongCarry}
                  onChange={(e) => setToLongCarry(e.target.checked)}
                  className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5"
                />
                <span>
                  Add $75 long-carry surcharge for destination
                  {toLongCarry ? (
                    <span className="ml-1 text-emerald-600 font-medium">— applied</span>
                  ) : (
                    <span className="ml-1 text-[var(--tx3)]">— not applied</span>
                  )}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Assembly override — tri-state. Operators may force assembly on
            for moves the auto-detector misses (high-end builds, dressers
            without obvious item slugs), or force it off when the client
            confirmed disassembly themselves. Null = auto. */}
        {(serviceType === "local_move" ||
          serviceType === "long_distance") && (
          <div className="pt-2">
            <label className={labelClass}>Assembly Required</label>
            <div className="flex gap-2">
              {[
                { value: null, label: "Auto-detect" },
                { value: true, label: "Yes — required" },
                { value: false, label: "No — not required" },
              ].map((opt) => {
                const active = assemblyOverride === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setAssemblyOverride(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                      active
                        ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                        : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        </EditSection>

        {/* Operator overrides — crew / hours / truck. Engine auto-picks
            from inventory + access; this is the escape hatch when the
            auto-pick is operationally wrong. Leave blank for auto.
            Wrapped in EditSection — collapsed by default since most
            edits trust the engine; opens when the operator needs to
            force a value. */}
        {(serviceType === "local_move" ||
          serviceType === "long_distance") && (
          <EditSection
            eyebrow="Crew"
            title="Crew, hours & truck override"
            defaultOpen={
              !!(crewOverride || hoursOverride || truckOverride)
            }
            hasChanges={
              !!(crewOverride || hoursOverride || truckOverride)
            }
            summary={
              crewOverride || hoursOverride || truckOverride
                ? `Override active: ${[crewOverride && `crew ${crewOverride}`, hoursOverride && `${hoursOverride}h`, truckOverride].filter(Boolean).join(" · ")}`
                : "Engine auto-picks · open to override"
            }
          >
            <p className="text-[11px] text-[var(--tx3)] mt-2 mb-3 leading-snug">
              Leave blank for the engine&apos;s auto-pick. Set values
              when the auto-pick is wrong for the job (e.g. a light 1BR
              with a 3rd-floor walk-up shouldn&apos;t need 3 movers).
              The override is logged to{" "}
              <span className="font-medium text-[var(--tx2)]">
                factors_applied.operator_overrides
              </span>{" "}
              for audit.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  Crew size{" "}
                  {livePreview?.labour?.crewSize ? (
                    <span className="text-[var(--tx3)] font-normal">
                      (engine: {livePreview.labour.crewSize})
                    </span>
                  ) : null}
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  value={crewOverride}
                  onChange={(e) => setCrewOverride(e.target.value)}
                  placeholder="auto"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Estimated hours{" "}
                  {livePreview?.labour?.estimatedHours ? (
                    <span className="text-[var(--tx3)] font-normal">
                      (engine: {livePreview.labour.estimatedHours})
                    </span>
                  ) : null}
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={hoursOverride}
                  onChange={(e) => setHoursOverride(e.target.value)}
                  placeholder="auto"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Truck size{" "}
                  {livePreview?.labour?.truckSize ? (
                    <span className="text-[var(--tx3)] font-normal">
                      (engine: {livePreview.labour.truckSize})
                    </span>
                  ) : null}
                </label>
                <select
                  value={truckOverride}
                  onChange={(e) => setTruckOverride(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Auto</option>
                  <option value="sprinter">Sprinter</option>
                  <option value="16ft">16ft</option>
                  <option value="20ft">20ft</option>
                  <option value="24ft">24ft</option>
                  <option value="26ft">26ft</option>
                </select>
              </div>
            </div>
            {priorOverrides && (
              <p className="text-[10px] text-[var(--tx3)] mt-2 leading-snug">
                Last re-generate used:{" "}
                {priorOverrides.crew
                  ? `crew ${priorOverrides.crew.to} (engine wanted ${priorOverrides.crew.from})`
                  : null}
                {priorOverrides.crew &&
                (priorOverrides.hours || priorOverrides.truck)
                  ? " · "
                  : ""}
                {priorOverrides.hours
                  ? `hours ${priorOverrides.hours.to} (engine wanted ${priorOverrides.hours.from})`
                  : null}
                {priorOverrides.hours && priorOverrides.truck ? " · " : ""}
                {priorOverrides.truck
                  ? `truck ${priorOverrides.truck.to} (engine wanted ${priorOverrides.truck.from})`
                  : null}
              </p>
            )}
          </EditSection>
        )}

        {/* ── Labour service scope ──
            Mirrors every field from the create form's labour_only block
            (QuoteFormClient line 10302+). Hydrated from
            oq.factors_applied so re-quote is a true round-trip — was
            missing entirely before, which is why the labour-only edit
            page was just addresses + access + date. */}
        {serviceType === "labour_only" && (
          <EditSection
            eyebrow="Scope"
            title="Labour service details"
            defaultOpen={true}
            summary={
              labourJobCategory || labourDescription
                ? `${labourJobCategory || "—"} · ${labourCrewSize}-person crew × ${labourHours}h`
                : "Set job category, crew, hours"
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Job Category</label>
                  <select
                    value={labourJobCategory}
                    onChange={(e) => setLabourJobCategory(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select category…</option>
                    <option value="assembly">Furniture Assembly &amp; Setup</option>
                    <option value="rearrange">In-Home Rearrangement</option>
                    <option value="debris_removal">Debris &amp; Packaging Removal</option>
                    <option value="appliance">Appliance Placement</option>
                    <option value="staging">Home Staging</option>
                    <option value="tv_mounting">TV Mounting &amp; Setup</option>
                    <option value="other">Other / Custom</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Description of Work *</label>
                  <textarea
                    value={labourDescription}
                    onChange={(e) => setLabourDescription(e.target.value)}
                    rows={2}
                    placeholder="Rearrange living room furniture, assemble new bookshelf…"
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Scope Complexity</label>
                  <select
                    value={labourComplexity}
                    onChange={(e) =>
                      setLabourComplexity(
                        e.target.value as "standard" | "moderate" | "complex",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="standard">Standard — clear access, light furniture</option>
                    <option value="moderate">Moderate — some heavy items, stairs, tight spaces</option>
                    <option value="complex">Complex — heavy items, multiple floors, high assembly</option>
                  </select>
                  <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                    Moderate +25% · Complex +50%
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Item Weight Class</label>
                  <select
                    value={labourWeightClass}
                    onChange={(e) =>
                      setLabourWeightClass(
                        e.target.value as "standard" | "heavy" | "very_heavy",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="standard">Standard — typical household furniture</option>
                    <option value="heavy">Heavy — appliances, gym equipment, safes</option>
                    <option value="very_heavy">Very Heavy — piano, commercial equipment</option>
                  </select>
                  <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                    Heavy +20% · Very Heavy +45%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className={labelClass}>Crew Size</label>
                  <select
                    value={labourCrewSize}
                    onChange={(e) => setLabourCrewSize(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[1, 2, 3, 4, 5].map((c) => (
                      <option key={c} value={c}>
                        {c}-Person Crew
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Estimated Hours</label>
                  <select
                    value={labourHours}
                    onChange={(e) => setLabourHours(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                      <option key={h} value={h}>
                        {h === 8 ? "Full day (8h)" : `${h} hour${h > 1 ? "s" : ""}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Truck Required</label>
                  <select
                    value={labourTruckRequired ? "yes" : "no"}
                    onChange={(e) =>
                      setLabourTruckRequired(e.target.value === "yes")
                    }
                    className={inputClass}
                  >
                    <option value="no">No truck</option>
                    <option value="yes">Yes, truck needed</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Number of Visits</label>
                  <select
                    value={labourVisits}
                    onChange={(e) => setLabourVisits(Number(e.target.value))}
                    className={inputClass}
                  >
                    <option value={1}>1 visit</option>
                    <option value={2}>2 visits (return)</option>
                  </select>
                </div>
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
              {labourVisits >= 2 && (
                <div>
                  <label className={labelClass}>Second Visit Date</label>
                  <input
                    type="date"
                    value={labourSecondVisitDate}
                    onChange={(e) => setLabourSecondVisitDate(e.target.value)}
                    className={`${inputClass} w-48`}
                  />
                </div>
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
                  <div className="pl-5">
                    <label className={labelClass}>
                      Estimated storage duration (weeks)
                    </label>
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
                      className={`${inputClass} w-28`}
                    />
                  </div>
                )}
              </div>
            </div>
          </EditSection>
        )}

        {/* ── Direct price override (universal) ──
            Every service type uses some form of pricing — tier-based for
            local_move / long_distance, custom_price for everything else.
            Until this block landed there was NO way to set a price
            directly on labour-only / office / single-item / specialty /
            white-glove quotes from the edit page. Now there is. */}
        {serviceType !== "local_move" &&
          serviceType !== "long_distance" &&
          serviceType !== "b2b_delivery" && (
            <EditSection
              eyebrow="Pricing"
              title="Direct price override"
              defaultOpen={!!quotePreTaxOverride.trim()}
              hasChanges={!!quotePreTaxOverride.trim()}
              summary={
                quotePreTaxOverride.trim()
                  ? `Override active: $${quotePreTaxOverride}`
                  : "Engine-priced · open to set a fixed pre-tax total"
              }
            >
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--tx2)] leading-snug">
                  Sets a fixed pre-tax total that bypasses the engine.
                  Reason required when an amount is entered. The engine
                  still runs to compute downstream metadata (truck,
                  crew, etc.) but the headline price uses this number.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Override amount ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={quotePreTaxOverride}
                      onChange={(e) => setQuotePreTaxOverride(e.target.value)}
                      placeholder="Leave blank for engine price"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Reason (required if overriding)
                    </label>
                    <select
                      value={
                        PRICE_OVERRIDE_REASONS.some(
                          (r) => r.label === quotePreTaxOverrideReason,
                        )
                          ? PRICE_OVERRIDE_REASONS.find(
                              (r) => r.label === quotePreTaxOverrideReason,
                            )?.value ?? ""
                          : quotePreTaxOverrideReason
                            ? "other"
                            : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" ) {
                          setQuotePreTaxOverrideReason("");
                        } else if (v === "other") {
                          // Preserve existing text if any, otherwise blank.
                          if (
                            PRICE_OVERRIDE_REASONS.some(
                              (r) => r.label === quotePreTaxOverrideReason,
                            )
                          ) {
                            setQuotePreTaxOverrideReason("");
                          }
                        } else {
                          setQuotePreTaxOverrideReason(
                            buildPriceOverrideReasonText(v),
                          );
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="">Select a reason…</option>
                      {PRICE_OVERRIDE_REASONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {/* "Other" path — free text shown only when the
                        dropdown is set to other AND the stored value
                        isn't a known label. */}
                    {!PRICE_OVERRIDE_REASONS.some(
                      (r) => r.label === quotePreTaxOverrideReason,
                    ) &&
                      quotePreTaxOverrideReason !== "" && (
                        <input
                          type="text"
                          value={quotePreTaxOverrideReason}
                          onChange={(e) =>
                            setQuotePreTaxOverrideReason(e.target.value)
                          }
                          placeholder="Describe the reason…"
                          className={`${inputClass} mt-2`}
                        />
                      )}
                  </div>
                </div>
              </div>
            </EditSection>
          )}

        {/* ── Per-tier price override + global coordinator override ──
            Same UX as the create form (admin/quotes/new). Wrapped in
            EditSection so it's collapsed by default — most edits don't
            touch pricing directly, but when the coordinator does want
            to override, this is the canonical surface.

            office_move added 2026-06-30: edit form was missing per-tier
            override entirely; operator could only set a global pre-tax
            override. Now mirrors the new-quote form with three tier
            rows including Priority. */}
        {(serviceType === "local_move" ||
          serviceType === "long_distance" ||
          serviceType === "office_move") && (
          <EditSection
            eyebrow="Pricing"
            title="Pricing & overrides"
            summary={
              Object.keys(tierPriceOverrides).length > 0 ||
              quotePreTaxOverride.trim()
                ? "Override active — open to review"
                : "Engine-priced · open to override per-tier or global"
            }
            defaultOpen={
              Object.keys(tierPriceOverrides).length > 0 ||
              quotePreTaxOverride.trim().length > 0
            }
            hasChanges={
              Object.keys(tierPriceOverrides).length > 0 ||
              quotePreTaxOverride.trim().length > 0
            }
          >
            <div className="mt-3">
              {(() => {
                // Build the price map for whichever tier set this
                // service uses. Residential = essential/signature/
                // estate; office = essential/signature/priority. The
                // editor accepts both via tierOrder prop.
                const pick = (tk: "essential" | "signature" | "estate" | "priority") => {
                  const p =
                    typeof newQuoteResult?.tiers?.[tk]?.price === "number"
                      ? newQuoteResult.tiers[tk].price
                      : typeof oq.tiers?.[tk]?.price === "number"
                        ? oq.tiers[tk].price
                        : undefined;
                  return p;
                };
                const isOffice = serviceType === "office_move";
                const order: ("essential" | "signature" | "estate" | "priority")[] =
                  isOffice
                    ? ["essential", "signature", "priority"]
                    : ["essential", "signature", "estate"];
                const prices: Record<string, number | undefined> = {};
                for (const tk of order) prices[tk] = pick(tk);
                return (
                  <TierPriceOverrideEditor
                    value={tierPriceOverrides}
                    onChange={setTierPriceOverrides}
                    tierOrder={order}
                    enginePrices={prices}
                    savedPrices={prices}
                  />
                );
              })()}
            </div>

            <div className="rounded-xl border border-[var(--brd)] bg-white p-4 mt-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx2)]">
                Coordinator price override (pre-tax)
              </div>
              <p className="text-[11px] text-[var(--tx2)] leading-snug">
                Optional. Sets a single pre-tax total that scales all tiers
                proportionally. Reason required when an amount is entered.
                For a single-tier match use the per-tier editor above.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <label className={labelClass}>Override amount ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quotePreTaxOverride}
                    onChange={(e) => setQuotePreTaxOverride(e.target.value)}
                    placeholder="Leave blank for engine price"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Reason (required if overriding)
                  </label>
                  <select
                    value={
                      PRICE_OVERRIDE_REASONS.some(
                        (r) => r.label === quotePreTaxOverrideReason,
                      )
                        ? PRICE_OVERRIDE_REASONS.find(
                            (r) => r.label === quotePreTaxOverrideReason,
                          )?.value ?? ""
                        : quotePreTaxOverrideReason
                          ? "other"
                          : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        setQuotePreTaxOverrideReason("");
                      } else if (v === "other") {
                        if (
                          PRICE_OVERRIDE_REASONS.some(
                            (r) => r.label === quotePreTaxOverrideReason,
                          )
                        ) {
                          setQuotePreTaxOverrideReason("");
                        }
                      } else {
                        setQuotePreTaxOverrideReason(
                          buildPriceOverrideReasonText(v),
                        );
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">Select a reason…</option>
                    {PRICE_OVERRIDE_REASONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {!PRICE_OVERRIDE_REASONS.some(
                    (r) => r.label === quotePreTaxOverrideReason,
                  ) &&
                    quotePreTaxOverrideReason !== "" && (
                      <input
                        type="text"
                        value={quotePreTaxOverrideReason}
                        onChange={(e) =>
                          setQuotePreTaxOverrideReason(e.target.value)
                        }
                        placeholder="Describe the reason…"
                        className={`${inputClass} mt-2`}
                      />
                    )}
                </div>
              </div>
            </div>
          </EditSection>
        )}

        {/* ── Office move ── */}
        {serviceType === "office_move" && (
          <EditSection
            eyebrow="Scope"
            title="Office move details"
            defaultOpen={true}
            summary={
              squareFootage || workstationCount
                ? `${squareFootage ? `${squareFootage} sqft` : ""}${squareFootage && workstationCount ? " · " : ""}${workstationCount ? `${workstationCount} workstations` : ""}`
                : "Set square footage, workstations, timing"
            }
          >
            <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>Square Footage</label>
                <input
                  type="number"
                  value={squareFootage}
                  onChange={(e) => setSquareFootage(e.target.value)}
                  className={`${inputClass} min-w-0`}
                  placeholder="e.g. 2000"
                />
              </div>
              <div>
                <label className={labelClass}>Workstations</label>
                <input
                  type="number"
                  value={workstationCount}
                  onChange={(e) => setWorkstationCount(e.target.value)}
                  className={`${inputClass} min-w-0`}
                  placeholder="e.g. 15"
                />
              </div>
              <div>
                <label className={labelClass}>Timing Preference</label>
                <select
                  value={timingPreference}
                  onChange={(e) => setTimingPreference(e.target.value)}
                  className={`${inputClass} min-w-0`}
                >
                  <option value="">Standard (business hours)</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening (+15%)</option>
                  <option value="overnight">Overnight (+15%)</option>
                  <option value="weekend">Weekend</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Toggle
                checked={hasItEquipment}
                onChange={setHasItEquipment}
                label="Has IT Equipment"
              />
              <Toggle
                checked={hasConferenceRoom}
                onChange={setHasConferenceRoom}
                label="Has Conference Room"
              />
              <Toggle
                checked={hasReceptionArea}
                onChange={setHasReceptionArea}
                label="Has Reception Area"
              />
            </div>
            </div>
          </EditSection>
        )}

        {/* ── White glove (multi-line items) ── */}
        {serviceType === "white_glove" && (
          <EditSection
            eyebrow="Scope"
            title="White-glove delivery"
            defaultOpen={true}
            summary={
              whiteGloveItemRows.length > 0
                ? `${whiteGloveItemRows.length} delivery item${whiteGloveItemRows.length === 1 ? "" : "s"}`
                : "Add delivery items, building requirements, instructions"
            }
          >
          <div className="space-y-4">
            <WhiteGloveItemsEditor
              value={whiteGloveItemRows}
              onChange={setWhiteGloveItemRows}
              fieldInputClass={inputClass}
              itemWeights={itemWeights}
              cargoCoverageHint="For insurance purposes. Standard cargo coverage is $100K."
              declaredValue={declaredValue}
              onDeclaredValueChange={setDeclaredValue}
              debrisRemoval={wgDebrisRemoval}
              onDebrisRemovalChange={setWgDebrisRemoval}
            />
            <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)]/80 p-3 space-y-2">
              <label className="flex items-start gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={wgGuaranteedWindow}
                  onChange={(e) => setWgGuaranteedWindow(e.target.checked)}
                  className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
                />
                <span>
                  <span className="font-medium text-[var(--tx)]">
                    Guaranteed time window
                  </span>
                  <span className="block text-[11px] text-[var(--tx3)] mt-0.5">
                    Delivery must complete inside a booked window
                  </span>
                </span>
              </label>
              {wgGuaranteedWindow && (
                <div className="pl-6">
                  <label className={labelClass}>Window length</label>
                  <select
                    value={String(wgGuaranteedWindowHours)}
                    onChange={(e) =>
                      setWgGuaranteedWindowHours(
                        Number(e.target.value) as 2 | 3 | 4,
                      )
                    }
                    className={`${inputClass} min-w-0 max-w-[12rem]`}
                  >
                    <option value="2">2 hours</option>
                    <option value="3">3 hours</option>
                    <option value="4">4 hours</option>
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[var(--tx3)] tracking-widest uppercase">
                Building / access requirements
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WG_BUILDING_REQUIREMENT_OPTIONS.map((req) => {
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
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
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
                <div>
                  <label className={labelClass}>Building requirements note</label>
                  <textarea
                    value={wgBuildingNote}
                    onChange={(e) => setWgBuildingNote(e.target.value)}
                    rows={2}
                    placeholder="COI details, dock booking, hours…"
                    className={`${inputClass} resize-none`}
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>Delivery instructions</label>
              <textarea
                value={wgDeliveryInstructions}
                onChange={(e) => setWgDeliveryInstructions(e.target.value)}
                rows={3}
                placeholder="Room of choice, concierge, phone on arrival…"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
          </EditSection>
        )}

        {/* ── Single item ── */}
        {serviceType === "single_item" && (
          <EditSection
            eyebrow="Scope"
            title="Single-item delivery"
            defaultOpen={true}
            summary={
              itemDescription
                ? `${itemDescription.slice(0, 40)}${itemDescription.length > 40 ? "…" : ""}`
                : "Set item description, category, weight class"
            }
          >
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Item description *</label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="e.g. Leather sectional sofa, Dining table, Queen bed"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className={`${inputClass} min-w-0`}
                >
                  <option value="">Select…</option>
                  <option value="standard_furniture">Standard Furniture</option>
                  <option value="large_furniture">Large Furniture</option>
                  <option value="appliance">Appliance</option>
                  <option value="piano">Piano</option>
                  <option value="safe">Safe</option>
                  <option value="exercise_equipment">Exercise Equipment</option>
                  <option value="art">Art / Sculpture</option>
                  <option value="antique">Antique</option>
                  <option value="pool_table">Pool Table</option>
                  <option value="hot_tub">Hot Tub</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Weight Class</label>
                <select
                  value={itemWeightClass}
                  onChange={(e) => setItemWeightClass(e.target.value)}
                  className={`${inputClass} min-w-0`}
                >
                  <option value="">Select…</option>
                  <option value="Under 150 lbs">Under 150 lbs</option>
                  <option value="150-300 lbs">150–300 lbs</option>
                  <option value="300-500 lbs">300–500 lbs (+$100)</option>
                  <option value="Over 500 lbs">Over 500 lbs (+$200)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Assembly</label>
                <select
                  value={assemblyNeeded}
                  onChange={(e) => setAssemblyNeeded(e.target.value)}
                  className={`${inputClass} min-w-0`}
                >
                  <option value="">None</option>
                  <option value="assembly">Assembly only</option>
                  <option value="disassembly">Disassembly only</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 md:col-span-2">
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
                    onChange={(e) => setStairFlights(e.target.value)}
                    className={`${inputClass} w-12 py-1 min-w-0`}
                    title="Flights"
                  />
                )}
              </div>
            </div>
          </div>
          </EditSection>
        )}

        {/* ── Specialty service ── */}
        {serviceType === "specialty" && (
          <EditSection
            eyebrow="Scope"
            title="Specialty service details"
            defaultOpen={true}
            summary={
              projectType
                ? `${projectType.replace(/_/g, " ")}${timelineHours ? ` · ${timelineHours}h` : ""}`
                : "Set project type, hours, crating"
            }
          >
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
              <div>
                <label className={labelClass}>Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className={`${inputClass} min-w-0`}
                >
                  <option value="">Select type…</option>
                  <option value="art_installation">Art Installation</option>
                  <option value="trade_show">Trade Show</option>
                  <option value="estate_cleanout">Estate Cleanout</option>
                  <option value="staging">Home Staging</option>
                  <option value="wine_transport">Wine Transport</option>
                  <option value="medical_equip">Medical Equipment</option>
                  <option value="piano_move">Piano Move</option>
                  <option value="event_setup">Event Setup / Teardown</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Hours</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={timelineHours}
                  onChange={(e) => setTimelineHours(e.target.value)}
                  className={`${inputClass} w-20 min-w-0`}
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className={labelClass}>Crating (pcs)</label>
                <input
                  type="number"
                  min="0"
                  value={customCratingPieces}
                  onChange={(e) => setCustomCratingPieces(e.target.value)}
                  className={`${inputClass} w-16 min-w-0`}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <Toggle
                  checked={climateControl}
                  onChange={setClimateControl}
                  label="Climate Control (+$150)"
                />
              </div>
            </div>
          </div>
          </EditSection>
        )}

        {/* ── Specialty items for residential moves ── */}
        {(serviceType === "local_move" || serviceType === "long_distance") && (
          <EditSection
            eyebrow="Items"
            title="Specialty items"
            defaultOpen={specialtyItems.some((s) => (s.qty ?? 0) > 0)}
            summary={
              specialtyItems.some((s) => (s.qty ?? 0) > 0)
                ? `${specialtyItems.filter((s) => (s.qty ?? 0) > 0).length} specialty type${specialtyItems.filter((s) => (s.qty ?? 0) > 0).length === 1 ? "" : "s"}`
                : "Piano, safe, hot tub, artwork, etc."
            }
          >
          <div>
            <p className="text-[11px] text-[var(--tx3)] mt-2 mb-3">
              Add any bulky or specialty items that require extra handling.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPECIALTY_ITEM_TYPES.map((type) => {
                const existing = specialtyItems.find((s) => s.type === type);
                const qty = existing?.qty ?? 0;
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                  >
                    <span className="text-[11px] text-[var(--tx)] uppercase">
                      {type.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={qty === 0}
                        onClick={() =>
                          setSpecialtyItems((prev) => {
                            const filtered = prev.filter(
                              (s) => s.type !== type,
                            );
                            const next = qty - 1;
                            return next > 0
                              ? [...filtered, { type, qty: next }]
                              : filtered;
                          })
                        }
                        className="w-6 h-6 rounded-full border border-[var(--brd)] text-[var(--tx2)] flex items-center justify-center text-sm hover:bg-[var(--card)] disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-[12px] font-semibold text-[var(--tx)]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSpecialtyItems((prev) => {
                            const filtered = prev.filter(
                              (s) => s.type !== type,
                            );
                            return [...filtered, { type, qty: qty + 1 }];
                          })
                        }
                        className="w-6 h-6 rounded-full border border-[var(--brd)] text-[var(--tx2)] flex items-center justify-center text-sm hover:bg-[var(--card)]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </EditSection>
        )}

        {/* ── Furniture / Client Inventory (residential + office) ──
            Wrapped in EditSection — big block (50+ items + box estimator),
            collapsed by default. Opens automatically when the operator
            actually wants to touch inventory. */}
        {(serviceType === "local_move" ||
          serviceType === "long_distance" ||
          serviceType === "office_move") &&
          itemWeights.length > 0 && (
            <EditSection
              eyebrow="Scope"
              title="Furniture & inventory"
              summary={(() => {
                // Office quotes store their line count in
                // factors.office_unit_count (the engine's aggregate)
                // rather than in inventory_items rows. Reading
                // inventoryItems.length gives "0 items" even when the
                // saved quote has 327 units, which reads as broken.
                // Prefer the factors count for office and fall through
                // to the row count everywhere else.
                if (serviceType === "office_move") {
                  const officeCount = Number(
                    (factors as Record<string, unknown>)
                      ?.office_unit_count ?? 0,
                  );
                  if (officeCount > 0) {
                    return `${officeCount} unit${officeCount === 1 ? "" : "s"} (saved)`;
                  }
                }
                return `${inventoryItems.length} item${inventoryItems.length === 1 ? "" : "s"} · ${clientBoxCount || "no"} boxes`;
              })()}
              defaultOpen={false}
            >
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
                moveSize={moveSize}
                fromAccess={fromAccess}
                toAccess={toAccess}
                showLabourEstimate={!!moveSize}
                boxCount={
                  serviceType === "local_move" ||
                  serviceType === "long_distance"
                    ? Number(clientBoxCount) || 0
                    : undefined
                }
                onBoxCountChange={
                  serviceType === "local_move" ||
                  serviceType === "long_distance"
                    ? (n) => setClientBoxCount(String(n))
                    : undefined
                }
                mode={
                  serviceType === "office_move" ? "commercial" : "residential"
                }
              />
              {/* Box count was previously rendered here as a SECOND
                  input alongside the dropdown inside InventoryInput,
                  showing the same clientBoxCount value through two
                  different widgets — the dropdown shows the range
                  label ("5–10 boxes") while the numeric below showed
                  the exact count ("8"), confusing operators reading
                  the form. The InventoryInput dropdown already
                  exposes a "Custom" option that opens an inline
                  numeric for exact counts, so the duplicate field
                  was redundant. */}
            </EditSection>
          )}

        {/* ── Add-ons ──
            Wrapped in EditSection. The full add-on list is long (10+
            options with tier gating); collapsed default keeps the page
            scrollable, and the summary shows what's already selected. */}
        {applicableAddons.length > 0 && (
          <EditSection
            eyebrow="Extras"
            title="Add-ons"
            summary={
              selectedAddons.size === 0
                ? "No add-ons selected"
                : `${selectedAddons.size} add-on${selectedAddons.size === 1 ? "" : "s"} selected`
            }
            defaultOpen={selectedAddons.size > 0}
            hasChanges={selectedAddons.size > 0}
          >
            {tierForAddons === "estate" &&
              (serviceType === "local_move" ||
                serviceType === "long_distance") && (
                <div className="mt-2 mb-3 rounded-lg border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-3 text-[10px] text-[var(--tx2)] space-y-1">
                  <p className="font-bold tracking-wide text-[var(--tx)]">
                    {ESTATE_ADDON_UI_LINES[0]}
                  </p>
                  <p className="leading-snug">{ESTATE_ADDON_UI_LINES[1]}</p>
                  <p className="font-semibold text-[var(--tx)] pt-0.5">
                    {ESTATE_ADDON_UI_LINES[2]}
                  </p>
                </div>
              )}
            <div className="mt-3 space-y-2">
              {popularAddons.map((addon) => {
                const sel = selectedAddons.get(addon.id);
                const isSelected = !!sel;
                let displayPrice = "";
                if (addon.price_type === "flat")
                  displayPrice = fmtPrice(addon.price);
                else if (addon.price_type === "per_unit")
                  displayPrice = `${fmtPrice(addon.price)} ${addon.unit_label ?? "each"}`;
                else if (addon.price_type === "tiered") displayPrice = "varies";
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
                          <p className="text-[10px] text-[var(--tx3)] mt-0.5 leading-snug">
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
                          className="w-16 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
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
                            className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
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
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gold)] hover:text-[var(--gold)]/80 transition-colors py-1.5"
                >
                  {showAllAddons
                    ? "Hide other add-ons ▲"
                    : `Show all add-ons (${otherAddons.length} more) ▾`}
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
                            <span className="text-[11px] text-[var(--tx3)] ml-auto shrink-0">
                              {displayPrice}
                            </span>
                          </div>
                          {addon.description && (
                            <p className="text-[10px] text-[var(--tx3)] mt-0.5 leading-snug">
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
                            className="w-16 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
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
                              className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]"
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
          </EditSection>
        )}

        <EditQuoteReasonField
          reasonValue={reasonValue}
          reasonFreeText={reasonFreeText}
          onReasonValueChange={setReasonValue}
          onReasonFreeTextChange={setReasonFreeText}
          inputClass={inputClass}
          labelClass={labelClass}
        />
      </div>

      {/* Save changes button.
          Recomputes the engine with the current form values, stamps a
          new version, and surfaces the result panel below for the
          operator to verify. No client email is sent at this step —
          that's the "Save & resend" button in the result panel. */}
      {!newQuoteResult && (
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="btn-p w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
          {generating ? "Saving…" : "Save changes & preview new pricing"}
        </button>
      )}

      {newQuoteResult && (
        <EditQuoteResultPanel
          newQuoteResult={newQuoteResult}
          newQuoteId={newQuoteId}
          oldPrice={Number(oldPrice) || null}
          newPrice={newPrice}
          linking={linking}
          onEditFurther={() => {
            setNewQuoteResult(null);
            setNewQuoteId(null);
          }}
          onSendUpdate={handleSendUpdate}
        />
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 mt-4 text-[12px] border bg-[var(--red)]/5 border-[var(--red)]/20 text-[var(--red)]">
          {error}
        </div>
      )}
        </div>
        {/* Right column: sticky live price preview.
            On lg+ screens it stays pinned just under the sticky header
            while the operator scrolls through the form sections. On
            narrow screens (below lg) the grid collapses to single-column
            and the preview renders inline above the form. */}
        <aside className="lg:sticky lg:top-[152px] space-y-4 self-start">
          <EditQuoteLivePreview
            livePreview={livePreview}
            previewLoading={previewLoading}
            oldPrice={Number(oldPrice) || 0}
            livePrice={livePrice}
          />
        </aside>
      </div>
    </div>
  );
}
