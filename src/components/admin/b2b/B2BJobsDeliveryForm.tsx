"use client";

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  applyHubSpotSuggestRow,
  useHubSpotContactSuggest,
  type HubSpotSuggestField,
  type HubSpotSuggestRow,
} from "@/hooks/useHubSpotContactSuggest";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formatNumberInput, formatCurrency, parseNumberInput } from "@/lib/format-currency";
import MultiStopAddressField, { type StopEntry } from "@/components/ui/MultiStopAddressField";
import DraftBanner from "@/components/ui/DraftBanner";
import { Plus, Trash as Trash2, SpinnerGap, ArrowSquareOut } from "@phosphor-icons/react";
import { parseB2BJobsFieldVisibility, b2bJobsFieldVisible } from "@/lib/b2b-jobs-field-visibility";
import { b2bJobsDimensionalStops } from "@/lib/b2b-jobs-route-helpers";
import { resolveB2bItemConfig } from "@/lib/b2b-bundle-line-items";
import { B2bQuickAddIcon } from "@/components/admin/b2b/b2b-quick-add-icon";
import {
  b2bVerticalComplexityKeys,
  b2bVerticalShowsLineField,
  b2bComplexityVisibilityKey,
  b2bVerticalQuickAddPresets,
  type B2bQuickAddPreset,
} from "@/lib/b2b-vertical-ui";
import {
  calculateB2BDimensionalPrice,
  isMoveDateWeekend,
  type DeliveryVerticalRow,
  type B2BDimensionalQuoteInput,
  type B2BQuoteLineItem,
} from "@/lib/pricing/b2b-dimensional";
import { getMultiStopDrivingDistance } from "@/lib/mapbox/driving-distance";
import { mergedRatesWithBundleTiers, prepareB2bLineItemsForDimensionalEngine } from "@/lib/b2b-dimensional-quote-prep";

const fieldInput = "field-input-compact w-full";

export type B2BVerticalOption = {
  code: string;
  name: string;
  pricing_method: string;
  base_rate: number;
  default_config: Record<string, unknown>;
};

export type B2BJobsOrg = {
  id: string;
  name: string;
  type?: string | null;
};

export type B2BJobsCrew = {
  id: string;
  name: string;
  members?: string[];
};

const LINE_WEIGHT_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "extra_heavy", label: "Extra Heavy" },
] as const;

const HANDLING_OPTIONS = [
  { value: "threshold", label: "Threshold (front door / lobby)" },
  { value: "room_placement", label: "Room of choice" },
  { value: "white_glove", label: "White glove (unpack, place, debris)" },
  { value: "carry_in", label: "Carry in (per unit)" },
  { value: "hand_bomb", label: "Hand bomb (individual carry)" },
  { value: "skid_drop", label: "Skid drop" },
];

const ACCESS_OPTIONS = [
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground Floor" },
  { value: "loading_dock", label: "Loading Dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+ floor)" },
  { value: "long_carry", label: "Long Carry" },
  { value: "narrow_stairs", label: "Narrow Stairs" },
  { value: "no_parking_nearby", label: "No Parking Nearby" },
];

const TIME_WINDOW_OPTIONS = ["Morning (7 AM – 12 PM)", "Afternoon (12 PM – 5 PM)", "Full Day (7 AM – 5 PM)"];

const TRUCK_OPTIONS = ["sprinter", "16ft", "20ft", "24ft", "26ft"] as const;

const TAX_RATE_CLIENT = 0.13;
const ROUNDING_NEAREST_CLIENT = 25;

function roundToNearest(amount: number, nearest: number): number {
  if (!nearest || nearest <= 0) return Math.round(amount * 100) / 100;
  return Math.round(amount / nearest) * nearest;
}

function b2bOptionToVerticalRow(v: B2BVerticalOption): DeliveryVerticalRow {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      {children}
    </div>
  );
}

const FLOORING_UNIT_OPTIONS = [
  { value: "box", label: "Box" },
  { value: "roll", label: "Roll" },
  { value: "bundle", label: "Bundle" },
  { value: "piece", label: "Piece" },
  { value: "bag", label: "Bag" },
  { value: "pallet", label: "Pallet" },
  { value: "unit", label: "Unit" },
] as const;

type LineRow = {
  description: string;
  quantity: number;
  weight_category: (typeof LINE_WEIGHT_OPTIONS)[number]["value"];
  fragile: boolean;
  unit_type?: string;
  stop_assignment?: string;
  serial_number?: string;
  declared_value?: string;
  crating_required?: boolean;
  hookup_required?: boolean;
  haul_away_line?: boolean;
  line_assembly_required?: boolean;
};

export type B2BJobsLineRow = LineRow;

export type B2BJobsEmbedSnapshot = {
  businessName: string;
  verticalCode: string;
  lines: B2BJobsLineRow[];
  handlingType: string;
  pickupAddress: string;
  deliveryAddress: string;
  extraPickupAddresses: string[];
  extraDeliveryAddresses: string[];
  pickupAccess: string;
  deliveryAccess: string;
  partnerOrgId: string;
  timeSensitive: boolean;
  assemblyRequired: boolean;
  debrisRemoval: boolean;
  stairsFlights: string;
  highValue: boolean;
  artwork: boolean;
  antiques: boolean;
  skidCount: string;
  boxCount: string;
  totalLoadWeightLbs: string;
  haulAwayUnits: string;
  returnsPickup: boolean;
  sameDay: boolean;
};

function lineAnnotationsBlock(rows: LineRow[]): string | null {
  const lines: string[] = [];
  for (const r of rows) {
    const parts: string[] = [];
    if (r.stop_assignment?.trim()) parts.push(`Stop assignment: ${r.stop_assignment.trim()}`);
    if (r.serial_number?.trim()) parts.push(`Serial: ${r.serial_number.trim()}`);
    if (r.declared_value?.trim()) parts.push(`Declared value: ${r.declared_value.trim()}`);
    if (r.hookup_required) parts.push("Hook-up required");
    if (r.haul_away_line) parts.push("Haul-away old unit");
    if (r.line_assembly_required) parts.push("Line item assembly");
    if (r.crating_required) parts.push("Crating required");
    if (parts.length) lines.push(`${r.description}${r.quantity > 1 ? ` ×${r.quantity}` : ""}: ${parts.join("; ")}`);
  }
  if (lines.length === 0) return null;
  return ["Item details", ...lines.map((l) => `• ${l}`)].join("\n");
}

function toB2bLinePayload(l: LineRow, handlingType: string): Record<string, unknown> {
  return {
    description: l.description,
    quantity: l.quantity,
    weight_category: l.weight_category,
    fragile: l.fragile,
    handling_type: handlingType,
    ...(l.unit_type ? { unit_type: l.unit_type } : {}),
    ...(l.serial_number?.trim() ? { serial_number: l.serial_number.trim() } : {}),
    ...(l.stop_assignment?.trim() ? { stop_assignment: l.stop_assignment.trim() } : {}),
    ...(l.declared_value?.trim() ? { declared_value: l.declared_value.trim() } : {}),
    ...(l.crating_required ? { crating_required: true } : {}),
    ...(l.hookup_required ? { hookup_required: true } : {}),
    ...(l.haul_away_line ? { haul_away: true } : {}),
    ...(l.line_assembly_required ? { assembly_required: true } : {}),
  };
}

interface HubSpotContact {
  hubspot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  deal_ids: string[];
}

type HubSpotMatchKind = "email" | "phone" | "company_name" | "company";

export type B2BJobsDeliveryFormProps = {
  crews?: B2BJobsCrew[];
  organizations?: B2BJobsOrg[];
  verticals?: B2BVerticalOption[];
  /** When true, render compact header (embedded in Generate Quote). */
  embed?: boolean;
  /** Sync dimensional state to parent (Generate Quote sidebar + submit payload). */
  onEmbedStateChange?: (state: B2BJobsEmbedSnapshot) => void;
};

export default function B2BJobsDeliveryForm({
  crews = [],
  organizations = [],
  verticals = [],
  embed = false,
  onEmbedStateChange,
}: B2BJobsDeliveryFormProps) {
  const router = useRouter();
  const embedCbRef = useRef(onEmbedStateChange);
  embedCbRef.current = onEmbedStateChange;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const contactPhoneInput = usePhoneInput(contactPhone, setContactPhone);

  const [applyPartnerRates, setApplyPartnerRates] = useState(true);
  const [partnerOrgId, setPartnerOrgId] = useState("");

  const [verticalCode, setVerticalCode] = useState(() => verticals[0]?.code ?? "");
  const lastVerticalForItemsRef = useRef<string | null>(null);

  const [hsLookupState, setHsLookupState] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [hsPendingMatch, setHsPendingMatch] = useState<{ contact: HubSpotContact; match_kind: HubSpotMatchKind } | null>(
    null,
  );
  const formSnapshotRef = useRef({ businessName: "", contactName: "", contactPhone: "", contactEmail: "" });
  const dedupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hsSuggestActive, setHsSuggestActive] = useState<HubSpotSuggestField | null>(null);
  const hsSuggestQuery = useMemo(() => {
    if (hsSuggestActive === "business") return businessName;
    if (hsSuggestActive === "contact") return contactName;
    if (hsSuggestActive === "email") return contactEmail;
    if (hsSuggestActive === "phone") return contactPhone;
    return "";
  }, [hsSuggestActive, businessName, contactName, contactEmail, contactPhone]);

  const applyHubSpotSuggestionPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.businessName) setBusinessName(a.businessName);
    if (a.contactName) setContactName(a.contactName);
    if (a.email) setContactEmail(a.email);
    if (a.phoneFormatted) setContactPhone(a.phoneFormatted);
    setHsPendingMatch(null);
    setHsLookupState("idle");
  }, []);

  const hsSuggest = useHubSpotContactSuggest({
    query: hsSuggestQuery,
    activeField: hsSuggestActive,
    setActiveField: setHsSuggestActive,
    onPick: applyHubSpotSuggestionPick,
  });

  formSnapshotRef.current = { businessName, contactName, contactPhone, contactEmail };

  const clearHubSpotMatch = useCallback(() => {
    setHsLookupState("idle");
    setHsPendingMatch(null);
  }, []);

  useEffect(() => () => {
    if (dedupTimerRef.current) clearTimeout(dedupTimerRef.current);
  }, []);

  const runHubSpotDedup = useCallback(async () => {
    const snap = formSnapshotRef.current;
    const email = snap.contactEmail.trim().toLowerCase();
    const hasEmail = email.includes("@");
    const digits = normalizePhone(snap.contactPhone);
    const hasPhone = digits.length === 10;
    const biz = snap.businessName.trim();
    const cn = snap.contactName.trim();
    const hasCompanyAndName = biz.length >= 2 && cn.length >= 2;
    const hasCompanyLoose = biz.length >= 3;

    if (!hasEmail && !hasPhone && !hasCompanyAndName && !hasCompanyLoose) {
      setHsLookupState("idle");
      return;
    }

    setHsLookupState("loading");
    setHsPendingMatch(null);

    try {
      const res = await fetch("/api/hubspot/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: hasEmail ? email : undefined,
          phone: hasPhone ? snap.contactPhone : undefined,
          company: biz || undefined,
          contact_name: cn || undefined,
        }),
      });
      const data = await res.json();
      const contact: HubSpotContact | null = data.contact ?? null;
      const match_kind = data.match_kind as HubSpotMatchKind | undefined;

      if (!contact) {
        setHsLookupState("not_found");
        return;
      }

      setHsLookupState("found");
      setHsPendingMatch({ contact, match_kind: match_kind ?? "email" });
    } catch {
      setHsLookupState("idle");
    }
  }, []);

  const scheduleHubSpotDedup = useCallback(() => {
    if (dedupTimerRef.current) clearTimeout(dedupTimerRef.current);
    dedupTimerRef.current = setTimeout(() => {
      dedupTimerRef.current = null;
      void runHubSpotDedup();
    }, 400);
  }, [runHubSpotDedup]);

  const applyHubSpotContactFromMatch = useCallback((contact: HubSpotContact) => {
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    if (contact.company?.trim()) setBusinessName(contact.company.trim());
    if (fullName) setContactName(fullName);
    if (contact.phone?.trim()) setContactPhone(formatPhone(contact.phone));
    if (contact.email?.trim()) setContactEmail(contact.email.trim().toLowerCase());
    setHsPendingMatch(null);
    setHsLookupState("idle");
  }, []);

  const selectedVertical = useMemo(
    () => verticals.find((v) => v.code === verticalCode) ?? null,
    [verticals, verticalCode],
  );

  const fieldVisibility = useMemo(
    () => parseB2BJobsFieldVisibility(selectedVertical?.default_config),
    [selectedVertical],
  );

  const itemConfig = useMemo(
    () => resolveB2bItemConfig(selectedVertical?.default_config, verticalCode),
    [selectedVertical, verticalCode],
  );

  const vis = useCallback((key: string) => b2bJobsFieldVisible(fieldVisibility, key), [fieldVisibility]);

  /** Complexity keys allowed for this vertical, then DB field_visibility. */
  const cmpVis = useCallback(
    (productKey: string) => {
      if (!b2bVerticalComplexityKeys(verticalCode).includes(productKey)) return false;
      return vis(b2bComplexityVisibilityKey(productKey));
    },
    [verticalCode, vis],
  );

  const showItemField = useCallback(
    (key: string) => {
      if (!b2bVerticalShowsLineField(verticalCode, key)) return false;
      if (!itemConfig?.showFields?.length) return true;
      return (itemConfig.showFields as string[]).includes(key);
    },
    [verticalCode, itemConfig?.showFields],
  );

  useEffect(() => {
    const dh = fieldVisibility?.defaultHandling;
    if (dh) setHandlingType(dh.toLowerCase());
  }, [verticalCode, fieldVisibility?.defaultHandling]);

  useEffect(() => {
    setNewStopAssignment("");
    setNewSerialNumber("");
    setNewDeclaredValue("");
    setNewHookupRequired(false);
    setNewHaulAwayLine(false);
    setNewCratingRequired(false);
    setNewLineAssemblyRequired(false);
    setNewUnitType("box");
    if (lastVerticalForItemsRef.current !== null && lastVerticalForItemsRef.current !== verticalCode) {
      setLines([]);
      setBoxCount("");
    }
    lastVerticalForItemsRef.current = verticalCode;
  }, [verticalCode]);

  const [pickupAddress, setPickupAddress] = useState("");
  const [extraPickupStops, setExtraPickupStops] = useState<StopEntry[]>([]);
  const [pickupAccess, setPickupAccess] = useState("loading_dock");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [extraDeliveryStops, setExtraDeliveryStops] = useState<StopEntry[]>([]);
  const [deliveryAccess, setDeliveryAccess] = useState("elevator");

  const [lines, setLines] = useState<LineRow[]>([]);
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newWeight, setNewWeight] = useState<(typeof LINE_WEIGHT_OPTIONS)[number]["value"]>("light");
  const [newFragile, setNewFragile] = useState(false);
  const [newUnitType, setNewUnitType] = useState<string>("box");
  const [newStopAssignment, setNewStopAssignment] = useState("");
  const [newSerialNumber, setNewSerialNumber] = useState("");
  const [newDeclaredValue, setNewDeclaredValue] = useState("");
  const [newHookupRequired, setNewHookupRequired] = useState(false);
  const [newHaulAwayLine, setNewHaulAwayLine] = useState(false);
  const [newCratingRequired, setNewCratingRequired] = useState(false);
  const [newLineAssemblyRequired, setNewLineAssemblyRequired] = useState(false);

  const [handlingType, setHandlingType] = useState("threshold");
  const [scheduledDate, setScheduledDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [timeSensitive, setTimeSensitive] = useState(false);
  const [accessNotes, setAccessNotes] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [crewOverride, setCrewOverride] = useState<string>("");
  const [truckOverride, setTruckOverride] = useState<string>("");
  const [hoursOverride, setHoursOverride] = useState<string>("");

  const [assemblyRequired, setAssemblyRequired] = useState(false);
  const [debrisRemoval, setDebrisRemoval] = useState(false);
  const [stairsFlights, setStairsFlights] = useState("");
  const [highValue, setHighValue] = useState(false);
  const [artwork, setArtwork] = useState(false);
  const [antiques, setAntiques] = useState(false);
  const [skidCount, setSkidCount] = useState("");
  const [boxCount, setBoxCount] = useState("");
  const [totalLoadWeightLbs, setTotalLoadWeightLbs] = useState("");
  const [haulAwayUnits, setHaulAwayUnits] = useState("");
  const [returnsPickup, setReturnsPickup] = useState(false);
  const [sameDay, setSameDay] = useState(false);
  const [chainOfCustodyNotes, setChainOfCustodyNotes] = useState("");
  const [hookupNotes, setHookupNotes] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"card" | "invoice">("card");
  const [invoiceTerms, setInvoiceTerms] = useState<"on_completion" | "net_15" | "net_30">("on_completion");

  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [crewId, setCrewId] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [clientDistanceLoading, setClientDistanceLoading] = useState(false);
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState<number | null>(null);
  type B2bPriceBlock = {
    rounded_pre_tax: number;
    hst: number;
    total_with_tax: number;
    breakdown: { label: string; amount: number }[];
    truck: string;
    crew: number;
    estimated_hours: number;
    access_surcharge: number;
  };
  const [clientEstimate, setClientEstimate] = useState<B2bPriceBlock | null>(null);
  const [serverPricing, setServerPricing] = useState<B2bPriceBlock | null>(null);

  const effectiveOrgId = applyPartnerRates && partnerOrgId.trim() ? partnerOrgId.trim() : null;

  const buildEffectiveLines = useCallback((): LineRow[] => {
    if (lines.length > 0) return lines;
    const bc = parseInt(boxCount, 10);
    if (verticalCode === "flooring" && vis("box_count") && bc >= 1) {
      return [
        {
          description: "Flooring / building materials",
          quantity: bc,
          weight_category: "medium",
          fragile: false,
          unit_type: "box",
        },
      ];
    }
    return [];
  }, [lines, boxCount, vis, verticalCode]);

  const showUnitTypeColumn = verticalCode === "flooring" && showItemField("unit_type");

  const showLineDetailFields =
    showItemField("stop_assignment") ||
    showItemField("serial_number") ||
    showItemField("declared_value") ||
    showItemField("crating_required") ||
    showItemField("hookup_required") ||
    showItemField("haul_away_old") ||
    showItemField("assembly_required");

  const quickAddPresets = useMemo((): B2bQuickAddPreset[] => {
    const v = b2bVerticalQuickAddPresets(verticalCode);
    if (v.length > 0) return v;
    const q = itemConfig?.quickAdd;
    if (Array.isArray(q) && q.length > 0) {
      return q.map((p) => ({
        name: p.name,
        weight: ((p.weight as B2bQuickAddPreset["weight"]) || "medium") as B2bQuickAddPreset["weight"],
        fragile: p.fragile,
        unit: p.unit,
        icon: p.icon,
      }));
    }
    return [];
  }, [verticalCode, itemConfig?.quickAdd]);

  const runPricingPreview = useCallback(async () => {
    const effLines = buildEffectiveLines();
    if (
      !verticalCode.trim() ||
      !pickupAddress.trim() ||
      !deliveryAddress.trim() ||
      effLines.length === 0
    ) {
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/b2b-delivery/pricing-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical_code: verticalCode,
          organization_id: effectiveOrgId,
          scheduled_date: scheduledDate,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          pickup_access: pickupAccess,
          delivery_access: deliveryAccess,
          extra_pickup_addresses: extraPickupStops.map((s) => s.address).filter(Boolean),
          extra_delivery_addresses: extraDeliveryStops.map((s) => s.address).filter(Boolean),
          handling_type: handlingType,
          line_items: effLines.map((l) => toB2bLinePayload(l, handlingType)),
          crew_override: crewOverride ? Number(crewOverride) : undefined,
          truck_override: truckOverride || undefined,
          estimated_hours_override: hoursOverride ? Number(hoursOverride) : undefined,
          time_sensitive: timeSensitive,
          assembly_required: assemblyRequired,
          debris_removal: debrisRemoval,
          stairs_flights: stairsFlights ? Number(stairsFlights) : undefined,
          complexity_addons: [
            ...(highValue ? ["high_value"] : []),
            ...(artwork ? ["artwork"] : []),
            ...(antiques ? ["antiques"] : []),
          ],
          skid_count: skidCount ? Number(skidCount) : undefined,
          total_load_weight_lbs: totalLoadWeightLbs ? Number(totalLoadWeightLbs) : undefined,
          haul_away_units: haulAwayUnits ? Number(haulAwayUnits) : undefined,
          returns_pickup: returnsPickup,
          same_day: sameDay,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setServerPricing({
          rounded_pre_tax: data.rounded_pre_tax,
          hst: data.hst,
          total_with_tax: data.total_with_tax,
          breakdown: data.breakdown ?? [],
          truck: data.truck,
          crew: data.crew,
          estimated_hours: data.estimated_hours,
          access_surcharge: data.access_surcharge ?? 0,
        });
      }
    } catch {
      /* Keep client estimate on network failure */
    } finally {
      setPreviewLoading(false);
    }
  }, [
    verticalCode,
    pickupAddress,
    deliveryAddress,
    pickupAccess,
    deliveryAccess,
    extraPickupStops,
    extraDeliveryStops,
    handlingType,
    buildEffectiveLines,
    scheduledDate,
    effectiveOrgId,
    crewOverride,
    truckOverride,
    hoursOverride,
    timeSensitive,
    assemblyRequired,
    debrisRemoval,
    stairsFlights,
    highValue,
    artwork,
    antiques,
    skidCount,
    totalLoadWeightLbs,
    haulAwayUnits,
    returnsPickup,
    sameDay,
  ]);

  useLayoutEffect(() => {
    if (!embed) return;
    const cb = embedCbRef.current;
    if (!cb) return;
    cb({
      businessName: businessName.trim(),
      verticalCode,
      lines,
      handlingType,
      pickupAddress,
      deliveryAddress,
      extraPickupAddresses: extraPickupStops.map((s) => s.address).filter(Boolean),
      extraDeliveryAddresses: extraDeliveryStops.map((s) => s.address).filter(Boolean),
      pickupAccess,
      deliveryAccess,
      partnerOrgId: partnerOrgId.trim(),
      timeSensitive,
      assemblyRequired,
      debrisRemoval,
      stairsFlights,
      highValue,
      artwork,
      antiques,
      skidCount,
      boxCount,
      totalLoadWeightLbs,
      haulAwayUnits,
      returnsPickup,
      sameDay,
    });
  }, [
    embed,
    businessName,
    verticalCode,
    lines,
    handlingType,
    pickupAddress,
    deliveryAddress,
    extraPickupStops,
    extraDeliveryStops,
    pickupAccess,
    deliveryAccess,
    partnerOrgId,
    timeSensitive,
    assemblyRequired,
    debrisRemoval,
    stairsFlights,
    highValue,
    artwork,
    antiques,
    skidCount,
    boxCount,
    totalLoadWeightLbs,
    haulAwayUnits,
    returnsPickup,
    sameDay,
  ]);

  const formState = useMemo(
    () => ({
      businessName,
      contactName,
      contactPhone,
      contactEmail,
      partnerOrgId,
      applyPartnerRates,
      verticalCode,
      pickupAddress,
      extraPickupStops,
      pickupAccess,
      deliveryAddress,
      extraDeliveryStops,
      deliveryAccess,
      lines,
      newDesc,
      newQty,
      newWeight,
      newFragile,
      newUnitType,
      newStopAssignment,
      newSerialNumber,
      newDeclaredValue,
      newHookupRequired,
      newHaulAwayLine,
      newCratingRequired,
      newLineAssemblyRequired,
      handlingType,
      scheduledDate,
      timeWindow,
      timeSensitive,
      accessNotes,
      specialInstructions,
      crewOverride,
      truckOverride,
      hoursOverride,
      assemblyRequired,
      debrisRemoval,
      stairsFlights,
      highValue,
      artwork,
      antiques,
      skidCount,
      boxCount,
      totalLoadWeightLbs,
      haulAwayUnits,
      returnsPickup,
      sameDay,
      chainOfCustodyNotes,
      hookupNotes,
      paymentMethod,
      invoiceTerms,
      overridePrice,
      overrideReason,
      crewId,
    }),
    [
      businessName,
      contactName,
      contactPhone,
      contactEmail,
      partnerOrgId,
      applyPartnerRates,
      verticalCode,
      pickupAddress,
      extraPickupStops,
      pickupAccess,
      deliveryAddress,
      extraDeliveryStops,
      deliveryAccess,
      lines,
      newDesc,
      newQty,
      newWeight,
      newFragile,
      newUnitType,
      newStopAssignment,
      newSerialNumber,
      newDeclaredValue,
      newHookupRequired,
      newHaulAwayLine,
      newCratingRequired,
      newLineAssemblyRequired,
      handlingType,
      scheduledDate,
      timeWindow,
      timeSensitive,
      accessNotes,
      specialInstructions,
      crewOverride,
      truckOverride,
      hoursOverride,
      assemblyRequired,
      debrisRemoval,
      stairsFlights,
      highValue,
      artwork,
      antiques,
      skidCount,
      boxCount,
      totalLoadWeightLbs,
      haulAwayUnits,
      returnsPickup,
      sameDay,
      chainOfCustodyNotes,
      hookupNotes,
      paymentMethod,
      invoiceTerms,
      overridePrice,
      overrideReason,
      crewId,
    ],
  );

  const titleFn = useCallback((s: typeof formState) => s.businessName || s.contactName || "B2B Delivery", []);

  const applyB2bDraftData = useCallback((data: Record<string, unknown>) => {
    const d = data;
    const apply = (k: string, fn: (v: unknown) => void) => {
      if (d[k] !== undefined) fn(d[k]);
    };
    apply("businessName", (v) => setBusinessName(String(v)));
    apply("contactName", (v) => setContactName(String(v)));
    apply("contactPhone", (v) => setContactPhone(String(v)));
    apply("contactEmail", (v) => setContactEmail(String(v)));
    apply("partnerOrgId", (v) => setPartnerOrgId(String(v)));
    apply("applyPartnerRates", (v) => setApplyPartnerRates(!!v));
    apply("verticalCode", (v) => setVerticalCode(String(v)));
    apply("pickupAddress", (v) => setPickupAddress(String(v)));
    if (Array.isArray(d.extraPickupStops)) setExtraPickupStops(d.extraPickupStops as StopEntry[]);
    apply("pickupAccess", (v) => setPickupAccess(String(v)));
    apply("deliveryAddress", (v) => setDeliveryAddress(String(v)));
    if (Array.isArray(d.extraDeliveryStops)) setExtraDeliveryStops(d.extraDeliveryStops as StopEntry[]);
    apply("deliveryAccess", (v) => setDeliveryAccess(String(v)));
    if (Array.isArray(d.lines)) setLines(d.lines as LineRow[]);
    apply("handlingType", (v) => setHandlingType(String(v)));
    apply("scheduledDate", (v) => setScheduledDate(String(v)));
    apply("timeWindow", (v) => setTimeWindow(String(v)));
    apply("timeSensitive", (v) => setTimeSensitive(!!v));
    apply("accessNotes", (v) => setAccessNotes(String(v)));
    apply("specialInstructions", (v) => setSpecialInstructions(String(v)));
    apply("crewOverride", (v) => setCrewOverride(String(v ?? "")));
    apply("truckOverride", (v) => setTruckOverride(String(v ?? "")));
    apply("hoursOverride", (v) => setHoursOverride(String(v ?? "")));
    apply("assemblyRequired", (v) => setAssemblyRequired(!!v));
    apply("debrisRemoval", (v) => setDebrisRemoval(!!v));
    apply("stairsFlights", (v) => setStairsFlights(String(v ?? "")));
    apply("highValue", (v) => setHighValue(!!v));
    apply("artwork", (v) => setArtwork(!!v));
    apply("antiques", (v) => setAntiques(!!v));
    apply("skidCount", (v) => setSkidCount(String(v ?? "")));
    apply("boxCount", (v) => setBoxCount(String(v ?? "")));
    apply("totalLoadWeightLbs", (v) => setTotalLoadWeightLbs(String(v ?? "")));
    apply("haulAwayUnits", (v) => setHaulAwayUnits(String(v ?? "")));
    apply("returnsPickup", (v) => setReturnsPickup(!!v));
    apply("sameDay", (v) => setSameDay(!!v));
    apply("chainOfCustodyNotes", (v) => setChainOfCustodyNotes(String(v ?? "")));
    apply("hookupNotes", (v) => setHookupNotes(String(v ?? "")));
    apply("paymentMethod", (v) => setPaymentMethod(v === "invoice" ? "invoice" : "card"));
    apply("invoiceTerms", (v) => {
      const s = String(v || "on_completion");
      if (s === "net_15" || s === "net_30" || s === "on_completion") setInvoiceTerms(s);
      else setInvoiceTerms("on_completion");
    });
    apply("overridePrice", (v) => setOverridePrice(String(v ?? "")));
    apply("overrideReason", (v) => setOverrideReason(String(v ?? "")));
    apply("crewId", (v) => setCrewId(String(v ?? "")));
    apply("newDesc", (v) => setNewDesc(String(v ?? "")));
    apply("newQty", (v) => setNewQty(Math.max(1, Number(v) || 1)));
    apply("newWeight", (v) => {
      const s = String(v ?? "medium").toLowerCase();
      setNewWeight(
        LINE_WEIGHT_OPTIONS.some((o) => o.value === s) ? (s as LineRow["weight_category"]) : "medium",
      );
    });
    apply("newFragile", (v) => setNewFragile(!!v));
    apply("newUnitType", (v) => setNewUnitType(String(v ?? "box")));
    apply("newStopAssignment", (v) => setNewStopAssignment(String(v ?? "")));
    apply("newSerialNumber", (v) => setNewSerialNumber(String(v ?? "")));
    apply("newDeclaredValue", (v) => setNewDeclaredValue(String(v ?? "")));
    apply("newHookupRequired", (v) => setNewHookupRequired(!!v));
    apply("newHaulAwayLine", (v) => setNewHaulAwayLine(!!v));
    apply("newCratingRequired", (v) => setNewCratingRequired(!!v));
    apply("newLineAssemblyRequired", (v) => setNewLineAssemblyRequired(!!v));
  }, []);

  const { hasDraft, restoreDraft, dismissDraft, clearDraft } = useFormDraft("delivery_b2b", formState, titleFn, {
    applySaved: applyB2bDraftData as (data: typeof formState) => void,
    debounceMs: 30_000,
  });

  const handleRestoreDraft = useCallback(() => {
    const data = restoreDraft();
    if (!data) return;
    applyB2bDraftData(data as Record<string, unknown>);
  }, [restoreDraft, applyB2bDraftData]);

  const stopsForQuote = useMemo(
    () => b2bJobsDimensionalStops(pickupAddress, deliveryAddress, pickupAccess, deliveryAccess, extraPickupStops, extraDeliveryStops),
    [pickupAddress, deliveryAddress, pickupAccess, deliveryAccess, extraPickupStops, extraDeliveryStops],
  );

  useEffect(() => {
    let cancelled = false;
    const pickupMain = pickupAddress.trim();
    const deliveryMain = deliveryAddress.trim();
    if (!pickupMain || !deliveryMain) {
      setEstimatedDistanceKm(null);
      setClientDistanceLoading(false);
      return;
    }
    const extraP = extraPickupStops.map((s) => s.address).filter(Boolean);
    const extraD = extraDeliveryStops.map((s) => s.address).filter(Boolean);
    const addresses = [pickupMain, ...extraP, deliveryMain, ...extraD];
    if (addresses.length < 2) {
      setEstimatedDistanceKm(null);
      setClientDistanceLoading(false);
      return;
    }
    setClientDistanceLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const info = await getMultiStopDrivingDistance(addresses);
          if (cancelled) return;
          setEstimatedDistanceKm(info?.distance_km ?? null);
        } catch {
          if (!cancelled) setEstimatedDistanceKm(null);
        } finally {
          if (!cancelled) setClientDistanceLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pickupAddress, deliveryAddress, extraPickupStops, extraDeliveryStops]);

  useEffect(() => {
    if (!selectedVertical) {
      setClientEstimate(null);
      return;
    }
    const eff = buildEffectiveLines();
    if (!verticalCode.trim() || !pickupAddress.trim() || !deliveryAddress.trim() || eff.length === 0) {
      setClientEstimate(null);
      return;
    }
    const rawItems: B2BQuoteLineItem[] = eff
      .map((l) => {
        const p = toB2bLinePayload(l, handlingType);
        const wc = String(p.weight_category || "light").toLowerCase();
        const wcat =
          wc === "medium" || wc === "heavy" || wc === "extra_heavy" ? wc : "light";
        return {
          description: String(p.description || "").trim(),
          quantity: Math.max(1, Number(p.quantity) || 1),
          weight_category: wcat as B2BQuoteLineItem["weight_category"],
          fragile: !!p.fragile,
          handling_type: typeof p.handling_type === "string" ? p.handling_type : undefined,
          unit_type: typeof p.unit_type === "string" ? p.unit_type : undefined,
          serial_number: typeof p.serial_number === "string" ? p.serial_number : undefined,
          stop_assignment: typeof p.stop_assignment === "string" ? p.stop_assignment : undefined,
          declared_value: typeof p.declared_value === "string" ? p.declared_value : undefined,
          crating_required: !!p.crating_required,
          hookup_required: !!p.hookup_required,
          haul_away: !!p.haul_away,
          assembly_required: !!p.assembly_required,
        };
      })
      .filter((i) => i.description.length > 0);

    if (rawItems.length === 0) {
      setClientEstimate(null);
      return;
    }

    const merged = mergedRatesWithBundleTiers({
      ...(selectedVertical.default_config as Record<string, unknown>),
    });
    const engineItems = prepareB2bLineItemsForDimensionalEngine(rawItems, verticalCode, handlingType, merged);

    const routeStops = b2bJobsDimensionalStops(
      pickupAddress,
      deliveryAddress,
      pickupAccess,
      deliveryAccess,
      extraPickupStops,
      extraDeliveryStops,
    );

    const dimInput: B2BDimensionalQuoteInput = {
      vertical_code: verticalCode,
      items: engineItems,
      handling_type: handlingType,
      stops: routeStops,
      crew_override: crewOverride ? Number(crewOverride) : undefined,
      truck_override: truckOverride || undefined,
      estimated_hours_override: hoursOverride ? Number(hoursOverride) : undefined,
      time_sensitive: timeSensitive,
      assembly_required: assemblyRequired,
      debris_removal: debrisRemoval,
      stairs_flights: stairsFlights ? Number(stairsFlights) : undefined,
      addons: [
        ...(highValue ? ["high_value"] : []),
        ...(artwork ? ["artwork"] : []),
        ...(antiques ? ["antiques"] : []),
      ],
      weekend: scheduledDate ? isMoveDateWeekend(scheduledDate) : false,
      after_hours: false,
      same_day: sameDay,
      skid_count: skidCount ? Number(skidCount) : undefined,
      total_load_weight_lbs: totalLoadWeightLbs ? Number(totalLoadWeightLbs) : undefined,
      haul_away_units: haulAwayUnits ? Number(haulAwayUnits) : undefined,
      returns_pickup: returnsPickup,
    };

    const distKm = estimatedDistanceKm ?? 0;
    const dim = calculateB2BDimensionalPrice({
      vertical: b2bOptionToVerticalRow(selectedVertical),
      mergedRates: merged,
      input: dimInput,
      totalDistanceKm: distKm,
      roundingNearest: ROUNDING_NEAREST_CLIENT,
      parkingLongCarryTotal: 0,
      pricingExtras: [],
    });

    const access = 0;
    const roundedPreTax = roundToNearest(dim.subtotal + access, ROUNDING_NEAREST_CLIENT);
    const hst = Math.round(roundedPreTax * TAX_RATE_CLIENT * 100) / 100;
    setClientEstimate({
      rounded_pre_tax: roundedPreTax,
      hst,
      total_with_tax: Math.round((roundedPreTax + hst) * 100) / 100,
      breakdown: dim.breakdown,
      truck: dim.truck,
      crew: dim.crew,
      estimated_hours: dim.estimatedHours,
      access_surcharge: access,
    });
  }, [
    selectedVertical,
    verticalCode,
    buildEffectiveLines,
    pickupAddress,
    deliveryAddress,
    pickupAccess,
    deliveryAccess,
    extraPickupStops,
    extraDeliveryStops,
    handlingType,
    timeSensitive,
    assemblyRequired,
    debrisRemoval,
    stairsFlights,
    highValue,
    artwork,
    antiques,
    skidCount,
    totalLoadWeightLbs,
    haulAwayUnits,
    returnsPickup,
    sameDay,
    scheduledDate,
    crewOverride,
    truckOverride,
    hoursOverride,
    estimatedDistanceKm,
  ]);

  const buildB2bStopsPayload = () =>
    stopsForQuote.map((s) => ({
      address: s.address,
      type: s.type === "pickup" ? ("pickup" as const) : ("delivery" as const),
      access: s.access,
    }));

  const chainBlock =
    cmpVis("chain_of_custody") && chainOfCustodyNotes.trim()
      ? `Chain of custody: ${chainOfCustodyNotes.trim()}`
      : "";
  const hookupBlock =
    cmpVis("hookup_install") && hookupNotes.trim() ? `Hook-up / install: ${hookupNotes.trim()}` : "";
  const lineDetailBlock = lineAnnotationsBlock(buildEffectiveLines());
  const instructionsMerged =
    [accessNotes.trim(), specialInstructions.trim(), chainBlock, hookupBlock, lineDetailBlock]
      .filter(Boolean)
      .join("\n\n") || null;

  const validateCore = (requireEmailForQuote: boolean) => {
    const partnerId = partnerOrgId.trim();
    const hasPartnerOrg = partnerId.length > 0 && organizations.some((o) => o.id === partnerId);
    if (!hasPartnerOrg) {
      if (!businessName.trim()) return "Business name is required";
      if (!contactPhone.trim()) return "Contact phone is required";
    }
    if (!contactName.trim()) return "Contact name is required";
    if (!verticalCode.trim()) return "Delivery vertical is required";
    if (buildEffectiveLines().length === 0) return "Add at least one line item (or box count for flooring)";
    if (!pickupAddress.trim() || !deliveryAddress.trim()) return "Pickup and delivery addresses are required";
    if (!scheduledDate) return "Date is required";
    if (requireEmailForQuote && !(contactEmail || "").trim()) return "Email is required to send a quote";
    const ov = parseNumberInput(overridePrice);
    if (ov > 0 && !overrideReason.trim()) return "Override reason is required when override price is set";
    return null;
  };

  const postCreateDelivery = async (status: "draft" | "scheduled" | "confirmed") => {
    const err = validateCore(false);
    if (err) {
      setError(err);
      return;
    }
    const partnerId = partnerOrgId.trim();
    const usePartner = partnerId.length > 0 && organizations.some((o) => o.id === partnerId);

    setLoading(true);
    setError("");

    const effLines = buildEffectiveLines();
    const itemsList = effLines.map((i) =>
      `${i.description}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`,
    );
    const b2bLineItems = effLines.map((l) => toB2bLinePayload(l, handlingType));

    const priceBlock = serverPricing ?? clientEstimate;
    const enginePreTax = priceBlock?.rounded_pre_tax ?? 0;
    const ovAmt = parseNumberInput(overridePrice);
    const finalPreTax = ovAmt > 0 ? ovAmt : enginePreTax;
    const calculated_price = enginePreTax > 0 ? enginePreTax : null;
    const totalWithTax =
      finalPreTax > 0 ? Math.round(finalPreTax * 1.13 * 100) / 100 : null;

    const basePayload: Record<string, unknown> = {
      customer_name: contactName.trim(),
      customer_phone: normalizePhone(contactPhone),
      customer_email: contactEmail.trim() || null,
      pickup_address: pickupAddress.trim(),
      delivery_address: deliveryAddress.trim(),
      pickup_access: pickupAccess || null,
      delivery_access: deliveryAccess || null,
      items: itemsList,
      scheduled_date: scheduledDate,
      delivery_window: timeWindow || null,
      instructions: instructionsMerged,
      category: "b2b",
      status,
      vertical_code: verticalCode,
      b2b_line_items: b2bLineItems,
      b2b_assembly_required: assemblyRequired,
      b2b_debris_removal: debrisRemoval,
      pricing_breakdown: priceBlock?.breakdown ?? null,
      recommended_vehicle: truckOverride || priceBlock?.truck || null,
      estimated_duration_hours: hoursOverride ? Number(hoursOverride) : priceBlock?.estimated_hours ?? null,
      crew_id: crewId || null,
      calculated_price,
      total_price: totalWithTax,
      quoted_price: finalPreTax > 0 ? finalPreTax : null,
    };

    if (ovAmt > 0 && overrideReason.trim()) {
      basePayload.override_price = ovAmt;
      basePayload.override_reason = overrideReason.trim();
    }

    const payload = usePartner
      ? { ...basePayload, organization_id: partnerId }
      : {
          ...basePayload,
          booking_type: "one_off",
          organization_id: null,
          business_name: businessName.trim(),
          contact_name: contactName.trim(),
          contact_phone: normalizePhone(contactPhone),
          contact_email: contactEmail.trim() || null,
          client_name: businessName.trim(),
        };

    const res = await fetch("/api/admin/deliveries/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    const data = await res.json();
    if (res.ok && data.delivery) {
      clearDraft();
      const created = data.delivery;
      const extras = [
        ...extraPickupStops.filter((s) => s.address.trim()).map((s, i) => ({ ...s, stop_type: "pickup" as const, sort_order: i + 1 })),
        ...extraDeliveryStops.filter((s) => s.address.trim()).map((s, i) => ({ ...s, stop_type: "dropoff" as const, sort_order: i + 1 })),
      ];
      if (extras.length > 0) {
        fetch("/api/admin/job-stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_type: "delivery", job_id: created.id, stops: extras }),
        }).catch(() => {});
      }
      const path = created.delivery_number
        ? `/admin/deliveries/${encodeURIComponent(created.delivery_number)}`
        : `/admin/deliveries/${created.id}`;
      router.push(path);
      router.refresh();
    } else {
      setError(data.error || "Failed to create delivery");
    }
  };

  const sendQuote = async () => {
    const err = validateCore(true);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError("");
    const effLines = buildEffectiveLines();
    const b2b_line_items = effLines.map((l) => toB2bLinePayload(l, handlingType));

    try {
      const pv = await fetch("/api/admin/b2b-delivery/pricing-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical_code: verticalCode,
          organization_id: effectiveOrgId,
          scheduled_date: scheduledDate,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          pickup_access: pickupAccess,
          delivery_access: deliveryAccess,
          extra_pickup_addresses: extraPickupStops.map((s) => s.address).filter(Boolean),
          extra_delivery_addresses: extraDeliveryStops.map((s) => s.address).filter(Boolean),
          handling_type: handlingType,
          line_items: effLines.map((l) => toB2bLinePayload(l, handlingType)),
          crew_override: crewOverride ? Number(crewOverride) : undefined,
          truck_override: truckOverride || undefined,
          estimated_hours_override: hoursOverride ? Number(hoursOverride) : undefined,
          time_sensitive: timeSensitive,
          assembly_required: assemblyRequired,
          debris_removal: debrisRemoval,
          stairs_flights: stairsFlights ? Number(stairsFlights) : undefined,
          complexity_addons: [
            ...(highValue ? ["high_value"] : []),
            ...(artwork ? ["artwork"] : []),
            ...(antiques ? ["antiques"] : []),
          ],
          skid_count: skidCount ? Number(skidCount) : undefined,
          total_load_weight_lbs: totalLoadWeightLbs ? Number(totalLoadWeightLbs) : undefined,
          haul_away_units: haulAwayUnits ? Number(haulAwayUnits) : undefined,
          returns_pickup: returnsPickup,
          same_day: sameDay,
        }),
      });
      const pvData = await pv.json();
      if (!pv.ok || !pvData.ok) {
        setLoading(false);
        setError(
          typeof pvData.error === "string"
            ? pvData.error
            : "Could not calculate exact price. Check addresses, vertical, and line items, then try again.",
        );
        return;
      }
      setServerPricing({
        rounded_pre_tax: pvData.rounded_pre_tax,
        hst: pvData.hst,
        total_with_tax: pvData.total_with_tax,
        breakdown: pvData.breakdown ?? [],
        truck: pvData.truck,
        crew: pvData.crew,
        estimated_hours: pvData.estimated_hours,
        access_surcharge: pvData.access_surcharge ?? 0,
      });

      const ovAmt = parseNumberInput(overridePrice);
      const payload: Record<string, unknown> = {
        service_type: "b2b_delivery",
        from_address: pickupAddress.trim(),
        to_address: deliveryAddress.trim(),
        from_access: pickupAccess,
        to_access: deliveryAccess,
        move_date: scheduledDate,
        client_name: contactName.trim(),
        client_email: contactEmail.trim().toLowerCase(),
        client_phone: contactPhone.trim() || undefined,
        b2b_business_name: businessName.trim() || undefined,
        b2b_vertical_code: verticalCode,
        b2b_partner_organization_id: effectiveOrgId,
        b2b_handling_type: handlingType,
        b2b_line_items,
        b2b_stops: buildB2bStopsPayload(),
        b2b_payment_method: paymentMethod,
        ...(paymentMethod === "invoice" ? { b2b_invoice_terms: invoiceTerms } : {}),
        b2b_special_instructions: instructionsMerged || undefined,
        b2b_assembly_required: assemblyRequired,
        b2b_debris_removal: debrisRemoval,
        b2b_stairs_flights: stairsFlights ? Number(stairsFlights) : undefined,
        b2b_time_sensitive: timeSensitive,
        b2b_crew_override: crewOverride ? Number(crewOverride) : undefined,
        b2b_estimated_hours_override: hoursOverride ? Number(hoursOverride) : undefined,
        truck_type: truckOverride || undefined,
        b2b_same_day: sameDay,
        b2b_skid_count: skidCount ? Number(skidCount) : undefined,
        b2b_total_load_weight_lbs: totalLoadWeightLbs ? Number(totalLoadWeightLbs) : undefined,
        b2b_haul_away_units: haulAwayUnits ? Number(haulAwayUnits) : undefined,
        b2b_returns_pickup: returnsPickup,
        b2b_delivery_window: timeWindow.trim() || undefined,
        b2b_complexity_addons: [
          ...(highValue ? ["high_value"] : []),
          ...(artwork ? ["artwork"] : []),
          ...(antiques ? ["antiques"] : []),
        ],
        selected_addons: [],
      };
      if (ovAmt > 0 && overrideReason.trim()) {
        payload.b2b_subtotal_override = ovAmt;
        payload.b2b_subtotal_override_reason = overrideReason.trim();
      }

      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(data.error || "Failed to generate quote");
        return;
      }
      const qid = data.quote_id as string;
      if (!qid || qid === "PREVIEW") {
        setLoading(false);
        setError("Invalid quote response");
        return;
      }

      const sendRes = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: qid,
          client_email: contactEmail.trim().toLowerCase(),
          client_phone: contactPhone.trim() || undefined,
          client_name: contactName.trim(),
        }),
      });
      const sendData = await sendRes.json().catch(() => ({}));
      setLoading(false);
      if (!sendRes.ok) {
        setError(
          typeof sendData.error === "string"
            ? sendData.error
            : "Quote was saved but the email could not be sent. Open the quote and use Send from the admin quote page.",
        );
        router.push(`/admin/quotes/${encodeURIComponent(qid)}`);
        router.refresh();
        return;
      }

      clearDraft();
      router.push(`/admin/quotes/${encodeURIComponent(qid)}`);
      router.refresh();
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Failed to send quote");
    }
  };

  const patchLine = (idx: number, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addQuickPreset = useCallback(
    (p: { name: string; weight?: string; fragile?: boolean; unit?: string; icon?: string }) => {
      const wcRaw = (p.weight || "medium").toLowerCase();
      const wc = LINE_WEIGHT_OPTIONS.some((o) => o.value === wcRaw)
        ? (wcRaw as LineRow["weight_category"])
        : "medium";
      setLines((prev) => [
        ...prev,
        {
          description: p.name,
          quantity: 1,
          weight_category: wc,
          fragile: !!p.fragile,
          ...(showUnitTypeColumn ? { unit_type: p.unit || "box" } : {}),
        },
      ]);
    },
    [showUnitTypeColumn],
  );

  const addLine = () => {
    if (!newDesc.trim()) return;
    setLines((prev) => [
      ...prev,
      {
        description: newDesc.trim(),
        quantity: newQty,
        weight_category: newWeight,
        fragile: newFragile,
        ...(showUnitTypeColumn ? { unit_type: newUnitType } : {}),
        ...(showItemField("stop_assignment") && newStopAssignment.trim()
          ? { stop_assignment: newStopAssignment.trim() }
          : {}),
        ...(showItemField("serial_number") && newSerialNumber.trim()
          ? { serial_number: newSerialNumber.trim() }
          : {}),
        ...(showItemField("declared_value") && newDeclaredValue.trim()
          ? { declared_value: newDeclaredValue.trim() }
          : {}),
        ...(showItemField("hookup_required") && newHookupRequired ? { hookup_required: true } : {}),
        ...(showItemField("haul_away_old") && newHaulAwayLine ? { haul_away_line: true } : {}),
        ...(showItemField("crating_required") && newCratingRequired ? { crating_required: true } : {}),
        ...(showItemField("assembly_required") && newLineAssemblyRequired
          ? { line_assembly_required: true }
          : {}),
      },
    ]);
    setNewDesc("");
    setNewQty(1);
    setNewFragile(false);
    setNewStopAssignment("");
    setNewSerialNumber("");
    setNewDeclaredValue("");
    setNewHookupRequired(false);
    setNewHaulAwayLine(false);
    setNewCratingRequired(false);
    setNewLineAssemblyRequired(false);
  };

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className={embed ? "space-y-5" : "space-y-6"}>
      {hasDraft && <DraftBanner onRestore={handleRestoreDraft} onDismiss={dismissDraft} />}

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-[rgba(209,67,67,0.1)] border border-[rgba(209,67,67,0.3)] text-[12px] text-[var(--red)]">
          {error}
        </div>
      )}
      {embed && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--tx3)]">
          <span>Prefer the full-page experience?</span>
          <Link
            href="/admin/deliveries/new?choice=b2b_oneoff"
            className="inline-flex items-center gap-1 font-semibold text-[var(--gold)] hover:underline"
          >
            Open B2B Jobs
            <ArrowSquareOut className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {!embed && (
        <div className="px-3 py-2 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[11px] text-[var(--gold)]">
          {partnerOrgId.trim() && applyPartnerRates
            ? "Partner organization linked — dimensional preview uses partner vertical rates when configured."
            : "True one-off: no partner org — full payment at booking unless you send a quote with invoice terms."}
        </div>
      )}

      {organizations.length > 0 && (
        <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Partner</h3>
          <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] cursor-pointer">
            <input
              type="checkbox"
              checked={applyPartnerRates}
              onChange={(e) => setApplyPartnerRates(e.target.checked)}
              className="rounded border-[var(--brd)] accent-[var(--gold)]"
            />
            Apply partner rate card (when organization is selected)
          </label>
          <Field label="Organization (optional)">
            <select value={partnerOrgId} onChange={(e) => setPartnerOrgId(e.target.value)} className={fieldInput}>
              <option value="">None — one-off</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Client / business</h3>
          {hsLookupState === "loading" && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--tx3)]">
              <SpinnerGap size={12} className="animate-spin" />
              HubSpot…
            </span>
          )}
        </div>
        {hsPendingMatch && (
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--tx)]">
                  {hsPendingMatch.match_kind === "company"
                    ? "Similar business in HubSpot"
                    : "Existing contact found:"}{" "}
                  {hsPendingMatch.match_kind !== "company" && (
                    <span className="text-[var(--tx)]">
                      {[hsPendingMatch.contact.first_name, hsPendingMatch.contact.last_name].filter(Boolean).join(" ") ||
                        hsPendingMatch.contact.email ||
                        "Contact"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--tx3)] mt-1">
                  {hsPendingMatch.contact.company?.trim()
                    ? `Company: ${hsPendingMatch.contact.company.trim()} · `
                    : ""}
                  {hsPendingMatch.contact.email || ""}
                  {hsPendingMatch.contact.deal_ids?.length
                    ? ` · ${hsPendingMatch.contact.deal_ids.length} deal${
                        hsPendingMatch.contact.deal_ids.length > 1 ? "s" : ""
                      } in HubSpot`
                    : ""}
                </p>
                {hsPendingMatch.match_kind === "company" && (
                  <p className="text-[11px] text-[var(--tx2)] mt-2">
                    HubSpot lists a contact under a similar business name. Confirm this is not a duplicate before
                    proceeding.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => applyHubSpotContactFromMatch(hsPendingMatch.contact)}
                  className="px-3 py-1.5 text-xs rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium"
                >
                  Auto-fill
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHsPendingMatch(null);
                    setHsLookupState("idle");
                  }}
                  className="px-3 py-1.5 text-xs rounded-md border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--bg)]"
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={hsSuggest.containerRef} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={partnerOrgId.trim() ? "Business name" : "Business name *"}>
            <div className="relative">
              <input
                {...hsSuggest.bindField("business")}
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  clearHubSpotMatch();
                }}
                onBlur={scheduleHubSpotDedup}
                className={fieldInput}
                autoComplete="organization"
              />
              {hsSuggest.renderDropdown("business")}
            </div>
          </Field>
          <Field label="Contact name *">
            <div className="relative">
              <input
                {...hsSuggest.bindField("contact")}
                value={contactName}
                onChange={(e) => {
                  setContactName(e.target.value);
                  clearHubSpotMatch();
                }}
                onBlur={scheduleHubSpotDedup}
                className={fieldInput}
                autoComplete="name"
              />
              {hsSuggest.renderDropdown("contact")}
            </div>
          </Field>
          <Field label="Phone *">
            <div className="relative">
              <input
                ref={contactPhoneInput.ref}
                type="tel"
                {...hsSuggest.bindField("phone")}
                value={contactPhone}
                onChange={(e) => {
                  contactPhoneInput.onChange(e);
                  clearHubSpotMatch();
                }}
                onBlur={scheduleHubSpotDedup}
                placeholder={PHONE_PLACEHOLDER}
                className={fieldInput}
                autoComplete="tel"
              />
              {hsSuggest.renderDropdown("phone")}
            </div>
          </Field>
          <Field label="Email">
            <div className="relative">
              <input
                type="email"
                {...hsSuggest.bindField("email")}
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  clearHubSpotMatch();
                }}
                onBlur={scheduleHubSpotDedup}
                className={fieldInput}
                autoComplete="email"
              />
              {hsSuggest.renderDropdown("email")}
            </div>
          </Field>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Delivery vertical *</h3>
        <select
          value={verticalCode}
          onChange={(e) => setVerticalCode(e.target.value)}
          className={fieldInput}
          required
        >
          {verticals.length === 0 ? (
            <option value="">Load verticals from server</option>
          ) : (
            verticals.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name}
              </option>
            ))
          )}
        </select>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Items *</h3>
        {verticalCode === "flooring" && vis("box_count") && (
          <Field label="Box / unit count (flooring shortcut)">
            <input type="number" min={0} value={boxCount} onChange={(e) => setBoxCount(e.target.value)} className={fieldInput} />
            <p className="text-[10px] text-[var(--tx3)] mt-1">
              Quick entry: set total units without adding individual line items
            </p>
          </Field>
        )}
        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((row, idx) => (
              <li
                key={idx}
                className="space-y-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[11px]"
              >
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <Field label="Item">
                      <input
                        value={row.description}
                        onChange={(e) => patchLine(idx, { description: e.target.value })}
                        className={fieldInput}
                      />
                    </Field>
                  </div>
                  <div className="w-[72px]">
                    <Field label="Qty">
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => patchLine(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className={fieldInput}
                      />
                    </Field>
                  </div>
                  {showItemField("weight") && (
                    <div className="w-[120px]">
                      <Field label="Weight">
                        <select
                          value={row.weight_category}
                          onChange={(e) =>
                            patchLine(idx, { weight_category: e.target.value as LineRow["weight_category"] })
                          }
                          className={fieldInput}
                        >
                          {LINE_WEIGHT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                  {showUnitTypeColumn && (
                    <div className="w-[112px]">
                      <Field label="Unit">
                        <select
                          value={row.unit_type || "box"}
                          onChange={(e) => patchLine(idx, { unit_type: e.target.value })}
                          className={fieldInput}
                        >
                          {FLOORING_UNIT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                  {showItemField("fragile") && (
                    <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pb-2 shrink-0">
                      <input
                        type="checkbox"
                        checked={row.fragile}
                        onChange={(e) => patchLine(idx, { fragile: e.target.checked })}
                        className="accent-[var(--gold)]"
                      />
                      Fragile
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-2 text-[var(--tx3)] hover:text-[var(--red)] shrink-0"
                    aria-label="Remove line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {showLineDetailFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-[var(--brd)]/50">
                    {showItemField("stop_assignment") && (
                      <Field label="Stop assignment">
                        <input
                          value={row.stop_assignment ?? ""}
                          onChange={(e) => patchLine(idx, { stop_assignment: e.target.value })}
                          className={fieldInput}
                          placeholder="Vendor / stop"
                        />
                      </Field>
                    )}
                    {showItemField("serial_number") && (
                      <Field label="Serial number">
                        <input
                          value={row.serial_number ?? ""}
                          onChange={(e) => patchLine(idx, { serial_number: e.target.value })}
                          className={fieldInput}
                        />
                      </Field>
                    )}
                    {showItemField("declared_value") && (
                      <Field label="Declared value">
                        <input
                          value={row.declared_value ?? ""}
                          onChange={(e) => patchLine(idx, { declared_value: e.target.value })}
                          className={fieldInput}
                          placeholder="e.g. 5000"
                        />
                      </Field>
                    )}
                    {showItemField("hookup_required") && (
                      <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                        <input
                          type="checkbox"
                          checked={!!row.hookup_required}
                          onChange={(e) => patchLine(idx, { hookup_required: e.target.checked })}
                          className="accent-[var(--gold)]"
                        />
                        Hook-up required
                      </label>
                    )}
                    {showItemField("haul_away_old") && (
                      <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                        <input
                          type="checkbox"
                          checked={!!row.haul_away_line}
                          onChange={(e) => patchLine(idx, { haul_away_line: e.target.checked })}
                          className="accent-[var(--gold)]"
                        />
                        Haul-away old unit
                      </label>
                    )}
                    {showItemField("crating_required") && (
                      <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                        <input
                          type="checkbox"
                          checked={!!row.crating_required}
                          onChange={(e) => patchLine(idx, { crating_required: e.target.checked })}
                          className="accent-[var(--gold)]"
                        />
                        Crating required
                      </label>
                    )}
                    {showItemField("assembly_required") && (
                      <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                        <input
                          type="checkbox"
                          checked={!!row.line_assembly_required}
                          onChange={(e) => patchLine(idx, { line_assembly_required: e.target.checked })}
                          className="accent-[var(--gold)]"
                        />
                        Assembly required
                      </label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-3">
            <Field label="Description">
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={fieldInput} placeholder="Item description" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Qty">
              <input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value) || 1)}
                className={fieldInput}
              />
            </Field>
          </div>
          {showItemField("weight") && (
            <div className="sm:col-span-2">
              <Field label="Weight">
                <select value={newWeight} onChange={(e) => setNewWeight(e.target.value as LineRow["weight_category"])} className={fieldInput}>
                  {LINE_WEIGHT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {showUnitTypeColumn && (
            <div className="sm:col-span-2">
              <Field label="Unit type">
                <select value={newUnitType} onChange={(e) => setNewUnitType(e.target.value)} className={fieldInput}>
                  {FLOORING_UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {showItemField("fragile") && (
            <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pb-2 sm:col-span-1">
              <input type="checkbox" checked={newFragile} onChange={(e) => setNewFragile(e.target.checked)} className="accent-[var(--gold)]" />
              Fragile
            </label>
          )}
          <button
            type="button"
            onClick={addLine}
            disabled={!newDesc.trim()}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50 sm:col-span-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        {showLineDetailFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {showItemField("stop_assignment") && (
              <Field label="Stop assignment (new line)">
                <input
                  value={newStopAssignment}
                  onChange={(e) => setNewStopAssignment(e.target.value)}
                  className={fieldInput}
                  placeholder="Vendor / stop"
                />
              </Field>
            )}
            {showItemField("serial_number") && (
              <Field label="Serial number (new line)">
                <input value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} className={fieldInput} />
              </Field>
            )}
            {showItemField("declared_value") && (
              <Field label="Declared value (new line)">
                <input
                  value={newDeclaredValue}
                  onChange={(e) => setNewDeclaredValue(e.target.value)}
                  className={fieldInput}
                  placeholder="e.g. 5000"
                />
              </Field>
            )}
            {showItemField("hookup_required") && (
              <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                <input
                  type="checkbox"
                  checked={newHookupRequired}
                  onChange={(e) => setNewHookupRequired(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                Hook-up required
              </label>
            )}
            {showItemField("haul_away_old") && (
              <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                <input
                  type="checkbox"
                  checked={newHaulAwayLine}
                  onChange={(e) => setNewHaulAwayLine(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                Haul-away old unit
              </label>
            )}
            {showItemField("crating_required") && (
              <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                <input
                  type="checkbox"
                  checked={newCratingRequired}
                  onChange={(e) => setNewCratingRequired(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                Crating required
              </label>
            )}
            {showItemField("assembly_required") && (
              <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pt-6">
                <input
                  type="checkbox"
                  checked={newLineAssemblyRequired}
                  onChange={(e) => setNewLineAssemblyRequired(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                Assembly required
              </label>
            )}
          </div>
        )}
        {quickAddPresets.length > 0 && (
          <div className="pt-2 space-y-1">
            <p className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
              Quick add{itemConfig?.label ? ` (${itemConfig.label})` : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickAddPresets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => addQuickPreset(p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] bg-[var(--bg)]"
                >
                  {p.icon ? (
                    <B2bQuickAddIcon icon={p.icon} className="shrink-0 text-[var(--gold)]" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  )}
                  + {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {vis("handling") && (
        <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Handling *</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {HANDLING_OPTIONS.map((h) => (
              <label key={h.value} className="flex items-center gap-2 text-[11px] text-[var(--tx)] cursor-pointer">
                <input
                  type="radio"
                  name="b2b-handling"
                  value={h.value}
                  checked={handlingType === h.value}
                  onChange={() => setHandlingType(h.value)}
                  className="accent-[var(--gold)]"
                />
                {h.label}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Route</h3>
        <MultiStopAddressField
          label="Pickup *"
          placeholder="Pickup address"
          stops={[{ address: pickupAddress }, ...extraPickupStops]}
          onChange={(stops) => {
            setPickupAddress(stops[0]?.address ?? "");
            setExtraPickupStops(vis("multi_stop") ? stops.slice(1) : []);
          }}
          maxStops={vis("multi_stop") ? 6 : 1}
          inputClassName={fieldInput}
        />
        <Field label="Pickup access">
          <select value={pickupAccess} onChange={(e) => setPickupAccess(e.target.value)} className={fieldInput}>
            {ACCESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <MultiStopAddressField
          label="Delivery *"
          placeholder="Delivery address"
          stops={[{ address: deliveryAddress }, ...extraDeliveryStops]}
          onChange={(stops) => {
            setDeliveryAddress(stops[0]?.address ?? "");
            setExtraDeliveryStops(vis("multi_stop") ? stops.slice(1) : []);
          }}
          maxStops={vis("multi_stop") ? 6 : 1}
          inputClassName={fieldInput}
        />
        <Field label="Delivery access">
          <select value={deliveryAccess} onChange={(e) => setDeliveryAccess(e.target.value)} className={fieldInput}>
            {ACCESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Access notes">
          <textarea
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            rows={2}
            placeholder="Dock hours, buzzer codes, long carry notes…"
            className={`${fieldInput} resize-y`}
          />
        </Field>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Schedule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Date *">
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={fieldInput} style={{ colorScheme: "dark" }} />
          </Field>
          <Field label="Delivery window">
            <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)} className={fieldInput}>
              <option value="">Select…</option>
              {TIME_WINDOW_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {cmpVis("same_day") && (
          <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
            <input type="checkbox" checked={sameDay} onChange={(e) => setSameDay(e.target.checked)} className="accent-[var(--gold)]" />
            Same-day delivery
          </label>
        )}
        {vis("time_sensitive") && (
          <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
            <input type="checkbox" checked={timeSensitive} onChange={(e) => setTimeSensitive(e.target.checked)} className="accent-[var(--gold)]" />
            Time-sensitive
          </label>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Vehicle, crew, hours</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <Field label="Recommended truck">
            <div className="px-2 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] min-h-[36px] flex items-center">
              {previewLoading || (clientDistanceLoading && !clientEstimate && !serverPricing)
                ? "…"
                : (serverPricing ?? clientEstimate)?.truck ?? "—"}
            </div>
          </Field>
          <Field label="Override truck">
            <select value={truckOverride} onChange={(e) => setTruckOverride(e.target.value)} className={fieldInput}>
              <option value="">Use recommended</option>
              {TRUCK_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recommended crew">
            <div className="px-2 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] min-h-[36px] flex items-center">
              {previewLoading || (clientDistanceLoading && !clientEstimate && !serverPricing)
                ? "…"
                : (serverPricing ?? clientEstimate) != null
                  ? String((serverPricing ?? clientEstimate)!.crew)
                  : "—"}
            </div>
          </Field>
          <Field label="Override crew size">
            <input
              type="number"
              min={1}
              max={8}
              value={crewOverride}
              onChange={(e) => setCrewOverride(e.target.value)}
              placeholder="e.g. 3"
              className={fieldInput}
            />
          </Field>
          <Field label="Est. hours">
            <div className="px-2 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] min-h-[36px] flex items-center">
              {previewLoading || (clientDistanceLoading && !clientEstimate && !serverPricing)
                ? "…"
                : (serverPricing ?? clientEstimate) != null
                  ? `${(serverPricing ?? clientEstimate)!.estimated_hours} hrs`
                  : "—"}
            </div>
          </Field>
          <Field label="Override hours">
            <input
              type="text"
              value={hoursOverride}
              onChange={(e) => setHoursOverride(e.target.value)}
              placeholder="e.g. 3.5"
              className={fieldInput}
            />
          </Field>
        </div>
      </section>

      {vis("assembly") && (
        <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Assembly</h3>
          <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
            <input type="checkbox" checked={assemblyRequired} onChange={(e) => setAssemblyRequired(e.target.checked)} className="accent-[var(--gold)]" />
            Assembly required
          </label>
        </section>
      )}

      {(cmpVis("debris_removal") ||
        cmpVis("stairs") ||
        cmpVis("high_value") ||
        cmpVis("artwork") ||
        cmpVis("antiques") ||
        cmpVis("chain_of_custody") ||
        cmpVis("hookup_install") ||
        cmpVis("returns_pickup") ||
        cmpVis("skid_count") ||
        cmpVis("total_load_weight") ||
        cmpVis("haul_away")) && (
        <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Complexity & extras</h3>
          {(cmpVis("debris_removal") || cmpVis("high_value") || cmpVis("artwork") || cmpVis("antiques")) && (
            <div className="flex flex-wrap gap-3 text-[11px] text-[var(--tx)]">
              {cmpVis("debris_removal") && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={debrisRemoval} onChange={(e) => setDebrisRemoval(e.target.checked)} className="accent-[var(--gold)]" />
                  Debris removal
                </label>
              )}
              {cmpVis("high_value") && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={highValue} onChange={(e) => setHighValue(e.target.checked)} className="accent-[var(--gold)]" />
                  High value
                </label>
              )}
              {cmpVis("artwork") && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={artwork} onChange={(e) => setArtwork(e.target.checked)} className="accent-[var(--gold)]" />
                  Artwork
                </label>
              )}
              {cmpVis("antiques") && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={antiques} onChange={(e) => setAntiques(e.target.checked)} className="accent-[var(--gold)]" />
                  Antiques
                </label>
              )}
            </div>
          )}
          {cmpVis("stairs") && (
            <Field label="Stairs (flights)">
              <input type="number" min={0} value={stairsFlights} onChange={(e) => setStairsFlights(e.target.value)} className={fieldInput} />
            </Field>
          )}
          {cmpVis("chain_of_custody") && (
            <Field label="Chain of custody notes">
              <textarea
                value={chainOfCustodyNotes}
                onChange={(e) => setChainOfCustodyNotes(e.target.value)}
                rows={2}
                className={`${fieldInput} resize-y`}
                placeholder="Required handoffs, temperature, seals…"
              />
            </Field>
          )}
          {cmpVis("hookup_install") && (
            <Field label="Hook-up / install notes">
              <textarea
                value={hookupNotes}
                onChange={(e) => setHookupNotes(e.target.value)}
                rows={2}
                className={`${fieldInput} resize-y`}
                placeholder="Gas line, water, electrical…"
              />
            </Field>
          )}
          {cmpVis("returns_pickup") && (
            <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
              <input type="checkbox" checked={returnsPickup} onChange={(e) => setReturnsPickup(e.target.checked)} className="accent-[var(--gold)]" />
              Returns pickup
            </label>
          )}
          {cmpVis("skid_count") && (
            <Field label="Skid count">
              <input type="number" min={0} value={skidCount} onChange={(e) => setSkidCount(e.target.value)} className={fieldInput} />
            </Field>
          )}
          {cmpVis("total_load_weight") && (
            <Field label="Total load weight (lbs)">
              <input type="number" min={0} value={totalLoadWeightLbs} onChange={(e) => setTotalLoadWeightLbs(e.target.value)} className={fieldInput} />
            </Field>
          )}
          {cmpVis("haul_away") && (
            <Field label="Haul-away units">
              <input type="number" min={0} value={haulAwayUnits} onChange={(e) => setHaulAwayUnits(e.target.value)} className={fieldInput} />
            </Field>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Pricing</h3>
        {selectedVertical && (
          <div className="text-[11px] text-[var(--tx2)] space-y-0.5">
            <p>
              <span className="font-semibold text-[var(--tx)]">{selectedVertical.name}</span>
              <span className="text-[var(--tx3)]"> · Base rate </span>
              <span className="tabular-nums text-[var(--tx)]">{formatCurrency(selectedVertical.base_rate)}</span>
            </p>
            {estimatedDistanceKm != null ? (
              <p className="text-[10px] text-[var(--tx3)]">Route ~{estimatedDistanceKm} km (used in estimate)</p>
            ) : null}
          </div>
        )}
        {clientEstimate && (
          <div className="text-[11px] space-y-1 text-[var(--tx)] border border-[var(--brd)]/50 rounded-lg p-3 bg-[var(--bg)]/40">
            <p className="text-[9px] uppercase tracking-wide text-[var(--tx3)]">
              Estimate (client-side, updates as you type)
            </p>
            <p className="text-[10px] text-[var(--tx3)]">
              Approximate subtotal using route distance; does not include full partner rate lookup or every access surcharge.
            </p>
            <div className="font-semibold text-[var(--gold)]">
              Pre-tax estimate: {formatCurrency(clientEstimate.rounded_pre_tax)}
            </div>
            {clientEstimate.access_surcharge > 0 && (
              <div className="text-[var(--tx3)]">
                Access (in pre-tax): {formatCurrency(clientEstimate.access_surcharge)}
              </div>
            )}
            <div className="border-t border-[var(--brd)]/40 pt-2 mt-2 space-y-0.5 max-h-32 overflow-y-auto">
              {clientEstimate.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-[var(--tx3)]">{b.label}</span>
                  <span>{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-[var(--brd)]/40">
              <span>HST (est.)</span>
              <span>{formatCurrency(clientEstimate.hst)}</span>
            </div>
            <div className="flex justify-between font-bold text-[var(--gold)]">
              <span>Total (est.)</span>
              <span>~{formatCurrency(clientEstimate.total_with_tax)}</span>
            </div>
          </div>
        )}
        {serverPricing && (
          <div className="text-[11px] space-y-1 text-[var(--tx)] border border-[var(--gold)]/25 rounded-lg p-3 bg-[var(--gold)]/5">
            <p className="text-[9px] uppercase tracking-wide text-[var(--tx3)]">Server price (authoritative)</p>
            <p className="text-[10px] text-[var(--tx3)]">
              Mapbox distance, partner rates when applicable, and full surcharges. This is what appears on the quote.
            </p>
            <div className="font-semibold text-[var(--gold)]">
              Calculated pre-tax: {formatCurrency(serverPricing.rounded_pre_tax)}
            </div>
            {serverPricing.access_surcharge > 0 && (
              <div className="text-[var(--tx3)]">Access surcharges (in pre-tax): {formatCurrency(serverPricing.access_surcharge)}</div>
            )}
            <div className="border-t border-[var(--brd)]/40 pt-2 mt-2 space-y-0.5 max-h-40 overflow-y-auto">
              {serverPricing.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-[var(--tx3)]">{b.label}</span>
                  <span>{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-[var(--brd)]/40">
              <span>HST</span>
              <span>{formatCurrency(serverPricing.hst)}</span>
            </div>
            <div className="flex justify-between font-bold text-[var(--gold)]">
              <span>Total (incl. HST)</span>
              <span>{formatCurrency(serverPricing.total_with_tax)}</span>
            </div>
          </div>
        )}
        {!clientEstimate && !previewLoading && !clientDistanceLoading && (
          <p className="text-[11px] text-[var(--tx3)]">
            Select a vertical, enter pickup and delivery addresses, and add at least one line item (or flooring box count).
            The estimate above updates as you type. Use Get exact price for the number that goes on the quote.
          </p>
        )}
        {previewLoading && <p className="text-[11px] text-[var(--tx3)]">Calculating exact price on server…</p>}
        {clientDistanceLoading && !clientEstimate && (
          <p className="text-[11px] text-[var(--tx3)]">Calculating route distance…</p>
        )}
        <button
          type="button"
          disabled={previewLoading}
          onClick={() => void runPricingPreview()}
          className="w-full sm:w-auto px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] disabled:opacity-50"
        >
          Get exact price
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Field label="Admin override (pre-tax, optional)">
            <input
              type="text"
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
              onBlur={() => {
                const n = parseNumberInput(overridePrice);
                if (n > 0) setOverridePrice(formatNumberInput(n));
              }}
              className={fieldInput}
              placeholder="Leave blank to use calculated"
            />
          </Field>
          <Field label="Override reason (required if overriding)">
            <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className={fieldInput} placeholder="e.g. Volume discount" />
          </Field>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Payment</h3>
        <div className="space-y-2 text-[11px] text-[var(--tx)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="b2b-pay"
              checked={paymentMethod === "card"}
              onChange={() => setPaymentMethod("card")}
              className="accent-[var(--gold)]"
            />
            Card at booking (full payment)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="b2b-pay"
              checked={paymentMethod === "invoice"}
              onChange={() => setPaymentMethod("invoice")}
              className="accent-[var(--gold)]"
            />
            Invoice
          </label>
        </div>
        {paymentMethod === "invoice" && (
          <div className="mt-2 space-y-1">
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Invoice terms</label>
            <select
              value={invoiceTerms}
              onChange={(e) => setInvoiceTerms(e.target.value as typeof invoiceTerms)}
              className={fieldInput}
            >
              <option value="on_completion">Due on job completion</option>
              <option value="net_15">Net 15 (due 15 days after completion)</option>
              <option value="net_30">Net 30 (due 30 days after completion)</option>
            </select>
            <p className="text-[10px] text-[var(--tx3)]">
              Invoice is sent after delivery is completed. No card required at booking.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Special instructions</h3>
        <textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          rows={3}
          className={`${fieldInput} resize-y`}
        />
      </section>

      {crews.length > 0 && (
        <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <Field label="Assign crew (optional)">
            <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={fieldInput}>
              <option value="">Unassigned</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void postCreateDelivery("draft")}
          className="px-4 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void sendQuote()}
          className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-emerald-700 text-white hover:opacity-90 disabled:opacity-50"
        >
          Send quote
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void postCreateDelivery("confirmed")}
          className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-90 disabled:opacity-50"
        >
          Create and schedule
        </button>
      </div>
    </div>
  );
}
