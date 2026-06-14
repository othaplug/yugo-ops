"use client";

import * as React from "react";
import {
  Check,
  CaretRight as ChevronRight,
  Star,
} from "@phosphor-icons/react";
import {
  type Quote,
  type TierData,
  type TierFeature,
  type ResidentialQuoteTierMetaMap,
  TIER_ORDER,
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  fmtPrice,
  QUOTE_EYEBROW_CLASS,
  QUOTE_SECTION_H2_CLASS,
} from "../quote-shared";
import { formatPlatformDisplay } from "@/lib/date-format";
import type { PremiumSurfaceInk } from "../quote-premium-shell";
import { ESTATE_ROSE } from "../estate-quote-ui";
import {
  SIGNATURE_ON_SHELL,
  SIGNATURE_CTA,
  SIGNATURE_PAGE_BG,
} from "../signature-quote-ui";

/** Estate card face, Yugo wine (#5C1A33) shifting to deeper wine for depth. */
const ESTATE_CARD_WINE_DEEP = "#3D1522";
const ESTATE_CARD_WINE_HIGHLIGHT = "#6B2848";

/** Tier card subcopy on cream / white */
const LIGHT_TAGLINE = FOREST_BODY;
const LIGHT_TAX_LINE = FOREST;
const LIGHT_FOOTER = FOREST_MUTED;

const ESTATE_TAGLINE = "rgba(255,255,255,0.82)";
const ESTATE_TAX_LINE = "rgba(255,255,255,0.92)";
const ESTATE_FOOTER = "rgba(255,255,255,0.78)";
/** Headings and checks on Estate dark card (off-white, no gold). */
const ESTATE_ACCENT_LIGHT = "rgba(255,255,255,0.92)";
/** Yugo brand palette, inline “Recommended” suffix (light: leather; Estate: off-white). */
const BRAND_LEATHER = "#492A1D";
const BRAND_OFF_WHITE = "#F9EDE4";

/** Tier cards: never show truck size (e.g. “20ft”), one consistent client-facing line. */
const TIER_CARD_TRUCK_LABEL = "Dedicated Moving Truck";

function tierCardTruckBullet(fromQuoteOrConfig: string): string {
  const raw = fromQuoteOrConfig.trim();
  if (!raw) return TIER_CARD_TRUCK_LABEL;
  const lower = raw.toLowerCase();
  if (
    lower.includes("truck") ||
    lower.includes("van") ||
    /\d\s*ft/.test(lower)
  ) {
    return TIER_CARD_TRUCK_LABEL;
  }
  return raw;
}

interface Props {
  quote: Quote;
  tiers: Record<string, TierData>;
  selectedTier: string | null;
  onSelectTier: (tierKey: string) => void;
  recommendedTier?: string;
  /**
   * How the comparison is shown to the client.
   *   "comparison"      (default), all three tiers side-by-side
   *   "estate_featured", Estate rendered first, Essential + Signature
   *                       in a collapsible "Compare with other packages"
   *                       section below (price-anchor preserved but
   *                       Estate is the obvious primary)
   *   "estate_only"    , single-tier Estate render, no comparison.
   *                       Heading copy changes from "Choose your package"
   *                       to "Your Estate move".
   * Effective only when recommendedTier === "estate", for other
   * recommendations the parent forces "comparison".
   */
  presentationMode?: "comparison" | "estate_featured" | "estate_only";
  /** When true, unselected tier cards collapse to compact view */
  hasSelection?: boolean;
  /**
   * Single source of truth for tier features. When provided, tier card bullets
   * are rendered from this config's `card` field rather than from t.includes[].
   * Index 0 = truck (dynamic from t.includes[0]); index 1 = crew (dynamic from t.includes[1]).
   * Remaining items use the config card labels directly.
   */
  tierFeaturesConfig?: Record<string, TierFeature[]>;
  /** Signature/Estate-only bullets after the “Everything in … plus:” line (additive layout). */
  tierCardAdditions?: { signature: TierFeature[]; estate: TierFeature[] };
  /** When true for a tier, card shows truck/crew + intro + additions only (not the full merged list). */
  useAdditiveTierCards?: { signature: boolean; estate: boolean };
  /** Merged tier labels, taglines, “Best for”, and optional inclusions intro lines. */
  tierMetaMap: ResidentialQuoteTierMetaMap;
  /** Estate or Signature premium shell, headings and rails use cream on dark (wine or green tokens). */
  darkShellInk?: PremiumSurfaceInk | null;
}

export default function ResidentialLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier = "signature",
  presentationMode = "comparison",
  hasSelection = false,
  darkShellInk = null,
  tierFeaturesConfig,
  tierCardAdditions = { signature: [], estate: [] },
  useAdditiveTierCards = { signature: false, estate: false },
  tierMetaMap,
}: Props) {
  // Presentation-mode gates. estate-featured / estate-only are only
  // honored when Estate is the recommended tier, server forces
  // "comparison" otherwise, but defending here too in case a stale
  // mode value lands on a quote that re-recommended a different tier.
  const isEstateRecommended = (recommendedTier ?? "").toLowerCase() === "estate";
  const effectiveMode: "comparison" | "estate_featured" | "estate_only" =
    isEstateRecommended ? presentationMode : "comparison";
  const isEstateOnly = effectiveMode === "estate_only";
  const isEstateFeatured = effectiveMode === "estate_featured";
  const [otherPackagesOpen, setOtherPackagesOpen] = React.useState(false);
  // For estate_featured: render Estate first as a hero card, then
  // Essential + Signature in a collapsible "Compare with other
  // packages" section below.
  const heroTiers: readonly string[] = isEstateOnly
    ? ["estate"]
    : isEstateFeatured
      ? ["estate"]
      : (TIER_ORDER as readonly string[]);
  const compareTiers: readonly string[] = isEstateFeatured
    ? ["essential", "signature"]
    : [];
  const d = darkShellInk;
  /** Selected tier CTA on premium shell: rose on wine, forest on Signature; cream page stays FOREST */
  const selectedTierCtaBg = d
    ? d === SIGNATURE_ON_SHELL
      ? SIGNATURE_CTA
      : ESTATE_ROSE
    : FOREST;
  const raw = (recommendedTier ?? "signature").toString().toLowerCase().trim();
  const recTier = TIER_ORDER.includes(raw as (typeof TIER_ORDER)[number])
    ? raw
    : "signature";
  return (
    <section className="mb-10 min-w-0 w-full max-w-full">
      <div className="text-center mb-8 max-w-xl mx-auto">
        <p
          className={`${QUOTE_EYEBROW_CLASS} mb-2`}
          style={{ color: d ? d.muted : FOREST_MUTED }}
        >
          Your plan
        </p>
        <h2
          className={`${QUOTE_SECTION_H2_CLASS} mb-2`}
          style={{ color: d ? d.primary : WINE }}
        >
          {isEstateOnly
            ? "Your Estate move"
            : isEstateFeatured
              ? "Your Estate move plan"
              : "Choose your package"}
        </h2>
        <p
          className="text-[13px] leading-relaxed max-w-md mx-auto"
          style={{ color: d ? d.body : FOREST_BODY }}
        >
          {isEstateOnly
            ? "A fully managed home transition, every detail handled."
            : isEstateFeatured
              ? "Your coordinator has prepared Estate for this move. Other packages remain available below for reference."
              : "Every package includes a professional crew, truck, and blanket wrapping."}
        </p>
        {quote.expires_at && (
          <p
            className="text-[12px] mt-2"
            style={{
              color: d ? d.muted : FOREST_MUTED,
            }}
          >
            Quote valid until{" "}
            {formatPlatformDisplay(quote.expires_at, {
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {recTier === "estate" && (
        <div className="mb-6 flex justify-center w-full min-w-0 px-1 sm:px-0">
          <div
            className="box-border flex w-full min-w-0 max-w-full sm:w-fit sm:max-w-2xl sm:mx-auto flex-wrap items-center justify-center gap-2.5 rounded-none px-4 py-3 text-center text-[12px] sm:px-5 sm:text-[13px] border-t-2"
            style={
              d
                ? d === SIGNATURE_ON_SHELL
                  ? {
                      backgroundColor: "rgba(244, 250, 245, 0.1)",
                      color: d.body,
                      borderTopColor: d.kicker,
                    }
                  : {
                      backgroundColor: "rgba(249, 237, 228, 0.1)",
                      color: d.body,
                      borderTopColor: d.kicker,
                    }
                : {
                    backgroundColor: `${FOREST}04`,
                    color: FOREST,
                    borderTopColor: WINE,
                  }
            }
          >
            <Star
              className="hidden sm:block w-4 h-4 shrink-0"
              style={{ color: d ? d.kicker : WINE }}
              weight="fill"
              aria-hidden
            />
            <span className="min-w-0 leading-snug">
              Your move coordinator recommended{" "}
              <strong
                style={{ color: d ? d.primary : WINE }}
              >
                Estate
              </strong>{" "}
              based on your requirements.
            </span>
          </div>
        </div>
      )}
      {recTier === "signature" && (
        <div className="mb-6 flex justify-center w-full min-w-0 px-1 sm:px-0">
          <div
            className="box-border flex w-full min-w-0 max-w-full sm:w-fit sm:max-w-2xl sm:mx-auto flex-wrap items-center justify-center gap-2.5 rounded-none px-4 py-3 text-center text-[12px] sm:px-5 sm:text-[13px] border-t-2"
            style={
              d
                ? d === SIGNATURE_ON_SHELL
                  ? {
                      backgroundColor: "rgba(244, 250, 245, 0.1)",
                      color: d.body,
                      borderTopColor: d.kicker,
                    }
                  : {
                      backgroundColor: "rgba(249, 237, 228, 0.1)",
                      color: d.body,
                      borderTopColor: d.kicker,
                    }
                : {
                    backgroundColor: `${FOREST}04`,
                    color: FOREST,
                    borderTopColor: WINE,
                  }
            }
          >
            <Star
              className="hidden sm:block w-4 h-4 shrink-0"
              style={{ color: d ? d.kicker : WINE }}
              weight="fill"
              aria-hidden
            />
            <span className="min-w-0 leading-snug">
              Your move coordinator recommended{" "}
              <strong
                style={{ color: d ? d.primary : WINE }}
              >
                Signature
              </strong>{" "}
              for full-service protection.
            </span>
          </div>
        </div>
      )}

      {/*
        Per-tier card renderer. Pulled into a closure so the
        estate_featured mode can render Estate as a hero row above the
        collapsible "Compare with other packages" group, same card
        markup, no duplication.
        Returns null when the tier is missing from tiers/tierMetaMap.
      */}
      {((): React.ReactNode => {
        const renderTierCard = (tierKey: string): React.ReactNode => {
          const t = tiers[tierKey];
          if (!t) return null;
          const meta = tierMetaMap[tierKey];
          if (!meta) return null;
          const isSelected = selectedTier === tierKey;
          const isRecommended = tierKey === recTier;

          const isEstate = tierKey === "estate";
          const isSignature = tierKey === "signature";

          const isCollapsed = hasSelection && !isSelected;

          const sig = SIGNATURE_ON_SHELL;
          const cardFg = isEstate
            ? "rgba(255,255,255,0.9)"
            : isSignature
              ? sig.primary
              : undefined;
          const checkColor = isEstate
            ? ESTATE_ACCENT_LIGHT
            : isSignature
              ? sig.kicker
              : FOREST;
          const depositColor = isEstate
            ? ESTATE_ACCENT_LIGHT
            : isSignature
              ? sig.muted
              : FOREST_MUTED;
          const taglineColor = isEstate
            ? ESTATE_TAGLINE
            : isSignature
              ? sig.body
              : LIGHT_TAGLINE;
          const taxLineColor = isEstate
            ? ESTATE_TAX_LINE
            : isSignature
              ? sig.secondary
              : LIGHT_TAX_LINE;
          const footerColor = isEstate
            ? ESTATE_FOOTER
            : isSignature
              ? sig.muted
              : LIGHT_FOOTER;

          const cardLiftShadow = isEstate
            ? "none"
            : isSignature
              ? d
                ? isSelected
                  ? "0 10px 40px rgba(0,0,0,0.26)"
                  : "0 6px 24px rgba(0,0,0,0.14)"
                : isSelected
                  ? "0 12px 40px rgba(0,0,0,0.18)"
                  : "0 2px 16px rgba(0,0,0,0.12)"
              : d
                ? isSelected
                  ? "0 10px 40px rgba(0,0,0,0.26)"
                  : "0 6px 24px rgba(0,0,0,0.14)"
                : isSelected
                  ? "0 12px 40px rgba(44,62,45,0.12)"
                  : "0 2px 16px rgba(44,62,45,0.06)";

          return (
            <div
              key={tierKey}
              className={`relative flex h-full min-h-0 flex-col rounded-none overflow-hidden transition-all duration-300 ease-in-out border-0 ${
                isCollapsed ? "opacity-60" : ""
              }`}
              style={{
                boxShadow: cardLiftShadow,
              }}
            >
              {/* Card body, no badge strip */}
              <div
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-none"
                style={
                  isEstate
                    ? {
                        background: `linear-gradient(155deg, ${WINE} 0%, ${ESTATE_CARD_WINE_HIGHLIGHT} 42%, ${ESTATE_CARD_WINE_DEEP} 100%)`,
                        borderWidth: 0,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                      }
                    : isSignature
                      ? {
                          backgroundColor: SIGNATURE_PAGE_BG,
                          borderWidth: 0,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        }
                      : { backgroundColor: meta.bg }
                }
              >
                <div
                  className={`p-6 md:p-8 flex flex-col h-full min-h-0 min-w-0 transition-all duration-300 ${isCollapsed ? "!p-5" : ""}`}
                >
                  <div className="flex min-w-0 flex-shrink-0 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <h3
                      className="min-w-0 flex-1 text-[15px] sm:text-[16px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)]"
                    >
                      <span
                        style={{
                          color: isEstate
                            ? ESTATE_ACCENT_LIGHT
                            : isSignature
                              ? sig.primary
                              : meta.accent,
                        }}
                      >
                        {meta.label}
                      </span>
                      {isRecommended ? (
                        <span
                          className="font-bold uppercase tracking-[0.12em] text-[7px] sm:text-[8px] align-baseline whitespace-nowrap [font-family:var(--font-body)]"
                          style={{
                            color: isEstate
                              ? BRAND_OFF_WHITE
                              : isSignature
                                ? sig.kicker
                                : BRAND_LEATHER,
                          }}
                        >
                          {" "}
                          · RECOMMENDED
                        </span>
                      ) : null}
                    </h3>
                    <span
                      className="font-hero shrink-0 text-right text-[clamp(1.35rem,1.05rem+2vw,1.875rem)] font-bold leading-none tabular-nums"
                      style={{
                        color: isEstate
                          ? ESTATE_ACCENT_LIGHT
                          : isSignature
                            ? sig.primary
                            : meta.accent,
                      }}
                    >
                      {fmtPrice(t.price)}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <p
                      data-tier-tagline
                      className="mt-2 w-full min-h-10 leading-relaxed text-[13px] md:min-h-11 md:text-[14px] font-medium"
                      style={{ color: taglineColor }}
                    >
                      {meta.tagline}
                    </p>
                  )}

                  <div
                    className={`flex flex-col flex-1 min-h-0 min-w-0 ${isCollapsed ? "mt-0" : "mt-4"}`}
                  >
                    {!isCollapsed && (
                      <p
                        className="mb-3 shrink-0 pl-6 text-[12px] md:text-[13px] font-medium tabular-nums"
                        style={{ color: taxLineColor }}
                      >
                        +{fmtPrice(t.tax)} HST &middot; Total{" "}
                        {fmtPrice(t.total)}
                      </p>
                    )}

                    {!isCollapsed &&
                      (() => {
                        const configFeatures = tierFeaturesConfig?.[tierKey];
                        const useAdditive =
                          tierKey === "signature"
                            ? useAdditiveTierCards.signature
                            : tierKey === "estate"
                              ? useAdditiveTierCards.estate
                              : false;
                        const additions =
                          tierKey === "signature"
                            ? tierCardAdditions.signature
                            : tierKey === "estate"
                              ? tierCardAdditions.estate
                              : [];
                        const intro = (meta.inclusionsIntro ?? "").trim();

                        if (!configFeatures) {
                          const bullets = t.includes
                            .filter(Boolean)
                            .map((line, i) =>
                              i === 0 ? tierCardTruckBullet(line) : line,
                            );
                          return (
                            <div className="flex-1 min-h-0 flex flex-col mb-4">
                              <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                                {bullets.map((inc, i) => (
                                  <li
                                    key={`fb-${i}`}
                                    className="flex gap-2.5 items-start"
                                  >
                                    <Check
                                      className="w-4 h-4 shrink-0 mt-[3px]"
                                      style={{ color: checkColor }}
                                    />
                                    <span
                                      className="text-[13px] leading-relaxed min-w-0"
                                      style={{ color: cardFg ?? FOREST }}
                                    >
                                      {inc}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }

                        if (tierKey === "essential" || !useAdditive) {
                          const truckRaw =
                            t.includes[0] ?? configFeatures?.[0]?.card ?? "";
                          const truck = tierCardTruckBullet(truckRaw);
                          const crew =
                            t.includes[1] ?? configFeatures?.[1]?.card ?? "";
                          const bullets: string[] = [
                            truck,
                            crew,
                            ...configFeatures.slice(2).map((f) => f.card),
                          ].filter(Boolean);
                          return (
                            <div className="flex-1 min-h-0 flex flex-col mb-4">
                              <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                                {bullets.map((inc, i) => (
                                  <li
                                    key={`full-${i}`}
                                    className="flex gap-2.5 items-start"
                                  >
                                    <Check
                                      className="w-4 h-4 shrink-0 mt-[3px]"
                                      style={{ color: checkColor }}
                                    />
                                    <span
                                      className="text-[13px] leading-relaxed min-w-0"
                                      style={{ color: cardFg ?? FOREST }}
                                    >
                                      {inc}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }

                        const deltaCards = additions
                          .map((f) => f.card)
                          .filter(Boolean);
                        // “Everything in …, plus:”, list only tier-specific lines (truck/crew live in Essential).
                        const listBullets = deltaCards;
                        return (
                          <div className="flex-1 min-h-0 flex flex-col mb-4 space-y-3">
                            {intro ? (
                              <p
                                className="text-[12px] md:text-[13px] font-bold leading-snug pl-0.5 pr-1 shrink-0"
                                style={{ color: cardFg ?? FOREST }}
                              >
                                {intro}
                              </p>
                            ) : null}
                            <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                              {listBullets.map((inc, i) => (
                                <li
                                  key={`add-${i}`}
                                  className="flex gap-2.5 items-start"
                                >
                                  <Check
                                    className="w-4 h-4 shrink-0 mt-[3px]"
                                    style={{ color: checkColor }}
                                  />
                                  <span
                                    className="text-[13px] leading-relaxed min-w-0"
                                    style={{ color: cardFg ?? FOREST }}
                                  >
                                    {inc}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    {!isCollapsed && meta.footer && (
                      <p
                        className="text-[13px] mb-4 leading-relaxed shrink-0 font-medium"
                        style={{ color: footerColor }}
                      >
                        {meta.footer}
                      </p>
                    )}

                    {/* Fix #4: Upgrade nudge, Essential only, not collapsed.
                       Suppressed when Estate is the coordinator-recommended tier
                       (saying "most clients choose Signature" while Estate is
                       pre-selected as RECOMMENDED contradicts itself). When
                       Estate is recommended, surface the limitation instead. */}
                    {!isCollapsed && tierKey === "essential" && (
                      recommendedTier === "estate" ? (
                        <p className="text-xs text-amber-600 mt-1 mb-4 text-center px-2 leading-relaxed shrink-0">
                          Your coordinator recommended Estate for this move.
                          Essential has significant limitations for a{" "}
                          {quote.move_size === "1br"
                            ? "1-bedroom"
                            : quote.move_size === "2br"
                              ? "2-bedroom"
                              : quote.move_size === "3br"
                                ? "3-bedroom"
                                : quote.move_size === "4br"
                                  ? "4-bedroom"
                                  : quote.move_size === "5br_plus"
                                    ? "5+ bedroom"
                                    : "full"}{" "}
                          home of this scope.
                        </p>
                      ) : recommendedTier === "signature" ? (
                        <p className="text-xs text-gray-400 mt-1 mb-4 text-center px-2 leading-relaxed shrink-0">
                          Most clients moving a{" "}
                          {quote.move_size === "1br"
                            ? "1-bedroom"
                            : quote.move_size === "2br"
                              ? "2-bedroom"
                              : quote.move_size === "3br"
                                ? "3-bedroom"
                                : "full"}{" "}
                          home choose Signature for complete protection and
                          room-of-choice placement.
                        </p>
                      ) : null
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectTier(tierKey)}
                      className={`w-full py-3.5 rounded-none text-[11px] font-bold tracking-[0.12em] uppercase transition-opacity flex-shrink-0 hover:opacity-90 border-0 ${
                        isSelected ? "text-white" : ""
                      } ${isCollapsed ? "mt-auto" : ""}`}
                      style={
                        isSelected
                          ? {
                              backgroundColor:
                                isSignature ? SIGNATURE_CTA : selectedTierCtaBg,
                            }
                          : {
                              backgroundColor: "transparent",
                              color: isEstate
                                ? ESTATE_ACCENT_LIGHT
                                : isSignature
                                  ? sig.primary
                                  : meta.accent,
                            }
                      }
                    >
                      {isSelected ? (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1.5">
                          Continue with {meta.label}
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </button>

                    {!isCollapsed && (
                      <p
                        className="text-center text-[11px] mt-2.5 flex-shrink-0 font-medium"
                        style={{ color: depositColor }}
                      >
                        {fmtPrice(t.deposit)} deposit to book
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        };

        // Hero row, Estate-only / Estate-featured: just Estate.
        // Comparison: all three.
        const heroGridCols = isEstateOnly
          ? "grid-cols-1 max-w-md"
          : isEstateFeatured
            ? "grid-cols-1 max-w-2xl"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch max-w-6xl md:max-w-7xl lg:max-w-7xl xl:max-w-[84rem] px-2";
        return (
          <>
            <div className={`grid ${heroGridCols} mx-auto min-w-0 ${!isEstateOnly && !isEstateFeatured ? "" : "gap-5"}`}>
              {heroTiers.map((k) => (
                <React.Fragment key={`hero-${k}`}>{renderTierCard(k)}</React.Fragment>
              ))}
            </div>

            {/* Estate-featured: collapsible "Compare with other
                packages" block. Estate is the obvious primary above;
                Essential + Signature live here for clients who want to
                see what they're trading off. Default-collapsed so the
                page feels focused; click expands to a 2-col grid. */}
            {isEstateFeatured && compareTiers.length > 0 && (
              <div className="mt-10 max-w-4xl mx-auto px-2">
                <button
                  type="button"
                  onClick={() => setOtherPackagesOpen((p) => !p)}
                  className="w-full flex items-center justify-between gap-3 py-3 border-t border-b transition-opacity hover:opacity-80"
                  style={{
                    borderColor: d ? `${d.muted}66` : `${FOREST_MUTED}55`,
                    color: d ? d.muted : FOREST_MUTED,
                  }}
                  aria-expanded={otherPackagesOpen}
                >
                  <span className="text-[11px] font-bold tracking-[0.14em] uppercase">
                    Compare with other packages
                  </span>
                  <span className="text-[11px]">
                    {otherPackagesOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {otherPackagesOpen && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch min-w-0 opacity-90">
                    {compareTiers.map((k) => (
                      <React.Fragment key={`compare-${k}`}>
                        {renderTierCard(k)}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}
    </section>
  );
}
