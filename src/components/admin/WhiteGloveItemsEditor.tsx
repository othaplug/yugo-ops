"use client";

import React, { useCallback, useMemo, useState } from "react";
import { CaretDown, CaretRight, Plus, Wrench } from "@phosphor-icons/react";
import type {
  WhiteGloveAssembly,
  WhiteGloveItemCategory,
  WhiteGloveWeightClass,
} from "@/lib/quotes/white-glove-pricing";
import {
  WG_ASSEMBLY_OPTIONS,
  WG_ITEM_CATEGORIES,
  WG_QUICK_ADD,
  WG_WEIGHT_CLASS_OPTIONS,
} from "@/lib/quotes/white-glove-pricing";

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
  };
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
  /** Shown under declared value */
  cargoCoverageHint?: string;
  declaredValue: string;
  onDeclaredValueChange: (v: string) => void;
  debrisRemoval: boolean;
  onDebrisRemovalChange: (v: boolean) => void;
};

export const WhiteGloveItemsEditor: React.FC<WhiteGloveItemsEditorProps> = ({
  value,
  onChange,
  fieldInputClass,
  cargoCoverageHint,
  declaredValue,
  onDeclaredValueChange,
  debrisRemoval,
  onDebrisRemovalChange,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const row of value) init[row.id] = true;
    return init;
  });

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

  const handleAddRow = useCallback(() => {
    const row = createDefaultWhiteGloveItem();
    onChange([...value, row]);
    setExpanded((prev) => ({ ...prev, [row.id]: true }));
  }, [onChange, value]);

  const handleQuickAdd = useCallback(
    (key: string) => {
      const preset = WG_QUICK_ADD[key];
      if (!preset) return;
      const row: WhiteGloveItemRow = {
        id: newId(),
        description: preset.description,
        quantity: 1,
        category: preset.category,
        weight_class: preset.weight,
        assembly: preset.assembly,
        is_fragile: preset.is_fragile ?? false,
        is_high_value: preset.is_high_value ?? false,
        notes: "",
      };
      onChange([...value, row]);
      setExpanded((prev) => ({ ...prev, [row.id]: true }));
    },
    [onChange, value],
  );

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
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] divide-y divide-[var(--brd)]">
        {value.length === 0 ? (
          <p className="p-3 text-[11px] text-[var(--tx3)]">
            Add at least one item. Use quick add or &quot;Add item&quot;.
          </p>
        ) : (
          value.map((row, idx) => {
            const isOpen = expanded[row.id] !== false;
            const catLabel =
              WG_ITEM_CATEGORIES.find((c) => c.value === row.category)?.label ??
              row.category;
            const asmLabel =
              WG_ASSEMBLY_OPTIONS.find((a) => a.value === row.assembly)
                ?.label ?? row.assembly;
            return (
              <div key={row.id} className="p-3 space-y-2">
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--card)]"
                    aria-expanded={isOpen}
                    aria-label={
                      isOpen ? "Collapse item row" : "Expand item row"
                    }
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
                              category: e.target
                                .value as WhiteGloveItemCategory,
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
                              weight_class: e.target
                                .value as WhiteGloveWeightClass,
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
                      {row.quantity}× {row.description.trim() || "…"} ·{" "}
                      {catLabel}
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
        onClick={handleAddRow}
        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
      >
        <Plus className="w-3.5 h-3.5" weight="bold" aria-hidden />
        Add item
      </button>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1.5">
          Quick add
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(WG_QUICK_ADD).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleQuickAdd(key)}
              className="px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-colors bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
            >
              + {key}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3 space-y-1 text-[11px] text-[var(--tx2)]">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">
          Summary
        </p>
        <p>Total items: {summary.totalQty}</p>
        <p>Assembly required: {summary.assemblyN} items</p>
        <p>Fragile items: {summary.fragileN}</p>
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
        <p className="text-[10px] text-[var(--tx3)] leading-snug">
          {cargoCoverageHint}
        </p>
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
