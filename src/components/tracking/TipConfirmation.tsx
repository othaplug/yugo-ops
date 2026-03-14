"use client";

import { FOREST } from "@/lib/client-theme";
import { formatCurrency } from "@/lib/format-currency";

interface TipConfirmationProps {
  amount: number;
}

const FOREST_GREEN = "#2C3E2D";

export default function TipConfirmation({ amount }: TipConfirmationProps) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-3 px-4">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${FOREST_GREEN}18` }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke={FOREST_GREEN}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <span className="text-[13px] font-medium" style={{ color: FOREST }}>
        You tipped {formatCurrency(amount)} — thank you.
      </span>
    </div>
  );
}
