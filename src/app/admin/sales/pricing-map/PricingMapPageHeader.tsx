"use client";

import { PricingMapDimensionalEngineHint } from "@/components/admin/AdminContextHints";

export function PricingMapPageHeader() {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">Sales</p>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-[var(--tx)]">Pricing map</h1>
        <PricingMapDimensionalEngineHint ariaLabel="How the pricing map works" />
      </div>
    </div>
  );
}
