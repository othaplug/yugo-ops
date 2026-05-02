"use client";

import * as React from "react";
import { Plus } from "@phosphor-icons/react";
import { addCalendarDaysIso } from "@/lib/quotes/estate-schedule";
import {
  labelForDayType,
  MOVE_DAY_FORM_DEFAULTS,
} from "@/lib/move-projects/day-types";

export type ResidentialScheduleDraftRow = {
  day: number;
  type: string;
  date: string;
  startTime: string;
  estHours: string;
  crewSize: string;
  crewMemberIds: string[];
  truck: string;
  notes: string;
  packKitchen: boolean;
  packLiving: boolean;
  packBedrooms: boolean;
  packDining: boolean;
  packGarage: boolean;
  packStorage: boolean;
};

export function defaultResidentialDayTypes(dayCount: number): { day: number; type: string }[] {
  const n = Math.max(1, Math.min(14, Math.round(dayCount)));
  return Array.from({ length: n }, (_, i) => ({
    day: i + 1,
    type: i === n - 1 ? "move" : "pack",
  }));
}

const ALLOWED_DAY_TYPES = new Set([
  "pack",
  "move",
  "unpack",
  "crating",
  "volume",
]);

function seededTypeForIndex(
  n: number,
  idx: number,
  seed?: { day: number; type: string }[] | null,
): string {
  const fb = defaultResidentialDayTypes(n)[idx]!;
  const sRow = seed?.find((x) => x.day === idx + 1) ?? seed?.[idx];
  const cand = typeof sRow?.type === "string" ? sRow.type.toLowerCase().trim() : "";
  return ALLOWED_DAY_TYPES.has(cand) ? cand : fb.type;
}

export function reconcileResidentialScheduleRows(opts: {
  anchorDateIso: string;
  estimatedMoveDays: number;
  priorRows: ResidentialScheduleDraftRow[];
  resequenceDates: boolean;
  seedTypes?: { day: number; type: string }[] | null;
}): ResidentialScheduleDraftRow[] {
  const n = Math.max(2, Math.min(14, Math.round(opts.estimatedMoveDays)));
  const anchorsRaw = opts.anchorDateIso?.trim().slice(0, 10) || new Date().toISOString().slice(0, 10);
  const isoOk = /^\d{4}-\d{2}-\d{2}$/.test(anchorsRaw);
  const anchors = isoOk ? anchorsRaw : new Date().toISOString().slice(0, 10);
  const prev = opts.priorRows;

  return Array.from({ length: n }, (_, idx) => {
    const slotDay = idx + 1;
    const matched = prev.find((r) => r.day === slotDay) ?? prev[idx] ?? null;
    const seedDefaultType = seededTypeForIndex(n, idx, opts.seedTypes ?? null);
    const mergedType =
      matched && matched.day === slotDay && matched.type && ALLOWED_DAY_TYPES.has(matched.type)
        ? matched.type
        : seedDefaultType;
    const defs = MOVE_DAY_FORM_DEFAULTS[mergedType] ?? MOVE_DAY_FORM_DEFAULTS.move;

    let dateIso: string;
    if (
      opts.resequenceDates ||
      !matched?.date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(matched.date.trim())
    ) {
      dateIso = addCalendarDaysIso(anchors, idx);
    } else {
      dateIso = matched.date.trim().slice(0, 10);
    }

    return {
      day: slotDay,
      type: mergedType,
      date: dateIso,
      startTime:
        matched && matched.day === slotDay && matched.type === mergedType
          ? matched.startTime || defs.startTime
          : defs.startTime,
      estHours:
        matched && matched.day === slotDay && matched.type === mergedType
          ? matched.estHours || String(defs.hours)
          : String(defs.hours),
      crewSize:
        matched && matched.day === slotDay && matched.type === mergedType
          ? matched.crewSize || String(defs.crewSize)
          : String(defs.crewSize),
      crewMemberIds:
        matched && matched.day === slotDay ? [...matched.crewMemberIds] : [],
      truck:
        matched && matched.day === slotDay && matched.type === mergedType ? matched.truck : defs.truckLabel,
      notes: matched && matched.day === slotDay ? matched.notes : "",
      packKitchen: matched?.packKitchen ?? true,
      packLiving: matched?.packLiving ?? true,
      packBedrooms: matched?.packBedrooms ?? true,
      packDining: matched?.packDining ?? true,
      packGarage: matched?.packGarage ?? false,
      packStorage: matched?.packStorage ?? false,
    };
  });
}

const DAY_TYPE_OPTIONS = [
  { value: "pack", label: "Pack" },
  { value: "move", label: "Move" },
  { value: "unpack", label: "Unpack" },
  { value: "crating", label: "Crating" },
  { value: "volume", label: "Additional move day" },
] as const;

const TRUCK_OPTIONS = ["", "16ft", "20ft", "26ft", "sprinter"];

type CrewMemberOption = { id: string; name: string };

type ResidentialProjectPlannerSectionProps = {
  quoteScopeLoading: boolean;
  linkedQuoteUuid: string | null;
  showPlanner: boolean;
  estimatedMoveDays: number;
  onEstimatedMoveDaysChange: (next: number) => void;
  planMultiDayToggled: boolean;
  onPlanMultiDayToggledChange: (next: boolean) => void;
  rows: ResidentialScheduleDraftRow[];
  onRowsChange: (next: ResidentialScheduleDraftRow[]) => void;
  fromAddress: string;
  toAddress: string;
  crewMembers: CrewMemberOption[];
  fieldInput: string;
};

function formatPlannerHeadingDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return iso;
  const [y, m, d] = iso.trim().split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ResidentialProjectPlannerSection({
  quoteScopeLoading,
  linkedQuoteUuid,
  showPlanner,
  estimatedMoveDays,
  onEstimatedMoveDaysChange,
  planMultiDayToggled,
  onPlanMultiDayToggledChange,
  rows,
  onRowsChange,
  fromAddress,
  toAddress,
  crewMembers,
  fieldInput,
}: ResidentialProjectPlannerSectionProps) {
  const handleToggleCrewMember = React.useCallback(
    (rowIndex: number, memberId: string) => {
      onRowsChange(
        rows.map((r, i) => {
          if (i !== rowIndex) return r;
          const set = new Set(r.crewMemberIds);
          if (set.has(memberId)) set.delete(memberId);
          else set.add(memberId);
          return { ...r, crewMemberIds: [...set] };
        }),
      );
    },
    [onRowsChange, rows],
  );

  const handleAddDay = React.useCallback(() => {
    const nextCount = Math.min(14, estimatedMoveDays + 1);
    onEstimatedMoveDaysChange(nextCount);
  }, [estimatedMoveDays, onEstimatedMoveDaysChange]);

  if (!showPlanner) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--brd)] bg-[var(--bg2)]/35 px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
            Project schedule
          </p>
          <p className="text-[11px] text-[var(--tx3)] mt-1 leading-snug">
            Plan each calendar day below. Saves as linked move project days with crew and trucks.
          </p>
        </div>
        {quoteScopeLoading ? (
          <span className="text-[10px] font-semibold text-[var(--tx3)]">Loading quote scope…</span>
        ) : linkedQuoteUuid ? (
          <span className="text-[10px] font-semibold text-[var(--yu-accent)]">Quote linked</span>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-[var(--tx2)] cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#2C3E2D] shrink-0"
          checked={planMultiDayToggled}
          onChange={(e) => onPlanMultiDayToggledChange(e.target.checked)}
        />
        Customize multi-day project schedule when the booking is quoted as one calendar day
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-[14rem]">
          <label
            htmlFor="est-move-days"
            className="admin-premium-label admin-premium-label--tight mb-1 block"
          >
            Calendar days on job
          </label>
          <input
            id="est-move-days"
            type="number"
            min={planMultiDayToggled ? 2 : 1}
            max={14}
            value={estimatedMoveDays}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isFinite(v)) return;
              let next = Math.max(1, Math.min(14, v));
              if (planMultiDayToggled && next < 2) next = 2;
              onEstimatedMoveDaysChange(next);
            }}
            className={fieldInput}
            aria-label="Estimated calendar days for this move"
          />
        </div>
        <button
          type="button"
          onClick={handleAddDay}
          disabled={estimatedMoveDays >= 14}
          className="inline-flex items-center gap-1 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg2)] disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" weight="bold" aria-hidden />
          Add day
        </button>
      </div>

      {estimatedMoveDays > 1 && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((row, idx) => {
            const dtLabel = formatPlannerHeadingDate(row.date);
            const typeLabel = labelForDayType(row.type);
            const locLabel =
              row.type === "move"
                ? `Pickup: ${fromAddress || "Origin"}\nDelivery: ${toAddress || "Destination"}`
                : row.type === "unpack"
                  ? (toAddress || "Destination") + " (unpack and setup)"
                  : fromAddress || "Origin address";

            return (
              <div
                key={`planner-day-${row.day}-${idx}`}
                className="rounded-md border border-[var(--brd)] bg-[var(--bg)]/60 p-3 space-y-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]">
                  Day {row.day} · {typeLabel} · {dtLabel}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                      Type
                    </label>
                    <select
                      value={row.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        const d = MOVE_DAY_FORM_DEFAULTS[nextType] ?? MOVE_DAY_FORM_DEFAULTS.move;
                        onRowsChange(
                          rows.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  type: nextType,
                                  startTime: d.startTime,
                                  estHours: String(d.hours),
                                  crewSize: String(d.crewSize),
                                  truck: d.truckLabel,
                                }
                              : r,
                          ),
                        );
                      }}
                      className={fieldInput}
                      aria-label={`Day ${row.day} type`}
                    >
                      {DAY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                      Date
                    </label>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        onRowsChange(
                          rows.map((r, i) => (i === idx ? { ...r, date: e.target.value } : r)),
                        )
                      }
                      className={fieldInput}
                      aria-label={`Day ${row.day} date`}
                    />
                  </div>
                  <div>
                    <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) =>
                        onRowsChange(
                          rows.map((r, i) =>
                            i === idx ? { ...r, startTime: e.target.value } : r,
                          ),
                        )
                      }
                      className={fieldInput}
                      aria-label={`Day ${row.day} start time`}
                    />
                  </div>
                  <div>
                    <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                      Est. hours
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.estHours}
                      onChange={(e) =>
                        onRowsChange(
                          rows.map((r, i) =>
                            i === idx ? { ...r, estHours: e.target.value } : r,
                          ),
                        )
                      }
                      className={fieldInput}
                      aria-label={`Day ${row.day} estimated hours`}
                    />
                  </div>
                  <div>
                    <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                      Crew size
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={row.crewSize}
                      onChange={(e) =>
                        onRowsChange(
                          rows.map((r, i) =>
                            i === idx ? { ...r, crewSize: e.target.value } : r,
                          ),
                        )
                      }
                      className={fieldInput}
                      aria-label={`Day ${row.day} crew size`}
                    />
                  </div>
                  <div>
                    <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                      Truck
                    </label>
                    <select
                      value={row.truck}
                      onChange={(e) =>
                        onRowsChange(
                          rows.map((r, i) => (i === idx ? { ...r, truck: e.target.value } : r)),
                        )
                      }
                      className={fieldInput}
                      aria-label={`Day ${row.day} truck`}
                    >
                      <option value="">None: packing-only / crew only</option>
                      {TRUCK_OPTIONS.filter(Boolean).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                    Assign crew members
                  </label>
                  <div
                    className="flex flex-wrap gap-2 p-2 border border-[var(--brd)] bg-[var(--bg2)]/40 max-h-[7rem] overflow-y-auto rounded-sm"
                    role="group"
                    aria-label={`Day ${row.day} crew`}
                  >
                    {crewMembers.length === 0 ? (
                      <span className="text-[11px] text-[var(--tx3)]">
                        Loading crew roster…
                      </span>
                    ) : (
                      crewMembers.map((m) => (
                        <label
                          key={m.id}
                          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tx2)] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-[#2C3E2D] shrink-0"
                            checked={row.crewMemberIds.includes(m.id)}
                            onChange={() => handleToggleCrewMember(idx, m.id)}
                          />
                          {m.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                    Location snapshot
                  </label>
                  <p className="text-[11px] text-[var(--tx2)] whitespace-pre-wrap leading-snug rounded-sm border border-[var(--brd)] bg-[var(--bg2)]/35 px-2 py-1.5">
                    {locLabel}
                  </p>
                </div>

                <div>
                  <label className="admin-premium-label admin-premium-label--tight mb-1 block">
                    Notes
                  </label>
                  <textarea
                    value={row.notes}
                    onChange={(e) =>
                      onRowsChange(
                        rows.map((r, i) => (i === idx ? { ...r, notes: e.target.value } : r)),
                      )
                    }
                    rows={2}
                    className={fieldInput}
                    placeholder="Instructions for dispatch and crew…"
                  />
                </div>

                {row.type === "pack" && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">
                      Packing checklist plan
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[var(--tx2)]">
                      {[
                        ["packKitchen", "Kitchen"],
                        ["packLiving", "Living room"],
                        ["packBedrooms", "Bedrooms"],
                        ["packDining", "Dining"],
                        ["packGarage", "Garage"],
                        ["packStorage", "Storage"],
                      ].map(([key, lbl]) => (
                        <label key={key} className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-[#2C3E2D] shrink-0"
                            checked={Boolean(row[key as keyof ResidentialScheduleDraftRow])}
                            onChange={(e) =>
                              onRowsChange(
                                rows.map((r, i) =>
                                  i === idx ? { ...r, [key]: e.target.checked } : r,
                                ),
                              )
                            }
                          />
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
