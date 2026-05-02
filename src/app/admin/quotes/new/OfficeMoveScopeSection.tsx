"use client";

import React, { useMemo } from "react";
import { Check as CheckIcon } from "@phosphor-icons/react";
import {
  describeOfficeMoveScopeAutoReason,
  detectOfficeDays,
} from "@/lib/quotes/office-move-scope";

function cfgNum(config: Record<string, string>, key: string, fallback: number) {
  const v = config[key];
  return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback;
}

type Props = {
  workstationsTotal: number;
  squareFootageStr: string;
  serverRoom: boolean;
  scheduleLabel: string;
  afterHoursContext: boolean;
  extraPickupStopCount: number;
  extraDropoffStopCount: number;
  daysOverride: number | null;
  onDaysOverrideChange: (next: number | null) => void;
  additionalMoveDay: boolean;
  onAdditionalMoveDayChange: (next: boolean) => void;
  config: Record<string, string>;
  onToggleMultiPickup: (next: boolean) => void;
  onToggleMultiDelivery: (next: boolean) => void;
};

export default function OfficeMoveScopeSection({
  workstationsTotal,
  squareFootageStr,
  serverRoom,
  scheduleLabel,
  afterHoursContext,
  extraPickupStopCount,
  extraDropoffStopCount,
  daysOverride,
  onDaysOverrideChange,
  additionalMoveDay,
  onAdditionalMoveDayChange,
  config,
  onToggleMultiPickup,
  onToggleMultiDelivery,
}: Props) {
  const sqftParsed = Number(String(squareFootageStr ?? "").trim());
  const sqftSafe = Number.isFinite(sqftParsed) ? Math.max(0, sqftParsed) : 0;

  const detectionInput = useMemo(
    () => ({
      workstations: workstationsTotal,
      square_footage: sqftSafe || undefined,
      server_room: serverRoom,
      schedule: scheduleLabel,
    }),
    [workstationsTotal, sqftSafe, serverRoom, scheduleLabel],
  );

  const autoDetectedDays = useMemo(
    () => detectOfficeDays(detectionInput),
    [detectionInput],
  );
  const detectedReason = useMemo(
    () => describeOfficeMoveScopeAutoReason(detectionInput),
    [detectionInput],
  );

  const autoWithExtra = Math.min(
    14,
    Math.max(
      autoDetectedDays + (additionalMoveDay ? 1 : 0),
      1,
    ),
  );

  const effectiveDays = daysOverride ?? autoWithExtra;
  const dayRate = cfgNum(config, "multi_day_rate", 850);
  const extraBillableDays = Math.max(0, effectiveDays - 1);

  const multiPickupChecked = extraPickupStopCount > 0;
  const multiDeliveryChecked = extraDropoffStopCount > 0;

  type RowVm = {
    key: string;
    checked: boolean;
    toggleable?: boolean;
    title: string;
    dayNote: string;
    amountNote: string;
  };

  const rows: RowVm[] = [
    {
      key: "base",
      checked: true,
      title: "Moving day(s)",
      dayNote: "Base relocation",
      amountNote: "Workstation-led pricing carries the relocation core.",
    },
    {
      key: "it",
      checked: serverRoom,
      title: "IT / server migration",
      dayNote: serverRoom ? "+1 day in scope" : "Optional signal",
      amountNote: `When included, coordinators often plan +1 day · $${dayRate.toLocaleString("en-CA")} per day (default rate)`,
    },
    {
      key: "after",
      checked: afterHoursContext,
      title: "After-hours work",
      dayNote: "Rates",
      amountNote:
        afterHoursContext
          ? "Evening or weekend multiplier already applies via schedule selections."
          : "Use schedule above for evenings and weekends.",
    },
    {
      key: "disassembly",
      checked: workstationsTotal >= 15,
      title: "Furniture disassembly",
      dayNote: "Handling",
      amountNote:
        "Included when workstations need teardown and rebuild at destination.",
    },
    {
      key: "additional",
      checked: additionalMoveDay,
      toggleable: true,
      title: "Additional move day",
      dayNote: additionalMoveDay ? "+1 day" : "+1 day if selected",
      amountNote: `Large offices or phased handoffs · $${dayRate.toLocaleString("en-CA")} per day (default rate)`,
    },
  ];

  return (
    <div className="border-t border-[var(--brd)]/30 pt-5 space-y-4">
      <div>
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Move scope
        </h3>
        <p className="text-[10px] text-[var(--tx3)] mt-1 max-w-xl leading-snug">
          Day counts help coordinators align expectations before move creation.
          Detailed crew and routing stay on Create move.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-3">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Days needed
            </p>
            <p className="text-[11px] text-[var(--tx)] mt-1">
              Auto-detected:{" "}
              <span className="font-semibold">{detectedReason}</span>
              {daysOverride != null && (
                <span className="text-[var(--tx3)]">
                  {" "}
                  · Stored: {effectiveDays} days
                </span>
              )}
            </p>
            {additionalMoveDay && daysOverride == null && (
              <p className="text-[10px] text-[var(--tx3)] mt-1">
                Working total {autoWithExtra} days before manual override.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center justify-end">
            {([1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`min-w-[2rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border ${
                  daysOverride === n
                    ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)]"
                    : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"
                }`}
                onClick={() =>
                  onDaysOverrideChange(daysOverride === n ? null : n)
                }
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={`min-w-[2.75rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border ${
                daysOverride != null && daysOverride >= 5
                  ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)]"
                  : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"
              }`}
              onClick={() =>
                onDaysOverrideChange(
                  daysOverride != null && daysOverride >= 5 ? null : 5,
                )
              }
            >
              5+
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--brd)]/40 pt-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
            What&apos;s included in this relocation
          </p>
          <ul className="space-y-2" aria-label="Office move scope line items">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex gap-3 text-[11px] text-[var(--tx)] leading-snug"
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    row.checked
                      ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]"
                      : "border-[var(--brd)] bg-[var(--card)] text-transparent"
                  }`}
                >
                  <CheckIcon className="h-3 w-3" weight="bold" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{row.title}</span>
                    <span className="text-[10px] text-[var(--tx3)]">
                      {row.dayNote}
                    </span>
                    {row.toggleable && (
                      <button
                        type="button"
                        className={`text-[9px] font-bold uppercase tracking-wide underline-offset-2 ${
                          additionalMoveDay ? "underline" : "hover:underline"
                        }`}
                        onClick={() =>
                          onAdditionalMoveDayChange(!additionalMoveDay)
                        }
                      >
                        {additionalMoveDay ? "Remove day" : "Add day"}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                    {row.amountNote}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[var(--brd)]/40 pt-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
            Multi-location
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1 rounded border-[var(--brd)]"
                checked={multiPickupChecked}
                onChange={(e) => onToggleMultiPickup(e.target.checked)}
              />
              <span>
                <span className="text-[11px] font-semibold text-[var(--tx)] block">
                  Multiple pickup locations
                </span>
                <span className="text-[10px] text-[var(--tx3)] leading-snug">
                  Uses add another from address above.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1 rounded border-[var(--brd)]"
                checked={multiDeliveryChecked}
                onChange={(e) => onToggleMultiDelivery(e.target.checked)}
              />
              <span>
                <span className="text-[11px] font-semibold text-[var(--tx)] block">
                  Multiple delivery locations
                </span>
                <span className="text-[10px] text-[var(--tx3)] leading-snug">
                  Uses add another to address above.
                </span>
              </span>
            </label>
          </div>
        </div>

        {extraBillableDays > 0 && (
          <div className="border-t border-[var(--brd)]/40 pt-3 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Multi-day reference (defaults)
            </p>
            <p className="text-[10px] text-[var(--tx3)]">
              Coordinators estimate {extraBillableDays} extra day
              {extraBillableDays === 1 ? "" : "s"} beyond the primary move window
              at ${dayRate.toLocaleString("en-CA")} per day before tax.
              Final totals still follow workstation pricing unless you attach a written plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
