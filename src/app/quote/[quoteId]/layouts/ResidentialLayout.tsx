import { Check, CaretRight as ChevronRight, Target, Crown, Star, SketchLogo, type Icon as LucideIcon } from "@phosphor-icons/react";
import {
  type Quote,
  type TierData,
  type TierFeature,
  type ResidentialQuoteTierMetaMap,
  TIER_ORDER,
  WINE,
  FOREST,
  GOLD,
  fmtPrice,
} from "../quote-shared";

const TIER_ICONS: Record<string, LucideIcon> = {
  essential: Target,
  signature: Crown,
  estate: SketchLogo,
};

/** Tier card subcopy: enough contrast on cream / white (WCAG-friendly body text). */
const LIGHT_TAGLINE = `${FOREST}CC`;
const LIGHT_TAX_LINE = FOREST;
const LIGHT_FOOTER = `${FOREST}AA`;

const ESTATE_TAGLINE = "rgba(255,255,255,0.82)";
const ESTATE_TAX_LINE = "rgba(255,255,255,0.92)";
const ESTATE_FOOTER = "rgba(255,255,255,0.78)";

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
  /** Merged tier labels, taglines, and “Best for” lines (from code + platform_config). */
  tierMetaMap: ResidentialQuoteTierMetaMap;
}

export default function ResidentialLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier = "signature",
  hasSelection = false,
  tierFeaturesConfig,
  tierMetaMap,
}: Props) {
  const raw = (recommendedTier ?? "signature").toString().toLowerCase().trim();
  const recTier = TIER_ORDER.includes(raw as (typeof TIER_ORDER)[number]) ? raw : "signature";
  return (
    <section className="mb-10 min-w-0 w-full max-w-full">
      <div className="text-center mb-8">
        <h2 className="font-hero text-[30px] md:text-[32px] mb-2" style={{ color: WINE }}>
          Choose your plan
        </h2>
        <p className="text-[13px] max-w-md mx-auto" style={{ color: `${FOREST}80` }}>
          Every package includes a professional crew, truck, and blanket wrapping.
        </p>
        {quote.expires_at && (
          <p className="text-[12px] mt-2" style={{ color: "#5C5853" }}>
            Quote valid until{" "}
            {new Date(quote.expires_at).toLocaleDateString("en-CA", { month: "long", day: "numeric" })}
          </p>
        )}
      </div>

      {recTier === "estate" && (
        <div className="mb-6 flex justify-center w-full min-w-0 px-1 sm:px-0">
          <div
            className="box-border flex w-full min-w-0 max-w-full items-start gap-2.5 rounded-xl px-4 py-2.5 text-left text-[12px] sm:inline-flex sm:w-fit sm:max-w-none sm:items-center sm:px-5 sm:text-[13px]"
            style={{ backgroundColor: `${WINE}10`, color: FOREST }}
          >
            <Star className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" style={{ color: WINE }} weight="fill" />
            <span className="min-w-0 leading-snug">
              Your move coordinator recommended <strong style={{ color: WINE }}>Estate</strong> based on your requirements.
            </span>
          </div>
        </div>
      )}
      {recTier === "signature" && (
        <div className="mb-6 flex justify-center w-full min-w-0 px-1 sm:px-0">
          <div
            className="box-border flex w-full min-w-0 max-w-full items-start gap-2.5 rounded-xl px-4 py-2.5 text-left text-[12px] sm:inline-flex sm:w-fit sm:max-w-none sm:items-center sm:px-5 sm:text-[13px]"
            style={{ backgroundColor: `${GOLD}10`, color: FOREST }}
          >
            <Star className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" style={{ color: GOLD }} weight="fill" />
            <span className="min-w-0 leading-snug">
              Your move coordinator recommended <strong style={{ color: GOLD }}>Signature</strong> for full-service protection.
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
          const checkColor = isEstate ? "#C9A84C" : GOLD;
          const depositColor = isEstate ? "#C9A84C" : GOLD;
          const taglineColor = isEstate ? ESTATE_TAGLINE : LIGHT_TAGLINE;
          const taxLineColor = isEstate ? ESTATE_TAX_LINE : LIGHT_TAX_LINE;
          const footerColor = isEstate ? ESTATE_FOOTER : LIGHT_FOOTER;

          return (
            <div
              key={tierKey}
              className={`relative flex h-full min-h-0 flex-col rounded-2xl overflow-hidden transition-all duration-300 ease-in-out ${
                isSelected ? "shadow-lg" : isRecommended ? "shadow-md" : "shadow-sm"
              } ${isCollapsed ? "opacity-60" : ""}`}
            >
              {/* Card body, no badge strip */}
              <div
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl"
                style={
                  isEstate
                    ? {
                        background: "linear-gradient(135deg, #2B0E18 0%, #5C1A33 38%, #722F45 70%, #3D1522 100%)",
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: "rgba(201, 168, 76, 0.4)",
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
                          style={{ color: isEstate ? "#C9A84C" : meta.accent }}
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      ) : null;
                    })()}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <h3 className="font-heading text-[16px] font-bold leading-tight" style={{ color: isEstate ? "#C9A84C" : meta.accent }}>
                        {meta.label}
                      </h3>
                      {isRecommended && (
                        <span
                          className="uppercase text-[8px] sm:text-[9px] font-semibold tracking-wide leading-tight shrink-0 inline-flex items-center"
                          style={{
                            letterSpacing: "0.2px",
                            color: "#0A0A0A",
                            backgroundColor: GOLD,
                            padding: "4px 7px",
                            borderRadius: "3px",
                          }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="font-hero shrink-0 text-right text-[clamp(1.125rem,0.85rem+1.5vw,1.5rem)] font-bold leading-none tabular-nums"
                    style={{ color: isEstate ? "#C9A84C" : meta.accent }}
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
                    // Use tierFeaturesConfig when available: keep dynamic truck+crew from
                    // t.includes[0..1], then use card labels from config for the rest.
                    const configFeatures = tierFeaturesConfig?.[tierKey];
                    const bullets: string[] = configFeatures
                      ? [
                          t.includes[0] ?? configFeatures[0]?.card ?? "",
                          t.includes[1] ?? configFeatures[1]?.card ?? "",
                          ...configFeatures.slice(2).map((f) => f.card),
                        ].filter(Boolean)
                      : t.includes;
                    return (
                      <div className="flex-1 min-h-0 flex flex-col mb-4">
                        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain space-y-2.5 pr-1 [scrollbar-gutter:stable]">
                          {bullets.map((inc, i) => (
                            <li key={i} className="flex gap-2.5 items-start">
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
                    className={`w-full py-3 rounded-xl text-[12px] font-bold tracking-wide transition-all flex-shrink-0 hover:opacity-90 ${
                      isSelected ? "text-white shadow-md" : ""
                    } ${isCollapsed ? "mt-auto" : ""}`}
                    style={
                      isSelected
                        ? { backgroundColor: GOLD }
                        : { backgroundColor: "transparent", color: isEstate ? "#C9A84C" : meta.accent }
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
