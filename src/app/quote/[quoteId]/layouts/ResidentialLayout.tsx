import { Check, Shield, Crown, Gem, type LucideIcon } from "lucide-react";
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
  essentials: Shield,
  premier: Crown,
  estate: Gem,
};

interface Props {
  quote: Quote;
  tiers: Record<string, TierData>;
  selectedTier: string | null;
  onSelectTier: (tierKey: string) => void;
  recommendedTier?: string;
}

export default function ResidentialLayout({
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier = "premier",
}: Props) {
  return (
    <section className="mb-10">
      <div className="text-center mb-8">
        <h2 className="font-hero text-[30px] md:text-[32px] mb-2" style={{ color: WINE }}>
          Choose Your Package
        </h2>
        <p className="text-[13px] max-w-md mx-auto" style={{ color: `${FOREST}80` }}>
          Every package includes a professional crew, truck, and blanket wrapping.
          Upgrade for more protection and convenience.
        </p>
      </div>

      {recommendedTier === "estate" && (
        <div
          className="mb-6 rounded-xl px-5 py-3 text-center text-[12px] border"
          style={{ backgroundColor: `${WINE}08`, borderColor: `${WINE}30`, color: FOREST }}
        >
          Your move coordinator recommended <strong style={{ color: WINE }}>Estate</strong> based on your requirements.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl md:max-w-6xl lg:max-w-7xl mx-auto">
        {TIER_ORDER.map((tierKey) => {
          const t = tiers[tierKey];
          if (!t) return null;
          const meta = TIER_META[tierKey];
          const isSelected = selectedTier === tierKey;
          const isRecommended = tierKey === recommendedTier;

          const badgeText =
            recommendedTier === "estate" && tierKey === "estate"
              ? "Recommended for You"
              : recommendedTier === "premier" && tierKey === "premier"
                ? "Recommended"
                : null;

          return (
            <div
              key={tierKey}
              className={`relative rounded-2xl border-2 transition-all duration-300 flex flex-col overflow-hidden ${
                isSelected ? "shadow-lg" : isRecommended ? "shadow-md" : "shadow-sm"
              }`}
              style={{
                backgroundColor: meta.bg,
                borderColor: isSelected ? GOLD : isRecommended ? meta.accent : meta.border,
              }}
            >
              {badgeText && (
                <div
                  className="text-center py-1.5 text-[9px] font-bold tracking-[0.15em] uppercase text-white flex-shrink-0"
                  style={{ backgroundColor: tierKey === "estate" ? WINE : GOLD }}
                >
                  {badgeText}
                </div>
              )}

              <div className="p-5 md:p-6 flex flex-col flex-1 min-h-0">
                <div className="flex items-start justify-between gap-4 flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {(() => {
                      const TierIcon = TIER_ICONS[tierKey];
                      return TierIcon ? (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${meta.accent}10` }}
                        >
                          <TierIcon className="w-5 h-5" style={{ color: meta.accent }} strokeWidth={1.5} />
                        </div>
                      ) : null;
                    })()}
                    <h3 className="font-heading text-[16px] font-bold" style={{ color: meta.accent }}>
                      {meta.label}
                    </h3>
                  </div>
                  <span className="font-hero text-[24px] md:text-[28px] font-normal flex-shrink-0" style={{ color: meta.accent }}>
                    {fmtPrice(t.price)}
                  </span>
                </div>
                <p data-tier-tagline className="mt-2 w-full leading-relaxed text-[11px] md:text-[12px]" style={{ color: `${FOREST}70` }}>
                  {meta.tagline}
                </p>

                <div className="mt-4 flex flex-col flex-1 min-h-0">
                  <p className="text-[11px] mb-3" style={{ color: `${FOREST}60` }}>
                    +{fmtPrice(t.tax)} HST &middot; Total {fmtPrice(t.total)}
                  </p>

                  <ul className="space-y-2 mb-6 flex-1">
                    {t.includes.map((inc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                        <span className="text-[12px] leading-snug" style={{ color: FOREST }}>{inc}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onSelectTier(tierKey)}
                    className={`w-full py-3 rounded-xl text-[12px] font-bold tracking-wide transition-all flex-shrink-0 ${
                      isSelected ? "text-white shadow-md" : "border-2 hover:shadow-sm"
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: GOLD }
                        : isRecommended
                          ? { backgroundColor: tierKey === "estate" ? WINE : GOLD, color: "#FFFFFF" }
                          : { borderColor: meta.accent, color: meta.accent }
                    }
                  >
                    {isSelected ? (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Selected
                      </span>
                    ) : isRecommended ? (
                      `Book ${meta.label}`
                    ) : (
                      `Select ${meta.label}`
                    )}
                  </button>

                  <p className="text-center text-[10px] mt-2.5 flex-shrink-0" style={{ color: GOLD }}>
                    {fmtPrice(t.deposit)} deposit to book
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
