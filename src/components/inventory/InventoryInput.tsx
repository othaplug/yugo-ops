"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, Plus, Minus } from "lucide-react";
import { estimateLabourFromScore } from "@/lib/inventory-labour";

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors";

export interface InventoryItemEntry {
  slug?: string;
  name: string;
  quantity: number;
  weight_score: number;
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

function itemKey(item: InventoryItemEntry): string {
  if (item.slug) return item.slug;
  return `custom-${item.name}-${item.weight_score}`;
}

interface InventoryInputProps {
  itemWeights: ItemWeightRow[];
  value: InventoryItemEntry[];
  onChange: (items: InventoryItemEntry[]) => void;
  moveSize?: string;
  distanceKm?: number;
  fromAccess?: string;
  toAccess?: string;
  showLabourEstimate?: boolean;
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
}: InventoryInputProps) {
  const [activeRoom, setActiveRoom] = useState<string>("bedroom");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customWeight, setCustomWeight] = useState(1.0);
  const searchRef = useRef<HTMLDivElement>(null);

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

  const removeItem = useCallback(
    (key: string) => {
      onChange(value.filter((i) => itemKey(i) !== key));
    },
    [value, onChange]
  );

  const inventoryScore = useMemo(() => {
    return value.reduce((sum, i) => sum + i.weight_score * i.quantity, 0);
  }, [value]);

  const totalItems = useMemo(() => {
    return value.reduce((sum, i) => sum + i.quantity, 0);
  }, [value]);

  const labourEstimate = useMemo(() => {
    if (!showLabourEstimate || inventoryScore <= 0) return null;
    return estimateLabourFromScore(inventoryScore, distanceKm, fromAccess, toAccess);
  }, [showLabourEstimate, inventoryScore, distanceKm, fromAccess, toAccess]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
          Client Inventory
        </h3>
        {value.length > 0 && (
          <span className="text-[10px] text-[var(--tx3)]">
            {totalItems} items · Score {inventoryScore.toFixed(1)}
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
            <label className="block text-[8px] text-[var(--tx3)] mb-0.5">
              Item name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Patio Set (wicker)"
              className={fieldInput}
            />
          </div>
          <div className="w-28">
            <label className="block text-[8px] text-[var(--tx3)] mb-0.5">
              Weight
            </label>
            <select
              value={customWeight}
              onChange={(e) => setCustomWeight(Number(e.target.value))}
              className={fieldInput}
            >
              {CUSTOM_WEIGHT_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
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

      {/* Inventory list */}
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((item) => {
            const key = itemKey(item);
            return (
              <div key={key} className="flex items-center gap-2 py-1 group">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.weight_score >= 2
                      ? "bg-orange-400"
                      : item.weight_score <= 0.5
                        ? "bg-[var(--tx3)]"
                        : "bg-[var(--gold)]"
                  }`}
                />
                <span className="text-[11px] text-[var(--tx)] flex-1 truncate">
                  {item.name}
                  {item.isCustom && (
                    <span className="text-[var(--tx3)] ml-1">(custom)</span>
                  )}
                </span>
                <span className="text-[9px] text-[var(--tx3)] font-mono tabular-nums">
                  ×{item.weight_score}
                </span>
                <div className="flex items-center gap-1">
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
                <button
                  type="button"
                  onClick={() => removeItem(key)}
                  className="text-[var(--tx3)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] ml-1"
                >
                  ×
                </button>
              </div>
            );
          })}
          <div className="pt-2 border-t border-[var(--brd)]/50 flex items-center justify-between text-[10px]">
            <span className="text-[var(--tx3)]">
              Item score: {inventoryScore.toFixed(1)}
            </span>
            <span className="text-[var(--tx3)]">{totalItems} items</span>
          </div>
          {labourEstimate && (
            <div className="text-[10px] text-[var(--tx3)] pt-1">
              Recommended truck: {labourEstimate.truckSize} · Estimated crew:{" "}
              {labourEstimate.crewSize} · Est. hours: {labourEstimate.hoursRange}
            </div>
          )}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-[10px] text-[var(--tx3)] italic">
          No inventory added — standard volume assumed for pricing.
        </p>
      )}
    </div>
  );
}
