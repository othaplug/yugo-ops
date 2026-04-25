"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Check,
  FloppyDisk,
  Sun,
  SunHorizon as Sunset,
  Clock,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  B2B_PARTNER_TIME_WINDOW_OPTIONS,
  TIME_WINDOW_OPTIONS,
} from "@/lib/time-windows";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { Plus, Trash as Trash2 } from "@phosphor-icons/react";
import type { VehicleType, DayType } from "@/lib/delivery-day-booking";
import { calcHST } from "@/lib/format-currency";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";
import { InfoHint } from "@/components/ui/InfoHint";
import { WINE } from "@/lib/client-theme";
import { partnerModalPanelClass } from "@/components/partner/PartnerChrome";
import { getPartnerPortalTerminology } from "@/lib/partner-vertical-copy";

const VEHICLE_TYPES: { value: VehicleType; label: string; capacity: string; payload: string }[] = [
  { value: "sprinter", label: "Cargo Van (Sprinter)", capacity: "370 cu ft", payload: "3,500 lbs" },
  { value: "16ft", label: "16ft Truck", capacity: "800 cu ft", payload: "5,000 lbs" },
  { value: "20ft", label: "20ft Truck", capacity: "1,100 cu ft", payload: "7,000 lbs" },
  { value: "26ft", label: "26ft Truck", capacity: "1,600 cu ft", payload: "10,000 lbs" },
];

const DAY_RATE_STEPS = [
  { id: 1, label: "Vehicle",   description: "Select vehicle & duration" },
  { id: 2, label: "Options",   description: "Stops, surcharges & add-ons" },
  { id: 3, label: "Schedule",  description: "Date, time & stop addresses" },
  { id: 4, label: "Review",    description: "Confirm & submit your day" },
];

interface DayStop {
  id: string;
  address: string;
  customerName: string;
  customerPhone: string;
  instructions: string;
}

const DAY_TIME_WINDOWS = B2B_PARTNER_TIME_WINDOW_OPTIONS.map((value, i) => {
  const paren = value.match(/\(([^)]+)\)/);
  const range = paren ? paren[1] : value;
  const label = value.split(" (")[0]?.trim() || value;
  const Icon = i <= 2 ? Sun : i <= 4 ? Sunset : Clock;
  return { value, label, range, Icon };
});

type DayTimeWindow = string;

const PER_DELIVERY_STEPS = [
  { id: 1, label: "Delivery", description: "Type, zone & item details" },
  { id: 2, label: "Details", description: "Client, address & schedule" },
  { id: 3, label: "Review", description: "Confirm & submit" },
];

interface Props {
  orgId: string;
  orgType: string;
  onClose: () => void;
  onCreated: () => void;
  initialDate?: string;
  initialItems?: string;
  /** Default warehouse / business pickup when using vertical booking */
  defaultPickupAddress?: string;
}

const B2B_HANDLING_OPTIONS = [
  { value: "white_glove", label: "White Glove" },
  { value: "room_of_choice", label: "Room of Choice" },
  { value: "threshold", label: "Threshold" },
] as const;

function mergeB2bHandling(items: { handling: string }[]): string {
  if (items.some((i) => i.handling === "white_glove")) return "white_glove";
  if (items.some((i) => i.handling === "room_of_choice")) return "room_of_choice";
  return "threshold";
}

interface PriceResult {
  basePrice: number;
  overagePrice: number;
  servicesPrice: number;
  zoneSurcharge: number;
  afterHoursSurcharge: number;
  distanceOverage: number;
  heavyItemSurcharge: number;
  volumeDiscount: number;
  totalPrice: number;
  breakdown: { label: string; amount: number; detail?: string }[];
  effectivePerStop?: number;
}

interface HeavyItem {
  tier: "250_400" | "400_600";
  count: number;
}

interface ServiceOption {
  slug: string;
  service_name: string;
  price_min: number;
  price_max: number | null;
  price_unit: string;
}

export default function PartnerScheduleModal({
  orgId,
  orgType,
  onClose,
  onCreated,
  initialDate = "",
  initialItems,
  defaultPickupAddress = "",
}: Props) {
  const portalTerms = useMemo(
    () => getPartnerPortalTerminology(orgType),
    [orgType],
  );
  const deliveryTypeOptions = portalTerms.deliveryTypeRows;
  const complexityPresets = portalTerms.complexityPresetOptions;
  const [bookingType, setBookingType] = useState<"day_rate" | "per_delivery">("day_rate");
  const [dayRateStep, setDayRateStep] = useState(1);
  const [perDeliveryStep, setPerDeliveryStep] = useState(1);

  const step = bookingType === "day_rate" ? dayRateStep : perDeliveryStep;
  const steps = bookingType === "day_rate" ? DAY_RATE_STEPS : PER_DELIVERY_STEPS;
  const currentStep = steps.find((s) => s.id === step)!;

  // Day rate fields
  const INCLUDED_STOPS: Record<DayType, number> = { full_day: 6, half_day: 3 };
  const [vehicleType, setVehicleType] = useState<VehicleType>("sprinter");
  const [dayType, setDayType] = useState<DayType>("full_day");
  const [numStops, setNumStops] = useState(INCLUDED_STOPS.full_day);

  // Day rate — schedule & stops (steps 3+4)
  const [dayScheduledDate, setDayScheduledDate] = useState(initialDate);
  const [dayTimeWindow, setDayTimeWindow] = useState<DayTimeWindow>(
    B2B_PARTNER_TIME_WINDOW_OPTIONS[0] ?? "",
  );
  const [dayPickupAddress, setDayPickupAddress] = useState("");
  const [dayPickupRaw, setDayPickupRaw] = useState("");
  const [dayStops, setDayStops] = useState<DayStop[]>(() =>
    Array.from({ length: 3 }, (_, i) => ({ id: `ds${i}`, address: "", customerName: "", customerPhone: "", instructions: "" }))
  );
  const [dayRateSubmitting, setDayRateSubmitting] = useState(false);

  // Per-delivery fields
  const [deliveryType, setDeliveryType] = useState("single_item");
  const [zone, setZone] = useState(1);
  const [heavyItems, setHeavyItems] = useState<HeavyItem[]>([]);
  const [deliveryAccess, setDeliveryAccess] = useState("elevator");
  const [itemWeightCategory, setItemWeightCategory] = useState("standard");

  // Common
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    pickup_address: "",
    delivery_address: "",
    scheduled_date: initialDate,
    preferred_time: "",
    delivery_window: "",
    items: "",
    instructions: "",
    access_notes: "",
    internal_notes: "",
    special_handling: false,
    complexityIndicators: [] as string[],
  });
  const [inventory, setInventory] = useState<string[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [inventoryBulkMode, setInventoryBulkMode] = useState(false);
  const [inventoryBulkText, setInventoryBulkText] = useState("");
  const [pickupRaw, setPickupRaw] = useState("");
  const [deliveryRaw, setDeliveryRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [isWeekend, setIsWeekend] = useState(false);

  // Services
  const [availableServices, setAvailableServices] = useState<ServiceOption[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<string, { enabled: boolean; quantity: number }>>({});
  const [stairFlights, setStairFlights] = useState(1);

  const [partnerB2bVerticals, setPartnerB2bVerticals] = useState<{ code: string; name: string }[]>([]);
  const [b2bVerticalCode, setB2bVerticalCode] = useState("");
  const [b2bItems, setB2bItems] = useState<
    { id: string; description: string; quantity: number; handling: string }[]
  >([{ id: "bi0", description: "", quantity: 1, handling: "threshold" }]);
  const [b2bAssembly, setB2bAssembly] = useState(false);
  const [b2bDebris, setB2bDebris] = useState(false);
  const [b2bPreview, setB2bPreview] = useState<{
    partner_subtotal: number;
    standard_subtotal: number;
    vertical_name: string;
    breakdown: { label: string; amount: number }[];
  } | null>(null);
  const [b2bPreviewLoading, setB2bPreviewLoading] = useState(false);
  const [useDefaultPickup, setUseDefaultPickup] = useState(true);

  const b2bActive = partnerB2bVerticals.length > 0;

  const pickupResolved = useMemo(() => {
    const d = (defaultPickupAddress || "").trim();
    if (useDefaultPickup && d) return d;
    return (form.pickup_address || "").trim();
  }, [useDefaultPickup, defaultPickupAddress, form.pickup_address]);

  // Pricing
  const [pricing, setPricing] = useState<PriceResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const setCustomerPhone = useCallback((v: string) => setForm((f) => ({ ...f, customer_phone: v })), []);
  const schedulePhoneInput = usePhoneInput(form.customer_phone, setCustomerPhone);

  useEffect(() => { if (initialDate) setForm((f) => ({ ...f, scheduled_date: initialDate })); }, [initialDate]);
  useEffect(() => { if (initialItems) setForm((f) => ({ ...f, items: initialItems })); }, [initialItems]);

  useEffect(() => {
    fetch(`/api/partner/deliveries/services?org_id=${orgId}`)
      .then((r) => r.json())
      .then((d) => { if (d.services) setAvailableServices(d.services); })
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    fetch("/api/partner/b2b-verticals")
      .then((r) => r.json())
      .then((d) => {
        const v = Array.isArray(d.verticals) ? d.verticals as { code: string; name: string }[] : [];
        setPartnerB2bVerticals(v);
        if (v.length > 0) {
          setB2bVerticalCode((prev) => (prev && v.some((x) => x.code === prev) ? prev : v[0]!.code));
        }
      })
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!b2bActive || bookingType !== "per_delivery") return;
    const t = setTimeout(async () => {
      if (!b2bVerticalCode || !form.delivery_address.trim() || !pickupResolved) {
        setB2bPreview(null);
        return;
      }
      const lines = b2bItems.filter((i) => i.description.trim());
      if (lines.length === 0) {
        setB2bPreview(null);
        return;
      }
      setB2bPreviewLoading(true);
      try {
        const res = await fetch("/api/partner/deliveries/b2b-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vertical_code: b2bVerticalCode,
            pickup_address: pickupResolved,
            delivery_address: form.delivery_address.trim(),
            delivery_access: deliveryAccess,
            handling_type: mergeB2bHandling(lines),
            items: lines.map((i) => ({
              description: i.description.trim(),
              quantity: i.quantity,
            })),
            assembly_required: b2bAssembly,
            debris_removal: b2bDebris,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setB2bPreview(null);
          return;
        }
        setB2bPreview({
          partner_subtotal: Number(data.partner_subtotal) || 0,
          standard_subtotal: Number(data.standard_subtotal) || 0,
          vertical_name: String(data.vertical_name || ""),
          breakdown: Array.isArray(data.breakdown) ? data.breakdown : [],
        });
      } catch {
        setB2bPreview(null);
      } finally {
        setB2bPreviewLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [
    b2bActive,
    bookingType,
    b2bVerticalCode,
    b2bItems,
    b2bAssembly,
    b2bDebris,
    form.delivery_address,
    pickupResolved,
    deliveryAccess,
  ]);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingError("");
    try {
      const svcList = Object.entries(selectedServices)
        .filter(([, v]) => v.enabled)
        .map(([slug, v]) => ({ slug, quantity: slug === "stair_carry" ? stairFlights : v.quantity }));
      const res = await fetch("/api/partner/deliveries/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_type: bookingType,
          vehicle_type: vehicleType,
          day_type: dayType,
          num_stops: numStops,
          delivery_type: deliveryType,
          zone,
          services: svcList,
          is_after_hours: isAfterHours,
          is_weekend: isWeekend,
          heavy_items: heavyItems.filter((h) => h.count > 0),
          delivery_access: bookingType === "per_delivery" ? deliveryAccess : undefined,
          item_weight_category: bookingType === "per_delivery" ? itemWeightCategory : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) { setPricing(data); setPricingError(""); }
      else { setPricing(null); setPricingError(data.error || "Pricing unavailable"); }
    } catch {
      setPricing(null);
      setPricingError("Unable to reach pricing service");
    } finally {
      setPricingLoading(false);
    }
  }, [bookingType, vehicleType, dayType, numStops, deliveryType, zone, selectedServices, stairFlights, isAfterHours, isWeekend, heavyItems, deliveryAccess, itemWeightCategory]);

  // Auto-refresh pricing on step 2 (day rate) or per-delivery legacy (no B2B verticals)
  useEffect(() => {
    const shouldFetch =
      (bookingType === "day_rate" && dayRateStep === 2) ||
      (bookingType === "per_delivery" && !b2bActive && (perDeliveryStep === 1 || perDeliveryStep === 3));
    if (!shouldFetch) return;
    const t = setTimeout(fetchPricing, 400);
    return () => clearTimeout(t);
  }, [fetchPricing, bookingType, dayRateStep, perDeliveryStep, b2bActive]);

  const addInventoryItem = () => {
    if (!newItemName.trim()) return;
    const name = newItemName.trim();
    setInventory((prev) => [...prev, newItemQty > 1 ? `${name} x${newItemQty}` : name]);
    setNewItemName(""); setNewItemQty(1);
  };
  const removeInventoryItem = (idx: number) => setInventory((prev) => prev.filter((_, i) => i !== idx));
  const parseBulkLines = (text: string) =>
    text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.+?)\s+x(\d+)$/i);
      return m ? `${m[1].trim()} x${m[2]}` : l;
    });
  const addBulkInventoryItems = () => {
    if (!inventoryBulkText.trim()) return;
    setInventory((prev) => [...prev, ...parseBulkLines(inventoryBulkText)]);
    setInventoryBulkText("");
  };
  const toggleComplexity = (preset: string) =>
    setForm((f) => ({
      ...f,
      complexityIndicators: f.complexityIndicators.includes(preset)
        ? f.complexityIndicators.filter((p) => p !== preset)
        : [...f.complexityIndicators, preset],
    }));
  const toggleService = (slug: string) =>
    setSelectedServices((s) => ({ ...s, [slug]: { enabled: !s[slug]?.enabled, quantity: s[slug]?.quantity || 1 } }));

  const buildPayload = (overrides?: Record<string, unknown>) => {
    const b2bLines = b2bActive
      ? b2bItems.filter((i) => i.description.trim())
      : [];
    const itemsList =
      b2bActive && b2bLines.length > 0
        ? b2bLines.map((i) => `${i.description.trim()}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
        : inventory.length > 0
          ? inventory
          : form.items
            ? form.items.split("\n").map((l) => l.trim()).filter(Boolean)
            : [];
    const svcList = Object.entries(selectedServices)
      .filter(([, v]) => v.enabled)
      .map(([slug, v]) => ({ slug, quantity: slug === "stair_carry" ? stairFlights : v.quantity }));
    return {
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim() || null,
      customer_phone: form.customer_phone.trim() ? normalizePhone(form.customer_phone) : null,
      pickup_address: form.pickup_address.trim() || null,
      delivery_address: form.delivery_address.trim(),
      scheduled_date: form.scheduled_date || null,
      time_slot: null,
      preferred_time: form.preferred_time.trim() || null,
      delivery_window: form.delivery_window || null,
      items: itemsList,
      instructions: [form.instructions, form.access_notes, form.internal_notes].filter(Boolean).join("\n") || null,
      special_handling: form.special_handling,
      complexity_indicators: form.complexityIndicators.length ? form.complexityIndicators : null,
      booking_type: bookingType,
      vehicle_type: bookingType === "day_rate" ? vehicleType : null,
      day_type: bookingType === "day_rate" ? dayType : null,
      num_stops: bookingType === "day_rate" ? numStops : null,
      delivery_type: bookingType === "per_delivery" ? deliveryType : null,
      zone: bookingType === "per_delivery" ? zone : null,
      delivery_access: bookingType === "per_delivery" ? deliveryAccess : null,
      item_weight_category: bookingType === "per_delivery" ? itemWeightCategory : null,
      base_price: b2bActive ? (b2bPreview?.partner_subtotal ?? 0) : (pricing?.basePrice || 0),
      overage_price: b2bActive ? 0 : (pricing?.overagePrice || 0),
      services_price: b2bActive ? 0 : (pricing?.servicesPrice || 0),
      zone_surcharge: b2bActive ? 0 : (pricing?.zoneSurcharge || 0),
      after_hours_surcharge: b2bActive ? 0 : (pricing?.afterHoursSurcharge || 0),
      total_price: b2bActive ? (b2bPreview?.partner_subtotal ?? 0) : (pricing?.totalPrice || 0),
      services_selected: b2bActive ? [] : svcList,
      pricing_breakdown: b2bActive ? (b2bPreview?.breakdown ?? null) : (pricing?.breakdown || null),
      ...(b2bActive && b2bVerticalCode
        ? {
            vertical_code: b2bVerticalCode,
            b2b_line_items: b2bLines.map((i) => ({
              description: i.description.trim(),
              quantity: i.quantity,
              handling: i.handling,
            })),
            b2b_assembly_required: b2bAssembly,
            b2b_debris_removal: b2bDebris,
            pickup_address: pickupResolved || null,
          }
        : {}),
      ...overrides,
    };
  };

  const handleSaveDraft = async () => {
    if (!form.customer_name.trim()) { setError("Customer name is required to save a draft"); return; }
    setSavingDraft(true); setError("");
    try {
      const res = await fetch("/api/partner/deliveries/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload({ status: "draft" })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save draft");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setSavingDraft(false); }
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { setError("Customer name is required"); return; }
    if (!form.delivery_address.trim()) { setError("Delivery address is required"); return; }
    if (!form.scheduled_date) { setError("Date is required"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/partner/deliveries/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create delivery");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setSubmitting(false); }
  };

  const handleDayRateSubmit = async () => {
    if (!dayScheduledDate) { setError("Date is required"); return; }
    setDayRateSubmitting(true);
    setError("");
    const svcList = Object.entries(selectedServices)
      .filter(([, v]) => v.enabled)
      .map(([slug, v]) => ({ slug, quantity: slug === "stair_carry" ? stairFlights : v.quantity }));
    const stopsPayload = dayStops.map((s, i) => ({
      stop_number: i + 1,
      address: s.address,
      customer_name: s.customerName || null,
      customer_phone: s.customerPhone ? normalizePhone(s.customerPhone) : null,
      special_instructions: s.instructions || null,
    }));
    const payload = {
      customer_name: dayStops.find((s) => s.customerName)?.customerName || "Day Rate Delivery",
      pickup_address: dayPickupAddress || null,
      delivery_address: dayStops[0]?.address || "",
      scheduled_date: dayScheduledDate,
      delivery_window: dayTimeWindow,
      booking_type: "day_rate",
      vehicle_type: vehicleType,
      day_type: dayType,
      num_stops: dayStops.length,
      stops: stopsPayload,
      stops_detail: stopsPayload,
      base_price: pricing?.basePrice || 0,
      overage_price: pricing?.overagePrice || 0,
      services_price: pricing?.servicesPrice || 0,
      zone_surcharge: pricing?.zoneSurcharge || 0,
      after_hours_surcharge: pricing?.afterHoursSurcharge || 0,
      total_price: pricing?.totalPrice || 0,
      services_selected: svcList,
    };
    try {
      const res = await fetch("/api/partner/deliveries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create delivery day");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDayRateSubmitting(false);
    }
  };

  const handleBack = () => {
    setError("");
    if (bookingType === "day_rate") {
      if (dayRateStep > 1) setDayRateStep((s) => s - 1);
      else onClose();
    } else {
      if (perDeliveryStep > 1) setPerDeliveryStep((s) => s - 1);
      else onClose();
    }
  };

  const handleContinue = () => {
    setError("");
    if (bookingType === "day_rate") {
      if (dayRateStep === 2) {
        // Sync stop count from the num-stops counter when entering step 3
        setDayStops((prev) => {
          if (prev.length === numStops) return prev;
          if (prev.length < numStops)
            return [...prev, ...Array.from({ length: numStops - prev.length }, (_, i) => ({ id: `ds${Date.now()}${i}`, address: "", customerName: "", customerPhone: "", instructions: "" }))];
          return prev.slice(0, numStops);
        });
      }
      if (dayRateStep < 4) { setDayRateStep((s) => s + 1); return; }
      handleDayRateSubmit();
    } else {
      if (perDeliveryStep < 3) {
        if (b2bActive && perDeliveryStep === 1) {
          const lines = b2bItems.filter((i) => i.description.trim());
          if (lines.length === 0) {
            setError("Add at least one item with a description.");
            return;
          }
          if (!b2bVerticalCode) {
            setError("Select a delivery type.");
            return;
          }
        }
        if (perDeliveryStep === 2 && !b2bActive) fetchPricing();
        setPerDeliveryStep((s) => s + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const switchTab = (type: "day_rate" | "per_delivery") => {
    setBookingType(type);
    setError("");
  };

  const fieldInput =
    "field-input-compact w-full";
  const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const isLastStep =
    (bookingType === "day_rate" && dayRateStep === 4) ||
    (bookingType === "per_delivery" && perDeliveryStep === 3);

  const modalContent = (
    <ModalDialogFrame
      zClassName="z-[99999]"
      backdropClassName=""
      onBackdropClick={onClose}
      panelClassName={`${partnerModalPanelClass} w-full max-w-[640px] overflow-hidden mx-0 sm:mx-4 flex flex-col sheet-card sm:modal-card`}
      panelStyle={{ maxHeight: "min(92dvh, 92vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
        {/* ── Header ── */}
        <div className="shrink-0 border-b border-[#2C3E2D]/10">
          <div className="px-5 sm:px-6 pt-5 pb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]/80 mb-1.5">
                {bookingType === "day_rate" ? "Day booking" : "Per delivery"}
                <span className="text-[var(--tx3)] mx-1.5" aria-hidden>
                  —
                </span>
                {currentStep.description}
              </p>
              <h2 className="font-hero text-[24px] sm:text-[28px] font-normal text-[#5C1A33] leading-[1.1] tracking-tight">
                {currentStep.label}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-sm border border-transparent hover:border-[#2C3E2D]/15 hover:bg-[#2C3E2D]/[0.03] text-[#5A6B5E] hover:text-[var(--tx)] transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={18} weight="regular" />
            </button>
          </div>

          <div className="flex px-5 sm:px-6 gap-6 border-b border-[#2C3E2D]/10">
            {(["day_rate", "per_delivery"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={`relative pb-3 pt-0 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors active:bg-[#5C1A33]/[0.06] rounded-sm ${
                  bookingType === tab ? "text-[#5C1A33]" : "text-[#5A6B5E] hover:text-[var(--tx2)]"
                }`}
              >
                {tab === "day_rate" ? "Day rate" : "Per delivery"}
                {bookingType === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-[#5C1A33]" />
                )}
              </button>
            ))}
          </div>

          <div className="px-5 sm:px-6 py-3.5">
            <nav
              className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[9px] font-bold tracking-[0.12em] uppercase"
              aria-label="Booking steps"
            >
              {steps.map((s, i) => (
                <span key={s.id} className="contents">
                  {i > 0 ? (
                    <span className="text-[var(--tx3)] px-0.5 select-none" aria-hidden>
                      —
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (bookingType === "day_rate" && s.id < dayRateStep) setDayRateStep(s.id);
                      if (bookingType === "per_delivery" && s.id < perDeliveryStep) setPerDeliveryStep(s.id);
                    }}
                    className={`inline-flex items-center gap-1 rounded-sm px-2 py-1.5 transition-colors ${
                      step === s.id
                        ? "bg-[#5C1A33] text-[#FFFBF7] shadow-sm"
                        : step > s.id
                          ? "text-[var(--tx3)] hover:text-[#5C1A33]/90"
                          : "text-[#5A6B5E]/50"
                    }`}
                    style={{ cursor: s.id < step ? "pointer" : "default" }}
                  >
                    {step > s.id ? (
                      <Check size={11} weight="bold" className="text-[#5A6B5E] shrink-0" aria-hidden />
                    ) : null}
                    {s.label}
                  </button>
                </span>
              ))}
            </nav>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-6 py-6 space-y-8 min-h-0">
          {error && (
            <div className="py-2.5 border-b border-red-500/25 text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* ═══ Day Rate Step 3: Schedule & Stops ═══ */}
          {bookingType === "day_rate" && dayRateStep === 3 && (
            <div className="space-y-6">
              <section className="space-y-2">
                <SectionLabel>Date</SectionLabel>
                <input
                  type="date"
                  value={dayScheduledDate}
                  onChange={(e) => setDayScheduledDate(e.target.value)}
                  className={fieldInput}
                />
              </section>

              <section className="space-y-3">
                <SectionLabel>Time window</SectionLabel>
                <div className="grid grid-cols-3 border border-[#2C3E2D]/15 divide-x divide-[#2C3E2D]/10 rounded-sm overflow-hidden">
                  {DAY_TIME_WINDOWS.map(({ value, label, range, Icon }) => {
                    const active = dayTimeWindow === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDayTimeWindow(value)}
                        className={`flex flex-col items-center justify-center gap-0.5 py-3 px-1.5 text-center transition-colors active:scale-[0.99] ${
                          active ? "bg-[#5C1A33]/[0.08]" : "bg-transparent hover:bg-[#5C1A33]/[0.04]"
                        }`}
                      >
                        <Icon
                          size={14}
                          weight={active ? "fill" : "regular"}
                          className={active ? "text-[#5C1A33]" : "text-[#5A6B5E]"}
                          aria-hidden
                        />
                        <span className={`text-[10px] font-bold tracking-[0.08em] uppercase ${active ? "text-[#5C1A33]" : "text-[#5A6B5E]"}`}>
                          {label}
                        </span>
                        <span className="text-[9px] font-normal normal-case tracking-normal text-[#5A6B5E]/85 hidden sm:block">
                          {range}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <SectionLabel>Pickup Address</SectionLabel>
                <AddressAutocomplete
                  value={dayPickupAddress || dayPickupRaw}
                  onRawChange={(v) => { setDayPickupRaw(v); setDayPickupAddress(v); }}
                  onChange={(r) => { setDayPickupAddress(r.fullAddress); setDayPickupRaw(r.fullAddress); }}
                  placeholder="Warehouse or store"
                  className={fieldInput}
                />
              </section>

              {dayStops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="pt-6 border-t border-[#2C3E2D]/10 first:border-t-0 first:pt-0 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] flex items-center gap-2">
                      <span className="w-5 h-5 rounded-sm border border-[#2C3E2D]/30 text-[var(--tx)] text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {idx + 1}
                      </span>
                      Stop {idx + 1}
                    </h4>
                    {dayStops.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDayStops((p) => p.filter((_, i) => i !== idx))}
                        className="text-[var(--tx3)] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <AddressAutocomplete
                    value={stop.address}
                    onRawChange={(raw) => setDayStops((p) => p.map((s, i) => i === idx ? { ...s, address: raw } : s))}
                    onChange={(r) => setDayStops((p) => p.map((s, i) => i === idx ? { ...s, address: r.fullAddress } : s))}
                    placeholder="Delivery address"
                    className={fieldInput}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={stop.customerName}
                      onChange={(e) => setDayStops((p) => p.map((s, i) => i === idx ? { ...s, customerName: e.target.value } : s))}
                      placeholder="Customer name"
                      className={fieldInput}
                    />
                    <input
                      value={stop.customerPhone}
                      onChange={(e) => setDayStops((p) => p.map((s, i) => i === idx ? { ...s, customerPhone: e.target.value } : s))}
                      placeholder={PHONE_PLACEHOLDER}
                      className={fieldInput}
                    />
                  </div>
                  <textarea
                    value={stop.instructions}
                    onChange={(e) => setDayStops((p) => p.map((s, i) => i === idx ? { ...s, instructions: e.target.value } : s))}
                    placeholder="Special instructions for this stop…"
                    rows={1}
                    className={`${fieldInput} resize-y`}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => setDayStops((p) => [...p, { id: `ds${Date.now()}`, address: "", customerName: "", customerPhone: "", instructions: "" }])}
                className="w-full py-2 text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add another stop
              </button>
            </div>
          )}

          {/* ═══ Day Rate Step 4: Review ═══ */}
          {bookingType === "day_rate" && dayRateStep === 4 && (
            <div className="space-y-0 divide-y divide-[#2C3E2D]/10">
              <div className="pb-5 space-y-3">
                {[
                  ["Date",     dayScheduledDate || "—"],
                  ["Time",     DAY_TIME_WINDOWS.find((w) => w.value === dayTimeWindow)?.label ?? dayTimeWindow],
                  ["Vehicle",  VEHICLE_TYPES.find((v) => v.value === vehicleType)?.label ?? vehicleType],
                  ["Duration", dayType === "full_day" ? "Full Day" : "Half Day"],
                  ["Stops",    String(dayStops.length)],
                  ["Pickup",   dayPickupAddress || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 text-[13px]">
                    <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] shrink-0">{k}</span>
                    <span className="text-[#1a1f1b] text-right max-w-[65%] font-medium leading-snug">{v}</span>
                  </div>
                ))}
              </div>

              {dayStops.filter((s) => s.address).map((stop, idx) => (
                <div key={stop.id} className="py-5 space-y-1.5 first:pt-0">
                  <h4 className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm border border-[#2C3E2D]/30 text-[var(--tx)] text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    Stop {idx + 1}
                  </h4>
                  <p className="text-[13px] text-[#1a1f1b] leading-snug">{stop.address}</p>
                  {stop.customerName && (
                    <p className="text-[12px] text-[#5A6B5E]">
                      {stop.customerName}{stop.customerPhone ? ` · ${formatPhone(stop.customerPhone)}` : ""}
                    </p>
                  )}
                  {stop.instructions && <p className="text-[12px] text-[#5A6B5E]">{stop.instructions}</p>}
                </div>
              ))}

              <div className="pt-5 space-y-3">
                {renderPricePreview()}
                <div className="flex justify-center pt-1">
                  <InfoHint ariaLabel="Partner pricing">
                    Your rates are locked in per your partnership agreement.
                  </InfoHint>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Day Rate Step 1: Vehicle & Duration ═══ */}
          {bookingType === "day_rate" && dayRateStep === 1 && (
            <div className="space-y-6">
              <section className="space-y-3">
                <SectionLabel>Vehicle</SectionLabel>
                <div className="grid grid-cols-2 gap-px bg-[#2C3E2D]/10 rounded-sm overflow-hidden border border-[#2C3E2D]/10">
                  {VEHICLE_TYPES.map((v) => {
                    const sel = vehicleType === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVehicleType(v.value as VehicleType)}
                        className={`relative text-left px-3 py-3 transition-colors ${
                          sel ? "" : "bg-[#FFFBF7] hover:bg-[#2C3E2D]/[0.03]"
                        }`}
                        style={sel ? { backgroundColor: WINE } : undefined}
                      >
                        <div
                          className={`text-[12px] font-semibold leading-tight ${
                            sel ? "text-[#FFFBF7]" : "text-[#1a1f1b]"
                          }`}
                        >
                          {v.label}
                        </div>
                        <div
                          className={`text-[10px] mt-1 ${sel ? "text-[#F9EDE4]/85" : "text-[#5A6B5E]"}`}
                        >
                          {v.capacity}
                        </div>
                        <div
                          className={`text-[10px] ${sel ? "text-[#F9EDE4]/75" : "text-[#5A6B5E]/90"}`}
                        >
                          Max payload: {v.payload}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel>Duration</SectionLabel>
                <div className="grid grid-cols-2 gap-px bg-[#2C3E2D]/10 rounded-sm overflow-hidden border border-[#2C3E2D]/10">
                  {([["full_day", "Full Day", "6 stops incl."], ["half_day", "Half Day", "3 stops incl."]] as const).map(([val, label, desc]) => {
                    const sel = dayType === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setDayType(val); setNumStops(INCLUDED_STOPS[val]); }}
                        className={`relative text-left px-3 py-3 transition-colors ${
                          sel ? "" : "bg-[#FFFBF7] hover:bg-[#2C3E2D]/[0.03]"
                        }`}
                        style={sel ? { backgroundColor: WINE } : undefined}
                      >
                        <div
                          className={`text-[12px] font-semibold leading-tight ${
                            sel ? "text-[#FFFBF7]" : "text-[#1a1f1b]"
                          }`}
                        >
                          {label}
                        </div>
                        <div
                          className={`text-[10px] mt-1 ${sel ? "text-[#F9EDE4]/85" : "text-[#5A6B5E]"}`}
                        >
                          {desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ═══ Day Rate Step 2: Options ═══ */}
          {bookingType === "day_rate" && dayRateStep === 2 && (
            <div className="space-y-6">
              <section className="space-y-2">
                <SectionLabel>Number of Stops</SectionLabel>
                {(() => {
                  const included = dayType === "full_day" ? 6 : 3;
                  const overage = Math.max(0, numStops - included);
                  return (
                    <>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setNumStops((n) => Math.max(included, n - 1))}
                          disabled={numStops <= included}
                          className="w-10 h-10 rounded-sm border border-[#2C3E2D]/20 flex items-center justify-center text-[#5A6B5E] hover:bg-[#2C3E2D]/[0.04] text-lg font-light disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="text-[26px] font-normal text-[var(--tx)] w-10 text-center font-hero tabular-nums">{numStops}</span>
                        <button
                          type="button"
                          onClick={() => setNumStops((n) => n + 1)}
                          className="w-10 h-10 rounded-sm border border-[#2C3E2D]/20 flex items-center justify-center text-[#5A6B5E] hover:bg-[#2C3E2D]/[0.04] text-lg font-light"
                        >
                          +
                        </button>
                        <div>
                          <div className="text-[12px] text-[var(--tx3)]">stops for the day</div>
                          <div className="text-[10px] text-[var(--tx3)]">{included} included with {dayType === "full_day" ? "Full Day" : "Half Day"}</div>
                        </div>
                      </div>
                      {overage > 0 && (
                        <p className="text-[11px] text-amber-500 flex items-center gap-1.5 mt-1">
                          <span className="font-bold">+{overage} extra stop{overage > 1 ? "s" : ""}</span>
                          <span className="text-[var(--tx3)]">beyond included, overage rates apply</span>
                        </p>
                      )}
                    </>
                  );
                })()}
              </section>

              {renderSurcharges()}
              {renderServicesSection()}
              {renderPricePreview()}
            </div>
          )}

          {/* ═══ Per Delivery Step 1: Delivery Config ═══ */}
          {bookingType === "per_delivery" && perDeliveryStep === 1 && (
            <div className="space-y-6">
              {b2bActive ? (
                <>
                  <section className="space-y-2">
                    <SectionLabel>Delivery Type</SectionLabel>
                    <select
                      value={b2bVerticalCode}
                      onChange={(e) => setB2bVerticalCode(e.target.value)}
                      className={fieldInput}
                    >
                      {partnerB2bVerticals.map((v) => (
                        <option key={v.code} value={v.code}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[var(--tx3)]">
                      Only categories configured for your account are shown. Contact your coordinator to add more.
                    </p>
                  </section>

                  <section className="space-y-3">
                    <SectionLabel>Items</SectionLabel>
                    {b2bItems.map((row, idx) => (
                      <div key={row.id} className="py-4 border-t border-[#2C3E2D]/10 first:border-t-0 first:pt-0 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[11px] font-semibold text-[var(--tx3)]">Item {idx + 1}</span>
                          {b2bItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setB2bItems((p) => p.filter((x) => x.id !== row.id))}
                              className="text-[11px] text-[var(--tx3)] hover:text-red-500"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          value={row.description}
                          onChange={(e) =>
                            setB2bItems((p) =>
                              p.map((x) => (x.id === row.id ? { ...x, description: e.target.value } : x)),
                            )
                          }
                          placeholder="Description"
                          className={fieldInput}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-[var(--tx3)] mb-1">Quantity</label>
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) =>
                                setB2bItems((p) =>
                                  p.map((x) =>
                                    x.id === row.id ? { ...x, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) } : x,
                                  ),
                                )
                              }
                              className={fieldInput}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--tx3)] mb-1">Handling</label>
                            <select
                              value={row.handling}
                              onChange={(e) =>
                                setB2bItems((p) =>
                                  p.map((x) => (x.id === row.id ? { ...x, handling: e.target.value } : x)),
                                )
                              }
                              className={fieldInput}
                            >
                              {B2B_HANDLING_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setB2bItems((p) => [
                          ...p,
                          { id: `bi${Date.now()}`, description: "", quantity: 1, handling: "threshold" },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--tx)] mt-1"
                    >
                      <Plus className="w-4 h-4" /> Add item
                    </button>
                  </section>

                  <section className="space-y-2">
                    <SectionLabel>Access at delivery</SectionLabel>
                    <p className="text-[10px] text-[var(--tx3)] -mt-1">Elevator, stairs, loading dock, etc.</p>
                    <select value={deliveryAccess} onChange={(e) => setDeliveryAccess(e.target.value)} className={fieldInput}>
                      <option value="elevator">Elevator</option>
                      <option value="ground_floor">Ground Floor / Loading Dock</option>
                      <option value="loading_dock">Loading Dock</option>
                      <option value="walk_up_2nd">Walk-up (2nd floor)</option>
                      <option value="walk_up_3rd">Walk-up (3rd floor)</option>
                      <option value="walk_up_4th_plus">Walk-up (4th+ floor)</option>
                      <option value="long_carry">Long Carry (50m+)</option>
                      <option value="narrow_stairs">Narrow Stairs</option>
                      <option value="no_parking">No Parking Nearby</option>
                    </select>
                  </section>

                  <section className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={b2bAssembly}
                        onChange={(e) => setB2bAssembly(e.target.checked)}
                        className="rounded border-[var(--brd)] text-[var(--tx)]"
                      />
                      <span className="text-[13px] text-[var(--tx)]">Assembly required (priced per vertical)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={b2bDebris}
                        onChange={(e) => setB2bDebris(e.target.checked)}
                        className="rounded border-[var(--brd)] text-[var(--tx)]"
                      />
                      <span className="text-[13px] text-[var(--tx)]">Debris / packaging removal</span>
                    </label>
                  </section>

                  {renderB2BPricePreview()}
                </>
              ) : null}

              {!b2bActive ? (
              <>
              <section className="space-y-3">
                <SectionLabel>Delivery Type</SectionLabel>
                <div className="divide-y divide-[#2C3E2D]/10 border border-[#2C3E2D]/10 rounded-sm overflow-hidden">
                  {deliveryTypeOptions.map((dt) => {
                    const sel = deliveryType === dt.value;
                    return (
                      <button
                        key={dt.value}
                        type="button"
                        onClick={() => setDeliveryType(dt.value)}
                        className={`relative w-full text-left px-4 py-3 transition-colors active:scale-[0.995] ${
                          sel ? "bg-[#5C1A33]/[0.08]" : "bg-[#FFFBF7] hover:bg-[#5C1A33]/[0.04]"
                        }`}
                      >
                        <div className={`text-[12px] font-semibold leading-tight ${sel ? "text-[#5C1A33]" : "text-[#1a1f1b]"}`}>{dt.label}</div>
                        <div className="text-[10px] mt-1 text-[#5A6B5E]">{dt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <SectionLabel>Zone</SectionLabel>
                <select value={zone} onChange={(e) => setZone(Number(e.target.value))} className={fieldInput}>
                  <option value={1}>Zone 1, GTA (0–40 km), Included</option>
                  <option value={2}>Zone 2, Outer GTA (40–70 km), +$120–$145</option>
                  <option value={3}>Zone 3, Extended (70–100 km), +$210–$245</option>
                  <option value={4}>Zone 4, Remote (100+ km), Custom</option>
                </select>
              </section>

              <section className="space-y-2">
                <SectionLabel>Delivery Access</SectionLabel>
                <select value={deliveryAccess} onChange={(e) => setDeliveryAccess(e.target.value)} className={fieldInput}>
                  <option value="elevator">Elevator</option>
                  <option value="ground_floor">Ground Floor / Loading Dock</option>
                  <option value="loading_dock">Loading Dock</option>
                  <option value="walk_up_2nd">Walk-up (2nd floor)</option>
                  <option value="walk_up_3rd">Walk-up (3rd floor)</option>
                  <option value="walk_up_4th_plus">Walk-up (4th+ floor)</option>
                  <option value="long_carry">Long Carry (50m+)</option>
                  <option value="narrow_stairs">Narrow Stairs</option>
                  <option value="no_parking">No Parking Nearby</option>
                </select>
              </section>

              <section className="space-y-2">
                <SectionLabel>Item Weight</SectionLabel>
                <select value={itemWeightCategory} onChange={(e) => setItemWeightCategory(e.target.value)} className={fieldInput}>
                  <option value="standard">Standard (under 100 lbs)</option>
                  <option value="heavy">Heavy (100–250 lbs), +$50</option>
                  <option value="very_heavy">Very Heavy (250–500 lbs), +$100</option>
                  <option value="oversized_fragile">Oversized / Fragile (3+ crew), +$175</option>
                </select>
              </section>

              <section className="space-y-3">
                <SectionLabel>Heavy / Oversized Items</SectionLabel>
                <p className="text-[11px] text-[var(--tx3)] -mt-2">Items over 250 lbs incur additional surcharges.</p>
                <div className="border-t border-[#2C3E2D]/10 pt-1">
                  {([{ label: "250–400 lbs", tier: "250_400" as const }, { label: "400–600 lbs", tier: "400_600" as const }]).map((t) => {
                    const existing = heavyItems.find((h) => h.tier === t.tier);
                    const count = existing?.count ?? 0;
                    return (
                      <div key={t.tier} className="flex items-center justify-between py-3 border-b border-[#2C3E2D]/10 last:border-b-0">
                        <span className="text-[13px] text-[var(--tx)]">{t.label}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setHeavyItems((prev) => { const u = prev.filter((h) => h.tier !== t.tier); if (count > 1) u.push({ tier: t.tier, count: count - 1 }); return u; })} disabled={count === 0} className="w-7 h-7 rounded-sm border border-[#2C3E2D]/20 flex items-center justify-center text-[#5A6B5E] hover:bg-[#2C3E2D]/[0.04] disabled:opacity-30">−</button>
                          <span className="w-6 text-center font-semibold text-[var(--tx)] tabular-nums">{count}</span>
                          <button type="button" onClick={() => setHeavyItems((prev) => { const u = prev.filter((h) => h.tier !== t.tier); u.push({ tier: t.tier, count: count + 1 }); return u; })} className="w-7 h-7 rounded-sm border border-[#2C3E2D]/20 flex items-center justify-center text-[#5A6B5E] hover:bg-[#2C3E2D]/[0.04]">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {renderSurcharges()}
              {renderServicesSection()}
              {renderPricePreview()}
              </>
              ) : null}
            </div>
          )}

          {/* ═══ Per Delivery Step 2: Details ═══ */}
          {bookingType === "per_delivery" && perDeliveryStep === 2 && (
            <div className="space-y-6">
              <section className="space-y-3">
                <SectionLabel>Client / Recipient</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Name" required>
                    <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Full name" className={fieldInput} />
                  </FormField>
                  <FormField label="Email">
                    <input type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} placeholder="email@example.com" className={fieldInput} />
                  </FormField>
                  <FormField label="Phone">
                    <input ref={schedulePhoneInput.ref} type="tel" value={form.customer_phone} onChange={schedulePhoneInput.onChange} placeholder={PHONE_PLACEHOLDER} className={fieldInput} />
                  </FormField>
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel>Addresses</SectionLabel>
                {b2bActive ? (
                  <div className="space-y-2">
                    <SectionLabel>Pickup</SectionLabel>
                    {defaultPickupAddress.trim() ? (
                      <label className="flex items-start gap-2 cursor-pointer text-[13px] text-[var(--tx)]">
                        <input
                          type="checkbox"
                          checked={useDefaultPickup}
                          onChange={(e) => setUseDefaultPickup(e.target.checked)}
                          className="rounded border-[var(--brd)] text-[var(--tx)] mt-0.5 shrink-0"
                        />
                        <span>
                          Use default warehouse address
                          <span className="block text-[11px] text-[var(--tx3)] font-normal mt-0.5">{defaultPickupAddress}</span>
                        </span>
                      </label>
                    ) : null}
                    {(!useDefaultPickup || !defaultPickupAddress.trim()) && (
                      <FormField label={defaultPickupAddress.trim() ? "Custom pickup address" : "Pickup address"}>
                        <AddressAutocomplete
                          value={form.pickup_address || pickupRaw}
                          onRawChange={setPickupRaw}
                          onChange={(r) => set("pickup_address", r.fullAddress)}
                          placeholder="Warehouse or store"
                          className={fieldInput}
                        />
                      </FormField>
                    )}
                  </div>
                ) : (
                  <FormField label="Pickup Address">
                    <AddressAutocomplete value={form.pickup_address || pickupRaw} onRawChange={setPickupRaw} onChange={(r) => set("pickup_address", r.fullAddress)} placeholder="Warehouse or store" className={fieldInput} />
                  </FormField>
                )}
                <FormField label="Delivery Address" required>
                  <AddressAutocomplete value={form.delivery_address || deliveryRaw} onRawChange={setDeliveryRaw} onChange={(r) => set("delivery_address", r.fullAddress)} placeholder="Destination" className={fieldInput} />
                </FormField>
              </section>

              <section className="space-y-3">
                <SectionLabel>Schedule</SectionLabel>
                <FormField label="Date" required>
                  <input type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} className={fieldInput} />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Delivery window">
                    <select value={form.delivery_window} onChange={(e) => set("delivery_window", e.target.value)} className={fieldInput}>
                      <option value="">Select window…</option>
                      {(b2bActive ? B2B_PARTNER_TIME_WINDOW_OPTIONS : TIME_WINDOW_OPTIONS).map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Preferred time">
                    <input type="time" value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} className={fieldInput} />
                  </FormField>
                </div>
              </section>

              {!b2bActive ? (
              <>
              <section className="space-y-3">
                <SectionLabel>Inventory</SectionLabel>
                {inventory.length > 0 && (
                  <ul className="space-y-1.5 mb-2">
                    {inventory.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 py-2.5 border-b border-[#2C3E2D]/10 last:border-0">
                        <span className="text-[12px] text-[var(--tx)]">{item}</span>
                        <button type="button" onClick={() => removeInventoryItem(idx)} className="p-1 rounded text-[var(--tx3)] hover:text-red-600"><Trash2 className="w-[14px] h-[14px]" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-0 border border-[#2C3E2D]/15 rounded-sm overflow-hidden w-fit">
                  <button type="button" onClick={() => setInventoryBulkMode(false)} className={`text-[9px] font-bold tracking-[0.1em] uppercase px-3 py-2 transition-colors ${!inventoryBulkMode ? "bg-[#5C1A33] text-white" : "bg-transparent text-[#5A6B5E] hover:bg-[#5C1A33]/[0.06]"}`}>Single</button>
                  <button type="button" onClick={() => setInventoryBulkMode(true)} className={`text-[9px] font-bold tracking-[0.1em] uppercase px-3 py-2 border-l border-[#2C3E2D]/15 transition-colors ${inventoryBulkMode ? "bg-[#5C1A33] text-white" : "bg-transparent text-[#5A6B5E] hover:bg-[#5C1A33]/[0.06]"}`}>Bulk</button>
                </div>
                {inventoryBulkMode ? (
                  <div className="space-y-2">
                    <textarea value={inventoryBulkText} onChange={(e) => setInventoryBulkText(e.target.value)} placeholder={"One item per line, e.g. Sofa x2\nCoffee Table"} rows={3} className={`${fieldInput} resize-y text-[13px]`} />
                    <button type="button" onClick={addBulkInventoryItems} disabled={!inventoryBulkText.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-[0.1em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] disabled:opacity-50 rounded-sm">
                      <Plus className="w-[14px] h-[14px]" weight="bold" /> Add all
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 items-end">
                    <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())} placeholder="Item (e.g. Couch x2)" className={`${fieldInput} flex-1 min-w-[120px]`} />
                    <input type="number" min={1} max={99} value={newItemQty} onChange={(e) => setNewItemQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))} className={`${fieldInput} w-16`} />
                    <button type="button" onClick={addInventoryItem} disabled={!newItemName.trim()} className="flex-none inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-[0.1em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] disabled:opacity-50 rounded-sm">
                      <Plus className="w-[14px] h-[14px]" weight="bold" /> Add
                    </button>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <SectionLabel>Complexity</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {complexityPresets.map((preset) => (
                    <button key={preset} type="button" onClick={() => toggleComplexity(preset)} className={`px-2.5 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase border transition-colors rounded-sm ${form.complexityIndicators.includes(preset) ? "bg-[#5C1A33]/[0.08] text-[#5C1A33] border-[#5C1A33]/35" : "bg-transparent text-[#5A6B5E] border-[#2C3E2D]/15 hover:border-[#5C1A33]/30"}`}>
                      {preset}
                    </button>
                  ))}
                </div>
              </section>
              </>
              ) : null}

              <section className="space-y-3">
                <SectionLabel>Notes</SectionLabel>
                <FormField label="Instructions / access">
                  <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} rows={2} placeholder="Building access, codes, parking…" className={`${fieldInput} resize-y text-[13px]`} />
                </FormField>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.special_handling} onChange={(e) => set("special_handling", e.target.checked)} className="rounded border-[var(--brd)] text-[var(--tx)] focus:ring-[#2C3E2D]" />
                  <span className="text-[13px] text-[var(--tx)]">Requires special handling (fragile, high-value)</span>
                </label>
              </section>
            </div>
          )}

          {/* ═══ Per Delivery Step 3: Review ═══ */}
          {bookingType === "per_delivery" && perDeliveryStep === 3 && (
            <div className="space-y-0 divide-y divide-[#2C3E2D]/10">
              <div className="pb-6 space-y-0 divide-y divide-[#2C3E2D]/10">
                {b2bActive ? (
                  <>
                    <div className="py-4 first:pt-0">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-3">Delivery type</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                        <span className="text-[#5A6B5E]">Vertical</span>
                        <span className="font-medium text-[#1a1f1b] text-right">
                          {partnerB2bVerticals.find((v) => v.code === b2bVerticalCode)?.name || b2bVerticalCode || "—"}
                        </span>
                        <span className="text-[#5A6B5E]">Access</span>
                        <span className="font-medium text-[#1a1f1b] text-right uppercase">{deliveryAccess.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="py-4">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-3">Client</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                        <span className="text-[#5A6B5E]">Name</span>
                        <span className="font-medium text-[#1a1f1b] text-right">{form.customer_name || "—"}</span>
                        <span className="text-[#5A6B5E]">Date</span>
                        <span className="font-medium text-[#1a1f1b] text-right">{form.scheduled_date || "—"}</span>
                        <span className="text-[#5A6B5E]">Pickup</span>
                        <span className="font-medium text-[#1a1f1b] text-right truncate max-w-full">{pickupResolved || "—"}</span>
                        <span className="text-[#5A6B5E]">Deliver to</span>
                        <span className="font-medium text-[#1a1f1b] text-right truncate max-w-full">{form.delivery_address || "—"}</span>
                      </div>
                    </div>
                    {b2bItems.filter((i) => i.description.trim()).length > 0 && (
                      <div className="py-4">
                        <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-3">Items</p>
                        <ul className="space-y-1.5">
                          {b2bItems
                            .filter((i) => i.description.trim())
                            .map((row) => (
                              <li key={row.id} className="text-[13px] text-[#1a1f1b] flex justify-between gap-3 border-b border-[#2C3E2D]/5 last:border-0 pb-1.5 last:pb-0">
                                <span>
                                  {row.description.trim()}
                                  {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                                </span>
                                <span className="text-[11px] text-[#5A6B5E] shrink-0">
                                  {B2B_HANDLING_OPTIONS.find((o) => o.value === row.handling)?.label || row.handling}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="py-4 first:pt-0">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-3">Delivery</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                        <span className="text-[#5A6B5E]">Type</span>
                        <span className="font-medium text-[#1a1f1b] text-right">{deliveryTypeOptions.find((d) => d.value === deliveryType)?.label}</span>
                        <span className="text-[#5A6B5E]">Zone</span>
                        <span className="font-medium text-[#1a1f1b] text-right">Zone {zone}</span>
                        <span className="text-[#5A6B5E]">Access</span>
                        <span className="font-medium text-[#1a1f1b] text-right uppercase">{deliveryAccess.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="py-4">
                      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-3">Client</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                        <span className="text-[#5A6B5E]">Name</span>
                        <span className="font-medium text-[#1a1f1b] text-right">{form.customer_name || "—"}</span>
                        <span className="text-[#5A6B5E]">Date</span>
                        <span className="font-medium text-[#1a1f1b] text-right">{form.scheduled_date || "—"}</span>
                        <span className="text-[#5A6B5E]">Deliver to</span>
                        <span className="font-medium text-[#1a1f1b] text-right truncate max-w-full">{form.delivery_address || "—"}</span>
                      </div>
                    </div>
                    {inventory.length > 0 && (
                      <div className="py-4">
                        <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-3">Items ({inventory.length})</p>
                        <ul className="space-y-0">
                          {inventory.map((item, i) => (
                            <li key={i} className="text-[13px] text-[#1a1f1b] py-1.5 border-b border-[#2C3E2D]/5 last:border-0 flex justify-between gap-3">
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="pt-6 space-y-3">
                {b2bActive ? renderB2BPricePreview() : renderPricePreview()}
                <div className="flex justify-center pt-1">
                  <InfoHint ariaLabel="Partner pricing">
                    Your rates are locked in per your partnership agreement.
                  </InfoHint>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-[#FFFBF7] border-t border-[#2C3E2D]/10 px-5 sm:px-6 py-3.5 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase border border-[#2C3E2D]/25 text-[var(--tx)] hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm"
          >
            <CaretLeft size={14} weight="bold" aria-hidden />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          <div className="flex-1 min-w-2" />

          {isLastStep ? (
            <>
              {bookingType === "per_delivery" && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submitting || savingDraft}
                  title={savingDraft ? "Saving…" : "Save as draft"}
                  className="w-9 h-9 flex items-center justify-center rounded-sm border border-[#2C3E2D]/20 text-[#5A6B5E] hover:bg-[#2C3E2D]/[0.04] hover:text-[var(--tx)] transition-colors disabled:opacity-40"
                >
                  <FloppyDisk size={15} weight="regular" />
                </button>
              )}
              {bookingType === "day_rate" ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={dayRateSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors disabled:opacity-50 rounded-sm"
                >
                  {dayRateSubmitting ? "Submitting…" : "Submit delivery day"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || savingDraft}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors disabled:opacity-50 rounded-sm"
                >
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors rounded-sm"
            >
              Continue
              <CaretRight size={14} weight="bold" aria-hidden />
            </button>
          )}
        </div>
    </ModalDialogFrame>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);

  /* ─── Shared UI sections ─── */

  function renderSurcharges() {
    return (
      <section className="space-y-2">
        <SectionLabel>Surcharges</SectionLabel>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isAfterHours} onChange={(e) => setIsAfterHours(e.target.checked)} className="rounded border-[var(--brd)] text-[var(--tx)] focus:ring-[#2C3E2D]" />
            <span className="text-[13px] text-[var(--tx)]">After Hours (+20%)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isWeekend} onChange={(e) => setIsWeekend(e.target.checked)} className="rounded border-[var(--brd)] text-[var(--tx)] focus:ring-[#2C3E2D]" />
            <span className="text-[13px] text-[var(--tx)]">Weekend (+10%)</span>
          </label>
        </div>
      </section>
    );
  }

  function renderServicesSection() {
    const displayServices = availableServices.filter((s) => s.price_unit !== "percentage");
    if (displayServices.length === 0) return null;
    return (
      <section className="space-y-3">
        <SectionLabel>Add-on services</SectionLabel>
        <div className="border-t border-b border-[#2C3E2D]/10 divide-y divide-[#2C3E2D]/10">
          {displayServices.map((svc) => (
            <label key={svc.slug} className="flex items-start justify-between gap-4 py-3 cursor-pointer hover:bg-[#2C3E2D]/[0.02] px-1 -mx-1 transition-colors">
              <div className="flex items-start gap-2.5 min-w-0">
                <input type="checkbox" checked={!!selectedServices[svc.slug]?.enabled} onChange={() => toggleService(svc.slug)} className="rounded-sm border-[#2C3E2D]/25 text-[var(--tx)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] text-[#1a1f1b]">{svc.service_name}</div>
                  {svc.slug === "stair_carry" && selectedServices[svc.slug]?.enabled && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold tracking-wide uppercase text-[#5A6B5E]">Flights</span>
                      <input type="number" min={1} max={10} value={stairFlights} onChange={(e) => setStairFlights(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-12 text-[12px] bg-transparent border-b border-[#2C3E2D]/20 px-0 py-0.5 text-[#1a1f1b]" />
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[12px] font-semibold text-[var(--tx)] shrink-0 tabular-nums">
                {fmtCurrency(svc.price_min)}{svc.price_max ? ` – ${fmtCurrency(svc.price_max)}` : ""}
                {svc.price_unit === "per_flight" ? "/flight" : svc.price_unit === "per_stop" ? "/stop" : ""}
              </span>
            </label>
          ))}
        </div>
      </section>
    );
  }

  function renderB2BPricePreview() {
    const sub = b2bPreview?.partner_subtotal ?? 0;
    const hst = calcHST(sub);
    const totalWithHst = sub + hst;
    const std = b2bPreview?.standard_subtotal;
    const vname = b2bPreview?.vertical_name || "";
    return (
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]">Your rate</h3>
          {b2bPreviewLoading && <span className="text-[10px] text-[#5A6B5E]">Calculating…</span>}
        </div>
        {b2bPreview && vname ? (
          <p className="text-[12px] font-medium text-[#1a1f1b]">
            {vname} — partner rate
          </p>
        ) : null}
        {b2bPreview && b2bPreview.breakdown.length > 0 ? (
          <div className="space-y-2">
            {b2bPreview.breakdown.map((line, i) => (
              <div key={i} className="flex justify-between text-[13px] gap-3 border-b border-[#2C3E2D]/5 pb-2 last:border-0 last:pb-0">
                <span className="text-[#5A6B5E]">{line.label}</span>
                <span className="font-semibold text-[#1a1f1b] shrink-0 tabular-nums">{fmtCurrency(line.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#5A6B5E]">
            {b2bPreviewLoading
              ? "Calculating partner pricing…"
              : "Add items, delivery address, and pickup to see your rate."}
          </div>
        )}
        {b2bPreview ? (
          <>
            <div className="border-t border-[#2C3E2D]/10 pt-3 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5A6B5E]">Subtotal</span>
                <span className="font-semibold text-[#1a1f1b] tabular-nums">{fmtCurrency(sub)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5A6B5E]">HST (13%)</span>
                <span className="font-semibold text-[#1a1f1b] tabular-nums">{fmtCurrency(hst)}</span>
              </div>
              <div className="flex justify-between pt-1 items-baseline">
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#5A6B5E]">Total incl. HST</span>
                <span className="text-[22px] font-normal text-[var(--tx)] font-hero tabular-nums">{fmtCurrency(totalWithHst)}</span>
              </div>
            </div>
            {std != null && std > sub ? (
              <div className="flex justify-end pt-0.5">
                <InfoHint ariaLabel="List pricing comparison">
                  List pricing for the same job would be about {fmtCurrency(std)} before HST.
                </InfoHint>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  function renderPricePreview() {
    const hst = pricing ? calcHST(pricing.totalPrice) : 0;
    const totalWithHst = pricing ? pricing.totalPrice + hst : 0;
    return (
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]">Price preview</h3>
          {bookingType === "per_delivery" && pricing ? (
            <InfoHint ariaLabel="What base rates include">
              Rates shown are base prices for standard access. Walk-up, long carry, and heavy item surcharges may apply.
            </InfoHint>
          ) : null}
          {pricingLoading && <span className="text-[10px] text-[#5A6B5E]">Calculating…</span>}
        </div>
        {pricing ? (
          <>
            <div className="space-y-2">
              {pricing.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-[13px] gap-3">
                  <span className="text-[#5A6B5E]">{item.label}</span>
                  <span className={`font-semibold tabular-nums ${item.amount < 0 ? "text-emerald-700" : "text-[#1a1f1b]"}`}>
                    {item.amount < 0 ? `-${fmtCurrency(Math.abs(item.amount))}` : fmtCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-[#2C3E2D]/10 pt-3 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5A6B5E]">Subtotal</span>
                <span className="font-semibold text-[#1a1f1b] tabular-nums">{fmtCurrency(pricing.totalPrice)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5A6B5E]">HST (13%)</span>
                <span className="font-semibold text-[#1a1f1b] tabular-nums">{fmtCurrency(hst)}</span>
              </div>
              <div className="flex justify-between pt-1 items-baseline">
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#5A6B5E]">Total incl. HST</span>
                <span className="text-[22px] font-normal text-[var(--tx)] font-hero tabular-nums">{fmtCurrency(totalWithHst)}</span>
              </div>
            </div>
            {pricing.effectivePerStop && bookingType === "day_rate" && (
              <div className="text-[11px] text-[#5A6B5E] text-right">Effective per stop: {fmtCurrency(pricing.effectivePerStop)}</div>
            )}
          </>
        ) : (
          <div className={`text-[12px] ${pricingError ? "text-red-600" : "text-[#5A6B5E]"}`}>
            {pricingLoading ? "Loading rates…" : pricingError || "Configure options above to see pricing"}
          </div>
        )}
      </div>
    );
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]">{children}</h3>
  );
}

function FormField({ label, required, children, className = "" }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)] mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
