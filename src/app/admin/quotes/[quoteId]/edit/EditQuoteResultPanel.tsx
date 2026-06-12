"use client";

import { PaperPlaneTilt as Send } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";

interface AddonItem {
  name: string;
  subtotal: number;
}

interface TierResult {
  label?: string;
  price: number;
}

export interface NewQuoteResult {
  version?: number | null;
  is_revised?: boolean;
  price_before?: number | null;
  tiers?: Record<string, TierResult | undefined>;
  custom_price?: { price: number; total: number };
  addons?: { items?: AddonItem[] };
}

interface Props {
  newQuoteResult: NewQuoteResult;
  newQuoteId: string | null;
  /** Pre-tax price on the *previous* version. */
  oldPrice: number | null;
  /** Headline price from the newly-generated quote. */
  newPrice: number | null;
  linking: boolean;
  onEditFurther: () => void;
  onSendUpdate: () => void | Promise<void>;
}

/**
 * Post-regenerate result panel.
 *
 * Renders immediately under the editable form sections once the
 * coordinator has clicked "Save changes" and the engine returned a
 * new version. Surfaces the price delta, tier breakdown (or custom
 * price for non-tier services), add-on lines, and the final Edit
 * Further / Save & resend action pair.
 */
export default function EditQuoteResultPanel({
  newQuoteResult,
  newQuoteId,
  oldPrice,
  newPrice,
  linking,
  onEditFurther,
  onSendUpdate,
}: Props) {
  return (
    <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-5 mb-6 mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase">
          Quote Updated
        </div>
        {newQuoteResult.version != null && (
          <span className="text-[9px] font-bold text-[var(--tx3)] tracking-widest uppercase">
            v{newQuoteResult.version}
          </span>
        )}
        {newQuoteResult.is_revised && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-500 border border-amber-500/30">
            Revised
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 mb-4 flex-wrap">
        <div>
          <div className="text-[11px] text-[var(--tx3)]">Quote ID</div>
          <div className="text-sm font-bold text-[var(--gold)]">
            {newQuoteId ?? "-"}
          </div>
        </div>
        {(() => {
          const priceBefore = newQuoteResult.price_before ?? null;
          const priceAfter = newPrice;
          if (priceBefore != null && priceAfter != null) {
            return (
              <PriceDelta from={Number(priceBefore)} to={Number(priceAfter)} />
            );
          }
          if (oldPrice != null && newPrice != null) {
            return <PriceDelta from={Number(oldPrice)} to={Number(newPrice)} />;
          }
          return null;
        })()}
      </div>

      {newQuoteResult.tiers && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {["essential", "signature", "estate"].map((tier) => {
            const t = newQuoteResult.tiers?.[tier];
            if (!t) return null;
            return (
              <div
                key={tier}
                className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 text-center"
              >
                <div className="text-[10px] text-[var(--gold)] font-semibold uppercase">
                  {t.label || tier}
                </div>
                <div className="text-lg font-bold text-[var(--tx)] mt-1">
                  {formatCurrency(t.price)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newQuoteResult.custom_price && (
        <div className="flex gap-5 mb-4">
          <div>
            <div className="text-[11px] text-[var(--tx3)]">Price</div>
            <div className="text-xl font-bold text-[var(--gold)]">
              {formatCurrency(newQuoteResult.custom_price.price)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--tx3)]">Total incl. HST</div>
            <div className="text-base font-semibold text-[var(--tx)]">
              {formatCurrency(newQuoteResult.custom_price.total)}
            </div>
          </div>
        </div>
      )}

      {(newQuoteResult.addons?.items?.length ?? 0) > 0 && (
        <div className="mb-4 space-y-1">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
            Add-Ons
          </div>
          {newQuoteResult.addons?.items?.map((item, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="text-[var(--tx2)]">{item.name}</span>
              <span className="text-[var(--gold)] font-semibold">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onEditFurther}
          className="flex-1 py-3 rounded-xl border border-[var(--brd)] text-[var(--tx2)] text-sm font-medium hover:bg-[var(--bg)] transition-colors"
        >
          Edit Further
        </button>
        <button
          onClick={onSendUpdate}
          disabled={linking}
          className="btn-p flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={16} />
          {linking ? "Sending…" : "Save & resend to client"}
        </button>
      </div>
    </div>
  );
}

function PriceDelta({ from, to }: { from: number; to: number }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--tx3)]">Price Change</div>
      <div className="text-sm font-medium text-[var(--tx)] flex items-center gap-2">
        <span className="line-through text-[var(--tx3)]">
          {formatCurrency(from)}
        </span>
        <span className="text-[var(--tx3)]">→</span>
        <span className="text-[var(--gold)] font-bold">
          {formatCurrency(to)}
        </span>
      </div>
    </div>
  );
}
