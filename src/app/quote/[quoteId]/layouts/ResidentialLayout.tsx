import { Check } from "lucide-react";
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

interface Props {
  quote: Quote;
  tiers: Record<string, TierData>;
  selectedTier: string | null;
  onSelectTier: (tierKey: string) => void;
}

export default function ResidentialLayout({ tiers, selectedTier, onSelectTier }: Props) {
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

      <div className="grid md:grid-cols-3 gap-4">
        {TIER_ORDER.map((tierKey) => {
          const t = tiers[tierKey];
          if (!t) return null;
          const meta = TIER_META[tierKey];
          const isSelected = selectedTier === tierKey;
          return (
            <div
              key={tierKey}
              className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                isSelected ? "shadow-lg scale-[1.02]" : "shadow-sm hover:shadow-md hover:-translate-y-0.5"
              }`}
              style={{
                backgroundColor: meta.bg,
                borderColor: isSelected ? GOLD : meta.border,
              }}
            >
              {meta.badge && (
                <div
                  className="text-center py-1.5 text-[9px] font-bold tracking-[0.15em] uppercase text-white"
                  style={{ backgroundColor: GOLD }}
                >
                  {meta.badge}
                </div>
              )}

              <div className="p-5 md:p-6">
                <h3 className="font-heading text-[16px] font-bold" style={{ color: meta.accent }}>
                  {meta.label}
                </h3>
                <p className="text-[11px] mt-0.5 mb-4" style={{ color: `${FOREST}70` }}>
                  {meta.tagline}
                </p>

                <div className="mb-1">
                  <span className="font-hero text-[34px] font-normal" style={{ color: meta.accent }}>
                    {fmtPrice(t.price)}
                  </span>
                </div>
                <p className="text-[11px] mb-5" style={{ color: `${FOREST}60` }}>
                  +{fmtPrice(t.tax)} HST &middot; Total {fmtPrice(t.total)}
                </p>

                <ul className="space-y-2 mb-6">
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
                  className={`w-full py-3 rounded-xl text-[12px] font-bold tracking-wide transition-all ${
                    isSelected ? "text-white shadow-md" : "border-2 hover:shadow-sm"
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: GOLD }
                      : { borderColor: meta.accent, color: meta.accent }
                  }
                >
                  {isSelected ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> Selected
                    </span>
                  ) : (
                    `Select ${meta.label}`
                  )}
                </button>

                <p className="text-center text-[10px] mt-2.5" style={{ color: GOLD }}>
                  {fmtPrice(t.deposit)} deposit to book
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
