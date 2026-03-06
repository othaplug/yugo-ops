"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Send, CheckCircle, Loader2, TrendingUp } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EditQuoteClientProps {
  originalQuote: any;
  addons: any[];
  config: Record<string, string>;
}

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_delivery: "B2B Delivery",
};

const SPECIALTY_ITEM_TYPES = [
  "piano", "safe", "pool_table", "hot_tub", "exercise_equipment", "art", "antique",
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

export default function EditQuoteClient({ originalQuote, addons: _addons, config: _config }: EditQuoteClientProps) {
  const router = useRouter();
  const oq = originalQuote;
  const contact = Array.isArray(oq.contacts) ? oq.contacts[0] : oq.contacts;
  const [serviceType] = useState<string>(oq.service_type);
  const factors = (oq.factors_applied ?? {}) as Record<string, any>;

  // ── Core fields ──────────────────────────────────────────
  const [fromAddress, setFromAddress] = useState(oq.from_address || "");
  const [toAddress, setToAddress] = useState(oq.to_address || "");
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

  // ── Residential specialty items ───────────────────────────
  const [specialtyItems, setSpecialtyItems] = useState<{ type: string; qty: number }[]>(oq.specialty_items || []);

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

  const oldPrice = oq.tiers?.essentials?.price ?? oq.custom_price ?? 0;

  // ── Build request payload from current state ──────────────
  const buildPayload = useCallback((): Record<string, any> => {
    const payload: Record<string, any> = {
      service_type: serviceType,
      from_address: fromAddress,
      to_address: toAddress,
      from_access: fromAccess || undefined,
      to_access: toAccess || undefined,
      move_date: moveDate || undefined,
      move_size: moveSize || undefined,
      contact_id: contact?.id || oq.contact_id,
      hubspot_deal_id: oq.hubspot_deal_id || undefined,
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

    if ((serviceType === "local_move" || serviceType === "long_distance") && specialtyItems.length > 0) {
      payload.specialty_items = specialtyItems.filter((s) => s.qty > 0);
    }

    // Carry over any remaining factors not exposed in UI
    if (factors.company_name) payload.company_name = factors.company_name;
    if (factors.item_description) payload.item_description = factors.item_description;

    return payload;
  }, [
    serviceType, fromAddress, toAddress, fromAccess, toAccess, moveDate, moveSize,
    squareFootage, workstationCount, hasItEquipment, hasConferenceRoom, hasReceptionArea, timingPreference,
    itemCategory, itemWeightClass, assemblyNeeded, stairCarry, stairFlights, declaredValue,
    projectType, timelineHours, customCratingPieces, climateControl, specialtyItems,
    contact, oq, factors,
  ]);

  // ── Debounced live preview (no DB write) ──────────────────
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
      } catch { /* silent fail — preview is best-effort */ }
      setPreviewLoading(false);
    }, 800);

    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [buildPayload, fromAddress, toAddress, moveDate]);

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
      setNewQuoteId(data.quote_id);
    } catch {
      setError("Network error generating quote");
    } finally {
      setGenerating(false);
    }
  }, [buildPayload]);

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
    } catch {
      setError("Network error");
    } finally {
      setLinking(false);
    }
  }, [newQuoteId, oq.quote_id, reason]);

  const newPrice = newQuoteResult?.tiers?.essentials?.price ?? newQuoteResult?.custom_price?.price ?? null;
  const livePrice = livePreview?.tiers?.essentials?.price ?? livePreview?.custom_price?.price ?? null;

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-all";
  const labelClass = "block text-[11px] font-semibold text-[var(--tx2)] mb-1.5";

  // ── Toggle checkbox item ──────────────────────────────────
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
          <button onClick={() => router.push(`/admin/quotes/${newQuoteId}/edit`)} className="px-5 py-2.5 rounded-lg bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90">
            View New Quote
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
          <ArrowLeft size={18} />
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
            <div className="text-[var(--tx)] font-medium">{contact?.name || "—"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Current Price</div>
            <div className="text-[var(--gold)] font-bold">{formatCurrency(Number(oldPrice))}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Move Date</div>
            <div className="text-[var(--tx)] font-medium">{oq.move_date || "TBD"}</div>
          </div>
          <div>
            <div className="text-[var(--tx3)] text-[11px]">Status</div>
            <div className="text-[var(--tx)] font-medium capitalize">{oq.status}</div>
          </div>
        </div>
      </div>

      {/* Live price preview card */}
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
                  {(["essentials", "premier", "estate"] as const).map((tier) => {
                    const t = livePreview.tiers[tier];
                    if (!t) return null;
                    const isEss = tier === "essentials";
                    return (
                      <div key={tier} className={`rounded-lg p-3 text-center border ${isEss ? "border-[var(--gold)]/40 bg-[var(--gold)]/8" : "border-[var(--brd)] bg-[var(--bg)]"}`}>
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
            </>
          )}
        </div>
      )}

      {/* Edit fields */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 mb-6 space-y-5">
        <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase">Update Details</div>

        {/* ── Core fields ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>From Address</label>
            <input type="text" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className={inputClass} placeholder="123 Main St, Toronto, ON" />
          </div>
          <div>
            <label className={labelClass}>To Address</label>
            <input type="text" value={toAddress} onChange={(e) => setToAddress(e.target.value)} className={inputClass} placeholder="456 Bay St, Toronto, ON" />
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
            </select>
          </div>
          <div>
            <label className={labelClass}>Move Date</label>
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
          <div className="space-y-4">
            <SectionDivider label="Office Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Square Footage</label>
                <input type="number" value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} className={inputClass} placeholder="e.g. 2000" />
              </div>
              <div>
                <label className={labelClass}>Number of Workstations</label>
                <input type="number" value={workstationCount} onChange={(e) => setWorkstationCount(e.target.value)} className={inputClass} placeholder="e.g. 15" />
              </div>
              <div>
                <label className={labelClass}>Timing Preference</label>
                <select value={timingPreference} onChange={(e) => setTimingPreference(e.target.value)} className={inputClass}>
                  <option value="">Standard (business hours)</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening (+15%)</option>
                  <option value="overnight">Overnight (+15%)</option>
                  <option value="weekend">Weekend</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 justify-center pt-1">
                <Toggle checked={hasItEquipment} onChange={setHasItEquipment} label="Has IT Equipment" />
                <Toggle checked={hasConferenceRoom} onChange={setHasConferenceRoom} label="Has Conference Room" />
                <Toggle checked={hasReceptionArea} onChange={setHasReceptionArea} label="Has Reception Area" />
              </div>
            </div>
          </div>
        )}

        {/* ── Single item / White glove ── */}
        {(serviceType === "single_item" || serviceType === "white_glove") && (
          <div className="space-y-4">
            <SectionDivider label="Item Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Item Category</label>
                <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={inputClass}>
                  <option value="">Select category…</option>
                  <option value="standard_furniture">Standard Furniture</option>
                  <option value="large_furniture">Large Furniture (couch, bed frame)</option>
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
                <label className={labelClass}>Item Weight Class</label>
                <select value={itemWeightClass} onChange={(e) => setItemWeightClass(e.target.value)} className={inputClass}>
                  <option value="">Select weight…</option>
                  <option value="Under 150 lbs">Under 150 lbs</option>
                  <option value="150-300 lbs">150–300 lbs</option>
                  <option value="300-500 lbs">300–500 lbs (+$100)</option>
                  <option value="Over 500 lbs">Over 500 lbs (+$200)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Assembly / Disassembly</label>
                <select value={assemblyNeeded} onChange={(e) => setAssemblyNeeded(e.target.value)} className={inputClass}>
                  <option value="">None required</option>
                  <option value="assembly">Assembly only</option>
                  <option value="disassembly">Disassembly only</option>
                  <option value="both">Both assembly & disassembly</option>
                </select>
              </div>
              {serviceType === "white_glove" && (
                <div>
                  <label className={labelClass}>Declared Value ($)</label>
                  <input type="number" value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} className={inputClass} placeholder="e.g. 5000" />
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Toggle checked={stairCarry} onChange={setStairCarry} label="Stair Carry Required" />
                {stairCarry && (
                  <div>
                    <label className={labelClass}>Number of Flights</label>
                    <input type="number" min="1" max="10" value={stairFlights} onChange={(e) => setStairFlights(e.target.value)} className={inputClass} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Specialty service ── */}
        {serviceType === "specialty" && (
          <div className="space-y-4">
            <SectionDivider label="Specialty Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Project Type</label>
                <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={inputClass}>
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
                <label className={labelClass}>Estimated Hours</label>
                <input type="number" min="1" max="24" step="0.5" value={timelineHours} onChange={(e) => setTimelineHours(e.target.value)} className={inputClass} placeholder="e.g. 4" />
              </div>
              <div>
                <label className={labelClass}>Custom Crating Pieces</label>
                <input type="number" min="0" value={customCratingPieces} onChange={(e) => setCustomCratingPieces(e.target.value)} className={inputClass} placeholder="0" />
              </div>
              <div className="flex items-center pt-4">
                <Toggle checked={climateControl} onChange={setClimateControl} label="Climate-Controlled Transport (+$150)" />
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
                    <span className="text-[12px] text-[var(--tx)] capitalize">{type.replace(/_/g, " ")}</span>
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
          className="w-full py-3 rounded-xl bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
              <div className="text-sm font-bold text-[var(--gold)]">{newQuoteId}</div>
            </div>
            {oldPrice && newPrice && (
              <div>
                <div className="text-[11px] text-[var(--tx3)]">Price Change</div>
                <div className="text-sm font-medium text-[var(--tx)] flex items-center gap-2">
                  <span className="line-through text-[var(--tx3)]">{formatCurrency(Number(oldPrice))}</span>
                  <span className="text-[var(--tx3)]">→</span>
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

          <button
            onClick={handleSendUpdate}
            disabled={linking}
            className="w-full py-3 rounded-xl bg-[var(--gold)] text-[#0D0D0D] text-sm font-semibold hover:bg-[var(--gold)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {linking ? "Sending…" : "Send Updated Quote to Client"}
          </button>
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
