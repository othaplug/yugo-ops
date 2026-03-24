"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, FloppyDisk, CalendarBlank, Sun, SunHorizon as Sunset, Clock } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { Plus, Trash as Trash2 } from "@phosphor-icons/react";
import type { VehicleType, DayType } from "@/lib/delivery-day-booking";

const COMPLEXITY_PRESETS = ["White Glove", "High Value", "Fragile", "Artwork", "Antiques", "Storage"];

const VEHICLE_TYPES: { value: VehicleType; label: string; capacity: string; payload: string }[] = [
  { value: "sprinter", label: "Cargo Van (Sprinter)", capacity: "370 cu ft", payload: "3,500 lbs" },
  { value: "16ft", label: "16ft Truck", capacity: "800 cu ft", payload: "5,000 lbs" },
  { value: "20ft", label: "20ft Truck", capacity: "1,100 cu ft", payload: "7,000 lbs" },
  { value: "26ft", label: "26ft Truck", capacity: "1,600 cu ft", payload: "10,000 lbs" },
];

const DELIVERY_TYPES = [
  { value: "single_item", label: "Single Item", desc: "One piece of furniture" },
  { value: "multi_piece", label: "Multi-Piece", desc: "2–5 items, same drop" },
  { value: "full_room", label: "Full Room Setup", desc: "Complete room delivery + setup" },
  { value: "curbside", label: "Curbside Drop", desc: "Drop at building entrance" },
  { value: "oversized", label: "Oversized / Fragile", desc: "Piano, safe, art, etc." },
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

const DAY_TIME_WINDOWS = [
  { value: "morning",   label: "Morning",   range: "8am – 12pm", Icon: Sun },
  { value: "afternoon", label: "Afternoon", range: "12pm – 5pm", Icon: Sunset },
  { value: "full_day",  label: "Full Day",  range: "8am – 5pm",  Icon: Clock },
] as const;

type DayTimeWindow = "morning" | "afternoon" | "full_day";

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

export default function PartnerScheduleModal({ orgId, orgType, onClose, onCreated, initialDate = "", initialItems }: Props) {
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
  const [dayTimeWindow, setDayTimeWindow] = useState<DayTimeWindow>("morning");
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

  // Auto-refresh pricing on step 2 (day rate) or step 1 (per delivery) and review
  useEffect(() => {
    const shouldFetch =
      (bookingType === "day_rate" && dayRateStep === 2) ||
      (bookingType === "per_delivery" && (perDeliveryStep === 1 || perDeliveryStep === 3));
    if (!shouldFetch) return;
    const t = setTimeout(fetchPricing, 400);
    return () => clearTimeout(t);
  }, [fetchPricing, bookingType, dayRateStep, perDeliveryStep]);

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
    const itemsList = inventory.length > 0
      ? inventory
      : form.items ? form.items.split("\n").map((l) => l.trim()).filter(Boolean) : [];
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
      base_price: pricing?.basePrice || 0,
      overage_price: pricing?.overagePrice || 0,
      services_price: pricing?.servicesPrice || 0,
      zone_surcharge: pricing?.zoneSurcharge || 0,
      after_hours_surcharge: pricing?.afterHoursSurcharge || 0,
      total_price: pricing?.totalPrice || 0,
      services_selected: svcList,
      pricing_breakdown: pricing?.breakdown || null,
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
        if (perDeliveryStep === 2) fetchPricing();
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
    "w-full text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors";
  const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const isLastStep =
    (bookingType === "day_rate" && dayRateStep === 4) ||
    (bookingType === "per_delivery" && perDeliveryStep === 3);

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-5 modal-overlay"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[640px] overflow-hidden mx-0 sm:mx-4 flex flex-col sheet-card sm:modal-card animate-slide-up sm:animate-none"
        style={{ maxHeight: "min(92dvh, 92vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="shrink-0 bg-[var(--card)] border-b border-[var(--brd)]">
          {/* Title row */}
          <div className="px-5 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--gold)] mb-0.5">
                {currentStep.description}
              </p>
              <h2 className="font-hero text-[22px] sm:text-[26px] font-bold text-[var(--tx)] leading-tight">
                {currentStep.label}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg2)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={18} weight="regular" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[var(--brd)] px-5 sm:px-6">
            {(["day_rate", "per_delivery"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={`relative pb-3 pt-1 mr-6 text-[13px] font-semibold transition-colors duration-150 ${
                  bookingType === tab
                    ? "text-[#B8962E]"
                    : "text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}
              >
                {tab === "day_rate" ? "Day Rate" : "Per Delivery"}
                {bookingType === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#B8962E] rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Step progress */}
          <div className="px-5 sm:px-6 py-4">
              <div className="flex items-center gap-0">
                {steps.map((s, i) => (
                  <div key={s.id} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (bookingType === "day_rate" && s.id < dayRateStep) setDayRateStep(s.id);
                        if (bookingType === "per_delivery" && s.id < perDeliveryStep) setPerDeliveryStep(s.id);
                      }}
                      className="flex flex-col items-center gap-1.5 shrink-0"
                      style={{ cursor: s.id < step ? "pointer" : "default" }}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 ${
                          step === s.id
                            ? "bg-[#B8962E] text-white shadow-sm shadow-[#B8962E]/30 scale-110"
                            : step > s.id
                            ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                            : "bg-[var(--brd)]/60 text-[var(--tx3)] border border-[var(--brd)]"
                        }`}
                      >
                        {step > s.id ? <Check size={12} weight="bold" /> : s.id}
                      </div>
                      <span
                        className={`text-[10px] font-semibold tracking-wide transition-colors duration-150 hidden sm:block ${
                          step === s.id ? "text-[var(--tx)]" : "text-[var(--tx3)]"
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < steps.length - 1 && (
                      <div className="flex-1 mx-2 mb-4">
                        <div
                          className={`h-px transition-all duration-500 ${
                            step > s.id ? "bg-emerald-500/40" : "bg-[var(--brd)]/50"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-6 py-5 space-y-6 min-h-0">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ═══ Day Rate Step 3: Schedule & Stops ═══ */}
          {bookingType === "day_rate" && dayRateStep === 3 && (
            <div className="space-y-6">
              <section className="space-y-2">
                <SectionLabel>Date</SectionLabel>
                <div className="relative">
                  <input
                    type="date"
                    value={dayScheduledDate}
                    onChange={(e) => setDayScheduledDate(e.target.value)}
                    className={`${fieldInput} pr-10`}
                    style={{ colorScheme: "dark" }}
                  />
                  <CalendarBlank size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]" />
                </div>
              </section>

              <section className="space-y-2">
                <SectionLabel>Time Window</SectionLabel>
                <div className="flex gap-1 p-1 bg-[var(--bg2)] rounded-xl border border-[var(--brd)]">
                  {DAY_TIME_WINDOWS.map(({ value, label, range, Icon }) => {
                    const active = dayTimeWindow === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDayTimeWindow(value)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-br from-[#B8962E] to-[#8B7332] text-white shadow-sm shadow-[#B8962E]/20"
                            : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]"
                        }`}
                      >
                        <Icon size={13} weight={active ? "fill" : "regular"} />
                        <span>{label}</span>
                        <span className={`text-[10px] font-normal hidden sm:inline ${active ? "text-white/75" : "text-[var(--tx3)]"}`}>{range}</span>
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
                <div key={stop.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-bold text-[var(--tx)] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[var(--gold)] text-white text-[10px] font-bold flex items-center justify-center">
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
                className="w-full py-2 text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add another stop
              </button>
            </div>
          )}

          {/* ═══ Day Rate Step 4: Review ═══ */}
          {bookingType === "day_rate" && dayRateStep === 4 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[var(--brd)] p-4 space-y-2">
                {[
                  ["Date",     dayScheduledDate || "—"],
                  ["Time",     DAY_TIME_WINDOWS.find((w) => w.value === dayTimeWindow)?.label ?? dayTimeWindow],
                  ["Vehicle",  VEHICLE_TYPES.find((v) => v.value === vehicleType)?.label ?? vehicleType],
                  ["Duration", dayType === "full_day" ? "Full Day" : "Half Day"],
                  ["Stops",    String(dayStops.length)],
                  ["Pickup",   dayPickupAddress || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[13px]">
                    <span className="text-[var(--tx3)]">{k}</span>
                    <span className="font-semibold text-[var(--tx)] text-right max-w-[60%] truncate">{v}</span>
                  </div>
                ))}
              </div>

              {dayStops.filter((s) => s.address).map((stop, idx) => (
                <div key={stop.id} className="rounded-xl border border-[var(--brd)] p-4 space-y-1.5">
                  <h4 className="text-[12px] font-bold text-[var(--tx)] flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[var(--gold)] text-white text-[9px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    Stop {idx + 1}
                  </h4>
                  <p className="text-[12px] text-[var(--tx2)] truncate">{stop.address}</p>
                  {stop.customerName && (
                    <p className="text-[11px] text-[var(--tx3)]">
                      {stop.customerName}{stop.customerPhone ? ` · ${formatPhone(stop.customerPhone)}` : ""}
                    </p>
                  )}
                  {stop.instructions && <p className="text-[11px] text-[var(--tx3)] italic">{stop.instructions}</p>}
                </div>
              ))}

              {renderPricePreview()}
              <p className="text-[11px] text-[var(--tx3)] text-center">Your rates are locked in per your partnership agreement.</p>
            </div>
          )}

          {/* ═══ Day Rate Step 1: Vehicle & Duration ═══ */}
          {bookingType === "day_rate" && dayRateStep === 1 && (
            <div className="space-y-6">
              <section className="space-y-3">
                <SectionLabel>Vehicle</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {VEHICLE_TYPES.map((v) => {
                    const sel = vehicleType === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVehicleType(v.value as VehicleType)}
                        className={`relative text-left px-3 py-3 rounded-lg border transition-all duration-200 ${
                          sel
                            ? "bg-gradient-to-br from-[#B8962E] to-[#8B7332] border-[#B8962E] shadow-md shadow-[#B8962E]/15"
                            : "bg-[var(--card)] border-[var(--brd)] hover:border-[#C9A962]/50 hover:bg-[var(--bg)]"
                        }`}
                      >
                        <div className={`text-[13px] font-semibold leading-tight ${sel ? "text-white" : "text-[var(--tx)]"}`}>{v.label}</div>
                        <div className={`text-[10px] mt-0.5 ${sel ? "text-white/90" : "text-[var(--tx3)]"}`}>{v.capacity}</div>
                        <div className={`text-[10px] ${sel ? "text-white/90" : "text-[var(--tx3)]"}`}>Max payload: {v.payload}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel>Duration</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {([["full_day", "Full Day", "6 stops incl."], ["half_day", "Half Day", "3 stops incl."]] as const).map(([val, label, desc]) => {
                    const sel = dayType === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setDayType(val); setNumStops(INCLUDED_STOPS[val]); }}
                        className={`relative text-left px-3 py-3 rounded-lg border transition-all duration-200 ${
                          sel
                            ? "bg-gradient-to-br from-[#B8962E] to-[#8B7332] border-[#B8962E] shadow-md shadow-[#B8962E]/15"
                            : "bg-[var(--card)] border-[var(--brd)] hover:border-[#C9A962]/50 hover:bg-[var(--bg)]"
                        }`}
                      >
                        <div className={`text-[13px] font-semibold leading-tight ${sel ? "text-white" : "text-[var(--tx)]"}`}>{label}</div>
                        <div className={`text-[10px] mt-0.5 ${sel ? "text-white/90" : "text-[var(--tx3)]"}`}>{desc}</div>
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
                          className="w-10 h-10 rounded-xl border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)] text-lg font-bold disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="text-[26px] font-bold text-[var(--tx)] w-10 text-center">{numStops}</span>
                        <button
                          type="button"
                          onClick={() => setNumStops((n) => n + 1)}
                          className="w-10 h-10 rounded-xl border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)] text-lg font-bold"
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
                          <span className="text-[var(--tx3)]">beyond included — overage rates apply</span>
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
              <section className="space-y-3">
                <SectionLabel>Delivery Type</SectionLabel>
                <div className="grid grid-cols-1 gap-2">
                  {DELIVERY_TYPES.map((dt) => {
                    const sel = deliveryType === dt.value;
                    return (
                      <button
                        key={dt.value}
                        type="button"
                        onClick={() => setDeliveryType(dt.value)}
                        className={`relative text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                          sel
                            ? "bg-gradient-to-br from-[#B8962E] to-[#8B7332] border-[#B8962E] shadow-md shadow-[#B8962E]/15"
                            : "bg-[var(--card)] border-[var(--brd)] hover:border-[#C9A962]/50 hover:bg-[var(--bg)]"
                        }`}
                      >
                        <div className={`text-[13px] font-semibold leading-tight ${sel ? "text-white" : "text-[var(--tx)]"}`}>{dt.label}</div>
                        <div className={`text-[10px] mt-0.5 ${sel ? "text-white/90" : "text-[var(--tx3)]"}`}>{dt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <SectionLabel>Zone</SectionLabel>
                <select value={zone} onChange={(e) => setZone(Number(e.target.value))} className={fieldInput}>
                  <option value={1}>Zone 1 — GTA (0–40 km) — Included</option>
                  <option value={2}>Zone 2 — Outer GTA (40–70 km) — +$120–$145</option>
                  <option value={3}>Zone 3 — Extended (70–100 km) — +$210–$245</option>
                  <option value={4}>Zone 4 — Remote (100+ km) — Custom</option>
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
                  <option value="heavy">Heavy (100–250 lbs) — +$50</option>
                  <option value="very_heavy">Very Heavy (250–500 lbs) — +$100</option>
                  <option value="oversized_fragile">Oversized / Fragile (3+ crew) — +$175</option>
                </select>
              </section>

              <section className="space-y-3">
                <SectionLabel>Heavy / Oversized Items</SectionLabel>
                <p className="text-[11px] text-[var(--tx3)] -mt-2">Items over 250 lbs incur additional surcharges.</p>
                <div className="space-y-2">
                  {([{ label: "250–400 lbs", tier: "250_400" as const }, { label: "400–600 lbs", tier: "400_600" as const }]).map((t) => {
                    const existing = heavyItems.find((h) => h.tier === t.tier);
                    const count = existing?.count ?? 0;
                    return (
                      <div key={t.tier} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--brd)]">
                        <span className="text-[13px] text-[var(--tx)]">{t.label}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setHeavyItems((prev) => { const u = prev.filter((h) => h.tier !== t.tier); if (count > 1) u.push({ tier: t.tier, count: count - 1 }); return u; })} disabled={count === 0} className="w-7 h-7 rounded border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)] disabled:opacity-30">−</button>
                          <span className="w-6 text-center font-bold text-[var(--tx)]">{count}</span>
                          <button type="button" onClick={() => setHeavyItems((prev) => { const u = prev.filter((h) => h.tier !== t.tier); u.push({ tier: t.tier, count: count + 1 }); return u; })} className="w-7 h-7 rounded border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)]">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {renderSurcharges()}
              {renderServicesSection()}
              {renderPricePreview()}
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
                <FormField label="Pickup Address">
                  <AddressAutocomplete value={form.pickup_address || pickupRaw} onRawChange={setPickupRaw} onChange={(r) => set("pickup_address", r.fullAddress)} placeholder="Warehouse or store" className={fieldInput} />
                </FormField>
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
                      {TIME_WINDOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Preferred time">
                    <input type="time" value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} className={fieldInput} />
                  </FormField>
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel>Inventory</SectionLabel>
                {inventory.length > 0 && (
                  <ul className="space-y-1.5 mb-2">
                    {inventory.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg2)] border border-[var(--brd)]">
                        <span className="text-[12px] text-[var(--tx)]">{item}</span>
                        <button type="button" onClick={() => removeInventoryItem(idx)} className="p-1 rounded text-[var(--tx3)] hover:text-red-600"><Trash2 className="w-[14px] h-[14px]" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setInventoryBulkMode(false)} className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${!inventoryBulkMode ? "bg-[#C9A962] text-white" : "bg-[var(--bg2)] text-[var(--tx3)] hover:bg-[var(--brd)]"}`}>Single add</button>
                  <button type="button" onClick={() => setInventoryBulkMode(true)} className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${inventoryBulkMode ? "bg-[#C9A962] text-white" : "bg-[var(--bg2)] text-[var(--tx3)] hover:bg-[var(--brd)]"}`}>Bulk add</button>
                </div>
                {inventoryBulkMode ? (
                  <div className="space-y-2">
                    <textarea value={inventoryBulkText} onChange={(e) => setInventoryBulkText(e.target.value)} placeholder={"One item per line, e.g. Sofa x2\nCoffee Table"} rows={3} className={`${fieldInput} resize-y text-[13px]`} />
                    <button type="button" onClick={addBulkInventoryItems} disabled={!inventoryBulkText.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50">
                      <Plus className="w-[14px] h-[14px]" /> Add all
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 items-end">
                    <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())} placeholder="Item (e.g. Couch x2)" className={`${fieldInput} flex-1 min-w-[120px]`} />
                    <input type="number" min={1} max={99} value={newItemQty} onChange={(e) => setNewItemQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))} className={`${fieldInput} w-16`} />
                    <button type="button" onClick={addInventoryItem} disabled={!newItemName.trim()} className="flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50">
                      <Plus className="w-[14px] h-[14px]" /> Add
                    </button>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <SectionLabel>Complexity</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {COMPLEXITY_PRESETS.map((preset) => (
                    <button key={preset} type="button" onClick={() => toggleComplexity(preset)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${form.complexityIndicators.includes(preset) ? "bg-[#C9A962]/20 text-[#8B6914] border-[#C9A962]" : "bg-[var(--card)] text-[var(--tx3)] border-[var(--brd)] hover:border-[#C9A962]/50"}`}>
                      {preset}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel>Notes</SectionLabel>
                <FormField label="Instructions / access">
                  <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} rows={2} placeholder="Building access, codes, parking…" className={`${fieldInput} resize-y text-[13px]`} />
                </FormField>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.special_handling} onChange={(e) => set("special_handling", e.target.checked)} className="rounded border-[var(--brd)] text-[#C9A962] focus:ring-[#C9A962]" />
                  <span className="text-[13px] text-[var(--tx)]">Requires special handling (fragile, high-value)</span>
                </label>
              </section>
            </div>
          )}

          {/* ═══ Per Delivery Step 3: Review ═══ */}
          {bookingType === "per_delivery" && perDeliveryStep === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[var(--brd)] divide-y divide-[var(--brd)]">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] mb-2">Delivery</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                    <span className="text-[var(--tx3)]">Type</span>
                    <span className="font-semibold text-[var(--tx)]">{DELIVERY_TYPES.find((d) => d.value === deliveryType)?.label}</span>
                    <span className="text-[var(--tx3)]">Zone</span>
                    <span className="font-semibold text-[var(--tx)]">Zone {zone}</span>
                    <span className="text-[var(--tx3)]">Access</span>
                    <span className="font-semibold text-[var(--tx)] capitalize">{deliveryAccess.replace(/_/g, " ")}</span>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] mb-2">Client</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                    <span className="text-[var(--tx3)]">Name</span>
                    <span className="font-semibold text-[var(--tx)]">{form.customer_name || "—"}</span>
                    <span className="text-[var(--tx3)]">Date</span>
                    <span className="font-semibold text-[var(--tx)]">{form.scheduled_date || "—"}</span>
                    <span className="text-[var(--tx3)]">Deliver to</span>
                    <span className="font-semibold text-[var(--tx)] truncate">{form.delivery_address || "—"}</span>
                  </div>
                </div>
                {inventory.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] mb-2">Items ({inventory.length})</p>
                    <ul className="space-y-0.5">
                      {inventory.map((item, i) => <li key={i} className="text-[12px] text-[var(--tx)]">· {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {renderPricePreview()}
              <p className="text-[11px] text-[var(--tx3)] text-center">Your rates are locked in per your partnership agreement.</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--brd)] px-5 sm:px-6 py-3 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:bg-[var(--bg2)] transition-colors"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>

          <div className="flex-1" />

          {isLastStep ? (
            <>
              {/* Save as draft only available for per-delivery */}
              {bookingType === "per_delivery" && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submitting || savingDraft}
                  title={savingDraft ? "Saving…" : "Save as draft"}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--brd)] text-[var(--tx3)] hover:bg-[var(--bg2)] hover:text-[var(--tx)] transition-colors disabled:opacity-40"
                >
                  <FloppyDisk size={15} weight="regular" />
                </button>
              )}
              {bookingType === "day_rate" ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={dayRateSubmitting}
                  className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50"
                >
                  {dayRateSubmitting ? "Submitting…" : "Submit Delivery Day"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || savingDraft}
                  className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              className="px-5 py-2 rounded-lg text-[12px] font-bold bg-[#C9A962] text-white hover:bg-[#B8862E] transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
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
            <input type="checkbox" checked={isAfterHours} onChange={(e) => setIsAfterHours(e.target.checked)} className="rounded border-[var(--brd)] text-[#C9A962] focus:ring-[#C9A962]" />
            <span className="text-[13px] text-[var(--tx)]">After Hours (+20%)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isWeekend} onChange={(e) => setIsWeekend(e.target.checked)} className="rounded border-[var(--brd)] text-[#C9A962] focus:ring-[#C9A962]" />
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
      <section className="space-y-2">
        <SectionLabel>Add-on Services</SectionLabel>
        <div className="space-y-1.5">
          {displayServices.map((svc) => (
            <label key={svc.slug} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--brd)] hover:border-[#C9A962]/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input type="checkbox" checked={!!selectedServices[svc.slug]?.enabled} onChange={() => toggleService(svc.slug)} className="rounded border-[var(--brd)] text-[#C9A962] focus:ring-[#C9A962]" />
                <div>
                  <div className="text-[13px] text-[var(--tx)]">{svc.service_name}</div>
                  {svc.slug === "stair_carry" && selectedServices[svc.slug]?.enabled && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[var(--tx3)]">Flights:</span>
                      <input type="number" min={1} max={10} value={stairFlights} onChange={(e) => setStairFlights(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-14 text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)]" />
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[12px] font-semibold text-[#C9A962] shrink-0">
                {fmtCurrency(svc.price_min)}{svc.price_max ? ` – ${fmtCurrency(svc.price_max)}` : ""}
                {svc.price_unit === "per_flight" ? "/flight" : svc.price_unit === "per_stop" ? "/stop" : ""}
              </span>
            </label>
          ))}
        </div>
      </section>
    );
  }

  function renderPricePreview() {
    const hst = pricing ? Math.round(pricing.totalPrice * 0.13) : 0;
    const totalWithHst = pricing ? pricing.totalPrice + hst : 0;
    return (
      <div className="rounded-xl border border-[#C9A962]/30 bg-[var(--gdim)] p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--gold)]">Price Preview</h3>
          {pricingLoading && <span className="text-[10px] text-[var(--tx3)]">Calculating…</span>}
        </div>
        {pricing ? (
          <>
            {pricing.breakdown.map((item, i) => (
              <div key={i} className="flex justify-between text-[13px]">
                <span className="text-[var(--tx3)]">{item.label}</span>
                <span className={`font-semibold ${item.amount < 0 ? "text-green-600" : "text-[var(--tx)]"}`}>
                  {item.amount < 0 ? `-${fmtCurrency(Math.abs(item.amount))}` : fmtCurrency(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-[13px] pt-1">
              <span className="text-[var(--tx3)]">Subtotal</span>
              <span className="font-semibold text-[var(--tx)]">{fmtCurrency(pricing.totalPrice)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[var(--tx3)]">HST (13%)</span>
              <span className="font-semibold text-[var(--tx)]">{fmtCurrency(hst)}</span>
            </div>
            <div className="border-t border-[#C9A962]/20 pt-2 mt-1 flex justify-between">
              <span className="text-[var(--text-base)] font-bold text-[var(--tx)]">Total incl. HST</span>
              <span className="text-[16px] font-bold text-[#C9A962]">{fmtCurrency(totalWithHst)}</span>
            </div>
            {pricing.effectivePerStop && bookingType === "day_rate" && (
              <div className="text-[11px] text-[var(--tx3)] text-right">Effective per stop: {fmtCurrency(pricing.effectivePerStop)}</div>
            )}
            {bookingType === "per_delivery" && (
              <p className="text-[10px] text-[var(--tx3)] mt-2 pt-2 border-t border-[#C9A962]/20">
                Rates shown are base prices for standard access. Walk-up, long carry, and heavy item surcharges may apply.
              </p>
            )}
          </>
        ) : (
          <div className={`text-[12px] ${pricingError ? "text-red-600" : "text-[var(--tx3)]"}`}>
            {pricingLoading ? "Loading rates…" : pricingError || "Configure options above to see pricing"}
          </div>
        )}
      </div>
    );
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3)]">{children}</h3>
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
