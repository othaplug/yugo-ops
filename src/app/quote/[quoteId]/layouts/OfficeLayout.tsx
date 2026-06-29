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
import {
  SIGNATURE_PAGE_BG,
  SIGNATURE_ON_SHELL,
  SIGNATURE_CTA,
} from "../signature-quote-ui";
import {
  premiumShellInk,
  type PremiumShellKind,
} from "../quote-premium-shell";
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
  /** How the client sees the tier ladder.
   *   comparison         -- all three side-by-side (default)
   *   priority_featured  -- all three, but Priority is rendered first
   *                         as a hero card with the wine prominence
   *   priority_only      -- only the Priority card renders
   *  Mirror of residential's estate_featured / estate_only modes. */
  presentationMode?: "comparison" | "priority_featured" | "priority_only";
  /** Premium page shell (wine when Priority selected, green for Signature). The
   *  scope/crew sections below the cards adapt their ink so dark-on-dark text
   *  doesn't disappear on the deep shell. */
  premiumShellKind?: PremiumShellKind;
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

// Priority flies the wine card + shell (like residential Estate); Signature the
// deep-green card + shell; Essential stays light. Mirrors the residential tiers.
const PRIORITY_WINE_BG = `linear-gradient(155deg, ${WINE} 0%, #6B2848 42%, #3D1522 100%)`;

interface CardTheme {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  check: string;
  tagline: string;
  price: string;
  btnBg: string;
  btnFg: string;
  recTag: string;
}

function cardTheme(key: string): CardTheme {
  const sig = SIGNATURE_ON_SHELL;
  if (key === "priority") {
    return {
      bg: PRIORITY_WINE_BG,
      fg: "rgba(255,255,255,0.92)",
      accent: "rgba(255,255,255,0.96)",
      muted: "rgba(255,255,255,0.7)",
      check: "rgba(255,255,255,0.9)",
      tagline: "rgba(255,255,255,0.82)",
      price: "rgba(255,255,255,0.96)",
      btnBg: "rgba(255,255,255,0.95)",
      btnFg: WINE,
      recTag: "rgba(255,255,255,0.72)",
    };
  }
  if (key === "signature") {
    return {
      bg: SIGNATURE_PAGE_BG,
      fg: sig.body,
      accent: sig.primary,
      muted: sig.muted,
      check: sig.kicker,
      tagline: sig.body,
      price: sig.primary,
      btnBg: SIGNATURE_CTA,
      btnFg: "#FFFFFF",
      recTag: sig.kicker,
    };
  }
  return {
    bg: "#FFFFFF",
    fg: FOREST,
    accent: WINE,
    muted: `${FOREST}70`,
    check: FOREST,
    tagline: `${FOREST}b0`,
    price: WINE,
    btnBg: FOREST,
    btnFg: "#FFFFFF",
    recTag: "#492A1D",
  };
}

export default function OfficeLayout({
  quote,
  tiers,
  selectedTier,
  onSelectTier,
  recommendedTier,
  onConfirm,
  confirmed,
  presentationMode = "comparison",
  premiumShellKind = "none",
}: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const officeTiered =
    !!tiers && OFFICE_TIER_ORDER.every((k) => tiers[k] && tiers[k].price > 0);
  // Split tiers by presentation mode.
  //   comparison        -> all three side-by-side, no hero
  //   priority_featured -> Priority as HERO (one big card),
  //                        Essential + Signature in a collapsible
  //                        "Compare with other packages" below
  //   priority_only     -> Priority hero, nothing else (no compare)
  // Mirrors how residential estate_featured / estate_only work.
  const isPriorityFeatured =
    officeTiered && presentationMode === "priority_featured";
  const isPriorityOnly =
    officeTiered && presentationMode === "priority_only";
  const heroTiers: readonly string[] =
    !officeTiered
      ? OFFICE_TIER_ORDER
      : isPriorityOnly || isPriorityFeatured
        ? ["priority"]
        : OFFICE_TIER_ORDER;
  const compareTiers: readonly string[] = isPriorityFeatured
    ? ["essential", "signature"]
    : [];

  // When a premium shell is on (Priority = wine, Signature = green), the page
  // background is deep, so the scope/crew sections below the cards must use
  // light ink. On the default cream shell they stay dark.
  const ink = premiumShellInk(premiumShellKind);
  const headingColor = ink ? ink.primary : "#2C3E2D";
  const bodyColor = ink ? ink.body : FOREST;
  const mutedColor = ink ? ink.muted : `${FOREST}80`;
  const subtleColor = ink ? ink.subtle : `${FOREST}99`;
  const eyebrowColor = ink ? ink.muted : "#5C5853";
  const iconPrimary = ink ? ink.primary : WINE;
  const iconSecondary = ink ? ink.body : FOREST;
  const sectionBorderClass = ink ? "border-white/15" : "border-[var(--brd)]/30";
  const badgeBg = ink ? "rgba(255,255,255,0.10)" : `${FOREST}08`;

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
          style={{ backgroundColor: badgeBg }}
        >
          <Building2 className="w-3.5 h-3.5" style={{ color: bodyColor }} />
          <span
            className="text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: bodyColor }}
          >
            Commercial Relocation
          </span>
        </div>
      </div>

      {/* ── Tiered packages ── */}
      {officeTiered && tiers ? (
        <div>
          <h2
            className="admin-section-h2 mb-1 text-center"
            style={{ color: headingColor }}
          >
            Choose your package
          </h2>
          <p
            className="text-[12px] text-center mb-5"
            style={{ color: mutedColor }}
          >
            Three flat-rate packages. The difference is how much your team does
            versus how much Yugo handles.
          </p>
          <div
            className={`grid gap-4 ${
              heroTiers.length === 1
                ? "md:grid-cols-1 max-w-md mx-auto"
                : "md:grid-cols-3"
            }`}
          >
            {heroTiers.map((key) => {
              const t = tiers[key];
              if (!t) return null;
              const isSelected = selectedTier === key;
              const isRec = key === recTier;
              const isDark = key === "priority" || key === "signature";
              const th = cardTheme(key);

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

              return (
                <div
                  key={key}
                  className="relative flex flex-col overflow-hidden rounded-none"
                  style={{
                    background: th.bg,
                    // A faint edge keeps dark cards distinct when the page shell
                    // is the same family (e.g. wine Priority card on wine shell).
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.14)"
                      : "1px solid rgba(44,62,45,0.10)",
                    boxShadow: isSelected
                      ? "0 12px 40px rgba(44,62,45,0.18)"
                      : "0 2px 16px rgba(44,62,45,0.07)",
                    outline: isSelected
                      ? `2px solid ${isDark ? "#FFFFFF" : FOREST}`
                      : "none",
                  }}
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className="text-[15px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)]"
                        style={{ color: th.accent }}
                      >
                        {TIER_LABEL[key]}
                        {isRec && (
                          <span
                            className="ml-1.5 text-[8px] align-baseline tracking-[0.12em]"
                            style={{ color: th.recTag }}
                          >
                            · RECOMMENDED
                          </span>
                        )}
                      </h3>
                    </div>

                    <p
                      className="text-[12px] mt-3 leading-relaxed min-h-[34px]"
                      style={{ color: th.tagline }}
                    >
                      {TIER_TAGLINE[key]}
                    </p>

                    <p
                      className="font-hero text-[30px] mt-3 leading-none tabular-nums"
                      style={{ color: th.price }}
                    >
                      {fmtPrice(t.price)}
                    </p>
                    <p className="text-[11px] mt-1 tabular-nums" style={{ color: th.muted }}>
                      +{fmtPrice(t.tax)} HST · Total {fmtPrice(t.total)}
                    </p>
                    {perTierDays?.[key] != null && (
                      <p className="text-[10px] mt-0.5" style={{ color: th.muted }}>
                        {perTierDays[key]} day{perTierDays[key] === 1 ? "" : "s"}
                        {crew ? ` · crew of ${crew}` : ""}
                      </p>
                    )}

                    <div className="mt-4 space-y-2 flex-1">
                      {prevKey && (
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.1em]"
                          style={{ color: th.muted }}
                        >
                          Everything in {TIER_LABEL[prevKey]}, plus
                        </p>
                      )}
                      {shown.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check
                            className="w-3.5 h-3.5 shrink-0 mt-0.5"
                            style={{ color: th.check }}
                          />
                          <span
                            className="text-[12px] leading-snug"
                            style={{ color: th.fg }}
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
                      style={{ backgroundColor: th.btnBg, color: th.btnFg }}
                    >
                      {isSelected ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      ) : (
                        `Select ${TIER_LABEL[key]}`
                      )}
                    </button>
                    <p className="text-[10px] mt-2 text-center" style={{ color: th.muted }}>
                      {fmtPrice(t.deposit)} deposit · balance 48h before service
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Compare with other packages — priority_featured only ──
             Renders Essential + Signature as smaller secondary cards
             below the Priority hero. Mirrors residential
             estate_featured's compare-row. */}
          {compareTiers.length > 0 && (
            <div className="mt-8">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3 text-center"
                style={{ color: mutedColor }}
              >
                Compare with other packages
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {compareTiers.map((key) => {
                  const t = tiers[key];
                  if (!t) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectTier?.(key)}
                      className="text-left p-4 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span
                          className="text-[12px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: bodyColor }}
                        >
                          {TIER_LABEL[key]}
                        </span>
                        <span
                          className="text-[18px] font-bold tabular-nums"
                          style={{ color: bodyColor }}
                        >
                          {fmtPrice(t.price)}
                        </span>
                      </div>
                      <p
                        className="text-[11px] leading-snug"
                        style={{ color: mutedColor }}
                      >
                        {TIER_TAGLINE[key]}
                      </p>
                      <p
                        className="text-[10px] mt-2"
                        style={{ color: subtleColor }}
                      >
                        {fmtPrice(t.deposit)} deposit · {t.includes.length}{" "}
                        inclusions · Tap to switch
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Scope of Work ── */}
      <div className={`pt-6 border-t ${sectionBorderClass}`}>
        <h2 className="admin-section-h2 mb-4" style={{ color: headingColor }}>
          Scope of work
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: iconPrimary }} />
            <div>
              <p
                className="text-[9px] font-bold tracking-[0.14em] uppercase"
                style={{ color: eyebrowColor }}
              >
                From
              </p>
              <p className="text-[12px] font-medium" style={{ color: bodyColor }}>
                {quote.from_address}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: iconSecondary }} />
            <div>
              <p
                className="text-[9px] font-bold tracking-[0.14em] uppercase"
                style={{ color: eyebrowColor }}
              >
                To
              </p>
              <p className="text-[12px] font-medium" style={{ color: bodyColor }}>
                {quote.to_address}
              </p>
            </div>
          </div>
        </div>

        {scopeItems.length > 0 && (
          <div className={`mt-4 pt-4 border-t ${sectionBorderClass}`}>
            <table className="w-full text-[12px]">
              <tbody>
                {scopeItems.map((item, i) => (
                  <tr
                    key={i}
                    className={i > 0 ? `border-t ${sectionBorderClass}` : ""}
                  >
                    <td className="py-2 font-medium" style={{ color: bodyColor }}>
                      {item.label}
                    </td>
                    <td className="py-2 text-right" style={{ color: mutedColor }}>
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
        <div className={`pt-6 border-t ${sectionBorderClass}`}>
          <h2 className="admin-section-h2 mb-4" style={{ color: headingColor }}>
            Crew &amp; logistics
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Users className="w-5 h-5 mx-auto mb-1.5" style={{ color: iconPrimary }} />
              <p className="text-[13px] font-bold" style={{ color: bodyColor }}>
                {crew ?? 4} crew
              </p>
              <p className="text-[10px]" style={{ color: subtleColor }}>
                Commercial team
              </p>
            </div>
            <div>
              <Truck className="w-5 h-5 mx-auto mb-1.5" style={{ color: iconSecondary }} />
              <p className="text-[13px] font-bold" style={{ color: bodyColor }}>
                {trucks ?? 1} truck{(trucks ?? 1) === 1 ? "" : "s"}
              </p>
              <p className="text-[10px]" style={{ color: subtleColor }}>
                Fleet on site
              </p>
            </div>
            <div>
              <Calendar className="w-5 h-5 mx-auto mb-1.5" style={{ color: iconSecondary }} />
              <p className="text-[13px] font-bold" style={{ color: bodyColor }}>
                {quote.move_date ? formatMoveDate(quote.move_date) : "TBD"}
              </p>
              <p className="text-[10px]" style={{ color: subtleColor }}>
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
