"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildSpecialtyCostLines,
  defaultRoundedClientPrice,
  EQUIPMENT_RATES,
  hstOnPrice,
  mergeSpecialtyNonProcessingOverrides,
  priceFromMargin,
  suggestCrewSize,
  suggestJobHours,
  zoneTierFromDistanceKm,
  ZONE_LABELS,
  type VehicleType,
  type ZoneTier,
} from "@/lib/specialty-quote/cost-model";
import { X, Truck } from "@phosphor-icons/react";

const VEHICLE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "sprinter", label: "Sprinter van" },
  { value: "16ft", label: "16 ft truck" },
  { value: "26ft", label: "26 ft truck" },
];

function fmt(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (quoteId: string) => void;
  leadId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fromAddress: string;
  toAddress: string;
  fromAccess: string;
  toAccess: string;
  moveDate: string;
  itemDescription: string;
  itemWeightLbs: string;
  dimensionsText: string;
  toast: (msg: string, icon?: string) => void;
};

export default function SpecialtyTransportQuoteBuilder({
  open,
  onClose,
  onCreated,
  leadId,
  firstName,
  lastName,
  email,
  phone,
  fromAddress,
  toAddress,
  fromAccess,
  toAccess,
  moveDate,
  itemDescription,
  itemWeightLbs,
  dimensionsText,
  toast,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [driveTimeMin, setDriveTimeMin] = useState<number | null>(null);
  const [distErr, setDistErr] = useState<string | null>(null);
  const [weightLbs, setWeightLbs] = useState(200);
  const [desc, setDesc] = useState("");
  const [dims, setDims] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("sprinter");
  const [crewCount, setCrewCount] = useState(2);
  const [jobHours, setJobHours] = useState(3);
  const [totalKm, setTotalKm] = useState(0);
  const [zoneTier, setZoneTier] = useState<ZoneTier>("gta_core");
  const [zoneOverride, setZoneOverride] = useState("");
  const [stairFlights, setStairFlights] = useState(0);
  const [wrapL, setWrapL] = useState(1);
  const [wrapS, setWrapS] = useState(0);
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [marginPct, setMarginPct] = useState(40);
  const [clientPrice, setClientPrice] = useState(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [priceOverride, setPriceOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lineOverrides, setLineOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const w = parseFloat(itemWeightLbs.replace(/[^\d.]/g, ""));
    setWeightLbs(Number.isFinite(w) && w > 0 ? w : 200);
    setDesc(itemDescription.trim());
    setDims(dimensionsText.trim());
    setNotes("");
    setPriceTouched(false);
    setPriceOverride(false);
    setOverrideReason("");
    setLineOverrides({});
  }, [open, itemWeightLbs, itemDescription, dimensionsText]);

  useEffect(() => {
    if (!open) return;
    setCrewCount(suggestCrewSize(weightLbs));
  }, [open, weightLbs]);

  const extraStops = 0;

  useEffect(() => {
    if (!open) return;
    const km = distanceKm ?? 0;
    setJobHours(suggestJobHours({ distanceKm: km, weightLbs, extraStops }));
    const z = zoneTierFromDistanceKm(distanceKm);
    setZoneTier(z);
    if (distanceKm != null && distanceKm > 0) {
      setTotalKm((prev) => (prev <= 0 ? Math.round(distanceKm * 2 * 10) / 10 : prev));
    }
  }, [open, distanceKm, weightLbs]);

  useEffect(() => {
    if (!open) return;
    const from = fromAddress.trim();
    const to = toAddress.trim();
    if (from.length < 8 || to.length < 8) {
      setDistanceKm(null);
      setDriveTimeMin(null);
      setDistErr(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const res = await fetch("/api/quotes/preview-distance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from_address: from, to_address: to }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setDistErr(data.error || "Distance lookup failed");
            setDistanceKm(null);
            setDriveTimeMin(null);
            return;
          }
          setDistErr(null);
          setDistanceKm(typeof data.distance_km === "number" ? data.distance_km : null);
          setDriveTimeMin(typeof data.drive_time_min === "number" ? data.drive_time_min : null);
        } catch {
          if (!cancelled) setDistErr("Distance lookup failed");
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, fromAddress, toAddress]);

  const equipmentKeys = useMemo(
    () => Object.entries(equipment).filter(([, v]) => v).map(([k]) => k),
    [equipment],
  );

  const zoneFeeOverrideNum = zoneOverride.trim() === "" ? null : Number(zoneOverride);

  const costBuilt = useMemo(() => {
    return buildSpecialtyCostLines({
      crewCount,
      jobHours,
      vehicleType,
      weightLbs,
      totalKm: totalKm || 0,
      equipmentKeys,
      wrapLargeCount: wrapL,
      wrapSmallCount: wrapS,
      zoneTier,
      zoneFeeOverride: zoneFeeOverrideNum != null && Number.isFinite(zoneFeeOverrideNum) ? zoneFeeOverrideNum : null,
      stairFlights,
    });
  }, [
    crewCount,
    jobHours,
    vehicleType,
    weightLbs,
    totalKm,
    equipmentKeys,
    wrapL,
    wrapS,
    zoneTier,
    zoneFeeOverrideNum,
    stairFlights,
  ]);

  const costMerged = useMemo(
    () => mergeSpecialtyNonProcessingOverrides(costBuilt, lineOverrides),
    [costBuilt, lineOverrides],
  );

  const suggestedRaw = useMemo(
    () => priceFromMargin(costMerged.subtotal, marginPct / 100),
    [costMerged.subtotal, marginPct],
  );

  const suggestedRounded = useMemo(() => defaultRoundedClientPrice(suggestedRaw), [suggestedRaw]);

  useEffect(() => {
    if (!open || priceTouched) return;
    setClientPrice(suggestedRounded);
  }, [open, priceTouched, suggestedRounded]);

  const tax = hstOnPrice(clientPrice);
  const grandTotal = Math.round((clientPrice + tax) * 100) / 100;

  const toggleEq = (k: string) => {
    setEquipment((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const submit = useCallback(async () => {
    if (!notes.trim() || notes.trim().length < 4) {
      toast("Special handling notes are required", "alertTriangle");
      return;
    }
    if (!email.trim()) {
      toast("Client email is required", "alertTriangle");
      return;
    }
    if (priceOverride && overrideReason.trim().length < 3) {
      toast("Override reason is required", "alertTriangle");
      return;
    }
    const clientName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Client";
    setBusy(true);
    try {
      const res = await fetch("/api/admin/quotes/specialty-transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          client_email: email.trim(),
          client_phone: phone.trim(),
          from_address: fromAddress.trim(),
          to_address: toAddress.trim(),
          from_access: fromAccess,
          to_access: toAccess,
          move_date: moveDate.trim() || null,
          item_description: desc.trim(),
          weight_lbs: weightLbs,
          dimensions_text: dims.trim(),
          distance_km: distanceKm,
          drive_time_min: driveTimeMin,
          total_km: totalKm,
          vehicle_type: vehicleType,
          crew_count: crewCount,
          job_hours: jobHours,
          stair_flights: stairFlights,
          wrap_large_count: wrapL,
          wrap_small_count: wrapS,
          equipment_keys: equipmentKeys,
          zone_tier: zoneTier,
          zone_fee_override: zoneFeeOverrideNum != null && Number.isFinite(zoneFeeOverrideNum) ? zoneFeeOverrideNum : null,
          margin_percent: marginPct,
          cost_line_overrides: Object.keys(lineOverrides).length > 0 ? lineOverrides : undefined,
          client_price_pre_tax: clientPrice,
          price_override: priceOverride,
          override_reason: priceOverride ? overrideReason.trim() : null,
          special_handling_notes: notes.trim(),
          lead_id: leadId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast(`Quote ${data.quote_id} created`, "check");
      onCreated(String(data.quote_id));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setBusy(false);
    }
  }, [
    notes,
    email,
    priceOverride,
    overrideReason,
    firstName,
    lastName,
    phone,
    fromAddress,
    toAddress,
    fromAccess,
    toAccess,
    moveDate,
    desc,
    weightLbs,
    dims,
    distanceKm,
    driveTimeMin,
    totalKm,
    vehicleType,
    crewCount,
    jobHours,
    stairFlights,
    wrapL,
    wrapS,
    equipmentKeys,
    zoneTier,
    zoneFeeOverrideNum,
    marginPct,
    lineOverrides,
    clientPrice,
    leadId,
    toast,
    onCreated,
    onClose,
  ]);

  const onEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, onEscape]);

  if (!open || typeof document === "undefined") return null;

  const modal = (
    <div
      data-modal-root
      className="fixed inset-0 z-[var(--z-modal)] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="specialty-builder-title"
    >
      <div
        className="fixed inset-0 z-0 bg-black/60 modal-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-3xl flex flex-col bg-[var(--card)] border border-[var(--brd)] rounded-2xl shadow-xl overflow-hidden modal-card pointer-events-auto"
        style={{
          maxHeight: "min(90dvh, min(92vh, 900px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)] shrink-0">
          <div>
            <h2 id="specialty-builder-title" className="text-[14px] font-bold text-[var(--tx)]">
              Specialty Quote Builder
            </h2>
            <p className="text-[10px] text-[var(--tx3)]">One-off B2B / heavy transport (manual pricing)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--tx2)] hover:bg-[var(--gdim)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5 text-[12px] text-[var(--tx2)]">
          <p className="text-[11px] text-[var(--tx3)] leading-snug">
            Pre-filled from the form and lead. Distance uses Mapbox routing. Cost lines are editable; margin drives the
            suggested price. Send the quote from the quote detail page when ready.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Item description</span>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                className="field-input-compact w-full"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Weight (lb)</span>
                <input
                  type="number"
                  min={1}
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(Number(e.target.value) || 0)}
                  className="field-input-compact w-full"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Dimensions</span>
                <input
                  value={dims}
                  onChange={(e) => setDims(e.target.value)}
                  placeholder='e.g. 42" x 100"'
                  className="field-input-compact w-full"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--brd)] p-3 space-y-2">
            <div className="flex items-center gap-2 text-[var(--tx)] font-semibold">
              <Truck className="w-4 h-4 text-[var(--gold)]" weight="duotone" aria-hidden />
              Route
            </div>
            {distErr ? <p className="text-[11px] text-amber-600">{distErr}</p> : null}
            <p className="text-[11px]">
              Linehaul:{" "}
              {distanceKm != null ? (
                <>
                  <span className="font-mono tabular-nums">{distanceKm}</span> km
                  {driveTimeMin != null ? ` · ~${driveTimeMin} min` : ""}
                </>
              ) : (
                "Enter valid pickup and delivery on the main form"
              )}
            </p>
            <p className="text-[11px]">
              Zone (auto): <span className="font-medium text-[var(--tx)]">{ZONE_LABELS[zoneTier]}</span>
            </p>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Total km (incl. deadhead)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={totalKm || ""}
                onChange={(e) => setTotalKm(Number(e.target.value) || 0)}
                className="field-input-compact w-full max-w-[200px]"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Vehicle</span>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="field-input-compact w-full"
              >
                {VEHICLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Zone tier (manual)</span>
              <select
                value={zoneTier}
                onChange={(e) => setZoneTier(e.target.value as ZoneTier)}
                className="field-input-compact w-full"
              >
                {(Object.keys(ZONE_LABELS) as ZoneTier[]).map((z) => (
                  <option key={z} value={z}>
                    {ZONE_LABELS[z]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Crew size</span>
              <input
                type="number"
                min={1}
                max={8}
                value={crewCount}
                onChange={(e) => setCrewCount(Number(e.target.value) || 1)}
                className="field-input-compact w-full"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Est. job hours</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={jobHours}
                onChange={(e) => setJobHours(Number(e.target.value) || 0.5)}
                className="field-input-compact w-full"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Stair flights (no elevator)</span>
              <input
                type="number"
                min={0}
                value={stairFlights}
                onChange={(e) => setStairFlights(Number(e.target.value) || 0)}
                className="field-input-compact w-full"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Zone fee override ($)</span>
              <input
                value={zoneOverride}
                onChange={(e) => setZoneOverride(e.target.value)}
                placeholder="Leave blank for default"
                className="field-input-compact w-full"
              />
            </label>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Equipment</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(EQUIPMENT_RATES).map(([key, { label, dollars }]) => (
                <label
                  key={key}
                  className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer text-[11px] ${
                    equipment[key] ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--brd)]"
                  }`}
                >
                  <input type="checkbox" checked={!!equipment[key]} onChange={() => toggleEq(key)} className="accent-[var(--gold)]" />
                  {label} (+{fmt(dollars)})
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-xs">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Wrap large</span>
              <input
                type="number"
                min={0}
                value={wrapL}
                onChange={(e) => setWrapL(Number(e.target.value) || 0)}
                className="field-input-compact w-full"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Wrap small</span>
              <input
                type="number"
                min={0}
                value={wrapS}
                onChange={(e) => setWrapS(Number(e.target.value) || 0)}
                className="field-input-compact w-full"
              />
            </label>
          </div>

          <div className="rounded-xl border border-[var(--brd)] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--brd)] bg-[var(--bg)]">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Cost lines</span>
              <button
                type="button"
                disabled={Object.keys(lineOverrides).length === 0}
                onClick={() => setLineOverrides({})}
                className="text-[10px] font-semibold text-[var(--gold)] disabled:opacity-40 disabled:pointer-events-none"
              >
                Reset line amounts
              </button>
            </div>
            <table className="w-full text-[11px]">
              <tbody>
                {costMerged.lines.map((row) => (
                  <tr key={row.key} className="border-t border-[var(--brd)] first:border-t-0">
                    <td className="px-3 py-1.5">
                      {row.label}
                      {row.key === "processing" ? (
                        <span className="block text-[9px] text-[var(--tx3)] font-normal mt-0.5">
                          Recalculated from lines above
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right w-[1%] whitespace-nowrap">
                      {row.key === "processing" ? (
                        <span className="font-mono tabular-nums">{fmt(row.amount)}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={lineOverrides[row.key] ?? row.amount}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setLineOverrides((prev) => ({
                              ...prev,
                              [row.key]: Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0,
                            }));
                          }}
                          className="field-input-compact w-[7.5rem] text-right font-mono tabular-nums"
                        />
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--brd)] bg-[var(--bg)]">
                  <td className="px-3 py-2 font-bold text-[var(--tx)]">Subtotal (cost build)</td>
                  <td className="px-3 py-2 text-right font-bold font-mono text-[var(--tx)]">{fmt(costMerged.subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">
                Target margin ({marginPct}%)
              </span>
              <input
                type="range"
                min={25}
                max={50}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                className="w-full accent-[var(--gold)]"
              />
            </label>
            <p className="text-[11px] text-[var(--tx3)]">
              Suggested (pre-tax): <span className="font-mono text-[var(--tx)]">{fmt(suggestedRaw)}</span> · Rounded
              default: <span className="font-mono text-[var(--tx)]">{fmt(suggestedRounded)}</span>
            </p>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Client price (pre-tax)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={clientPrice || ""}
                onChange={(e) => {
                  setPriceTouched(true);
                  setClientPrice(Number(e.target.value) || 0);
                }}
                className="field-input-compact w-full max-w-[200px]"
              />
            </label>
            <p className="text-[11px]">
              HST (13%): <span className="font-mono">{fmt(tax)}</span> · Total:{" "}
              <span className="font-mono font-bold text-[var(--tx)]">{fmt(grandTotal)}</span>
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={priceOverride}
                onChange={(e) => setPriceOverride(e.target.checked)}
                className="accent-[var(--gold)]"
              />
              Price override (below cost or off-model)
            </label>
            {priceOverride ? (
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override (required)"
                rows={2}
                className="field-input-compact w-full"
              />
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-[var(--tx3)]">Special handling notes *</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Required — crew-facing details, access, risks, client expectations"
              rows={3}
              className="field-input-compact w-full"
            />
          </label>
        </div>

        <div className="border-t border-[var(--brd)] px-4 py-3 flex flex-wrap gap-2 justify-end shrink-0 bg-[var(--bg)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-[12px] border border-[var(--brd)] text-[var(--tx2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create draft quote"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
