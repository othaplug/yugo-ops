"use client";

import React, { useMemo } from "react";
import { Plus, Minus } from "@phosphor-icons/react";
import {
  OFFICE_INVENTORY_CATALOG,
  type OfficeItemCategory,
} from "@/lib/quotes/office-inventory-catalog";
import {
  estimateOfficeLabour,
  type OfficeInventoryLine,
} from "@/lib/quotes/office-inventory-labour";
import {
  calcOfficeTiers,
  type OfficeQuoteContext,
} from "@/lib/quotes/office-quote-engine";
import { OFFICE_TIER_DEFINITIONS, OFFICE_TIER_ORDER } from "@/lib/tiers/office-tier-definitions";

const CATEGORY_LABELS: Record<OfficeItemCategory, string> = {
  desks: "Desks",
  seating: "Seating",
  it: "IT & electronics",
  tables: "Tables",
  storage: "Storage",
  lounge: "Lounge",
  lunch: "Lunch & break",
  decor: "Decor",
  kitchen: "Kitchen",
  boxes: "Boxes",
  misc: "Misc",
};

const CATEGORY_ORDER: OfficeItemCategory[] = [
  "desks", "seating", "it", "tables", "storage",
  "lounge", "lunch", "decor", "kitchen", "boxes", "misc",
];

export interface OfficeInventoryInputProps {
  inventory: OfficeInventoryLine[];
  onInventoryChange: (next: OfficeInventoryLine[]) => void;
  context: OfficeQuoteContext;
  onContextChange: (next: OfficeQuoteContext) => void;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export default function OfficeInventoryInput({
  inventory,
  onInventoryChange,
  context,
  onContextChange,
}: OfficeInventoryInputProps) {
  const qtyBySlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const line of inventory) m.set(line.slug, line.quantity);
    return m;
  }, [inventory]);

  const setQty = (slug: string, next: number) => {
    const q = Math.max(0, Math.floor(next));
    const rest = inventory.filter((l) => l.slug !== slug);
    onInventoryChange(q > 0 ? [...rest, { slug, quantity: q }] : rest);
  };

  const grouped = useMemo(() => {
    const out = {} as Record<OfficeItemCategory, typeof OFFICE_INVENTORY_CATALOG>;
    for (const item of OFFICE_INVENTORY_CATALOG) (out[item.category] ??= []).push(item);
    return out;
  }, []);

  const { labour, quote } = useMemo(() => {
    const lab = estimateOfficeLabour(inventory);
    return { labour: lab, quote: calcOfficeTiers(lab, context) };
  }, [inventory, context]);

  const patchCtx = (patch: Partial<OfficeQuoteContext>) =>
    onContextChange({ ...context, ...patch });

  return (
    <div className="border-t border-[var(--brd)]/30 pt-5 space-y-4">
      <div>
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
          Office inventory
        </h3>
        <p className="text-[10px] text-[var(--tx3)] mt-1 max-w-xl leading-snug">
          Add what&apos;s actually moving. Crew, trucks, days, and the three
          package prices update live from the inventory.
        </p>
      </div>

      {/* ── Catalog ── */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-4">
        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
          <div key={cat} className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {grouped[cat].map((item) => {
                const qty = qtyBySlug.get(item.slug) ?? 0;
                const active = qty > 0;
                return (
                  <div
                    key={item.slug}
                    className="flex items-center justify-between gap-3"
                  >
                    <span
                      className={`text-[11px] leading-snug ${active ? "text-[var(--tx)] font-medium" : "text-[var(--tx3)]"}`}
                    >
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Remove one ${item.label}`}
                        disabled={qty === 0}
                        onClick={() => setQty(item.slug, qty - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[var(--brd)] text-[var(--tx3)] disabled:opacity-30 hover:border-[var(--tx3)]"
                      >
                        <Minus className="h-3 w-3" weight="bold" aria-hidden />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={qty === 0 ? "" : qty}
                        placeholder="0"
                        onChange={(e) => setQty(item.slug, Number(e.target.value || 0))}
                        className="h-6 w-12 rounded border border-[var(--brd)] bg-[var(--card)] text-center text-[11px] text-[var(--tx)] tabular-nums"
                      />
                      <button
                        type="button"
                        aria-label={`Add one ${item.label}`}
                        onClick={() => setQty(item.slug, qty + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)] hover:bg-[var(--admin-primary-fill)]/20"
                      >
                        <Plus className="h-3 w-3" weight="bold" aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Scope & timing ── */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
          Scope &amp; timing
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {([
            ["afterHours", "After-hours access"],
            ["weekend", "Weekend move"],
            ["partialMove", "Partial move (selected items)"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-[var(--brd)]"
                checked={!!context[key]}
                onChange={(e) => patchCtx({ [key]: e.target.checked })}
              />
              <span className="text-[11px] text-[var(--tx)]">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Moving sq ft (portion actually moving)
            </span>
            <input
              type="number"
              min={0}
              value={context.movingSqft ?? ""}
              placeholder="e.g. 6000"
              onChange={(e) => patchCtx({ movingSqft: e.target.value ? Number(e.target.value) : null })}
              className="h-7 w-40 rounded border border-[var(--brd)] bg-[var(--card)] px-2 text-[11px] text-[var(--tx)] tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Distance (km)
            </span>
            <input
              type="number"
              min={0}
              value={context.distanceKm ?? ""}
              placeholder="0"
              onChange={(e) => patchCtx({ distanceKm: e.target.value ? Number(e.target.value) : undefined })}
              className="h-7 w-28 rounded border border-[var(--brd)] bg-[var(--card)] px-2 text-[11px] text-[var(--tx)] tabular-nums"
            />
          </label>
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-3 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
            Live estimate
          </p>
          <span
            className={`text-[9px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded ${
              quote.confidence.level === "high"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            }`}
          >
            {quote.confidence.level === "high" ? "On model" : "Review"}
          </span>
        </div>
        <p className="text-[10px] text-[var(--tx3)]">
          {labour.unitCount} items · crew {labour.crew} · {labour.trucks} truck
          {labour.trucks === 1 ? "" : "s"} · volume {labour.volumeScore}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {OFFICE_TIER_ORDER.map((t) => {
            const tp = quote.tiers[t];
            const def = OFFICE_TIER_DEFINITIONS[t];
            return (
              <div
                key={t}
                className={`rounded-lg border px-2.5 py-2 ${
                  def.recommended
                    ? "border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/5"
                    : "border-[var(--brd)]"
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--tx3)]">
                  {def.name}
                </p>
                <p className="text-[15px] font-bold text-[var(--tx)] tabular-nums leading-tight mt-0.5">
                  {fmt(tp.price)}
                </p>
                <p className="text-[9px] text-[var(--tx3)] mt-0.5">
                  +{fmt(tp.tax)} HST · {tp.days}d · {tp.crew} crew
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-[var(--tx3)] leading-snug">{quote.confidence.reason}</p>
      </div>
    </div>
  );
}
