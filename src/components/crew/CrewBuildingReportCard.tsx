"use client";

import { useState, useCallback } from "react";
import { Buildings, CheckCircle, ArrowRight } from "@phosphor-icons/react";

const ELEVATOR_OPTIONS: { value: string; label: string }[] = [
  { value: "standard", label: "Standard: freight or elevator direct to floor" },
  { value: "split_transfer", label: "Transfer between elevators once" },
  { value: "multi_transfer", label: "Multiple transfers" },
  { value: "no_freight", label: "No freight elevator (residential only)" },
  { value: "stairs_only", label: "Stairs only" },
];

interface LocationReport {
  elevator: string;
  commercial: boolean;
  dock: boolean;
  narrow: boolean;
  complexity: number;
  notes: string;
}

function defaultReport(): LocationReport {
  return { elevator: "standard", commercial: false, dock: false, narrow: false, complexity: 3, notes: "" };
}

function LocationForm({
  label,
  address,
  report,
  onChange,
}: {
  label: string;
  address: string;
  report: LocationReport;
  onChange: (r: LocationReport) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-[#2B0416]/5 px-3 py-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#2B0416]/60 mb-0.5">{label}</p>
        <p className="text-[12px] font-semibold text-[var(--tx)] leading-snug truncate">{address || "—"}</p>
      </div>
      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
        Elevator situation
        <select
          value={report.elevator}
          onChange={(e) => onChange({ ...report, elevator: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-white px-2.5 py-2 text-[12px] text-[var(--tx)]"
        >
          {ELEVATOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2.5 text-[12px] text-[var(--tx)] cursor-pointer">
        <input type="checkbox" className="mt-0.5 accent-[#2C3E2D]" checked={report.commercial} onChange={(e) => onChange({ ...report, commercial: e.target.checked })} />
        <span>Commercial tenants on lower floors (retail, grocery, food)</span>
      </label>
      <label className="flex items-start gap-2.5 text-[12px] text-[var(--tx)] cursor-pointer">
        <input type="checkbox" className="mt-0.5 accent-[#2C3E2D]" checked={report.dock} onChange={(e) => onChange({ ...report, dock: e.target.checked })} />
        <span>Shared loading dock or dock wait time</span>
      </label>
      <label className="flex items-start gap-2.5 text-[12px] text-[var(--tx)] cursor-pointer">
        <input type="checkbox" className="mt-0.5 accent-[#2C3E2D]" checked={report.narrow} onChange={(e) => onChange({ ...report, narrow: e.target.checked })} />
        <span>Narrow hallways or tight turns</span>
      </label>
      <div>
        <p className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wide mb-1.5">
          Access difficulty (1 easy → 5 very hard)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...report, complexity: n })}
              className={`min-w-[40px] h-9 rounded-lg text-[12px] font-bold border transition-colors ${
                report.complexity === n
                  ? "border-[#2C3E2D] bg-[#2C3E2D]/15 text-[#243524]"
                  : "border-[var(--brd)] bg-white text-[var(--tx2)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
        Notes for future crews
        <textarea
          value={report.notes}
          onChange={(e) => onChange({ ...report, notes: e.target.value })}
          rows={2}
          placeholder="Dock level, concierge steps, elevator bank, fob rules"
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-white px-2.5 py-2 text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
        />
      </label>
    </div>
  );
}

export default function CrewBuildingReportCard({
  moveId,
  address,
  lat,
  lng,
  fromAddress,
  fromLat,
  fromLng,
  toAddress,
  toLat,
  toLng,
}: {
  moveId: string;
  /** @deprecated use fromAddress/toAddress */
  address?: string;
  lat?: number | null;
  lng?: number | null;
  fromAddress?: string;
  fromLat?: number | null;
  fromLng?: number | null;
  toAddress?: string;
  toLat?: number | null;
  toLng?: number | null;
}) {
  const pickupAddr = fromAddress || address || "";
  const dropoffAddr = toAddress || "";
  const hasBothLocations = !!(pickupAddr && dropoffAddr);

  const [step, setStep] = useState<"pickup" | "dropoff">("pickup");
  const [pickupReport, setPickupReport] = useState<LocationReport>(defaultReport());
  const [dropoffReport, setDropoffReport] = useState<LocationReport>(defaultReport());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const reports = hasBothLocations
        ? [
            {
              location: "pickup",
              address: pickupAddr,
              lat: fromLat ?? lat ?? null,
              lng: fromLng ?? lng ?? null,
              ...pickupReport,
            },
            {
              location: "dropoff",
              address: dropoffAddr,
              lat: toLat ?? null,
              lng: toLng ?? null,
              ...dropoffReport,
            },
          ]
        : [
            {
              location: "dropoff",
              address: dropoffAddr || pickupAddr,
              lat: toLat ?? lat ?? null,
              lng: toLng ?? lng ?? null,
              ...dropoffReport,
            },
          ];

      const res = await fetch("/api/crew/building-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId, reports }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      setDone(true);
    } catch {
      setErr("Could not save");
    } finally {
      setSaving(false);
    }
  }, [moveId, pickupAddr, dropoffAddr, fromLat, fromLng, toLat, toLng, lat, lng, pickupReport, dropoffReport, hasBothLocations]);

  if (done) {
    return (
      <div className="mx-2 rounded-2xl border border-[#2C3E2D]/30 bg-[#2C3E2D]/8 px-4 py-3 flex items-start gap-3">
        <CheckCircle size={22} weight="bold" className="text-[#243524] shrink-0 mt-0.5" aria-hidden />
        <p className="text-[12px] text-[var(--tx)] leading-snug">
          Building notes saved for {hasBothLocations ? "both locations" : "this location"}. Thank you for helping the next crew.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-2 rounded-2xl border border-[var(--brd)]/60 bg-[#FAF7F2] px-4 py-3 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5C1A33]/10 text-[#5C1A33]">
          <Buildings size={20} weight="bold" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]">
            Building report — {hasBothLocations ? (step === "pickup" ? "1 of 2: Pickup" : "2 of 2: Drop-off") : "optional"}
          </p>
          <p className="text-[11px] text-[var(--tx2)] mt-1 leading-snug">
            Document access for future quotes at {hasBothLocations ? "these addresses" : "this address"}. About 30 seconds.
          </p>
        </div>
      </div>

      {hasBothLocations && step === "pickup" && (
        <>
          <LocationForm
            label="Pickup location"
            address={pickupAddr}
            report={pickupReport}
            onChange={setPickupReport}
          />
          <button
            type="button"
            onClick={() => setStep("dropoff")}
            className="crew-premium-cta w-full py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white flex items-center justify-center gap-2"
          >
            Next: Drop-off location <ArrowRight size={14} weight="bold" />
          </button>
        </>
      )}

      {(!hasBothLocations || step === "dropoff") && (
        <>
          <LocationForm
            label={hasBothLocations ? "Drop-off location" : "Location"}
            address={hasBothLocations ? dropoffAddr : (dropoffAddr || pickupAddr)}
            report={dropoffReport}
            onChange={setDropoffReport}
          />
          {err && <p className="text-[11px] text-red-700">{err}</p>}
          <div className="flex gap-2">
            {hasBothLocations && (
              <button
                type="button"
                onClick={() => setStep("pickup")}
                className="crew-premium-cta px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white opacity-70"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="crew-premium-cta flex-1 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : hasBothLocations ? "Save both" : "Save building report"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
