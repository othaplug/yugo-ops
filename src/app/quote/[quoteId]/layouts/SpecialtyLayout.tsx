import { MapPin, Calendar, Check, Wrench, Clock, Shield, Sparkle as Sparkles, type Icon as LucideIcon } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  GOLD,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";

const SPECIALTY_BUILDING_LABELS: Record<string, string> = {
  elevator_booking: "Elevator booking required",
  insurance_certificate: "Insurance certificate required",
  restricted_hours: "Restricted move hours",
  loading_dock_booking: "Loading dock booking required",
};

const SPECIALTY_ACCESS_LABELS: Record<string, string> = {
  straight_path: "Straight path",
  one_turn: "One turn",
  multiple_turns: "Multiple turns",
  tight_staircase: "Tight staircase",
  requires_rigging_or_crane: "Requires rigging or crane",
};

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
  const buildingReqs = Array.isArray(f?.specialty_building_requirements)
    ? (f.specialty_building_requirements as string[])
    : [];
  const accessKey =
    typeof f?.specialty_access_difficulty === "string" && f.specialty_access_difficulty.trim().length > 0
      ? f.specialty_access_difficulty.trim()
      : "";
  const accessLabel = accessKey ? (SPECIALTY_ACCESS_LABELS[accessKey] ?? toTitleCase(accessKey.replace(/_/g, " "))) : "";
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

  const requirements: { icon: LucideIcon; title: string; desc: string }[] = [];
  requirements.push({
    icon: Clock,
    title: "Timeline",
    desc: `Estimated ${(f?.timeline_hours as number) ?? "\u2014"} hours of on-site work`,
  });
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

  const breakdown = ([
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

  return (
    <section className="mb-10 space-y-8">
      {/* Project overview */}
      <div>
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${WINE}10` }}
          >
            <Wrench className="w-6 h-6" style={{ color: WINE }} />
          </div>
          <div>
            <span
              className="text-[9px] font-bold tracking-wider capitalize px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
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
              <p className="text-[9px] font-bold tracking-[0.14em] capitalize text-[#5C5853]">Location</p>
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
              <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <div>
                <p className="text-[9px] font-bold tracking-[0.14em] capitalize text-[#5C5853]">Target Date</p>
                <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                  {new Date(quote.move_date + "T00:00:00").toLocaleDateString("en-CA", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {(buildingReqs.length > 0 || accessLabel) && (
        <div className="pt-6 border-t border-[var(--brd)]/30">
          <h2 className="admin-section-h2 mb-3">
            Site &amp; building
          </h2>
          {buildingReqs.length > 0 ? (
            <ul className="space-y-1.5 mb-3">
              {buildingReqs.map((key) => (
                <li key={key} className="flex items-start gap-2 text-[12px]" style={{ color: FOREST }}>
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                  <span>{SPECIALTY_BUILDING_LABELS[key] ?? toTitleCase(key.replace(/_/g, " "))}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {accessLabel ? (
            <p className="text-[12px]" style={{ color: FOREST }}>
              <span className="font-semibold">Access: </span>
              {accessLabel}
            </p>
          ) : null}
          {accessKey === "requires_rigging_or_crane" ? (
            <p className="text-[10px] mt-2 leading-snug rounded-lg px-3 py-2" style={{ backgroundColor: "#FFF8E7", color: "#7A5C12" }}>
              Crane/rigging adds $1,500–3,000. Coordinator will confirm exact cost.
            </p>
          ) : null}
        </div>
      )}

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
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <span className="text-[12px] leading-snug" style={{ color: FOREST }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Summary */}
      <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: GOLD }}>
        <div className="px-5 py-4 border-b border-[#E2DDD5]" style={{ backgroundColor: `${GOLD}08` }}>
          <h2
            className="font-heading text-[13px] font-bold tracking-wider capitalize"
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
          <div className="border-t-2 pt-4 text-center" style={{ borderColor: `${GOLD}30` }}>
            <p className="font-hero text-[36px] md:text-[44px]" style={{ color: WINE }}>
              {fmtPrice(price)}
            </p>
            <p className="text-[12px] mt-1 mb-5" style={{ color: `${FOREST}70` }}>
              +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full max-w-xs mx-auto py-3.5 rounded-xl text-[13px] font-bold tracking-wide text-white transition-all ${
                confirmed ? "opacity-80" : ""
              }`}
              style={{ backgroundColor: confirmed ? FOREST : GOLD }}
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
              {price < 5000 ? "30%" : "50%"} deposit &middot; Balance due on completion
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
