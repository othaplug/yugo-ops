"use client";

import { ReferralPartnersOverviewHint } from "@/components/admin/ReferralPartnersOverviewHint";

export default function AddReferralPartnerPageHeader() {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <h1 className="admin-page-hero text-[var(--tx)]">Add Referral Partner</h1>
      <ReferralPartnersOverviewHint ariaLabel="About referral partners vs service partners" />
    </div>
  );
}
