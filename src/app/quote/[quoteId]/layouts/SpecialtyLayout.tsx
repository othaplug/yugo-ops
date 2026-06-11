import { MapPin, Calendar, Check, Wrench, Shield, Sparkle as Sparkles, type Icon as LucideIcon } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";
import { formatPlatformDisplay } from "@/lib/date-format";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  art_installation: "Art Installation",
  trade_show: "Trade Show Setup",
  estate_cleanout: "Estate Cleanout",
  staging: "Staging Service",
  wine_transport: "Wine Transport",
  medical_equip: "Medical Equipment",
  piano_move: "Piano Move",
  event_setup: "Event Setup",
  custom: "Custom Project",
};

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

export default function SpecialtyLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("specialty", price);
  const projectType = (f?.project_type as string) ?? "custom";
  const includes = (f?.includes as string[] | undefined) ?? [
    "Specialized handling equipment",
    "Experienced specialty crew",
    "Custom protective materials",
    "Project coordination",
    "$2M cargo insurance",
  ];

  // Build the requirements list. We DO NOT auto-push a "Timeline" line \u2014
  // the engine defaults that field to 4 hours which is wrong for any
  // long-distance specialty (Ottawa\u2192Toronto runs 9\u201312 hours), and there's
  // no reliable way to compute the real on-site time from a quote alone.
  // Coordinator-set flags (crating, climate, equipment) still render.
  const requirements: { icon: LucideIcon; title: string; desc: string }[] = [];
  if (f?.custom_crating) {
    requirements.push({
      icon: Sparkles,
      title: "Custom Crating",
      desc: `${(f?.custom_crating_count as number) ?? 1} piece${((f?.custom_crating_count as number) ?? 1) > 1 ? "s" : ""} requiring custom-built crates`,
    });
  }
  if (f?.climate_control) {
    requirements.push({
      icon: Shield,
      title: "Climate Control",
      desc: "Temperature and humidity-controlled transport",
    });
  }
  if ((f?.special_equipment as unknown[])?.length) {
    requirements.push({
      icon: Wrench,
      title: "Special Equipment",
      desc: "Specialized tools and rigging as required",
    });
  }

  const rawBreakdown = ([
    f?.base_estimate && { label: "Base Estimate", amount: f.base_estimate as number },
    f?.timeline_surcharge && { label: "Timeline Factor", amount: f.timeline_surcharge as number },
    f?.custom_crating_surcharge && {
      label: "Custom Crating",
      amount: f.custom_crating_surcharge as number,
    },
    f?.climate_control_surcharge && {
      label: "Climate Control",
      amount: f.climate_control_surcharge as number,
    },
    f?.equipment_surcharge && { label: "Special Equipment", amount: f.equipment_surcharge as number },
    f?.distance_surcharge && { label: "Distance", amount: f.distance_surcharge as number },
    f?.parking_long_carry_total && (f.parking_long_carry_total as number) > 0 && {
      label: "Parking / long carry",
      amount: f.parking_long_carry_total as number,
    },
  ] as (false | null | undefined | { label: string; amount: number })[]).filter(
    (x): x is { label: string; amount: number } => !!x,
  );

  // Suppress the breakdown when a coordinator override is in effect.
  // The engine's stale surcharges (distance, climate, etc.) stay in
  // factors_applied even after an override drops the headline price, so
  // a $1,850 "Distance" line would appear above a $1,100 final price —
  // confusing and erodes trust. Two signals catch this:
  //   1. override_price_pre_tax explicitly set in factors_applied
  //   2. sum of breakdown lines diverges from the displayed price by >$5
  //      (covers older quotes / cases where the override flag wasn't written)
  const hasOverride =
    (typeof f?.override_price_pre_tax === "number" && (f.override_price_pre_tax as number) > 0) ||
    (rawBreakdown.length > 0 &&
      Math.abs(rawBreakdown.reduce((sum, it) => sum + it.amount, 0) - price) > 5);
  const breakdown = hasOverride ? [] : rawBreakdown;

  return (
    <section className="mb-10 space-y-8">
      {/* Project overview */}
      <div>
        <div className="flex items-start gap-4 mb-4">
          <Wrench className="w-6 h-6 shrink-0 mt-1" style={{ color: WINE }} aria-hidden />
          <div>
            <span
              className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${FOREST}15`, color: FOREST }}
            >
              {PROJECT_TYPE_LABELS[projectType] ?? toTitleCase(projectType)}
            </span>
            <h2 className="font-hero text-[26px] mt-2" style={{ color: WINE }}>
              Project Proposal
            </h2>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">Location</p>
              <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.from_address}</p>
            </div>
          </div>
          {quote.to_address !== quote.from_address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
              <div>
                <p className="admin-section-h2">Destination</p>
                <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.to_address}</p>
              </div>
            </div>
          )}
          {quote.move_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
              <div>
                <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">Target Date</p>
                <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                  {formatPlatformDisplay(new Date(quote.move_date + "T00:00:00"), {
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Site & building section removed from the client-facing layout —
          access classification ("Straight path", "One turn", etc.) and
          internal building requirements are crew/coordinator metadata,
          not part of the client proposal. Crew sees this on the move
          detail / walkthrough pages. */}

      {/* Special Requirements */}
      {requirements.length > 0 && (
        <div className="pt-6 border-t border-[var(--brd)]/30">
          <h2 className="admin-section-h2 mb-4">
            Special Requirements
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {requirements.map((req, i) => {
              const Icon = req.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: WINE }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: FOREST }}>
                      {req.title}
                    </p>
                    <p className="text-[10px] mt-0.5 leading-snug" style={{ color: `${FOREST}60` }}>
                      {req.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Includes */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="admin-section-h2 mb-4">
          Service Includes
        </h2>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FOREST }} />
              <span className="text-[12px] leading-snug" style={{ color: FOREST }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Summary */}
      <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: FOREST }}>
        <div className="px-5 py-4 border-b border-[#E2DDD5]" style={{ backgroundColor: `${FOREST}08` }}>
          <h2
            className="font-heading text-[13px] font-bold tracking-wider uppercase"
            style={{ color: WINE }}
          >
            Investment Summary
          </h2>
        </div>
        <div className="p-5 md:p-6">
          {breakdown.length > 0 && (
            <table className="w-full text-[12px] mb-4">
              <tbody>
                {breakdown.map((item, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-[#E2DDD5]" : ""}>
                    <td className="py-2" style={{ color: `${FOREST}80` }}>{item.label}</td>
                    <td className="py-2 text-right font-medium" style={{ color: FOREST }}>
                      {fmtPrice(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="border-t-2 pt-4 text-center" style={{ borderColor: `${FOREST}30` }}>
            <p className="text-[36px] md:text-[44px] [font-family:var(--font-body)]" style={{ color: WINE }}>
              {fmtPrice(price)}
            </p>
            <p className="text-[12px] mt-1 mb-5" style={{ color: `${FOREST}70` }}>
              +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90 ${
                confirmed ? "opacity-80" : ""
              }`}
              style={{ backgroundColor: FOREST }}
            >
              {confirmed ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Selected
                </span>
              ) : (
                `Proceed \u2014 ${fmtPrice(deposit)} Deposit`
              )}
            </button>
            <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
              {price < 5000 ? "30%" : "50%"} deposit · Balance due 48 hours before your service
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
