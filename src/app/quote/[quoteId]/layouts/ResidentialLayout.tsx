import { Check, CaretRight as ChevronRight, Target, Crown, Star, SketchLogo, type Icon as LucideIcon } from "@phosphor-icons/react";
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
import { ESTATE_ON_WINE } from "../estate-quote-ui";

const TIER_ICONS: Record<string, LucideIcon> = {
  essential: Target,
  signature: Crown,
  estate: SketchLogo,
};

/** Tier card subcopy on cream / white */
const LIGHT_TAGLINE = FOREST_BODY;
const LIGHT_TAX_LINE = FOREST;
const LIGHT_FOOTER = FOREST_MUTED;

const ESTATE_TAGLINE = "rgba(255,255,255,0.82)";
const ESTATE_TAX_LINE = "rgba(255,255,255,0.92)";
const ESTATE_FOOTER = "rgba(255,255,255,0.78)";
/** Headings, icons, checks on Estate dark card (off-white — no gold). */
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
  if (lower.includes("truck") || lower.includes("van") || /\d\s*ft/.test(lower)) {
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
  /** Residential Estate tier selected — page shell is wine; headings and rails use cream-on-wine. */
  onWineSurface?: boolean;
}

export default function ResidentialLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier = "signature",
  hasSelection = false,
  onWineSurface = false,
  tierFeaturesConfig,
  tierCardAdditions = { signature: [], estate: [] },
  useAdditiveTierCards = { signature: false, estate: false },
  tierMetaMap,
}: Props) {
  const raw = (recommendedTier ?? "signature").toString().toLowerCase().trim();
  const recTier = TIER_ORDER.includes(raw as (typeof TIER_ORDER)[number]) ? raw : "signature";
  return (
    <section className="mb-10 min-w-0 w-full max-w-full">
      <div className="text-center mb-8 max-w-xl mx-auto">
        <p
          className={`${QUOTE_EYEBROW_CLASS} mb-2`}
          style={{ color: onWineSurface ? ESTATE_ON_WINE.muted : FOREST_MUTED }}
        >
          Your plan
        </p>
        <h2
          className={`${QUOTE_SECTION_H2_CLASS} mb-2`}
          style={{ color: onWineSurface ? ESTATE_ON_WINE.primary : WINE }}
        >
          Choose your package
        </h2>
        <p
          className="text-[13px] leading-relaxed max-w-md mx-auto"
          style={{ color: onWineSurface ? ESTATE_ON_WINE.body : FOREST_BODY }}
        >
          Every package includes a professional crew, truck, and blanket wrapping.
        </p>
        {quote.expires_at && (
          <p
            className="text-[12px] mt-2"
            style={{ color: onWineSurface ? ESTATE_ON_WINE.muted : FOREST_MUTED }}
          >
            Quote valid until{" "}
            {new Date(quote.expires_at).toLocaleDateString("en-CA", { month: "long", day: "numeric" })}
          </p>
        )}
      </div>

      {recTier === "estate" && (
        <div className="mb-6 flex justify-center w-full min-w-0 px-1 sm:px-0">
          <div
            className="box-border flex w-full min-w-0 max-w-full sm:w-fit sm:max-w-2xl sm:mx-auto flex-wrap items-center justify-center gap-2.5 rounded-none px-4 py-3 text-center text-[12px] sm:px-5 sm:text-[13px] border-t-2"
            style={
              onWineSurface
                ? {
                    backgroundColor: "rgba(249, 237, 228, 0.1)",
                    color: ESTATE_ON_WINE.body,
                    borderTopColor: ESTATE_ON_WINE.kicker,
                  }
                : { backgroundColor: `${FOREST}04`, color: FOREST, borderTopColor: WINE }
            }
          >
            <Star
              className="w-4 h-4 shrink-0"
              style={{ color: onWineSurface ? ESTATE_ON_WINE.kicker : WINE }}
              weight="fill"
              aria-hidden
            />
            <span className="min-w-0 leading-snug">
              Your move coordinator recommended{" "}
              <strong style={{ color: onWineSurface ? ESTATE_ON_WINE.primary : WINE }}>Estate</strong> based on your
              requirements.
            </span>
          </div>
        </div>
      )}
      {recTier === "signature" && (
        <div className="mb-6 flex justify-center w-full min-w-0 px-1 sm:px-0">
          <div
            className="box-border flex w-full min-w-0 max-w-full sm:w-fit sm:max-w-2xl sm:mx-auto flex-wrap items-center justify-center gap-2.5 rounded-none px-4 py-3 text-center text-[12px] sm:px-5 sm:text-[13px] border-t-2"
            style={
              onWineSurface
                ? {
                    backgroundColor: "rgba(249, 237, 228, 0.1)",
                    color: ESTATE_ON_WINE.body,
                    borderTopColor: ESTATE_ON_WINE.kicker,
                  }
                : { backgroundColor: `${FOREST}04`, color: FOREST, borderTopColor: WINE }
            }
          >
            <Star
              className="w-4 h-4 shrink-0"
              style={{ color: onWineSurface ? ESTATE_ON_WINE.kicker : WINE }}
              weight="fill"
              aria-hidden
            />
            <span className="min-w-0 leading-snug">
              Your move coordinator recommended{" "}
              <strong style={{ color: onWineSurface ? ESTATE_ON_WINE.primary : WINE }}>Signature</strong> for
              full-service protection.
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

          const isCollapsed = hasSelection && !isSelected;

          const cardFg = isEstate ? "rgba(255,255,255,0.9)" : undefined;
          const checkColor = isEstate ? ESTATE_ACCENT_LIGHT : FOREST;
          const depositColor = isEstate ? ESTATE_ACCENT_LIGHT : FOREST_MUTED;
          const taglineColor = isEstate ? ESTATE_TAGLINE : LIGHT_TAGLINE;
          const taxLineColor = isEstate ? ESTATE_TAX_LINE : LIGHT_TAX_LINE;
          const footerColor = isEstate ? ESTATE_FOOTER : LIGHT_FOOTER;

          const cardBorderColor = onWineSurface
            ? isSelected
              ? "#66143D"
              : isRecommended
                ? "rgba(249,237,228,0.38)"
                : "rgba(249,237,228,0.2)"
            : isSelected
              ? FOREST
              : isRecommended
                ? `${FOREST}40`
                : `${FOREST}12`;

          return (
            <div
              key={tierKey}
              className={`relative flex h-full min-h-0 flex-col rounded-none overflow-hidden transition-all duration-300 ease-in-out border ${
                isSelected ? "border-2" : "border"
              } ${isCollapsed ? "opacity-60" : ""}`}
              style={{
                borderColor: cardBorderColor,
                boxShadow: "none",
              }}
            >
              {/* Card body, no badge strip */}
              <div
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-none"
                style={
                  isEstate
                    ? {
                        background: "linear-gradient(135deg, #2B0E18 0%, #5C1A33 38%, #722F45 70%, #3D1522 100%)",
                        borderWidth: 0,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
                      }
                    : { backgroundColor: meta.bg }
                }
              >
              <div
                className={`p-6 md:p-8 flex flex-col h-full min-h-0 min-w-0 transition-all duration-300 ${isCollapsed ? "!p-5" : ""}`}
              >
                <div className="flex min-w-0 flex-shrink-0 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                    {(() => {
                      const TierIcon = TIER_ICONS[tierKey];
                      return TierIcon ? (
                        <TierIcon
                          className="h-5 w-5 shrink-0"
                          style={{ color: isEstate ? ESTATE_ACCENT_LIGHT : meta.accent }}
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      ) : null;
                    })()}
                    <h3 className="font-heading text-[16px] font-bold leading-tight min-w-0 flex-1">
                      <span style={{ color: isEstate ? ESTATE_ACCENT_LIGHT : meta.accent }}>{meta.label}</span>
                      {isRecommended ? (
                        <span
                          className="font-medium uppercase tracking-[0.12em] text-[7px] sm:text-[8px] align-middle whitespace-nowrap"
                          style={{ color: isEstate ? BRAND_OFF_WHITE : BRAND_LEATHER }}
                        >
                          {" "}
                          · RECOMMENDED
                        </span>
                      ) : null}
                    </h3>
                  </div>
                  <span
                    className="font-hero shrink-0 text-right text-[clamp(1.125rem,0.85rem+1.5vw,1.5rem)] font-bold leading-none tabular-nums"
                    style={{ color: isEstate ? ESTATE_ACCENT_LIGHT : meta.accent }}
                  >
                    {fmtPrice(t.price)}
                  </span>
                </div>
                {!isCollapsed && (
                  <p
                    data-tier-tagline
                    className="mt-2 w-full min-h-9 leading-relaxed text-[11px] md:min-h-10 md:text-[12px] font-medium"
                    style={{ color: taglineColor }}
                  >
                    {meta.tagline}
                  </p>
                )}

                <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${isCollapsed ? "mt-0" : "mt-4"}`}>
                  {!isCollapsed && (
                    <p
                      className="mb-3 shrink-0 pl-6 text-[11px] md:text-[12px] font-medium tabular-nums"
                      style={{ color: taxLineColor }}
                    >
                      +{fmtPrice(t.tax)} HST &middot; Total {fmtPrice(t.total)}
                    </p>
                  )}

                  {!isCollapsed && (() => {
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
                        .map((line, i) => (i === 0 ? tierCardTruckBullet(line) : line));
                      return (
                        <div className="flex-1 min-h-0 flex flex-col mb-4">
                          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                            {bullets.map((inc, i) => (
                              <li key={`fb-${i}`} className="flex gap-2.5 items-start">
                                <Check className="w-3.5 h-3.5 shrink-0 mt-[3px]" style={{ color: checkColor }} />
                                <span className="text-[12px] leading-relaxed min-w-0" style={{ color: cardFg ?? FOREST }}>{inc}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }

                    if (tierKey === "essential" || !useAdditive) {
                      const truckRaw = t.includes[0] ?? configFeatures?.[0]?.card ?? "";
                      const truck = tierCardTruckBullet(truckRaw);
                      const crew = t.includes[1] ?? configFeatures?.[1]?.card ?? "";
                      const bullets: string[] = [
                        truck,
                        crew,
                        ...configFeatures.slice(2).map((f) => f.card),
                      ].filter(Boolean);
                      return (
                        <div className="flex-1 min-h-0 flex flex-col mb-4">
                          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                            {bullets.map((inc, i) => (
                              <li key={`full-${i}`} className="flex gap-2.5 items-start">
                                <Check className="w-3.5 h-3.5 shrink-0 mt-[3px]" style={{ color: checkColor }} />
                                <span className="text-[12px] leading-relaxed min-w-0" style={{ color: cardFg ?? FOREST }}>{inc}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }

                    const deltaCards = additions.map((f) => f.card).filter(Boolean);
                    // “Everything in …, plus:” — list only tier-specific lines (truck/crew live in Essential).
                    const listBullets = deltaCards;
                    return (
                      <div className="flex-1 min-h-0 flex flex-col mb-4 space-y-3">
                        {intro ? (
                          <p
                            className="text-[11px] md:text-[12px] font-bold leading-snug pl-0.5 pr-1 shrink-0"
                            style={{ color: cardFg ?? FOREST }}
                          >
                            {intro}
                          </p>
                        ) : null}
                        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                          {listBullets.map((inc, i) => (
                            <li key={`add-${i}`} className="flex gap-2.5 items-start">
                              <Check className="w-3.5 h-3.5 shrink-0 mt-[3px]" style={{ color: checkColor }} />
                              <span className="text-[12px] leading-relaxed min-w-0" style={{ color: cardFg ?? FOREST }}>{inc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  {!isCollapsed && meta.footer && (
                    <p className="text-[12px] mb-4 leading-relaxed shrink-0 font-medium" style={{ color: footerColor }}>
                      {meta.footer}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectTier(tierKey)}
                    className={`w-full py-3.5 rounded-none text-[10px] font-bold tracking-[0.12em] uppercase transition-opacity flex-shrink-0 hover:opacity-90 border-0 ${
                      isSelected ? "text-white" : ""
                    } ${isCollapsed ? "mt-auto" : ""}`}
                    style={
                      isSelected
                        ? { backgroundColor: FOREST }
                        : {
                            backgroundColor: "transparent",
                            color: isEstate ? ESTATE_ACCENT_LIGHT : meta.accent,
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
                  <p className="text-center text-[10px] mt-2.5 flex-shrink-0 font-medium" style={{ color: depositColor }}>
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
