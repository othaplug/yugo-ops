"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { Plus, Trash as Trash2, PaperPlaneTilt as Send, Calendar } from "@phosphor-icons/react";
import DeliveryDayForm from "@/components/delivery-day/DeliveryDayForm";
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
  { value: "multi_piece", label: "Multi-Piece", desc: "2-5 items, same drop" },
  { value: "full_room", label: "Full Room Setup", desc: "Complete room delivery + setup" },
  { value: "curbside", label: "Curbside Drop", desc: "Drop at building entrance" },
  { value: "oversized", label: "Oversized / Fragile", desc: "Piano, safe, art, etc." },
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
  // Step state: day_rate = config then day_flow (DeliveryDayForm); per_delivery = config | details | review
  const [bookingType, setBookingType] = useState<"day_rate" | "per_delivery">("day_rate");
  const [step, setStep] = useState<"config" | "day_flow" | "details" | "review">("config");

  // Day rate fields
  const [vehicleType, setVehicleType] = useState<VehicleType>("sprinter");
  const [dayType, setDayType] = useState<DayType>("full_day");
  const [numStops, setNumStops] = useState(6);

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

  useEffect(() => {
    if (initialDate) setForm((f) => ({ ...f, scheduled_date: initialDate }));
  }, [initialDate]);

  useEffect(() => {
    if (initialItems) setForm((f) => ({ ...f, items: initialItems }));
  }, [initialItems]);

  // Load available services when booking type is set
  useEffect(() => {
    if (!bookingType) return;
    fetch(`/api/partner/deliveries/services?org_id=${orgId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.services) setAvailableServices(d.services);
      })
      .catch((err) => { console.error("Failed to load available delivery services:", err); });
  }, [orgId, bookingType]);

  // Live pricing calculation
  const fetchPricing = useCallback(async () => {
    if (!bookingType) return;
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
      if (res.ok) {
        setPricing(data);
        setPricingError("");
      } else {
        setPricing(null);
        setPricingError(data.error || "Pricing unavailable");
      }
    } catch {
      setPricing(null);
      setPricingError("Unable to reach pricing service");
    } finally {
      setPricingLoading(false);
    }
  }, [bookingType, vehicleType, dayType, numStops, deliveryType, zone, selectedServices, stairFlights, isAfterHours, isWeekend, heavyItems, deliveryAccess, itemWeightCategory]);

  useEffect(() => {
    if (step === "config" || step === "review") {
      const t = setTimeout(fetchPricing, 400);
      return () => clearTimeout(t);
    }
  }, [fetchPricing, step]);

  // Inventory helpers (no room — partners don't need room-level detail)
  const addInventoryItem = () => {
    if (!newItemName.trim()) return;
    const name = newItemName.trim();
    const itemName = newItemQty > 1 ? `${name} x${newItemQty}` : name;
    setInventory((prev) => [...prev, itemName]);
    setNewItemName("");
    setNewItemQty(1);
  };
  const removeInventoryItem = (idx: number) => setInventory((prev) => prev.filter((_, i) => i !== idx));
  const parseBulkLines = (text: string) =>
    text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.+?)\s+x(\d+)$/i);
      return m ? `${m[1].trim()} x${m[2]}` : l;
    });
  const addBulkInventoryItems = () => {
    if (!inventoryBulkText.trim()) return;
    const items = parseBulkLines(inventoryBulkText);
    setInventory((prev) => [...prev, ...items]);
    setInventoryBulkText("");
  };
  const toggleComplexity = (preset: string) => {
    setForm((f) => ({
      ...f,
      complexityIndicators: f.complexityIndicators.includes(preset)
        ? f.complexityIndicators.filter((p) => p !== preset)
        : [...f.complexityIndicators, preset],
    }));
  };

  const toggleService = (slug: string) => {
    setSelectedServices((s) => ({
      ...s,
      [slug]: { enabled: !s[slug]?.enabled, quantity: s[slug]?.quantity || 1 },
    }));
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { setError("Customer name is required"); return; }
    if (!form.delivery_address.trim()) { setError("Delivery address is required"); return; }
    if (!form.scheduled_date) { setError("Date is required"); return; }

    setSubmitting(true);
    setError("");

    const itemsList =
      inventory.length > 0
        ? inventory
        : form.items ? form.items.split("\n").map((l) => l.trim()).filter(Boolean) : [];

    const svcList = Object.entries(selectedServices)
      .filter(([, v]) => v.enabled)
      .map(([slug, v]) => ({ slug, quantity: slug === "stair_carry" ? stairFlights : v.quantity }));

    try {
      const res = await fetch("/api/partner/deliveries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          customer_email: form.customer_email.trim() || null,
          customer_phone: form.customer_phone.trim() ? normalizePhone(form.customer_phone) : null,
          pickup_address: form.pickup_address.trim() || null,
          delivery_address: form.delivery_address.trim(),
          scheduled_date: form.scheduled_date,
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create delivery");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldInput =
    "w-full text-[var(--text-base)] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors";

  const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 modal-overlay" onClick={onClose}>
      <div
        className="bg-[var(--card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[640px] overflow-y-auto mx-0 sm:mx-4 flex flex-col sheet-card sm:modal-card animate-slide-up sm:animate-none"
        style={{ maxHeight: "min(92dvh, 92vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="min-w-0 flex-1">
            <h2 className="font-hero text-[26px] sm:text-[30px] font-bold text-[var(--tx)]">Schedule Delivery</h2>
            {/* Toggle: Day Rate | Per Delivery — only when on config step */}
            {step === "config" && (
              <div className="flex gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => setBookingType("day_rate")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${bookingType === "day_rate" ? "bg-[#C9A962] text-white" : "bg-[var(--bg2)] text-[var(--tx3)] hover:bg-[var(--brd)]"}`}
                >
                  Day Rate
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType("per_delivery")}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${bookingType === "per_delivery" ? "bg-[#C9A962] text-white" : "bg-[var(--bg2)] text-[var(--tx3)] hover:bg-[var(--brd)]"}`}
                >
                  Per Delivery
                </button>
              </div>
            )}
            {step !== "config" && step !== "day_flow" && bookingType === "per_delivery" && (
              <div className="flex gap-1.5 mt-1">
                {(["config", "details", "review"] as const).map((s, i) => (
                  <div key={s} className={`h-1 rounded-full transition-all ${i <= ["config", "details", "review"].indexOf(step) ? "bg-[#C9A962] w-8" : "bg-[var(--brd)] w-4"}`} />
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg2)] transition-colors text-[var(--tx3)] shrink-0" aria-label="Close">
            <X size={18} weight="regular" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-5">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-600 dark:text-red-400">{error}</div>
          )}

          {/* ════ Day rate: after config, show DeliveryDayForm (date → stops → delivery day → review) ════ */}
          {step === "day_flow" && bookingType === "day_rate" && (
            <DeliveryDayForm
              orgId={orgId}
              orgType={orgType}
              initialDate={form.scheduled_date}
              initialVehicle={vehicleType}
              initialDayType={dayType}
              onSuccess={onCreated}
              onBackToConfig={() => setStep("config")}
            />
          )}

          {/* ════ Step 1 (Day Rate) or Config (Per Delivery): Vehicle / Delivery type ════ */}
          {step === "config" && bookingType === "day_rate" && (
            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Vehicle</h3>
                <div className="grid grid-cols-2 gap-2">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setVehicleType(v.value as VehicleType)}
                      className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${vehicleType === v.value ? "border-[#C9A962] bg-[#C9A962]/5" : "border-[var(--brd)] hover:border-[#C9A962]/50"}`}
                    >
                      <div className="text-[13px] font-semibold text-[var(--tx)]">{v.label}</div>
                      <div className="text-[10px] text-[var(--tx3)]">{v.capacity}</div>
                      <div className="text-[10px] text-[var(--tx3)]">Max payload: {v.payload}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Duration</h3>
                <div className="grid grid-cols-2 gap-2">
                  {([["full_day", "Full Day", "6 stops incl."], ["half_day", "Half Day", "3 stops incl."]] as const).map(([val, label, desc]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDayType(val)}
                      className={`px-3 py-3 rounded-xl border-2 text-left transition-all ${dayType === val ? "border-[#C9A962] bg-[#C9A962]/5" : "border-[var(--brd)] hover:border-[#C9A962]/50"}`}
                    >
                      <div className="text-[13px] font-semibold text-[var(--tx)]">{label}</div>
                      <div className="text-[10px] text-[var(--tx3)]">{desc}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Number of Stops</h3>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setNumStops((n) => Math.max(1, n - 1))} className="w-9 h-9 rounded-lg border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)]">-</button>
                  <span className="text-[22px] font-bold text-[var(--tx)] w-10 text-center">{numStops}</span>
                  <button type="button" onClick={() => setNumStops((n) => n + 1)} className="w-9 h-9 rounded-lg border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)]">+</button>
                </div>
              </section>

              {renderSurcharges()}
              {renderServicesSection()}
              {renderPricePreview()}
            </div>
          )}

          {step === "config" && bookingType === "per_delivery" && (
            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Delivery Type</h3>
                <div className="space-y-2">
                  {DELIVERY_TYPES.map((dt) => (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setDeliveryType(dt.value)}
                      className={`w-full px-4 py-3 rounded-xl border-2 text-left transition-all ${deliveryType === dt.value ? "border-[#C9A962] bg-[#C9A962]/5" : "border-[var(--brd)] hover:border-[#C9A962]/50"}`}
                    >
                      <div className="text-[13px] font-semibold text-[var(--tx)]">{dt.label}</div>
                      <div className="text-[10px] text-[var(--tx3)]">{dt.desc}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Zone</h3>
                <select value={zone} onChange={(e) => setZone(Number(e.target.value))} className={fieldInput}>
                  <option value={1}>Zone 1 — GTA (0–40 km) — Included</option>
                  <option value={2}>Zone 2 — Outer GTA (40–70 km) — + $120–$145</option>
                  <option value={3}>Zone 3 — Extended (70–100 km) — + $210–$245</option>
                  <option value={4}>Zone 4 — Remote (100+ km) — Custom</option>
                </select>
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Delivery Access</h3>
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
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Item Weight</h3>
                <select value={itemWeightCategory} onChange={(e) => setItemWeightCategory(e.target.value)} className={fieldInput}>
                  <option value="standard">Standard (under 100 lbs)</option>
                  <option value="heavy">Heavy (100–250 lbs) — +$50</option>
                  <option value="very_heavy">Very Heavy (250–500 lbs) — +$100</option>
                  <option value="oversized_fragile">Oversized / Fragile (3+ crew) — +$175</option>
                </select>
              </section>

              {/* Heavy Items */}
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Heavy / Oversized Items</h3>
                <p className="text-[11px] text-[var(--tx3)]">Items over 250 lbs incur additional surcharges.</p>
                <div className="space-y-2">
                  {([
                    { label: "250–400 lbs", tier: "250_400" as const },
                    { label: "400–600 lbs", tier: "400_600" as const },
                  ]).map((t) => {
                    const existing = heavyItems.find((h) => h.tier === t.tier);
                    const count = existing?.count ?? 0;
                    return (
                      <div key={t.tier} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--brd)]">
                        <span className="text-[13px] text-[var(--tx)]">{t.label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setHeavyItems((prev) => {
                                const updated = prev.filter((h) => h.tier !== t.tier);
                                if (count > 1) updated.push({ tier: t.tier, count: count - 1 });
                                return updated;
                              })
                            }
                            disabled={count === 0}
                            className="w-7 h-7 rounded border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)] disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-[var(--text-base)] font-bold text-[var(--tx)]">{count}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setHeavyItems((prev) => {
                                const updated = prev.filter((h) => h.tier !== t.tier);
                                updated.push({ tier: t.tier, count: count + 1 });
                                return updated;
                              })
                            }
                            className="w-7 h-7 rounded border border-[var(--brd)] flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg2)]"
                          >
                            +
                          </button>
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

          {/* ════ Step 3: Delivery Details ════ */}
          {step === "details" && (
            <div className="space-y-5">
              {/* Client */}
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Client / Recipient</h3>
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

              {/* Addresses */}
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Addresses</h3>
                <FormField label="Pickup Address">
                  <AddressAutocomplete value={form.pickup_address || pickupRaw} onRawChange={setPickupRaw} onChange={(r) => set("pickup_address", r.fullAddress)} placeholder="Warehouse or store" className={fieldInput} />
                </FormField>
                <FormField label="Delivery Address" required>
                  <AddressAutocomplete value={form.delivery_address || deliveryRaw} onRawChange={setDeliveryRaw} onChange={(r) => set("delivery_address", r.fullAddress)} placeholder="Destination" className={fieldInput} />
                </FormField>
              </section>

              {/* Schedule */}
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Schedule</h3>
                <div className="grid grid-cols-1 gap-y-3">
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
                </div>
              </section>

              {/* Inventory */}
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Inventory</h3>
                {inventory.length > 0 && (
                  <ul className="space-y-1.5 mb-2">
                    {inventory.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg2)] border border-[var(--brd)]">
                        <span className="text-[12px] text-[var(--tx)]">{item}</span>
                        <button type="button" onClick={() => removeInventoryItem(idx)} className="p-1 rounded text-[var(--tx3)] hover:text-red-600" aria-label="Remove"><Trash2 className="w-[14px] h-[14px]" /></button>
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
                    <textarea value={inventoryBulkText} onChange={(e) => setInventoryBulkText(e.target.value)} placeholder="One item per line, e.g. Sofa x2
Coffee Table" rows={3} className={`${fieldInput} resize-y text-[13px]`} />
                    <button type="button" onClick={addBulkInventoryItems} disabled={!inventoryBulkText.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50">
                      <Plus className="w-[14px] h-[14px]" /> Add all
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 items-end">
                    <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())} placeholder="Item (e.g. Couch x2)" className={`${fieldInput} flex-1 min-w-[120px]`} />
                    <input type="number" min={1} max={99} value={newItemQty} onChange={(e) => setNewItemQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))} className={`${fieldInput} w-16`} />
                    <button type="button" onClick={addInventoryItem} disabled={!newItemName.trim()} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50">
                      <Plus className="w-[14px] h-[14px]" /> Add
                    </button>
                  </div>
                )}
              </section>

              {/* Complexity */}
              <section className="space-y-2">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Complexity</h3>
                <div className="flex flex-wrap gap-2">
                  {COMPLEXITY_PRESETS.map((preset) => (
                    <button key={preset} type="button" onClick={() => toggleComplexity(preset)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${form.complexityIndicators.includes(preset) ? "bg-[#C9A962]/20 text-[#8B6914] border-[#C9A962]" : "bg-[var(--card)] text-[var(--tx3)] border-[var(--brd)] hover:border-[#C9A962]/50"}`}>
                      {preset}
                    </button>
                  ))}
                </div>
              </section>

              {/* Notes */}
              <section className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Notes</h3>
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

          {/* ════ Step 4: Review ════ */}
          {step === "review" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[var(--brd)] p-4 space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-[13px]">
                  <div className="text-[var(--tx3)]">Type</div>
                  <div className="font-semibold text-[var(--tx)]">{bookingType === "day_rate" ? "Day Rate" : "Per Delivery"}</div>
                  {bookingType === "day_rate" && <>
                    <div className="text-[var(--tx3)]">Vehicle</div>
                    <div className="font-semibold text-[var(--tx)]">{VEHICLE_TYPES.find((v) => v.value === vehicleType)?.label}</div>
                    <div className="text-[var(--tx3)]">Duration</div>
                    <div className="font-semibold text-[var(--tx)]">{dayType === "full_day" ? "Full Day" : "Half Day"}</div>
                    <div className="text-[var(--tx3)]">Stops</div>
                    <div className="font-semibold text-[var(--tx)]">{numStops}</div>
                  </>}
                  {bookingType === "per_delivery" && <>
                    <div className="text-[var(--tx3)]">Delivery Type</div>
                    <div className="font-semibold text-[var(--tx)]">{DELIVERY_TYPES.find((d) => d.value === deliveryType)?.label}</div>
                    <div className="text-[var(--tx3)]">Zone</div>
                    <div className="font-semibold text-[var(--tx)]">Zone {zone}</div>
                  </>}
                  <div className="text-[var(--tx3)]">Customer</div>
                  <div className="font-semibold text-[var(--tx)]">{form.customer_name || "—"}</div>
                  <div className="text-[var(--tx3)]">Date</div>
                  <div className="font-semibold text-[var(--tx)]">{form.scheduled_date || "—"}</div>
                  <div className="text-[var(--tx3)]">Delivery To</div>
                  <div className="font-semibold text-[var(--tx)] truncate">{form.delivery_address || "—"}</div>
                </div>
              </div>

              {renderPricePreview()}

              <p className="text-[11px] text-[var(--tx3)] text-center">Your rates are locked in per your partnership agreement.</p>
            </div>
          )}
        </div>

        {/* Footer buttons — hidden when day_rate flow (DeliveryDayForm has its own) */}
        {step !== "day_flow" && (
          <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--brd)] px-4 sm:px-6 py-3 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (step === "config") onClose();
                else if (step === "details") setStep("config");
                else if (step === "review") setStep("details");
              }}
              className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:bg-[var(--bg2)] transition-colors"
            >
              Back
            </button>
            {step === "review" ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit delivery request"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (step === "config" && bookingType === "day_rate") setStep("day_flow");
                  else if (step === "config" && bookingType === "per_delivery") setStep("details");
                  else if (step === "details") { setStep("review"); fetchPricing(); }
                }}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[#C9A962] text-white hover:bg-[#B8862E] transition-colors"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);

  /* ─── Shared UI sections ─── */

  function renderSurcharges() {
    return (
      <section className="space-y-2">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Surcharges</h3>
        <div className="flex gap-3">
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
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Add-on Services</h3>
        <div className="space-y-1.5">
          {displayServices.map((svc) => (
            <label key={svc.slug} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--brd)] hover:border-[#C9A962]/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={!!selectedServices[svc.slug]?.enabled}
                  onChange={() => toggleService(svc.slug)}
                  className="rounded border-[var(--brd)] text-[#C9A962] focus:ring-[#C9A962]"
                />
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
                {fmtCurrency(svc.price_min)}
                {svc.price_max ? ` – ${fmtCurrency(svc.price_max)}` : ""}
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
                Rates shown are base prices for standard access (elevator/ground). Walk-up, long carry, and heavy item surcharges may apply.
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

function FormField({ label, required, children, className = "" }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)] mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
