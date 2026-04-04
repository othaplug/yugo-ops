"use client";

import { FOREST } from "@/lib/client-theme";
import { formatCurrency } from "@/lib/format-currency";
import { Check } from "@phosphor-icons/react";

interface TipConfirmationProps {
  amount: number;
}

const FOREST_GREEN = "#2B3927";

export default function TipConfirmation({ amount }: TipConfirmationProps) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-3 px-4">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${FOREST_GREEN}18` }}
      >
        <Check weight="bold" size={10} color={FOREST_GREEN} aria-hidden />
      </div>
      <span className="text-[13px] font-medium" style={{ color: FOREST }}>
        You tipped {formatCurrency(amount)}, thank you.
      </span>
    </div>
  );
}
