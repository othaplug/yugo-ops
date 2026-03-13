"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, Plus, Minus, Package, ChevronDown, StickyNote } from "lucide-react";
import { estimateLabourFromScore } from "@/lib/inventory-labour";

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors";

export interface InventoryItemEntry {
  slug?: string;
  name: string;
  quantity: number;
  weight_score: number;
  defaultWeight?: number;   // original DB weight — preserved when coordinator overrides
  weightNote?: string;      // free-text note, e.g. "400 lbs, baby grand"
  room?: string;
  isCustom?: boolean;
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

const CUSTOM_WEIGHT_OPTS = [
  { label: "Light", value: 0.5 },
  { label: "Medium", value: 1.0 },
  { label: "Heavy", value: 2.0 },
  { label: "Extra Heavy", value: 3.0 },
] as const;

/** All selectable weight values for the override picker */
const WEIGHT_OVERRIDE_OPTS = [
  { label: "Very Light (0.3)", value: 0.3 },
  { label: "Light (0.5)", value: 0.5 },
  { label: "Medium (1.0)", value: 1.0 },
  { label: "Mod. Heavy (1.5)", value: 1.5 },
  { label: "Heavy (2.0)", value: 2.0 },
  { label: "Very Heavy (2.5)", value: 2.5 },
  { label: "Extra Heavy (3.0)", value: 3.0 },
] as const;

/** Short label shown on the weight badge chip */
function weightLabel(score: number): string {
  if (score <= 0.3) return "V.Light";
  if (score <= 0.5) return "Light";
  if (score <= 1.0) return "Medium";
  if (score <= 1.5) return "Mod.Heavy";
  if (score <= 2.0) return "Heavy";
  if (score <= 2.5) return "V.Heavy";
  return "Extra Heavy";
}

function weightChipClass(score: number): string {
  if (score >= 3.0) return "bg-red-500/15 text-red-400 border-red-400/40";
  if (score >= 2.0) return "bg-orange-500/15 text-orange-400 border-orange-400/40";
  if (score >= 1.0) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
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
}: InventoryInputProps) {
  const [activeRoom, setActiveRoom] = useState<string>("bedroom");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customWeight, setCustomWeight] = useState(1.0);
  const [editingWeightKey, setEditingWeightKey] = useState<string | null>(null);
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [customBoxInput, setCustomBoxInput] = useState("");
  const [showCustomBox, setShowCustomBox] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const weightSelectRef = useRef<HTMLSelectElement>(null);

  const activeItems = useMemo(() => {
    const active = itemWeights.filter((w) => w.active !== false);
    if (activeRoom === "all") return active;
    return active.filter((w) => (w.room || "other") === activeRoom);
  }, [itemWeights, activeRoom]);

  const sortedItems = useMemo(() => {
    return [...activeItems].sort((a, b) => {
      if (a.is_common && !b.is_common) return -1;
      if (!a.is_common && b.is_common) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }, [activeItems]);

  const filteredSearch = useMemo(() => {
    if (!search || search.length < 1) return sortedItems;
    const q = search.toLowerCase();
    return itemWeights.filter(
      (w) =>
        w.active !== false &&
        (w.item_name.toLowerCase().includes(q) ||
          w.slug.includes(q) ||
          (w.category || "").toLowerCase().includes(q) ||
          (w.room || "").toLowerCase().includes(q))
    );
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
    (w: ItemWeightRow) => {
      const entry: InventoryItemEntry = {
        slug: w.slug,
        name: w.item_name,
        quantity: 1,
        weight_score: Number(w.weight_score),
        room: w.room || "other",
      };
      const existing = value.find((i) => i.slug === w.slug);
      if (existing) {
        onChange(
          value.map((i) =>
            i.slug === w.slug ? { ...i, quantity: i.quantity + 1 } : i
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
      weight_score: customWeight,
      isCustom: true,
      room: "other",
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
  }, [customName, customWeight, value, onChange]);

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

  /** Override the weight_score on an existing item. Preserves original as defaultWeight. */
  const updateWeight = useCallback(
    (key: string, newScore: number) => {
      onChange(
        value.map((i) => {
          if (itemKey(i) !== key) return i;
          const defaultWeight = i.defaultWeight ?? i.weight_score;
          return { ...i, weight_score: newScore, defaultWeight };
        })
      );
      setEditingWeightKey(null);
    },
    [value, onChange]
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
    () => value.reduce((sum, i) => sum + i.weight_score * i.quantity, 0),
    [value]
  );

  const boxScore = (boxCount ?? 0) * 0.3;
  const totalScore = inventoryScore + boxScore;

  const totalItems = useMemo(
    () => value.reduce((sum, i) => sum + i.quantity, 0),
    [value]
  );

  const labourEstimate = useMemo(() => {
    if (!showLabourEstimate || totalScore <= 0) return null;
    return estimateLabourFromScore(totalScore, distanceKm, fromAccess, toAccess);
  }, [showLabourEstimate, totalScore, distanceKm, fromAccess, toAccess]);

  const internalBoxCount = boxCount ?? 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
          Client Inventory
        </h3>
        {(value.length > 0 || internalBoxCount > 0) && (
          <span className="text-[10px] text-[var(--tx3)]">
            {totalItems} items · Score {totalScore.toFixed(1)}
          </span>
        )}
      </div>

      {/* Room tabs */}
      <div className="flex flex-wrap gap-1.5">
        {ROOM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveRoom(tab.id)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
              activeRoom === tab.id
                ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
                : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick-add buttons per room */}
      <div className="flex flex-wrap gap-1.5">
        {sortedItems.map((w) => {
          const existing = value.find((i) => i.slug === w.slug);
          return (
            <button
              key={w.slug}
              type="button"
              onClick={() => addItem(w)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${
                existing
                  ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
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

      {/* Search input */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--tx3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search items (sofa, bed, TV, fridge…)"
            className={`${fieldInput} pl-8`}
          />
        </div>
        {showDropdown && filteredSearch.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
            {filteredSearch.map((w) => (
              <button
                key={w.slug}
                type="button"
                onClick={() => addItem(w)}
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

      {/* Custom item input */}
      <div className="border-t border-[var(--brd)]/30 pt-3 space-y-2">
        <p className="text-[9px] text-[var(--tx3)]">Can&apos;t find an item?</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[8px] text-[var(--tx3)] mb-0.5">Item name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
              placeholder="e.g. Patio Set (wicker)"
              className={fieldInput}
            />
          </div>
          <div className="w-28">
            <label className="block text-[8px] text-[var(--tx3)] mb-0.5">Weight</label>
            <select
              value={customWeight}
              onChange={(e) => setCustomWeight(Number(e.target.value))}
              className={fieldInput}
            >
              {CUSTOM_WEIGHT_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addCustomItem}
            disabled={!customName.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
          >
            <Plus className="w-[12px] h-[12px]" /> Add Custom Item
          </button>
        </div>
      </div>

      {/* Box count */}
      {onBoxCountChange !== undefined && (
        <div className="border-t border-[var(--brd)]/30 pt-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Package className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0" />
            <label className="text-[9px] text-[var(--tx3)] font-semibold uppercase tracking-wide shrink-0">
              Boxes / bins
            </label>
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
              className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2 py-1 text-[var(--tx)] outline-none"
            >
              {BOX_RANGES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {showCustomBox && (
              <div className="flex items-center gap-1">
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
                  className="w-20 text-[11px] bg-[var(--bg)] border border-[var(--gold)]/50 rounded-lg px-2 py-1 text-[var(--tx)] outline-none focus:border-[var(--gold)]"
                  autoFocus
                />
                <span className="text-[10px] text-[var(--tx3)]">boxes</span>
              </div>
            )}
            {internalBoxCount > 0 && (
              <span className="text-[9px] text-[var(--tx3)] font-mono">
                +{boxScore.toFixed(1)} score
              </span>
            )}
          </div>
        </div>
      )}

      {/* Inventory list */}
      {value.length > 0 && (
        <div className="space-y-1 pt-1">
          {value.map((item) => {
            const key = itemKey(item);
            const isWeightEditing = editingWeightKey === key;
            const isNoteEditing = editingNoteKey === key;
            const isOverridden =
              item.defaultWeight !== undefined &&
              item.defaultWeight !== item.weight_score;

            return (
              <div key={key} className="space-y-0.5">
                {/* Main row */}
                <div className="flex items-center gap-2 py-1 group">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.weight_score >= 2
                        ? "bg-orange-400"
                        : item.weight_score <= 0.5
                          ? "bg-[var(--tx3)]"
                          : "bg-[var(--gold)]"
                    }`}
                  />
                  <span className="text-[11px] text-[var(--tx)] flex-1 truncate min-w-0">
                    {item.name}
                    {item.isCustom && (
                      <span className="text-[var(--tx3)] ml-1 text-[9px]">(custom)</span>
                    )}
                  </span>

                  {/* Weight override badge */}
                  {isWeightEditing ? (
                    <select
                      ref={weightSelectRef}
                      autoFocus
                      value={item.weight_score}
                      onChange={(e) => updateWeight(key, Number(e.target.value))}
                      onBlur={() => setEditingWeightKey(null)}
                      className="text-[9px] bg-[var(--card)] border border-[var(--gold)] rounded px-1 py-0.5 text-[var(--tx)] outline-none"
                    >
                      {item.defaultWeight !== undefined &&
                        item.defaultWeight !== item.weight_score && (
                          <option value={item.defaultWeight}>
                            Reset to default ({item.defaultWeight})
                          </option>
                        )}
                      {WEIGHT_OVERRIDE_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      title="Click to adjust weight"
                      onClick={() => setEditingWeightKey(key)}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[8px] font-semibold transition-colors hover:opacity-80 ${weightChipClass(item.weight_score)}`}
                    >
                      {weightLabel(item.weight_score)}
                      {isOverridden && (
                        <span className="text-[var(--gold)] ml-0.5" title="Weight adjusted">✱</span>
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
                        ? "text-[var(--gold)]"
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
      {value.length === 0 && internalBoxCount === 0 && (
        <p className="text-[10px] text-[var(--tx3)] italic">
          No inventory added — standard volume assumed for pricing.
        </p>
      )}
      {value.length === 0 && internalBoxCount > 0 && (
        <p className="text-[10px] text-[var(--tx3)]">
          {internalBoxCount} boxes only · Score {boxScore.toFixed(1)}
        </p>
      )}
    </div>
  );
}
