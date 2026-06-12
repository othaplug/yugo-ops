"use client";

import { formatCurrency } from "@/lib/format-currency";
import { getDisplayLabel } from "@/lib/displayLabels";
import { quoteDetailDateLabel } from "@/lib/quotes/quote-field-labels";

interface Props {
  clientName: string | null | undefined;
  /** Pre-tax price currently stamped on the quote. */
  currentPrice: number;
  serviceType: string;
  moveDate: string | null | undefined;
  status: string | null | undefined;
}

/**
 * Read-only summary card at the top of the left column of the edit
 * quote page. Mirrors the four key facts the operator needs to confirm
 * they're editing the right record: client, current price, move date,
 * status.
 */
export default function EditQuoteCurrentSummary({
  clientName,
  currentPrice,
  serviceType,
  moveDate,
  status,
}: Props) {
  return (
    <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
      <div className="text-[9px] font-bold text-[var(--tx3)] tracking-widest uppercase mb-3">
        Current Quote
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-[var(--tx3)] text-[11px]">Client</div>
          <div className="text-[var(--tx)] font-medium">
            {clientName || "-"}
          </div>
        </div>
        <div>
          <div className="text-[var(--tx3)] text-[11px]">Current Price</div>
          <div className="text-[var(--gold)] font-bold">
            {formatCurrency(currentPrice)}
          </div>
        </div>
        <div>
          <div className="text-[var(--tx3)] text-[11px]">
            {quoteDetailDateLabel(serviceType)}
          </div>
          <div className="text-[var(--tx)] font-medium">
            {moveDate || "TBD"}
          </div>
        </div>
        <div>
          <div className="text-[var(--tx3)] text-[11px]">Status</div>
          <div className="text-[var(--tx)] font-medium uppercase">
            {getDisplayLabel(status ?? "", "quote") || status || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
