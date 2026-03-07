"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AddressAutocomplete, { type AddressResult } from "@/components/ui/AddressAutocomplete";
import {
  Calendar, Clock, Sun, Sunset, MapPin, Plus, Trash2, Truck,
  AlertTriangle, ChevronRight, DollarSign, X, ArrowLeft, Users,
} from "lucide-react";
import {
  ITEM_CATALOG, SIZE_LABELS, VEHICLE_OPTIONS, TIME_WINDOW_CHOICES,
  type StopDetail, type ItemSize, type VehicleType, type DayType, type TimeWindow,
  recommendTruck, recommendDayType, detectZoneFromCoords, getItemSummary, createEmptyStop,
} from "@/lib/delivery-day-booking";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ─── */

interface Org { id: string; name: string; type: string; email?: string; contact_name?: string; phone?: string }
interface Crew { id: string; name: string; members?: string[] }
interface ServiceOption { slug: string; service_name: string; price_min: number; price_max: number | null; price_unit: string }
interface PriceResult {
  basePrice: number; overagePrice: number; servicesPrice: number;
  zoneSurcharge: number; afterHoursSurcharge: number; totalPrice: number;
  breakdown: { label: string; amount: number; detail?: string }[];
  effectivePerStop?: number;
}

interface DeliveryDayFormProps {
  mode: "partner" | "admin";
  orgId?: string;
  orgType?: string;
  defaultPickupAddress?: string;
  organizations?: Org[];
  crews?: Crew[];
  initialDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/* ─── Constants ─── */

const fieldInput =
  "w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#999] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors";

const DEFAULT_SERVICES: ServiceOption[] = [
  { slug: "assembly", service_name: "Standard Assembly", price_min: 60, price_max: 125, price_unit: "flat" },
  { slug: "stair_carry", service_name: "Stair Carry", price_min: 40, price_max: null, price_unit: "per_flight" },
  { slug: "removal", service_name: "Old Furniture Removal", price_min: 80, price_max: 165, price_unit: "flat" },
];

const TW_ICONS: Record<TimeWindow, typeof Sun> = { morning: Sun, afternoon: Sunset, full_day: Clock };

/* ─── Component ─── */

export default function DeliveryDayForm({
  mode, orgId, orgType, defaultPickupAddress = "", organizations, crews, initialDate = "", onSuccess, onCancel,
}: DeliveryDayFormProps) {
  const [step, setStep] = useState(1);

  // Step 1
  const [scheduledDate, setScheduledDate] = useState(initialDate);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("morning");
  const [capacityWarning, setCapacityWarning] = useState(false);

  // Step 2
  const [pickupAddress, setPickupAddress] = useState(defaultPickupAddress);
  const [pickupRaw, setPickupRaw] = useState(defaultPickupAddress);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stops, setStops] = useState<StopDetail[]>([createEmptyStop()]);
  const [itemSelectorOpen, setItemSelectorOpen] = useState<number | null>(null);
  const [itemCategory, setItemCategory] = useState<ItemSize>("large");

  // Step 3
  const [recVehicle, setRecVehicle] = useState<VehicleType>("sprinter");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>("sprinter");
  const [recDayType, setRecDayType] = useState<DayType>("half_day");
  const [selectedDayType, setSelectedDayType] = useState<DayType>("half_day");
  const [pricing, setPricing] = useState<PriceResult | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Admin-specific
  const [organizationId, setOrganizationId] = useState(orgId || "");
  const [orgSearch, setOrgSearch] = useState("");
  const [showOrgDD, setShowOrgDD] = useState(false);
  const [crewId, setCrewId] = useState("");
  const orgDDRef = useRef<HTMLDivElement>(null);

  // Services & general
  const [availableServices, setAvailableServices] = useState<ServiceOption[]>(DEFAULT_SERVICES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const effectiveOrgId = mode === "partner" ? orgId : organizationId;

  /* ─── Effects ─── */

  useEffect(() => {
    if (!effectiveOrgId) return;
    const url = mode === "partner"
      ? `/api/partner/deliveries/services?org_id=${effectiveOrgId}`
      : `/api/partner/deliveries/services?org_id=${effectiveOrgId}`;
    fetch(url).then(r => r.json()).then(d => { if (d.services?.length) setAvailableServices(d.services); }).catch(() => {});
  }, [effectiveOrgId, mode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgDDRef.current && !orgDDRef.current.contains(e.target as Node)) setShowOrgDD(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Re-detect zones when pickup changes
  useEffect(() => {
    if (!pickupCoords) return;
    setStops(prev => prev.map(s => {
      if (!s.lat || !s.lng) return s;
      const { zone, zoneName } = detectZoneFromCoords(pickupCoords.lat, pickupCoords.lng, s.lat, s.lng);
      return { ...s, zone, zoneName };
    }));
  }, [pickupCoords]);

  // Capacity check (basic — counts deliveries on date)
  useEffect(() => {
    if (!scheduledDate) { setCapacityWarning(false); return; }
    setCapacityWarning(false);
    // Light check — relies on portal-data or a simple count
    // In production this would hit a dedicated capacity endpoint
  }, [scheduledDate]);

  /* ─── Price fetch ─── */

  const fetchPricing = useCallback(async () => {
    if (!effectiveOrgId) { setPricing(null); return; }
    setPricingLoading(true);
    const allServices = stops.flatMap(s =>
      Object.entries(s.services).filter(([, v]) => v.enabled).map(([slug, v]) => ({
        slug, quantity: slug === "stair_carry" ? v.quantity : 1,
      })),
    );
    const stopsZones = stops.map((s, i) => ({ stop_number: i + 1, zone: s.zone }));
    const endpoint = mode === "partner" ? "/api/partner/deliveries/price" : "/api/admin/deliveries/price";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_type: "day_rate",
          vehicle_type: selectedVehicle,
          day_type: selectedDayType,
          num_stops: stops.length,
          services: allServices,
          is_after_hours: false,
          is_weekend: false,
          stops_zones: stopsZones,
          ...(mode === "admin" ? { organization_id: organizationId } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) setPricing(data); else setPricing(null);
    } catch { setPricing(null); }
    finally { setPricingLoading(false); }
  }, [effectiveOrgId, mode, stops, selectedVehicle, selectedDayType, organizationId]);

  useEffect(() => {
    if (step === 3) { const t = setTimeout(fetchPricing, 350); return () => clearTimeout(t); }
  }, [fetchPricing, step]);

  /* ─── Stop helpers ─── */

  const updateStop = (idx: number, u: Partial<StopDetail>) => setStops(p => p.map((s, i) => i === idx ? { ...s, ...u } : s));
  const addStop = () => setStops(p => [...p, createEmptyStop()]);
  const removeStop = (idx: number) => { setStops(p => p.filter((_, i) => i !== idx)); if (itemSelectorOpen === idx) setItemSelectorOpen(null); };

  const handleStopAddress = (idx: number, r: AddressResult) => {
    const u: Partial<StopDetail> = { address: r.fullAddress, lat: r.lat, lng: r.lng };
    if (pickupCoords && r.lat && r.lng) {
      const { zone, zoneName } = detectZoneFromCoords(pickupCoords.lat, pickupCoords.lng, r.lat, r.lng);
      u.zone = zone; u.zoneName = zoneName;
    }
    updateStop(idx, u);
  };

  const addItemToStop = (si: number, name: string, size: ItemSize) => {
    setStops(p => p.map((s, i) => {
      if (i !== si) return s;
      const dup = s.items.findIndex(it => it.name === name && it.size === size);
      if (dup >= 0) { const u = [...s.items]; u[dup] = { ...u[dup], quantity: u[dup].quantity + 1 }; return { ...s, items: u }; }
      return { ...s, items: [...s.items, { name, size, quantity: 1 }] };
    }));
  };
  const removeItemFromStop = (si: number, ii: number) => setStops(p => p.map((s, i) => i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) }));
  const updateItemQty = (si: number, ii: number, q: number) => setStops(p => p.map((s, i) => { if (i !== si) return s; const u = [...s.items]; u[ii] = { ...u[ii], quantity: Math.max(1, q) }; return { ...s, items: u }; }));

  const toggleStopSvc = (si: number, slug: string) => setStops(p => p.map((s, i) => i !== si ? s : { ...s, services: { ...s.services, [slug]: { enabled: !s.services[slug]?.enabled, quantity: s.services[slug]?.quantity || 1 } } }));
  const updateStopSvcQty = (si: number, slug: string, q: number) => setStops(p => p.map((s, i) => i !== si ? s : { ...s, services: { ...s.services, [slug]: { ...s.services[slug], quantity: Math.max(1, q) } } }));

  const computeRecs = useCallback(() => {
    const v = recommendTruck(stops);
    const d = recommendDayType(stops.length);
    setRecVehicle(v); setSelectedVehicle(v);
    setRecDayType(d); setSelectedDayType(d);
  }, [stops]);

  /* ─── Submit ─── */

  const handleSubmit = async () => {
    if (!scheduledDate) { setError("Date is required"); return; }
    if (!stops.some(s => s.address.trim())) { setError("At least one stop with an address is required"); return; }
    setSubmitting(true);
    setError("");

    const stopsPayload = stops.map(s => ({
      address: s.address, zone: s.zone, customer_name: s.customerName,
      customer_phone: s.customerPhone ? normalizePhone(s.customerPhone) : null,
      items: s.items,
      services: Object.entries(s.services).filter(([, v]) => v.enabled).map(([slug, v]) => ({ slug, quantity: v.quantity })),
      instructions: s.instructions,
    }));
    const itemsList = stops.flatMap(s => s.items.map(i => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name} (${i.size})`));
    const svcList = stops.flatMap(s => Object.entries(s.services).filter(([, v]) => v.enabled).map(([slug, v]) => ({ slug, quantity: v.quantity })));

    try {
      if (mode === "partner") {
        const res = await fetch("/api/partner/deliveries/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: stops[0]?.customerName || "Day Rate Delivery",
            pickup_address: pickupAddress, delivery_address: stops[0]?.address || "",
            scheduled_date: scheduledDate, delivery_window: timeWindow,
            booking_type: "day_rate", vehicle_type: selectedVehicle, day_type: selectedDayType,
            num_stops: stops.length, recommended_vehicle: recVehicle, recommended_day_type: recDayType,
            stops_detail: stopsPayload, items: itemsList,
            base_price: pricing?.basePrice || 0, overage_price: pricing?.overagePrice || 0,
            services_price: pricing?.servicesPrice || 0, zone_surcharge: pricing?.zoneSurcharge || 0,
            after_hours_surcharge: pricing?.afterHoursSurcharge || 0, total_price: pricing?.totalPrice || 0,
            services_selected: svcList,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create delivery");
        onSuccess?.();
      } else {
        const supabase = createClient();
        const org = organizations?.find(o => o.id === organizationId);
        const num = `DLV-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
        const { error: dbError } = await supabase.from("deliveries").insert({
          delivery_number: num, organization_id: organizationId || null,
          client_name: org?.name || "", customer_name: stops[0]?.customerName || "Day Rate Delivery",
          pickup_address: pickupAddress, delivery_address: stops[0]?.address || "",
          scheduled_date: scheduledDate, delivery_window: timeWindow,
          booking_type: "day_rate", vehicle_type: selectedVehicle, day_type: selectedDayType,
          num_stops: stops.length, recommended_vehicle: recVehicle, recommended_day_type: recDayType,
          stops_detail: stopsPayload, items: itemsList,
          status: "scheduled", crew_id: crewId || null, category: org?.type || orgType || "retail",
          base_price: pricing?.basePrice || 0, overage_price: pricing?.overagePrice || 0,
          services_price: pricing?.servicesPrice || 0, zone_surcharge: pricing?.zoneSurcharge || 0,
          after_hours_surcharge: pricing?.afterHoursSurcharge || 0, total_price: pricing?.totalPrice || 0,
          services_selected: svcList, created_by_source: "admin",
        }).select("id").single();
        if (dbError) throw new Error(dbError.message);
        onSuccess?.();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setSubmitting(false); }
  };

  /* ─── Derived ─── */

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const canStep1 = !!scheduledDate && (mode === "partner" || !!organizationId);
  const canStep2 = stops.length > 0 && stops.some(s => s.address.trim());
  const summary = getItemSummary(stops);
  const stepLabels = ["Date & Time", "Add Stops", "Your Delivery Day", "Review"];

  const filteredOrgs = (organizations || []).filter(o => {
    if (!orgSearch) return true;
    const q = orgSearch.toLowerCase();
    return o.name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q) || o.contact_name?.toLowerCase().includes(q);
  });

  /* ─── Render ─── */

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex gap-1.5">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1 rounded-full transition-all ${i < step ? "bg-[#C9A962]" : "bg-[#E8E4DF]"}`} />
            <span className={`text-[10px] mt-1 block ${i === step - 1 ? "text-[#C9A962] font-semibold" : "text-[#999]"}`}>{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} className="shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}

      {/* Footer */}
      <div className="flex gap-3 pt-2">
        {step > 1 ? (
          <button type="button" onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#666] hover:bg-[#F5F3F0] transition-colors flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : onCancel ? (
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#666] hover:bg-[#F5F3F0] transition-colors">
            Cancel
          </button>
        ) : null}
        {step < 4 ? (
          <button type="button"
            onClick={() => { if (step === 2) computeRecs(); setStep(s => s + 1); }}
            disabled={step === 1 ? !canStep1 : step === 2 ? !canStep2 : false}
            className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[#C9A962] text-white hover:bg-[#B8862E] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50">
            {submitting ? "Submitting\u2026" : mode === "admin" ? "Confirm Delivery Day" : "Submit Delivery Day Request"}
          </button>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     STEP 1 — DATE & TIME
     ══════════════════════════════════════ */
  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="text-center py-2">
          <Calendar className="w-8 h-8 text-[#C9A962] mx-auto mb-2" />
          <h3 className="text-[16px] font-bold text-[#1A1A1A]">When do you need delivery?</h3>
        </div>

        {/* Admin: org selector */}
        {mode === "admin" && (
          <section className="space-y-2">
            <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#888]">Client / Partner</label>
            <div className="relative" ref={orgDDRef}>
              <input
                value={orgSearch || (organizationId ? organizations?.find(o => o.id === organizationId)?.name || "" : "")}
                onChange={e => { setOrgSearch(e.target.value); setShowOrgDD(true); if (!e.target.value) setOrganizationId(""); }}
                onFocus={() => setShowOrgDD(true)}
                placeholder="Search clients\u2026"
                className={fieldInput}
              />
              {showOrgDD && filteredOrgs.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#E8E4DF] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {filteredOrgs.map(o => (
                    <button key={o.id} type="button"
                      onClick={() => { setOrganizationId(o.id); setOrgSearch(o.name); setShowOrgDD(false); }}
                      className="w-full text-left px-3 py-2 text-[12px] text-[#1A1A1A] hover:bg-[#F5F3F0] transition-colors">
                      <span className="font-semibold">{o.name}</span>
                      {o.contact_name && <span className="text-[#888]"> &middot; {o.contact_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Date */}
        <section className="space-y-2">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#888]">Date</label>
          <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className={fieldInput} />
        </section>

        {capacityWarning && (
          <div className="px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Limited availability on this date. We&apos;ll confirm within 2 hours.
          </div>
        )}

        {/* Time window */}
        <section className="space-y-3">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#888]">Time Window</label>
          <div className="grid grid-cols-3 gap-2">
            {TIME_WINDOW_CHOICES.map(tw => {
              const Icon = TW_ICONS[tw.value];
              const active = timeWindow === tw.value;
              return (
                <button key={tw.value} type="button" onClick={() => setTimeWindow(tw.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${active ? "border-[#C9A962] bg-[#C9A962]/5" : "border-[#E8E4DF] hover:border-[#C9A962]/50"}`}>
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${active ? "text-[#C9A962]" : "text-[#999]"}`} />
                  <div className={`text-[13px] font-semibold ${active ? "text-[#1A1A1A]" : "text-[#666]"}`}>{tw.label}</div>
                  <div className="text-[10px] text-[#888]">{tw.range}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP 2 — ADD STOPS
     ══════════════════════════════════════ */
  function renderStep2() {
    const displaySvcs = availableServices.filter(s => s.price_unit !== "percentage");
    return (
      <div className="space-y-5">
        {/* Pickup */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#C9A962]" />
            <label className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Pickup Address</label>
          </div>
          <AddressAutocomplete
            value={pickupAddress || pickupRaw}
            onRawChange={v => { setPickupRaw(v); setPickupAddress(v); }}
            onChange={(r: AddressResult) => { setPickupAddress(r.fullAddress); setPickupRaw(r.fullAddress); setPickupCoords({ lat: r.lat, lng: r.lng }); }}
            placeholder="Warehouse or store" className={fieldInput}
          />
        </section>

        {/* Stops */}
        {stops.map((stop, idx) => (
          <div key={stop.id} className="rounded-xl border border-[#E8E4DF] p-4 space-y-3">
            {/* Stop header */}
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold text-[#1A1A1A] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#C9A962] text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                Stop {idx + 1}
              </h4>
              {stops.length > 1 && (
                <button type="button" onClick={() => removeStop(idx)} className="text-[#888] hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Address */}
            <AddressAutocomplete
              value={stop.address}
              onRawChange={raw => updateStop(idx, { address: raw, lat: null, lng: null, zone: null, zoneName: "" })}
              onChange={(r: AddressResult) => handleStopAddress(idx, r)}
              placeholder="Delivery address" className={fieldInput}
            />
            {stop.zone && (
              <div className="text-[11px] text-[#888] flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Zone {stop.zone} &middot; {stop.zoneName}
              </div>
            )}

            {/* Customer */}
            <div className="grid grid-cols-2 gap-2">
              <input value={stop.customerName} onChange={e => updateStop(idx, { customerName: e.target.value })}
                placeholder="Customer name" className={fieldInput} />
              <input value={stop.customerPhone}
                onChange={e => updateStop(idx, { customerPhone: e.target.value })}
                onBlur={() => { if (stop.customerPhone) updateStop(idx, { customerPhone: formatPhone(stop.customerPhone) }); }}
                placeholder="Phone" className={fieldInput} />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Items</span>
                <button type="button" onClick={() => { setItemSelectorOpen(itemSelectorOpen === idx ? null : idx); setItemCategory("large"); }}
                  className="text-[11px] font-semibold text-[#C9A962] hover:text-[#8B6914] flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add item
                </button>
              </div>

              {itemSelectorOpen === idx && (
                <div className="rounded-lg border border-[#E8E4DF] p-3 bg-[#FAF8F5] space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.keys(ITEM_CATALOG) as ItemSize[]).map(cat => (
                      <button key={cat} type="button" onClick={() => setItemCategory(cat)}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors ${itemCategory === cat ? "bg-[#C9A962] text-white" : "bg-white text-[#666] border border-[#E8E4DF] hover:border-[#C9A962]/40"}`}>
                        {SIZE_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ITEM_CATALOG[itemCategory].map(name => (
                      <button key={name} type="button" onClick={() => addItemToStop(idx, name, itemCategory)}
                        className="px-2.5 py-1.5 text-[11px] bg-white border border-[#E8E4DF] rounded-lg hover:border-[#C9A962] hover:bg-[#FFFDF7] transition-colors">
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stop.items.length > 0 && (
                <ul className="space-y-1">
                  {stop.items.map((item, ii) => (
                    <li key={ii} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F5F3F0]">
                      <span className="text-[12px] text-[#1A1A1A]">
                        {item.quantity > 1 && <span className="font-semibold">{item.quantity}x </span>}
                        {item.name} <span className="text-[#888]">({item.size})</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => updateItemQty(idx, ii, item.quantity - 1)} disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded border border-[#E8E4DF] flex items-center justify-center text-[#666] text-[11px] hover:bg-white disabled:opacity-30">-</button>
                        <span className="text-[12px] w-5 text-center font-semibold">{item.quantity}</span>
                        <button type="button" onClick={() => updateItemQty(idx, ii, item.quantity + 1)}
                          className="w-6 h-6 rounded border border-[#E8E4DF] flex items-center justify-center text-[#666] text-[11px] hover:bg-white">+</button>
                        <button type="button" onClick={() => removeItemFromStop(idx, ii)} className="text-[#888] hover:text-red-500 ml-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Services */}
            {displaySvcs.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Services at this stop</span>
                {displaySvcs.map(svc => (
                  <label key={svc.slug} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#E8E4DF] hover:border-[#C9A962]/40 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={!!stop.services[svc.slug]?.enabled} onChange={() => toggleStopSvc(idx, svc.slug)}
                        className="rounded border-[#D4D0CB] text-[#C9A962] focus:ring-[#C9A962] shrink-0" />
                      <span className="text-[12px] text-[#1A1A1A]">{svc.service_name}</span>
                      {svc.slug === "stair_carry" && stop.services[svc.slug]?.enabled && (
                        <div className="flex items-center gap-1 ml-1">
                          <span className="text-[10px] text-[#888]">Flights:</span>
                          <input type="number" min={1} max={10} value={stop.services[svc.slug]?.quantity || 1}
                            onChange={e => updateStopSvcQty(idx, svc.slug, parseInt(e.target.value) || 1)}
                            className="w-12 text-[11px] border border-[#E8E4DF] rounded px-1.5 py-0.5" />
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[#C9A962] shrink-0">
                      {fmt(svc.price_min)}{svc.price_max ? `\u2013${fmt(svc.price_max)}` : ""}
                      {svc.price_unit === "per_flight" ? "/flight" : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Instructions */}
            <textarea value={stop.instructions} onChange={e => updateStop(idx, { instructions: e.target.value })}
              placeholder="Special instructions for this stop\u2026" rows={2}
              className={`${fieldInput} resize-y text-[12px]`} />
          </div>
        ))}

        {/* Add another stop */}
        <button type="button" onClick={addStop}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[#E8E4DF] text-[13px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add another stop
        </button>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP 3 — RECOMMENDATION
     ══════════════════════════════════════ */
  function renderStep3() {
    const recLabel = VEHICLE_OPTIONS.find(v => v.value === recVehicle)?.label || recVehicle;
    const parts: string[] = [];
    if (summary.large > 0) parts.push(`${summary.large} large`);
    if (summary.medium > 0) parts.push(`${summary.medium} medium`);
    if (summary.small > 0) parts.push(`${summary.small} small`);
    if (summary.oversized > 0) parts.push(`${summary.oversized} oversized`);

    return (
      <div className="space-y-5">
        <div className="rounded-xl border-2 border-[#C9A962]/30 bg-[#FFFDF7] p-5 space-y-4">
          <h3 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#C9A962]" /> YOUR DELIVERY DAY
          </h3>

          {/* Recommendation badge */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#C9A962]/10">
            <Truck className="w-4 h-4 text-[#8B6914]" />
            <span className="text-[13px] font-semibold text-[#8B6914]">RECOMMENDED: {recLabel}</span>
          </div>
          <p className="text-[12px] text-[#666]">
            Based on {stops.length} stop{stops.length !== 1 ? "s" : ""} &middot; {summary.totalItems} item{summary.totalItems !== 1 ? "s" : ""}
            {parts.length > 0 && <> ({parts.join(", ")})</>}
          </p>

          {/* Price breakdown */}
          {pricingLoading && <div className="text-[12px] text-[#888]">Calculating price&hellip;</div>}
          {pricing && (
            <div className="space-y-2 pt-2 border-t border-[#C9A962]/20">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#666]">Duration: {selectedDayType === "full_day" ? "Full Day" : "Half Day"}</span>
              </div>
              {pricing.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-[13px]">
                  <span className="text-[#666]">{item.label}</span>
                  <span className={`font-semibold ${item.amount < 0 ? "text-green-600" : "text-[#1A1A1A]"}`}>
                    {item.amount < 0 ? `-${fmt(Math.abs(item.amount))}` : fmt(item.amount)}
                  </span>
                </div>
              ))}
              {/* Per-stop services (visual breakdown) */}
              {stops.some(s => Object.values(s.services).some(v => v.enabled)) && (
                <div className="space-y-1 pl-2">
                  {stops.map((s, si) => {
                    const enabled = Object.entries(s.services).filter(([, v]) => v.enabled);
                    if (enabled.length === 0) return null;
                    return enabled.map(([slug, v]) => {
                      const svc = availableServices.find(sv => sv.slug === slug);
                      if (!svc) return null;
                      const cost = svc.price_unit === "per_flight" ? svc.price_min * (v.quantity || 1) : svc.price_min;
                      return (
                        <div key={`${si}-${slug}`} className="flex justify-between text-[12px]">
                          <span className="text-[#888]">{svc.service_name} (stop {si + 1}{slug === "stair_carry" ? `, ${v.quantity}fl` : ""})</span>
                          <span className="font-semibold text-[#1A1A1A]">{fmt(cost)}</span>
                        </div>
                      );
                    });
                  })}
                </div>
              )}
              {/* Zone surcharges (visual) */}
              {stops.some(s => s.zone && s.zone >= 2) && (
                <div className="space-y-1 pl-2">
                  {stops.map((s, si) => {
                    if (!s.zone || s.zone < 2) return null;
                    return (
                      <div key={si} className="flex justify-between text-[12px]">
                        <span className="text-[#888]">Zone {s.zone} surcharge (stop {si + 1})</span>
                        <span className="font-semibold text-[#1A1A1A]">&mdash;</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-[#C9A962]/20 pt-2 mt-1 flex justify-between">
                <span className="text-[14px] font-bold text-[#1A1A1A]">Total</span>
                <span className="text-[18px] font-bold text-[#C9A962]">{fmt(pricing.totalPrice)}</span>
              </div>
              {pricing.effectivePerStop != null && pricing.effectivePerStop > 0 && (
                <div className="text-[11px] text-[#888] text-right">Effective per stop: {fmt(pricing.effectivePerStop)}</div>
              )}
            </div>
          )}
          {!pricing && !pricingLoading && (
            <div className="text-[12px] text-[#888]">Price estimate not available</div>
          )}

          {/* Vehicle override */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-[#888]">Want a different truck?</span>
            <div className="grid grid-cols-4 gap-1.5">
              {VEHICLE_OPTIONS.map(v => (
                <button key={v.value} type="button" onClick={() => setSelectedVehicle(v.value)}
                  className={`px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all ${selectedVehicle === v.value ? "border-[#C9A962] bg-[#C9A962]/10 text-[#8B6914]" : "border-[#E8E4DF] text-[#666] hover:border-[#C9A962]/50"}`}>
                  {v.short}
                </button>
              ))}
            </div>
          </div>

          {/* Day type override */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-[#888]">Want to change duration?</span>
            <div className="grid grid-cols-2 gap-2">
              {(["full_day", "half_day"] as const).map(dt => (
                <button key={dt} type="button" onClick={() => setSelectedDayType(dt)}
                  className={`px-3 py-2.5 rounded-lg text-[12px] font-semibold border transition-all ${selectedDayType === dt ? "border-[#C9A962] bg-[#C9A962]/10 text-[#8B6914]" : "border-[#E8E4DF] text-[#666] hover:border-[#C9A962]/50"}`}>
                  {dt === "full_day" ? "Full Day" : "Half Day"}
                </button>
              ))}
            </div>
            {selectedDayType === "half_day" && stops.length > 3 && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Half day includes 3 stops. You have {stops.length} &mdash; overages will be higher.
              </p>
            )}
          </div>

          {/* Admin: crew */}
          {mode === "admin" && crews && crews.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#C9A962]/20">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#888]" />
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Assign Crew</span>
              </div>
              <select value={crewId} onChange={e => setCrewId(e.target.value)} className={fieldInput}>
                <option value="">Unassigned</option>
                {crews.map(c => <option key={c.id} value={c.id}>{c.name}{c.members?.length ? ` (${c.members.length})` : ""}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP 4 — REVIEW
     ══════════════════════════════════════ */
  function renderStep4() {
    const twChoice = TIME_WINDOW_CHOICES.find(t => t.value === timeWindow);
    const vLabel = VEHICLE_OPTIONS.find(v => v.value === selectedVehicle)?.label || selectedVehicle;
    return (
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-[#1A1A1A]">Review Your Delivery Day</h3>

        {/* Summary grid */}
        <div className="rounded-xl border border-[#E8E4DF] p-4 space-y-2">
          {[
            ["Date", scheduledDate || "\u2014"],
            ["Time", `${twChoice?.label} (${twChoice?.range})`],
            ["Pickup", pickupAddress || "\u2014"],
            ["Vehicle", vLabel],
            ["Duration", selectedDayType === "full_day" ? "Full Day" : "Half Day"],
            ["Stops", String(stops.length)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[13px]">
              <span className="text-[#888]">{k}</span>
              <span className="font-semibold text-[#1A1A1A] text-right max-w-[60%] truncate">{v}</span>
            </div>
          ))}
        </div>

        {/* Stops */}
        {stops.map((stop, idx) => (
          <div key={stop.id} className="rounded-xl border border-[#E8E4DF] p-4 space-y-1.5">
            <h4 className="text-[12px] font-bold text-[#1A1A1A] flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#C9A962] text-white text-[9px] font-bold flex items-center justify-center">{idx + 1}</span>
              Stop {idx + 1}
            </h4>
            <p className="text-[12px] text-[#666] truncate">{stop.address || "\u2014"}</p>
            {stop.zone != null && <p className="text-[10px] text-[#888]">Zone {stop.zone} &middot; {stop.zoneName}</p>}
            {stop.customerName && <p className="text-[11px] text-[#666]">{stop.customerName}{stop.customerPhone ? ` \u00b7 ${stop.customerPhone}` : ""}</p>}
            {stop.items.length > 0 && (
              <p className="text-[11px] text-[#888]">
                Items: {stop.items.map(i => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name}`).join(", ")}
              </p>
            )}
            {Object.entries(stop.services).filter(([, v]) => v.enabled).length > 0 && (
              <p className="text-[11px] text-[#888]">
                Services: {Object.entries(stop.services).filter(([, v]) => v.enabled).map(([slug]) => {
                  const svc = availableServices.find(s => s.slug === slug);
                  return svc?.service_name || slug;
                }).join(", ")}
              </p>
            )}
            {stop.instructions && <p className="text-[10px] text-[#888] italic">{stop.instructions}</p>}
          </div>
        ))}

        {/* Price */}
        {pricing && (
          <div className="rounded-xl border border-[#C9A962]/30 bg-[#FFFDF7] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#C9A962]" />
              <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#8B6914]">Price Summary</h3>
            </div>
            {pricing.breakdown.map((item, i) => (
              <div key={i} className="flex justify-between text-[13px]">
                <span className="text-[#666]">{item.label}</span>
                <span className={`font-semibold ${item.amount < 0 ? "text-green-600" : "text-[#1A1A1A]"}`}>
                  {item.amount < 0 ? `-${fmt(Math.abs(item.amount))}` : fmt(item.amount)}
                </span>
              </div>
            ))}
            <div className="border-t border-[#C9A962]/20 pt-2 flex justify-between">
              <span className="text-[14px] font-bold text-[#1A1A1A]">Total</span>
              <span className="text-[18px] font-bold text-[#C9A962]">{fmt(pricing.totalPrice)}</span>
            </div>
            {pricing.effectivePerStop != null && pricing.effectivePerStop > 0 && (
              <div className="text-[11px] text-[#888] text-right">Effective per stop: {fmt(pricing.effectivePerStop)}</div>
            )}
          </div>
        )}

        <p className="text-[11px] text-[#888] text-center">
          {mode === "partner" ? "Your rates are locked in per your partnership agreement." : "Price based on partner rate card."}
        </p>
      </div>
    );
  }
}
