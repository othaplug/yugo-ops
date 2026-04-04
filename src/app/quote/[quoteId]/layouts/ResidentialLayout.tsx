"use client";

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
import type { PremiumSurfaceInk } from "../quote-premium-shell";
import { ESTATE_ROSE } from "../estate-quote-ui";
import {
  SIGNATURE_ON_SHELL,
  SIGNATURE_CTA,
  SIGNATURE_PAGE_BG,
} from "../signature-quote-ui";

/** Estate card face — Yugo wine (#5C1A33) shifting to deeper wine for depth. */
const ESTATE_CARD_WINE_DEEP = "#3D1522";
const ESTATE_CARD_WINE_HIGHLIGHT = "#6B2848";

/** Tier card subcopy on cream / white */
const LIGHT_TAGLINE = FOREST_BODY;
const LIGHT_TAX_LINE = FOREST;
const LIGHT_FOOTER = FOREST_MUTED;

const ESTATE_TAGLINE = "rgba(255,255,255,0.82)";
const ESTATE_TAX_LINE = "rgba(255,255,255,0.92)";
const ESTATE_FOOTER = "rgba(255,255,255,0.78)";
/** Headings and checks on Estate dark card (off-white — no gold). */
const ESTATE_ACCENT_LIGHT = "rgba(255,255,255,0.92)";
/** Yugo brand palette — inline “Recommended” suffix (light: leather; Estate: off-white). */
const BRAND_LEATHER = "#492A1D";
const BRAND_OFF_WHITE = "#F9EDE4";

/** Tier cards: never show truck size (e.g. “20ft”) — one consistent client-facing line. */
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
  /** Estate or Signature premium shell — headings and rails use cream on dark (wine or green tokens). */
  darkShellInk?: PremiumSurfaceInk | null;
}

export default function ResidentialLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier = "signature",
  hasSelection = false,
  darkShellInk = null,
  tierFeaturesConfig,
  tierCardAdditions = { signature: [], estate: [] },
  useAdditiveTierCards = { signature: false, estate: false },
  tierMetaMap,
}: Props) {
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
          Choose your package
        </h2>
        <p
          className="text-[13px] leading-relaxed max-w-md mx-auto"
          style={{ color: d ? d.body : FOREST_BODY }}
        >
          Every package includes a professional crew, truck, and blanket
          wrapping.
        </p>
        {quote.expires_at && (
          <p
            className="text-[12px] mt-2"
            style={{
              color: d ? d.muted : FOREST_MUTED,
            }}
          >
            Quote valid until{" "}
            {new Date(quote.expires_at).toLocaleDateString("en-CA", {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch max-w-6xl md:max-w-7xl lg:max-w-7xl xl:max-w-[84rem] mx-auto min-w-0 px-2">
        {TIER_ORDER.map((tierKey) => {
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
                        // “Everything in …, plus:” — list only tier-specific lines (truck/crew live in Essential).
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
        })}
      </div>
    </section>
  );
}
