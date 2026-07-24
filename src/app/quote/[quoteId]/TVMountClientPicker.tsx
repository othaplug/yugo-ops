/**
 * Client-facing TV wall-mount picker on the quote page.
 *
 * Same variant matrix as the admin picker (src/app/admin/quotes/new/
 * TVMountVariantPicker.tsx) but styled to sit inside the wine/green/off-
 * white premium quote shells the customer sees. Free-typed inches derive
 * the size band, three type options render as radio cards with the
 * specific Kanto/Sanus model + price for the band, and "+ Add another
 * TV" supports households with more than one screen.
 *
 * Parent owns state — this is a controlled component receiving
 * variants + change handlers.
 */
"use client";

import { useMemo } from "react";
import {
  TV_MOUNT_TYPES,
  getTVSizeBand,
  lookupTVMountCell,
  type TVMountType,
  type TVMountSizeBand,
  type TVMountVariantConfig,
} from "@/lib/quotes/tv-mount-matrix";

type ShellText = {
  primary: string;
  body: string;
  secondary: string;
  kicker: string;
  muted: string;
} | null;

interface VariantRow {
  size: string;
  type: string;
  quantity: number;
  inches?: number | "";
}

interface Props {
  config: TVMountVariantConfig | null | undefined;
  variants: VariantRow[];
  onUpdate: (index: number, patch: Partial<VariantRow>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  premiumChrome: boolean;
  shellText: ShellText;
  premiumShellKind: string;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);

function inchesFromBand(band: string): number {
  switch (band) {
    case "32-42": return 42;
    case "43-55": return 55;
    case "56-65": return 65;
    case "66-75": return 75;
    case "76-85": return 85;
    default: return 55;
  }
}

export function TVMountClientPicker({
  config,
  variants,
  onUpdate,
  onAdd,
  onRemove,
  premiumChrome,
  shellText,
  premiumShellKind,
}: Props) {
  const sizeCap = config?.max_size_inches ?? 85;
  const sizeFloor = config?.min_size_inches ?? 32;

  // Chrome colors — mirror the tiered <select> above so the picker
  // reads native to whichever shell is rendering (Signature green,
  // Estate wine, non-premium off-white).
  const inputBorder = premiumChrome
    ? premiumShellKind === "signature"
      ? "rgba(244,250,245,0.35)"
      : "rgba(249,237,228,0.35)"
    : "#D5D0C8";
  const inputBg = premiumChrome
    ? premiumShellKind === "signature"
      ? "rgba(21, 38, 26, 0.6)"
      : "rgba(43, 4, 22, 0.5)"
    : "#FFFFFF";
  const cardBg = premiumChrome
    ? premiumShellKind === "signature"
      ? "rgba(21, 38, 26, 0.4)"
      : "rgba(43, 4, 22, 0.35)"
    : "#FAFAF8";
  const activeBg = premiumChrome
    ? premiumShellKind === "signature"
      ? "rgba(140, 200, 155, 0.15)"
      : "rgba(212, 180, 130, 0.15)"
    : "#F5EEE3";
  const activeBorder = premiumChrome
    ? premiumShellKind === "signature"
      ? "rgba(140, 200, 155, 0.65)"
      : "rgba(212, 180, 130, 0.75)"
    : "#8B6F3E";
  const primaryText = premiumChrome ? shellText!.primary : "#2C3E2D";
  const bodyText = premiumChrome ? shellText!.body : "#5A6B5C";
  const mutedText = premiumChrome ? shellText!.secondary : "#7A8B7C";
  const kickerText = premiumChrome ? shellText!.kicker : "#8B6F3E";

  const total = useMemo(() => {
    if (!config) return 0;
    let t = 0;
    for (const v of variants) {
      const cell = lookupTVMountCell(
        config,
        v.size as TVMountSizeBand,
        v.type as TVMountType,
      );
      if (cell) t += cell.price * (v.quantity || 1);
    }
    return t;
  }, [config, variants]);

  if (!config) {
    return (
      <p className="mt-2 text-[11px]" style={{ color: bodyText }}>
        TV mount pricing is loading. Refresh the page if this persists.
      </p>
    );
  }

  return (
    <div className="mt-3 w-full min-w-0 space-y-3">
      {variants.map((row, i) => {
        const inchesValue =
          row.inches === "" || row.inches == null
            ? inchesFromBand(row.size)
            : row.inches;
        const band = getTVSizeBand(Number(inchesValue));
        const sizeMeta = band ? config.sizes[band] : null;
        const outOfRange =
          typeof inchesValue === "number" && !isNaN(inchesValue) && !band;

        return (
          <div
            key={i}
            className="rounded-none border p-3"
            style={{ borderColor: inputBorder, backgroundColor: cardBg }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[10px] uppercase tracking-[0.12em] font-semibold"
                style={{ color: kickerText }}
              >
                TV {i + 1}
              </span>
              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-[11px] transition-opacity hover:opacity-70"
                  style={{ color: mutedText }}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <label className="text-[11px]" style={{ color: bodyText }}>
                TV size
              </label>
              <input
                type="number"
                min={sizeFloor}
                max={sizeCap}
                value={inchesValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = raw === "" ? "" : parseInt(raw, 10);
                  const nextBand =
                    typeof n === "number" && !isNaN(n) ? getTVSizeBand(n) : null;
                  onUpdate(i, {
                    inches: n as number | "",
                    size: nextBand ?? row.size,
                  });
                }}
                placeholder="55"
                className="w-16 text-[12px] rounded-none border px-2 py-1.5 text-center"
                style={{
                  borderColor: inputBorder,
                  backgroundColor: inputBg,
                  color: primaryText,
                }}
              />
              <span className="text-[11px]" style={{ color: mutedText }}>
                inches (max {sizeCap}&quot;)
              </span>
              {sizeMeta && (
                <span
                  className="text-[11px] ml-auto"
                  style={{ color: bodyText }}
                >
                  {sizeMeta.label}
                  {sizeMeta.requires_two_installers && (
                    <span
                      className="ml-1.5"
                      style={{ color: kickerText }}
                    >
                      · 2 installers
                    </span>
                  )}
                </span>
              )}
              {outOfRange && (
                <span
                  className="text-[11px] ml-auto"
                  style={{ color: "#E37A6A" }}
                >
                  We support {sizeFloor}&quot;–{sizeCap}&quot; only.
                </span>
              )}
            </div>

            {band && sizeMeta && (
              <div className="grid grid-cols-1 gap-1.5">
                {TV_MOUNT_TYPES.map((t) => {
                  const cell = sizeMeta.types[t];
                  if (!cell) return null;
                  const label = config.type_labels?.[t] ?? t;
                  const desc = config.type_descriptions?.[t] ?? "";
                  const active = row.type === t;
                  return (
                    <label
                      key={t}
                      className="flex items-start gap-2.5 rounded-none border px-3 py-2.5 cursor-pointer transition-colors"
                      style={{
                        borderColor: active ? activeBorder : inputBorder,
                        backgroundColor: active ? activeBg : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={`tv-type-${i}`}
                        value={t}
                        checked={active}
                        onChange={() => onUpdate(i, { type: t })}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: primaryText }}
                          >
                            {label}
                          </span>
                          <span
                            className="text-[13px] font-semibold tabular-nums"
                            style={{ color: primaryText }}
                          >
                            {money(cell.price)}
                          </span>
                        </div>
                        <p
                          className="text-[11px] leading-snug mt-0.5"
                          style={{ color: bodyText }}
                        >
                          {desc}
                        </p>
                        <p
                          className="text-[10px] mt-1"
                          style={{ color: mutedText }}
                        >
                          {cell.mount_model} · about {cell.labour_minutes} min
                          install
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {band && (
              <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                <span style={{ color: bodyText }}>Qty</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={row.quantity}
                  onChange={(e) =>
                    onUpdate(i, {
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="w-12 rounded-none border px-2 py-1 text-center"
                  style={{
                    borderColor: inputBorder,
                    backgroundColor: inputBg,
                    color: primaryText,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAdd}
          className="text-[12px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: kickerText }}
        >
          + Add another TV
        </button>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: primaryText }}
        >
          {money(total)}
        </span>
      </div>
    </div>
  );
}
