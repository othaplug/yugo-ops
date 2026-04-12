"use client";

import Link from "next/link";
import {
  InfoHint,
  type InfoHintAlign,
  type InfoHintVariant,
} from "@/components/ui/InfoHint";

type HintProps = {
  className?: string;
  align?: InfoHintAlign;
  iconSize?: number;
  ariaLabel?: string;
  variant?: InfoHintVariant;
};

type PricingMapHintProps = HintProps & {
  /** Partner portal: contract-based copy; admin: platform defaults copy (your specified strings). */
  audience?: "admin" | "partner";
};

/** Pricing / coverage map — dimensional engine + sample addresses (admin vs partner copy). */
export function PricingMapDimensionalEngineHint({
  className,
  align = "start",
  iconSize = 16,
  ariaLabel = "How the pricing map works",
  variant = "admin",
  audience = "admin",
}: PricingMapHintProps) {
  const resolvedVariant = audience === "partner" ? "default" : variant;
  return (
    <InfoHint
      variant={resolvedVariant}
      align={align}
      ariaLabel={ariaLabel}
      className={className}
      iconSize={iconSize}
    >
      <p className="text-[12px] leading-relaxed">
        {audience === "partner" ? (
          <>
            Same dimensional pricing engine as your live quotes — your contract rates. Sample address per zone for
            driving distance. Estimates only; your coordinator confirms final pricing for the exact address, access, and
            handling. Excludes HST.
          </>
        ) : (
          <>
            Same dimensional pricing engine as partner quotes — platform vertical defaults (no partner contract). Sample
            address per zone for driving distance.
          </>
        )}
      </p>
    </InfoHint>
  );
}

export function RissdWorkflowHint({
  className,
  align = "start",
  iconSize = 16,
  ariaLabel = "What RISSD means",
  variant = "admin",
}: HintProps) {
  return (
    <InfoHint variant={variant} align={align} ariaLabel={ariaLabel} className={className} iconSize={iconSize}>
      <p className="text-[12px] leading-relaxed">Receive, inspect, store & deliver (RISSD)</p>
    </InfoHint>
  );
}

export function QuotesFollowupAutomationHint({
  className,
  align = "start",
  iconSize = 16,
  ariaLabel = "Automated quote follow-ups",
  variant = "admin",
}: HintProps) {
  return (
    <InfoHint variant={variant} align={align} ariaLabel={ariaLabel} className={className} iconSize={iconSize}>
      <p className="text-[12px] leading-relaxed">
        <strong className="font-semibold text-[var(--tx)]">Automated:</strong> The system runs this job daily at 4:00 PM UTC
        when <span className="whitespace-nowrap">Auto follow-up emails</span> is enabled in{" "}
        <Link
          href="/admin/platform?tab=app"
          className="font-semibold text-[#6e2442] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6e2442]/35 rounded-sm whitespace-nowrap"
        >
          Platform → Business
        </Link>
        . Manual send uses the same rules (stages 1–3) and shows quote IDs first.
      </p>
    </InfoHint>
  );
}

export function ProfitabilityBreakdownHint({
  className,
  align = "start",
  iconSize = 16,
  ariaLabel = "What profitability includes",
  variant = "admin",
}: HintProps) {
  return (
    <InfoHint variant={variant} align={align} ariaLabel={ariaLabel} className={className} iconSize={iconSize}>
      <p className="text-[12px] leading-relaxed">
        Margin uses labour, truck, fuel, and supplies only. Card processing appears when the client paid by card; it is an estimate of what they pay as a pass-through, not subtracted here. Monthly overhead is company-wide on the finance profitability page, not per move.
      </p>
    </InfoHint>
  );
}

export function SpeedToLeadHint({
  className,
  align = "start",
  iconSize = 16,
  ariaLabel = "Speed to lead",
  variant = "admin",
}: HintProps) {
  return (
    <InfoHint variant={variant} align={align} ariaLabel={ariaLabel} className={className} iconSize={iconSize}>
      <p className="text-[12px] leading-relaxed">
        Speed to lead: respond in under five minutes when you can — it drives conversion.
      </p>
    </InfoHint>
  );
}
