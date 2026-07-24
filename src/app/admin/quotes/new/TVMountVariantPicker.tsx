/**
 * Variant-matrix picker for the TV wall-mount add-on.
 *
 * Renders one row per TV in the household — free-typed size input,
 * derived size band, three radio cards for mount type showing model +
 * install time + description + price. "+ Add another TV" for
 * multi-TV households.
 *
 * Shape mirrors AddonSelection.variants[] from QuoteFormClient so it
 * drops in wherever an admin edits an add-on selection. The parent
 * owns state — this component is a controlled input.
 */
"use client";

import { useMemo } from "react";
import { Plus, X } from "@phosphor-icons/react";
import {
  TV_MOUNT_TYPES,
  getTVSizeBand,
  lookupTVMountCell,
  type TVMountType,
  type TVMountVariantConfig,
} from "@/lib/quotes/tv-mount-matrix";

interface VariantRow {
  size: string;
  type: string;
  quantity: number;
  /** Free-typed inches from the operator input; derives `size`. */
  inches?: number | "";
}

interface Props {
  config: TVMountVariantConfig | null | undefined;
  variants: VariantRow[];
  onUpdate: (index: number, patch: Partial<VariantRow>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);

/** Reasonable default the input starts empty on if the parent seeded a band. */
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

export function TVMountVariantPicker({
  config,
  variants,
  onUpdate,
  onAdd,
  onRemove,
}: Props) {
  const sizeCap = config?.max_size_inches ?? 85;
  const sizeFloor = config?.min_size_inches ?? 32;

  const total = useMemo(() => {
    if (!config) return 0;
    let t = 0;
    for (const v of variants) {
      const cell = lookupTVMountCell(
        config,
        v.size as import("@/lib/quotes/tv-mount-matrix").TVMountSizeBand,
        v.type as TVMountType,
      );
      if (cell) t += cell.price * (v.quantity || 1);
    }
    return t;
  }, [config, variants]);

  if (!config) {
    return (
      <div className="ml-6 text-[10px] text-amber-500">
        TV mount pricing not loaded — refresh the page.
      </div>
    );
  }

  return (
    <div className="ml-6 mt-1 space-y-3">
      {variants.map((row, i) => {
        const inchesValue =
          row.inches === "" || row.inches == null
            ? inchesFromBand(row.size)
            : row.inches;
        const band = getTVSizeBand(Number(inchesValue));
        const sizeMeta = band ? config.sizes[band] : null;
        const currentCell = band
          ? lookupTVMountCell(config, band, row.type as TVMountType)
          : null;

        return (
          <div
            key={i}
            className="rounded-lg border border-[rgba(250,247,242,0.18)] bg-[var(--card)]/40 p-2.5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--tx3)]">
                TV #{i + 1}
              </span>
              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="text-[var(--tx3)] hover:text-red-400 transition-colors"
                  aria-label="Remove this TV"
                >
                  <X size={12} weight="bold" aria-hidden />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-[10px] text-[var(--tx3)]">Size</label>
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
                className="w-16 text-[11px] bg-[var(--card)] border border-[rgba(250,247,242,0.22)] rounded px-2 py-1 text-[var(--tx)]"
              />
              <span className="text-[10px] text-[var(--tx3)]">
                inches · max {sizeCap}&quot;
              </span>
              {sizeMeta && (
                <span className="text-[10px] text-[var(--tx3)] ml-auto">
                  Band: {sizeMeta.label}
                  {sizeMeta.requires_two_installers && (
                    <span className="ml-1.5 text-amber-500">· 2 installers</span>
                  )}
                </span>
              )}
              {!band && typeof inchesValue === "number" && (
                <span className="text-[10px] text-red-400 ml-auto">
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
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors ${
                        active
                          ? "border-[var(--gold)] bg-[var(--gold)]/8"
                          : "border-[rgba(250,247,242,0.14)] hover:border-[rgba(250,247,242,0.28)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`tv-type-${i}`}
                        value={t}
                        checked={active}
                        onChange={() => onUpdate(i, { type: t })}
                        className="accent-[var(--gold)] mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[var(--tx)]">
                            {label}
                          </span>
                          <span className="text-[11px] font-semibold text-[var(--tx)]">
                            {money(cell.price)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--tx3)] leading-snug mt-0.5">
                          {desc}
                        </p>
                        <p className="text-[10px] text-[var(--tx3)]/80 mt-0.5">
                          {cell.mount_model} · ~{cell.labour_minutes} min install
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {currentCell && (
              <div className="mt-2 flex items-center gap-2 text-[10px]">
                <span className="text-[var(--tx3)]">Qty</span>
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
                  className="w-12 bg-[var(--card)] border border-[rgba(250,247,242,0.22)] rounded px-2 py-0.5 text-[var(--tx)]"
                />
                <span className="text-[var(--tx3)] ml-auto">
                  Line {money(currentCell.price * (row.quantity || 1))}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] hover:text-[var(--gold2)] transition-colors"
        >
          <Plus size={12} weight="bold" aria-hidden />
          Add another TV
        </button>
        <span className="text-[11px] font-semibold text-[var(--tx)]">
          Subtotal {money(total)}
        </span>
      </div>
    </div>
  );
}
