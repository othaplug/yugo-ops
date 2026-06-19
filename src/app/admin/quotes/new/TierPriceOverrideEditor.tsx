"use client";

/**
 * Per-tier price override editor for the admin quote form.
 *
 * Distinct from the existing global `quote_price_override` (which scales
 * all three tiers proportionally). This editor lets a coordinator set
 * an ABSOLUTE price for one or more individual tiers — typically used
 * to match a competitor on Estate without dropping Essential/Signature.
 *
 * State is owned by the parent (QuoteFormClient) so it survives form
 * field re-renders; this component is presentational + emits onChange.
 *
 * Validation:
 *   - price must parse to a positive number
 *   - reason must be ≥ 3 chars
 * Server-side validation in /api/quotes/generate enforces the same rules.
 * Empty/invalid entries are quietly dropped before submit (see
 * QuoteFormClient.buildPayload).
 *
 * Audit:
 *   - Persists to quotes.tier_price_overrides (JSONB).
 *   - factors_applied.tier_overrides_applied carries the original→override
 *     pair so /admin/quotes/[id] can show "Estate · was $6,700 → $6,000".
 */

import * as React from "react";
import {
  PRICE_OVERRIDE_REASONS,
  buildPriceOverrideReasonText,
} from "@/lib/quotes/price-override-reasons";

export type TierKey = "essential" | "signature" | "estate" | "priority";

export type TierOverrideEntry = { price: string; reason: string };
export type TierPriceOverrideMap = Partial<Record<TierKey, TierOverrideEntry>>;

type Props = {
  value: TierPriceOverrideMap;
  onChange: (next: TierPriceOverrideMap) => void;
  /** Which tiers to show, in order. Defaults to the residential set. Office
   *  passes essential/signature/priority. */
  tierOrder?: TierKey[];
  /** Display labels per tier. Defaults to the residential labels. */
  tierLabels?: Partial<Record<TierKey, string>>;
  /** Engine-natural prices for each tier (shown as the "was" price). Optional. */
  enginePrices?: Partial<Record<TierKey, number>>;
  /**
   * What's currently SAVED on the most-recent generated quote, per tier.
   * When an override value diverges from this, we badge the row "PENDING
   * — click Regenerate". Without this hint operators on YG-30282 sent a
   * quote where the right rail showed the overridden $5,500 but the
   * saved tiers still had $5,350, and the client received the stale
   * price.
   */
  savedPrices?: Partial<Record<TierKey, number>>;
  disabled?: boolean;
};

const TIER_LABELS: Record<TierKey, string> = {
  essential: "Essential",
  signature: "Signature",
  estate: "Estate",
  priority: "Priority",
};

const DEFAULT_TIER_ORDER: TierKey[] = ["essential", "signature", "estate"];

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function TierPriceOverrideEditor({
  value,
  onChange,
  tierOrder = DEFAULT_TIER_ORDER,
  tierLabels,
  enginePrices,
  savedPrices,
  disabled = false,
}: Props) {
  const labelFor = (tier: TierKey) =>
    tierLabels?.[tier] ?? TIER_LABELS[tier];
  const [expanded, setExpanded] = React.useState<TierKey | null>(null);

  const updateTier = (tier: TierKey, next: Partial<TierOverrideEntry> | null) => {
    if (next === null) {
      const { [tier]: _drop, ...rest } = value;
      void _drop;
      onChange(rest);
      return;
    }
    const existing = value[tier] ?? { price: "", reason: "" };
    onChange({ ...value, [tier]: { ...existing, ...next } });
  };

  const reasonsCount = Object.keys(value).length;

  return (
    <div className="rounded-xl border border-[var(--brd)] bg-white p-4 mb-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx2)]">
            Per-tier price override
          </div>
          <div className="text-[11px] text-[var(--tx2)] mt-0.5">
            Sets an absolute price for one tier without affecting the others.
            Use this when matching a competitor on a single tier (e.g. Estate).
            For an across-the-board discount, use the global price override below.
          </div>
        </div>
        {reasonsCount > 0 && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
            {reasonsCount} override{reasonsCount === 1 ? "" : "s"} active
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {tierOrder.map((tier) => {
          const entry = value[tier];
          const engine = enginePrices?.[tier];
          const isExpanded = expanded === tier || !!entry;
          const priceNum = entry ? parseFloat(entry.price) : NaN;
          const reasonTrimmed = entry ? entry.reason.trim() : "";
          const valid =
            !entry ||
            (Number.isFinite(priceNum) &&
              priceNum > 0 &&
              reasonTrimmed.length >= 3);
          // "Pending — regenerate" badge fires when the entered
          // override has a valid price + reason BUT the saved tier
          // price hasn't caught up yet. Without this cue the right rail
          // shows the override (previewTiers overlay) and the operator
          // assumes the quote is saved, then sends the stale price.
          const savedTier = savedPrices?.[tier];
          const pendingRegenerate =
            !!entry &&
            valid &&
            Number.isFinite(priceNum) &&
            priceNum > 0 &&
            reasonTrimmed.length >= 3 &&
            typeof savedTier === "number" &&
            Math.abs(priceNum - savedTier) >= 1;

          return (
            <div
              key={tier}
              className={`rounded-lg border px-3 py-2.5 transition ${
                entry
                  ? "border-[var(--wine)] bg-[var(--wine)]/[0.04]"
                  : "border-[var(--brd)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[12px] font-semibold text-[var(--tx)]">
                    {labelFor(tier)}
                  </span>
                  {typeof engine === "number" && (
                    <span className="text-[10px] text-[var(--tx2)]">
                      engine {fmt(engine)}
                    </span>
                  )}
                  {entry && Number.isFinite(priceNum) && priceNum > 0 && (
                    <span className="text-[11px] font-semibold text-[var(--wine)]">
                      → {fmt(priceNum)}
                    </span>
                  )}
                  {pendingRegenerate && (
                    <span
                      className="shrink-0 text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300"
                      title={`Saved quote still has ${fmt(savedTier!)}. Click Regenerate to apply ${fmt(priceNum)}.`}
                    >
                      Pending · regenerate
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry && (
                    <button
                      type="button"
                      onClick={() => {
                        updateTier(tier, null);
                        setExpanded(null);
                      }}
                      disabled={disabled}
                      className="text-[10px] uppercase tracking-wider font-semibold text-[var(--tx2)] hover:text-red-600 transition"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (entry) {
                        setExpanded(isExpanded ? null : tier);
                      } else {
                        updateTier(tier, { price: "", reason: "" });
                        setExpanded(tier);
                      }
                    }}
                    disabled={disabled}
                    className="text-[10px] uppercase tracking-wider font-semibold text-[var(--wine)] hover:opacity-70 transition"
                  >
                    {entry ? (isExpanded ? "Hide" : "Edit") : "Override"}
                  </button>
                </div>
              </div>

              {entry && isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2 mt-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--tx2)] mb-1">
                      Override price (pre-tax)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={entry.price}
                      onChange={(e) =>
                        updateTier(tier, { price: e.target.value })
                      }
                      disabled={disabled}
                      placeholder={engine ? String(engine) : "6000"}
                      className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--tx2)] mb-1">
                      Reason
                    </label>
                    {/* Reason dropdown — curated list of common
                        override justifications. Picking an option
                        sets the reason text to the option's label;
                        "Other" reveals a free-text input below for
                        the rare cases that don't fit. */}
                    <select
                      value={
                        PRICE_OVERRIDE_REASONS.some(
                          (r) => r.label === entry.reason,
                        )
                          ? PRICE_OVERRIDE_REASONS.find(
                              (r) => r.label === entry.reason,
                            )?.value ?? ""
                          : entry.reason
                            ? "other"
                            : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          updateTier(tier, { reason: "" });
                        } else if (v === "other") {
                          if (
                            PRICE_OVERRIDE_REASONS.some(
                              (r) => r.label === entry.reason,
                            )
                          ) {
                            updateTier(tier, { reason: "" });
                          }
                        } else {
                          updateTier(tier, {
                            reason: buildPriceOverrideReasonText(v),
                          });
                        }
                      }}
                      disabled={disabled}
                      className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px]"
                    >
                      <option value="">Select a reason…</option>
                      {PRICE_OVERRIDE_REASONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {!PRICE_OVERRIDE_REASONS.some(
                      (r) => r.label === entry.reason,
                    ) &&
                      entry.reason !== "" && (
                        <input
                          type="text"
                          value={entry.reason}
                          onChange={(e) =>
                            updateTier(tier, { reason: e.target.value })
                          }
                          disabled={disabled}
                          placeholder="Describe the override reason…"
                          className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] mt-2"
                        />
                      )}
                  </div>
                  {!valid && (
                    <div className="sm:col-span-2 text-[10px] text-red-600">
                      Price must be a positive number and reason must be at
                      least 3 characters. Empty entries are dropped on
                      submit — click Reset to clear cleanly.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--tx2)] mt-3 leading-snug">
        Click <strong>Regenerate</strong> to apply the override to the quote.
        The original engine price stays in the audit trail.
      </p>
    </div>
  );
}
