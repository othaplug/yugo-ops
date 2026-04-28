"use client";

import React, { useMemo } from "react";
import {
  computeMoveScopeAddonPreTax,
  detectDayCount,
} from "@/lib/quotes/move-scope";

function configRecordToMap(config: Record<string, string>) {
  return new Map(Object.entries(config));
}

function tierScope(recommendedTier: string): "essential" | "signature" | "estate" {
  const t = recommendedTier.toLowerCase().trim();
  if (t === "estate") return "estate";
  if (t === "essential") return "essential";
  return "signature";
}

type Props = {
  recommendedTier: string;
  moveSize: string;
  specialtyItems: { type: string; qty: number }[];
  cratingRequired: boolean;
  addonSlugs: string[];
  extraPickupStopCount: number;
  extraDropoffStopCount: number;
  moveScopeDaysOverride: number | null;
  onDaysOverrideChange: (next: number | null) => void;
  config: Record<string, string>;
};

export default function MoveScopeSection({
  recommendedTier,
  moveSize,
  specialtyItems,
  cratingRequired,
  addonSlugs,
  extraPickupStopCount,
  extraDropoffStopCount,
  moveScopeDaysOverride,
  onDaysOverrideChange,
  config,
}: Props) {
  const tierNorm = tierScope(recommendedTier);

  const detectedDays = useMemo(
    () =>
      detectDayCount({
        tier: tierNorm,
        move_size: moveSize || "2br",
        specialty_items: specialtyItems,
        crating_required: cratingRequired,
        addon_slugs: addonSlugs,
      }),
    [tierNorm, moveSize, specialtyItems, cratingRequired, addonSlugs],
  );

  const scopePreview = useMemo(
    () =>
      computeMoveScopeAddonPreTax(configRecordToMap(config), {
        tier: tierNorm,
        move_size: moveSize || "2br",
        specialty_items: specialtyItems,
        crating_required: cratingRequired,
        addon_slugs: addonSlugs,
        estimated_days_override: moveScopeDaysOverride,
      }),
    [
      config,
      tierNorm,
      moveSize,
      specialtyItems,
      cratingRequired,
      addonSlugs,
      moveScopeDaysOverride,
    ],
  );

  const multiStopNote =
    extraPickupStopCount > 0 || extraDropoffStopCount > 0;

  return (
    <div className="border-t border-[var(--brd)]/30 pt-5 space-y-4">
      <div>
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Move scope
        </h3>
        <p className="text-[10px] text-[var(--tx3)] mt-1 max-w-xl leading-snug">
          Day counts follow tier, inventory, and add-ons. Override total days when the schedule differs before move creation.
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
              <span className="font-semibold">{detectedDays} days</span>
              {moveScopeDaysOverride != null && (
                <span className="text-[var(--tx3)]">
                  {" "}
                  · Stored: {scopePreview.effectiveDays} days
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center justify-end">
            {([1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`min-w-[2rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border ${moveScopeDaysOverride === n ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)]" : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"}`}
                onClick={() =>
                  onDaysOverrideChange(moveScopeDaysOverride === n ? null : n)
                }
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={`min-w-[2.75rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border ${moveScopeDaysOverride != null && moveScopeDaysOverride >= 5 ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)]" : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"}`}
              onClick={() =>
                onDaysOverrideChange(
                  moveScopeDaysOverride != null && moveScopeDaysOverride >= 5
                    ? null
                    : 5,
                )
              }
            >
              5+
            </button>
          </div>
        </div>

        <div className="text-[10px] text-[var(--tx3)] border-t border-[var(--brd)]/40 pt-3 space-y-1">
          <p className="font-semibold text-[var(--tx)] text-[10px] uppercase tracking-wide">
            Included schedule signals
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Packing day when Estate tier, full packing add-on, or 4BR and larger homes.</li>
            <li>Unpack day when Estate tier or unpacking add-ons.</li>
            <li>Crating day when specialty items need crating.</li>
            <li>Large volume day on 5+ bedroom moves.</li>
          </ul>
        </div>

        {scopePreview.lines.length > 0 && (
          <div className="border-t border-[var(--brd)]/40 pt-3 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Flat day-rate add-ons (after base move price)
            </p>
            {scopePreview.lines.map((ln) => (
              <div
                key={ln.kind + ln.label}
                className="flex justify-between gap-3 text-[11px] text-[var(--tx)]"
              >
                <span>{ln.label}</span>
                <span className="font-medium shrink-0">
                  {ln.amount.toLocaleString("en-CA", {
                    style: "currency",
                    currency: "CAD",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

        {multiStopNote && (
          <p className="text-[10px] text-[var(--tx3)] pt-2 border-t border-[var(--brd)]/40">
            Multiple pickups or drop-offs are set above. Detailed routing happens when you create the move.
          </p>
        )}
      </div>
    </div>
  );
}
