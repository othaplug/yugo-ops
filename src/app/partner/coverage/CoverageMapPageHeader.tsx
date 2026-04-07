"use client";

import { PricingMapDimensionalEngineHint } from "@/components/admin/AdminContextHints";

export function CoverageMapPageHeader() {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 flex-wrap">
        <h1
          className="font-hero text-[26px] sm:text-[30px] font-normal leading-tight tracking-tight"
          style={{ color: "#2B0416" }}
        >
          Coverage map
        </h1>
        <PricingMapDimensionalEngineHint audience="partner" ariaLabel="How the coverage map works" />
      </div>
    </div>
  );
}
