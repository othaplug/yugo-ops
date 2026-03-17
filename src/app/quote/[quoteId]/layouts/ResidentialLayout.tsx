import { Check, ChevronRight, Target, Crown, Gem, type LucideIcon } from "lucide-react";
import {
  type Quote,
  type TierData,
  TIER_ORDER,
  TIER_META,
  WINE,
  FOREST,
  GOLD,
  fmtPrice,
} from "../quote-shared";

const TIER_ICONS: Record<string, LucideIcon> = {
  curated: Target,
  signature: Crown,
  estate: Gem,
};

interface Props {
  quote: Quote;
  tiers: Record<string, TierData>;
  selectedTier: string | null;
  onSelectTier: (tierKey: string) => void;
  recommendedTier?: string;
  /** When true, unselected tier cards collapse to compact view */
  hasSelection?: boolean;
}

export default function ResidentialLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier = "signature",
  hasSelection = false,
}: Props) {
  const raw = (recommendedTier ?? "signature").toString().toLowerCase().trim();
  const recTier = TIER_ORDER.includes(raw as (typeof TIER_ORDER)[number]) ? raw : "signature";
  return (
    <section className="mb-10">
      <div className="text-center mb-8">
        <h2 className="font-hero text-[30px] md:text-[32px] mb-2" style={{ color: WINE }}>
          Choose Your Package
        </h2>
        <p className="text-[13px] max-w-md mx-auto" style={{ color: `${FOREST}80` }}>
          Every package includes a professional crew, truck, and blanket wrapping.
        </p>
        {quote.expires_at && (
          <p className="text-[12px] mt-2" style={{ color: "#999" }}>
            Quote valid until{" "}
            {new Date(quote.expires_at).toLocaleDateString("en-CA", { month: "long", day: "numeric" })}
          </p>
        )}
      </div>

      {recTier === "estate" && (
        <div
          className="mb-6 rounded-xl px-5 py-3 text-center text-[12px] border"
          style={{ backgroundColor: `${WINE}08`, borderColor: `${WINE}30`, color: FOREST }}
        >
          Your move coordinator recommended <strong style={{ color: WINE }}>Estate</strong> based on your requirements.
        </div>
      )}
      {recTier === "signature" && (
        <div
          className="mb-6 rounded-xl px-5 py-3 text-center text-[12px] border"
          style={{ backgroundColor: `${GOLD}08`, borderColor: `${GOLD}30`, color: FOREST }}
        >
          Your move coordinator recommended <strong style={{ color: GOLD }}>Signature</strong> for full-service protection.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl md:max-w-7xl lg:max-w-7xl xl:max-w-[84rem] mx-auto px-2">
        {TIER_ORDER.map((tierKey) => {
          const t = tiers[tierKey];
          if (!t) return null;
          const meta = TIER_META[tierKey];
          const isSelected = selectedTier === tierKey;
          const isRecommended = tierKey === recTier;

          const isEstate = tierKey === "estate";
          const cardBg = isEstate ? "rgba(45, 12, 26, 1)" : meta.bg;

          const isCollapsed = hasSelection && !isSelected;

          const cardFg = isEstate ? "rgba(255,255,255,0.9)" : undefined;
          const cardMuted = isEstate ? "rgba(255,255,255,0.65)" : undefined;
          const checkColor = isEstate ? "#C9A84C" : GOLD;
          const depositColor = isEstate ? "#C9A84C" : GOLD;

          return (
            <div
              key={tierKey}
              className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ease-in-out ${
                isSelected ? "shadow-lg" : isRecommended ? "shadow-md" : "shadow-sm"
              } ${isCollapsed ? "opacity-60" : ""}`}
            >
              {/* Card body — no badge strip */}
              <div
                className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl"
                style={{
                  backgroundColor: cardBg,
                }}
              >
              <div
                className={`p-5 md:p-6 flex flex-col flex-1 min-h-0 transition-all duration-300 ${isCollapsed ? "!p-4" : ""}`}
                style={
                  isEstate
                    ? {
                        backgroundColor: "rgba(45, 12, 26, 1)",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        borderColor: "rgba(0, 0, 0, 1)",
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-4 flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    {(() => {
                      const TierIcon = TIER_ICONS[tierKey];
                      return TierIcon ? (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: isEstate ? "rgba(201,168,76,0.2)" : `${meta.accent}10` }}
                        >
                          <TierIcon className="w-5 h-5" style={{ color: isEstate ? "#C9A84C" : meta.accent }} strokeWidth={1.5} />
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading text-[16px] font-bold" style={{ color: isEstate ? "#C9A84C" : meta.accent }}>
                        {meta.label}
                      </h3>
                      {isRecommended && (
                        <span
                          className="uppercase text-[8px] font-bold tracking-wider"
                          style={{
                            letterSpacing: "0.5px",
                            color: "#0A0A0A",
                            backgroundColor: GOLD,
                            padding: "2px 6px",
                            borderRadius: "3px",
                          }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-hero text-[24px] md:text-[28px] font-bold flex-shrink-0" style={{ color: isEstate ? "#C9A84C" : meta.accent }}>
                    {fmtPrice(t.price)}
                  </span>
                </div>
                {!isCollapsed && (
                  <p data-tier-tagline className="mt-2 w-full leading-relaxed text-[11px] md:text-[12px]" style={{ color: cardMuted ?? `${FOREST}70` }}>
                    {meta.tagline}
                  </p>
                )}

                <div className={`mt-4 flex flex-col flex-1 min-h-0 ${isCollapsed ? "!mt-0" : ""}`}>
                  {!isCollapsed && (
                    <p className="text-[11px] mb-3" style={{ color: cardMuted ?? `${FOREST}60` }}>
                      +{fmtPrice(t.tax)} HST &middot; Total {fmtPrice(t.total)}
                    </p>
                  )}

                  {!isCollapsed && (
                  <ul className="space-y-2 mb-4 flex-1">
                    {t.includes.map((inc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: checkColor }} />
                        <span className="text-[12px] leading-snug" style={{ color: cardFg ?? FOREST }}>{inc}</span>
                      </li>
                    ))}
                  </ul>
                  )}
                  {!isCollapsed && meta.footer && (
                    <p className="text-[10px] mb-4 leading-snug" style={{ color: cardMuted ?? `${FOREST}60` }}>
                      {meta.footer}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectTier(tierKey)}
                    className={`w-full py-3 rounded-xl text-[12px] font-bold tracking-wide transition-all flex-shrink-0 hover:opacity-90 ${
                      isSelected ? "text-white shadow-md" : ""
                    }`}
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
                  <p className="text-center text-[10px] mt-2.5 flex-shrink-0" style={{ color: depositColor }}>
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
