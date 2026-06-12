"use client";

import {
  CircleNotch as Loader2,
  TrendUp as TrendingUp,
} from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";

/**
 * Sticky right-column live price preview for the edit quote page.
 *
 * Renders three states:
 *   - Loading (recalculating) — spinner + "Recalculating…" header
 *   - Has data — tier cards (residential) OR custom_price block
 *                (labour-only / specialty / single-item / office)
 *   - Empty   — dashed placeholder so the right column never collapses
 *               before the first preview fires
 *
 * `livePreview` is typed as `unknown` because the engine response shape
 * varies by service type. The parent owns the data fetch + debounce; this
 * is a pure presentational component.
 */
export interface LivePreviewLabour {
  crewSize?: number | string;
  hoursRange?: string;
  truckSize?: string;
  estimatedHours?: number | string;
}

export interface LivePreviewData {
  tiers?: Record<
    string,
    { price: number; tax: number } | undefined
  >;
  custom_price?: { price: number; tax: number; total: number };
  labour?: LivePreviewLabour;
  distance_km?: number;
  drive_time_min?: number;
  inventory_warnings?: string[];
  factors?: {
    inventory_modifier?: number;
    inventory_max_modifier?: number;
    labour_component?: number;
    subtotal_before_labour?: number;
  };
}

interface Props {
  livePreview: LivePreviewData | null;
  previewLoading: boolean;
  /** Price stamped on the existing quote, used for the delta badge. */
  oldPrice: number;
  /** Newly-computed top-line price (essential tier or custom_price.price). */
  livePrice: number | null;
}

export default function EditQuoteLivePreview({
  livePreview,
  previewLoading,
  oldPrice,
  livePrice,
}: Props) {
  if (!livePreview && !previewLoading) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--brd)] bg-[var(--card)]/40 p-4 text-center">
        <div className="text-[10px] font-bold text-[var(--tx3)] tracking-widest uppercase mb-1">
          Live Price Preview
        </div>
        <p className="text-[11px] text-[var(--tx3)]">
          Edit any field to see the new pricing here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        {previewLoading ? (
          <Loader2 size={13} className="animate-spin text-[var(--gold)]" />
        ) : (
          <TrendingUp size={13} className="text-[var(--gold)]" />
        )}
        <span className="text-[10px] font-bold text-[var(--gold)] tracking-widest uppercase">
          {previewLoading ? "Recalculating…" : "Live Price Preview"}
        </span>
        {livePreview?.distance_km && !previewLoading && (
          <span className="ml-auto text-[10px] text-[var(--tx3)]">
            {livePreview.distance_km} km · {livePreview.drive_time_min} min
            drive
          </span>
        )}
      </div>

      {!previewLoading && livePreview && (
        <>
          {livePreview.tiers ? (
            <div className="grid grid-cols-3 gap-2">
              {(["essential", "signature", "estate"] as const).map((tier) => {
                const t = livePreview.tiers?.[tier];
                if (!t) return null;
                const isEssential = tier === "essential";
                return (
                  <div
                    key={tier}
                    className={`rounded-lg p-3 text-center border ${isEssential ? "border-[var(--gold)]/40 bg-[var(--gold)]/8" : "border-[var(--brd)] bg-[var(--bg)]"}`}
                  >
                    <div className="text-[9px] text-[var(--gold)] font-semibold uppercase mb-0.5">
                      {tier}
                    </div>
                    <div className="text-[16px] font-bold text-[var(--tx)]">
                      {formatCurrency(t.price)}
                    </div>
                    <div className="text-[9px] text-[var(--tx3)] mt-0.5">
                      +{formatCurrency(t.tax)} HST
                    </div>
                  </div>
                );
              })}
            </div>
          ) : livePreview.custom_price ? (
            <div className="flex items-center gap-5 flex-wrap">
              <div>
                <div className="text-[11px] text-[var(--tx3)]">Price</div>
                <div className="text-[20px] font-bold text-[var(--gold)]">
                  {formatCurrency(livePreview.custom_price.price)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--tx3)]">HST (13%)</div>
                <div className="text-sm font-medium text-[var(--tx)]">
                  +{formatCurrency(livePreview.custom_price.tax)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--tx3)]">
                  Total incl. HST
                </div>
                <div className="text-sm font-semibold text-[var(--tx)]">
                  {formatCurrency(livePreview.custom_price.total)}
                </div>
              </div>
              {oldPrice > 0 && livePrice != null && (
                <div className="ml-auto text-[12px]">
                  <span className="text-[var(--tx3)] line-through mr-1">
                    {formatCurrency(Number(oldPrice))}
                  </span>
                  <span
                    className="font-bold"
                    style={{
                      color:
                        livePrice > Number(oldPrice) ? "#EF4444" : "#22C55E",
                    }}
                  >
                    {livePrice > Number(oldPrice) ? "+" : ""}
                    {formatCurrency(livePrice - Number(oldPrice))}
                  </span>
                </div>
              )}
            </div>
          ) : null}

          {livePreview.labour && (
            <div className="mt-3 pt-2 border-t border-[var(--gold)]/15 flex gap-4 text-[11px] text-[var(--tx3)]">
              <span>
                <strong className="text-[var(--tx)]">
                  {livePreview.labour.crewSize}
                </strong>{" "}
                movers
              </span>
              <span>
                <strong className="text-[var(--tx)]">
                  {livePreview.labour.hoursRange}
                </strong>
              </span>
              <span>
                <strong className="text-[var(--tx)]">
                  {livePreview.labour.truckSize}
                </strong>{" "}
                truck
              </span>
            </div>
          )}

          {(livePreview.inventory_warnings?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1 text-[11px]">
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                Check inventory quantities
              </p>
              <ul className="list-disc list-inside text-[var(--tx2)]">
                {livePreview.inventory_warnings?.map(
                  (w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ),
                )}
              </ul>
            </div>
          )}
          {livePreview.factors &&
            typeof livePreview.factors.inventory_modifier === "number" &&
            typeof livePreview.factors.inventory_max_modifier === "number" &&
            livePreview.factors.inventory_modifier >=
              livePreview.factors.inventory_max_modifier && (
              <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-[var(--tx2)]">
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  Inventory at volume ceiling (×
                  {Number(livePreview.factors.inventory_max_modifier).toFixed(
                    2,
                  )}
                  )
                </p>
                <p className="mt-0.5">
                  Price is capped, consider manual adjustment.
                </p>
              </div>
            )}
          {livePreview.factors &&
            typeof livePreview.factors.labour_component === "number" &&
            typeof livePreview.factors.subtotal_before_labour === "number" &&
            Number(livePreview.factors.subtotal_before_labour) > 0 &&
            Number(livePreview.factors.labour_component) >
              0.5 * Number(livePreview.factors.subtotal_before_labour) && (
              <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-[var(--tx2)]">
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  High labour component:{" "}
                  {formatCurrency(livePreview.factors.labour_component)}
                </p>
                <p className="mt-0.5">
                  This move needs significantly more crew/time than standard.
                </p>
              </div>
            )}
        </>
      )}
    </div>
  );
}
