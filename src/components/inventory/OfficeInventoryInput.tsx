"use client";

import React, { useMemo, useState } from "react";
import { Plus, Minus, ClipboardText, ArrowCounterClockwise } from "@phosphor-icons/react";
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
import { applyProcessingRecoveryToTier } from "@/lib/pricing/processing-recovery";

/* ── Preset templates ──
 * One-click prefills for typical office sizes. Operator picks the closest
 * shape, then nudges line items up/down. Saves ~3-4 min vs manual entry.
 * Numbers calibrated against actual Yugo office bookings 2026-Q1/Q2. */
type PresetKey = "small" | "medium" | "large" | "xlarge";
const PRESETS: Record<
  PresetKey,
  { label: string; sub: string; lines: OfficeInventoryLine[] }
> = {
  small: {
    label: "Small",
    sub: "1–5 employees",
    lines: [
      { slug: "desk_standard", quantity: 5 },
      { slug: "office_chair", quantity: 5 },
      { slug: "filing_cabinet", quantity: 2 },
      { slug: "monitor", quantity: 5 },
      { slug: "monitor_arm", quantity: 5 },
      { slug: "box", quantity: 5 },
    ],
  },
  medium: {
    label: "Medium",
    sub: "6–15 employees",
    lines: [
      { slug: "desk_standard", quantity: 12 },
      { slug: "office_chair", quantity: 15 },
      { slug: "filing_cabinet", quantity: 4 },
      { slug: "monitor", quantity: 12 },
      { slug: "monitor_arm", quantity: 12 },
      { slug: "tv", quantity: 2 },
      { slug: "boardroom_table", quantity: 1 },
      { slug: "couch", quantity: 1 },
      { slug: "box", quantity: 15 },
    ],
  },
  large: {
    label: "Large",
    sub: "16–30 employees",
    lines: [
      { slug: "desk_standard", quantity: 25 },
      { slug: "office_chair", quantity: 30 },
      { slug: "filing_cabinet", quantity: 8 },
      { slug: "monitor", quantity: 30 },
      { slug: "monitor_arm", quantity: 30 },
      { slug: "tv", quantity: 4 },
      { slug: "boardroom_table", quantity: 2 },
      { slug: "couch", quantity: 2 },
      { slug: "lounge_seating", quantity: 4 },
      { slug: "box", quantity: 30 },
    ],
  },
  xlarge: {
    label: "Extra-large",
    sub: "30+ employees",
    lines: [
      { slug: "desk_standard", quantity: 50 },
      { slug: "office_chair", quantity: 60 },
      { slug: "filing_cabinet", quantity: 15 },
      { slug: "monitor", quantity: 60 },
      { slug: "monitor_arm", quantity: 60 },
      { slug: "tv", quantity: 8 },
      { slug: "boardroom_table", quantity: 3 },
      { slug: "couch", quantity: 4 },
      { slug: "lounge_seating", quantity: 8 },
      { slug: "lunch_table", quantity: 4 },
      { slug: "server_rack", quantity: 2 },
      { slug: "printer_copier", quantity: 3 },
      { slug: "box", quantity: 50 },
    ],
  },
};

/* ── Bulk-paste parser ──
 * Maps freeform lines like "30 standing desks", "25 office chairs", "9 TVs"
 * into catalog slugs. Forgiving on case + plurals + verbose modifiers.
 * Unknown lines are dropped (and reported in the UI). */
const BULK_KEYWORDS: { test: RegExp; slug: string }[] = [
  { test: /standing\s*desk/i, slug: "standing_desk" },
  { test: /executive\s*desk/i, slug: "desk_executive" },
  { test: /\bdesk/i, slug: "desk_standard" },
  { test: /specialty\s*chair|exec(?:utive)?\s*chair/i, slug: "specialty_chair" },
  { test: /chair|stool/i, slug: "office_chair" },
  { test: /monitor\s*(?:arm|mount|stand)|desk\s*arm/i, slug: "monitor_arm" },
  { test: /monitor|screen|display/i, slug: "monitor" },
  { test: /server|it\s*rack/i, slug: "server_rack" },
  { test: /printer|copier/i, slug: "printer_copier" },
  { test: /\btv|television/i, slug: "tv" },
  { test: /boardroom|meeting\s*table|conference\s*table/i, slug: "boardroom_table" },
  { test: /side\s*table|breakout\s*table|small\s*table/i, slug: "small_table" },
  { test: /lunch\s*table|cafe\s*table/i, slug: "lunch_table" },
  { test: /high.?top|stool/i, slug: "hightop_chair" },
  { test: /filing|file\s*cabinet/i, slug: "filing_cabinet" },
  { test: /storage\s*cabinet|metal\s*cabinet|cabinet/i, slug: "storage_cabinet" },
  { test: /drawer/i, slug: "storage_drawer" },
  { test: /couch|sofa/i, slug: "couch" },
  { test: /lounge|bench/i, slug: "lounge_seating" },
  { test: /glass\s*(?:coffee\s*)?table|coffee\s*table/i, slug: "coffee_table_glass" },
  { test: /floor\s*lamp|lamp/i, slug: "floor_lamp" },
  { test: /plant/i, slug: "plant" },
  { test: /art(?:work)?|painting|framed/i, slug: "artwork" },
  { test: /kitchen|cutlery|dishes/i, slug: "kitchen_box" },
  { test: /appliance|fridge|microwave/i, slug: "appliance_small" },
  { test: /whiteboard|panel/i, slug: "whiteboard" },
  { test: /\bbox(?:es)?\b|carton/i, slug: "box" },
];

function parseBulkInventory(
  text: string,
): { lines: OfficeInventoryLine[]; unmatched: string[] } {
  const lines: OfficeInventoryLine[] = [];
  const unmatched: string[] = [];
  const sumBySlug = new Map<string, number>();
  for (const rawLine of text.split(/\r?\n|[,;]/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Accept patterns like "30 desks", "Desks 30", "30 x desks", "30 - desks"
    const m =
      line.match(/^(\d+)\s*[x×\-:]?\s*(.+)$/i) ||
      line.match(/^(.+?)\s*[:\-]?\s*(\d+)$/i);
    if (!m) {
      unmatched.push(line);
      continue;
    }
    const qty = parseInt(/^\d+$/.test(m[1]) ? m[1] : m[2], 10);
    const label = /^\d+$/.test(m[1]) ? m[2] : m[1];
    if (!qty || qty <= 0) {
      unmatched.push(line);
      continue;
    }
    const hit = BULK_KEYWORDS.find((kw) => kw.test.test(label));
    if (!hit) {
      unmatched.push(line);
      continue;
    }
    sumBySlug.set(hit.slug, (sumBySlug.get(hit.slug) ?? 0) + qty);
  }
  for (const [slug, quantity] of sumBySlug) lines.push({ slug, quantity });
  return { lines, unmatched };
}

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
    const raw = calcOfficeTiers(lab, context);
    // Match the server: bake CC processing recovery into every tier
    // price so the live estimate matches the post-Generate right rail.
    // Before this, the engine returned pre-recovery numbers
    // ($6,450/$8,400/$9,300) while the server applied recovery in
    // route.ts (yielding $6,650/$8,650/$9,600). Operator flagged the
    // ~$200-300 gap on 2026-06-29. Uses platform defaults; if the
    // platform_config rates ever drift, the gap will be a few dollars,
    // not hundreds.
    const grossedTiers = {} as typeof raw.tiers;
    for (const k of Object.keys(raw.tiers) as (keyof typeof raw.tiers)[]) {
      grossedTiers[k] = applyProcessingRecoveryToTier(raw.tiers[k], {}, 50);
    }
    return { labour: lab, quote: { ...raw, tiers: grossedTiers } };
  }, [inventory, context]);

  const patchCtx = (patch: Partial<OfficeQuoteContext>) =>
    onContextChange({ ...context, ...patch });

  // Local UI state for the bulk-paste + preset shortcuts.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkUnmatched, setBulkUnmatched] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  /** Replace inventory with the supplied lines (used by presets). */
  const replaceWith = (next: OfficeInventoryLine[]) => {
    onInventoryChange(next);
    setBulkUnmatched([]);
    setBulkMessage(null);
  };

  /** Merge bulk-paste lines on top of whatever is already there (additive). */
  const mergeLines = (incoming: OfficeInventoryLine[]) => {
    const m = new Map<string, number>();
    for (const l of inventory) m.set(l.slug, l.quantity);
    for (const l of incoming) m.set(l.slug, (m.get(l.slug) ?? 0) + l.quantity);
    const merged: OfficeInventoryLine[] = [];
    for (const [slug, quantity] of m) if (quantity > 0) merged.push({ slug, quantity });
    onInventoryChange(merged);
  };

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

      {/* ── Quick start: presets + bulk paste ──
          Operator ask 2026-06-29: "not every time will admin need to manually
          input all of the inventory, it takes time and a lot of energy".
          One-click presets cover the common shapes; bulk paste handles the
          "client sent a spreadsheet" case in seconds. */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Quick start
            </p>
            <p className="text-[10px] text-[var(--tx3)] mt-0.5">
              Pick a preset, then nudge counts up or down below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[var(--brd)] bg-[var(--card)] text-[10px] font-semibold uppercase tracking-wider text-[var(--tx)] hover:border-[var(--admin-primary-fill)]"
              aria-expanded={bulkOpen}
            >
              <ClipboardText className="h-3 w-3" weight="regular" aria-hidden />
              Bulk paste
            </button>
            {inventory.length > 0 && (
              <button
                type="button"
                onClick={() => replaceWith([])}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[var(--brd)] bg-transparent text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]"
                title="Clear all inventory lines"
              >
                <ArrowCounterClockwise className="h-3 w-3" weight="regular" aria-hidden />
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
            const p = PRESETS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => replaceWith(p.lines.map((l) => ({ ...l })))}
                className="flex flex-col items-start text-left rounded-lg border border-[var(--brd)] bg-[var(--card)] px-3 py-2 hover:border-[var(--admin-primary-fill)] hover:bg-[var(--admin-primary-fill)]/5 transition-colors"
              >
                <span className="text-[11px] font-bold text-[var(--tx)] leading-tight">
                  {p.label}
                </span>
                <span className="text-[10px] text-[var(--tx3)] mt-0.5">
                  {p.sub}
                </span>
                <span className="text-[9px] text-[var(--tx3)] mt-1">
                  {p.lines.reduce((s, l) => s + l.quantity, 0)} items
                </span>
              </button>
            );
          })}
        </div>
        {bulkOpen && (
          <div className="border-t border-[var(--brd)]/40 pt-3 space-y-2">
            <p className="text-[10px] text-[var(--tx3)] leading-snug">
              Paste a spreadsheet column, email list, or freeform notes. One
              item per line. Format: <span className="text-[var(--tx)] font-mono">30 standing desks</span>,
              {" "}<span className="text-[var(--tx)] font-mono">25 office chairs</span>,
              {" "}<span className="text-[var(--tx)] font-mono">9 TVs</span>.
              Counts merge into whatever is already added.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={
                "30 standing desks\n70 office chairs\n30 monitors\n30 monitor arms\n9 TVs\n8 boardroom tables\n55 storage drawers\n6 couches\n17 plants\n40 boxes"
              }
              className="w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)] font-mono leading-snug"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const parsed = parseBulkInventory(bulkText);
                  if (parsed.lines.length === 0) {
                    setBulkUnmatched(parsed.unmatched);
                    setBulkMessage("No items recognized. Check the format.");
                    return;
                  }
                  mergeLines(parsed.lines);
                  setBulkUnmatched(parsed.unmatched);
                  setBulkMessage(
                    `Added ${parsed.lines.length} line${parsed.lines.length === 1 ? "" : "s"}` +
                      (parsed.unmatched.length > 0
                        ? ` · ${parsed.unmatched.length} line${parsed.unmatched.length === 1 ? "" : "s"} not recognized (see below)`
                        : ""),
                  );
                  setBulkText("");
                }}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-[var(--admin-primary-fill)] text-[var(--card)] text-[10px] font-semibold uppercase tracking-wider hover:opacity-90"
              >
                Parse + add
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkText("");
                  setBulkUnmatched([]);
                  setBulkMessage(null);
                }}
                className="text-[10px] text-[var(--tx3)] underline-offset-2 hover:underline"
              >
                Clear textarea
              </button>
            </div>
            {bulkMessage && (
              <p className="text-[10px] text-[var(--tx)] leading-snug">{bulkMessage}</p>
            )}
            {bulkUnmatched.length > 0 && (
              <details className="text-[10px] text-[var(--tx3)] leading-snug">
                <summary className="cursor-pointer">
                  Unrecognized lines ({bulkUnmatched.length})
                </summary>
                <ul className="mt-1 ml-3 list-disc">
                  {bulkUnmatched.slice(0, 20).map((l, i) => (
                    <li key={i} className="font-mono">{l}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
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
