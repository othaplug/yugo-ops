"use client";

/**
 * ScopeChargeModal — super-admin surface for adding a mid-job scope charge.
 *
 * Triggered from the Money tab when the crew calls about more items / heavier
 * scope / extra time on an in-progress move. Captures:
 *   - One or more reason chips (drives the client-facing explanation).
 *   - Optional itemized list when "More items" is selected (auto-prices from
 *     the residential catalog tiers).
 *   - A charge amount with an HST toggle (pre-tax vs. includes-HST).
 *   - A free-text note shown to the client in the change-request notification.
 *
 * On submit the modal POSTs /api/admin/moves/[id]/scope-charge, which creates
 * an `inventory_change_requests` row with source='admin' and status='approved'
 * in one shot — reusing the same pipeline as a crew-walkthrough change so the
 * balance bumps, ledger entries, and client notifications all behave the same.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";
import { Plus, Trash } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";
import {
  inferWeightTierFromLegacyScore,
  getWeightTier,
} from "@/lib/pricing/weight-tiers";

type ScopeReason =
  | "more_items"
  | "heavier"
  | "extra_time"
  | "additional_services"
  | "other";

const REASONS: { value: ScopeReason; label: string; description: string }[] = [
  {
    value: "more_items",
    label: "More items than expected",
    description: "Items the client added on the day or that weren't on the quote.",
  },
  {
    value: "heavier",
    label: "Heavier than expected",
    description:
      "Items are denser / heavier than the quoted weight class. Triggers more crew/truck capacity.",
  },
  {
    value: "extra_time",
    label: "Additional time on-site",
    description: "Access delays, stairs, longer carry, or scope creep that extends the job.",
  },
  {
    value: "additional_services",
    label: "Additional services",
    description: "Packing, assembly, disassembly, debris removal not in the original quote.",
  },
  {
    value: "other",
    label: "Other",
    description: "Anything not captured above. Explain in the note below.",
  },
];

type ItemRow = {
  /** Stable client-side key for React lists. */
  key: string;
  item_name: string;
  /** Heuristic per-item base price (pre-tax). Adjusts when tier changes. */
  weight_score: number;
  quantity: number;
};

function newRow(): ItemRow {
  return {
    key: `r${Math.random().toString(36).slice(2, 9)}`,
    item_name: "",
    weight_score: 1.0,
    quantity: 1,
  };
}

/**
 * Rough per-item suggested price by weight_score. Used purely as a guidance
 * value in the modal so the admin doesn't type a charge of $20 for moving a
 * piano. Backend re-derives the actual delta from charge_amount.
 */
function suggestedPricePerItem(weightScore: number): number {
  if (weightScore <= 0.4) return 25;
  if (weightScore < 1.5) return 45;
  if (weightScore < 3.0) return 90;
  if (weightScore < 3.5) return 175;
  if (weightScore < 4.0) return 275;
  return 400;
}

const HST_RATE = 0.13;

export default function ScopeChargeModal({
  open,
  onClose,
  moveId,
  moveCode,
  currentBalance,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  moveId: string;
  moveCode: string | null;
  /** Tax-inclusive current outstanding balance (matches what the Money tab shows). */
  currentBalance: number;
  /** Parent calls router.refresh + setMove on the returned values. */
  onApplied: (result: {
    new_amount: number;
    new_balance: number;
    pre_tax_delta: number;
    hst_delta: number;
  }) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [reasons, setReasons] = useState<Set<ScopeReason>>(new Set());
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [note, setNote] = useState("");
  const [chargeInput, setChargeInput] = useState("");
  const [includesHst, setIncludesHst] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moreItemsSelected = reasons.has("more_items");

  // Auto-calculated price from itemized list (only shown when "more_items"
  // is selected). Sums suggested per-item prices × quantity. Admin can
  // override by typing a different chargeInput.
  const itemAutoSubtotal = useMemo(() => {
    if (!moreItemsSelected) return 0;
    let sum = 0;
    for (const r of items) {
      if (!r.item_name.trim()) continue;
      sum += suggestedPricePerItem(r.weight_score) * Math.max(1, r.quantity);
    }
    return Math.round(sum * 100) / 100;
  }, [items, moreItemsSelected]);

  // Effective charge amount — admin's explicit input overrides the auto-
  // calculated subtotal. Empty input + "More items" selected → use auto.
  const effectiveCharge = useMemo(() => {
    const typed = Number(chargeInput);
    if (Number.isFinite(typed) && typed > 0) return typed;
    if (moreItemsSelected && itemAutoSubtotal > 0) return itemAutoSubtotal;
    return 0;
  }, [chargeInput, moreItemsSelected, itemAutoSubtotal]);

  const preTaxDelta = useMemo(() => {
    if (effectiveCharge <= 0) return 0;
    return includesHst
      ? Math.round((effectiveCharge / (1 + HST_RATE)) * 100) / 100
      : Math.round(effectiveCharge * 100) / 100;
  }, [effectiveCharge, includesHst]);
  const hstDelta = useMemo(
    () => Math.round(preTaxDelta * HST_RATE * 100) / 100,
    [preTaxDelta],
  );
  const totalDelta = preTaxDelta + hstDelta;
  const projectedNewBalance =
    Math.round((currentBalance + totalDelta) * 100) / 100;

  const toggleReason = (r: ScopeReason) =>
    setReasons((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const removeItem = (key: string) =>
    setItems((prev) =>
      prev.length === 1 ? [newRow()] : prev.filter((row) => row.key !== key),
    );
  const addItem = () => setItems((prev) => [...prev, newRow()]);

  const handleSubmit = async () => {
    setError(null);
    if (reasons.size === 0) {
      setError("Pick at least one reason.");
      return;
    }
    if (effectiveCharge <= 0) {
      setError("Enter a charge amount or itemize the new items.");
      return;
    }
    setSubmitting(true);
    try {
      const itemsPayload = moreItemsSelected
        ? items
            .filter((r) => r.item_name.trim().length > 0)
            .map((r) => ({
              item_name: r.item_name.trim(),
              weight_score: r.weight_score,
              quantity: Math.max(1, Math.floor(r.quantity || 1)),
            }))
        : [];
      const res = await fetch(`/api/admin/moves/${moveId}/scope-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasons: Array.from(reasons),
          note: note.trim() || null,
          items: itemsPayload,
          charge_amount: effectiveCharge,
          charge_includes_hst: includesHst,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not add scope charge.",
        );
      }
      toast(
        `Scope charge applied · ${formatCurrency(preTaxDelta + hstDelta)} added`,
        "check",
      );
      onApplied({
        new_amount: Number(data.new_amount) || 0,
        new_balance: Number(data.new_balance) || 0,
        pre_tax_delta: Number(data.pre_tax_delta) || preTaxDelta,
        hst_delta: Number(data.hst_delta) || hstDelta,
      });
      router.refresh();
      // Reset so the modal opens fresh next time.
      setReasons(new Set());
      setItems([newRow()]);
      setNote("");
      setChargeInput("");
      setIncludesHst(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add scope charge.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    "w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none focus:ring-1 focus:ring-[var(--gold)]/40 focus:border-[var(--gold)]/60";

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title={`Add scope charge${moveCode ? ` · ${moveCode}` : ""}`}
      maxWidth="2xl"
    >
      <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        {/* Context banner */}
        <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 px-3 py-2.5 text-[11px] text-amber-900 leading-snug">
          Mid-job scope additions are super-admin only and trigger an immediate
          client notification. Outstanding balance jumps to{" "}
          <strong>{formatCurrency(projectedNewBalance)}</strong> if you submit
          this charge.
        </div>

        {/* Reason chips */}
        <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 space-y-2">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">
            Reason
          </h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {REASONS.map((r) => {
              const checked = reasons.has(r.value);
              return (
                <label
                  key={r.value}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-[var(--gold)]/60 bg-[var(--gold)]/8"
                      : "border-[var(--brd)] hover:border-[var(--gold)]/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleReason(r.value)}
                    className="mt-0.5 accent-[var(--gold)]"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[var(--tx)]">
                      {r.label}
                    </p>
                    <p className="text-[10px] text-[var(--tx3)] leading-snug">
                      {r.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Items list — only when "more_items" is selected */}
        {moreItemsSelected && (
          <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">
                New items
              </h3>
              <span className="text-[10px] text-[var(--tx3)]">
                Auto-calculated: {formatCurrency(itemAutoSubtotal)} pre-tax
              </span>
            </div>
            <div className="space-y-2">
              {items.map((row) => {
                const tier = getWeightTier(
                  inferWeightTierFromLegacyScore(row.weight_score),
                );
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_120px_80px_40px] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={row.item_name}
                      onChange={(e) =>
                        updateItem(row.key, { item_name: e.target.value })
                      }
                      placeholder="e.g. Marble dining table"
                      className={inputBase}
                    />
                    <select
                      value={row.weight_score}
                      onChange={(e) =>
                        updateItem(row.key, {
                          weight_score: Number(e.target.value),
                        })
                      }
                      className={inputBase}
                      title="Weight tier — affects suggested per-item price"
                    >
                      <option value={0.4}>Light</option>
                      <option value={1.0}>Standard</option>
                      <option value={2.0}>Heavy</option>
                      <option value={3.2}>Very heavy</option>
                      <option value={3.7}>Super heavy</option>
                      <option value={4.5}>Extreme</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={row.quantity}
                      onChange={(e) =>
                        updateItem(row.key, {
                          quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        })
                      }
                      className={`${inputBase} text-center`}
                      aria-label="Quantity"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(row.key)}
                      className="p-2 text-[var(--tx3)] hover:text-red-600 rounded-md transition-colors"
                      aria-label="Remove item"
                      title="Remove"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                    <p className="col-span-4 text-[10px] text-[var(--tx3)] -mt-1 pl-1">
                      {tier?.label ?? "Standard"} · suggested{" "}
                      {formatCurrency(suggestedPricePerItem(row.weight_score))} ×{" "}
                      {row.quantity} ={" "}
                      {formatCurrency(
                        suggestedPricePerItem(row.weight_score) * row.quantity,
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--admin-primary-fill)] hover:opacity-80"
            >
              <Plus className="w-3 h-3" weight="bold" />
              Add another item
            </button>
          </section>
        )}

        {/* Charge amount + HST toggle */}
        <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 space-y-3">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">
            Charge amount
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-[var(--tx)]">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={chargeInput}
              onChange={(e) => setChargeInput(e.target.value)}
              placeholder={
                moreItemsSelected && itemAutoSubtotal > 0
                  ? `${itemAutoSubtotal.toFixed(2)} (auto)`
                  : "0.00"
              }
              className={`${inputBase} text-[15px] font-medium w-40`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
              <input
                type="radio"
                name="hst-mode"
                checked={!includesHst}
                onChange={() => setIncludesHst(false)}
                className="accent-[var(--gold)]"
              />
              Amount is <strong>pre-tax</strong> (HST will be added on top)
            </label>
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
              <input
                type="radio"
                name="hst-mode"
                checked={includesHst}
                onChange={() => setIncludesHst(true)}
                className="accent-[var(--gold)]"
              />
              Amount <strong>includes HST</strong> (we'll back-calculate the pre-tax portion)
            </label>
          </div>
        </section>

        {/* Note to client */}
        <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 space-y-2">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">
            Note to client
          </h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional. Shown to the client in the change-request notification."
            rows={3}
            className={`${inputBase} resize-none min-h-[72px]`}
          />
        </section>

        {/* Preview */}
        <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--bg)]/40 p-4 space-y-1.5">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] mb-1">
            Preview
          </h3>
          <PreviewRow label="Pre-tax delta" value={`+${formatCurrency(preTaxDelta)}`} />
          <PreviewRow label="HST (13%)" value={`+${formatCurrency(hstDelta)}`} />
          <PreviewRow
            label="Total addition"
            value={`+${formatCurrency(preTaxDelta + hstDelta)}`}
            strong
          />
          <PreviewRow
            label="Current outstanding"
            value={formatCurrency(currentBalance)}
          />
          <PreviewRow
            label="New outstanding"
            value={formatCurrency(projectedNewBalance)}
            strong
            highlight
          />
        </section>

        {error && (
          <p className="text-[12px] text-red-600 font-semibold">{error}</p>
        )}
      </div>

      <div className="shrink-0 px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-[var(--brd)] bg-[var(--card)] flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="admin-btn admin-btn-ghost w-full sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || preTaxDelta <= 0 || reasons.size === 0}
          className="admin-btn admin-btn-primary w-full sm:w-auto"
        >
          {submitting ? "Adding…" : "Add charge & notify"}
        </button>
      </div>
    </ModalOverlay>
  );
}

function PreviewRow({
  label,
  value,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[var(--tx3)]">{label}</span>
      <span
        className={`${strong ? "font-bold" : "font-medium"} ${
          highlight ? "text-[var(--gold)]" : "text-[var(--tx)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
