"use client";

import { ReferralPartnersOverviewHint } from "@/components/admin/ReferralPartnersOverviewHint";

export function ReferralPartnersPageHero() {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">Partners</p>
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="admin-page-hero text-[var(--tx)]">Referral Partners</h1>
        <ReferralPartnersOverviewHint ariaLabel="About referral partners vs service partners" />
      </div>
    </div>
  );
}
