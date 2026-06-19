import {
  Buildings as Building2,
  MapPin,
  Calendar,
  Check,
  Users,
  Truck,
} from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";
import { toTitleCase, formatAccessForDisplay } from "@/lib/format-text";
import { formatMoveDate } from "@/lib/date-format";

interface TierData {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

interface Props {
  quote: Quote;
  tiers?: Record<string, TierData> | null;
  selectedTier?: string | null;
  onSelectTier?: (key: string) => void;
  recommendedTier?: string | null;
  onConfirm: () => void;
  confirmed: boolean;
}

const OFFICE_TIER_ORDER = ["essential", "signature", "priority"] as const;
const TIER_LABEL: Record<string, string> = {
  essential: "Essential",
  signature: "Signature",
  priority: "Priority",
};
const TIER_TAGLINE: Record<string, string> = {
  essential: "Your team packs. We move it properly.",
  signature: "We handle your IT. Your team handles the boxes.",
  priority: "We handle everything. Your team unlocks the door.",
};

const PRIORITY_BG = `linear-gradient(155deg, ${FOREST} 0%, #3E4D40 45%, #233024 100%)`;

export default function OfficeLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier,
  onConfirm,
  confirmed,
}: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const officeTiered =
    !!tiers && OFFICE_TIER_ORDER.every((k) => tiers[k] && tiers[k].price > 0);

  const scopeItems = (
    [
      quote.from_access && {
        label: "Origin access",
        value:
          formatAccessForDisplay(quote.from_access) ??
          toTitleCase(quote.from_access),
      },
      quote.to_access && {
        label: "Destination access",
        value:
          formatAccessForDisplay(quote.to_access) ??
          toTitleCase(quote.to_access),
      },
      f?.office_unit_count != null && {
        label: "Items moving",
        value: `${f.office_unit_count}`,
      },
    ] as (false | null | undefined | { label: string; value: string })[]
  ).filter((x): x is { label: string; value: string } => !!x);

  const crew = (f?.office_crew as number | undefined) ?? null;
  const trucks = (f?.office_trucks as number | undefined) ?? null;
  const perTierDays = f?.office_per_tier_days as
    | Record<string, number>
    | undefined;

  const recTier = (recommendedTier ?? "priority").toLowerCase();

  return (
    <section className="mb-10 space-y-8">
      {/* Badge */}
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ backgroundColor: `${FOREST}08` }}
        >
          <Building2 className="w-3.5 h-3.5" style={{ color: FOREST }} />
          <span
            className="text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: FOREST }}
          >
            Commercial Relocation
          </span>
        </div>
      </div>

      {/* ── Tiered packages ── */}
      {officeTiered && tiers ? (
        <div>
          <h2 className="admin-section-h2 mb-1 text-center">
            Choose your package
          </h2>
          <p
            className="text-[12px] text-center mb-5"
            style={{ color: `${FOREST}80` }}
          >
            Three flat-rate packages. The difference is how much your team does
            versus how much Yugo handles.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {OFFICE_TIER_ORDER.map((key) => {
              const t = tiers[key];
              if (!t) return null;
              const isPriority = key === "priority";
              const isSelected = selectedTier === key;
              const isRec = key === recTier;

              // Additive includes: show the delta over the previous tier.
              const prevKey =
                key === "signature"
                  ? "essential"
                  : key === "priority"
                    ? "signature"
                    : null;
              const prevSet = new Set(prevKey ? tiers[prevKey]?.includes ?? [] : []);
              const shown = prevKey
                ? t.includes.filter(
                    (x) => !prevSet.has(x) && !x.startsWith("Professional crew"),
                  )
                : t.includes;

              const fg = isPriority ? "rgba(255,255,255,0.92)" : FOREST;
              const accent = isPriority ? "rgba(255,255,255,0.96)" : WINE;
              const muted = isPriority ? "rgba(255,255,255,0.7)" : `${FOREST}70`;
              const checkColor = isPriority ? "rgba(255,255,255,0.9)" : FOREST;

              return (
                <div
                  key={key}
                  className="relative flex flex-col overflow-hidden rounded-none"
                  style={{
                    background: isPriority ? PRIORITY_BG : "#FFFFFF",
                    boxShadow: isSelected
                      ? "0 12px 40px rgba(44,62,45,0.18)"
                      : "0 2px 16px rgba(44,62,45,0.07)",
                    outline: isSelected ? `2px solid ${isPriority ? "#FFFFFF" : FOREST}` : "none",
                  }}
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className="text-[15px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)]"
                        style={{ color: accent }}
                      >
                        {TIER_LABEL[key]}
                        {isRec && (
                          <span
                            className="ml-1.5 text-[8px] align-baseline tracking-[0.12em]"
                            style={{ color: isPriority ? "rgba(255,255,255,0.7)" : "#492A1D" }}
                          >
                            · RECOMMENDED
                          </span>
                        )}
                      </h3>
                    </div>

                    <p
                      className="text-[12px] mt-3 leading-relaxed min-h-[34px]"
                      style={{ color: isPriority ? "rgba(255,255,255,0.82)" : `${FOREST}b0` }}
                    >
                      {TIER_TAGLINE[key]}
                    </p>

                    <p
                      className="font-hero text-[30px] mt-3 leading-none tabular-nums"
                      style={{ color: isPriority ? "rgba(255,255,255,0.96)" : WINE }}
                    >
                      {fmtPrice(t.price)}
                    </p>
                    <p className="text-[11px] mt-1 tabular-nums" style={{ color: muted }}>
                      +{fmtPrice(t.tax)} HST · Total {fmtPrice(t.total)}
                    </p>
                    {perTierDays?.[key] != null && (
                      <p className="text-[10px] mt-0.5" style={{ color: muted }}>
                        {perTierDays[key]} day{perTierDays[key] === 1 ? "" : "s"}
                        {crew ? ` · crew of ${crew}` : ""}
                      </p>
                    )}

                    <div className="mt-4 space-y-2 flex-1">
                      {prevKey && (
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.1em]"
                          style={{ color: muted }}
                        >
                          Everything in {TIER_LABEL[prevKey]}, plus
                        </p>
                      )}
                      {shown.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check
                            className="w-3.5 h-3.5 shrink-0 mt-0.5"
                            style={{ color: checkColor }}
                          />
                          <span
                            className="text-[12px] leading-snug"
                            style={{ color: fg }}
                          >
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTier?.(key)}
                      className="mt-6 w-full py-3 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: isPriority ? "rgba(255,255,255,0.95)" : FOREST,
                        color: isPriority ? FOREST : "#FFFFFF",
                      }}
                    >
                      {isSelected ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      ) : (
                        `Select ${TIER_LABEL[key]}`
                      )}
                    </button>
                    <p className="text-[10px] mt-2 text-center" style={{ color: muted }}>
                      {fmtPrice(t.deposit)} deposit · balance 48h before service
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Scope of Work ── */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="admin-section-h2 mb-4">Scope of work</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
                From
              </p>
              <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                {quote.from_address}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
                To
              </p>
              <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                {quote.to_address}
              </p>
            </div>
          </div>
        </div>

        {scopeItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--brd)]/30">
            <table className="w-full text-[12px]">
              <tbody>
                {scopeItems.map((item, i) => (
                  <tr
                    key={i}
                    className={i > 0 ? "border-t border-[var(--brd)]/30" : ""}
                  >
                    <td className="py-2 font-medium" style={{ color: FOREST }}>
                      {item.label}
                    </td>
                    <td className="py-2 text-right" style={{ color: `${FOREST}80` }}>
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Crew & logistics ── */}
      {(crew || trucks || quote.move_date) && (
        <div className="pt-6 border-t border-[var(--brd)]/30">
          <h2 className="admin-section-h2 mb-4">Crew &amp; logistics</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Users className="w-5 h-5 mx-auto mb-1.5" style={{ color: WINE }} />
              <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                {crew ?? 4} crew
              </p>
              <p className="text-[10px]" style={{ color: `${FOREST}60` }}>
                Commercial team
              </p>
            </div>
            <div>
              <Truck className="w-5 h-5 mx-auto mb-1.5" style={{ color: FOREST }} />
              <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                {trucks ?? 1} truck{(trucks ?? 1) === 1 ? "" : "s"}
              </p>
              <p className="text-[10px]" style={{ color: `${FOREST}60` }}>
                Fleet on site
              </p>
            </div>
            <div>
              <Calendar className="w-5 h-5 mx-auto mb-1.5" style={{ color: FOREST }} />
              <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                {quote.move_date ? formatMoveDate(quote.move_date) : "TBD"}
              </p>
              <p className="text-[10px]" style={{ color: `${FOREST}60` }}>
                Move date
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Legacy single-price fallback (no tiers) ── */}
      {!officeTiered &&
        (() => {
          const price = quote.custom_price ?? 0;
          const tax = Math.round(price * TAX_RATE);
          const deposit = calculateDeposit("office_move", price);
          return (
            <div
              className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
              style={{ borderColor: FOREST }}
            >
              <div
                className="px-5 py-4 border-b border-[#E2DDD5]"
                style={{ backgroundColor: `${FOREST}08` }}
              >
                <h2
                  className="font-heading text-[13px] font-bold tracking-wider uppercase"
                  style={{ color: WINE }}
                >
                  Investment Summary
                </h2>
              </div>
              <div className="p-5 md:p-6">
                <div
                  className="border-t-2 pt-4 text-center"
                  style={{ borderColor: `${FOREST}30` }}
                >
                  <p className="font-hero text-[36px] md:text-[42px]" style={{ color: WINE }}>
                    {fmtPrice(price)}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: `${FOREST}70` }}>
                    +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
                  </p>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className={`mt-5 w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90 ${
                      confirmed ? "opacity-80" : ""
                    }`}
                    style={{ backgroundColor: FOREST }}
                  >
                    {confirmed ? (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Selected
                      </span>
                    ) : (
                      `Proceed — ${fmtPrice(deposit)} Deposit`
                    )}
                  </button>
                  <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
                    {price < 5000 ? "25%" : "30%"} deposit · Balance due 48 hours
                    before your service
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
