"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowsClockwise as RefreshCw, PaperPlaneTilt as Send, CheckCircle, CircleNotch as Loader2, TrendUp as TrendingUp, Warning } from "@phosphor-icons/react";
import InventoryInput, { type InventoryItemEntry } from "@/components/inventory/InventoryInput";
import MultiStopAddressField, { type StopEntry } from "@/components/ui/MultiStopAddressField";
import { getVisibleAddons, ESTATE_ADDON_UI_LINES } from "@/lib/quotes/addon-visibility";
import { quoteDetailDateLabel, quoteFormServiceDateLabel } from "@/lib/quotes/quote-field-labels";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_delivery: "B2B Delivery",
  event: "Event",
  labour_only: "Labour Only",
  bin_rental: "Bin Rental",
};

const SPECIALTY_ITEM_TYPES = [
  "piano_upright", "piano_grand", "pool_table", "safe_under_300lbs", "safe_over_300lbs",
  "hot_tub", "artwork_per_piece", "antique_per_piece", "wine_collection",
  "gym_equipment_per_piece", "motorcycle",
] as const;

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold text-[var(--tx3)] tracking-widest uppercase border-t border-[var(--brd)] pt-4 mt-1">
      {label}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
      <span className="text-[13px] text-[var(--tx)]">{label}</span>
    </label>
  );
}

export default function EditQuoteClient({ originalQuote, addons: allAddons, config: _config, itemWeights }: EditQuoteClientProps) {
  const router = useRouter();
  const oq = originalQuote;
  const contact = Array.isArray(oq.contacts) ? oq.contacts[0] : oq.contacts;
  const [serviceType] = useState<string>(oq.service_type);
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
  const [reason, setReason] = useState("");

  // ── Office move fields ────────────────────────────────────
  const [squareFootage, setSquareFootage] = useState(String(factors.square_footage || oq.square_footage || ""));
  const [workstationCount, setWorkstationCount] = useState(String(factors.workstation_count || oq.workstation_count || ""));
  const [hasItEquipment, setHasItEquipment] = useState(Boolean(factors.has_it_equipment || oq.has_it_equipment));
  const [hasConferenceRoom, setHasConferenceRoom] = useState(Boolean(factors.has_conference_room || oq.has_conference_room));
  const [hasReceptionArea, setHasReceptionArea] = useState(Boolean(factors.has_reception_area || oq.has_reception_area));
  const [timingPreference, setTimingPreference] = useState(factors.timing_preference || oq.timing_preference || "");

  // ── Single item / White glove fields ─────────────────────
  const [itemDescription, setItemDescription] = useState(factors.item_description || oq.item_description || "");
  const [itemCategory, setItemCategory] = useState(factors.item_category || oq.item_category || "");
  const [itemWeightClass, setItemWeightClass] = useState(factors.item_weight_class || oq.item_weight_class || "");
  const [assemblyNeeded, setAssemblyNeeded] = useState(factors.assembly_needed || oq.assembly_needed || "");
  const [stairCarry, setStairCarry] = useState(Boolean(factors.stair_carry || oq.stair_carry));
  const [stairFlights, setStairFlights] = useState(String(factors.stair_flights || oq.stair_flights || "1"));
  const [declaredValue, setDeclaredValue] = useState(String(factors.declared_value || oq.declared_value || ""));

  // ── Specialty service fields ──────────────────────────────
  const [projectType, setProjectType] = useState(factors.project_type || oq.project_type || "");
  const [timelineHours, setTimelineHours] = useState(String(factors.timeline_hours || oq.timeline_hours || "4"));
  const [customCratingPieces, setCustomCratingPieces] = useState(String(factors.custom_crating_pieces || oq.custom_crating_pieces || "0"));
  const [climateControl, setClimateControl] = useState(Boolean(factors.climate_control || oq.climate_control));

  // ── Specialty items ───────────────────────────────────────
  const [specialtyItems, setSpecialtyItems] = useState<{ type: string; qty: number }[]>(() => {
    const saved = oq.specialty_items;
    if (Array.isArray(saved) && saved.length > 0) return saved;
    // Also check factors
    const fromFactors = factors.specialty_items;
    if (Array.isArray(fromFactors) && fromFactors.length > 0) return fromFactors;
    return [];
  });

  // ── Inventory ─────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>(() => {
    const saved = oq.inventory_items;
    if (!Array.isArray(saved) || saved.length === 0) return [];
    // Saved items may lack weight_score — enrich from itemWeights lookup
    return saved.map((item: any) => {
      const iw = itemWeights.find((w) => w.slug === item.slug);
      const name = item.name || iw?.item_name || item.slug || "";
      const slug = item.slug || undefined;
      return {
        slug,
        name,
        quantity: item.quantity || 1,
        weight_score: item.weight_score ?? iw?.weight_score ?? 1,
        isCustom: !slug && !!name,
      };
    });
  });

  // ── Box count ─────────────────────────────────────────────
  const [clientBoxCount, setClientBoxCount] = useState(
    String(oq.client_box_count || factors.client_box_count || "")
  );

  // ── Addons ────────────────────────────────────────────────
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(() => {
    const map = new Map<string, AddonSelection>();
    // oq.selected_addons is the breakdown array [{addon_id, slug, name, price, quantity, subtotal}]
    const saved: any[] = Array.isArray(oq.selected_addons) ? oq.selected_addons : [];
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
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!oq.quote_id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/job-stops?job_type=quote&job_id=${encodeURIComponent(oq.quote_id)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const rows = (data.stops ?? []) as { stop_type?: string; address?: string; lat?: number | null; lng?: number | null }[];
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oq.quote_id]);

  // Resolve previous quote price: essential (current) or curated/essentials (legacy) tier, or custom_price for non-tiered
  const oldPrice = oq.tiers?.essential?.price ?? oq.tiers?.curated?.price ?? oq.tiers?.essentials?.price ?? (typeof oq.custom_price === "number" ? oq.custom_price : null) ?? 0;

  const tierForAddons = useMemo(() => {
    const r = (oq.recommended_tier ?? "signature").toString().toLowerCase().trim();
    return r === "essential" || r === "signature" || r === "estate" ? r : "signature";
  }, [oq.recommended_tier]);

  // ── Addon helpers ─────────────────────────────────────────
  const applicableAddons = useMemo(() => {
    const base = allAddons.filter(
      (a) => !a.applicable_service_types?.length || a.applicable_service_types.includes(serviceType),
    );
    if (serviceType === "local_move" || serviceType === "long_distance") {
      return getVisibleAddons(base, tierForAddons);
    }
    return base;
  }, [allAddons, serviceType, tierForAddons]);
  const popularAddons = useMemo(() => applicableAddons.filter((a) => a.is_popular), [applicableAddons]);
  const otherAddons = useMemo(() => applicableAddons.filter((a) => !a.is_popular), [applicableAddons]);

  function toggleAddon(addon: Addon) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      if (next.has(addon.id)) { next.delete(addon.id); return next; }
      next.set(addon.id, { addon_id: addon.id, slug: addon.slug, quantity: 1, tier_index: 0 });
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
    return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
      move_size: moveSize || undefined,
      contact_id: contact?.id || oq.contact_id,
      hubspot_deal_id: oq.hubspot_deal_id || undefined,
      selected_addons: Array.from(selectedAddons.values()),
    };

    if (serviceType === "office_move") {
      if (squareFootage) payload.square_footage = Number(squareFootage);
      if (workstationCount) payload.workstation_count = Number(workstationCount);
      payload.has_it_equipment = hasItEquipment;
      payload.has_conference_room = hasConferenceRoom;
      payload.has_reception_area = hasReceptionArea;
      if (timingPreference) payload.timing_preference = timingPreference;
    }

    if (serviceType === "single_item" || serviceType === "white_glove") {
      if (itemCategory) payload.item_category = itemCategory;
      if (itemWeightClass) payload.item_weight_class = itemWeightClass;
      if (assemblyNeeded) payload.assembly_needed = assemblyNeeded;
      payload.stair_carry = stairCarry;
      if (stairCarry) payload.stair_flights = Number(stairFlights);
      if (serviceType === "white_glove" && declaredValue) payload.declared_value = Number(declaredValue);
    }

    if (serviceType === "specialty") {
      if (projectType) payload.project_type = projectType;
      if (timelineHours) payload.timeline_hours = Number(timelineHours);
      if (customCratingPieces) payload.custom_crating_pieces = Number(customCratingPieces);
      payload.climate_control = climateControl;
    }

    if (serviceType === "local_move" || serviceType === "long_distance") {
      if (specialtyItems.length > 0) payload.specialty_items = specialtyItems.filter((s) => s.qty > 0);
      if (inventoryItems.length > 0) {
        payload.inventory_items = inventoryItems.map((i) => ({
          slug: i.slug,
          name: i.name,
          quantity: i.quantity,
          weight_score: i.weight_score,
        }));
      }
      if (clientBoxCount !== "" && clientBoxCount != null) payload.client_box_count = Number(clientBoxCount);
    }
    if (serviceType === "local_move" || serviceType === "long_distance" || serviceType === "white_glove") {
      const extraPick = extraFromStops
        .map((s) => ({ address: s.address.trim() }))
        .filter((x) => x.address.length > 0);
      const extraDrop = extraToStops
        .map((s) => ({ address: s.address.trim() }))
        .filter((x) => x.address.length > 0);
      if (extraPick.length > 0) payload.additional_pickup_addresses = extraPick;
      if (extraDrop.length > 0) payload.additional_dropoff_addresses = extraDrop;
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
    serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, moveSize,
    squareFootage, workstationCount, hasItEquipment, hasConferenceRoom, hasReceptionArea, timingPreference,
    itemCategory, itemWeightClass, assemblyNeeded, stairCarry, stairFlights, declaredValue,
    projectType, timelineHours, customCratingPieces, climateControl, specialtyItems,
    inventoryItems, clientBoxCount, selectedAddons,
    contact, oq, factors, extraFromStops, extraToStops,
  ]);

  // ── Debounced live preview ────────────────────────────────
  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    if (!fromAddress || !toAddress || !moveDate) return;

    previewTimerRef.current = setTimeout(async () => {
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
      } catch { /* silent fail */ }
      setPreviewLoading(false);
    }, 800);

    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [buildPayload, fromAddress, toAddress, moveDate, inventoryItems.length, moveSize]);

  const replaceQuoteJobStops = useCallback(async (quoteId: string) => {
    try {
      const listRes = await fetch(
        `/api/admin/job-stops?job_type=quote&job_id=${encodeURIComponent(quoteId)}`,
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        for (const s of (listData.stops ?? []) as { id?: string }[]) {
          if (s.id) {
            await fetch(`/api/admin/job-stops?id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
          }
        }
      }
      const extraPickups = extraFromStops
        .filter((s) => s.address.trim())
        .map((s, i) => ({ ...s, stop_type: "pickup" as const, sort_order: i + 1 }));
      const extraDropoffs = extraToStops
        .filter((s) => s.address.trim())
        .map((s, i) => ({ ...s, stop_type: "dropoff" as const, sort_order: i + 1 }));
      const all = [...extraPickups, ...extraDropoffs];
      if (all.length === 0) return;
      await fetch("/api/admin/job-stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: "quote", job_id: quoteId, stops: all }),
      });
    } catch {
      /* non-fatal */
    }
  }, [extraFromStops, extraToStops]);

  // ── Finalize: generate real quote + save to DB ────────────
  const handleRegenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate quote"); return; }
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
  }, [buildPayload, oq.quote_id, replaceQuoteJobStops]);

  const handleSendUpdate = useCallback(async () => {
    const quoteIdToSend = newQuoteId || oq.quote_id;
    if (!quoteIdToSend) return;
    setError(null);
    setLinking(true);
    try {
      const res = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quoteIdToSend,
          hubspot_deal_id: oq.hubspot_deal_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send quote"); return; }
      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setLinking(false);
    }
  }, [newQuoteId, oq.quote_id, oq.hubspot_deal_id]);

  const newPrice = newQuoteResult?.tiers?.essential?.price ?? newQuoteResult?.tiers?.curated?.price ?? newQuoteResult?.tiers?.essentials?.price ?? newQuoteResult?.custom_price?.price ?? null;
  const livePrice = livePreview?.tiers?.essential?.price ?? livePreview?.tiers?.curated?.price ?? livePreview?.tiers?.essentials?.price ?? livePreview?.custom_price?.price ?? null;

  const inputClass = "w-full px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--brd)] focus:ring-1 focus:ring-[var(--brd)]/30 outline-none transition-all";
  const labelClass = "block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1";

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--green)]/10 flex items-center justify-center">
          <CheckCircle className="text-[var(--green)]" size={28} />
        </div>
        <h1 className="text-xl font-bold text-[var(--tx)] mb-2">Quote Updated & Sent</h1>
        <p className="text-sm text-[var(--tx2)] mb-1">
          <strong className="text-[var(--gold)]">{oq.quote_id}</strong> has been updated and sent.
        </p>
        <p className="text-sm text-[var(--tx3)] mb-8">
          {contact?.email ? `The updated quote has been emailed to ${contact.email}.` : "The quote is ready."}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push(`/admin/quotes/${oq.quote_id}`)} className="px-5 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-sm font-medium hover:bg-[var(--bg)]">
            Back to Quote Details
          </button>
          <button onClick={() => setDone(false)} className="px-5 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-sm font-semibold hover:bg-[var(--gold)]/90">
            Edit Quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
          <ArrowLeft size={18} weight="regular" />
        </button>
        <div>
          <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase">Re-Quote</div>
          <h1 className="text-lg font-bold text-[var(--tx)]">
            Edit Quote {oq.quote_id}
            <span className="text-sm font-normal text-[var(--tx3)] ml-2">v{oq.version || 1}</span>
          </h1>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)]">
          {SERVICE_LABELS[serviceType] || serviceType}
        </span>
      </div>

      {/* Current quote summary */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-5">
        <div className="text-[9px] font-bold text-[var(--tx3)] tracking-widest uppercase mb-3">Current Quote</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Client</div>
            <div className="text-[var(--tx)] font-medium">{contact?.name || "-"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Current Price</div>
            <div className="text-[var(--gold)] font-bold">{formatCurrency(Number(oldPrice))}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">{quoteDetailDateLabel(serviceType)}</div>
            <div className="text-[var(--tx)] font-medium">{oq.move_date || "TBD"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Status</div>
            <div className="text-[var(--tx)] font-medium uppercase">{oq.status}</div>
          </div>
        </div>
      </div>

      {/* Live price preview */}
      {(livePreview || previewLoading) && (
        <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            {previewLoading
              ? <Loader2 size={13} className="animate-spin text-[var(--gold)]" />
              : <TrendingUp size={13} className="text-[var(--gold)]" />
            }
            <span className="text-[10px] font-bold text-[var(--gold)] tracking-widest uppercase">
              {previewLoading ? "Recalculating…" : "Live Price Preview"}
            </span>
            {livePreview?.distance_km && !previewLoading && (
              <span className="ml-auto text-[10px] text-[var(--tx3)]">
                {livePreview.distance_km} km · {livePreview.drive_time_min} min drive
              </span>
            )}
          </div>

          {!previewLoading && livePreview && (
            <>
              {livePreview.tiers ? (
                <div className="grid grid-cols-3 gap-2">
                  {(["essential", "signature", "estate"] as const).map((tier) => {
                    const t = livePreview.tiers[tier];
                    if (!t) return null;
                    const isEssential = tier === "essential";
                    return (
                      <div key={tier} className={`rounded-lg p-3 text-center border ${isEssential ? "border-[var(--gold)]/40 bg-[var(--gold)]/8" : "border-[var(--brd)] bg-[var(--bg)]"}`}>
                        <div className="text-[9px] text-[var(--gold)] font-semibold uppercase mb-0.5">{tier}</div>
                        <div className="text-[16px] font-bold text-[var(--tx)]">{formatCurrency(t.price)}</div>
                        <div className="text-[9px] text-[var(--tx3)] mt-0.5">+{formatCurrency(t.tax)} HST</div>
                      </div>
                    );
                  })}
                </div>
              ) : livePreview.custom_price ? (
                <div className="flex items-center gap-5 flex-wrap">
                  <div>
                    <div className="text-[11px] text-[var(--tx3)]">Price</div>
                    <div className="text-[20px] font-bold text-[var(--gold)]">{formatCurrency(livePreview.custom_price.price)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--tx3)]">HST (13%)</div>
                    <div className="text-sm font-medium text-[var(--tx)]">+{formatCurrency(livePreview.custom_price.tax)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--tx3)]">Total incl. HST</div>
                    <div className="text-sm font-semibold text-[var(--tx)]">{formatCurrency(livePreview.custom_price.total)}</div>
                  </div>
                  {oldPrice > 0 && livePrice != null && (
                    <div className="ml-auto text-[12px]">
                      <span className="text-[var(--tx3)] line-through mr-1">{formatCurrency(Number(oldPrice))}</span>
                      <span className="font-bold" style={{ color: livePrice > Number(oldPrice) ? "#EF4444" : "#22C55E" }}>
                        {livePrice > Number(oldPrice) ? "+" : ""}{formatCurrency(livePrice - Number(oldPrice))}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}

              {livePreview.labour && (
                <div className="mt-3 pt-2 border-t border-[var(--gold)]/15 flex gap-4 text-[11px] text-[var(--tx3)]">
                  <span><strong className="text-[var(--tx)]">{livePreview.labour.crewSize}</strong> movers</span>
                  <span><strong className="text-[var(--tx)]">{livePreview.labour.hoursRange}</strong></span>
                  <span><strong className="text-[var(--tx)]">{livePreview.labour.truckSize}</strong> truck</span>
                </div>
              )}

              {/* Algorithm anomaly warnings */}
              {(livePreview.inventory_warnings?.length ?? 0) > 0 && (
                <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1 text-[11px]">
                  <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Warning size={13} /> Check inventory quantities</p>
                  <ul className="list-disc list-inside text-[var(--tx2)]">
                    {livePreview.inventory_warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {livePreview.factors && typeof livePreview.factors.inventory_modifier === "number" && typeof livePreview.factors.inventory_max_modifier === "number" && livePreview.factors.inventory_modifier >= livePreview.factors.inventory_max_modifier && (
                <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-[var(--tx2)]">
                  <p className="font-semibold text-blue-600 dark:text-blue-400">ℹ Inventory at volume ceiling (×{Number(livePreview.factors.inventory_max_modifier).toFixed(2)})</p>
                  <p className="mt-0.5">Price is capped, consider manual adjustment.</p>
                </div>
              )}
              {livePreview.factors && typeof livePreview.factors.labour_component === "number" && typeof livePreview.factors.subtotal_before_labour === "number" && Number(livePreview.factors.subtotal_before_labour) > 0 && Number(livePreview.factors.labour_component) > 0.5 * Number(livePreview.factors.subtotal_before_labour) && (
                <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-[var(--tx2)]">
                  <p className="font-semibold text-blue-600 dark:text-blue-400">ℹ High labour component: {formatCurrency(livePreview.factors.labour_component)}</p>
                  <p className="mt-0.5">This move needs significantly more crew/time than standard.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Edit fields */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6 space-y-5">
        <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase">Update Details</div>

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
            <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={inputClass}>
              <option value="">Select access…</option>
              <option value="elevator">Elevator</option>
              <option value="ground_floor">Ground Floor</option>
              <option value="loading_dock">Loading Dock</option>
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
            <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={inputClass}>
              <option value="">Select access…</option>
              <option value="elevator">Elevator</option>
              <option value="ground_floor">Ground Floor</option>
              <option value="loading_dock">Loading Dock</option>
              <option value="walk_up_2nd">Walk-Up (2nd floor)</option>
              <option value="walk_up_3rd">Walk-Up (3rd floor)</option>
              <option value="walk_up_4th_plus">Walk-Up (4th+ floor)</option>
              <option value="long_carry">Long Carry</option>
              <option value="narrow_stairs">Narrow Stairs</option>
              <option value="no_parking_nearby">No Parking Nearby</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{quoteFormServiceDateLabel(serviceType).replace(" *", "")}</label>
            <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className={inputClass} />
          </div>
          {(serviceType === "local_move" || serviceType === "long_distance") && (
            <div>
              <label className={labelClass}>Move Size</label>
              <select value={moveSize} onChange={(e) => setMoveSize(e.target.value)} className={inputClass}>
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
        </div>

        {/* ── Office move ── */}
        {serviceType === "office_move" && (
          <div className="space-y-2">
            <SectionDivider label="Office Details" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>Square Footage</label>
                <input type="number" value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} className={`${inputClass} min-w-0`} placeholder="e.g. 2000" />
              </div>
              <div>
                <label className={labelClass}>Workstations</label>
                <input type="number" value={workstationCount} onChange={(e) => setWorkstationCount(e.target.value)} className={`${inputClass} min-w-0`} placeholder="e.g. 15" />
              </div>
              <div>
                <label className={labelClass}>Timing Preference</label>
                <select value={timingPreference} onChange={(e) => setTimingPreference(e.target.value)} className={`${inputClass} min-w-0`}>
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
              <Toggle checked={hasItEquipment} onChange={setHasItEquipment} label="Has IT Equipment" />
              <Toggle checked={hasConferenceRoom} onChange={setHasConferenceRoom} label="Has Conference Room" />
              <Toggle checked={hasReceptionArea} onChange={setHasReceptionArea} label="Has Reception Area" />
            </div>
          </div>
        )}

        {/* ── Single item / White glove ── */}
        {(serviceType === "single_item" || serviceType === "white_glove") && (
          <div className="space-y-2">
            <SectionDivider label="Items" />
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
                <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={`${inputClass} min-w-0`}>
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
                <select value={itemWeightClass} onChange={(e) => setItemWeightClass(e.target.value)} className={`${inputClass} min-w-0`}>
                  <option value="">Select…</option>
                  <option value="Under 150 lbs">Under 150 lbs</option>
                  <option value="150-300 lbs">150–300 lbs</option>
                  <option value="300-500 lbs">300–500 lbs (+$100)</option>
                  <option value="Over 500 lbs">Over 500 lbs (+$200)</option>
                </select>
              </div>
              {serviceType === "white_glove" && (
                <div>
                  <label className={labelClass}>Declared Value ($)</label>
                  <input type="number" value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} className={`${inputClass} w-24 min-w-0`} placeholder="e.g. 5000" />
                </div>
              )}
              <div>
                <label className={labelClass}>Assembly</label>
                <select value={assemblyNeeded} onChange={(e) => setAssemblyNeeded(e.target.value)} className={`${inputClass} min-w-0`}>
                  <option value="">None</option>
                  <option value="assembly">Assembly only</option>
                  <option value="disassembly">Disassembly only</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase text-[var(--tx3)] shrink-0">Stair Carry</span>
                <button type="button" role="switch" aria-checked={stairCarry} onClick={() => setStairCarry(!stairCarry)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${stairCarry ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${stairCarry ? "translate-x-4" : ""}`} />
                </button>
                {stairCarry && (
                  <input type="number" min={1} max={10} value={stairFlights} onChange={(e) => setStairFlights(e.target.value)} className={`${inputClass} w-12 py-1 min-w-0`} title="Flights" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Specialty service ── */}
        {serviceType === "specialty" && (
          <div className="space-y-2">
            <SectionDivider label="Specialty Details" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
              <div>
                <label className={labelClass}>Project Type</label>
                <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={`${inputClass} min-w-0`}>
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
                <input type="number" min="1" max="24" step="0.5" value={timelineHours} onChange={(e) => setTimelineHours(e.target.value)} className={`${inputClass} w-20 min-w-0`} placeholder="e.g. 4" />
              </div>
              <div>
                <label className={labelClass}>Crating (pcs)</label>
                <input type="number" min="0" value={customCratingPieces} onChange={(e) => setCustomCratingPieces(e.target.value)} className={`${inputClass} w-16 min-w-0`} placeholder="0" />
              </div>
              <div className="flex items-center gap-2">
                <Toggle checked={climateControl} onChange={setClimateControl} label="Climate Control (+$150)" />
              </div>
            </div>
          </div>
        )}

        {/* ── Specialty items for residential moves ── */}
        {(serviceType === "local_move" || serviceType === "long_distance") && (
          <div>
            <SectionDivider label="Specialty Items" />
            <p className="text-[11px] text-[var(--tx3)] mt-2 mb-3">Add any bulky or specialty items that require extra handling.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPECIALTY_ITEM_TYPES.map((type) => {
                const existing = specialtyItems.find((s) => s.type === type);
                const qty = existing?.qty ?? 0;
                return (
                  <div key={type} className="flex items-center justify-between rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]">
                    <span className="text-[11px] text-[var(--tx)] uppercase">{type.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={qty === 0}
                        onClick={() => setSpecialtyItems((prev) => {
                          const filtered = prev.filter((s) => s.type !== type);
                          const next = qty - 1;
                          return next > 0 ? [...filtered, { type, qty: next }] : filtered;
                        })}
                        className="w-6 h-6 rounded-full border border-[var(--brd)] text-[var(--tx2)] flex items-center justify-center text-sm hover:bg-[var(--card)] disabled:opacity-30"
                      >−</button>
                      <span className="w-5 text-center text-[12px] font-semibold text-[var(--tx)]">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setSpecialtyItems((prev) => {
                          const filtered = prev.filter((s) => s.type !== type);
                          return [...filtered, { type, qty: qty + 1 }];
                        })}
                        className="w-6 h-6 rounded-full border border-[var(--brd)] text-[var(--tx2)] flex items-center justify-center text-sm hover:bg-[var(--card)]"
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Furniture / Client Inventory (residential + office) ── */}
        {(serviceType === "local_move" || serviceType === "long_distance" || serviceType === "office_move") && itemWeights.length > 0 && (
          <div>
            <SectionDivider label="Furniture & Inventory" />
            <InventoryInput
              itemWeights={itemWeights as { slug: string; item_name: string; weight_score: number; category: string; room?: string; is_common: boolean; display_order?: number; active?: boolean }[]}
              value={inventoryItems}
              onChange={setInventoryItems}
              moveSize={moveSize}
              fromAccess={fromAccess}
              toAccess={toAccess}
              showLabourEstimate={!!moveSize}
              boxCount={serviceType === "local_move" || serviceType === "long_distance" ? (Number(clientBoxCount) || 0) : undefined}
              onBoxCountChange={serviceType === "local_move" || serviceType === "long_distance" ? (n) => setClientBoxCount(String(n)) : undefined}
              mode={serviceType === "office_move" ? "commercial" : "residential"}
            />
            {/* Box count (also wired via InventoryInput boxCount above for score/labour) */}
            {(serviceType === "local_move" || serviceType === "long_distance") && (
              <div className="mt-4">
                <label className={labelClass}>Client Boxes <span className="font-normal text-[var(--tx3)]">(affects volume)</span></label>
                <input
                  type="number"
                  min="0"
                  value={clientBoxCount}
                  onChange={(e) => setClientBoxCount(e.target.value)}
                  className={`${inputClass} max-w-[160px]`}
                  placeholder="e.g. 20"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Add-ons ── */}
        {applicableAddons.length > 0 && (
          <div>
            <SectionDivider label="Add-Ons" />
            {tierForAddons === "estate" && (serviceType === "local_move" || serviceType === "long_distance") && (
              <div className="mt-2 mb-3 rounded-lg border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-3 text-[10px] text-[var(--tx2)] space-y-1">
                <p className="font-bold tracking-wide text-[var(--tx)]">{ESTATE_ADDON_UI_LINES[0]}</p>
                <p className="leading-snug">{ESTATE_ADDON_UI_LINES[1]}</p>
                <p className="font-semibold text-[var(--tx)] pt-0.5">{ESTATE_ADDON_UI_LINES[2]}</p>
              </div>
            )}
            <div className="mt-3 space-y-2">
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
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">Popular</span>
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
                            <option key={i} value={i}>{t.label}, {fmtPrice(t.price)}</option>
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
                  {showAllAddons ? "Hide other add-ons ▲" : `Show all add-ons (${otherAddons.length} more) ▾`}
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
                            <option key={i} value={i}>{t.label}, {fmtPrice(t.price)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Reason for change ── */}
        <div className="border-t border-[var(--brd)] pt-4">
          <label className={labelClass}>Reason for Update <span className="font-normal text-[var(--tx3)]">(shown in email & HubSpot)</span></label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Client moved date, added items, changed address…"
            className={inputClass}
          />
        </div>
      </div>

      {/* Generate button */}
      {!newQuoteResult && (
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="btn-p w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating…" : "Re-Generate Quote"}
        </button>
      )}

      {/* Generated result */}
      {newQuoteResult && (
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-5 mb-6 mt-6">
          <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase mb-3">New Quote Generated</div>
          <div className="flex items-center gap-6 mb-4 flex-wrap">
            <div>
              <div className="text-[11px] text-[var(--tx3)]">Quote ID</div>
              <div className="text-sm font-bold text-[var(--gold)]">{newQuoteId ?? "-"}</div>
            </div>
            {oldPrice != null && newPrice != null ? (
              <div>
                <div className="text-[11px] text-[var(--tx3)]">Price Change</div>
                <div className="text-sm font-medium text-[var(--tx)] flex items-center gap-2">
                  <span className="line-through text-[var(--tx3)]">{formatCurrency(Number(oldPrice))}</span>
                  <span className="text-[var(--tx3)]">→</span>
                  <span className="text-[var(--gold)] font-bold">{formatCurrency(Number(newPrice))}</span>
                </div>
              </div>
            ) : null}
          </div>

          {newQuoteResult.tiers && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["essential", "signature", "estate"].map((tier) => {
                const t = newQuoteResult.tiers[tier];
                if (!t) return null;
                return (
                  <div key={tier} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 text-center">
                    <div className="text-[10px] text-[var(--gold)] font-semibold uppercase">{t.label || tier}</div>
                    <div className="text-lg font-bold text-[var(--tx)] mt-1">{formatCurrency(t.price)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {newQuoteResult.custom_price && (
            <div className="flex gap-5 mb-4">
              <div>
                <div className="text-[11px] text-[var(--tx3)]">Price</div>
                <div className="text-xl font-bold text-[var(--gold)]">{formatCurrency(newQuoteResult.custom_price.price)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--tx3)]">Total incl. HST</div>
                <div className="text-base font-semibold text-[var(--tx)]">{formatCurrency(newQuoteResult.custom_price.total)}</div>
              </div>
            </div>
          )}

          {newQuoteResult.addons?.items?.length > 0 && (
            <div className="mb-4 space-y-1">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Add-Ons</div>
              {newQuoteResult.addons.items.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--tx2)]">{item.name}</span>
                  <span className="text-[var(--gold)] font-semibold">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setNewQuoteResult(null); setNewQuoteId(null); }}
              className="flex-1 py-3 rounded-xl border border-[var(--brd)] text-[var(--tx2)] text-sm font-medium hover:bg-[var(--bg)] transition-colors"
            >
              Edit Further
            </button>
            <button
              onClick={handleSendUpdate}
              disabled={linking}
              className="btn-p flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {linking ? "Sending…" : "Send Updated Quote to Client"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 mt-4 text-[12px] border bg-[var(--red)]/5 border-[var(--red)]/20 text-[var(--red)]">
          {error}
        </div>
      )}
    </div>
  );
}
