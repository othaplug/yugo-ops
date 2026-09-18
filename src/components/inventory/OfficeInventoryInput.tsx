"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Minus,
  ClipboardText,
  ArrowCounterClockwise,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import {
  OFFICE_INVENTORY_CATALOG,
  OFFICE_CUSTOM_SIZE_SLUGS,
  type OfficeItemCategory,
  type OfficeCustomSizeSlug,
} from "@/lib/quotes/office-inventory-catalog";
import {
  officeLineItem,
  type OfficeInventoryLine,
} from "@/lib/quotes/office-inventory-labour";
import { parseOfficeBulkInventory } from "@/lib/quotes/office-inventory-parse";
import { type OfficeQuoteContext } from "@/lib/quotes/office-quote-engine";
import {
  type OfficeSiteAccess,
  type OfficeElevator,
  type OfficeFloorBand,
  type OfficeLoading,
  type OfficeCarry,
} from "@/lib/quotes/office-access-model";

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
    sub: "1 to 5 employees",
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
    sub: "6 to 15 employees",
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
    sub: "16 to 30 employees",
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

/* Bulk-paste parsing lives in @/lib/quotes/office-inventory-parse
   (parseOfficeBulkInventory) — specificity-ordered rules that map freeform
   lines onto catalog slugs, with unmatched lines auto-created as custom items
   so nothing is dropped. */

/* Boxes quick-range: office clients rarely count boxes exactly, so offer a
   dropdown of typical ranges that sets a representative count. */
const BOX_RANGES: { label: string; value: number }[] = [
  { label: "No boxes", value: 0 },
  { label: "A few (1 to 10)", value: 6 },
  { label: "Some (10 to 25)", value: 18 },
  { label: "Many (25 to 50)", value: 38 },
  { label: "A lot (50 to 100)", value: 75 },
  { label: "100+", value: 120 },
];

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

// The custom_* templates back the "add custom item" flow — never show them as
// normal quick-add / search results.
const PICKABLE_CATALOG = OFFICE_INVENTORY_CATALOG.filter(
  (it) => !it.slug.startsWith("custom_"),
);

const CUSTOM_SIZE_LABELS: Record<OfficeCustomSizeSlug, string> = {
  custom_small: "Small",
  custom_medium: "Medium",
  custom_large: "Large",
  custom_xlarge: "Extra-large",
};

/* ── Building access (commercial) ──
 * Per-site access drivers that price the tier-agnostic access surcharge:
 * elevator topology, floor, loading position, dock-to-suite carry, plus the
 * after-hours / COI building rules that surface as ops flags. */
const ELEVATOR_OPTS: { value: OfficeElevator; label: string }[] = [
  { value: "freight", label: "Freight elevator" },
  { value: "passenger", label: "Passenger only" },
  { value: "none", label: "No elevator (stairs)" },
];
const FLOOR_OPTS: { value: OfficeFloorBand; label: string }[] = [
  { value: "ground", label: "Ground / dock level" },
  { value: "low", label: "Low (1 to 6)" },
  { value: "mid", label: "Mid (7 to 15)" },
  { value: "high", label: "High (16 to 30)" },
  { value: "tower", label: "Tower (30+)" },
];
const LOADING_OPTS: { value: OfficeLoading; label: string }[] = [
  { value: "dock", label: "Dedicated dock" },
  { value: "street", label: "Street / curb" },
  { value: "underground", label: "Underground (P1)" },
];
const CARRY_OPTS: { value: OfficeCarry; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "very_long", label: "Very long" },
];

function SiteAccessFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: OfficeSiteAccess;
  onChange: (next: OfficeSiteAccess) => void;
}) {
  const patch = (p: Partial<OfficeSiteAccess>) => onChange({ ...value, ...p });
  const selCls =
    "h-7 rounded border border-[var(--brd)] bg-[var(--card)] px-1.5 text-[11px] text-[var(--tx)]";
  const labCls =
    "text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]";
  return (
    <div className="rounded-lg border border-[var(--brd)]/60 bg-[var(--card)] px-3 py-2.5 space-y-2.5 flex-1 min-w-[240px]">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx)]">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labCls}>Floor</span>
          <select
            className={selCls}
            value={value.floorBand ?? "ground"}
            onChange={(e) => patch({ floorBand: e.target.value as OfficeFloorBand })}
          >
            {FLOOR_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labCls}>Elevator</span>
          <select
            className={selCls}
            value={value.elevator ?? "freight"}
            onChange={(e) => patch({ elevator: e.target.value as OfficeElevator })}
          >
            {ELEVATOR_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labCls}>Loading</span>
          <select
            className={selCls}
            value={value.loading ?? "dock"}
            onChange={(e) => patch({ loading: e.target.value as OfficeLoading })}
          >
            {LOADING_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labCls}>Carry to suite</span>
          <select
            className={selCls}
            value={value.carry ?? "short"}
            onChange={(e) => patch({ carry: e.target.value as OfficeCarry })}
          >
            {CARRY_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labCls}>Elevator window (min)</span>
          <input
            type="number"
            min={0}
            value={value.elevatorWindowMin ?? ""}
            placeholder="none"
            onChange={(e) =>
              patch({ elevatorWindowMin: e.target.value ? Number(e.target.value) : null })
            }
            className="h-7 rounded border border-[var(--brd)] bg-[var(--card)] px-1.5 text-[11px] text-[var(--tx)] tabular-nums"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
        {([
          ["multiLevel", "Multi-level suite"],
          ["afterHoursRequired", "After-hours required"],
          ["coiRequired", "COI required"],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-[var(--brd)]"
              checked={value[key] === true}
              onChange={(e) => patch({ [key]: e.target.checked })}
            />
            <span className="text-[10px] text-[var(--tx)]">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export interface OfficeInventoryInputProps {
  inventory: OfficeInventoryLine[];
  onInventoryChange: (next: OfficeInventoryLine[]) => void;
  context: OfficeQuoteContext;
  onContextChange: (next: OfficeQuoteContext) => void;
}

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

  // Set a quantity while PRESERVING any custom payload on the existing line
  // (a custom item stepped up/down must keep its label + size).
  const setQty = (slug: string, next: number) => {
    const q = Math.max(0, Math.floor(next));
    const existing = inventory.find((l) => l.slug === slug);
    const rest = inventory.filter((l) => l.slug !== slug);
    if (q <= 0) {
      onInventoryChange(rest);
      return;
    }
    const line: OfficeInventoryLine = existing
      ? { ...existing, quantity: q }
      : { slug, quantity: q };
    onInventoryChange([...rest, line]);
  };

  // Add a custom (not-in-catalog) item as a distinct line with a unique slug.
  const addCustomItem = (label: string, size: OfficeCustomSizeSlug, qty: number) => {
    const clean = label.trim();
    if (!clean || qty <= 0) return;
    const slug = `custom:${Date.now().toString(36)}:${clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24)}`;
    onInventoryChange([
      ...inventory,
      { slug, quantity: Math.floor(qty), custom: { label: clean, size } },
    ]);
  };

  // Residential-style catalog UI: category tabs + quick-add + search, showing
  // only the items actually added. The live estimate lives on the generate
  // screen, so it is intentionally not rendered here.
  const [activeCat, setActiveCat] = useState<OfficeItemCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAllQuickAdd, setShowAllQuickAdd] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const quickAddItems = useMemo(
    () =>
      PICKABLE_CATALOG.filter(
        (it) => activeCat === "all" || it.category === activeCat,
      ),
    [activeCat],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return PICKABLE_CATALOG.filter((it) =>
      it.label.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [search]);

  // Everything the operator has added, in insertion order — resolves each line
  // to its catalog OR custom item so custom entries render alongside the rest.
  const selectedLines = useMemo(
    () =>
      inventory
        .filter((l) => Math.max(0, l.quantity) > 0)
        .map((line) => ({ line, item: officeLineItem(line) }))
        .filter((x): x is { line: OfficeInventoryLine; item: NonNullable<typeof x.item> } => x.item != null),
    [inventory],
  );
  const totalUnits = useMemo(
    () => inventory.reduce((s, l) => s + Math.max(0, l.quantity), 0),
    [inventory],
  );

  const patchCtx = (patch: Partial<OfficeQuoteContext>) =>
    onContextChange({ ...context, ...patch });

  // Local UI state for the bulk-paste + preset shortcuts.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkUnmatched, setBulkUnmatched] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Local UI state for the custom-item entry row.
  const [customName, setCustomName] = useState("");
  const [customSize, setCustomSize] = useState<OfficeCustomSizeSlug>("custom_medium");
  const [customQty, setCustomQty] = useState(1);

  /** Replace inventory with the supplied lines (used by presets). */
  const replaceWith = (next: OfficeInventoryLine[]) => {
    onInventoryChange(next);
    setBulkUnmatched([]);
    setBulkMessage(null);
  };

  /** Merge bulk-paste lines on top of whatever is already there (additive).
   *  Catalog lines merge by slug; custom lines carry unique slugs so they add
   *  as distinct entries, keeping their label + size payload. */
  const mergeLines = (incoming: OfficeInventoryLine[]) => {
    const bySlug = new Map<string, OfficeInventoryLine>();
    for (const l of inventory) bySlug.set(l.slug, { ...l });
    for (const l of incoming) {
      const prev = bySlug.get(l.slug);
      bySlug.set(l.slug, prev ? { ...prev, quantity: prev.quantity + l.quantity } : { ...l });
    }
    onInventoryChange([...bySlug.values()].filter((l) => l.quantity > 0));
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
                  const parsed = parseOfficeBulkInventory(bulkText);
                  if (parsed.lines.length === 0) {
                    setBulkUnmatched(parsed.unrecognized);
                    setBulkMessage("No items recognized. Check the format.");
                    return;
                  }
                  mergeLines(parsed.lines);
                  setBulkUnmatched(parsed.unrecognized);
                  const parts: string[] = [];
                  if (parsed.matched.length > 0)
                    parts.push(
                      `matched ${parsed.matched.length} item${parsed.matched.length === 1 ? "" : "s"}`,
                    );
                  if (parsed.customCreated.length > 0)
                    parts.push(
                      `${parsed.customCreated.length} added as custom (${parsed.customCreated
                        .map((c) => c.label)
                        .join(", ")})`,
                    );
                  if (parsed.unrecognized.length > 0)
                    parts.push(
                      `${parsed.unrecognized.length} line${parsed.unrecognized.length === 1 ? "" : "s"} unreadable (see below)`,
                    );
                  setBulkMessage(parts.join(" · ") || "Nothing to add.");
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

      {/* ── Catalog: category tabs + quick-add + search, only-added list ── */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
            Equipment &amp; furniture
          </h3>
          {totalUnits > 0 && (
            <span className="text-[10px] text-[var(--tx3)] tabular-nums">
              {totalUnits} item{totalUnits === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...CATEGORY_ORDER] as (OfficeItemCategory | "all")[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveCat(cat);
                setShowAllQuickAdd(false);
              }}
              className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
                activeCat === cat
                  ? "bg-[var(--admin-primary-fill)]/15 text-[var(--tx)] border-[var(--admin-primary-fill)]"
                  : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
              }`}
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Quick-add chips for the active category */}
        {(() => {
          const LIMIT = 16;
          const visible = showAllQuickAdd ? quickAddItems : quickAddItems.slice(0, LIMIT);
          return (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {visible.map((item) => {
                  const qty = qtyBySlug.get(item.slug) ?? 0;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => setQty(item.slug, qty + 1)}
                      title={item.label}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
                        qty > 0
                          ? "bg-[var(--admin-primary-fill)]/15 text-[var(--tx)] border-[var(--admin-primary-fill)]"
                          : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                      }`}
                    >
                      <Plus className="w-2.5 h-2.5 shrink-0" weight="bold" aria-hidden />
                      {item.label}
                      {qty > 0 && <span className="ml-0.5 tabular-nums">×{qty}</span>}
                    </button>
                  );
                })}
              </div>
              {quickAddItems.length > LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllQuickAdd((v) => !v)}
                  className="text-[9px] text-[var(--tx3)] hover:text-[var(--tx2)]"
                >
                  {showAllQuickAdd ? "Show less" : `Show all ${quickAddItems.length}`}
                </button>
              )}
            </div>
          );
        })()}

        {/* Search anything in the catalog */}
        <div ref={searchRef} className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tx2)]"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search items (desk, filing cabinet, server rack...)"
            aria-label="Search office inventory"
            className="h-9 w-full rounded-lg border border-[var(--brd)] bg-[var(--card)] pl-9 pr-3 text-[12px] text-[var(--tx)]"
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
              {searchResults.map((item) => {
                const qty = qtyBySlug.get(item.slug) ?? 0;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => {
                      setQty(item.slug, qty + 1);
                      setSearch("");
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)]/50 last:border-0 flex items-center justify-between gap-3"
                  >
                    <span>{item.label}</span>
                    <span className="text-[9px] uppercase tracking-wide text-[var(--tx3)] shrink-0">
                      {CATEGORY_LABELS[item.category]}
                      {qty > 0 ? ` · ×${qty}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Boxes quick-range + custom item entry */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
              Boxes (estimate)
            </span>
            <select
              value={qtyBySlug.get("box") ?? 0}
              onChange={(e) => setQty("box", Number(e.target.value))}
              className="h-7 rounded border border-[var(--brd)] bg-[var(--card)] px-1.5 text-[11px] text-[var(--tx)]"
            >
              {BOX_RANGES.map((r) => (
                <option key={r.label} value={r.value}>{r.label}</option>
              ))}
              {/* Preserve a bulk/manual box count that isn't a range midpoint. */}
              {(() => {
                const q = qtyBySlug.get("box") ?? 0;
                return q > 0 && !BOX_RANGES.some((r) => r.value === q) ? (
                  <option value={q}>{`Exact: ${q}`}</option>
                ) : null;
              })()}
            </select>
          </label>
        </div>

        {/* Add a custom item that isn't in the catalog. */}
        <div className="rounded-lg border border-dashed border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
            Add a custom item
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Item name (e.g. antique safe)"
              className="h-7 flex-1 min-w-[160px] rounded border border-[var(--brd)] bg-[var(--card)] px-2 text-[11px] text-[var(--tx)]"
            />
            <select
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value as OfficeCustomSizeSlug)}
              className="h-7 rounded border border-[var(--brd)] bg-[var(--card)] px-1.5 text-[11px] text-[var(--tx)]"
              aria-label="Custom item size"
            >
              {OFFICE_CUSTOM_SIZE_SLUGS.map((s) => (
                <option key={s} value={s}>{CUSTOM_SIZE_LABELS[s]}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={customQty}
              onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value || 1)))}
              className="h-7 w-14 rounded border border-[var(--brd)] bg-[var(--card)] px-2 text-[11px] text-[var(--tx)] tabular-nums"
              aria-label="Custom item quantity"
            />
            <button
              type="button"
              disabled={!customName.trim()}
              onClick={() => {
                addCustomItem(customName, customSize, customQty);
                setCustomName("");
                setCustomSize("custom_medium");
                setCustomQty(1);
              }}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-md bg-[var(--admin-primary-fill)] text-[var(--card)] text-[10px] font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" weight="bold" aria-hidden />
              Add
            </button>
          </div>
          <p className="text-[9px] text-[var(--tx3)] leading-snug">
            Size sets the labour weight. Bulk-paste lines we don&apos;t recognize
            are added here as medium custom items automatically.
          </p>
        </div>

        {/* What's been added — catalog and custom, each with a stepper */}
        {selectedLines.length > 0 ? (
          <div className="space-y-1.5 pt-0.5">
            {selectedLines.map(({ line, item }) => {
              const qty = line.quantity;
              const isCustom = !!line.custom;
              return (
                <div
                  key={line.slug}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)] px-3 py-1.5"
                >
                  <span className="text-[11px] font-medium text-[var(--tx)] leading-snug min-w-0 truncate flex items-center gap-1.5">
                    {item.label}
                    {isCustom && (
                      <span className="text-[8px] uppercase tracking-wide text-[var(--admin-primary-fill)] border border-[var(--admin-primary-fill)]/40 rounded px-1 py-px shrink-0">
                        Custom · {CUSTOM_SIZE_LABELS[line.custom!.size]}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Remove one ${item.label}`}
                      onClick={() => setQty(line.slug, qty - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"
                    >
                      <Minus className="h-3 w-3" weight="bold" aria-hidden />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => setQty(line.slug, Number(e.target.value || 0))}
                      className="h-6 w-12 rounded border border-[var(--brd)] bg-[var(--card)] text-center text-[11px] text-[var(--tx)] tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label={`Add one ${item.label}`}
                      onClick={() => setQty(line.slug, qty + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-[var(--admin-primary-fill)] bg-[var(--admin-primary-fill)]/10 text-[var(--tx)] hover:bg-[var(--admin-primary-fill)]/20"
                    >
                      <Plus className="h-3 w-3" weight="bold" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-[var(--tx3)] italic pt-0.5">
            No items yet. Pick a preset above, tap a category chip, search, or add a custom item.
          </p>
        )}
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

      {/* ── Building access (origin + destination) ── */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-3 py-3 space-y-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)]">
            Building access
          </p>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5 leading-snug max-w-xl">
            Floors, elevators, docks, and carries at each end. Priced as a
            surcharge added equally to all three tiers, plus scheduling flags.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SiteAccessFields
            title="Origin building"
            value={context.originAccess ?? {}}
            onChange={(next) => patchCtx({ originAccess: next })}
          />
          <SiteAccessFields
            title="Destination building"
            value={context.destAccess ?? {}}
            onChange={(next) => patchCtx({ destAccess: next })}
          />
        </div>
      </div>

    </div>
  );
}
