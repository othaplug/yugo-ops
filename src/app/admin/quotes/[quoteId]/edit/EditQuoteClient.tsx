"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Send, CheckCircle, Plus, Minus, Search, X } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ItemWeight {
  slug: string;
  item_name: string;
  weight_score: number;
  category: string;
  is_common: boolean;
}

interface InventoryEntry {
  slug: string;
  name: string;
  quantity: number;
  weight_score: number;
}

interface AddonObj {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  price_type: string;
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

interface EditQuoteClientProps {
  originalQuote: any;
  addons: AddonObj[];
  config: Record<string, string>;
  itemWeights?: ItemWeight[];
}

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_delivery: "B2B Delivery",
  b2b_oneoff: "B2B One-Off",
};

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

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EditQuoteClient({ originalQuote, addons: allAddons, config, itemWeights = [] }: EditQuoteClientProps) {
  const router = useRouter();
  const oq = originalQuote;
  const contact = Array.isArray(oq.contacts) ? oq.contacts[0] : oq.contacts;
  const factors = (oq.factors_applied ?? {}) as Record<string, any>;

  // ── Core fields ──
  const [serviceType] = useState(oq.service_type);
  const [fromAddress, setFromAddress] = useState(oq.from_address || "");
  const [toAddress, setToAddress] = useState(oq.to_address || "");
  const [fromAccess, setFromAccess] = useState(oq.from_access || "");
  const [toAccess, setToAccess] = useState(oq.to_access || "");
  const [moveDate, setMoveDate] = useState(oq.move_date || "");
  const [preferredTime, setPreferredTime] = useState(oq.preferred_time || "");
  const [moveSize, setMoveSize] = useState(oq.move_size || "");

  // ── Inventory ──
  const [inventoryItems, setInventoryItems] = useState<InventoryEntry[]>(() => {
    const items = oq.inventory_items;
    if (!Array.isArray(items)) return [];
    return items.map((i: any) => ({ slug: i.slug || "", name: i.name || i.slug || "", quantity: i.quantity || 1, weight_score: i.weight_score || 1 }));
  });
  const [boxCount, setBoxCount] = useState(String(oq.client_box_count ?? oq.factors_applied?.client_box_count ?? ""));
  const [inventorySearch, setInventorySearch] = useState("");
  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
  const inventorySearchRef = useRef<HTMLDivElement>(null);

  // ── Specialty items ──
  const [specialtyItems, setSpecialtyItems] = useState<{ type: string; qty: number }[]>(() => {
    const items = oq.specialty_items;
    if (!Array.isArray(items)) return [];
    return items.map((i: any) => ({ type: i.type, qty: i.qty || 1 }));
  });

  // ── Add-ons ──
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(() => {
    const map = new Map<string, AddonSelection>();
    const saved = oq.selected_addons;
    if (Array.isArray(saved)) {
      for (const a of saved) {
        const addonId = a.addon_id || a.id;
        if (addonId) {
          map.set(addonId, { addon_id: addonId, slug: a.slug || "", quantity: a.quantity || 1, tier_index: a.tier_index ?? 0 });
        }
      }
    }
    return map;
  });

  // ── Office fields ──
  const [sqft, setSqft] = useState(String(factors.square_footage ?? oq.square_footage ?? ""));
  const [wsCount, setWsCount] = useState(String(factors.workstation_count ?? oq.workstation_count ?? ""));
  const [hasIt, setHasIt] = useState(Boolean(factors.has_it_equipment ?? oq.has_it_equipment));
  const [hasConf, setHasConf] = useState(Boolean(factors.has_conference_room ?? oq.has_conference_room));
  const [hasReception, setHasReception] = useState(Boolean(factors.has_reception_area ?? oq.has_reception_area));
  const [timingPref, setTimingPref] = useState(String(factors.timing_preference ?? oq.timing_preference ?? ""));

  // ── Single item fields ──
  const [itemCategory, setItemCategory] = useState(String(factors.item_category ?? oq.item_category ?? "standard_furniture"));
  const [itemWeight, setItemWeight] = useState(String(factors.item_weight_class ?? oq.item_weight_class ?? ""));
  const [assembly, setAssembly] = useState(String(factors.assembly_needed ?? oq.assembly_needed ?? "None"));
  const [stairCarry, setStairCarry] = useState(Boolean(factors.stair_carry ?? oq.stair_carry));
  const [stairFlights, setStairFlights] = useState(Number(factors.stair_flights ?? oq.stair_flights ?? 1));
  const [numItems, setNumItems] = useState(Number(factors.number_of_items ?? oq.number_of_items ?? 1));

  // ── White glove ──
  const [declaredValue, setDeclaredValue] = useState(String(factors.declared_value ?? oq.declared_value ?? ""));

  // ── Specialty ──
  const [projectType, setProjectType] = useState(String(factors.project_type ?? oq.project_type ?? "Custom"));
  const [timelineHours, setTimelineHours] = useState(Number(factors.timeline_hours ?? oq.timeline_hours ?? 4));
  const [cratingPieces, setCratingPieces] = useState(Number(factors.custom_crating_pieces ?? oq.custom_crating_pieces ?? 0));
  const [climateControl, setClimateControl] = useState(Boolean(factors.climate_control ?? oq.climate_control));

  // ── Reason + state ──
  const [reason, setReason] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newQuoteResult, setNewQuoteResult] = useState<any>(null);
  const [newQuoteId, setNewQuoteId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oldPrice = oq.tiers?.essentials?.price ?? oq.custom_price ?? 0;

  // ── Inventory search ──
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (inventorySearchRef.current && !inventorySearchRef.current.contains(e.target as Node)) setShowInventoryDropdown(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filteredWeights = useMemo(() => {
    if (!inventorySearch || inventorySearch.length < 2) return [];
    const q = inventorySearch.toLowerCase();
    return itemWeights
      .filter((w) => w.item_name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q))
      .slice(0, 12);
  }, [inventorySearch, itemWeights]);

  function addInventoryItem(w: ItemWeight) {
    setInventoryItems((prev) => {
      const existing = prev.find((i) => i.slug === w.slug);
      if (existing) return prev.map((i) => i.slug === w.slug ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { slug: w.slug, name: w.item_name, quantity: 1, weight_score: w.weight_score }];
    });
    setInventorySearch("");
    setShowInventoryDropdown(false);
  }

  // ── Addon helpers ──
  const applicableAddons = useMemo(() => {
    return allAddons.filter((a) => a.applicable_service_types.includes(serviceType) || a.applicable_service_types.includes("all"));
  }, [allAddons, serviceType]);

  function toggleAddon(addon: AddonObj) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      if (next.has(addon.id)) {
        next.delete(addon.id);
      } else {
        next.set(addon.id, { addon_id: addon.id, slug: addon.slug, quantity: 1, tier_index: 0 });
      }
      return next;
    });
  }

  function updateAddonQty(addonId: string, delta: number) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const sel = next.get(addonId);
      if (!sel) return prev;
      const newQty = Math.max(1, sel.quantity + delta);
      next.set(addonId, { ...sel, quantity: newQty });
      return next;
    });
  }

  // ── Generate ──
  const handleRegenerate = useCallback(async () => {
    setError(null);
    setGenerating(true);
    try {
      const payload: Record<string, any> = {
        service_type: serviceType,
        from_address: fromAddress,
        to_address: toAddress,
        from_access: fromAccess || undefined,
        to_access: toAccess || undefined,
        move_date: moveDate || undefined,
        preferred_time: preferredTime || undefined,
        move_size: moveSize || undefined,
        contact_id: contact?.id || oq.contact_id,
        hubspot_deal_id: oq.hubspot_deal_id || undefined,
      };

      if (inventoryItems.length > 0) {
        payload.inventory_items = inventoryItems.map((i) => ({ slug: i.slug, name: i.name, quantity: i.quantity }));
      }
      if (boxCount) payload.client_box_count = Number(boxCount);
      if (specialtyItems.length > 0) payload.specialty_items = specialtyItems;

      const addonSelections = Array.from(selectedAddons.values());
      if (addonSelections.length > 0) payload.selected_addons = addonSelections;

      // Office fields
      if (serviceType === "office_move") {
        if (sqft) payload.square_footage = Number(sqft);
        if (wsCount) payload.workstation_count = Number(wsCount);
        payload.has_it_equipment = hasIt;
        payload.has_conference_room = hasConf;
        payload.has_reception_area = hasReception;
        if (timingPref) payload.timing_preference = timingPref;
      }

      // Single item / white glove fields
      if (serviceType === "single_item" || serviceType === "white_glove") {
        payload.item_category = itemCategory;
        if (itemWeight) payload.item_weight_class = itemWeight;
        payload.assembly_needed = assembly;
        payload.stair_carry = stairCarry;
        if (stairCarry) payload.stair_flights = stairFlights;
        payload.number_of_items = numItems;
      }
      if (serviceType === "white_glove" && declaredValue) {
        payload.declared_value = Number(declaredValue);
      }

      // Specialty fields
      if (serviceType === "specialty") {
        payload.project_type = projectType;
        payload.timeline_hours = timelineHours;
        payload.custom_crating_pieces = cratingPieces;
        payload.climate_control = climateControl;
      }

      if (factors.company_name) payload.company_name = factors.company_name;

      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate quote");
        return;
      }

      setNewQuoteResult(data);
      setNewQuoteId(data.quote_id);
    } catch {
      setError("Network error generating quote");
    } finally {
      setGenerating(false);
    }
  }, [serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, preferredTime, moveSize,
    contact, oq, factors, inventoryItems, boxCount, specialtyItems, selectedAddons,
    sqft, wsCount, hasIt, hasConf, hasReception, timingPref,
    itemCategory, itemWeight, assembly, stairCarry, stairFlights, numItems,
    declaredValue, projectType, timelineHours, cratingPieces, climateControl]);

  const handleSendUpdate = useCallback(async () => {
    if (!newQuoteId) return;
    setError(null);
    setLinking(true);
    try {
      const res = await fetch("/api/quotes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalQuoteId: oq.quote_id,
          newQuoteId,
          reason: reason.trim() || undefined,
          sendToClient: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to link quote"); return; }
      setDone(true);
    } catch { setError("Network error"); }
    finally { setLinking(false); }
  }, [newQuoteId, oq.quote_id, reason]);

  const newPrice = newQuoteResult?.tiers?.essentials?.price ?? newQuoteResult?.custom_price?.price ?? null;

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-body text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-all";
  const labelClass = "block text-caption font-semibold text-[var(--tx2)] mb-1.5";
  const sectionTitle = "text-section font-bold text-[var(--gold)] tracking-widest uppercase mb-4";
  const checkboxClass = "w-4 h-4 rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--gold)]";

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--green)]/10 flex items-center justify-center">
          <CheckCircle className="text-[var(--green)]" size={28} />
        </div>
        <h1 className="text-xl font-bold text-[var(--tx)] mb-2">Quote Updated & Sent</h1>
        <p className="text-sm text-[var(--tx2)] mb-1">
          {oq.quote_id} has been superseded by <strong className="text-[var(--gold)]">{newQuoteId}</strong>.
        </p>
        <p className="text-sm text-[var(--tx3)] mb-8">
          {contact?.email ? `The updated quote has been emailed to ${contact.email}.` : "The new quote is ready."}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push("/admin/quotes")} className="px-5 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-sm font-medium hover:bg-[var(--bg)]">
            Back to Quotes
          </button>
          <button onClick={() => router.push(`/admin/quotes/${newQuoteId}`)} className="px-5 py-2.5 rounded-lg bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90">
            View New Quote
          </button>
        </div>
      </div>
    );
  }

  const isResidential = serviceType === "local_move" || serviceType === "long_distance";
  const isOffice = serviceType === "office_move";
  const isSingleOrWG = serviceType === "single_item" || serviceType === "white_glove";
  const isSpecialty = serviceType === "specialty";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="text-section font-bold text-[var(--gold)] tracking-widest uppercase">Re-Quote</div>
          <h1 className="text-lg font-bold text-[var(--tx)]">
            Edit Quote {oq.quote_id}
            <span className="text-sm font-normal text-[var(--tx3)] ml-2">v{oq.version || 1}</span>
          </h1>
        </div>
        <span className="ml-auto px-3 py-1 rounded-full text-label font-semibold bg-[var(--gold)]/10 text-[var(--gold)]">
          {SERVICE_LABELS[serviceType] || serviceType}
        </span>
      </div>

      {/* Current quote summary */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
        <div className="text-section font-bold text-[var(--tx3)] tracking-widest uppercase mb-3">Current Quote</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--tx3)] text-caption">Client</div>
            <div className="text-[var(--tx)] font-medium">{contact?.name || "—"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-caption">Price</div>
            <div className="text-[var(--gold)] font-bold">{formatCurrency(Number(oldPrice))}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-caption">Move Date</div>
            <div className="text-[var(--tx)] font-medium">{oq.move_date || "TBD"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-caption">Status</div>
            <div className="text-[var(--tx)] font-medium capitalize">{oq.status}</div>
          </div>
        </div>
      </div>

      {/* ═══ CORE DETAILS ═══ */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
        <div className={sectionTitle}>Addresses & Scheduling</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>From Address</label>
            <input type="text" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>To Address</label>
            <input type="text" value={toAddress} onChange={(e) => setToAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>From Access</label>
            <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={inputClass}>
              {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>To Access</label>
            <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={inputClass}>
              {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Move Date</label>
            <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Preferred Time</label>
            <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={inputClass} />
          </div>
          {isResidential && (
            <div>
              <label className={labelClass}>Move Size</label>
              <select value={moveSize} onChange={(e) => setMoveSize(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {MOVE_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SERVICE-SPECIFIC FIELDS ═══ */}

      {/* Office fields */}
      {isOffice && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
          <div className={sectionTitle}>Office Details</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Square Footage</label>
              <input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="e.g. 2000" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Workstation Count</label>
              <input type="number" value={wsCount} onChange={(e) => setWsCount(e.target.value)} placeholder="e.g. 15" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Timing Preference</label>
              <select value={timingPref} onChange={(e) => setTimingPref(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                {TIMING_PREFS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-3 pt-5">
              <label className="flex items-center gap-2 text-body text-[var(--tx)]">
                <input type="checkbox" checked={hasIt} onChange={(e) => setHasIt(e.target.checked)} className={checkboxClass} />
                IT Equipment
              </label>
              <label className="flex items-center gap-2 text-body text-[var(--tx)]">
                <input type="checkbox" checked={hasConf} onChange={(e) => setHasConf(e.target.checked)} className={checkboxClass} />
                Conference Room
              </label>
              <label className="flex items-center gap-2 text-body text-[var(--tx)]">
                <input type="checkbox" checked={hasReception} onChange={(e) => setHasReception(e.target.checked)} className={checkboxClass} />
                Reception Area
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Single item / White glove fields */}
      {isSingleOrWG && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
          <div className={sectionTitle}>{serviceType === "white_glove" ? "White Glove Details" : "Item Details"}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Item Category</label>
              <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={inputClass}>
                {ITEM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Weight Class</label>
              <select value={itemWeight} onChange={(e) => setItemWeight(e.target.value)} className={inputClass}>
                <option value="">Select…</option>
                {WEIGHT_CLASSES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Assembly Needed</label>
              <select value={assembly} onChange={(e) => setAssembly(e.target.value)} className={inputClass}>
                {ASSEMBLY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Number of Items</label>
              <input type="number" min={1} value={numItems} onChange={(e) => setNumItems(Number(e.target.value))} className={inputClass} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-body text-[var(--tx)]">
                <input type="checkbox" checked={stairCarry} onChange={(e) => setStairCarry(e.target.checked)} className={checkboxClass} />
                Stair carry required
              </label>
              {stairCarry && (
                <div className="flex items-center gap-2">
                  <span className="text-caption text-[var(--tx3)]">Flights:</span>
                  <input type="number" min={1} max={10} value={stairFlights} onChange={(e) => setStairFlights(Number(e.target.value))} className="w-16 px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-body text-[var(--tx)] outline-none" />
                </div>
              )}
            </div>
            {serviceType === "white_glove" && (
              <div>
                <label className={labelClass}>Declared Value ($)</label>
                <input type="number" value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} placeholder="e.g. 5000" className={inputClass} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Specialty fields */}
      {isSpecialty && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
          <div className={sectionTitle}>Specialty / Event Details</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Project Type</label>
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={inputClass}>
                {PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Timeline (hours)</label>
              <input type="number" min={1} value={timelineHours} onChange={(e) => setTimelineHours(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Custom Crating Pieces</label>
              <input type="number" min={0} value={cratingPieces} onChange={(e) => setCratingPieces(Number(e.target.value))} className={inputClass} />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-body text-[var(--tx)]">
                <input type="checkbox" checked={climateControl} onChange={(e) => setClimateControl(e.target.checked)} className={checkboxClass} />
                Climate-controlled transport
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INVENTORY ═══ */}
      {isResidential && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
          <div className={sectionTitle}>Inventory</div>

          {/* Search to add items */}
          <div className="relative mb-4" ref={inventorySearchRef}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => { setInventorySearch(e.target.value); setShowInventoryDropdown(true); }}
                onFocus={() => setShowInventoryDropdown(true)}
                placeholder="Search items to add (e.g. sofa, bed, desk)…"
                className={`${inputClass} pl-9`}
              />
            </div>
            {showInventoryDropdown && filteredWeights.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredWeights.map((w) => (
                  <button
                    key={w.slug}
                    type="button"
                    onClick={() => addInventoryItem(w)}
                    className="w-full text-left px-3 py-2 text-ui hover:bg-[var(--gold)]/10 flex items-center justify-between text-[var(--tx)]"
                  >
                    <span>{w.item_name}</span>
                    <span className="text-label text-[var(--tx3)]">{w.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Inventory list */}
          {inventoryItems.length > 0 && (
            <div className="space-y-2 mb-4">
              {inventoryItems.map((item, idx) => (
                <div key={item.slug + idx} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                  <span className="text-ui text-[var(--tx)] font-medium flex-1 min-w-0 truncate">{item.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => setInventoryItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-6 h-6 rounded bg-[var(--brd)] flex items-center justify-center hover:bg-[var(--gold)]/20">
                      <Minus size={12} className="text-[var(--tx2)]" />
                    </button>
                    <span className="text-ui font-bold text-[var(--tx)] w-6 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => setInventoryItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))} className="w-6 h-6 rounded bg-[var(--brd)] flex items-center justify-center hover:bg-[var(--gold)]/20">
                      <Plus size={12} className="text-[var(--tx2)]" />
                    </button>
                    <button type="button" onClick={() => setInventoryItems((prev) => prev.filter((_, j) => j !== idx))} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--red)]/10 ml-1">
                      <X size={12} className="text-[var(--tx3)]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="max-w-xs">
            <label className={labelClass}>Estimated Boxes</label>
            <input type="number" min={0} value={boxCount} onChange={(e) => setBoxCount(e.target.value)} placeholder="Number of boxes" className={inputClass} />
          </div>
        </div>
      )}

      {/* ═══ SPECIALTY ITEMS ═══ */}
      {isResidential && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
          <div className={sectionTitle}>Specialty Items</div>
          <div className="space-y-2 mb-3">
            {specialtyItems.map((si, idx) => (
              <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <select
                  value={si.type}
                  onChange={(e) => setSpecialtyItems((prev) => prev.map((s, j) => j === idx ? { ...s, type: e.target.value } : s))}
                  className="flex-1 text-ui bg-transparent text-[var(--tx)] outline-none"
                >
                  {SPECIALTY_ITEM_TYPES.map((t) => <option key={t} value={t}>{toTitleCase(t)}</option>)}
                </select>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => setSpecialtyItems((prev) => prev.map((s, j) => j === idx ? { ...s, qty: Math.max(1, s.qty - 1) } : s))} className="w-6 h-6 rounded bg-[var(--brd)] flex items-center justify-center">
                    <Minus size={12} className="text-[var(--tx2)]" />
                  </button>
                  <span className="text-ui font-bold text-[var(--tx)] w-6 text-center">{si.qty}</span>
                  <button type="button" onClick={() => setSpecialtyItems((prev) => prev.map((s, j) => j === idx ? { ...s, qty: s.qty + 1 } : s))} className="w-6 h-6 rounded bg-[var(--brd)] flex items-center justify-center">
                    <Plus size={12} className="text-[var(--tx2)]" />
                  </button>
                  <button type="button" onClick={() => setSpecialtyItems((prev) => prev.filter((_, j) => j !== idx))} className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--red)]/10 ml-1">
                    <X size={12} className="text-[var(--tx3)]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSpecialtyItems((prev) => [...prev, { type: SPECIALTY_ITEM_TYPES[0], qty: 1 }])}
            className="flex items-center gap-1.5 text-caption font-semibold text-[var(--gold)] hover:text-[var(--gold)]/80"
          >
            <Plus size={13} /> Add specialty item
          </button>
        </div>
      )}

      {/* ═══ ADD-ONS ═══ */}
      {applicableAddons.length > 0 && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
          <div className={sectionTitle}>Add-ons</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {applicableAddons.map((addon) => {
              const sel = selectedAddons.get(addon.id);
              const isSelected = !!sel;
              return (
                <div
                  key={addon.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${isSelected ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
                  onClick={() => toggleAddon(addon)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-ui font-semibold text-[var(--tx)]">{addon.name}</div>
                      {addon.description && <div className="text-label text-[var(--tx3)] mt-0.5 line-clamp-2">{addon.description}</div>}
                    </div>
                    <div className="text-caption font-bold text-[var(--gold)] shrink-0">
                      {addon.price_type === "flat" && formatCurrency(addon.price)}
                      {addon.price_type === "per_unit" && `${formatCurrency(addon.price)}/ea`}
                      {addon.price_type === "percent" && `${addon.percent_value}%`}
                      {addon.price_type === "tiered" && addon.tiers?.[0] && `from ${formatCurrency(addon.tiers[0].price)}`}
                    </div>
                  </div>
                  {isSelected && addon.price_type === "per_unit" && (
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => updateAddonQty(addon.id, -1)} className="w-6 h-6 rounded bg-[var(--brd)] flex items-center justify-center">
                        <Minus size={12} className="text-[var(--tx2)]" />
                      </button>
                      <span className="text-ui font-bold text-[var(--tx)] w-6 text-center">{sel!.quantity}</span>
                      <button type="button" onClick={() => updateAddonQty(addon.id, 1)} className="w-6 h-6 rounded bg-[var(--brd)] flex items-center justify-center">
                        <Plus size={12} className="text-[var(--tx2)]" />
                      </button>
                    </div>
                  )}
                  {isSelected && addon.price_type === "tiered" && addon.tiers && (
                    <div className="flex gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {addon.tiers.map((tier, ti) => (
                        <button
                          key={ti}
                          type="button"
                          onClick={() => setSelectedAddons((prev) => { const next = new Map(prev); const s = next.get(addon.id)!; next.set(addon.id, { ...s, tier_index: ti }); return next; })}
                          className={`px-2 py-1 rounded text-label font-medium border ${sel!.tier_index === ti ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]" : "border-[var(--brd)] text-[var(--tx3)]"}`}
                        >
                          {tier.label} — {formatCurrency(tier.price)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ REASON ═══ */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6">
        <div className={sectionTitle}>Update Reason</div>
        <label className={labelClass}>Reason for Update (shown in email & HubSpot)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Client moved date, added items, changed address..."
          className={inputClass}
        />
      </div>

      {/* Generate button */}
      {!newQuoteResult && (
        <button
          onClick={handleRegenerate}
          disabled={generating}
          className="w-full py-3 rounded-xl bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : "Re-Generate Quote"}
        </button>
      )}

      {/* New quote result */}
      {newQuoteResult && (
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-5 mb-6 mt-6">
          <div className="text-section font-bold text-[var(--gold)] tracking-widest uppercase mb-3">New Quote Generated</div>
          <div className="flex items-center gap-6 mb-4">
            <div>
              <div className="text-caption text-[var(--tx3)]">Quote ID</div>
              <div className="text-sm font-bold text-[var(--gold)]">{newQuoteId}</div>
            </div>
            {oldPrice && newPrice && (
              <div>
                <div className="text-caption text-[var(--tx3)]">Price Change</div>
                <div className="text-sm font-medium text-[var(--tx)]">
                  <span className="line-through text-[var(--tx3)]">{formatCurrency(Number(oldPrice))}</span>
                  <span className="mx-2 text-[var(--tx3)]">→</span>
                  <span className="text-[var(--gold)] font-bold">{formatCurrency(Number(newPrice))}</span>
                </div>
              </div>
            )}
          </div>

          {newQuoteResult.tiers && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["essentials", "premier", "estate"].map((tier) => {
                const t = newQuoteResult.tiers[tier];
                if (!t) return null;
                return (
                  <div key={tier} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 text-center">
                    <div className="text-label text-[var(--gold)] font-semibold uppercase">{tier}</div>
                    <div className="text-lg font-bold text-[var(--tx)] mt-1">{formatCurrency(t.price)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {newQuoteResult.custom_price && (
            <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-4 mb-4 text-center">
              <div className="text-lg font-bold text-[var(--gold)]">{formatCurrency(newQuoteResult.custom_price.price)}</div>
              <div className="text-label text-[var(--tx3)] mt-1">+ {formatCurrency(newQuoteResult.custom_price.tax)} tax</div>
            </div>
          )}

          {newQuoteResult.labour && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-2.5">
                <div className="text-section text-[var(--tx3)] uppercase">Crew</div>
                <div className="text-sm font-bold text-[var(--tx)]">{newQuoteResult.labour.crewSize} movers</div>
              </div>
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-2.5">
                <div className="text-section text-[var(--tx3)] uppercase">Est. Hours</div>
                <div className="text-sm font-bold text-[var(--tx)]">{newQuoteResult.labour.hoursRange}</div>
              </div>
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-2.5">
                <div className="text-section text-[var(--tx3)] uppercase">Truck</div>
                <div className="text-sm font-bold text-[var(--tx)]">{newQuoteResult.labour.truckSize}</div>
              </div>
            </div>
          )}

          <button
            onClick={handleSendUpdate}
            disabled={linking}
            className="w-full py-3 rounded-xl bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {linking ? "Sending..." : "Send Updated Quote to Client"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 mt-4 text-ui border bg-[var(--red)]/5 border-[var(--red)]/20 text-[var(--red)]">
          {error}
        </div>
      )}
    </div>
  );
}
