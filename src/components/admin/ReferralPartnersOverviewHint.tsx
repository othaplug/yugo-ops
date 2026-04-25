"use client";

import Link from "next/link";
import { InfoHint, type InfoHintAlign } from "@/components/ui/InfoHint";

type Props = {
  className?: string;
  align?: InfoHintAlign;
  iconSize?: number;
  ariaLabel?: string;
};

/**
 * Shared admin copy: referral agreements vs service contracts under Partners.
 * Use next to Referral Partners headings and referral-hub labels.
 */
export function ReferralPartnersOverviewHint({
  className,
  align = "start",
  iconSize = 16,
  ariaLabel = "About referral partners",
}: Props) {
  return (
    <InfoHint variant="admin" align={align} ariaLabel={ariaLabel} className={className} iconSize={iconSize}>
      <p className="text-[12px] leading-relaxed">
        Referral agreements with realtors, property managers, and developers. For property-management service contracts
        (tenant moves, renovations), manage partners under{" "}
        <Link
          href="/admin/partners"
          className="rounded-sm font-semibold text-[var(--yu3-wine)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]/30"
        >
          Partners
        </Link>
        .
      </p>
    </InfoHint>
  );
}
