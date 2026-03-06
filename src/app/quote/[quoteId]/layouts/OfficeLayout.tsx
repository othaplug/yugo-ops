import { Building2, MapPin, Calendar, Check, Users, Clock } from "lucide-react";
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

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

export default function OfficeLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("office_move", price);
  const includes = (f?.includes as string[] | undefined) ?? [
    "Commercial-grade packing materials",
    "Workstation disassembly & reassembly",
    "IT equipment handling & setup",
    "Elevator & stair protection",
    "Weekend scheduling available",
    "Dedicated project coordinator",
    "$2M commercial cargo insurance",
  ];

  const scopeItems = ([
    f?.square_footage && { label: "Square Footage", value: `${f.square_footage} sq ft` },
    f?.workstation_count && { label: "Workstations", value: `${f.workstation_count} workstations` },
    f?.it_equipment_surcharge && { label: "IT Equipment", value: "Included" },
    f?.conference_room_surcharge && { label: "Conference Rooms", value: "Included" },
    quote.from_access && { label: "Origin Access", value: toTitleCase(quote.from_access) },
    quote.to_access && { label: "Destination Access", value: toTitleCase(quote.to_access) },
  ] as (false | null | undefined | { label: string; value: string })[]).filter(
    (x): x is { label: string; value: string } => !!x,
  );

  const timelineItems: { phase: string; description: string }[] =
    (f?.timeline_phases as { phase: string; description: string }[] | undefined) ?? [
      { phase: "Pre-Move Planning", description: "Site survey, floor plans, logistics coordination" },
      { phase: "Packing & Preparation", description: "Professional packing of all office contents" },
      { phase: "Move Execution", description: "Systematic relocation with labelled inventory" },
      { phase: "Setup & Handoff", description: "Unpacking, workstation setup, final walkthrough" },
    ];

  const breakdown = ([
    f?.base_rate && { label: "Base Rate", amount: f.base_rate as number },
    f?.distance_surcharge && { label: "Distance Surcharge", amount: f.distance_surcharge as number },
    f?.access_surcharge && { label: "Access Surcharge", amount: f.access_surcharge as number },
    f?.it_equipment_surcharge && { label: "IT Equipment Handling", amount: f.it_equipment_surcharge as number },
    f?.conference_room_surcharge && { label: "Conference Room", amount: f.conference_room_surcharge as number },
    f?.timing_surcharge && { label: "Timing Adjustment", amount: f.timing_surcharge as number },
  ] as (false | null | undefined | { label: string; amount: number })[]).filter(
    (x): x is { label: string; amount: number } => !!x,
  );

  return (
    <section className="mb-10 space-y-8">
      {/* Badge */}
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ backgroundColor: `${FOREST}08` }}
        >
          <Building2 className="w-3.5 h-3.5" style={{ color: FOREST }} />
          <span className="text-caption font-semibold tracking-wide uppercase" style={{ color: FOREST }}>
            Commercial Relocation
          </span>
        </div>
      </div>

      {/* Scope of Work */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">
          Scope of Work
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
            <div>
              <p className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">From</p>
              <p className="text-ui font-medium" style={{ color: FOREST }}>{quote.from_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
            <div>
              <p className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">To</p>
              <p className="text-ui font-medium" style={{ color: FOREST }}>{quote.to_address}</p>
            </div>
          </div>
        </div>

        {scopeItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--brd)]/30">
            <table className="w-full text-ui">
              <tbody>
                {scopeItems.map((item, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-[var(--brd)]/30" : ""}>
                    <td className="py-2 font-medium" style={{ color: FOREST }}>{item.label}</td>
                    <td className="py-2 text-right" style={{ color: `${FOREST}80` }}>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline & Phasing */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">
          Timeline &amp; Phasing
        </h2>
        <div className="space-y-4">
          {timelineItems.map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-ui font-bold text-white"
                style={{
                  backgroundColor: i === 0 ? WINE : i === timelineItems.length - 1 ? FOREST : GOLD,
                }}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-body font-semibold" style={{ color: FOREST }}>{item.phase}</p>
                <p className="text-caption mt-0.5" style={{ color: `${FOREST}60` }}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crew & Equipment */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">
          Crew &amp; Equipment
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <Users className="w-5 h-5 mx-auto mb-1.5" style={{ color: WINE }} />
            <p className="text-body font-bold" style={{ color: FOREST }}>
              {(f?.min_crew as number) ?? 4}+ Movers
            </p>
            <p className="text-label" style={{ color: `${FOREST}60` }}>Commercial crew</p>
          </div>
          <div>
            <Clock className="w-5 h-5 mx-auto mb-1.5" style={{ color: GOLD }} />
            <p className="text-body font-bold" style={{ color: FOREST }}>
              {(f?.estimated_hours as string) ?? "Full"} Day
            </p>
            <p className="text-label" style={{ color: `${FOREST}60` }}>Timeline estimate</p>
          </div>
          <div>
            <Calendar className="w-5 h-5 mx-auto mb-1.5" style={{ color: FOREST }} />
            <p className="text-body font-bold" style={{ color: FOREST }}>
              {quote.move_date
                ? new Date(quote.move_date + "T00:00:00").toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                  })
                : "TBD"}
            </p>
            <p className="text-label" style={{ color: `${FOREST}60` }}>Move date</p>
          </div>
        </div>
      </div>

      {/* Service Includes */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">
          Service Includes
        </h2>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <span className="text-ui leading-snug" style={{ color: FOREST }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Summary */}
      <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: GOLD }}>
        <div className="px-5 py-4 border-b border-[#E2DDD5]" style={{ backgroundColor: `${GOLD}08` }}>
          <h2
            className="font-heading text-body font-bold tracking-wider uppercase"
            style={{ color: WINE }}
          >
            Investment Summary
          </h2>
        </div>
        <div className="p-5 md:p-6">
          {breakdown.length > 0 && (
            <table className="w-full text-ui mb-4">
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
            <p className="font-hero text-price-sm md:text-price-lg" style={{ color: WINE }}>
              {fmtPrice(price)}
            </p>
            <p className="text-ui mt-1" style={{ color: `${FOREST}70` }}>
              +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              className={`mt-5 w-full max-w-xs mx-auto py-3.5 rounded-xl text-body font-bold tracking-wide text-white transition-all ${
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
            <p className="text-label mt-2" style={{ color: `${FOREST}50` }}>
              {price < 5000 ? "25%" : "30%"} deposit &middot; Balance due on completion
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
