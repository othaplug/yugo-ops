"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import AddressAutocomplete, { type AddressResult } from "@/components/ui/AddressAutocomplete";
import {
  CalendarBlank,
  Clock, Sun, SunHorizon as Sunset, MapPin, Plus, Trash as Trash2,
  Warning as AlertTriangle, CaretRight as ChevronRight, X, ArrowLeft, Sparkle as Sparkles,
} from "@phosphor-icons/react";
import {
  ITEM_CATALOG, SIZE_LABELS, VEHICLE_OPTIONS, TIME_WINDOW_CHOICES,
  type StopDetail, type ItemSize, type VehicleType, type DayType, type TimeWindow,
  recommendTruck, recommendDayType, detectZoneFromCoords, getItemSummary, createEmptyStop,
} from "@/lib/delivery-day-booking";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER, countDigitsInRange, getPhoneCursorPosition } from "@/lib/phone";

interface ServiceOption { slug: string; service_name: string; price_min: number; price_max: number | null; price_unit: string }
interface PriceResult {
  basePrice: number; overagePrice: number; servicesPrice: number;
  zoneSurcharge: number; afterHoursSurcharge: number; totalPrice: number;
  breakdown: { label: string; amount: number; detail?: string }[];
  effectivePerStop?: number;
}

interface DeliveryDayFormProps {
  orgId: string;
  orgType: string;
  initialDate?: string;
  initialVehicle?: VehicleType;
  initialDayType?: DayType;
  /** Partner default address to pre-fill pickup (e.g. from organizations.default_pickup_address). */
  initialPickupAddress?: string;
  /** Override create API URL (e.g. for admin: "/api/admin/deliveries/create"). */
  createApiUrl?: string;
  /** Extra payload merged into create request body (e.g. { organization_id } for admin). */
  extraCreatePayload?: Record<string, unknown>;
  /** Override price API URL when using admin flow (e.g. "/api/admin/deliveries/price"). */
  priceApiUrl?: string;
  /** Extra body for price request (e.g. { organization_id } for admin). */
  priceRequestExtra?: Record<string, unknown>;
  onSuccess: () => void;
  onBackToConfig: () => void;
}

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-colors";

const DEFAULT_SERVICES: ServiceOption[] = [
  { slug: "assembly", service_name: "Standard Assembly", price_min: 60, price_max: 125, price_unit: "flat" },
  { slug: "stair_carry", service_name: "Stair Carry", price_min: 40, price_max: null, price_unit: "per_flight" },
  { slug: "removal", service_name: "Old Furniture Removal", price_min: 80, price_max: 165, price_unit: "flat" },
];

const TW_ICONS: Record<TimeWindow, typeof Sun> = { morning: Sun, afternoon: Sunset, full_day: Clock };

export default function DeliveryDayForm({
  orgId, orgType, initialDate = "", initialVehicle = "sprinter", initialDayType = "full_day",
  initialPickupAddress = "",
  createApiUrl = "/api/partner/deliveries/create",
  extraCreatePayload = {},
  priceApiUrl = "/api/partner/deliveries/price",
  priceRequestExtra = {},
  onSuccess, onBackToConfig,
}: DeliveryDayFormProps) {
  const [step, setStep] = useState(1);
  const [scheduledDate, setScheduledDate] = useState(initialDate);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("morning");
  const [pickupAddress, setPickupAddress] = useState(initialPickupAddress);
  const [pickupRaw, setPickupRaw] = useState(initialPickupAddress);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const MIN_STOPS = 3;
  const [stops, setStops] = useState<StopDetail[]>(
    Array.from({ length: MIN_STOPS }, () => createEmptyStop())
  );
  const [itemSelectorOpen, setItemSelectorOpen] = useState<number | null>(null);
  const [itemCategory, setItemCategory] = useState<ItemSize>("large");
  const [recVehicle, setRecVehicle] = useState<VehicleType>(initialVehicle);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(initialVehicle);
  const [recDayType, setRecDayType] = useState<DayType>(initialDayType);
  const [selectedDayType, setSelectedDayType] = useState<DayType>(initialDayType);
  const [pricing, setPricing] = useState<PriceResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [availableServices, setAvailableServices] = useState<ServiceOption[]>(DEFAULT_SERVICES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const stopPhoneRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nextPhoneCursorRef = useRef<{ idx: number; pos: number } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/partner/deliveries/services?org_id=${orgId}`)
      .then((r) => r.json())
      .then((d) => { if (d.services?.length) setAvailableServices(d.services); })
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!pickupCoords) return;
    setStops((prev) => prev.map((s) => {
      if (!s.lat || !s.lng) return s;
      const { zone, zoneName } = detectZoneFromCoords(pickupCoords.lat, pickupCoords.lng, s.lat, s.lng);
      return { ...s, zone, zoneName };
    }));
  }, [pickupCoords]);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    const allServices = stops.flatMap((s) =>
      Object.entries(s.services).filter(([, v]) => v.enabled).map(([slug, v]) => ({
        slug,
        quantity: slug === "stair_carry" ? v.quantity : 1,
      })),
    );
    const stopsZones = stops.map((s, i) => ({ stop_number: i + 1, zone: s.zone }));
    // Count oversized/heavy items across all stops for pricing surcharge
    const oversizedCount = stops.reduce((acc, s) =>
      acc + s.items.filter((it) => it.size === "oversized").reduce((sum, it) => sum + it.quantity, 0), 0);
    const priceBody = {
      booking_type: "day_rate",
      vehicle_type: selectedVehicle,
      day_type: selectedDayType,
      num_stops: stops.length,
      services: allServices,
      is_after_hours: false,
      is_weekend: false,
      stops_zones: stopsZones,
      oversized_count: oversizedCount,
      ...priceRequestExtra,
    };
    try {
      const res = await fetch(priceApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(priceBody),
      });
      const data = await res.json();
      if (res.ok) setPricing(data);
      else setPricing(null);
    } catch {
      setPricing(null);
    } finally {
      setPricingLoading(false);
    }
  }, [stops, selectedVehicle, selectedDayType, priceApiUrl, priceRequestExtra]);

  useEffect(() => {
    if (step !== 3) return;
    setPricing(null);
    setPricingLoading(true);
    const t = setTimeout(() => { fetchPricing(); }, 350);
    return () => clearTimeout(t);
  }, [fetchPricing, step]);

  const updateStop = (idx: number, u: Partial<StopDetail>) =>
    setStops((p) => p.map((s, i) => (i === idx ? { ...s, ...u } : s)));
  const addStop = () => setStops((p) => [...p, createEmptyStop()]);
  const removeStop = (idx: number) => {
    if (stops.length <= MIN_STOPS) return;
    setStops((p) => p.filter((_, i) => i !== idx));
    if (itemSelectorOpen === idx) setItemSelectorOpen(null);
  };

  const handleStopPhoneChange = useCallback((idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const raw = input.value.replace(/\D/g, "").slice(-10);
    const formatted = formatPhone(raw);
    updateStop(idx, { customerPhone: formatted });
    const digitCountBeforeCursor = countDigitsInRange(input.value, 0, input.selectionStart ?? 0);
    nextPhoneCursorRef.current = { idx, pos: getPhoneCursorPosition(formatted, digitCountBeforeCursor) };
  }, []);

  useLayoutEffect(() => {
    const cur = nextPhoneCursorRef.current;
    if (cur !== null && stopPhoneRefs.current[cur.idx]) {
      stopPhoneRefs.current[cur.idx]!.setSelectionRange(cur.pos, cur.pos);
      nextPhoneCursorRef.current = null;
    }
  });

  const handleStopAddress = (idx: number, r: AddressResult) => {
    const u: Partial<StopDetail> = { address: r.fullAddress, lat: r.lat, lng: r.lng };
    if (pickupCoords && r.lat && r.lng) {
      const { zone, zoneName } = detectZoneFromCoords(pickupCoords.lat, pickupCoords.lng, r.lat, r.lng);
      u.zone = zone;
      u.zoneName = zoneName;
    }
    updateStop(idx, u);
  };

  const addItemToStop = (si: number, name: string, size: ItemSize) => {
    setStops((p) =>
      p.map((s, i) => {
        if (i !== si) return s;
        const dup = s.items.findIndex((it) => it.name === name && it.size === size);
        if (dup >= 0) {
          const u = [...s.items];
          u[dup] = { ...u[dup], quantity: u[dup].quantity + 1 };
          return { ...s, items: u };
        }
        return { ...s, items: [...s.items, { name, size, quantity: 1 }] };
      }),
    );
  };
  const removeItemFromStop = (si: number, ii: number) =>
    setStops((p) => p.map((s, i) => (i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) })));
  const updateItemQty = (si: number, ii: number, q: number) =>
    setStops((p) =>
      p.map((s, i) => {
        if (i !== si) return s;
        const u = [...s.items];
        u[ii] = { ...u[ii], quantity: Math.max(1, q) };
        return { ...s, items: u };
      }),
    );

  const toggleStopSvc = (si: number, slug: string) =>
    setStops((p) =>
      p.map((s, i) =>
        i !== si
          ? s
          : { ...s, services: { ...s.services, [slug]: { enabled: !s.services[slug]?.enabled, quantity: s.services[slug]?.quantity || 1 } } },
      ),
    );
  const updateStopSvcQty = (si: number, slug: string, q: number) =>
    setStops((p) =>
      p.map((s, i) =>
        i !== si ? s : { ...s, services: { ...s.services, [slug]: { ...(s.services[slug] || { enabled: true, quantity: 1 }), quantity: Math.max(1, q) } } },
      ),
    );

  const computeRecs = useCallback(() => {
    const v = recommendTruck(stops);
    const d = recommendDayType(stops.length);
    setRecVehicle(v);
    setRecDayType(d);
    setSelectedVehicle(v);
    setSelectedDayType(d);
  }, [stops]);

  const handleSubmit = async () => {
    if (!scheduledDate) {
      setError("Date is required");
      return;
    }
    if (!stops.some((s) => s.address.trim())) {
      setError("At least one stop with an address is required");
      return;
    }
    setSubmitting(true);
    setError("");
    const stopsPayload = stops.map((s) => ({
      address: s.address,
      zone: s.zone,
      customer_name: s.customerName,
      customer_phone: s.customerPhone ? normalizePhone(s.customerPhone) : null,
      items: s.items,
      services: Object.entries(s.services)
        .filter(([, v]) => v.enabled)
        .map(([slug, v]) => ({ slug, quantity: v.quantity })),
      instructions: s.instructions,
    }));
    const itemsList = stops.flatMap((s) => s.items.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name} (${i.size})`));
    const svcList = stops.flatMap((s) =>
      Object.entries(s.services)
        .filter(([, v]) => v.enabled)
        .map(([slug, v]) => ({ slug, quantity: v.quantity })),
    );
    const payload = {
      customer_name: stops[0]?.customerName || "Day Rate Delivery",
      pickup_address: pickupAddress,
      delivery_address: stops[0]?.address || "",
      scheduled_date: scheduledDate,
      delivery_window: timeWindow,
      booking_type: "day_rate",
      vehicle_type: selectedVehicle,
      day_type: selectedDayType,
      num_stops: stops.length,
      recommended_vehicle: recVehicle,
      recommended_day_type: recDayType,
      stops_detail: stopsPayload,
      stops: stopsPayload.map((s) => ({
        address: s.address,
        zone: s.zone,
        customer_name: s.customer_name,
        customer_phone: s.customer_phone,
        items_description: Array.isArray(s.items) ? s.items.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name} (${i.size})`).join(", ") : null,
        services_selected: s.services,
        special_instructions: s.instructions,
      })),
      items: itemsList,
      base_price: pricing?.basePrice || 0,
      overage_price: pricing?.overagePrice || 0,
      services_price: pricing?.servicesPrice || 0,
      zone_surcharge: pricing?.zoneSurcharge || 0,
      after_hours_surcharge: pricing?.afterHoursSurcharge || 0,
      total_price: pricing?.totalPrice || 0,
      services_selected: svcList,
      ...extraCreatePayload,
    };
    try {
      const res = await fetch(createApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create delivery");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const canStep1 = !!scheduledDate;
  const canStep2 = stops.length > 0 && stops.some((s) => s.address.trim());
  const summary = getItemSummary(stops);
  const stepLabels = ["Date & Time", "Add Stops", "Your Delivery Day", "Review"];

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1 rounded-full transition-all ${i < step ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`} />
            <span className={`text-[10px] mt-1 block ${i === step - 1 ? "text-[var(--gold)] font-semibold" : "text-[var(--tx3)]"}`}>{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-[var(--red)]/10 border border-[var(--red)]/30 text-[13px] text-[var(--red)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} className="shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 shadow-sm space-y-5">
          <div className="text-center py-2">
            <h3 className="text-[20px] font-bold text-[var(--tx)]">When do you need delivery?</h3>
          </div>
          <section className="space-y-2">
            <label className="block text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Date</label>
            <div className="relative">
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={`${fieldInput} pr-10`} style={{ colorScheme: "dark" }} />
              <CalendarBlank
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]"
                aria-hidden
              />
            </div>
          </section>
          <section className="space-y-3">
            <label className="block text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Time Window</label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_WINDOW_CHOICES.map((tw) => {
                const Icon = TW_ICONS[tw.value];
                const active = timeWindow === tw.value;
                return (
                  <button
                    key={tw.value}
                    type="button"
                    onClick={() => setTimeWindow(tw.value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${active ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--brd)] hover:border-[var(--gold)]/50"}`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`} />
                    <div className={`text-[13px] font-semibold ${active ? "text-[var(--tx)]" : "text-[var(--tx2)]"}`}>{tw.label}</div>
                    <div className="text-[10px] text-[var(--tx3)]">{tw.range}</div>
                  </button>
                );
              })}
            </div>
          </section>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[var(--gold)]" />
              <label className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Pickup Address</label>
            </div>
            <AddressAutocomplete
              value={pickupAddress || pickupRaw}
              onRawChange={(v) => {
                setPickupRaw(v);
                setPickupAddress(v);
              }}
              onChange={(r: AddressResult) => {
                setPickupAddress(r.fullAddress);
                setPickupRaw(r.fullAddress);
                setPickupCoords({ lat: r.lat, lng: r.lng });
              }}
              placeholder="Warehouse or store"
              className={fieldInput}
            />
          </section>

          {stops.map((stop, idx) => (
            <div key={stop.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-bold text-[var(--tx)] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[var(--gold)] text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                  Stop {idx + 1}
                </h4>
                {stops.length > MIN_STOPS && (
                  <button type="button" onClick={() => removeStop(idx)} className="text-[var(--tx3)] hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <AddressAutocomplete
                value={stop.address}
                onRawChange={(raw) => updateStop(idx, { address: raw, lat: null, lng: null, zone: null, zoneName: "" })}
                onChange={(r: AddressResult) => handleStopAddress(idx, r)}
                placeholder="Delivery address"
                className={fieldInput}
              />
              {stop.zone != null && (
                <div className="text-[11px] text-[var(--tx3)] flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Zone {stop.zone} · {stop.zoneName}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={stop.customerName}
                  onChange={(e) => updateStop(idx, { customerName: e.target.value })}
                  placeholder="Customer name"
                  className={fieldInput}
                />
                <input
                  ref={(el) => { stopPhoneRefs.current[idx] = el; }}
                  type="tel"
                  value={stop.customerPhone}
                  onChange={handleStopPhoneChange(idx)}
                  placeholder={PHONE_PLACEHOLDER}
                  className={fieldInput}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Items</span>
                  <button
                    type="button"
                    onClick={() => {
                      setItemSelectorOpen(itemSelectorOpen === idx ? null : idx);
                      setItemCategory("large");
                    }}
                    className="text-[11px] font-semibold text-[var(--gold)] hover:opacity-75 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add item
                  </button>
                </div>
                {itemSelectorOpen === idx && (
                  <div className="rounded-lg border border-[var(--brd)] p-3 bg-[var(--bg)] space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {(Object.keys(ITEM_CATALOG) as ItemSize[]).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setItemCategory(cat)}
                          className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors ${itemCategory === cat ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--card)] text-[var(--tx2)] border border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
                        >
                          {SIZE_LABELS[cat]}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ITEM_CATALOG[itemCategory].map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => addItemToStop(idx, name, itemCategory)}
                          className="px-2.5 py-1.5 text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-colors text-[var(--tx)]"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {stop.items.length > 0 && (
                  <ul className="space-y-1">
                    {stop.items.map((item, ii) => (
                      <li key={ii} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg)]">
                        <span className="text-[12px] text-[var(--tx)]">
                          {item.quantity > 1 && <span className="font-semibold">{item.quantity}x </span>}
                          {item.name} <span className="text-[var(--tx3)]">({item.size})</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateItemQty(idx, ii, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-6 h-6 rounded border border-[var(--brd)] flex items-center justify-center text-[var(--tx2)] text-[11px] hover:bg-[var(--card)] disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="text-[12px] w-5 text-center font-semibold text-[var(--tx)]">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(idx, ii, item.quantity + 1)}
                            className="w-6 h-6 rounded border border-[var(--brd)] flex items-center justify-center text-[var(--tx2)] text-[11px] hover:bg-[var(--card)]"
                          >
                            +
                          </button>
                          <button type="button" onClick={() => removeItemFromStop(idx, ii)} className="text-[var(--tx3)] hover:text-red-500 ml-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {availableServices.filter((s) => s.price_unit !== "percentage").length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase text-[#888]">Services at this stop</span>
                  {availableServices
                    .filter((s) => s.price_unit !== "percentage")
                    .map((svc) => (
                      <label
                        key={svc.slug}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)]/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={!!stop.services[svc.slug]?.enabled}
                            onChange={() => toggleStopSvc(idx, svc.slug)}
                            className="rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--gold)] shrink-0"
                          />
                          <span className="text-[12px] text-[var(--tx)]">{svc.service_name}</span>
                          {svc.slug === "stair_carry" && stop.services[svc.slug]?.enabled && (
                            <div className="flex items-center gap-1 ml-1">
                              <span className="text-[10px] text-[var(--tx3)]">Flights:</span>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={stop.services[svc.slug]?.quantity || 1}
                                onChange={(e) => updateStopSvcQty(idx, svc.slug, parseInt(e.target.value) || 1)}
                                className="w-12 text-[11px] border border-[var(--brd)] rounded px-1.5 py-0.5 bg-[var(--bg)] text-[var(--tx)]"
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-[var(--gold)] shrink-0">
                          {fmt(svc.price_min)}
                          {svc.price_max ? `–${fmt(svc.price_max)}` : ""}
                          {svc.price_unit === "per_flight" ? "/flight" : ""}
                        </span>
                      </label>
                    ))}
                </div>
              )}
              <textarea
                value={stop.instructions}
                onChange={(e) => updateStop(idx, { instructions: e.target.value })}
                placeholder="Special instructions for this stop…"
                rows={2}
                className={`${fieldInput} resize-y text-[12px]`}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addStop}
            className="w-full py-3 rounded-xl text-[13px] font-semibold text-[var(--tx2)] hover:text-[var(--gold)] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add another stop
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-xl border-2 border-[var(--gold)]/30 bg-[var(--gdim)] p-5 space-y-4">
            <h3 className="text-[15px] font-bold text-[var(--tx)] tracking-tight">Your delivery day</h3>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--gold)]/12 to-[var(--gold)]/8 border border-[var(--gold)]/20">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--gold)]/15 text-[var(--gold)]">
                <Sparkles className="w-4 h-4" strokeWidth={1.8} />
              </div>
              <span className="text-[13px] font-semibold text-[var(--gold)]">
                Recommended: {VEHICLE_OPTIONS.find((v) => v.value === recVehicle)?.label ?? recVehicle}
              </span>
            </div>
            <p className="text-[12px] text-[var(--tx2)]">
              {stops.length} stop{stops.length !== 1 ? "s" : ""} · {summary.totalItems} item{summary.totalItems !== 1 ? "s" : ""}
            </p>
            {pricingLoading && <div className="text-[12px] text-[var(--tx3)]">Calculating price…</div>}
            {pricing && (
              <div className="space-y-2 pt-2 border-t border-[var(--gold)]/20">
                {pricing.breakdown.map((item, i) => (
                  <div key={i} className="flex justify-between text-[13px]">
                    <span className="text-[var(--tx2)]">{item.label}</span>
                    <span className={`font-semibold ${item.amount < 0 ? "text-green-500" : "text-[var(--tx)]"}`}>
                      {item.amount < 0 ? `-${fmt(Math.abs(item.amount))}` : fmt(item.amount)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[var(--gold)]/20 pt-2 mt-1 flex justify-between">
                  <span className="text-[var(--text-base)] font-bold text-[var(--tx)]">Total</span>
                  <span className="text-[18px] font-bold text-[var(--gold)]">{fmt(pricing.totalPrice)}</span>
                </div>
                {pricing.effectivePerStop != null && pricing.effectivePerStop > 0 && (
                  <div className="text-[11px] text-[var(--tx3)] text-right">Effective per stop: {fmt(pricing.effectivePerStop)}</div>
                )}
              </div>
            )}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-[var(--tx3)]">Want a different truck?</span>
              <div className="grid grid-cols-4 gap-1.5">
                {VEHICLE_OPTIONS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setSelectedVehicle(v.value)}
                    className={`px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all ${selectedVehicle === v.value ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]" : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/50"}`}
                  >
                    {v.short}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[var(--tx3)]">Want to change duration?</span>
              <div className="grid grid-cols-2 gap-2">
                {(["full_day", "half_day"] as const).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setSelectedDayType(dt)}
                    className={`px-3 py-2.5 rounded-lg text-[12px] font-semibold border transition-all ${selectedDayType === dt ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]" : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/50"}`}
                  >
                    {dt === "full_day" ? "Full Day" : "Half Day"}
                  </button>
                ))}
              </div>
              {selectedDayType === "half_day" && stops.length > MIN_STOPS && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Half day is optimized for {MIN_STOPS} stops. You have {stops.length}, please confirm with Yugo if additional time may be needed.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-[15px] font-bold text-[var(--tx)]">Review Your Delivery Day</h3>
          <div className="rounded-xl border border-[var(--brd)] p-4 space-y-2">
            {[
              ["Date", scheduledDate || "-"],
              ["Time", `${TIME_WINDOW_CHOICES.find((t) => t.value === timeWindow)?.label} (${TIME_WINDOW_CHOICES.find((t) => t.value === timeWindow)?.range})`],
              ["Pickup", pickupAddress || "-"],
              ["Vehicle", VEHICLE_OPTIONS.find((v) => v.value === selectedVehicle)?.label ?? selectedVehicle],
              ["Duration", selectedDayType === "full_day" ? "Full Day" : "Half Day"],
              ["Stops", String(stops.length)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[13px]">
                <span className="text-[var(--tx3)]">{k}</span>
                <span className="font-semibold text-[var(--tx)] text-right max-w-[60%] truncate">{v}</span>
              </div>
            ))}
          </div>
          {stops.map((stop, idx) => (
            <div key={stop.id} className="rounded-xl border border-[var(--brd)] p-4 space-y-1.5">
              <h4 className="text-[12px] font-bold text-[var(--tx)] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[var(--gold)] text-white text-[9px] font-bold flex items-center justify-center">{idx + 1}</span>
                Stop {idx + 1}
              </h4>
              <p className="text-[12px] text-[var(--tx2)] truncate">{stop.address || "-"}</p>
              {stop.zone != null && <p className="text-[10px] text-[var(--tx3)]">Zone {stop.zone} · {stop.zoneName}</p>}
              {stop.customerName && <p className="text-[11px] text-[var(--tx2)]">{stop.customerName}{stop.customerPhone ? ` · ${formatPhone(stop.customerPhone)}` : ""}</p>}
              {stop.items.length > 0 && (
                <p className="text-[11px] text-[var(--tx3)]">Items: {stop.items.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name}`).join(", ")}</p>
              )}
            </div>
          ))}
          {pricing && (
            <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gdim)] p-4 space-y-2">
              <h3 className="text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] dark:text-[var(--tx)]">Price Summary</h3>
              <div className="border-t border-[var(--gold)]/20 pt-2 flex justify-between">
                <span className="text-[var(--text-base)] font-bold text-[var(--tx)]">Total</span>
                <span className="text-[18px] font-bold text-[var(--gold)]">{fmt(pricing.totalPrice)}</span>
              </div>
            </div>
          )}
          <p className="text-[11px] text-[var(--tx3)] text-center">Your rates are locked in per your partnership agreement.</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onBackToConfig}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 2) computeRecs();
              setStep((s) => s + 1);
            }}
            disabled={step === 1 ? !canStep1 : step === 2 ? !canStep2 : false}
            className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[var(--grn)] text-white hover:opacity-90 transition-colors disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit Delivery Day Request"}
          </button>
        )}
      </div>
    </div>
  );
}
