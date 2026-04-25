"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Plus, Minus } from "@phosphor-icons/react";
import { fuzzyFilterItemWeights } from "@/lib/inventory-search";
import {
  creditForRemovedLine,
  surchargeForAddedLine,
  type CustomWeightClass,
  type ItemAddedInput,
  type ItemRemovedInput,
} from "@/lib/inventory-change-requests";
import { formatCurrency } from "@/lib/format-currency";
import { WINE, FOREST, GOLD } from "@/lib/client-theme";
import { Yu3PortaledTokenRoot } from "@/hooks/useAdminShellTheme";

type WeightRow = { slug: string; item_name: string; weight_score: number; active?: boolean };

type InvLine = { id: string; item_name: string };

type AddedDraft = {
  key: string;
  item_name: string;
  item_slug: string | null;
  weight_score: number;
  quantity: number;
  is_custom: boolean;
  custom_weight_class?: CustomWeightClass;
};

type RemovedDraft = {
  move_inventory_id: string;
  item_name: string;
  weight_score: number;
  quantity: number;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function InventoryChangeRequestModal({
  open,
  onClose,
  moveId,
  token,
  itemWeights,
  inventoryLines,
  currentSubtotal,
  perScoreRate: _perScoreRate,
  maxLines,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  moveId: string;
  token: string;
  itemWeights: WeightRow[];
  inventoryLines: InvLine[];
  currentSubtotal: number;
  perScoreRate: number;
  maxLines: number;
  onSubmitted: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState<AddedDraft[]>([]);
  const [removed, setRemoved] = useState<RemovedDraft[]>([]);
  const [customName, setCustomName] = useState("");
  const [customClass, setCustomClass] = useState<CustomWeightClass>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setSearch("");
    setAdded([]);
    setRemoved([]);
    setCustomName("");
    setCustomClass("medium");
    setError(null);
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const pool = useMemo(() => itemWeights.filter((w) => w.active !== false), [itemWeights]);
  const searchHits = useMemo(() => {
    if (!search.trim()) return [];
    return fuzzyFilterItemWeights(search, pool).slice(0, 40);
  }, [search, pool]);

  const addCatalogItem = (w: WeightRow) => {
    if (added.length + removed.length >= maxLines) return;
    setAdded((prev) => [
      ...prev,
      {
        key: uid(),
        item_name: w.item_name,
        item_slug: w.slug,
        weight_score: Number(w.weight_score) || 1,
        quantity: 1,
        is_custom: false,
      },
    ]);
    setSearch("");
  };

  const addCustomItem = () => {
    const name = customName.trim();
    if (!name) return;
    if (added.length + removed.length >= maxLines) return;
    const scores: Record<CustomWeightClass, number> = {
      light: 0.5,
      medium: 1,
      heavy: 2,
      extra_heavy: 3,
    };
    setAdded((prev) => [
      ...prev,
      {
        key: uid(),
        item_name: name,
        item_slug: null,
        weight_score: scores[customClass],
        quantity: 1,
        is_custom: true,
        custom_weight_class: customClass,
      },
    ]);
    setCustomName("");
  };

  const toggleRemoveLine = (line: InvLine) => {
    const existing = removed.find((r) => r.move_inventory_id === line.id);
    if (existing) {
      setRemoved((prev) => prev.filter((r) => r.move_inventory_id !== line.id));
      return;
    }
    if (added.length + removed.length >= maxLines) return;
    const ws = 1;
    setRemoved((prev) => [
      ...prev,
      { move_inventory_id: line.id, item_name: line.item_name, weight_score: ws, quantity: 1 },
    ]);
  };

  const netDelta = useMemo(() => {
    let d = 0;
    for (const a of added) {
      const row: ItemAddedInput = {
        item_name: a.item_name,
        item_slug: a.item_slug,
        weight_score: a.weight_score,
        quantity: a.quantity,
        is_custom: a.is_custom,
        custom_weight_class: a.custom_weight_class,
      };
      d += surchargeForAddedLine(row);
    }
    for (const r of removed) {
      const row: ItemRemovedInput = {
        move_inventory_id: r.move_inventory_id,
        item_name: r.item_name,
        item_slug: null,
        weight_score: r.weight_score,
        quantity: r.quantity,
      };
      d -= creditForRemovedLine(row);
    }
    return d;
  }, [added, removed]);

  const submit = async () => {
    setError(null);
    if (added.length === 0 && removed.length === 0) {
      setError("Add or remove at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/inventory-change-request?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items_added: added.map((a) => ({
              item_name: a.item_name,
              item_slug: a.item_slug,
              weight_score: a.weight_score,
              quantity: a.quantity,
              is_custom: a.is_custom,
              custom_weight_class: a.custom_weight_class,
            })),
            items_removed: removed.map((r) => ({
              move_inventory_id: r.move_inventory_id,
              item_name: r.item_name,
              item_slug: null,
              weight_score: r.weight_score,
              quantity: r.quantity,
            })),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
      onSubmitted();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      data-modal-root
      className="fixed inset-0 z-[100001] flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 z-0 modal-overlay" aria-hidden onClick={close} />
      <Yu3PortaledTokenRoot
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] shadow-[var(--yu3-shadow-lg)] modal-card pointer-events-auto"
        style={{ maxHeight: "min(92dvh, 640px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: `${FOREST}10` }}>
          <h3 className="text-[15px] font-bold font-heading" style={{ color: WINE }}>
            {step === 1 ? "Add items" : step === 2 ? "Remove items" : "Review request"}
          </h3>
          <button type="button" onClick={close} className="p-1.5 rounded-lg hover:bg-black/5" aria-label="Close">
            <X size={18} color={FOREST} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[12px] leading-relaxed opacity-75" style={{ color: FOREST }}>
                Search our catalog or add a custom item. Estimated pricing uses your coordinator&apos;s standard rates.
              </p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full rounded-xl border px-3 py-2.5 text-[14px] outline-none"
                style={{ borderColor: `${FOREST}20`, backgroundColor: "#F9EDE4", color: FOREST }}
              />
              {searchHits.length > 0 && (
                <ul className="rounded-xl border max-h-[180px] overflow-y-auto divide-y" style={{ borderColor: `${FOREST}12` }}>
                  {searchHits.map((w) => (
                    <li key={w.slug}>
                      <button
                        type="button"
                        onClick={() => addCatalogItem(w)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-black/[0.03]"
                        style={{ color: FOREST }}
                      >
                        <span className="font-medium">{w.item_name}</span>
                        <Plus size={16} className="shrink-0 opacity-50" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${GOLD}30`, backgroundColor: `${GOLD}08` }}>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: FOREST }}>
                  Can&apos;t find your item?
                </div>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Item name"
                  className="w-full rounded-lg border px-3 py-2 text-[13px]"
                  style={{ borderColor: `${FOREST}18`, backgroundColor: "#fff", color: FOREST }}
                />
                <select
                  value={customClass}
                  onChange={(e) => setCustomClass(e.target.value as CustomWeightClass)}
                  className="w-full rounded-lg border px-3 py-2 text-[13px]"
                  style={{ borderColor: `${FOREST}18`, backgroundColor: "#fff", color: FOREST }}
                >
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                  <option value="extra_heavy">Extra heavy</option>
                </select>
                <button
                  type="button"
                  onClick={addCustomItem}
                  disabled={!customName.trim()}
                  className="w-full py-2 rounded-lg text-[12px] font-bold disabled:opacity-40"
                  style={{ backgroundColor: GOLD, color: "#F9EDE4" }}
                >
                  Add custom item
                </button>
              </div>
              {added.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-2" style={{ color: FOREST }}>
                    Adding
                  </div>
                  <ul className="space-y-2">
                    {added.map((a) => (
                      <li
                        key={a.key}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        style={{ borderColor: `${FOREST}12` }}
                      >
                        <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: FOREST }}>
                          {a.item_name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="p-1 rounded-md border"
                            style={{ borderColor: `${FOREST}15` }}
                            onClick={() =>
                              setAdded((prev) =>
                                prev.map((x) =>
                                  x.key === a.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x,
                                ),
                              )
                            }
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-[12px] w-6 text-center font-semibold" style={{ color: FOREST }}>
                            {a.quantity}
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded-md border"
                            style={{ borderColor: `${FOREST}15` }}
                            onClick={() =>
                              setAdded((prev) =>
                                prev.map((x) =>
                                  x.key === a.key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x,
                                ),
                              )
                            }
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            className="ml-1 text-[11px] font-semibold opacity-50"
                            style={{ color: "#B83030" }}
                            onClick={() => setAdded((prev) => prev.filter((x) => x.key !== a.key))}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[12px] leading-relaxed opacity-75" style={{ color: FOREST }}>
                Tap a line to mark it for removal. Your coordinator will confirm.
              </p>
              {inventoryLines.length === 0 ? (
                <p className="text-[13px] opacity-60" style={{ color: FOREST }}>
                  No inventory on file yet. Skip to review if you only need to add items.
                </p>
              ) : (
                <ul className="space-y-2">
                  {inventoryLines.map((line) => {
                    const on = removed.some((r) => r.move_inventory_id === line.id);
                    return (
                      <li key={line.id}>
                        <button
                          type="button"
                          onClick={() => toggleRemoveLine(line)}
                          className="w-full text-left rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors"
                          style={{
                            borderColor: on ? GOLD : `${FOREST}15`,
                            backgroundColor: on ? `${GOLD}12` : "transparent",
                            color: FOREST,
                          }}
                        >
                          {line.item_name}
                          {on && <span className="block text-[11px] opacity-60 mt-0.5">Marked for removal</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${FOREST}12` }}>
                <div className="flex justify-between text-[13px]" style={{ color: FOREST }}>
                  <span className="opacity-70">Current total</span>
                  <span className="font-semibold">{formatCurrency(currentSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[13px]" style={{ color: FOREST }}>
                  <span className="opacity-70">Estimated change</span>
                  <span className="font-semibold" style={{ color: netDelta >= 0 ? GOLD : "#2D9F5A" }}>
                    {netDelta >= 0 ? "+" : ""}
                    {formatCurrency(netDelta)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-[14px] font-bold" style={{ borderColor: `${FOREST}10`, color: WINE }}>
                  <span>Estimated new total</span>
                  <span>{formatCurrency(currentSubtotal + netDelta)}</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed opacity-60" style={{ color: FOREST }}>
                Final pricing is confirmed by your coordinator. Truck size or crew may need to change if volume increases.
              </p>
              {error && (
                <div className="text-[12px] font-medium px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(209,67,67,0.08)", color: "#B83030" }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t" style={{ borderColor: `${FOREST}10` }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="flex-1 py-2.5 rounded-xl border text-[13px] font-semibold"
              style={{ borderColor: `${FOREST}20`, color: FOREST }}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2.5 rounded-xl border text-[13px] font-semibold"
              style={{ borderColor: `${FOREST}20`, color: FOREST }}
            >
              Cancel
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ backgroundColor: GOLD, color: "#F9EDE4" }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
              style={{ backgroundColor: GOLD, color: "#F9EDE4" }}
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          )}
        </div>
      </Yu3PortaledTokenRoot>
    </div>
  );
}
