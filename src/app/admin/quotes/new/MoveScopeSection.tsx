"use client"

import React, { useMemo } from "react"
import { Check as CheckIcon } from "@phosphor-icons/react"
import {
  computeMoveScopeAddonPreTax,
  describeMoveScopeAutoReason,
  detectDayCount,
} from "@/lib/quotes/move-scope"

function configRecordToMap(config: Record<string, string>) {
  return new Map(Object.entries(config))
}

function tierScope(
  recommendedTier: string,
): "essential" | "signature" | "estate" {
  const t = recommendedTier.toLowerCase().trim()
  if (t === "estate") return "estate"
  if (t === "essential") return "essential"
  return "signature"
}

function cfgNum(config: Record<string, string>, key: string, fallback: number) {
  const v = config[key]
  return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback
}

type RowVm = {
  key: string
  checked: boolean
  locked: boolean
  title: string
  dayNote: string
  amountNote: string
}

function normMoveSizeKey(moveSize: string): string {
  return (moveSize || "2br").toLowerCase().trim().replace(/\s+/g, "_").replace(/bedroom/g, "br")
}

function buildRows(args: {
  tierNorm: "essential" | "signature" | "estate"
  moveSize: string
  specialtyItems: { type: string; qty: number }[]
  cratingRequired: boolean
  addonSlugs: string[]
  packDayRate: number
  moveDayRate: number
  optionalExtraVolume: boolean
}): RowVm[] {
  const ms = normMoveSizeKey(args.moveSize)
  const tier = args.tierNorm

  // Day-rate billing fires on STRUCTURAL triggers only — never on the
  // full_packing / unpacking add-on slugs (those bill via the addons table
  // as flat fees; adding a $650 day rate on top would double-charge the
  // client — see YG-30238). Keep this in sync with detectDayCount in
  // src/lib/quotes/move-scope.ts.
  const isLargeHome = ms === "3br" || ms === "4br" || ms === "5br_plus"
  const hasPacking =
    (tier === "estate" && isLargeHome) || ms === "4br" || ms === "5br_plus"
  const hasUnpacking = tier === "estate" && isLargeHome

  const CRATING_TYPES = new Set([
    "piano_grand",
    "artwork",
    "antique",
    "wine_collection",
  ])
  const hasSpecialtyCrating =
    args.specialtyItems?.some((it) => CRATING_TYPES.has(it.type)) ?? false
  const hasCrating = hasSpecialtyCrating && args.cratingRequired
  const largeVolumeFive = ms === "5br_plus"

  const rows: RowVm[] = []

  rows.push({
    key: "pack",
    checked: hasPacking,
    locked:
      (tier === "estate" && isLargeHome) ||
      ms === "4br" ||
      ms === "5br_plus",
    title: "Packing day",
    dayNote: hasPacking ? "+1 day" : "Add-on fee (single-day)",
    amountNote:
      tier === "estate" && isLargeHome
        ? "Included with Estate tier (+ packing day)"
        : hasPacking
          ? `$${args.packDayRate.toLocaleString("en-CA")} (${args.packDayRate.toLocaleString("en-CA")} per packing day)`
          : "Flat add-on fee — no separate day rate",
  })

  rows.push({
    key: "move",
    checked: true,
    locked: true,
    title: "Moving day",
    dayNote: "1 day",
    amountNote: "Base move pricing",
  })

  rows.push({
    key: "unpack",
    checked: hasUnpacking,
    locked: tier === "estate" && isLargeHome,
    title: "Unpacking / setup",
    dayNote: hasUnpacking ? "+1 day" : "Add-on fee (single-day)",
    amountNote:
      tier === "estate" && isLargeHome
        ? "Included with Estate tier (+ unpacking day)"
        : hasUnpacking
          ? `$${args.packDayRate.toLocaleString("en-CA")} per day`
          : "Flat add-on fee — no separate day rate",
  })

  rows.push({
    key: "crate",
    checked: hasCrating,
    locked: hasCrating,
    title: "Crating / specialty",
    dayNote: hasCrating ? "+1 day" : "When crating applies",
    amountNote: `$${args.moveDayRate.toLocaleString("en-CA")} per day`,
  })

  rows.push({
    key: "volume",
    checked: largeVolumeFive || args.optionalExtraVolume,
    locked: largeVolumeFive,
    title: largeVolumeFive
      ? "Additional move day (large volume)"
      : "Additional move day",
    dayNote:
      largeVolumeFive || args.optionalExtraVolume ? "+1 day" : "+1 day if selected",
    amountNote:
      `$${args.moveDayRate.toLocaleString("en-CA")} per day (${largeVolumeFive ? "5+ bedrooms" : "large volumes"})`,
  })

  return rows
}

type Props = {
  recommendedTier: string
  moveSize: string
  specialtyItems: { type: string; qty: number }[]
  cratingRequired: boolean
  addonSlugs: string[]
  extraPickupStopCount: number
  extraDropoffStopCount: number
  moveScopeDaysOverride: number | null
  onDaysOverrideChange: (next: number | null) => void
  config: Record<string, string>
  optionalExtraVolumeDay: boolean
  onOptionalExtraVolumeDayChange: (next: boolean) => void
  onToggleMultiPickup: (nextChecked: boolean) => void
  onToggleMultiDelivery: (nextChecked: boolean) => void
}

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
  optionalExtraVolumeDay,
  onOptionalExtraVolumeDayChange,
  onToggleMultiPickup,
  onToggleMultiDelivery,
}: Props) {
  const tierNorm = tierScope(recommendedTier)

  const packDayRate = cfgNum(config, "pack_day_rate", 650)
  const moveDayRate = cfgNum(config, "multi_day_rate", 850)

  const detectedReason = useMemo(
    () =>
      describeMoveScopeAutoReason({
        tier: tierNorm,
        move_size: moveSize || "2br",
        specialty_items: specialtyItems,
        crating_required: cratingRequired,
        addon_slugs: addonSlugs,
      }),
    [tierNorm, moveSize, specialtyItems, cratingRequired, addonSlugs],
  )

  const detectedDaysOnly = useMemo(
    () =>
      detectDayCount({
        tier: tierNorm,
        move_size: moveSize || "2br",
        specialty_items: specialtyItems,
        crating_required: cratingRequired,
        addon_slugs: addonSlugs,
      }),
    [tierNorm, moveSize, specialtyItems, cratingRequired, addonSlugs],
  )

  const scopePreview = useMemo(
    () =>
      computeMoveScopeAddonPreTax(configRecordToMap(config), {
        tier: tierNorm,
        move_size: moveSize || "2br",
        specialty_items: specialtyItems,
        crating_required: cratingRequired,
        addon_slugs: addonSlugs,
        estimated_days_override: moveScopeDaysOverride,
        optional_additional_volume_day: optionalExtraVolumeDay,
      }),
    [
      config,
      tierNorm,
      moveSize,
      specialtyItems,
      cratingRequired,
      addonSlugs,
      moveScopeDaysOverride,
      optionalExtraVolumeDay,
    ],
  )

  const rows = useMemo(
    () =>
      buildRows({
        tierNorm,
        moveSize,
        specialtyItems,
        cratingRequired,
        addonSlugs,
        packDayRate,
        moveDayRate,
        optionalExtraVolume: optionalExtraVolumeDay,
      }),
    [
      tierNorm,
      moveSize,
      specialtyItems,
      cratingRequired,
      addonSlugs,
      packDayRate,
      moveDayRate,
      optionalExtraVolumeDay,
    ],
  )

  const multiPickupChecked = extraPickupStopCount > 0
  const multiDeliveryChecked = extraDropoffStopCount > 0

  return (
    <div className="border-t border-[var(--brd)]/30 pt-5 space-y-4">
      <div>
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Move scope
        </h3>
        <p className="text-[10px] text-[var(--tx3)] mt-1 max-w-xl leading-snug">
          Day counts follow tier, add-ons, and inventory. Coordinators tune the
          total before move creation. Detailed crew and routing are set on Create
          move.
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
              {moveScopeDaysOverride != null && (
                <span className="text-[var(--tx3)]">
                  {" "}
                  · Stored: {scopePreview.effectiveDays} days
                </span>
              )}
            </p>
            {detectedDaysOnly !== scopePreview.effectiveDays &&
              moveScopeDaysOverride == null && (
                <p className="text-[10px] text-[var(--tx3)] mt-1">
                  Effective calendar days ({scopePreview.effectiveDays}) reflect
                  add-on schedule padding.
                </p>
              )}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center justify-end">
            {([1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`min-w-[2rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border ${
                  moveScopeDaysOverride === n
                    ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)]"
                    : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"
                }`}
                onClick={() =>
                  onDaysOverrideChange(moveScopeDaysOverride === n ? null : n)
                }
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={`min-w-[2.75rem] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded border ${
                moveScopeDaysOverride != null && moveScopeDaysOverride >= 5
                  ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)]"
                  : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"
              }`}
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

        <div className="border-t border-[var(--brd)]/40 pt-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
            What&apos;s included in this move
          </p>
          <ul className="space-y-2" aria-label="Move scope line items">
            {rows.map((row) => {
              const toggleable =
                row.key === "volume" && normMoveSizeKey(moveSize) !== "5br_plus"
              return (
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
                      {toggleable && (
                        <button
                          type="button"
                          className={`text-[9px] font-bold uppercase tracking-wide underline-offset-2 ${
                            optionalExtraVolumeDay ? "underline" : "hover:underline"
                          }`}
                          onClick={() =>
                            onOptionalExtraVolumeDayChange(!optionalExtraVolumeDay)
                          }
                        >
                          {optionalExtraVolumeDay ? "Remove add-on day" : "Add day"}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                      {row.amountNote}
                      {row.locked && row.checked && toggleable === false ? (
                        <span className="sr-only"> Required by selections.</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              )
            })}
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
                  Multiple pickup locations (origins)
                </span>
                <span className="text-[10px] text-[var(--tx3)] leading-snug">
                  Uses “Add another from address” above.
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
                  Multiple delivery locations (destinations)
                </span>
                <span className="text-[10px] text-[var(--tx3)] leading-snug">
                  Uses “Add another to address” above.
                </span>
              </span>
            </label>
          </div>
        </div>

        {scopePreview.lines.length > 0 && (
          <div className="border-t border-[var(--brd)]/40 pt-3 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Day-rate add-ons (after base move price)
            </p>
            <p className="text-[10px] text-[var(--tx3)]">
              Packing day ${packDayRate.toLocaleString("en-CA")} · Move-style
              day ${moveDayRate.toLocaleString("en-CA")}
            </p>
            {scopePreview.lines.map((ln) => (
              <div
                key={ln.kind + ln.label + ln.amount}
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
            <div className="flex justify-between gap-3 text-[11px] font-semibold text-[var(--tx)] pt-1 border-t border-[var(--brd)]/30">
              <span>Schedule subtotal (pre-tax)</span>
              <span>
                {scopePreview.totalAddonPreTax.toLocaleString("en-CA", {
                  style: "currency",
                  currency: "CAD",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
