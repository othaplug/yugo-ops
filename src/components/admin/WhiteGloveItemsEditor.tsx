"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, CaretRight, MagnifyingGlass as Search, Plus, Wrench } from "@phosphor-icons/react";
import type {
  WhiteGloveAssembly,
  WhiteGloveItemCategory,
  WhiteGloveWeightClass,
} from "@/lib/quotes/white-glove-pricing";
import {
  WG_ASSEMBLY_OPTIONS,
  WG_ITEM_CATEGORIES,
  WG_WEIGHT_CLASS_OPTIONS,
  WHITE_GLOVE_BROWSE_TABS,
  itemWeightMatchesWhiteGloveTab,
  whiteGloveDefaultsFromItemWeight,
  type WhiteGloveBrowseTabKey,
  type WhiteGloveItemWeightSource,
} from "@/lib/quotes/white-glove-pricing";
import {
  fuzzyFilterItemWeights,
  matchPastedLineToItem,
  nameImpliesFragile,
  parseQuantityFromLine,
  type MatchConfidence,
} from "@/lib/inventory-search";

export interface WhiteGloveItemRow {
  id: string;
  description: string;
  quantity: number;
  category: WhiteGloveItemCategory;
  weight_class: WhiteGloveWeightClass;
  assembly: WhiteGloveAssembly;
  is_fragile: boolean;
  is_high_value: boolean;
  notes: string;
  slug?: string;
  is_custom?: boolean;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function createDefaultWhiteGloveItem(): WhiteGloveItemRow {
  return {
    id: newId(),
    description: "",
    quantity: 1,
    category: "medium",
    weight_class: "50_150",
    assembly: "none",
    is_fragile: false,
    is_high_value: false,
    notes: "",
    is_custom: true,
  };
}

function quickChipLabel(itemName: string) {
  const t = itemName.trim();
  if (t.includes(" / ")) return t.split(" / ")[0].trim();
  return t.length > 42 ? `${t.slice(0, 40)}…` : t;
}

type FieldProps = { label: string; children: React.ReactNode };

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

export type WhiteGloveItemsEditorProps = {
  value: WhiteGloveItemRow[];
  onChange: (next: WhiteGloveItemRow[]) => void;
  fieldInputClass: string;
  itemWeights: WhiteGloveItemWeightSource[];
  cargoCoverageHint?: string;
  declaredValue: string;
  onDeclaredValueChange: (v: string) => void;
  debrisRemoval: boolean;
  onDebrisRemovalChange: (v: boolean) => void;
};

type PasteRow = {
  id: string;
  raw: string;
  parsedName: string;
  qty: number;
  match: WhiteGloveItemWeightSource | null;
  confidence: MatchConfidence;
};

export const WhiteGloveItemsEditor: React.FC<WhiteGloveItemsEditorProps> = ({
  value,
  onChange,
  fieldInputClass,
  itemWeights,
  cargoCoverageHint,
  declaredValue,
  onDeclaredValueChange,
  debrisRemoval,
  onDebrisRemovalChange,
}) => {
  const activeWeights = useMemo(
    () => itemWeights.filter((w) => w.active !== false),
    [itemWeights],
  );

  const [activeTab, setActiveTab] = useState<WhiteGloveBrowseTabKey>("living");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showAllChips, setShowAllChips] = useState(false);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteRows, setPasteRows] = useState<PasteRow[]>([]);

  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customCategory, setCustomCategory] = useState<WhiteGloveItemCategory>("medium");
  const [customWeightClass, setCustomWeightClass] = useState<WhiteGloveWeightClass>("50_150");

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const row of value) init[row.id] = true;
    return init;
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const tabItems = useMemo(() => {
    const pool = activeWeights.filter((w) => itemWeightMatchesWhiteGloveTab(w, activeTab));
    return [...pool].sort((a, b) => {
      const ao = (a as { display_order?: number }).display_order ?? 0;
      const bo = (b as { display_order?: number }).display_order ?? 0;
      return ao - bo;
    });
  }, [activeWeights, activeTab]);

  const visibleChips = showAllChips ? tabItems : tabItems.slice(0, 28);

  const filteredSearch = useMemo(() => {
    return fuzzyFilterItemWeights(search, activeWeights).slice(0, 80);
  }, [search, activeWeights]);

  const addOrMergeFromCatalog = useCallback(
    (src: WhiteGloveItemWeightSource, qty: number) => {
      const d = whiteGloveDefaultsFromItemWeight(src);
      const q = Math.max(1, Math.min(99, qty));
      const bySlug = value.find((r) => r.slug === d.slug);
      if (bySlug) {
        onChange(
          value.map((r) =>
            r.id === bySlug.id ? { ...r, quantity: Math.min(99, r.quantity + q) } : r,
          ),
        );
        return;
      }
      const fragileExtra = nameImpliesFragile(d.description) ? true : d.is_fragile;
      const row: WhiteGloveItemRow = {
        id: newId(),
        description: d.description,
        quantity: q,
        category: fragileExtra && d.category !== "extra_heavy" ? "fragile" : d.category,
        weight_class: d.weight_class,
        assembly: "none",
        is_fragile: fragileExtra,
        is_high_value: false,
        notes: "",
        slug: d.slug,
        is_custom: false,
      };
      onChange([...value, row]);
      setExpanded((prev) => ({ ...prev, [row.id]: true }));
    },
    [onChange, value],
  );

  /** Single state update: loop must not call onChange per row (stale `value` closures). */
  const addPasteMatchedRowsBatched = useCallback(
    (rows: PasteRow[]) => {
      const matched = rows.filter((r) => r.match);
      if (matched.length === 0) return;
      let next = [...value];
      const newExpanded: Record<string, boolean> = {};
      for (const pr of matched) {
        const d = whiteGloveDefaultsFromItemWeight(pr.match!);
        const q = Math.max(1, Math.min(99, pr.qty));
        const bySlug = next.find((r) => r.slug === d.slug);
        if (bySlug) {
          next = next.map((r) =>
            r.id === bySlug.id ? { ...r, quantity: Math.min(99, r.quantity + q) } : r,
          );
        } else {
          const fragileExtra = nameImpliesFragile(d.description) ? true : d.is_fragile;
          const row: WhiteGloveItemRow = {
            id: newId(),
            description: d.description,
            quantity: q,
            category: fragileExtra && d.category !== "extra_heavy" ? "fragile" : d.category,
            weight_class: d.weight_class,
            assembly: "none",
            is_fragile: fragileExtra,
            is_high_value: false,
            notes: "",
            slug: d.slug,
            is_custom: false,
          };
          next = [...next, row];
          newExpanded[row.id] = true;
        }
      }
      onChange(next);
      if (Object.keys(newExpanded).length > 0) {
        setExpanded((prev) => ({ ...prev, ...newExpanded }));
      }
    },
    [onChange, value],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const patchRow = useCallback(
    (id: string, patch: Partial<WhiteGloveItemRow>) => {
      onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [onChange, value],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(value.filter((r) => r.id !== id));
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [onChange, value],
  );

  const handleAddCustomFromPanel = useCallback(() => {
    const desc = customDesc.trim();
    if (!desc) return;
    const row: WhiteGloveItemRow = {
      id: newId(),
      description: desc,
      quantity: 1,
      category: customCategory,
      weight_class: customWeightClass,
      assembly: "none",
      is_fragile: nameImpliesFragile(desc),
      is_high_value: false,
      notes: "",
      is_custom: true,
    };
    onChange([...value, row]);
    setExpanded((prev) => ({ ...prev, [row.id]: true }));
    setCustomDesc("");
    setShowCustomPanel(false);
  }, [customCategory, customDesc, customWeightClass, onChange, value]);

  const summary = useMemo(() => {
    let totalQty = 0;
    let assemblyN = 0;
    let fragileN = 0;
    for (const r of value) {
      const q = Math.max(1, r.quantity);
      totalQty += q;
      if (r.assembly !== "none") {
        assemblyN += q;
      }
      if (r.is_fragile) {
        fragileN += q;
      }
    }
    return { totalQty, assemblyN, fragileN };
  }, [value]);

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
        Items
      </h3>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] w-full sm:w-auto">
            Browse items
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WHITE_GLOVE_BROWSE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActiveTab(t.key);
                setShowAllChips(false);
              }}
              className={`px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-colors ${
                activeTab === t.key
                  ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                  : "bg-[var(--card)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeWeights.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] text-[var(--tx3)]">
              {WHITE_GLOVE_BROWSE_TABS.find((x) => x.key === activeTab)?.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleChips.map((w) => (
                <button
                  key={w.slug}
                  type="button"
                  onClick={() => addOrMergeFromCatalog(w, 1)}
                  className="px-2 py-1 rounded-md text-[9px] font-semibold border bg-[var(--card)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40 max-w-[11rem] truncate"
                  title={w.item_name}
                >
                  {quickChipLabel(w.item_name)}
                </button>
              ))}
            </div>
            {tabItems.length > 28 && (
              <button
                type="button"
                onClick={() => setShowAllChips((s) => !s)}
                className="text-[9px] font-semibold text-[var(--accent-text)] hover:underline"
              >
                {showAllChips ? "Show fewer items" : `Show all ${tabItems.length} items`}
              </button>
            )}
            {tabItems.length === 0 && (
              <p className="text-[10px] text-[var(--tx3)]">No catalog items in this tab.</p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Item catalog not loaded. Refresh or contact support.
          </p>
        )}

        <div ref={searchRef} className="relative pt-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">
            Search items
          </p>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredSearch[0] && !e.nativeEvent.isComposing) {
                    const { qty } = parseQuantityFromLine(search);
                    addOrMergeFromCatalog(filteredSearch[0], Math.max(1, qty));
                    setSearch("");
                    setShowDropdown(false);
                  }
                }
              }}
              placeholder="Can't find an item? Type to search the catalog…"
              className={`${fieldInputClass} w-full pl-9`}
              aria-label="Search item catalog"
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
                    addOrMergeFromCatalog(w, Math.max(1, qty));
                    setSearch("");
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)]/50 last:border-0 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">{w.item_name}</span>
                  <span className="text-[9px] font-mono tabular-nums text-[var(--tx3)] shrink-0">
                    ×{w.weight_score}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1 border-t border-[var(--brd)]/60">
          <button
            type="button"
            onClick={() => setPasteOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-text)] hover:opacity-90"
          >
            <span>{pasteOpen ? "Hide paste inventory" : "Paste inventory list"}</span>
            <CaretDown className={`size-3 transition-transform ${pasteOpen ? "rotate-180" : ""}`} />
          </button>
          {pasteOpen && (
            <div className="rounded-lg border border-[var(--brd)] p-3 space-y-2 bg-[var(--card)]">
              <p className="text-[9px] text-[var(--tx3)] leading-snug">
                One item per line. Quantities: &quot;4 dining chairs&quot; or &quot;sofa x2&quot;.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                placeholder={"queen mattress\n1x TV stand\nsectional sofa"}
                className={`${fieldInputClass} resize-y min-h-[100px]`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const lines = pasteText
                      .split(/\n/)
                      .map((l) => l.trim())
                      .filter(Boolean);
                    const rows: PasteRow[] = lines.map((raw, i) => {
                      const { name, qty } = parseQuantityFromLine(raw);
                      const { item, confidence } = matchPastedLineToItem(name, activeWeights);
                      return {
                        id: `p${i}`,
                        raw,
                        parsedName: name,
                        qty,
                        match: item,
                        confidence,
                      };
                    });
                    setPasteRows(rows);
                  }}
                  className="admin-btn admin-btn-sm admin-btn-primary"
                >
                  Parse and map items
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
                        <span className="text-amber-600 dark:text-amber-400">
                          No match, add manually below
                        </span>
                      )}
                      <span className="text-[var(--tx3)] ml-auto">×{row.qty}</span>
                      <span className="text-[var(--tx3)] uppercase">({row.confidence})</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      addPasteMatchedRowsBatched(pasteRows);
                      setPasteOpen(false);
                      setPasteText("");
                      setPasteRows([]);
                    }}
                    className="admin-btn admin-btn-sm admin-btn-primary mt-2 w-full"
                  >
                    Add matched items to list
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] px-0.5">
        Your items
      </p>
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] divide-y divide-[var(--brd)]">
        {value.length === 0 ? (
          <p className="p-3 text-[11px] text-[var(--tx3)]">
            Use browse, search, or paste above to add catalog items, or add a custom item.
          </p>
        ) : (
          value.map((row, idx) => {
            const isOpen = expanded[row.id] !== false;
            const catLabel =
              WG_ITEM_CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category;
            const asmLabel =
              WG_ASSEMBLY_OPTIONS.find((a) => a.value === row.assembly)?.label ?? row.assembly;
            return (
              <div key={row.id} className="p-3 space-y-2">
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--card)]"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Collapse item row" : "Expand item row"}
                  >
                    {isOpen ? (
                      <CaretDown className="size-4" weight="bold" aria-hidden />
                    ) : (
                      <CaretRight className="size-4" weight="bold" aria-hidden />
                    )}
                  </button>
                  <span className="mt-1.5 w-6 text-center text-[10px] font-bold text-[var(--tx3)] shrink-0">
                    {idx + 1}
                  </span>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-4">
                      <Field label="Description *">
                        <input
                          value={row.description}
                          onChange={(e) =>
                            patchRow(row.id, { description: e.target.value })
                          }
                          placeholder='e.g. 65" TV'
                          className={fieldInputClass}
                          required
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-1">
                      <Field label="Qty">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={row.quantity}
                          onChange={(e) =>
                            patchRow(row.id, {
                              quantity: Math.max(
                                1,
                                Math.min(99, Number(e.target.value) || 1),
                              ),
                            })
                          }
                          className={fieldInputClass}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="Category">
                        <select
                          value={row.category}
                          onChange={(e) =>
                            patchRow(row.id, {
                              category: e.target.value as WhiteGloveItemCategory,
                            })
                          }
                          className={fieldInputClass}
                          aria-label={`Category row ${idx + 1}`}
                        >
                          {WG_ITEM_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="sm:col-span-4">
                      <Field label="Weight">
                        <select
                          value={row.weight_class}
                          onChange={(e) =>
                            patchRow(row.id, {
                              weight_class: e.target.value as WhiteGloveWeightClass,
                            })
                          }
                          className={fieldInputClass}
                          aria-label={`Weight row ${idx + 1}`}
                        >
                          {WG_WEIGHT_CLASS_OPTIONS.map((w) => (
                            <option key={w.value} value={w.value}>
                              {w.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(row.id)}
                    className="mt-7 text-[10px] font-semibold text-[var(--tx3)] hover:text-red-500 shrink-0"
                  >
                    Remove
                  </button>
                </div>

                {!isOpen && (
                  <p className="pl-9 text-[10px] text-[var(--tx2)] flex flex-wrap items-center gap-2">
                    <span>
                      {row.quantity}× {row.description.trim() || "…"} · {catLabel}
                      {row.slug && !row.is_custom ? (
                        <span className="text-[var(--tx3)]"> · catalog</span>
                      ) : null}
                    </span>
                    {row.assembly !== "none" && (
                      <Wrench
                        className="size-3.5 text-[var(--gold)] shrink-0"
                        aria-label={asmLabel}
                        weight="bold"
                      />
                    )}
                  </p>
                )}

                {isOpen && (
                  <div className="pl-9 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <Field label="Assembly">
                        <select
                          value={row.assembly}
                          onChange={(e) =>
                            patchRow(row.id, {
                              assembly: e.target.value as WhiteGloveAssembly,
                            })
                          }
                          className={fieldInputClass}
                        >
                          {WG_ASSEMBLY_OPTIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <label className="flex items-center gap-2 text-[11px] text-[var(--tx2)] cursor-pointer sm:pt-6">
                        <input
                          type="checkbox"
                          checked={row.is_fragile}
                          onChange={(e) =>
                            patchRow(row.id, { is_fragile: e.target.checked })
                          }
                          className="accent-[var(--gold)] w-3.5 h-3.5"
                        />
                        Fragile
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-[var(--tx2)] cursor-pointer sm:pt-6">
                        <input
                          type="checkbox"
                          checked={row.is_high_value}
                          onChange={(e) =>
                            patchRow(row.id, {
                              is_high_value: e.target.checked,
                            })
                          }
                          className="accent-[var(--gold)] w-3.5 h-3.5"
                        />
                        High value
                      </label>
                    </div>
                    <Field label="Notes">
                      <input
                        value={row.notes}
                        onChange={(e) =>
                          patchRow(row.id, { notes: e.target.value })
                        }
                        placeholder="Access, orientation, placement…"
                        className={fieldInputClass}
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowCustomPanel((s) => !s)}
        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
      >
        <Plus className="w-3.5 h-3.5" weight="bold" aria-hidden />
        Add custom item
      </button>

      {showCustomPanel && (
        <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3 space-y-3">
          <p className="text-[10px] text-[var(--tx3)]">
            For pieces not in the catalog. You can still adjust category and weight after adding.
          </p>
          <Field label="Description *">
            <input
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              className={fieldInputClass}
              placeholder="Item name"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Category">
              <select
                value={customCategory}
                onChange={(e) =>
                  setCustomCategory(e.target.value as WhiteGloveItemCategory)
                }
                className={fieldInputClass}
              >
                {WG_ITEM_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weight">
              <select
                value={customWeightClass}
                onChange={(e) =>
                  setCustomWeightClass(e.target.value as WhiteGloveWeightClass)
                }
                className={fieldInputClass}
              >
                {WG_WEIGHT_CLASS_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            onClick={handleAddCustomFromPanel}
            disabled={!customDesc.trim()}
            className="admin-btn admin-btn-sm admin-btn-primary"
          >
            Add to list
          </button>
        </div>
      )}

      <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3 space-y-1 text-[11px] text-[var(--tx2)]">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
          Summary
        </p>
        <p>
          {summary.totalQty} item{summary.totalQty === 1 ? "" : "s"}
          {summary.assemblyN > 0
            ? ` · ${summary.assemblyN} need${summary.assemblyN === 1 ? "s" : ""} assembly`
            : ""}
          {summary.fragileN > 0 ? ` · ${summary.fragileN} fragile` : ""}
        </p>
      </div>

      <Field label="Declared value (total)">
        <input
          type="number"
          min={0}
          step={1}
          value={declaredValue}
          onChange={(e) => onDeclaredValueChange(e.target.value)}
          placeholder="0"
          className={`${fieldInputClass} max-w-[12rem]`}
        />
      </Field>
      {cargoCoverageHint ? (
        <p className="text-[10px] text-[var(--tx3)] leading-snug">{cargoCoverageHint}</p>
      ) : null}

      <label className="flex items-start gap-2 text-[11px] text-[var(--tx2)] cursor-pointer">
        <input
          type="checkbox"
          checked={debrisRemoval}
          onChange={(e) => onDebrisRemovalChange(e.target.checked)}
          className="accent-[var(--gold)] w-3.5 h-3.5 mt-0.5 shrink-0"
        />
        <span>
          <span className="font-medium text-[var(--tx)]">Debris removal</span>
          <span className="block text-[10px] text-[var(--tx3)] mt-0.5">
            Remove all packaging materials after delivery
          </span>
        </span>
      </label>
    </div>
  );
};
