"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formatNumberInput, formatCurrency, parseNumberInput } from "@/lib/format-currency";
import MultiStopAddressField, { type StopEntry } from "@/components/ui/MultiStopAddressField";
import DraftBanner from "@/components/ui/DraftBanner";
import {
  CalendarBlank,
  Plus,
  Trash as Trash2,
  SpinnerGap,
  CheckCircle,
  Warning,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { parseB2BJobsFieldVisibility, b2bJobsFieldVisible } from "@/lib/b2b-jobs-field-visibility";
import { b2bJobsDimensionalStops } from "@/lib/b2b-jobs-route-helpers";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      {children}
    </div>
  );
}

type LineRow = {
  description: string;
  quantity: number;
  weight_category: (typeof LINE_WEIGHT_OPTIONS)[number]["value"];
  fragile: boolean;
};

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
};

export default function B2BJobsDeliveryForm({
  crews = [],
  organizations = [],
  verticals = [],
  embed = false,
}: B2BJobsDeliveryFormProps) {
  const router = useRouter();
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

  const [hsLookupState, setHsLookupState] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [hsDuplicate, setHsDuplicate] = useState<{ type: "contact" | "company"; label: string } | null>(null);
  const [hsAutofilled, setHsAutofilled] = useState<string[]>([]);
  const formSnapshotRef = useRef({ businessName: "", contactName: "", contactPhone: "", contactEmail: "" });
  const dedupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formSnapshotRef.current = { businessName, contactName, contactPhone, contactEmail };

  const clearHubSpotMatch = useCallback(() => {
    setHsLookupState("idle");
    setHsDuplicate(null);
    setHsAutofilled([]);
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
    setHsDuplicate(null);
    setHsAutofilled([]);

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
      const filled: string[] = [];
      const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

      if (match_kind !== "company") {
        setBusinessName((prev) => {
          if (!prev.trim() && contact.company) {
            filled.push("Business Name");
            return contact.company;
          }
          return prev;
        });
        setContactName((prev) => {
          if (!prev.trim() && fullName) {
            filled.push("Contact Name");
            return fullName;
          }
          return prev;
        });
        setContactPhone((prev) => {
          if (!prev.trim() && contact.phone) {
            filled.push("Contact Phone");
            return formatPhone(contact.phone);
          }
          return prev;
        });
        setContactEmail((prev) => {
          if (!prev.trim() && contact.email) {
            filled.push("Contact Email");
            return contact.email;
          }
          return prev;
        });
      }

      setHsAutofilled(filled);

      if (match_kind === "company") {
        const hsLabel = [fullName || contact.email, contact.company].filter(Boolean).join(" — ");
        setHsDuplicate({
          type: "company",
          label: `HubSpot lists a contact under a similar business name (${hsLabel || "see HubSpot"}). Confirm this is not a duplicate before creating the delivery.`,
        });
      } else {
        let label = `This ${match_kind === "email" ? "email" : match_kind === "phone" ? "phone number" : "record"} matches an existing HubSpot contact${fullName ? ` (${fullName})` : ""}.`;
        if (contact.deal_ids.length > 0) {
          label += ` They already have ${contact.deal_ids.length} deal${contact.deal_ids.length > 1 ? "s" : ""} in HubSpot.`;
        }
        setHsDuplicate({ type: "contact", label });
      }
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

  const selectedVertical = useMemo(
    () => verticals.find((v) => v.code === verticalCode) ?? null,
    [verticals, verticalCode],
  );

  const fieldVisibility = useMemo(
    () => parseB2BJobsFieldVisibility(selectedVertical?.default_config),
    [selectedVertical],
  );

  const vis = useCallback((key: string) => b2bJobsFieldVisible(fieldVisibility, key), [fieldVisibility]);

  useEffect(() => {
    const dh = fieldVisibility?.defaultHandling;
    if (dh) setHandlingType(dh.toLowerCase());
  }, [verticalCode, fieldVisibility?.defaultHandling]);

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

  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [crewId, setCrewId] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    rounded_pre_tax: number;
    hst: number;
    total_with_tax: number;
    breakdown: { label: string; amount: number }[];
    truck: string;
    crew: number;
    estimated_hours: number;
    access_surcharge: number;
  } | null>(null);

  const effectiveOrgId = applyPartnerRates && partnerOrgId.trim() ? partnerOrgId.trim() : null;

  const buildEffectiveLines = useCallback((): LineRow[] => {
    if (lines.length > 0) return lines;
    const bc = parseInt(boxCount, 10);
    if (vis("box_count") && bc >= 1 && verticalCode === "flooring") {
      return [{ description: "Flooring / building materials", quantity: bc, weight_category: "light", fragile: false }];
    }
    return [];
  }, [lines, boxCount, vis, verticalCode]);

  const runPricingPreview = useCallback(async () => {
    if (!verticalCode.trim() || !pickupAddress.trim() || !deliveryAddress.trim()) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const effLines = buildEffectiveLines();
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
          line_items: effLines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            weight_category: l.weight_category,
            fragile: l.fragile,
          })),
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
        setPreview({
          rounded_pre_tax: data.rounded_pre_tax,
          hst: data.hst,
          total_with_tax: data.total_with_tax,
          breakdown: data.breakdown ?? [],
          truck: data.truck,
          crew: data.crew,
          estimated_hours: data.estimated_hours,
          access_surcharge: data.access_surcharge ?? 0,
        });
        if (!truckOverride) setTruckOverride("");
        if (!crewOverride) {
          /* recommended crew shown from preview */
        }
      } else {
        setPreview(null);
      }
    } catch {
      setPreview(null);
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

  useEffect(() => {
    const t = setTimeout(() => void runPricingPreview(), 450);
    return () => clearTimeout(t);
  }, [runPricingPreview]);

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
      overridePrice,
      overrideReason,
      crewId,
    ],
  );

  const titleFn = useCallback((s: typeof formState) => s.businessName || s.contactName || "B2B Delivery", []);
  const { hasDraft, restoreDraft, dismissDraft, clearDraft } = useFormDraft("delivery_b2b", formState, titleFn);

  const handleRestoreDraft = useCallback(() => {
    const data = restoreDraft();
    if (!data) return;
    const d = data as Record<string, unknown>;
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
    if (Array.isArray(data.extraPickupStops)) setExtraPickupStops(data.extraPickupStops as StopEntry[]);
    apply("pickupAccess", (v) => setPickupAccess(String(v)));
    apply("deliveryAddress", (v) => setDeliveryAddress(String(v)));
    if (Array.isArray(d.extraDeliveryStops)) setExtraDeliveryStops(d.extraDeliveryStops as StopEntry[]);
    apply("deliveryAccess", (v) => setDeliveryAccess(String(v)));
    if (Array.isArray(data.lines)) setLines(data.lines as LineRow[]);
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
    apply("overridePrice", (v) => setOverridePrice(String(v ?? "")));
    apply("overrideReason", (v) => setOverrideReason(String(v ?? "")));
    apply("crewId", (v) => setCrewId(String(v ?? "")));
  }, [restoreDraft]);

  const stopsForQuote = useMemo(
    () => b2bJobsDimensionalStops(pickupAddress, deliveryAddress, pickupAccess, deliveryAccess, extraPickupStops, extraDeliveryStops),
    [pickupAddress, deliveryAddress, pickupAccess, deliveryAccess, extraPickupStops, extraDeliveryStops],
  );

  const buildB2bStopsPayload = () =>
    stopsForQuote.map((s) => ({
      address: s.address,
      type: s.type === "pickup" ? ("pickup" as const) : ("delivery" as const),
      access: s.access,
    }));

  const chainBlock =
    vis("chain_of_custody") && chainOfCustodyNotes.trim()
      ? `Chain of custody: ${chainOfCustodyNotes.trim()}`
      : "";
  const hookupBlock =
    vis("hookup") && hookupNotes.trim() ? `Hook-up / install: ${hookupNotes.trim()}` : "";
  const instructionsMerged =
    [accessNotes.trim(), specialInstructions.trim(), chainBlock, hookupBlock].filter(Boolean).join("\n\n") || null;

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

  const postCreateDelivery = async (status: "draft" | "scheduled") => {
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
    const b2bLineItems = effLines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      weight_category: l.weight_category,
      fragile: l.fragile,
      handling_type: handlingType,
    }));

    const enginePreTax = preview?.rounded_pre_tax ?? 0;
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
      pricing_breakdown: preview?.breakdown ?? null,
      recommended_vehicle: truckOverride || preview?.truck || null,
      estimated_duration_hours: hoursOverride ? Number(hoursOverride) : preview?.estimated_hours ?? null,
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
    const b2b_line_items = effLines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      weight_category: l.weight_category,
      fragile: l.fragile,
      handling_type: handlingType,
    }));

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
      selected_addons: [],
    };
    if (ovAmt > 0 && overrideReason.trim()) {
      payload.b2b_subtotal_override = ovAmt;
      payload.b2b_subtotal_override_reason = overrideReason.trim();
    }

    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Failed to generate quote");
        return;
      }
      clearDraft();
      const qid = data.quote_id as string;
      if (qid && qid !== "PREVIEW") {
        router.push(`/admin/quotes/${encodeURIComponent(qid)}/edit`);
        router.refresh();
      }
    } catch {
      setLoading(false);
      setError("Failed to send quote");
    }
  };

  const addLine = () => {
    if (!newDesc.trim()) return;
    setLines((prev) => [
      ...prev,
      { description: newDesc.trim(), quantity: newQty, weight_category: newWeight, fragile: newFragile },
    ]);
    setNewDesc("");
    setNewQty(1);
    setNewFragile(false);
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
          {applyPartnerRates && partnerOrgId && paymentMethod === "invoice" && (
            <p className="text-[10px] text-[var(--tx3)]">Invoice booking is for partners with billing on file; card is typical for one-offs.</p>
          )}
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
          {hsLookupState === "found" && hsAutofilled.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[#2D9F5A] font-medium">
              <CheckCircle size={12} weight="fill" />
              Autofilled
            </span>
          )}
        </div>
        {hsDuplicate && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
            <Warning size={14} weight="fill" className="shrink-0 mt-0.5" />
            <span>{hsDuplicate.label}</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={partnerOrgId.trim() ? "Business name" : "Business name *"}>
            <input
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                clearHubSpotMatch();
              }}
              onBlur={scheduleHubSpotDedup}
              className={fieldInput}
            />
          </Field>
          <Field label="Contact name *">
            <input
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                clearHubSpotMatch();
              }}
              onBlur={scheduleHubSpotDedup}
              className={fieldInput}
            />
          </Field>
          <Field label="Phone *">
            <input
              ref={contactPhoneInput.ref}
              type="tel"
              value={contactPhone}
              onChange={(e) => {
                contactPhoneInput.onChange(e);
                clearHubSpotMatch();
              }}
              onBlur={scheduleHubSpotDedup}
              placeholder={PHONE_PLACEHOLDER}
              className={fieldInput}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                clearHubSpotMatch();
              }}
              onBlur={scheduleHubSpotDedup}
              className={fieldInput}
            />
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
        {vis("box_count") && (
          <Field label="Box count (flooring shortcut)">
            <input
              type="number"
              min={0}
              value={boxCount}
              onChange={(e) => setBoxCount(e.target.value)}
              className={fieldInput}
              placeholder="When set without lines, builds a flooring line for pricing"
            />
          </Field>
        )}
        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((row, idx) => (
              <li
                key={idx}
                className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[11px]"
              >
                <span className="flex-1 min-w-[120px] text-[var(--tx)]">
                  {row.description} ×{row.quantity} · {row.weight_category}
                  {row.fragile ? " · Fragile" : ""}
                </span>
                <button type="button" onClick={() => removeLine(idx)} className="p-1 text-[var(--tx3)] hover:text-[var(--red)]" aria-label="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
          <div className="sm:col-span-2">
            <Field label="Description">
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={fieldInput} placeholder="Item description" />
            </Field>
          </div>
          <Field label="Qty">
            <input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(Number(e.target.value) || 1)}
              className={fieldInput}
            />
          </Field>
          <Field label="Weight">
            <select value={newWeight} onChange={(e) => setNewWeight(e.target.value as LineRow["weight_category"])} className={fieldInput}>
              {LINE_WEIGHT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] pb-2">
            <input type="checkbox" checked={newFragile} onChange={(e) => setNewFragile(e.target.checked)} className="accent-[var(--gold)]" />
            Fragile
          </label>
          <button
            type="button"
            onClick={addLine}
            disabled={!newDesc.trim()}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
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
            <div className="relative">
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={`${fieldInput} pr-9`} style={{ colorScheme: "dark" }} />
              <CalendarBlank size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]" aria-hidden />
            </div>
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
        {vis("same_day") && (
          <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
            <input type="checkbox" checked={sameDay} onChange={(e) => setSameDay(e.target.checked)} className="accent-[var(--gold)]" />
            Same-day delivery
          </label>
        )}
        <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
          <input type="checkbox" checked={timeSensitive} onChange={(e) => setTimeSensitive(e.target.checked)} className="accent-[var(--gold)]" />
          Time-sensitive
        </label>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Vehicle, crew, hours</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <Field label="Recommended truck">
            <div className="px-2 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] min-h-[36px] flex items-center">
              {previewLoading ? "…" : preview?.truck ?? "—"}
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
              {previewLoading ? "…" : preview != null ? String(preview.crew) : "—"}
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
              {previewLoading ? "…" : preview != null ? String(preview.estimated_hours) : "—"}
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

      {(vis("complexity") || vis("skid_count") || vis("haul_away") || vis("returns") || vis("total_weight")) && (
        <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Complexity & extras</h3>
          {vis("complexity") && (
            <div className="flex flex-wrap gap-3 text-[11px] text-[var(--tx)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={debrisRemoval} onChange={(e) => setDebrisRemoval(e.target.checked)} className="accent-[var(--gold)]" />
                Debris removal
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={highValue} onChange={(e) => setHighValue(e.target.checked)} className="accent-[var(--gold)]" />
                High value
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={artwork} onChange={(e) => setArtwork(e.target.checked)} className="accent-[var(--gold)]" />
                Artwork
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={antiques} onChange={(e) => setAntiques(e.target.checked)} className="accent-[var(--gold)]" />
                Antiques
              </label>
            </div>
          )}
          {vis("complexity") && (
            <Field label="Stairs (flights)">
              <input type="number" min={0} value={stairsFlights} onChange={(e) => setStairsFlights(e.target.value)} className={fieldInput} />
            </Field>
          )}
          {vis("chain_of_custody") && (
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
          {vis("hookup") && (
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
          {vis("returns") && (
            <label className="flex items-center gap-2 text-[11px] text-[var(--tx)]">
              <input type="checkbox" checked={returnsPickup} onChange={(e) => setReturnsPickup(e.target.checked)} className="accent-[var(--gold)]" />
              Returns pickup
            </label>
          )}
          {vis("skid_count") && (
            <Field label="Skid count">
              <input type="number" min={0} value={skidCount} onChange={(e) => setSkidCount(e.target.value)} className={fieldInput} />
            </Field>
          )}
          {vis("total_weight") && (
            <Field label="Total load weight (lbs)">
              <input type="number" min={0} value={totalLoadWeightLbs} onChange={(e) => setTotalLoadWeightLbs(e.target.value)} className={fieldInput} />
            </Field>
          )}
          {vis("haul_away") && (
            <Field label="Haul-away units">
              <input type="number" min={0} value={haulAwayUnits} onChange={(e) => setHaulAwayUnits(e.target.value)} className={fieldInput} />
            </Field>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Pricing</h3>
        {preview && (
          <div className="text-[11px] space-y-1 text-[var(--tx)]">
            <div className="font-semibold text-[var(--gold)]">Calculated pre-tax: {formatCurrency(preview.rounded_pre_tax)}</div>
            {preview.access_surcharge > 0 && (
              <div className="text-[var(--tx3)]">Access surcharges (in pre-tax): {formatCurrency(preview.access_surcharge)}</div>
            )}
            <div className="border-t border-[var(--brd)]/40 pt-2 mt-2 space-y-0.5 max-h-40 overflow-y-auto">
              {preview.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-[var(--tx3)]">{b.label}</span>
                  <span>{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-[var(--brd)]/40">
              <span>HST</span>
              <span>{formatCurrency(preview.hst)}</span>
            </div>
            <div className="flex justify-between font-bold text-[var(--gold)]">
              <span>Total</span>
              <span>{formatCurrency(preview.total_with_tax)}</span>
            </div>
          </div>
        )}
        {!preview && !previewLoading && <p className="text-[11px] text-[var(--tx3)]">Enter vertical, route, and items to preview.</p>}
        {previewLoading && <p className="text-[11px] text-[var(--tx3)]">Updating preview…</p>}
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
            Card at booking (typical for one-offs)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="b2b-pay"
              checked={paymentMethod === "invoice"}
              onChange={() => setPaymentMethod("invoice")}
              disabled={!partnerOrgId.trim()}
              className="accent-[var(--gold)]"
            />
            Invoice (partner billing — select an organization)
          </label>
        </div>
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
          onClick={() => void postCreateDelivery("scheduled")}
          className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-90 disabled:opacity-50"
        >
          Create and schedule
        </button>
      </div>
    </div>
  );
}
