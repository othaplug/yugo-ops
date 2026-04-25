"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { MagnifyingGlass as Search, Plus, Minus, CaretDown as ChevronDown, Note as StickyNote } from "@phosphor-icons/react";
import { estimateLabourFromScore } from "@/lib/inventory-labour";
import { validateInventoryQuantity } from "@/lib/inventory-quantity-validation";
import {
  fuzzyFilterItemWeights,
  matchPastedLineToItem,
  nameImpliesFragile,
  parseQuantityFromLine,
  type MatchConfidence,
} from "@/lib/inventory-search";
import {
  getWeightTier,
  inferWeightTierFromLegacyScore,
  normalizeB2bWeightCategory,
  residentialInventoryLineScore,
  tierRequiresActualWeight,
  weightTierSelectOptions,
} from "@/lib/pricing/weight-tiers";

const fieldInput = "field-input-compact w-full";

export interface InventoryItemEntry {
  slug?: string;
  name: string;
  quantity: number;
  weight_score: number;
  defaultWeight?: number;   // original DB weight, preserved when coordinator overrides
  /** Canonical weight tier; when unset, inferred from weight_score for scoring. */
  weight_tier_code?: string;
  actual_weight_lbs?: number;
  weightNote?: string;      // free-text note, e.g. "400 lbs, baby grand"
  room?: string;
  isCustom?: boolean;
  /** Coordinator / auto: high-care handling */
  fragile?: boolean;
  /** Multi-pickup quote: which pickup index this line belongs to (0-based). */
  origin_index?: number;
}

export interface ItemWeightRow {
  id?: string;
  slug: string;
  item_name: string;
  weight_score: number;
  category: string;
  room?: string;
  is_common: boolean;
  display_order?: number;
  active?: boolean;
}

const ROOM_TABS = [
  { id: "bedroom", label: "Bedroom" },
  { id: "living_room", label: "Living Room" },
  { id: "dining_room", label: "Dining" },
  { id: "kitchen", label: "Kitchen" },
  { id: "office", label: "Office" },
  { id: "outdoor", label: "Outdoor" },
  { id: "kids", label: "Kids" },
  { id: "garage", label: "Garage" },
  { id: "specialty", label: "Specialty" },
  { id: "all", label: "All" },
] as const;

const COMMERCIAL_ROOM_TABS = [
  { id: "office", label: "Office" },
  { id: "specialty", label: "Specialty" },
  { id: "all", label: "All" },
] as const;

const RES_WEIGHT_TIER_OPTS = weightTierSelectOptions();

/** Short label shown on the weight tier chip */
function tierChipLabel(item: InventoryItemEntry): string {
  const code =
    item.weight_tier_code != null && item.weight_tier_code !== ""
      ? normalizeB2bWeightCategory(item.weight_tier_code)
      : inferWeightTierFromLegacyScore(item.weight_score);
  return getWeightTier(code)?.label ?? code;
}

function weightChipClass(item: InventoryItemEntry): string {
  const code =
    item.weight_tier_code != null && item.weight_tier_code !== ""
      ? normalizeB2bWeightCategory(item.weight_tier_code)
      : inferWeightTierFromLegacyScore(item.weight_score);
  const t = getWeightTier(code);
  const f = t?.priceFactor ?? 1;
  if (f >= 2) return "bg-red-500/15 text-red-400 border-red-400/40";
  if (f >= 1.35) return "bg-orange-500/15 text-orange-400 border-orange-400/40";
  if (f > 1) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
  return "bg-[var(--bg)] text-[var(--tx3)] border-[var(--brd)]";
}

function itemKey(item: InventoryItemEntry): string {
  if (item.slug) return item.slug;
  return `custom-${item.name}`;
}

const BOX_RANGES = [
  { label: "No boxes", value: 0 },
  { label: "1–5 boxes", value: 5 },
  { label: "5–10 boxes", value: 10 },
  { label: "10–20 boxes", value: 20 },
  { label: "20–30 boxes", value: 30 },
  { label: "30–40 boxes", value: 40 },
  { label: "40–50 boxes", value: 50 },
  { label: "50–100 boxes", value: 75 },
  { label: "Custom amount…", value: -1 },
] as const;

interface InventoryInputProps {
  itemWeights: ItemWeightRow[];
  value: InventoryItemEntry[];
  onChange: (items: InventoryItemEntry[]) => void;
  moveSize?: string;
  distanceKm?: number;
  fromAccess?: string;
  toAccess?: string;
  showLabourEstimate?: boolean;
  /** Controlled box count (midpoint of range) */
  boxCount?: number;
  onBoxCountChange?: (n: number) => void;
  /** commercial = office/commercial move, residential = default household move */
  mode?: "residential" | "commercial";
  /** When true, only show add UI (room tabs, quick-add, search); hide empty state and selected list (for move detail quick-add) */
  addOnlyMode?: boolean;
}

export default function InventoryInput({
  itemWeights,
  value,
  onChange,
  moveSize,
  distanceKm = 0,
  fromAccess,
  toAccess,
  showLabourEstimate = false,
  boxCount,
  onBoxCountChange,
  mode = "residential",
  addOnlyMode = false,
}: InventoryInputProps) {
  const isCommercial = mode === "commercial";
  const [activeRoom, setActiveRoom] = useState<string>(isCommercial ? "office" : "bedroom");
  const [showAllItems, setShowAllItems] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customTier, setCustomTier] = useState<string>("standard");
  const [editingWeightKey, setEditingWeightKey] = useState<string | null>(null);
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [customBoxInput, setCustomBoxInput] = useState("");
  const [showCustomBox, setShowCustomBox] = useState(false);
  const [quantityOverriddenKeys, setQuantityOverriddenKeys] = useState<Set<string>>(new Set());
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  type PasteRow = {
    id: string;
    raw: string;
    parsedName: string;
    qty: number;
    match: ItemWeightRow | null;
    confidence: MatchConfidence;
  };
  const [pasteRows, setPasteRows] = useState<PasteRow[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const weightSelectRef = useRef<HTMLSelectElement>(null);

  const activeItems = useMemo(() => {
    const active = itemWeights.filter((w) => w.active !== false);
    if (activeRoom === "all") {
      if (isCommercial) {
        const commercialRooms = COMMERCIAL_ROOM_TABS.filter((t) => t.id !== "all").map((t) => t.id);
        return active.filter((w) => (commercialRooms as readonly string[]).includes(w.room || "other"));
      }
      return active;
    }
    return active.filter((w) => (w.room || "other") === activeRoom);
  }, [itemWeights, activeRoom, isCommercial]);

  const sortedItems = useMemo(() => {
    return [...activeItems].sort((a, b) => {
      if (a.is_common && !b.is_common) return -1;
      if (!a.is_common && b.is_common) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }, [activeItems]);

  const filteredSearch = useMemo(() => {
    if (!search || search.length < 1) return sortedItems;
    const { name: qName } = parseQuantityFromLine(search);
    const q = (qName.trim() || search).trim();
    if (!q) return sortedItems;
    return fuzzyFilterItemWeights(q, itemWeights.filter((w) => w.active !== false)).slice(0, 80);
  }, [search, itemWeights, sortedItems]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close weight select when clicking outside
  useEffect(() => {
    if (!editingWeightKey) return;
    const handler = (e: MouseEvent) => {
      if (weightSelectRef.current && !weightSelectRef.current.contains(e.target as Node)) {
        setEditingWeightKey(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingWeightKey]);

  const addItem = useCallback(
    (w: ItemWeightRow, qty = 1) => {
      const fragile = nameImpliesFragile(w.item_name);
      const ws = Number(w.weight_score);
      const entry: InventoryItemEntry = {
        slug: w.slug,
        name: w.item_name,
        quantity: qty,
        weight_score: ws,
        weight_tier_code: inferWeightTierFromLegacyScore(ws),
        room: w.room || "other",
        fragile,
      };
      const existing = value.find((i) => i.slug === w.slug);
      if (existing) {
        onChange(
          value.map((i) =>
            i.slug === w.slug ? { ...i, quantity: i.quantity + qty, fragile: i.fragile || fragile } : i
          )
        );
      } else {
        onChange([...value, entry]);
      }
      setSearch("");
      setShowDropdown(false);
    },
    [value, onChange]
  );

  const addCustomItem = useCallback(() => {
    const name = customName.trim();
    if (!name) return;
    const entry: InventoryItemEntry = {
      name,
      quantity: 1,
      weight_score: 1,
      weight_tier_code: normalizeB2bWeightCategory(customTier),
      isCustom: true,
      room: "other",
      fragile: nameImpliesFragile(name),
    };
    const key = itemKey(entry);
    const existing = value.find((i) => itemKey(i) === key);
    if (existing) {
      onChange(
        value.map((i) =>
          itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      onChange([...value, entry]);
    }
    setCustomName("");
  }, [customName, customTier, value, onChange]);

  const updateQty = useCallback(
    (key: string, delta: number) => {
      onChange(
        value.map((i) => {
          if (itemKey(i) !== key) return i;
          const qty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: qty };
        })
      );
    },
    [value, onChange]
  );

  const updateWeightTier = useCallback(
    (key: string, tierRaw: string) => {
      const tierCode = normalizeB2bWeightCategory(tierRaw);
      onChange(
        value.map((i) => {
          if (itemKey(i) !== key) return i;
          const defaultWeight = i.defaultWeight ?? i.weight_score;
          const next: InventoryItemEntry = {
            ...i,
            weight_tier_code: tierCode,
            defaultWeight,
          };
          if (!tierRequiresActualWeight(tierCode)) {
            delete next.actual_weight_lbs;
          }
          return next;
        }),
      );
      setEditingWeightKey(null);
    },
    [value, onChange],
  );

  const updateActualWeightLbs = useCallback(
    (key: string, lbs: number | undefined) => {
      onChange(
        value.map((i) => {
          if (itemKey(i) !== key) return i;
          return {
            ...i,
            actual_weight_lbs:
              lbs != null && Number.isFinite(lbs) && lbs > 0 ? Math.round(lbs) : undefined,
          };
        }),
      );
    },
    [value, onChange],
  );

  const updateNote = useCallback(
    (key: string, note: string) => {
      onChange(
        value.map((i) =>
          itemKey(i) === key ? { ...i, weightNote: note } : i
        )
      );
    },
    [value, onChange]
  );

  const removeItem = useCallback(
    (key: string) => {
      onChange(value.filter((i) => itemKey(i) !== key));
      if (editingWeightKey === key) setEditingWeightKey(null);
      if (editingNoteKey === key) setEditingNoteKey(null);
    },
    [value, onChange, editingWeightKey, editingNoteKey]
  );

  const inventoryScore = useMemo(
    () => value.reduce((sum, i) => sum + residentialInventoryLineScore(i), 0),
    [value],
  );

  const boxScore = (boxCount ?? 0) * 0.3;
  const totalScore = inventoryScore + boxScore;
  // Labour estimate uses lower box weight (0.15): boxes move in batches on dollies; volume/modifier still use 0.3.
  const labourScore = totalScore - (boxCount ?? 0) * 0.15;

  const totalItems = useMemo(
    () => value.reduce((sum, i) => sum + i.quantity, 0),
    [value]
  );

  const labourEstimate = useMemo(() => {
    if (!showLabourEstimate || labourScore <= 0) return null;
    return estimateLabourFromScore(labourScore, distanceKm, fromAccess, toAccess, moveSize, {
      hoursEstimateMode: "client_on_job",
    });
  }, [showLabourEstimate, labourScore, distanceKm, fromAccess, toAccess, moveSize]);

  const internalBoxCount = boxCount ?? 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
          {isCommercial ? "Equipment & Furniture" : "Client Inventory"}
        </h3>
        {!addOnlyMode && (value.length > 0 || internalBoxCount > 0) && (
          <span className="text-[10px] text-[var(--tx3)]">
            {totalItems} items{internalBoxCount > 0 ? ` + ${internalBoxCount} boxes` : ""} · Score {totalScore.toFixed(1)}
          </span>
        )}
      </div>

      {/* Room tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(isCommercial ? COMMERCIAL_ROOM_TABS : ROOM_TABS).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveRoom(tab.id); setShowAllItems(false); }}
            className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
              activeRoom === tab.id
                ? "bg-[var(--gold)]/20 text-[var(--accent-text)] border-[var(--gold)]"
                : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick-add buttons per room */}
      {(() => {
        const LIMIT = 14;
        const visibleItems = showAllItems ? sortedItems : sortedItems.slice(0, LIMIT);
        const hiddenCount = sortedItems.length - LIMIT;
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {visibleItems.map((w) => {
                const existing = value.find((i) => i.slug === w.slug);
                return (
                  <button
                    key={w.slug}
                    type="button"
                    onClick={() => addItem(w)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
                      existing
                        ? "bg-[var(--gold)]/20 text-[var(--accent-text)] border-[var(--gold)]"
                        : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"
                    }`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {w.item_name.split(" / ")[0].split(" (")[0]}
                    {existing && (
                      <span className="ml-0.5 tabular-nums">×{existing.quantity}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {sortedItems.length > LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllItems((v) => !v)}
                className="inline-flex items-center gap-1 text-[9px] text-[var(--tx3)] hover:text-[var(--tx2)] transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showAllItems ? "rotate-180" : ""}`} />
                {showAllItems ? "Show less" : `Show all ${sortedItems.length} items`}
              </button>
            )}
          </div>
        );
      })()}

      {/* Search input */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 shrink-0 -translate-y-1/2 text-[var(--tx2)]"
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
            placeholder={isCommercial ? "Search items (desk, filing cabinet, server rack…)" : "Search items (sofa, bed, TV, fridge…)"}
            className={`${fieldInput} field-input--leading`}
          />
        </div>
        {showDropdown && filteredSearch.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
            {filteredSearch.map((w) => (
              <button
                key={w.slug}
                type="button"
                onClick={() => {
                  const { qty } = parseQuantityFromLine(search);
                  addItem(w, Math.max(1, qty));
                }}
                className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)]/50 last:border-0 flex items-center justify-between"
              >
                <span>{w.item_name}</span>
                <span
                  className={`text-[9px] font-mono tabular-nums ${
                    Number(w.weight_score) >= 2
                      ? "text-orange-400 font-bold"
                      : Number(w.weight_score) <= 0.5
                        ? "text-[var(--tx3)]"
                        : "text-[var(--tx2)]"
                  }`}
                >
                  ×{w.weight_score}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!addOnlyMode && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPasteOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-text)] hover:text-[var(--accent-text)]/85 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]/40 rounded-sm"
          >
            <span>{pasteOpen ? "Hide paste inventory" : "Paste inventory list"}</span>
            <span className="font-bold leading-none" aria-hidden>
              &gt;
            </span>
          </button>
          {pasteOpen && (
            <div className="rounded-lg border border-[var(--brd)] p-3 space-y-2 bg-[var(--card)]">
              <p className="text-[9px] text-[var(--tx3)] leading-snug">
                Paste one item per line. Quantities: &quot;4 dining chairs&quot; or &quot;sofa x2&quot;.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                placeholder={"dining table x1\n4 dining chairs\nqueen bed with headboard"}
                className={`${fieldInput} resize-y min-h-[100px]`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const lines = pasteText.split(/\n/).map((l) => l.trim()).filter(Boolean);
                    const rows: PasteRow[] = lines.map((raw, i) => {
                      const { name, qty } = parseQuantityFromLine(raw);
                      const { item, confidence } = matchPastedLineToItem(name, itemWeights);
                      return { id: `p${i}`, raw, parsedName: name, qty, match: item, confidence };
                    });
                    setPasteRows(rows);
                  }}
                  className="admin-btn admin-btn-sm admin-btn-primary"
                >
                  Parse &amp; map items
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasteText("");
                    setPasteRows([]);
                  }}
                  className="text-[10px] text-[var(--tx3)] hover:text-[var(--tx)]"
                >
                  Clear
                </button>
              </div>
              {pasteRows.length > 0 && (
                <div className="space-y-1 max-h-52 overflow-y-auto border border-[var(--brd)]/50 rounded-md p-2">
                  {pasteRows.map((row) => (
                    <div
                      key={row.id}
                      className="text-[10px] flex flex-wrap gap-x-2 gap-y-0.5 items-baseline border-b border-[var(--brd)]/30 last:border-0 py-1.5"
                    >
                      <span className="text-[var(--tx2)] shrink-0">{row.raw}</span>
                      <span className="text-[var(--tx3)]">→</span>
                      {row.match ? (
                        <span className="text-[var(--tx)] font-medium">{row.match.item_name}</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">No match, add manually from search</span>
                      )}
                      <span className="text-[var(--tx3)] ml-auto">×{row.qty}</span>
                      <span className="text-[var(--tx3)] uppercase">({row.confidence})</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...value];
                      for (const row of pasteRows) {
                        if (!row.match) continue;
                        const fragile = nameImpliesFragile(row.match.item_name);
                        const existing = next.find((i) => i.slug === row.match!.slug);
                        if (existing) {
                          const idx = next.indexOf(existing);
                          next[idx] = {
                            ...existing,
                            quantity: existing.quantity + row.qty,
                            fragile: existing.fragile || fragile,
                          };
                        } else {
                          const ws = Number(row.match.weight_score);
                          next.push({
                            slug: row.match.slug,
                            name: row.match.item_name,
                            quantity: row.qty,
                            weight_score: ws,
                            weight_tier_code: inferWeightTierFromLegacyScore(ws),
                            room: row.match.room || "other",
                            fragile,
                          });
                        }
                      }
                      onChange(next);
                      setPasteOpen(false);
                      setPasteText("");
                      setPasteRows([]);
                    }}
                    className="admin-btn admin-btn-sm admin-btn-primary mt-2 w-full"
                  >
                    Add matched items to inventory
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom item input + weight (related); box estimate on its own row */}
      <div className="border-t border-[var(--brd)]/30 pt-3 space-y-3">
        <p className="text-[10px] text-[var(--tx2)]">Can&apos;t find an item?</p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--tx2)]">
                Item name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
                placeholder={isCommercial ? "e.g. Standing desk, Server rack" : "e.g. Patio Set (wicker)"}
                className={fieldInput}
              />
            </div>
            <div className="w-full shrink-0 sm:min-w-[11rem] sm:max-w-[14rem]">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--tx2)]">
                Weight range
              </label>
              <select
                value={normalizeB2bWeightCategory(customTier)}
                onChange={(e) => setCustomTier(e.target.value)}
                className={fieldInput}
                aria-label="Weight range for custom item"
              >
                {RES_WEIGHT_TIER_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                    {o.shortHint !== "Base" ? ` (${o.shortHint})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {onBoxCountChange !== undefined && (
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--tx2)]">
                Box estimate
              </label>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3 sm:flex-wrap">
              {onBoxCountChange !== undefined && (
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={showCustomBox ? -1 : internalBoxCount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v === -1) {
                          setShowCustomBox(true);
                          setCustomBoxInput(internalBoxCount > 0 ? String(internalBoxCount) : "");
                        } else {
                          setShowCustomBox(false);
                          setCustomBoxInput("");
                          onBoxCountChange(v);
                        }
                      }}
                      className={`${fieldInput} min-w-[8rem] flex-1 sm:flex-initial sm:min-w-[9rem]`}
                      aria-label="Estimated number of boxes"
                    >
                      {BOX_RANGES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {showCustomBox && (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={customBoxInput}
                          onChange={(e) => {
                            setCustomBoxInput(e.target.value);
                            const n = parseInt(e.target.value, 10);
                            if (!isNaN(n) && n > 0) onBoxCountChange(n);
                          }}
                          placeholder="e.g. 120"
                          className="w-[4.5rem] rounded-md border border-[var(--gold)]/50 bg-[var(--bg)] px-2 py-1.5 text-[11px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
                          autoFocus
                        />
                        <span className="text-[10px] text-[var(--tx2)]">boxes</span>
                      </>
                    )}
                  </div>
                  {internalBoxCount > 0 && (
                    <span className="mt-1 block text-[10px] font-mono text-[var(--tx2)]">
                      +{boxScore.toFixed(1)} score
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={addCustomItem}
                disabled={!customName.trim()}
                className="admin-btn admin-btn-sm admin-btn-primary w-full shrink-0 sm:w-auto"
              >
                <Plus className="size-3.5 shrink-0" weight="bold" /> Add custom item
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory list */}
      {!addOnlyMode && value.length > 0 && (
        <div className="space-y-1 pt-1">
          {value.map((item) => {
            const key = itemKey(item);
            const isWeightEditing = editingWeightKey === key;
            const isNoteEditing = editingNoteKey === key;
            const defaultTier = inferWeightTierFromLegacyScore(
              item.defaultWeight ?? item.weight_score,
            );
            const effectiveTier =
              item.weight_tier_code != null && item.weight_tier_code !== ""
                ? normalizeB2bWeightCategory(item.weight_tier_code)
                : inferWeightTierFromLegacyScore(item.weight_score);
            const isOverridden = effectiveTier !== defaultTier;
            const qtyValidation = validateInventoryQuantity(
              item.slug || item.name || "",
              item.quantity,
              item.name,
            );
            const showQtyWarning = !qtyValidation.valid && !quantityOverriddenKeys.has(key);

            return (
              <div key={key} className="space-y-0.5">
                {/* Main row */}
                <div className="flex items-center gap-2 py-1 group">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      (getWeightTier(effectiveTier)?.priceFactor ?? 1) >= 1.35
                        ? "bg-orange-400"
                        : (getWeightTier(effectiveTier)?.priceFactor ?? 1) <= 1
                          ? "bg-[var(--tx3)]"
                          : "bg-[var(--gold)]"
                    }`}
                  />
                  <span className="text-[11px] text-[var(--tx)] flex-1 truncate min-w-0">
                    {item.name}
                    {item.isCustom && (
                      <span className="text-[var(--tx3)] ml-1 text-[9px]">(custom)</span>
                    )}
                    {item.fragile && (
                      <span className="text-amber-600 dark:text-amber-400 ml-1 text-[9px] font-semibold">· Fragile</span>
                    )}
                  </span>

                  {/* Weight override badge */}
                  {isWeightEditing ? (
                    <div className="flex flex-col gap-1 items-end min-w-[10rem]">
                      <select
                        ref={weightSelectRef}
                        autoFocus
                        value={effectiveTier}
                        onChange={(e) => updateWeightTier(key, e.target.value)}
                        onBlur={() => setEditingWeightKey(null)}
                        className="text-[9px] bg-[var(--card)] border border-[var(--gold)] rounded px-1 py-0.5 text-[var(--tx)] outline-none w-full max-w-[14rem]"
                      >
                        {isOverridden && (
                          <option value={defaultTier}>Reset to default ({getWeightTier(defaultTier)?.label})</option>
                        )}
                        {RES_WEIGHT_TIER_OPTS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {tierRequiresActualWeight(effectiveTier) && (
                        <input
                          type="number"
                          min={1}
                          placeholder="Actual lbs"
                          className="text-[9px] w-full max-w-[7rem] rounded border border-[var(--brd)] px-1 py-0.5 bg-[var(--bg)] text-[var(--tx)]"
                          value={item.actual_weight_lbs ?? ""}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            updateActualWeightLbs(
                              key,
                              Number.isFinite(n) && n > 0 ? n : undefined,
                            );
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="Click to adjust weight range"
                      onClick={() => setEditingWeightKey(key)}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors hover:opacity-80 ${weightChipClass(item)}`}
                    >
                      {tierChipLabel(item)}
                      {isOverridden && (
                        <span className="text-[var(--accent-text)] ml-0.5" title="Weight adjusted">✱</span>
                      )}
                      <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  )}

                  {/* Qty controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(key, -1)}
                      className="w-5 h-5 rounded flex items-center justify-center text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] font-medium text-[var(--tx)] w-5 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(key, 1)}
                      className="w-5 h-5 rounded flex items-center justify-center text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Note icon */}
                  <button
                    type="button"
                    title={item.weightNote ? item.weightNote : "Add weight note"}
                    onClick={() => setEditingNoteKey(isNoteEditing ? null : key)}
                    className={`shrink-0 transition-colors ${
                      item.weightNote
                        ? "text-[var(--accent-text)]"
                        : "text-[var(--tx3)] opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <StickyNote className="w-3 h-3" />
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeItem(key)}
                    className="text-[var(--tx3)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] ml-0.5 shrink-0"
                  >
                    ×
                  </button>
                </div>

                {/* FIX 1: Quantity over max, yellow warning; coordinator can override */}
                {showQtyWarning && (
                  <div className="pl-4 flex items-center gap-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px]">
                    <span className="text-amber-600 dark:text-amber-400">
                      Max {qtyValidation.maxAllowed} for {item.name || "this item"}. Did you mean 1?
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantityOverriddenKeys((prev) => new Set(prev).add(key))}
                      className="text-amber-600 dark:text-amber-400 font-semibold underline hover:no-underline"
                    >
                      Override
                    </button>
                  </div>
                )}

                {/* Note inline editor */}
                {isNoteEditing && (
                  <div className="pl-4 pb-1">
                    <input
                      autoFocus
                      type="text"
                      value={item.weightNote || ""}
                      onChange={(e) => updateNote(key, e.target.value)}
                      onBlur={() => setEditingNoteKey(null)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingNoteKey(null); }}
                      placeholder="e.g. 400 lbs marble, baby grand piano…"
                      className="w-full text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Score summary */}
          <div className="pt-2 border-t border-[var(--brd)]/50 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--tx3)]">
                Item score: {inventoryScore.toFixed(1)}
                {boxScore > 0 && (
                  <span className="ml-1 text-[var(--tx3)]/60">
                    + {boxScore.toFixed(1)} boxes = {totalScore.toFixed(1)} total
                  </span>
                )}
              </span>
              <span className="text-[var(--tx3)]">{totalItems} items</span>
            </div>
            {labourEstimate && (
              <div className="text-[10px] text-[var(--tx2)]">
                Recommended truck: <strong>{labourEstimate.truckSize}</strong> ·
                Crew: <strong>{labourEstimate.crewSize}</strong> ·
                Est. hours: <strong>{labourEstimate.hoursRange}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!addOnlyMode && value.length === 0 && internalBoxCount === 0 && (
        <p className="text-[11px] leading-snug text-[var(--tx2)]">
          No inventory added yet — standard volume is assumed for pricing.
        </p>
      )}
      {!addOnlyMode && value.length === 0 && internalBoxCount > 0 && (
        <p className="text-[10px] text-[var(--tx3)]">
          {internalBoxCount} boxes only · Score {boxScore.toFixed(1)}
        </p>
      )}
    </div>
  );
}
