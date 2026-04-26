"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/** Normalize DB / display tier strings to a letter badge variant. */
export function residentialTierKey(
  raw: string | null | undefined,
): "essential" | "signature" | "estate" | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim();
  if (["essential", "curated", "essentials"].includes(k)) return "essential";
  if (["signature", "premier"].includes(k)) return "signature";
  if (k === "estate") return "estate";
  return null;
}

/** Tooltip / aria label for known residential tiers. */
export function residentialTierFullLabel(
  raw: string | null | undefined,
): string | null {
  const key = residentialTierKey(raw);
  if (key === "essential") return "Essential";
  if (key === "signature") return "Signature";
  if (key === "estate") return "Estate";
  return null;
}

const TIER_MARK: Record<
  "essential" | "signature" | "estate",
  { letter: string; className: string }
> = {
  essential: {
    letter: "E",
    className:
      "text-[#4B5563] bg-[#F3F4F6] border-[color-mix(in_srgb,#6B7280_28%,transparent)]",
  },
  signature: {
    letter: "S",
    className:
      "text-[#2C3E2D] bg-[color-mix(in_srgb,#2C3E2D_14%,transparent)] border-[color-mix(in_srgb,#2C3E2D_25%,transparent)]",
  },
  estate: {
    letter: "E",
    className:
      "text-[var(--yu3-wine)] bg-[var(--yu3-wine-wash)] border-[color-mix(in_srgb,var(--yu3-wine)_30%,transparent)]",
  },
};

export type TierLetterBadgeProps = {
  tier: string | null | undefined;
  /** Shown as tooltip / aria-label (e.g. full tier name). */
  label?: string | null;
  className?: string;
};

export const TierLetterBadge = ({
  tier,
  label,
  className,
}: TierLetterBadgeProps) => {
  const key = residentialTierKey(tier);
  if (!key) return null;
  const { letter, className: tone } = TIER_MARK[key];
  const aria = (label || "").trim() || `${key} tier`;
  return (
    <span
      title={label || undefined}
      aria-label={aria}
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded border px-1 text-[10px] font-bold tabular-nums leading-none",
        tone,
        className,
      )}
    >
      {letter}
    </span>
  );
};
