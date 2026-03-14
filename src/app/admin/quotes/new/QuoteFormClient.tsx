"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { toTitleCase } from "@/lib/format-text";
import { Home, Building2, ArrowUpRight, Gem, Star, ChevronDown, Check, Send, Eye, Loader2, ChevronRight, PanelRightOpen, PanelRightClose, Users, Clock, Truck, Plus } from "lucide-react";
import InventoryInput, { type InventoryItemEntry } from "@/components/inventory/InventoryInput";

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
  inventory?: { modifier: number; score: number; benchmark: number; totalItems: number };
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
  { value: "local_move", Icon: Home, label: "Residential", desc: "Local or long distance home move" },
  { value: "office_move", Icon: Building2, label: "Office / Commercial", desc: "Business, retail, salon, clinic relocation" },
  { value: "single_item", Icon: ArrowUpRight, label: "Single Item", desc: "One item or small batch delivery" },
  { value: "white_glove", Icon: Gem, label: "White Glove", desc: "Premium handling, assembly, placement" },
  { value: "specialty", Icon: Star, label: "Specialty / Event", desc: "Art, piano, trade show, staging, estate" },
  { value: "b2b_delivery", Icon: Truck, label: "B2B One-Off", desc: "One-off delivery from a business source" },
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

// Frontend-only quick estimate (optimistic, before API call)
function quickEstimate(
  config: Record<string, string>,
  serviceType: string,
  moveSize: string,
  addonTotal: number,
): { curated: number; signature: number; estate: number } | { single: number } | null {
  const BASE: Record<string, number> = {
    studio: 549, "1br": 799, "2br": 1199, "3br": 1699, "4br": 2399, "5br_plus": 3199, partial: 499,
  };
  const rounding = cfgNum(config, "rounding_nearest", 50);

  if (serviceType === "local_move") {
    const base = BASE[moveSize] ?? 1199;
    const cur = Math.max(roundTo(base, rounding) + addonTotal, 549);
    const sig = roundTo(base * cfgNum(config, "tier_signature_multiplier", cfgNum(config, "tier_premier_multiplier", 1.35)), rounding) + addonTotal;
    const est = roundTo(base * cfgNum(config, "tier_estate_multiplier", 1.85), rounding) + addonTotal;
    return { curated: cur, signature: sig, estate: est };
  }
  return null;
}

function roundTo(n: number, nearest: number) {
  return Math.round(n / nearest) * nearest;
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

  // Specialty
  const [projectType, setProjectType] = useState("Custom");
  const [timelineHours, setTimelineHours] = useState(4);
  const [cratingPieces, setCratingPieces] = useState(0);
  const [climateControl, setClimateControl] = useState(false);

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

  // ── Quick optimistic estimate ─────────────
  const liveEstimate = useMemo(
    () => quickEstimate(config, serviceType, moveSize, addonSubtotal),
    [config, serviceType, moveSize, addonSubtotal],
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
      if (clientBoxCount) base.client_box_count = Number(clientBoxCount);
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
      base.project_type = projectType;
      base.timeline_hours = timelineHours;
      base.custom_crating_pieces = cratingPieces > 0 ? cratingPieces : undefined;
      base.climate_control = climateControl;
    }
    return base;
  }, [
    serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, preferredTime, arrivalWindow, hubspotDealId,
    selectedAddons, recommendedTier, moveSize, clientBoxCount, specialtyItems, inventoryItems, sqft, wsCount, hasIt, hasConf,
    hasReception, timingPref, itemDescription, itemCategory, itemWeight, assembly, stairCarry, stairFlights,
    numItems, declaredValue, projectType, timelineHours, cratingPieces, climateControl,
    firstName, lastName, email, phone,
  ]);

  // ── Generate quote (Step 1: creates quote in DB, returns quote_id) ────────────────────────
  const handleGenerate = async () => {
    if (!fromAddress || !toAddress || !moveDate) {
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
            <div className="px-5 py-3 border-b border-[var(--brd)]">
              <h1 className="font-heading text-[18px] font-bold text-[var(--tx)]">Generate Quote</h1>
              <p className="text-[11px] text-[var(--tx3)] mt-0.5">
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
                          <div className={`shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-md transition-colors ${sel ? "bg-white/20" : "bg-[var(--bg)]"}`}>
                            <card.Icon className={`w-3.5 h-3.5 ${sel ? "text-white" : "text-[var(--tx3)]"}`} strokeWidth={1.8} />
                          </div>
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
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Addresses</h3>
                <div className="flex flex-col min-[400px]:flex-row gap-3 items-end">
                  <div className="flex-1 min-w-0 w-full max-w-2xl">
                    <AddressAutocomplete
                      value={fromAddress}
                      onRawChange={setFromAddress}
                      onChange={(r) => setFromAddress(r.fullAddress)}
                      placeholder="Origin address"
                      label="From"
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
              </div>

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 4. Move details ── */}
              <div>
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Move Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Move Date *">
                    <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} required className={fieldInput} />
                  </Field>
                  <Field label="Preferred Time">
                    <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={fieldInput} />
                  </Field>
                  <Field label="Arrival Window">
                    <select value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className={fieldInput}>
                      <option value="morning">Morning (7 AM – 12 PM)</option>
                      <option value="afternoon">Afternoon (12 PM – 5 PM)</option>
                      <option value="full_day">Full Day (7 AM – 5 PM)</option>
                      <option value="evening">Evening (5 PM – 9 PM)</option>
                    </select>
                  </Field>
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

              {/* ── 5b. Inventory (Residential / Long distance / Office) ── */}
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
                <div className="space-y-2">
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty Details</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <Field label="Project Type">
                      <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={`${fieldInput} min-w-0`}>
                        {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Timeline (hrs)">
                      <input type="number" min={1} max={80} value={timelineHours} onChange={(e) => setTimelineHours(Number(e.target.value) || 4)} className={`${fieldInput} w-20 min-w-0`} />
                    </Field>
                    <Field label="Crating (pcs)">
                      <input type="number" min={0} value={cratingPieces} onChange={(e) => setCratingPieces(Number(e.target.value) || 0)} className={`${fieldInput} w-16 min-w-0`} />
                    </Field>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase text-[var(--tx3)] shrink-0">Climate Control</span>
                      <button type="button" role="switch" aria-checked={climateControl} onClick={() => setClimateControl(!climateControl)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${climateControl ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${climateControl ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

              {/* ── 6. Add-ons (popular first, show all expander) ── */}
              {applicableAddons.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Add-Ons</h3>
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

                    <FactorsDisplayCollapsible factors={quoteResult.factors} distance={quoteResult.distance_km} time={quoteResult.drive_time_min} showMultipliers={userRole === "owner" || userRole === "admin"} />
                  </>
                ) : (
                  /* ── Optimistic live preview ── */
                  <>
                    {liveEstimate && "curated" in liveEstimate ? (
                      <OptimisticTiers est={liveEstimate} />
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
                {quoteResult.inventory && quoteResult.inventory.modifier !== 1.0 && (
                  <div className="pt-2 border-t border-[var(--brd)]/50 flex items-center justify-between text-[10px]">
                    <span className="text-[var(--tx3)]">
                      Inventory volume
                      <span className="ml-1 text-[var(--tx)]">
                        ({quoteResult.inventory.totalItems} items, {quoteResult.inventory.modifier < 1 ? "below" : "above"} standard)
                      </span>
                    </span>
                    <span className={`font-mono font-bold ${quoteResult.inventory.modifier < 1 ? "text-emerald-400" : "text-orange-400"}`}>
                      ×{quoteResult.inventory.modifier.toFixed(2)}
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
                  <span className="text-[var(--tx)] font-medium">{inventoryTotalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--tx3)]">Item score</span>
                  <span className="text-[var(--tx)] font-medium tabular-nums">{inventoryScore.toFixed(1)}</span>
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

function OptimisticTiers({ est }: { est: { curated: number; signature: number; estate: number } }) {
  const tiers = [
    { name: "Curated", price: est.curated },
    { name: "Signature", price: est.signature },
    { name: "Estate", price: est.estate },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">Estimated Pricing</p>
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
        Estimate only — generate quote for exact pricing with distance, date &amp; access factors
      </p>
    </div>
  );
}

function FactorsDisplay({
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
  const entries = Object.entries(factors).filter(([, v]) => v !== null && v !== undefined && v !== 0 && v !== 1);
  if (entries.length === 0 && distance == null) return null;

  return (
    <div className="space-y-1.5">
      {distance != null && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--tx3)]">Distance</span>
          <span className="text-[var(--tx)] font-medium">{distance} km ({time ?? "—"} min)</span>
        </div>
      )}
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center justify-between text-[10px]">
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

function FactorsDisplayCollapsible({
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
  const entries = Object.entries(factors).filter(([, v]) => v !== null && v !== undefined && v !== 0 && v !== 1);
  const hasContent = entries.length > 0 || distance != null;
  if (!hasContent) return null;

  return (
    <details className="pt-3 border-t border-[var(--brd)] group" defaultValue={undefined}>
      <summary className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] cursor-pointer select-none flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180 shrink-0" />
        Factors applied
      </summary>
      <div className="mt-2">
        <FactorsDisplay factors={factors} distance={distance} time={time} showMultipliers={showMultipliers} />
      </div>
    </details>
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
