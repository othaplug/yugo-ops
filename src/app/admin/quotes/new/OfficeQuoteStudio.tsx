"use client";

/**
 * OfficeQuoteStudio — the new step 4 surface for office_move quotes.
 *
 * Renders the three-tier proposal as the canvas: each tier card shows
 * the engine price, an inline override + reason input, and a
 * "Recommend" star. Above the cards, two segmented controls let the
 * coordinator pick the recommended tier and the presentation mode the
 * client will see.
 *
 * This component does NOT replace the existing add-ons / global-
 * override / multi-scenario controls below it -- it sits at the top
 * of step 4 for office_move only. Residential / event / labour /
 * single-item / B2B / specialty flows are untouched.
 *
 * Built 2026-06-29 in response to operator ask:
 * "the whole ux/ui design for the office move quote create in the
 * admin form is flawed... no recommended tier, no option to make
 * priority tier the main focus like we make estate the main focus."
 */

import React from "react";
import { Star } from "@phosphor-icons/react";

const OFFICE_TIERS = ["essential", "signature", "priority"] as const;
type OfficeTierKey = (typeof OFFICE_TIERS)[number];

const TIER_LABEL: Record<OfficeTierKey, string> = {
  essential: "Essential",
  signature: "Signature",
  priority: "Priority",
};

const TIER_TAGLINE: Record<OfficeTierKey, string> = {
  essential: "Your team packs. We move it properly.",
  signature: "We handle your IT. Your team handles the boxes.",
  priority: "We handle everything. Your team unlocks the door.",
};

export type OfficePresentationMode =
  | "comparison"
  | "priority_featured"
  | "priority_only";

export interface OfficeQuoteStudioProps {
  /** Engine-generated tier prices keyed by tier slug, post-generation. */
  enginePrices: Partial<Record<OfficeTierKey, number>>;
  /** Per-tier price + reason overrides keyed by tier slug. */
  overrides: Record<string, { price?: string; reason?: string }>;
  onOverridesChange: (
    next: Record<string, { price?: string; reason?: string }>,
  ) => void;
  /** Coordinator-picked recommended tier (drives client highlight). */
  recommendedTier: OfficeTierKey;
  onRecommendedTierChange: (tier: OfficeTierKey) => void;
  /** How the client sees the quote. */
  presentationMode: OfficePresentationMode;
  onPresentationModeChange: (mode: OfficePresentationMode) => void;
  /** True once a quote has been generated (so tiers + engine prices exist). */
  hasGenerated: boolean;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export default function OfficeQuoteStudio({
  enginePrices,
  overrides,
  onOverridesChange,
  recommendedTier,
  onRecommendedTierChange,
  presentationMode,
  onPresentationModeChange,
  hasGenerated,
}: OfficeQuoteStudioProps) {
  const setOverride = (
    tier: OfficeTierKey,
    field: "price" | "reason",
    value: string,
  ) => {
    onOverridesChange({
      ...overrides,
      [tier]: {
        ...(overrides[tier] ?? {}),
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Studio header ── */}
      <div>
        <h3 className="text-[14px] font-bold text-[var(--tx)] tracking-tight">
          Build your 3-tier proposal
        </h3>
        <p className="text-[11px] text-[var(--tx2)] leading-snug mt-1 max-w-2xl">
          Customize each tier, pick what to recommend, choose how the client
          sees it. Engine prices update on Regenerate. Override + reason on a
          tier card locks that tier's price.
        </p>
      </div>

      {/* ── Proposal controls strip ── */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-4 py-4 space-y-4">
        {/* Recommended tier */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-2">
            Recommended tier
          </div>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Recommended tier"
          >
            {OFFICE_TIERS.map((tier) => {
              const isRec = recommendedTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  role="radio"
                  aria-checked={isRec}
                  onClick={() => onRecommendedTierChange(tier)}
                  className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
                    isRec
                      ? "bg-[var(--wine)] text-[var(--card)]"
                      : "bg-[var(--card)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--wine)]"
                  }`}
                >
                  {isRec && <Star weight="fill" className="h-3 w-3" aria-hidden />}
                  {TIER_LABEL[tier]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Presentation mode — only meaningful once tiers exist */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-2">
            Client sees
          </div>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Client presentation mode"
          >
            {(
              [
                {
                  value: "comparison" as const,
                  label: "Compare all three",
                  sub: "Side-by-side, neutral",
                },
                {
                  value: "priority_featured" as const,
                  label: "Feature Priority",
                  sub: "All three, Priority bold",
                },
                {
                  value: "priority_only" as const,
                  label: "Priority only",
                  sub: "Sold-on-premium clients",
                },
              ] as const
            ).map((opt) => {
              const isOn = presentationMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  onClick={() => onPresentationModeChange(opt.value)}
                  className={`flex flex-col items-start text-left gap-0.5 px-3 py-2 rounded-md transition-colors ${
                    isOn
                      ? "bg-[var(--wine)]/10 border border-[var(--wine)]"
                      : "bg-[var(--card)] border border-[var(--brd)] hover:border-[var(--wine)]"
                  }`}
                >
                  <span className="text-[11px] font-bold text-[var(--tx)] leading-tight">
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-[var(--tx3)] leading-snug">
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Three tier cards — the canvas ── */}
      <div className="grid md:grid-cols-3 gap-3">
        {OFFICE_TIERS.map((tier) => {
          const isRec = recommendedTier === tier;
          const engine = enginePrices[tier];
          const ov = overrides[tier] ?? {};
          const overridePrice = ov.price ?? "";
          const overrideReason = ov.reason ?? "";
          const hasOverride =
            overridePrice.trim().length > 0 && Number(overridePrice) > 0;

          // Visual treatment — Priority gets the wine premium card,
          // Signature the green, Essential stays neutral. Recommended
          // gets a thicker ring + star.
          const cardBg =
            tier === "priority"
              ? "bg-[#1f0a14]"
              : tier === "signature"
                ? "bg-[#152619]"
                : "bg-[var(--card)]";
          const cardText =
            tier === "priority" || tier === "signature"
              ? "text-[#F9EDE4]"
              : "text-[var(--tx)]";
          const cardMuted =
            tier === "priority" || tier === "signature"
              ? "text-[#F9EDE4]/75"
              : "text-[var(--tx2)]";
          const cardBorder = isRec
            ? tier === "priority"
              ? "border-2 border-[#C9A84C]"
              : tier === "signature"
                ? "border-2 border-[#C9A84C]"
                : "border-2 border-[var(--wine)]"
            : "border border-[var(--brd)]";

          return (
            <div
              key={tier}
              className={`relative rounded-xl ${cardBg} ${cardBorder} p-4 space-y-3 transition-colors`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-[0.12em] ${cardMuted}`}
                  >
                    {TIER_LABEL[tier]}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${cardMuted}`}>
                    {TIER_TAGLINE[tier]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRecommendedTierChange(tier)}
                  aria-label={
                    isRec
                      ? `${TIER_LABEL[tier]} is recommended`
                      : `Recommend ${TIER_LABEL[tier]}`
                  }
                  aria-pressed={isRec}
                  className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                    isRec
                      ? "bg-[#C9A84C] text-[#1a1a2e]"
                      : tier === "priority" || tier === "signature"
                        ? "bg-white/10 text-[#F9EDE4]/70 hover:bg-white/15"
                        : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--wine)]"
                  }`}
                  title={isRec ? "Recommended" : "Mark as recommended"}
                >
                  <Star
                    weight={isRec ? "fill" : "regular"}
                    className="h-3.5 w-3.5"
                    aria-hidden
                  />
                </button>
              </div>

              {/* Engine + override prices */}
              <div className="pt-1 border-t border-[var(--brd)]/30">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${cardMuted}`}
                  >
                    Engine
                  </span>
                  <span
                    className={`text-[15px] font-bold tabular-nums ${cardText} ${hasOverride ? "line-through opacity-60" : ""}`}
                  >
                    {hasGenerated && typeof engine === "number"
                      ? fmt(engine)
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Override input */}
              <div className="space-y-1.5">
                <label
                  className={`block text-[9px] font-bold uppercase tracking-[0.1em] ${cardMuted}`}
                >
                  Override price ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={overridePrice}
                  placeholder={hasGenerated && typeof engine === "number" ? fmt(engine).replace("$", "") : "—"}
                  onChange={(e) => setOverride(tier, "price", e.target.value)}
                  className={`w-full h-8 px-2 rounded-md text-[12px] tabular-nums ${
                    tier === "priority" || tier === "signature"
                      ? "bg-[#F9EDE4]/10 text-[#F9EDE4] border border-[#F9EDE4]/20 placeholder-[#F9EDE4]/40"
                      : "bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)]"
                  }`}
                />
                <label
                  className={`block text-[9px] font-bold uppercase tracking-[0.1em] mt-2 ${cardMuted}`}
                >
                  Reason {hasOverride && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  placeholder="e.g. Competitor match"
                  onChange={(e) => setOverride(tier, "reason", e.target.value)}
                  className={`w-full h-8 px-2 rounded-md text-[12px] ${
                    tier === "priority" || tier === "signature"
                      ? "bg-[#F9EDE4]/10 text-[#F9EDE4] border border-[#F9EDE4]/20 placeholder-[#F9EDE4]/40"
                      : "bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)]"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--tx3)] leading-snug">
        Click <b>Regenerate</b> below to apply any overrides. The original
        engine price is preserved in the audit trail. Per-tier overrides stack
        with the global override if both are set.
      </p>
    </div>
  );
}
