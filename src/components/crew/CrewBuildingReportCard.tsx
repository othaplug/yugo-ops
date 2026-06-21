"use client";

import { useState, useCallback } from "react";
import {
  Buildings,
  CheckCircle,
  ArrowRight,
  House,
  Storefront,
  Stairs,
  DotsThreeOutline,
  Warning,
} from "@phosphor-icons/react";

type Archetype = "house" | "walk_up" | "elevator" | "two_stage" | "other";

const TYPE_TILES: { key: Archetype; type: string; label: string; Icon: typeof House }[] = [
  { key: "house", type: "detached_house", label: "House", Icon: House },
  { key: "walk_up", type: "walk_up", label: "Walk-up", Icon: Stairs },
  { key: "elevator", type: "high_rise", label: "Mid / high-rise", Icon: Buildings },
  { key: "two_stage", type: "mixed_use", label: "Over shops", Icon: Storefront },
  { key: "other", type: "other", label: "Other", Icon: DotsThreeOutline },
];

interface LocationReport {
  archetype: Archetype | null;
  building_type: string | null;
  // house
  entrance_steps_band: string | null;
  interior_levels: number | null;
  staircase_type: string | null;
  truck_spot: string | null;
  // walk-up
  unit_floor: number | null;
  stair_type: string | null;
  stair_width_band: string | null;
  // elevator / two-stage
  elevator_type: string | null;
  elevator_booking_required: boolean;
  elevator_window_minutes: number | null;
  coi_required: boolean;
  carry_band: string | null;
  two_stage_transfer: boolean;
  shared_with_commercial: boolean;
  lobby_walk_band: string | null;
  notes: string;
}

function defaultReport(): LocationReport {
  return {
    archetype: null,
    building_type: null,
    entrance_steps_band: null,
    interior_levels: null,
    staircase_type: null,
    truck_spot: null,
    unit_floor: null,
    stair_type: null,
    stair_width_band: null,
    elevator_type: null,
    elevator_booking_required: false,
    elevator_window_minutes: null,
    coi_required: false,
    carry_band: null,
    two_stage_transfer: false,
    shared_with_commercial: false,
    lobby_walk_band: null,
    notes: "",
  };
}

function Seg<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={`px-2.5 py-1.5 rounded-full text-[12px] border transition-colors ${
              on
                ? "border-[#2C3E2D] bg-[#2C3E2D] text-white"
                : "border-[var(--brd)] bg-white text-[var(--tx2)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--tx3)] mb-1.5">{label}</p>
      {children}
    </div>
  );
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
  const set = (patch: Partial<LocationReport>) => onChange({ ...report, ...patch });
  const a = report.archetype;

  return (
    <div className="space-y-3.5">
      <div className="rounded-lg bg-[#2B0416]/5 px-3 py-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#2B0416]/60 mb-0.5">{label}</p>
        <p className="text-[12px] font-semibold text-[var(--tx)] leading-snug truncate">{address || "—"}</p>
      </div>

      <Field label="What kind of building is this?">
        <div className="grid grid-cols-2 gap-2">
          {TYPE_TILES.map(({ key, type, label: tl, Icon }) => {
            const on = a === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => set({ archetype: key, building_type: type })}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[12px] transition-colors ${
                  on ? "border-[#2C3E2D] bg-[#2C3E2D]/8 text-[#243524]" : "border-[var(--brd)] bg-white text-[var(--tx2)]"
                }`}
              >
                <Icon size={20} weight={on ? "fill" : "regular"} className={on ? "text-[#2C3E2D]" : "text-[var(--tx3)]"} aria-hidden />
                {tl}
              </button>
            );
          })}
        </div>
      </Field>

      {a === "house" && (
        <>
          <Field label="Steps up to the front door">
            <Seg value={report.entrance_steps_band} onChange={(v) => set({ entrance_steps_band: v })}
              options={[{ v: "none", label: "None" }, { v: "few", label: "A few" }, { v: "porch", label: "Porch" }, { v: "many", label: "10+" }]} />
          </Field>
          <Field label="Interior levels we'll cover">
            <Seg value={report.interior_levels} onChange={(v) => set({ interior_levels: v })}
              options={[{ v: 1, label: "Main only" }, { v: 2, label: "2" }, { v: 3, label: "3+" }, { v: 4, label: "+ basement" }]} />
          </Field>
          <Field label="Interior staircase">
            <Seg value={report.staircase_type} onChange={(v) => set({ staircase_type: v })}
              options={[{ v: "open", label: "Open" }, { v: "narrow", label: "Narrow" }, { v: "tight_turn", label: "Tight turn" }, { v: "spiral", label: "Spiral" }]} />
          </Field>
          <Field label="Where the truck parks">
            <Seg value={report.truck_spot} onChange={(v) => set({ truck_spot: v })}
              options={[{ v: "driveway", label: "Driveway" }, { v: "street", label: "Street" }, { v: "far", label: "Far / laneway" }]} />
          </Field>
        </>
      )}

      {a === "walk_up" && (
        <>
          <Field label="Unit floor">
            <Seg value={report.unit_floor} onChange={(v) => set({ unit_floor: v })}
              options={[{ v: 2, label: "2" }, { v: 3, label: "3" }, { v: 4, label: "4" }, { v: 5, label: "5+" }]} />
          </Field>
          <Field label="Stair type">
            <Seg value={report.stair_type} onChange={(v) => set({ stair_type: v })}
              options={[{ v: "straight", label: "Straight" }, { v: "switchback", label: "Switchback" }, { v: "spiral", label: "Spiral" }, { v: "exterior", label: "Exterior" }]} />
          </Field>
          <Field label="Stair width & turns">
            <Seg value={report.stair_width_band} onChange={(v) => set({ stair_width_band: v })}
              options={[{ v: "roomy", label: "Roomy" }, { v: "standard", label: "Standard" }, { v: "tight", label: "Tight" }]} />
          </Field>
          <Field label="Steps up to the entrance">
            <Seg value={report.entrance_steps_band} onChange={(v) => set({ entrance_steps_band: v })}
              options={[{ v: "none", label: "None" }, { v: "few", label: "Stoop" }, { v: "many", label: "Many" }]} />
          </Field>
        </>
      )}

      {(a === "elevator" || a === "two_stage") && (
        <>
          {a === "two_stage" && (
            <div className="flex items-center gap-2 rounded-lg bg-[#6B1F3A]/8 px-3 py-2 text-[12px] text-[#6B1F3A]">
              <Warning size={16} weight="fill" aria-hidden /> Two-stage building — extra handling expected
            </div>
          )}
          <Field label="Elevator for the move">
            <Seg value={report.elevator_type} onChange={(v) => set({ elevator_type: v })}
              options={[{ v: "freight", label: "Freight" }, { v: "passenger", label: "Passenger only" }, { v: "both", label: "Both" }, { v: "none", label: "None" }]} />
          </Field>
          <Field label="Booking required?">
            <Seg value={report.elevator_booking_required} onChange={(v) => set({ elevator_booking_required: v })}
              options={[{ v: false, label: "No" }, { v: true, label: "Yes — reserve a window" }]} />
          </Field>
          {report.elevator_booking_required && (
            <Field label="Reserved window">
              <Seg value={report.elevator_window_minutes} onChange={(v) => set({ elevator_window_minutes: v })}
                options={[{ v: 60, label: "1 hr" }, { v: 120, label: "2 hrs" }, { v: 180, label: "3 hrs" }]} />
            </Field>
          )}
          <Field label="Unit floor">
            <input
              type="number" inputMode="numeric" value={report.unit_floor ?? ""}
              onChange={(e) => set({ unit_floor: e.target.value ? parseInt(e.target.value, 10) : null })}
              placeholder="e.g. 18"
              className="w-24 rounded-lg border border-[var(--brd)] bg-white px-2.5 py-2 text-[13px] text-[var(--tx)]"
            />
          </Field>
          <Field label="COI / damage deposit required?">
            <Seg value={report.coi_required} onChange={(v) => set({ coi_required: v })}
              options={[{ v: true, label: "COI required" }, { v: false, label: "Not required" }]} />
          </Field>
          <Field label="Carry: dock → elevator → unit">
            <Seg value={report.carry_band} onChange={(v) => set({ carry_band: v })}
              options={[{ v: "short", label: "Short" }, { v: "medium", label: "Medium" }, { v: "long", label: "Long" }, { v: "very_long", label: "Very long" }]} />
          </Field>
          {a === "two_stage" && (
            <>
              <Field label="Shared elevator with stores below?">
                <Seg value={report.shared_with_commercial} onChange={(v) => set({ shared_with_commercial: v })}
                  options={[{ v: false, label: "No" }, { v: true, label: "Yes — retail / grocery" }]} />
              </Field>
              <Field label="Two-stage transfer">
                <Seg value={report.two_stage_transfer} onChange={(v) => set({ two_stage_transfer: v })}
                  options={[{ v: false, label: "None" }, { v: true, label: "P-level → lobby → resi" }]} />
              </Field>
              <Field label="Lobby / concourse walk">
                <Seg value={report.lobby_walk_band} onChange={(v) => set({ lobby_walk_band: v })}
                  options={[{ v: "short", label: "Short" }, { v: "medium", label: "Medium" }, { v: "long", label: "Long" }]} />
              </Field>
            </>
          )}
        </>
      )}

      {a && (
        <label className="block text-[11px] text-[var(--tx3)]">
          Notes for future crews
          <textarea
            value={report.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
            placeholder="Dock level, concierge steps, elevator bank, fob rules"
            className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-white px-2.5 py-2 text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
        </label>
      )}
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
            { location: "pickup", address: pickupAddr, lat: fromLat ?? lat ?? null, lng: fromLng ?? lng ?? null, ...pickupReport },
            { location: "dropoff", address: dropoffAddr, lat: toLat ?? null, lng: toLng ?? null, ...dropoffReport },
          ]
        : [
            { location: "dropoff", address: dropoffAddr || pickupAddr, lat: toLat ?? lat ?? null, lng: toLng ?? lng ?? null, ...dropoffReport },
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

  const pickupReady = !hasBothLocations || pickupReport.archetype != null;
  const dropoffReady = dropoffReport.archetype != null;

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
            Pick the building type, then a few quick taps. Helps the next crew and our quotes.
          </p>
        </div>
      </div>

      {hasBothLocations && step === "pickup" && (
        <>
          <LocationForm label="Pickup location" address={pickupAddr} report={pickupReport} onChange={setPickupReport} />
          <button
            type="button"
            onClick={() => setStep("dropoff")}
            disabled={!pickupReady}
            className="crew-premium-cta w-full py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Next: Drop-off location <ArrowRight size={14} weight="bold" />
          </button>
        </>
      )}

      {(!hasBothLocations || step === "dropoff") && (
        <>
          <LocationForm
            label={hasBothLocations ? "Drop-off location" : "Location"}
            address={hasBothLocations ? dropoffAddr : dropoffAddr || pickupAddr}
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
              disabled={saving || !dropoffReady}
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
