"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { toTitleCase } from "@/lib/format-text";
import { CaretDown as ChevronDown, Check, PaperPlaneTilt as Send, Eye, CircleNotch as Loader2, CaretRight as ChevronRight, SidebarSimple as PanelRightOpen, Users, Clock, Truck, Plus, Trash as Trash2, Warning } from "@phosphor-icons/react";
import InventoryInput, { type InventoryItemEntry } from "@/components/inventory/InventoryInput";

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

// ─── Constants ──────────────────────────────────

const SERVICE_TYPES = [
  { value: "local_move", label: "Residential", desc: "Local or long distance home move" },
  { value: "office_move", label: "Office / Commercial", desc: "Business, retail, salon, clinic relocation" },
  { value: "single_item", label: "Single Item", desc: "One item or small batch delivery" },
  { value: "white_glove", label: "White Glove", desc: "Premium handling, assembly, placement" },
  { value: "specialty", label: "Specialty", desc: "Art, piano, trade show, staging, estate" },
  { value: "event", label: "Event", desc: "Round-trip venue delivery, setup & teardown" },
  { value: "b2b_delivery", label: "B2B One-Off", desc: "One-off delivery from a business source" },
  { value: "labour_only", label: "Labour Only", desc: "Crew work at one location — no transit" },
] as const;

const MOVE_SIZES = [
  { value: "studio", label: "Studio" },
  { value: "1br", label: "1 Bedroom" },
  { value: "2br", label: "2 Bedroom" },
  { value: "3br", label: "3 Bedroom" },
  { value: "4br", label: "4 Bedroom" },
  { value: "5br_plus", label: "5+ Bedroom" },
  { value: "partial", label: "Partial Move" },
];

const B2B_WEIGHT_OPTIONS = [
  { value: "standard", label: "Standard (under 100 lbs)" },
  { value: "heavy", label: "Heavy (100–250 lbs)" },
  { value: "very_heavy", label: "Very Heavy (250–500 lbs)" },
  { value: "oversized_fragile", label: "Oversized / Fragile" },
];

const ACCESS_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground floor" },
  { value: "loading_dock", label: "Loading dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+)" },
  { value: "long_carry", label: "Long carry" },
  { value: "narrow_stairs", label: "Narrow stairs" },
  { value: "no_parking_nearby", label: "No parking nearby" },
];

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

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      {children}
    </div>
  );
}

function cfgNum(config: Record<string, string>, key: string, fb: number) {
  const v = config[key];
  return v !== undefined ? Number(v) : fb;
}

function parseCfgJson<T>(config: Record<string, string>, key: string, fallback: T): T {
  try { const v = config[key]; return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
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
): { curated: number; signature: number; estate: number } | null {
  if (serviceType !== "local_move" && serviceType !== "long_distance") return null;

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
  const est = roundTo(curBase * cfgNum(config, "tier_estate_multiplier", 3.15), rounding);

  return {
    curated: curBase + addonTotal,
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

export default function QuoteFormClient({
  addons: allAddons,
  config,
  itemWeights = [],
  userRole = "coordinator",
}: {
  addons: Addon[];
  config: Record<string, string>;
  itemWeights?: ItemWeight[];
  userRole?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const hubspotDealId = searchParams.get("hubspot_deal_id") || "";

  // ── Form state ────────────────────────────
  const [serviceType, setServiceType] = useState("local_move");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromAccess, setFromAccess] = useState("");
  const [toAccess, setToAccess] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState("morning");
  const [moveSize, setMoveSize] = useState("2br");
  const [clientBoxCount, setClientBoxCount] = useState("");

  const phoneInput = usePhoneInput(phone, setPhone);

  // Specialty items
  const [specialtyItems, setSpecialtyItems] = useState<{ type: string; qty: number }[]>([]);

  // Office fields
  const [sqft, setSqft] = useState("");
  const [wsCount, setWsCount] = useState("");
  const [hasIt, setHasIt] = useState(false);
  const [hasConf, setHasConf] = useState(false);
  const [hasReception, setHasReception] = useState(false);
  const [timingPref, setTimingPref] = useState("");

  // Single item fields
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("standard_furniture");
  const [itemWeight, setItemWeight] = useState("");
  const [assembly, setAssembly] = useState("None");
  const [stairCarry, setStairCarry] = useState(false);
  const [stairFlights, setStairFlights] = useState(1);
  const [numItems, setNumItems] = useState(1);

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

  // Event fields
  const [eventName, setEventName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [eventReturnDate, setEventReturnDate] = useState("");
  const [eventSetupRequired, setEventSetupRequired] = useState(false);
  const [eventSetupHours, setEventSetupHours] = useState(2);
  const [eventSetupInstructions, setEventSetupInstructions] = useState("");
  const [eventSameDay, setEventSameDay] = useState(false);
  const [eventPickupTimeAfter, setEventPickupTimeAfter] = useState("Evening 6–9 PM");
  const [eventItems, setEventItems] = useState<{ name: string; quantity: number; weight_category: "light" | "medium" | "heavy" }[]>([]);
  const [eventAdditionalServices, setEventAdditionalServices] = useState<string[]>([]);
  const [eventMulti, setEventMulti] = useState(false);
  const [eventLegs, setEventLegs] = useState<EventLegForm[]>(() => [
    { label: "Event 1", from_address: "", to_address: "", from_access: "", to_access: "", move_date: "", event_return_date: "", event_same_day: false },
    { label: "Event 2", from_address: "", to_address: "", from_access: "", to_access: "", move_date: "", event_return_date: "", event_same_day: false },
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

  // B2B One-Off fields
  const [b2bBusinessName, setB2bBusinessName] = useState("");
  const [b2bItems, setB2bItems] = useState<{ name: string; qty: number }[]>([]);
  const [b2bNewItemName, setB2bNewItemName] = useState("");
  const [b2bNewItemQty, setB2bNewItemQty] = useState(1);
  const [b2bWeightCategory, setB2bWeightCategory] = useState("standard");
  const [b2bSpecialInstructions, setB2bSpecialInstructions] = useState("");

  // Labour Only fields
  const [workAddress, setWorkAddress] = useState("");
  const [workAccess, setWorkAccess] = useState("");
  const [labourDescription, setLabourDescription] = useState("");
  const [labourCrewSize, setLabourCrewSize] = useState(2);
  const [labourHours, setLabourHours] = useState(3);
  const [labourTruckRequired, setLabourTruckRequired] = useState(false);
  const [labourVisits, setLabourVisits] = useState(1);
  const [labourSecondVisitDate, setLabourSecondVisitDate] = useState("");
  const [labourContext, setLabourContext] = useState("");

  // Custom crating (all service types — coordinator decides per quote)
  const [cratingRequired, setCratingRequired] = useState(false);
  const [cratingItems, setCratingItems] = useState<{ description: string; size: "small" | "medium" | "large" | "oversized" }[]>([]);

  // Recommended tier (coordinator judgment)
  const [recommendedTier, setRecommendedTier] = useState<"curated" | "signature" | "estate">("signature");

  // Add-ons
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(new Map());

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>([]);

  // Referral code
  const [referralCode, setReferralCode] = useState("");
  const [referralId, setReferralId] = useState<string | null>(null);
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [referralMsg, setReferralMsg] = useState("");
  const [referralDiscount, setReferralDiscount] = useState(0);

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
  const [previewOpen, setPreviewOpen] = useState(true);
  const prefillDone = useRef(false);

  // Contact search for auto-fill (same as Create Move)
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [dbContacts, setDbContacts] = useState<{ hubspot_id: string; name: string; email: string; phone: string; address: string; postal: string }[]>([]);
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

  const inventoryScore = useMemo(() => {
    return inventoryItems.reduce((sum, i) => sum + i.weight_score * i.quantity, 0);
  }, [inventoryItems]);

  const inventoryTotalItems = useMemo(() => {
    return inventoryItems.reduce((sum, i) => sum + i.quantity, 0);
  }, [inventoryItems]);

  const clientBoxCountNum = Number(clientBoxCount) || 0;
  const boxScore = clientBoxCountNum * 0.3;
  const inventoryScoreWithBoxes = inventoryScore + boxScore;

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
        if (d.moveSize) setMoveSize(d.moveSize);
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

  // ── Applicable add-ons (popular first) ────
  const applicableAddons = useMemo(
    () =>
      [...allAddons.filter((a) => a.applicable_service_types.includes(serviceType))].sort(
        (a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0),
      ),
    [allAddons, serviceType],
  );
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
  }, []);

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
  const buildPayload = useCallback(() => {
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
    };

    if (serviceType === "local_move" || serviceType === "long_distance") {
      base.move_size = moveSize;
      // Send box count when user has specified a value (including 0) so API uses it for score/labour
      if (clientBoxCount !== "" && clientBoxCount != null) base.client_box_count = Number(clientBoxCount);
      base.specialty_items = specialtyItems.length > 0 ? specialtyItems : undefined;
      if (inventoryItems.length > 0) {
        base.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
        }));
      }
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
      if (inventoryItems.length > 0) {
        base.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
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
    }
    if (serviceType === "white_glove") {
      base.item_description = itemDescription.trim() || undefined;
      base.item_category = itemCategory;
      base.item_weight_class = itemWeight || undefined;
      base.declared_value = Number(declaredValue) || undefined;
      base.stair_carry = stairCarry;
      base.stair_flights = stairFlights;
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
      const dims = [specialtyDimL, specialtyDimW, specialtyDimH].filter(Boolean);
      base.specialty_dimensions = dims.length === 3 ? `${specialtyDimL}×${specialtyDimW}×${specialtyDimH} in` : undefined;
    }
    if (serviceType === "event") {
      base.event_name = eventName.trim() || undefined;
      base.event_setup_required = eventSetupRequired;
      base.event_setup_hours = eventSetupRequired ? eventSetupHours : undefined;
      base.event_setup_instructions = eventSetupInstructions.trim() || undefined;
      base.event_items = eventItems.length > 0 ? eventItems : undefined;
      base.event_additional_services = eventAdditionalServices.length > 0 ? eventAdditionalServices : undefined;
      if (eventMulti && eventLegs.length >= 2) {
        base.event_mode = "multi";
        base.event_legs = eventLegs.map((leg) => ({
          label: leg.label.trim() || undefined,
          from_address: leg.from_address.trim(),
          to_address: leg.to_address.trim(),
          from_access: leg.from_access || undefined,
          to_access: leg.to_access || undefined,
          move_date: leg.move_date,
          event_return_date: leg.event_same_day ? leg.move_date : leg.event_return_date,
          event_same_day: leg.event_same_day,
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
        base.to_address = venueAddress || toAddress;
        base.event_return_date = eventSameDay ? moveDate : (eventReturnDate || undefined);
        base.event_same_day = eventSameDay;
        base.event_pickup_time_after = eventSameDay ? eventPickupTimeAfter : undefined;
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
    }
    if (serviceType === "b2b_delivery") {
      base.b2b_business_name = b2bBusinessName.trim() || undefined;
      base.b2b_items = b2bItems.length > 0 ? b2bItems.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`) : undefined;
      base.b2b_weight_category = b2bWeightCategory || undefined;
      base.b2b_special_instructions = b2bSpecialInstructions.trim() || undefined;
    }
    return base;
  }, [
    serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, preferredTime, arrivalWindow, hubspotDealId,
    selectedAddons, recommendedTier, moveSize, clientBoxCount, specialtyItems, inventoryItems, sqft, wsCount, hasIt, hasConf,
    hasReception, timingPref, itemDescription, itemCategory, itemWeight, assembly, stairCarry, stairFlights,
    numItems, declaredValue, specialtyType, specialtyItemDescription, specialtyWeightClass, specialtyRequirements,
    specialtyNotes, specialtyDimL, specialtyDimW, specialtyDimH,
    firstName, lastName, email, phone, cratingRequired, cratingItems,
    eventName, venueAddress, eventReturnDate, eventSetupRequired, eventSetupHours, eventSetupInstructions,
    eventSameDay, eventPickupTimeAfter, eventItems, eventAdditionalServices, eventMulti, eventLegs,
    workAddress, workAccess, labourDescription, labourCrewSize, labourHours, labourTruckRequired,
    labourVisits, labourSecondVisitDate, labourContext,
    b2bBusinessName, b2bItems, b2bWeightCategory, b2bSpecialInstructions,
  ]);

  // ── Generate quote (Step 1: creates quote in DB, returns quote_id) ────────────────────────
  const handleGenerate = async () => {
    if (serviceType === "event") {
      if (eventMulti) {
        if (eventLegs.length < 2) {
          toast("Multi-event needs at least 2 events", "alertTriangle");
          return;
        }
        for (let i = 0; i < eventLegs.length; i++) {
          const leg = eventLegs[i];
          if (!leg.from_address?.trim() || !leg.to_address?.trim() || !leg.move_date) {
            toast(`Event ${i + 1}: fill origin, venue, and delivery date`, "alertTriangle");
            return;
          }
          if (!leg.event_same_day && !leg.event_return_date?.trim()) {
            toast(`Event ${i + 1}: return date or same-day required`, "alertTriangle");
            return;
          }
        }
      } else {
        if (!fromAddress || !venueAddress || !moveDate) {
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
        toast("Please fill Work address and Move date", "alertTriangle");
        return;
      }
    } else if (serviceType === "b2b_delivery") {
      const clientName = [firstName, lastName].filter(Boolean).join(" ");
      if (!b2bBusinessName.trim() || !fromAddress || !toAddress || !moveDate) {
        toast("Please fill Business name, Pickup, Delivery address and Date", "alertTriangle");
        return;
      }
      if (!clientName.trim()) {
        toast("Please fill Contact name (First / Last)", "alertTriangle");
        return;
      }
      if (!phone?.trim()) {
        toast("Please fill Contact phone", "alertTriangle");
        return;
      }
    } else if (!fromAddress || !toAddress || !moveDate) {
      toast("Please fill addresses and move date", "alertTriangle");
      return;
    }
    setGenerating(true);
    setSendSuccess(false);
    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote generation failed");
      const id = data.quote_id ?? data.quoteId;
      if (!id) throw new Error("Generate did not return a quote_id");
      setQuoteResult(data);
      setQuoteId(id);
      toast(`Quote ${id} generated`, "check");
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
          client_name: [firstName, lastName].filter(Boolean).join(" "),
          hubspot_deal_id: hubspotDealId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      // Push quote data back to HubSpot deal (price + deal fields for left column)
      if (hubspotDealId && quoteResult) {
        const curatedTier = quoteResult.tiers?.curated ?? quoteResult.tiers?.essentials;
        const price = curatedTier?.price ?? quoteResult.custom_price?.price ?? null;
        const tax = curatedTier?.tax ?? quoteResult.custom_price?.tax ?? null;
        const total = curatedTier?.total ?? quoteResult.custom_price?.total ?? null;

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

      {hubspotBanner && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {hubspotBanner}
        </div>
      )}

      {/* Side-by-side from 480px so preview is on the right even with sidebar (no dependency on hubspot_deal_id at paint) */}
      <div className="flex flex-col min-[480px]:flex-row gap-5 relative">
        {/* ═══ LEFT PANEL — Form ═══ */}
        <div className={`flex flex-col transition-all duration-300 max-w-4xl w-full ${previewOpen ? "min-[480px]:w-[60%] min-w-0" : "min-[480px]:w-full"}`}>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-t-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--brd)]">
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Sales</p>
              <h1 className="font-heading text-[22px] font-bold text-[var(--tx)] tracking-tight leading-none">Generate Quote</h1>
              <p className="text-[11px] text-[var(--tx3)] mt-1.5">
                Fill in the details and generate a quote. The live preview updates as you type.
              </p>
            </div>

            <div className="p-5 space-y-0">
              {/* ── 1. Service type ── */}
              <div>
                <label className="block text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Service Type</label>
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
              <div className="space-y-3">
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Client</h3>
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
                              setContactSearch("");
                              setShowContactDropdown(false);
                              setDbContacts([]);
                            }}
                            className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                          >
                            {c.name}
                            {c.email && <span className="text-[var(--tx3)] ml-1">— {c.email}</span>}
                            {c.phone && <span className="text-[var(--tx3)] ml-1">— {formatPhone(c.phone)}</span>}
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
                  <Field label="First Name">
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={fieldInput} />
                  </Field>
                  <Field label="Last Name">
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={fieldInput} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" className={fieldInput} />
                  </Field>
                  <Field label="Phone">
                    <input ref={phoneInput.ref} type="tel" value={phone} onChange={phoneInput.onChange} placeholder={PHONE_PLACEHOLDER} className={fieldInput} />
                  </Field>
                </div>
              </div>

              {/* ── Referral Code ── */}
              <div className="border-t border-[var(--brd)]/30 pt-4 pb-1">
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Referral Code</h3>
                <div className="flex gap-2">
                  <input
                    value={referralCode}
                    onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus("idle"); setReferralMsg(""); }}
                    placeholder="YUGO-NAME-XXXX"
                    className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] font-mono focus:border-[var(--gold)] outline-none"
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

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 3. Addresses ── */}
              <div className="space-y-3">
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
                  {serviceType === "event" && eventMulti
                    ? "Addresses (per event below)"
                    : serviceType === "event"
                      ? "Origin"
                      : serviceType === "labour_only"
                        ? "Work Location"
                        : serviceType === "b2b_delivery"
                          ? "Pickup & Delivery"
                          : "Addresses"}
                </h3>
                {serviceType === "event" && eventMulti && (
                  <p className="text-[11px] text-[var(--tx2)] -mt-1 mb-1">
                    Each event has its own origin and venue in the Event section.
                  </p>
                )}

                {/* Event single: origin here; multi: per-leg below. Labour Only: own section. */}
                {serviceType !== "labour_only" && !(serviceType === "event" && eventMulti) && (
                <div className="flex flex-col min-[400px]:flex-row gap-3 items-end">
                  <div className="flex-1 min-w-0 w-full max-w-2xl">
                    <AddressAutocomplete
                      value={fromAddress}
                      onRawChange={setFromAddress}
                      onChange={(r) => setFromAddress(r.fullAddress)}
                      placeholder={serviceType === "event" ? "Where items come from (office/warehouse/home)" : serviceType === "b2b_delivery" ? "Pickup address" : "Origin address"}
                      label={serviceType === "event" ? "Origin Address *" : serviceType === "b2b_delivery" ? "Pickup *" : "From"}
                      required
                      className={fieldInput}
                    />
                  </div>
                  <div className="w-full min-[400px]:w-[150px] shrink-0">
                    <Field label="From Access">
                      <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={fieldInput}>
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                )}
                {serviceType !== "event" && serviceType !== "labour_only" && (
                <div className="flex flex-col min-[400px]:flex-row gap-3 items-end">
                  <div className="flex-1 min-w-0 w-full max-w-2xl">
                    <AddressAutocomplete
                      value={toAddress}
                      onRawChange={setToAddress}
                      onChange={(r) => setToAddress(r.fullAddress)}
                      placeholder="Destination address"
                      label="To"
                      required
                      className={fieldInput}
                    />
                  </div>
                  <div className="w-full min-[400px]:w-[150px] shrink-0">
                    <Field label="To Access">
                      <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={fieldInput}>
                        {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                )}
              </div>

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 4. Move details ── */}
              {/* Event and labour_only manage their own date fields */}
              {serviceType !== "event" && (
              <div>
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">
                  {serviceType === "labour_only" ? "Scheduling" : "Move Details"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label={serviceType === "labour_only" ? "Date *" : "Move Date *"}>
                    <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} required className={fieldInput} />
                  </Field>
                  <Field label="Preferred Time">
                    <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={fieldInput} />
                  </Field>
                  {serviceType !== "labour_only" && (
                  <Field label="Arrival Window">
                    <select value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className={fieldInput}>
                      <option value="morning">Morning (7 AM – 12 PM)</option>
                      <option value="afternoon">Afternoon (12 PM – 5 PM)</option>
                      <option value="full_day">Full Day (7 AM – 5 PM)</option>
                      <option value="evening">Evening (5 PM – 9 PM)</option>
                    </select>
                  </Field>
                  )}
                  {(serviceType === "local_move" || serviceType === "long_distance") && (
                    <Field label="Move Size">
                      <select value={moveSize} onChange={(e) => setMoveSize(e.target.value)} className={fieldInput}>
                        {MOVE_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                  )}
                  {serviceType === "local_move" && (
                    <Field label="Recommend Tier">
                      <div className="flex items-center gap-2">
                        <select
                          value={recommendedTier}
                          onChange={(e) => setRecommendedTier(e.target.value as "curated" | "signature" | "estate")}
                          className={`${fieldInput} w-[140px] min-w-0`}
                        >
                          <option value="curated">Curated</option>
                          <option value="signature">Signature</option>
                          <option value="estate">Estate</option>
                        </select>
                        {recommendedTier !== "estate" && (
                          <button
                            type="button"
                            onClick={() => setRecommendedTier("estate")}
                            className="text-[10px] font-semibold text-[var(--gold)] hover:text-[var(--gold2)] transition-colors whitespace-nowrap shrink-0"
                          >
                            White glove? Estate →
                          </button>
                        )}
                      </div>
                    </Field>
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
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty Items</h3>
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

              {/* ── 5b. Custom crating (all service types — coordinator decides) ── */}
              {(serviceType === "local_move" || serviceType === "long_distance" || serviceType === "white_glove" || serviceType === "specialty") && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Custom Crating</h3>
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
                                <option key={k} value={k}>{label} — ${(priceMap[k] ?? CRATING_SIZE_FALLBACK[k]).toLocaleString()}</option>
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
              {(serviceType === "local_move" || serviceType === "long_distance" || serviceType === "office_move") && itemWeights.length > 0 && (
                <>
              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />
                <InventoryInput
                  itemWeights={itemWeights as { slug: string; item_name: string; weight_score: number; category: string; room?: string; is_common: boolean; display_order?: number; active?: boolean }[]}
                  value={inventoryItems}
                  onChange={setInventoryItems}
                  moveSize={moveSize}
                  fromAccess={fromAccess}
                  toAccess={toAccess}
                  showLabourEstimate={!!moveSize}
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
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Office Details</h3>
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
                <div className="space-y-2">
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Items</h3>
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
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">White Glove — Items</h3>
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
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty Move</h3>

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
                    <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Event Details</h3>
                    <Field label="Event Name">
                      <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. L'Oréal Beauty Event" className={fieldInput} />
                    </Field>
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
                        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Venue</h3>
                        <AddressAutocomplete
                          value={venueAddress}
                          onRawChange={setVenueAddress}
                          onChange={(r) => setVenueAddress(r.fullAddress)}
                          placeholder="Restaurant XYZ, 100 King St W"
                          label="Venue / Event Address *"
                          required
                          className={fieldInput}
                        />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Delivery (Day 1)</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Delivery Date *">
                            <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} required className={fieldInput} />
                          </Field>
                          <Field label="Delivery Time">
                            <select value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className={fieldInput}>
                              <option value="morning">Morning (7 AM – 12 PM)</option>
                              <option value="afternoon">Afternoon (12 PM – 5 PM)</option>
                              <option value="evening">Evening (5 PM – 9 PM)</option>
                            </select>
                          </Field>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-medium text-[var(--tx)]">Setup Required</span>
                          <button type="button" role="switch" aria-checked={eventSetupRequired} onClick={() => setEventSetupRequired(!eventSetupRequired)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${eventSetupRequired ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${eventSetupRequired ? "translate-x-4" : ""}`} />
                          </button>
                        </div>
                        {eventSetupRequired && (
                          <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                            <Field label="Setup Duration">
                              <select value={eventSetupHours} onChange={(e) => setEventSetupHours(Number(e.target.value))} className={`${fieldInput} w-40`}>
                                <option value={1}>1 hour — $150</option>
                                <option value={2}>2 hours — $275</option>
                                <option value={3}>3 hours — $400</option>
                                <option value={99}>Half day — $600</option>
                              </select>
                            </Field>
                            <Field label="Setup Instructions">
                              <textarea value={eventSetupInstructions} onChange={(e) => setEventSetupInstructions(e.target.value)} rows={2} placeholder="Arrange display tables, hang banners, etc." className={`${fieldInput} resize-none`} />
                            </Field>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Return (Day 2+)</h3>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={eventSameDay} onChange={(e) => setEventSameDay(e.target.checked)} className="accent-[var(--gold)] w-3.5 h-3.5" />
                          <span className="text-[11px] text-[var(--tx2)]">Same Day Event — delivery and return on same day</span>
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
                              {leg.label?.trim() ? <span className="text-[var(--tx2)] font-semibold normal-case"> — {leg.label.trim()}</span> : null}
                            </span>
                            {eventLegs.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeEventLeg(idx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-red-500 border border-red-500/35 hover:bg-red-500/10"
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
                          <AddressAutocomplete
                            value={leg.to_address}
                            onRawChange={(v) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, to_address: v } : L)))}
                            onChange={(r) => setEventLegs((prev) => prev.map((L, i) => (i === idx ? { ...L, to_address: r.fullAddress } : L)))}
                            placeholder="Venue address"
                            label="Venue *"
                            required
                            className={fieldInput}
                          />
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
                        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Setup (program)</h3>
                        <p className="text-[10px] text-[var(--tx3)]">One setup fee for the bundled program (not per venue).</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-medium text-[var(--tx)]">Setup Required</span>
                          <button type="button" role="switch" aria-checked={eventSetupRequired} onClick={() => setEventSetupRequired(!eventSetupRequired)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${eventSetupRequired ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${eventSetupRequired ? "translate-x-4" : ""}`} />
                          </button>
                        </div>
                        {eventSetupRequired && (
                          <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30">
                            <Field label="Setup Duration">
                              <select value={eventSetupHours} onChange={(e) => setEventSetupHours(Number(e.target.value))} className={`${fieldInput} w-40`}>
                                <option value={1}>1 hour — $150</option>
                                <option value={2}>2 hours — $275</option>
                                <option value={3}>3 hours — $400</option>
                                <option value={99}>Half day — $600</option>
                              </select>
                            </Field>
                            <Field label="Setup Instructions">
                              <textarea value={eventSetupInstructions} onChange={(e) => setEventSetupInstructions(e.target.value)} rows={2} placeholder="Arrange display tables, hang banners, etc." className={`${fieldInput} resize-none`} />
                            </Field>
                          </div>
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
                    <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Event Items</h3>
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
                          <button type="button" onClick={() => setEventItems((prev) => prev.filter((_, i) => i !== idx))} className="text-[var(--tx3)] hover:text-red-400 text-[14px] shrink-0">×</button>
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
                    <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Additional Services</h3>
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
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Labour Only</h3>
                  <div className="flex flex-col min-[400px]:flex-row gap-3 items-end">
                    <div className="flex-1 min-w-0">
                      <AddressAutocomplete
                        value={workAddress}
                        onRawChange={setWorkAddress}
                        onChange={(r) => setWorkAddress(r.fullAddress)}
                        placeholder="55 Avenue Rd, Unit 2801"
                        label="Work Address *"
                        required
                        className={fieldInput}
                      />
                    </div>
                    <div className="w-full min-[400px]:w-[150px] shrink-0">
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
                        <option value={2}>2 movers</option>
                        <option value={3}>3 movers</option>
                        <option value={4}>4 movers</option>
                        <option value={5}>5 movers</option>
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
                        <option value="yes">Yes — truck needed</option>
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

              {/* ── B2B One-Off fields ── */}
              {serviceType === "b2b_delivery" && (
                <div className="space-y-3">
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">B2B One-Off</h3>
                  <p className="text-[10px] text-[var(--tx3)]">Contact info uses Client name, Email and Phone above.</p>
                  <Field label="Business Name *">
                    <input
                      value={b2bBusinessName}
                      onChange={(e) => setB2bBusinessName(e.target.value)}
                      placeholder="Acme Corp"
                      className={fieldInput}
                    />
                  </Field>
                  <Field label="Items">
                    <div className="space-y-2">
                      {b2bItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--tx2)] flex-1 min-w-0 truncate">{item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}</span>
                          <button type="button" onClick={() => setB2bItems((p) => p.filter((_, i) => i !== idx))} className="p-1 text-[var(--tx3)] hover:text-red-500" title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 min-w-0">
                          <input
                            value={b2bNewItemName}
                            onChange={(e) => setB2bNewItemName(e.target.value)}
                            placeholder="Item name"
                            className={fieldInput}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), b2bNewItemName.trim() && (setB2bItems((p) => [...p, { name: b2bNewItemName.trim(), qty: b2bNewItemQty }]), setB2bNewItemName(""), setB2bNewItemQty(1)))}
                          />
                        </div>
                        <div className="w-16 shrink-0">
                          <input type="number" min={1} value={b2bNewItemQty} onChange={(e) => setB2bNewItemQty(Number(e.target.value) || 1)} className={fieldInput} title="Qty" />
                        </div>
                        <button
                          type="button"
                          onClick={() => b2bNewItemName.trim() && (setB2bItems((p) => [...p, { name: b2bNewItemName.trim(), qty: b2bNewItemQty }]), setB2bNewItemName(""), setB2bNewItemQty(1))}
                          className="px-2 py-2 rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </Field>
                  <Field label="Weight Category">
                    <select value={b2bWeightCategory} onChange={(e) => setB2bWeightCategory(e.target.value)} className={fieldInput}>
                      {B2B_WEIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Special Instructions">
                    <textarea
                      value={b2bSpecialInstructions}
                      onChange={(e) => setB2bSpecialInstructions(e.target.value)}
                      rows={2}
                      placeholder="Loading dock hours, fragile handling, etc."
                      className={`${fieldInput} resize-none`}
                    />
                  </Field>
                </div>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 6. Add-ons (popular first, show all expander) ── */}
              {applicableAddons.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Add-Ons</h3>
                  {recommendedTier === "estate" && serviceType === "local_move" && (
                    <p className="text-[10px] text-[var(--tx3)] bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--brd)]">
                      Packing supplies are included with Estate. The &quot;Packing materials kit&quot; add-on is not needed.
                    </p>
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
                                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">Popular</span>
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
                                  <option key={i} value={i}>{t.label} — {fmtPrice(t.price)}</option>
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
                                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">Popular</span>
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
                                  <option key={i} value={i}>{t.label} — {fmtPrice(t.price)}</option>
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
                    <span className="text-[14px] font-bold text-[var(--gold)]">{fmtPrice(addonSubtotal)}</span>
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
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2.5 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : quoteId ? "Regenerate" : "Generate Quote"}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !quoteId || sendSuccess}
                className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold border-2 flex items-center justify-center gap-2 ${
                  sendSuccess
                    ? "border-[var(--grn)] bg-[var(--grn)]/10 text-[var(--grn)] cursor-default"
                    : "border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)]/10 disabled:opacity-40"
                }`}
              >
                {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : sendSuccess ? <>Sent ✓</> : <><Send className="w-3.5 h-3.5" /> Send Quote</>}
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

        {/* ═══ RIGHT PANEL — Live Quote Preview ═══ */}

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
                  <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">
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
                {/* ── Official result (after Generate) ── */}
                {quoteResult ? (
                  <>
                    {quoteResult.tiers ? (
                      <TiersDisplay tiers={quoteResult.tiers} recommendedTier={recommendedTier} />
                    ) : quoteResult.custom_price && serviceType === "event" ? (
                      <EventPriceDisplay price={quoteResult.custom_price} factors={quoteResult.factors as Record<string, unknown>} />
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

                    <FactorsDisplayCollapsible
                      factors={quoteResult.factors}
                      distance={quoteResult.distance_km}
                      time={quoteResult.drive_time_min}
                      showMultipliers={userRole === "owner" || userRole === "admin"}
                      tiers={quoteResult.tiers}
                      moveSize={moveSize}
                    />

                    {/* FIX 6: Algorithm anomaly warnings for coordinator review */}
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
                        <p className="font-semibold text-blue-600 dark:text-blue-400">ℹ Inventory at volume ceiling (×{Number(quoteResult.factors.inventory_max_modifier).toFixed(2)})</p>
                        <p className="mt-0.5">Price is capped — consider manual adjustment for this move.</p>
                      </div>
                    )}
                    {quoteResult.factors && typeof quoteResult.factors.labour_component === "number" && typeof quoteResult.factors.subtotal_before_labour === "number" && (quoteResult.factors.subtotal_before_labour as number) > 0 && (quoteResult.factors.labour_component as number) > 0.5 * (quoteResult.factors.subtotal_before_labour as number) && (
                      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-[var(--tx2)]">
                        <p className="font-semibold text-blue-600 dark:text-blue-400">ℹ High labour component: {fmtPrice(quoteResult.factors.labour_component as number)}</p>
                        <p className="mt-0.5">This move needs significantly more crew/time than standard.</p>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Optimistic live preview ── */
                  <>
                    {liveEstimate && "curated" in liveEstimate ? (
                      <OptimisticTiers est={liveEstimate} isLongDistance={serviceType === "long_distance"} />
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
                                ? " — calculating distance…"
                                : " — add addresses for distance adjustment"}
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

                    {addonSubtotal > 0 && (
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
                  <span className="text-[var(--tx)]">{quoteResult.distance_km ? `${quoteResult.distance_km} km` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Drive Time</span>
                  <span className="text-[var(--tx)]">{quoteResult.drive_time_min ? `${quoteResult.drive_time_min} min` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Move Date</span>
                  <span className="text-[var(--tx)]">{quoteResult.move_date || "—"}</span>
                </div>
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
                  <span className="text-[var(--tx)]">{quoteResult.labour.crewSize} movers <span className="text-[var(--tx3)]">(recommended)</span></span>
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
                {["curated", "signature", "estate"].map((pkg) => {
                  const included = { curated: "Released Value", signature: "Enhanced Value", estate: "Full Replacement" }[pkg] ?? pkg;
                  const upgrade = quoteResult.valuation?.upgrades?.[pkg];
                  return (
                    <div key={pkg} className="flex items-center justify-between">
                      <span className="text-[var(--tx3)] capitalize">{pkg}</span>
                      <span className="text-[var(--tx)]">
                        {included}
                        {upgrade ? <span className="text-[var(--gold)] ml-1">(+{fmtPrice(upgrade.price)} upgrade)</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

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
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────

function TiersDisplay({ tiers, recommendedTier = "signature" }: { tiers: Record<string, TierResult>; recommendedTier?: string }) {
  const tierOrder = ["curated", "signature", "estate"] as const;
  const tierColors: Record<string, { bg: string; border: string; accent: string }> = {
    curated: { bg: "bg-[var(--bg)]", border: "border-[var(--brd)]", accent: "text-[var(--tx)]" },
    signature: { bg: "bg-[#FAF7F2] dark:bg-[#2A2520]", border: "border-2 border-[#B8962E]/40 border-l-4 border-l-[var(--gold)]", accent: "text-[#B8962E]" },
    estate: { bg: "bg-[#1a1a2e] dark:bg-[#1a1a2e]", border: "border-[#C9A84C]/60", accent: "text-[#C9A84C]" },
  };
  const tierLabels: Record<string, string> = { curated: "Curated", signature: "Signature", estate: "Estate" };

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
                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                    Recommended
                  </span>
                )}
              </div>
              <span className={`text-3xl font-black tabular-nums ${c.accent}`}>{fmtPrice(t.price)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--tx3)]">
              <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
              <span className="font-bold text-[var(--tx)]">Total: {fmtPrice(t.total)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--tx3)]">Deposit to book</span>
              <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
            </div>
            {t.includes.length > 0 && (
              <details className="group">
                <summary className="text-[9px] font-bold uppercase text-[var(--tx3)] cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
                  What&apos;s included ▾
                </summary>
                <ul className="mt-1.5 space-y-0.5 pl-5">
                  {t.includes.map((inc, i) => (
                    <li key={i} className="text-[10px] text-[var(--tx2)] flex items-start gap-1.5">
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
        <span className="text-[13px] font-bold text-[#B8962E] capitalize">{label}</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--tx3)]">
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className="font-bold text-[var(--tx)]">Total: {fmtPrice(t.total)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--tx3)]">Deposit to book</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
      {t.includes.length > 0 && (
        <details className="group">
          <summary className="text-[9px] font-bold uppercase text-[var(--tx3)] cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
            What&apos;s included ▾
          </summary>
          <ul className="mt-1.5 space-y-0.5 pl-5">
            {t.includes.map((inc, i) => (
              <li key={i} className="text-[10px] text-[var(--tx2)] flex items-start gap-1.5">
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
  delivery_date?: string;
  return_date?: string;
  delivery_charge?: number;
  return_charge?: number;
  event_crew?: number;
  event_hours?: number;
  same_day?: boolean;
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
      <div className="pt-1.5 border-t border-[var(--brd)]/50 flex justify-between font-semibold">
        <span className="text-[var(--tx3)]">Subtotal</span>
        <span className="text-[var(--tx)]">{fmtPrice(t.price)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--tx3)]">
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className="font-bold text-[var(--tx)]">Total: {fmtPrice(t.total)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--tx3)]">Deposit to book (25%)</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
    </>
  );

  if (isMulti && eventLegs.length > 0) {
    return (
      <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[13px] font-bold text-[#B8962E]">Event quote</span>
            <p className="text-[9px] text-[var(--tx3)] mt-0.5 font-medium uppercase tracking-wide">
              Multi-event bundle — {eventLegs.length} round trip{eventLegs.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-[#B8962E] shrink-0">
            {fmtPrice(t.price)}
          </span>
        </div>
        <div className="space-y-3 text-[11px]">
          {eventLegs.map((leg, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)]/40 p-3 space-y-2"
            >
              <p className="text-[9px] font-bold tracking-wider uppercase text-[#B8962E]">
                {leg.label?.trim() || `Event ${idx + 1}`}
              </p>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--tx3)]">
                  Delivery ({fmtShortEventAdmin(leg.delivery_date)})
                  {leg.event_crew && leg.event_hours ? (
                    <span className="ml-1 text-[var(--tx3)]/70">
                      {leg.event_crew} movers, {leg.event_hours}hr
                    </span>
                  ) : null}
                </span>
                <span className="font-medium text-[var(--tx)] tabular-nums shrink-0">
                  {fmtPrice(leg.delivery_charge ?? 0)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--tx3)]">
                  Return ({fmtShortEventAdmin(leg.return_date)})
                  {returnDiscount !== undefined ? (
                    <span className="ml-1 text-[var(--tx3)]/70">
                      {Math.round(returnDiscount * 100)}% of leg delivery
                    </span>
                  ) : null}
                </span>
                <span className="font-medium text-[var(--tx)] tabular-nums shrink-0">
                  {fmtPrice(leg.return_charge ?? 0)}
                </span>
              </div>
            </div>
          ))}
          {(setupFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--tx3)]">Setup service (program)</span>
              <span className="font-medium text-[var(--tx)]">{fmtPrice(setupFee!)}</span>
            </div>
          )}
        </div>
        {totalsFooter}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E]">Event Quote</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      {/* Breakdown — single round trip */}
      <div className="space-y-1.5 text-[11px]">
        {deliveryCharge !== undefined && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">
              Delivery ({deliveryDate ?? "TBD"})
              {eventCrew && eventHours ? <span className="ml-1 text-[var(--tx3)]/70">{eventCrew} movers, {eventHours}hr</span> : null}
            </span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(deliveryCharge)}</span>
          </div>
        )}
        {(setupFee ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Setup service</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(setupFee!)}</span>
          </div>
        )}
        {returnCharge !== undefined && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">
              Return ({returnDate ?? "TBD"})
              {returnDiscount !== undefined ? <span className="ml-1 text-[var(--tx3)]/70">{Math.round(returnDiscount * 100)}% of delivery</span> : null}
            </span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(returnCharge)}</span>
          </div>
        )}
        {totalsFooter}
      </div>
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

  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E]">B2B One-Off</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {baseFee !== undefined && distMod !== undefined && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Base ${baseFee} × {distMod.toFixed(2)} (distance)</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(Math.round(baseFee * distMod))}</span>
          </div>
        )}
        {accessSurcharge > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Access surcharge</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(accessSurcharge)}</span>
          </div>
        )}
        {weightSurcharge > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Weight ({weightCategory ?? "—"})</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(weightSurcharge)}</span>
          </div>
        )}
        {distKm !== undefined && distKm > 0 && (
          <div className="text-[var(--tx3)]">{distKm.toFixed(1)} km</div>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--tx3)]">
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className="font-bold text-[var(--tx)]">Total: {fmtPrice(t.total)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--tx3)]">Deposit to book</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
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

  return (
    <div className="rounded-xl border-2 border-[#B8962E]/40 bg-[#FAF7F2] dark:bg-[#2A2520] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#B8962E]">Labour Only</span>
        <span className="text-3xl font-black tabular-nums text-[#B8962E]">{fmtPrice(t.price)}</span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {crewSize && hours && labourRate && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">{crewSize} movers × {hours}hr × ${labourRate}/hr</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(crewSize * hours * labourRate)}</span>
          </div>
        )}
        {truckFee > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Truck</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(truckFee)}</span>
          </div>
        )}
        {accessSurcharge > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Access surcharge</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(accessSurcharge)}</span>
          </div>
        )}
        {visits >= 2 && visit2Price !== undefined && (
          <div className="flex justify-between">
            <span className="text-[var(--tx3)]">Visit 2 ({visit2Date ?? "TBD"}) — return discount</span>
            <span className="font-medium text-[var(--tx)]">{fmtPrice(visit2Price)}</span>
          </div>
        )}
        {visits >= 2 && visit1Price !== undefined && (
          <div className="pt-1 border-t border-[var(--brd)]/50 flex justify-between font-semibold">
            <span className="text-[var(--tx3)]">Subtotal</span>
            <span className="text-[var(--tx)]">{fmtPrice(t.price)}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--tx3)]">
        <span>HST ({(TAX_RATE * 100).toFixed(0)}%): {fmtPrice(t.tax)}</span>
        <span className="font-bold text-[var(--tx)]">Total: {fmtPrice(t.total)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--tx3)]">Deposit to book</span>
        <span className="font-bold text-[var(--gold)]">{fmtPrice(t.deposit)}</span>
      </div>
    </div>
  );
}

function OptimisticTiers({ est, isLongDistance }: { est: { curated: number; signature: number; estate: number }; isLongDistance?: boolean }) {
  const tiers = [
    { name: "Curated", price: est.curated },
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
          ? "Drive time not included — generate for exact long-distance pricing"
          : "Estimate only — generate quote for exact pricing with distance factor"}
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
  curatedPrice,
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

  const Row = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="flex items-start justify-between gap-2 py-1">
      <div>
        <span className="text-[10px] text-[var(--tx2)]">{label}</span>
        {sub && <p className="text-[9px] text-[var(--tx3)]">{sub}</p>}
      </div>
      <span className="text-[10px] text-right shrink-0">{value}</span>
    </div>
  );

  const Divider = () => <div className="border-t border-[var(--brd)] my-1" />;

  return (
    <div className="space-y-0.5 text-[10px]">
      {/* Distance & time */}
      {distance != null && (
        <Row label="Distance" value={<span className="text-[var(--tx)] font-medium">{distance} km ({time ?? "—"} min)</span>} />
      )}

      {/* Multiplicative chain */}
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] pt-1">Pricing factors</p>
      <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] divide-y divide-[var(--brd)]">
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
            sub={invScore != null && invBenchmark != null ? `score ${invScore.toFixed(1)} / benchmark ${invBenchmark.toFixed(1)} — ${invLabel}` : invLabel}
          />
        )}
        {distMod !== null && (
          <Row label="Distance modifier" value={fmtMod(distMod)} sub={distLabel} />
        )}
        {dateMult !== null && (
          <Row label="Date factor" value={fmtMod(dateMult)} />
        )}
        {neighMult !== null && (
          <Row label="Neighbourhood tier" value={fmtMod(neighMult)} sub={neighTier ?? undefined} />
        )}
        {subtotalPre !== null && (
          <>
            <Divider />
            <Row
              label="Subtotal (multiplied)"
              value={<span className="font-bold text-[var(--tx)]">{fmtPrice(subtotalPre)}</span>}
            />
          </>
        )}
      </div>

      {/* Flat additions */}
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] pt-2">Flat additions</p>
      <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] divide-y divide-[var(--brd)]">
        <Row
          label="Access surcharge"
          value={accessSurch > 0
            ? <span className="font-semibold text-amber-600">+{fmtPrice(accessSurch)}</span>
            : <span className="text-[var(--tx3)]">$0 — no hard access</span>}
        />
        {specialtySurch > 0 && (
          <Row label="Specialty surcharge" value={<span className="font-semibold text-amber-600">+{fmtPrice(specialtySurch)}</span>} />
        )}
        <Row
          label="Labour delta"
          value={labourDelta != null && labourDelta > 0
            ? <span className="font-semibold text-[var(--gold)]">+{fmtPrice(labourDelta)}</span>
            : <span className="text-[var(--tx3)]">$0 — below baseline{labourDelta === 0 && labourMH != null ? ` (${labourMH} extra hr)` : ""}</span>}
          sub={labourDelta != null && labourDelta > 0 && labourMH != null && labourRate != null
            ? `${labourMH} extra man-hours × $${labourRate}/hr`
            : undefined}
        />
        <Row
          label="Deadhead surcharge"
          value={deadheadSurch > 0
            ? <span className="font-semibold text-amber-600">+{fmtPrice(deadheadSurch)}</span>
            : <span className="text-[var(--tx3)]">$0{deadheadKm > 0 ? ` (${deadheadKm.toFixed(1)}km — within free zone)` : ""}</span>}
        />
        {cratingTotal > 0 && (
          <Row label="Custom crating" value={<span className="font-semibold text-amber-600">+{fmtPrice(cratingTotal)}</span>} />
        )}
        {packingSupplies != null && packingSupplies > 0 && (
          <Row label="Packing supplies (Estate)" value={<span className="text-[var(--tx)]">+{fmtPrice(packingSupplies)}</span>} />
        )}
      </div>

      {/* Tier formula summary */}
      {curatedPrice != null && (
        <>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] pt-2">Tier prices</p>
          <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] divide-y divide-[var(--brd)]">
            <Row label="Curated (×1.0)" value={<span className="font-bold text-[var(--tx)]">{fmtPrice(curatedPrice)}</span>} />
            {signaturePrice != null && (
              <Row label="Signature (×1.50)" value={<span className="font-bold text-[#B8962E]">{fmtPrice(signaturePrice)}</span>} />
            )}
            {estatePrice != null && (
              <Row label="Estate (×3.15)" value={<span className="font-bold text-[#C9A84C]">{fmtPrice(estatePrice)}</span>} />
            )}
          </div>
        </>
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
            curatedPrice={tiers?.curated?.price}
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
  ]);
  const entries = Object.entries(factors).filter(
    ([key, v]) => !HIDDEN_KEYS.has(key) && v !== null && v !== undefined && v !== 0 && v !== 1
  );
  const labourDelta = typeof factors.labour_delta === "number" ? factors.labour_delta
    : typeof factors.labour_component === "number" ? factors.labour_component : null;
  const labourExtraManHours = typeof factors.labour_extra_man_hours === "number" ? factors.labour_extra_man_hours : null;
  const labourRate = typeof factors.labour_rate_per_mover_hour === "number" ? factors.labour_rate_per_mover_hour : null;

  return (
    <div className="space-y-1.5">
      {distance != null && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">Distance</span>
          <span className="text-[var(--tx)] font-medium">{distance} km ({time ?? "—"} min)</span>
        </div>
      )}
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
  if (!expiresAt) return <span className="text-[var(--tx)]">—</span>;
  const exp = new Date(expiresAt);
  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
  const dateStr = exp.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  if (daysLeft <= 0) return <span className="text-[var(--red)] font-semibold">Expired</span>;
  if (daysLeft <= 2) return <span className="text-[var(--red)] font-semibold">Expires {dateStr}</span>;
  return <span className="text-[var(--tx)]">Expires in {daysLeft} days</span>;
}
