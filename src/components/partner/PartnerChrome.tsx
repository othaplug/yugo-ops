"use client";

import type { CSSProperties, ReactNode } from "react";
import { WINE } from "@/app/quote/[quoteId]/quote-shared";

/** Scoped so shared DataTable / FilterBar use wine instead of default `--gold` on partner pages. */
export const PARTNER_TABLE_CHROME: CSSProperties = {
  ["--gold" as string]: WINE,
};

export function PartnerSectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#2C3E2D] mb-1 [font-family:var(--font-body)]">
      {children}
    </p>
  );
}

export function PartnerPageTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-hero text-[28px] sm:text-[32px] font-normal leading-[1.1] tracking-tight text-[#5C1A33]">
      {children}
    </h2>
  );
}

export function PartnerSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-hero text-[24px] sm:text-[26px] font-normal leading-tight text-[#5C1A33]">
      {children}
    </h3>
  );
}

/** Modal / sheet panel aligned with PartnerScheduleModal */
export const partnerModalPanelClass =
  "bg-[#FFFBF7] rounded-t-lg sm:rounded-lg shadow-[0_24px_80px_rgba(44,62,45,0.14)] border border-[#2C3E2D]/10";

export const partnerForestPrimaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors rounded-sm disabled:opacity-50";

export const partnerOutlineBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase border border-[#2C3E2D]/25 text-[#2C3E2D] hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm";
