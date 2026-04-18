"use client";

import React, { useEffect, useMemo } from "react";
import { Plus, Trash, CaretDown, CaretRight } from "@phosphor-icons/react";
import type { MoveProjectPayload, MoveProjectPhaseInput, MoveProjectDayInput } from "@/lib/move-projects/schema";
import { computeMoveProjectPricingPreview, priceFromCostAndMargin } from "@/lib/move-projects/pricing";
import { autoGenerateResidentialProjectPhases } from "@/lib/move-projects/auto-schedule";

const TRUCK_OPTS = ["", "sprinter", "16ft", "20ft", "26ft"] as const;
const PHASE_TYPES = ["pack", "load", "transport", "unload", "unpack", "stage", "install", "cleanup", "custom"] as const;
const DAY_TYPES = ["pack", "move", "unpack", "install", "custom"] as const;
const MULTI_HOME = [
  { value: "" as const, label: "Not multi-home" },
  { value: "consolidation" as const, label: "Consolidation (2+ homes to one)" },
  { value: "split" as const, label: "Split (one home to 2+ destinations)" },
  { value: "multi_stop" as const, label: "Multi-stop pickups" },
  { value: "seasonal" as const, label: "Seasonal / secondary home" },
] as const;

const OFFICE_PHASE = [
  { value: "all_at_once" as const, label: "All at once (weekend blitz)" },
  { value: "floor_by_floor" as const, label: "Floor by floor" },
  { value: "department_by_department" as const, label: "Department by department" },
  { value: "custom" as const, label: "Custom phasing" },
] as const;

function fieldInputCls() {
  return "w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] text-[var(--tx)] placeholder:text-[var(--tx3)]";
}

function labelCls() {
  return "text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]";
}

export function buildDefaultMoveProjectPayload(args: {
  clientName: string;
  fromAddress: string;
  toAddress: string;
  fromAccess: string;
  toAccess: string;
  moveDate: string;
  serviceType: string;
  workstationCount: number;
  companyName?: string;
  officeEstHours?: number;
}): MoveProjectPayload {
  const start = args.moveDate?.trim() || new Date().toISOString().slice(0, 10);
  const isOffice = args.serviceType === "office_move";
  const projectType = isOffice
    ? args.workstationCount >= 50
      ? "office_large"
      : "office_standard"
    : "residential_estate";
  const day: MoveProjectDayInput = {
    day_number: 1,
    date: start,
    day_type: isOffice ? "move" : "move",
    label: isOffice ? "Relocation day" : "Move day",
    description: "",
    crew_size: isOffice ? 4 : 3,
    truck_count: 1,
    truck_type: "26ft",
    estimated_hours: isOffice ? Number(args.officeEstHours ?? 8) || 8 : 8,
    origin_address: args.fromAddress,
    destination_address: args.toAddress,
  };
  if (!Number.isFinite(day.estimated_hours)) day.estimated_hours = 8;

  const phase: MoveProjectPhaseInput = {
    phase_number: 1,
    phase_name: isOffice ? "Office relocation" : "Main move",
    phase_type: isOffice ? "custom" : "move",
    days: [day],
  };

  return {
    project_name: args.clientName.trim() || (isOffice ? args.companyName?.trim() || "Office relocation" : "Estate move"),
    project_type: projectType,
    start_date: start,
    total_days: 1,
    origins: [
      {
        address: args.fromAddress || "Origin address",
        access: args.fromAccess || undefined,
        label: "Primary origin",
      },
    ],
    destinations: [
      {
        address: args.toAddress || "Destination address",
        access: args.toAccess || undefined,
        label: "Primary destination",
      },
    ],
    phases: [phase],
    payment_schedule: [],
    office_profile: isOffice
      ? {
          company_name: args.companyName?.trim() || undefined,
          workstation_count: args.workstationCount || undefined,
          current_address: args.fromAddress || undefined,
          new_address: args.toAddress || undefined,
          phasing_strategy: "floor_by_floor",
        }
      : undefined,
  };
}

const RES_MOVE_SIZES = [
  { value: "", label: "Same as quote" },
  { value: "studio", label: "Studio" },
  { value: "1br", label: "1 bedroom" },
  { value: "2br", label: "2 bedroom" },
  { value: "3br", label: "3 bedroom" },
  { value: "4br", label: "4 bedroom" },
  { value: "5br_plus", label: "5+ bedroom" },
  { value: "partial", label: "Partial" },
] as const;

type Props = {
  value: MoveProjectPayload | null;
  onChange: (next: MoveProjectPayload) => void;
  clientName: string;
  fromAddress: string;
  toAddress: string;
  fromAccess: string;
  toAccess: string;
  moveDate: string;
  serviceType: string;
  workstationCount: number;
  companyName?: string;
  officeEstHours?: number;
  labourRateHint?: number;
  marginTargetPct?: number;
  quoteFactors?: Record<string, unknown> | null;
  /** Primary move size from the quote form (drives auto-schedule defaults). */
  primaryMoveSize?: string;
  /** Per-pickup inventory score totals (labour weight), for buffer-day heuristic. */
  inventoryScoresByOrigin?: number[];
};

export default function MoveProjectPlannerSection({
  value,
  onChange,
  clientName,
  fromAddress,
  toAddress,
  fromAccess,
  toAccess,
  moveDate,
  serviceType,
  workstationCount,
  companyName,
  officeEstHours = 8,
  labourRateHint = 55,
  marginTargetPct = 45,
  quoteFactors,
  primaryMoveSize = "2br",
  inventoryScoresByOrigin = [],
}: Props) {
  const p = value;
  const previewFromQuote = quoteFactors?.move_project_pricing_preview as
    | {
        total_cost_estimate?: number;
        lines?: { label: string; amount: number }[];
        suggested_pre_tax_at_estate_margin?: number;
      }
    | undefined;

  const localPreview = useMemo(() => {
    if (!p) return null;
    return computeMoveProjectPricingPreview(p, {
      labourRatePerMoverHour: labourRateHint,
      truckDayRate: 135,
      fuelFlat: 45,
      workstationRatePerSeat: 85,
      serverRoomFlat: 2500,
      boardroomFlatEach: 600,
      breakRoomFlat: 800,
      receptionFlat: 600,
    });
  }, [p, labourRateHint]);

  const scheduleSummary = useMemo(() => {
    if (!value) {
      return {
        dayRows: 0,
        crewDays: 0,
        estHours: 0,
        originCount: 0,
      };
    }
    let dayRows = 0;
    let crewDays = 0;
    let estHours = 0;
    for (const ph of value.phases) {
      for (const d of ph.days) {
        dayRows += 1;
        crewDays += Number(d.crew_size ?? 0);
        estHours += Number(d.estimated_hours ?? 0);
      }
    }
    return {
      dayRows,
      crewDays,
      estHours,
      originCount: value.origins.length,
    };
  }, [value]);

  useEffect(() => {
    if (!p) return;
    const n = p.phases.reduce((acc, ph) => acc + ph.days.length, 0);
    const td = Math.max(1, n);
    if (p.total_days !== td) {
      onChange({ ...p, total_days: td });
    }
  }, [p, onChange]);

  if (!p) return null;

  const updatePhase = (idx: number, patch: Partial<MoveProjectPhaseInput>) => {
    const phases = [...p.phases];
    phases[idx] = { ...phases[idx]!, ...patch };
    onChange({ ...p, phases });
  };

  const updateDay = (pi: number, di: number, patch: Partial<MoveProjectDayInput>) => {
    const phases = p.phases.map((ph, i) => {
      if (i !== pi) return ph;
      const days = ph.days.map((d, j) => (j === di ? { ...d, ...patch } : d));
      return { ...ph, days };
    });
    onChange({ ...p, phases });
  };

  const addPhase = () => {
    const nextNum = p.phases.length + 1;
    const lastDate =
      p.phases.flatMap((x) => x.days).sort((a, b) => a.date.localeCompare(b.date)).pop()?.date || p.start_date;
    const d = new Date(lastDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    onChange({
      ...p,
      phases: [
        ...p.phases,
        {
          phase_number: nextNum,
          phase_name: `Phase ${nextNum}`,
          phase_type: "custom",
          days: [
            {
              day_number: 1,
              date: iso,
              day_type: "custom",
              label: `Day ${nextNum}`,
              crew_size: 2,
              truck_count: 1,
              estimated_hours: 6,
            },
          ],
        },
      ],
    });
  };

  const removePhase = (idx: number) => {
    if (p.phases.length <= 1) return;
    onChange({ ...p, phases: p.phases.filter((_, i) => i !== idx) });
  };

  const addDay = (pi: number) => {
    const ph = p.phases[pi]!;
    const last = ph.days[ph.days.length - 1];
    const base = last?.date || p.start_date;
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const nextDay: MoveProjectDayInput = {
      day_number: ph.days.length + 1,
      date: iso,
      day_type: "custom",
      label: `Day ${ph.days.length + 1}`,
      crew_size: last?.crew_size ?? 3,
      truck_count: 1,
      truck_type: last?.truck_type ?? "26ft",
      estimated_hours: last?.estimated_hours ?? 7,
      origin_address: last?.origin_address,
      destination_address: last?.destination_address,
    };
    updatePhase(pi, { days: [...ph.days, nextDay] });
  };

  const removeDay = (pi: number, di: number) => {
    const ph = p.phases[pi]!;
    if (ph.days.length <= 1) return;
    updatePhase(pi, { days: ph.days.filter((_, j) => j !== di) });
  };

  const updateOrigin = (
    i: number,
    patch: Partial<{
      address: string;
      access: string;
      label: string;
      parking: string;
      floor: string;
      unit: string;
      is_partial: boolean;
      move_size: string;
    }>,
  ) => {
    const origins = p.origins.map((o, j) => (j === i ? { ...o, ...patch } : o));
    onChange({ ...p, origins });
  };

  const addOrigin = () => {
    onChange({ ...p, origins: [...p.origins, { address: "", label: `Origin ${p.origins.length + 1}` }] });
  };

  const removeOrigin = (i: number) => {
    if (p.origins.length <= 1) return;
    onChange({ ...p, origins: p.origins.filter((_, j) => j !== i) });
  };

  const updateDest = (
    i: number,
    patch: Partial<{
      address: string;
      access: string;
      label: string;
      parking: string;
      floor: string;
      unit: string;
    }>,
  ) => {
    const destinations = p.destinations.map((o, j) => (j === i ? { ...o, ...patch } : o));
    onChange({ ...p, destinations });
  };

  const handleAutoGenerateSchedule = () => {
    const phases = autoGenerateResidentialProjectPhases({
      payload: p,
      primaryMoveSize: primaryMoveSize || "2br",
      inventoryScoresByOrigin,
    });
    onChange({ ...p, phases, start_date: p.start_date });
  };

  const applyDayLocation = (pi: number, di: number, raw: string) => {
    const [kind, idxStr] = raw.split(":");
    const idx = Number(idxStr);
    if (!Number.isFinite(idx)) return;
    const primaryDest = p.destinations[0]?.address?.trim();
    const primaryOrig = p.origins[0]?.address?.trim();
    if (kind === "o") {
      const o = p.origins[idx]?.address?.trim();
      updateDay(pi, di, {
        origin_address: o || null,
        destination_address: primaryDest || null,
      });
    } else if (kind === "d") {
      const d = p.destinations[idx]?.address?.trim();
      updateDay(pi, di, {
        destination_address: d || null,
        origin_address: primaryOrig || null,
      });
    }
  };

  const addDest = () => {
    onChange({
      ...p,
      destinations: [...p.destinations, { address: "", label: `Destination ${p.destinations.length + 1}` }],
    });
  };

  const removeDest = (i: number) => {
    if (p.destinations.length <= 1) return;
    onChange({ ...p, destinations: p.destinations.filter((_, j) => j !== i) });
  };

  const isOffice = serviceType === "office_move";

  return (
    <div className="space-y-4 border border-[var(--brd)] rounded-xl bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">Multi-day move planner</p>
          <p className="text-[11px] text-[var(--tx2)] mt-1">
            Build phases and days for this quote. Saved with the quote for the client timeline and admin projects.
          </p>
        </div>
      </div>

      <div>
        <p className={labelCls()}>Project name</p>
        <input
          className={`${fieldInputCls()} mt-1`}
          value={p.project_name}
          onChange={(e) => onChange({ ...p, project_name: e.target.value })}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <p className={labelCls()}>Project type</p>
          <select
            className={`${fieldInputCls()} mt-1`}
            value={p.project_type}
            onChange={(e) => onChange({ ...p, project_type: e.target.value })}
          >
            <option value="residential_standard">Residential standard (1–2 days)</option>
            <option value="residential_estate">Residential estate (2–3 days)</option>
            <option value="residential_large">Residential large (4+ days)</option>
            <option value="residential_multi_home">Residential multi-home</option>
            <option value="office_standard">Office standard (1–3 days)</option>
            <option value="office_large">Office large (4+ days)</option>
            <option value="office_phased">Office phased</option>
            <option value="commercial">Commercial / specialty</option>
          </select>
        </div>
        {!isOffice && (
          <div>
            <p className={labelCls()}>Multi-home type</p>
            <select
              className={`${fieldInputCls()} mt-1`}
              value={p.multi_home_move_type ?? ""}
              onChange={(e) =>
                onChange({
                  ...p,
                  multi_home_move_type: e.target.value ? (e.target.value as MoveProjectPayload["multi_home_move_type"]) : null,
                })
              }
            >
              {MULTI_HOME.map((m) => (
                <option key={m.value || "none"} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isOffice && (
        <div className="rounded-lg border border-[var(--brd)]/80 p-3 space-y-2 bg-[var(--bg2)]/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]">Office details</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <p className={labelCls()}>Company</p>
              <input
                className={`${fieldInputCls()} mt-1`}
                value={(p.office_profile?.company_name as string) || companyName || ""}
                onChange={(e) =>
                  onChange({
                    ...p,
                    office_profile: { ...p.office_profile, company_name: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <p className={labelCls()}>Workstations</p>
              <input
                type="number"
                min={0}
                className={`${fieldInputCls()} mt-1`}
                value={(p.office_profile?.workstation_count as number) ?? workstationCount ?? ""}
                onChange={(e) =>
                  onChange({
                    ...p,
                    office_profile: {
                      ...p.office_profile,
                      workstation_count: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <p className={labelCls()}>Phasing strategy</p>
              <select
                className={`${fieldInputCls()} mt-1`}
                value={(p.office_profile?.phasing_strategy as string) || "floor_by_floor"}
                onChange={(e) =>
                  onChange({
                    ...p,
                    office_profile: {
                      ...p.office_profile,
                      phasing_strategy: e.target.value as (typeof OFFICE_PHASE)[number]["value"],
                    },
                  })
                }
              >
                {OFFICE_PHASE.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 items-center pt-4">
              {(
                [
                  ["server_room", "Server room"],
                  ["break_room", "Break room"],
                  ["reception", "Reception"],
                ] as const
              ).map(([k, lab]) => (
                <label key={k} className="flex items-center gap-2 text-[11px] text-[var(--tx)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(p.office_profile?.[k])}
                    onChange={(e) =>
                      onChange({
                        ...p,
                        office_profile: { ...p.office_profile, [k]: e.target.checked },
                      })
                    }
                  />
                  {lab}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <p className={labelCls()}>Origins</p>
        <div className="mt-2 space-y-3">
          {p.origins.map((o, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--brd)]/90 bg-[var(--bg2)]/20 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gdim)] text-[10px] font-bold text-[var(--tx)]">
                    {i + 1}
                  </span>
                  <input
                    className={`${fieldInputCls()} flex-1 min-w-[120px] border-none bg-transparent font-semibold`}
                    placeholder={`Label (e.g. Primary pickup)`}
                    value={o.label ?? ""}
                    onChange={(e) => updateOrigin(i, { label: e.target.value })}
                  />
                </div>
                {p.origins.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOrigin(i)}
                    className="p-1.5 text-[var(--tx3)] hover:text-red-600"
                    aria-label="Remove origin"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                className={fieldInputCls()}
                placeholder="Address"
                value={o.address}
                onChange={(e) => updateOrigin(i, { address: e.target.value })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className={fieldInputCls()}
                  placeholder="Access (stairs, elevator)"
                  value={o.access ?? ""}
                  onChange={(e) => updateOrigin(i, { access: e.target.value })}
                />
                <select
                  className={fieldInputCls()}
                  value={o.parking ?? ""}
                  onChange={(e) => updateOrigin(i, { parking: e.target.value })}
                >
                  <option value="">Parking</option>
                  <option value="dedicated">Dedicated / loading dock</option>
                  <option value="street">Street parking</option>
                  <option value="no_parking">No dedicated parking</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={fieldInputCls()}
                  placeholder="Floor"
                  value={o.floor ?? ""}
                  onChange={(e) => updateOrigin(i, { floor: e.target.value })}
                />
                <input
                  className={fieldInputCls()}
                  placeholder="Unit"
                  value={o.unit ?? ""}
                  onChange={(e) => updateOrigin(i, { unit: e.target.value })}
                />
              </div>
              {!isOffice && (
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    className={fieldInputCls()}
                    value={o.move_size ?? ""}
                    onChange={(e) => updateOrigin(i, { move_size: e.target.value })}
                  >
                    {RES_MOVE_SIZES.map((s) => (
                      <option key={s.value || "same"} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--tx)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={o.is_partial === true}
                      onChange={(e) => updateOrigin(i, { is_partial: e.target.checked })}
                    />
                    Partial pickup
                  </label>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOrigin}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu-accent)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add origin
          </button>
        </div>
      </div>

      <div>
        <p className={labelCls()}>Destinations</p>
        <div className="mt-2 space-y-2">
          {p.destinations.map((o, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 items-start">
              <input
                className={fieldInputCls()}
                placeholder="Address"
                value={o.address}
                onChange={(e) => updateDest(i, { address: e.target.value })}
              />
              <input
                className={`${fieldInputCls()} sm:w-36`}
                placeholder="Access"
                value={o.access ?? ""}
                onChange={(e) => updateDest(i, { access: e.target.value })}
              />
              <input
                className={`${fieldInputCls()} sm:w-36`}
                placeholder="Label"
                value={o.label ?? ""}
                onChange={(e) => updateDest(i, { label: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeDest(i)}
                className="p-2 text-[var(--tx3)] hover:text-red-600"
                aria-label="Remove destination"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addDest}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu-accent)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add destination
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <p className={labelCls()}>Start date</p>
          <input
            type="date"
            className={`${fieldInputCls()} mt-1 w-auto`}
            value={p.start_date}
            onChange={(e) => onChange({ ...p, start_date: e.target.value })}
          />
        </div>
        <div>
          <p className={labelCls()}>End date (optional)</p>
          <input
            type="date"
            className={`${fieldInputCls()} mt-1 w-auto`}
            value={p.end_date ?? ""}
            onChange={(e) => onChange({ ...p, end_date: e.target.value || null })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">Schedule</p>
        <div className="flex flex-wrap items-center gap-2">
          {!isOffice && (
            <button
              type="button"
              onClick={handleAutoGenerateSchedule}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--brd)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tx)] hover:bg-[var(--gdim)]"
            >
              Auto-generate schedule
            </button>
          )}
          <button
            type="button"
            onClick={addPhase}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--brd)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tx)] hover:bg-[var(--gdim)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add phase
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {p.phases.map((ph, pi) => (
          <div key={pi} className="rounded-lg border border-[var(--brd)]/90 p-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[140px]">
                <p className={labelCls()}>Phase name</p>
                <input
                  className={`${fieldInputCls()} mt-1`}
                  value={ph.phase_name}
                  onChange={(e) => updatePhase(pi, { phase_name: e.target.value })}
                />
              </div>
              <div className="w-full sm:w-36">
                <p className={labelCls()}>Type</p>
                <select
                  className={`${fieldInputCls()} mt-1`}
                  value={ph.phase_type}
                  onChange={(e) => updatePhase(pi, { phase_type: e.target.value })}
                >
                  {PHASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removePhase(pi)}
                className="p-2 text-[var(--tx3)] hover:text-red-600"
                aria-label="Remove phase"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 pl-2 border-l-2 border-[var(--brd)]/60">
              {ph.days.map((day, di) => (
                <div key={di} className="rounded-md bg-[var(--bg2)]/30 p-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      className={`${fieldInputCls()} w-auto`}
                      value={day.date}
                      onChange={(e) => updateDay(pi, di, { date: e.target.value })}
                    />
                    <select
                      className={`${fieldInputCls()} w-auto min-w-[100px]`}
                      value={day.day_type}
                      onChange={(e) => updateDay(pi, di, { day_type: e.target.value })}
                    >
                      {DAY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`${fieldInputCls()} flex-1 min-w-[120px]`}
                      placeholder="Label"
                      value={day.label}
                      onChange={(e) => updateDay(pi, di, { label: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeDay(pi, di)}
                      className="p-1.5 text-[var(--tx3)]"
                      aria-label="Remove day"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className={fieldInputCls()}
                    placeholder="Description"
                    value={day.description ?? ""}
                    onChange={(e) => updateDay(pi, di, { description: e.target.value })}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <p className={labelCls()}>Crew</p>
                      <input
                        type="number"
                        min={1}
                        className={`${fieldInputCls()} mt-1`}
                        value={day.crew_size}
                        onChange={(e) => updateDay(pi, di, { crew_size: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <p className={labelCls()}>Hours</p>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className={`${fieldInputCls()} mt-1`}
                        value={day.estimated_hours ?? ""}
                        onChange={(e) =>
                          updateDay(pi, di, {
                            estimated_hours: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <p className={labelCls()}>Truck</p>
                      <select
                        className={`${fieldInputCls()} mt-1`}
                        value={day.truck_type ?? ""}
                        onChange={(e) => updateDay(pi, di, { truck_type: e.target.value || null })}
                      >
                        {TRUCK_OPTS.map((t) => (
                          <option key={t || "none"} value={t}>
                            {t || "—"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className={labelCls()}>Trucks</p>
                      <input
                        type="number"
                        min={1}
                        className={`${fieldInputCls()} mt-1`}
                        value={day.truck_count}
                        onChange={(e) => updateDay(pi, di, { truck_count: Number(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <select
                      className={fieldInputCls()}
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) applyDayLocation(pi, di, v);
                        e.target.value = "";
                      }}
                      aria-label="Apply saved stop to this day"
                    >
                      <option value="">Quick fill from stops</option>
                      {p.origins.map((o, oi) => (
                        <option key={`o-${oi}`} value={`o:${oi}`}>
                          Pickup: {o.label || o.address || `Origin ${oi + 1}`}
                        </option>
                      ))}
                      {p.destinations.map((o, di2) => (
                        <option key={`d-${di2}`} value={`d:${di2}`}>
                          Drop-off: {o.label || o.address || `Destination ${di2 + 1}`}
                        </option>
                      ))}
                    </select>
                    <input
                      className={fieldInputCls()}
                      placeholder="Origin (this day)"
                      value={day.origin_address ?? ""}
                      onChange={(e) => updateDay(pi, di, { origin_address: e.target.value || null })}
                    />
                    <input
                      className={fieldInputCls()}
                      placeholder="Destination (this day)"
                      value={day.destination_address ?? ""}
                      onChange={(e) => updateDay(pi, di, { destination_address: e.target.value || null })}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addDay(pi)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--yu-accent)]"
              >
                <CaretRight className="w-3.5 h-3.5" />
                Add day to phase
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)] mb-2">
          Project schedule summary
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--tx3)]">Day rows</p>
            <p className="font-semibold text-[var(--tx)] tabular-nums">{scheduleSummary.dayRows}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--tx3)]">Crew-days</p>
            <p className="font-semibold text-[var(--tx)] tabular-nums">{scheduleSummary.crewDays}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--tx3)]">Est. hours</p>
            <p className="font-semibold text-[var(--tx)] tabular-nums">
              {scheduleSummary.estHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wide text-[var(--tx3)]">Origins</p>
            <p className="font-semibold text-[var(--tx)] tabular-nums">{scheduleSummary.originCount}</p>
          </div>
        </div>
      </div>

      {(previewFromQuote || localPreview) && (
        <div className="rounded-lg border border-[var(--brd)] p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]">Cost preview (coordinator)</p>
          <ul className="text-[11px] text-[var(--tx2)] space-y-1">
            {(previewFromQuote?.lines ?? localPreview?.lines ?? []).map((ln, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{ln.label}</span>
                <span className="text-[var(--tx)] font-medium">${ln.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-[11px] pt-2 border-t border-[var(--brd)]">
            <span className="text-[var(--tx3)]">Total cost estimate</span>
            <span className="font-semibold text-[var(--tx)]">
              $
              {(previewFromQuote?.total_cost_estimate ?? localPreview?.totalCostEstimate ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          {(previewFromQuote?.suggested_pre_tax_at_estate_margin != null || localPreview) && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--tx3)]">Suggested pre-tax ({marginTargetPct}% margin target)</span>
              <span className="font-semibold text-[var(--tx)]">
                $
                {(
                  previewFromQuote?.suggested_pre_tax_at_estate_margin ??
                  priceFromCostAndMargin(localPreview?.totalCostEstimate ?? 0, marginTargetPct / 100)
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-[var(--tx3)]">
        <CaretDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>
          {p.total_days} day{p.total_days === 1 ? "" : "s"} ·{" "}
          {p.phases.reduce((a, ph) => a + ph.days.length, 0)} scheduled day row{p.phases.reduce((a, ph) => a + ph.days.length, 0) === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
