import { Shield, Camera, Check, Diamond, Truck, Eye } from "@phosphor-icons/react";
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

const PROTOCOL_STEPS = [
  {
    icon: Eye,
    title: "Pre-Inspection & Documentation",
    description:
      "Thorough assessment and photographic documentation of your item\u2019s current condition before any handling begins.",
  },
  {
    icon: Diamond,
    title: "Custom Protective Wrapping",
    description:
      "Multi-layer protection using acid-free tissue, custom foam padding, and furniture blankets tailored to your item.",
  },
  {
    icon: Truck,
    title: "Climate-Controlled Loading",
    description:
      "Air-ride suspension truck with climate control. Secure mounting and strapping for zero-movement transit.",
  },
  {
    icon: Shield,
    title: "Secure Transport & GPS Tracking",
    description:
      "Real-time GPS monitoring throughout delivery. Direct route with no additional stops or handling.",
  },
  {
    icon: Camera,
    title: "White Glove Delivery & Placement",
    description:
      "Careful unloading, unwrapping, and precise placement per your instructions. Post-delivery photo documentation.",
  },
];

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

export default function WhiteGloveLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("white_glove", price);
  const declaredValue = f?.declared_value as number | undefined;
  const weightSurcharge = typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0 ? f.weight_surcharge : 0;
  const truckBreakdown =
    typeof f?.truck_breakdown_line === "string" && f.truck_breakdown_line.trim().length > 0
      ? f.truck_breakdown_line.trim()
      : null;

  return (
    <section className="mb-10 space-y-8">
      {/* Item details */}
      <div>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${WINE}10` }}
          >
            <Diamond className="w-7 h-7" style={{ color: WINE }} />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold" style={{ color: FOREST }}>
              {(f?.item_description as string) ?? "White Glove Item"}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: `${FOREST}60` }}>
              {toTitleCase((f?.item_category as string) ?? "premium item")}
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {declaredValue != null && (
                <span
                  className="text-[10px] font-bold tracking-wide px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${GOLD}12`, color: GOLD }}
                >
                  Declared Value: {fmtPrice(declaredValue)}
                </span>
              )}
              {f?.enhanced_insurance ? (
                <span
                  className="text-[10px] font-bold tracking-wide px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${FOREST}10`, color: FOREST }}
                >
                  Enhanced Insurance
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 5-Step Handling Protocol */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
          Our 5-Step Handling Protocol
        </h2>
        <p className="text-[11px] mb-4" style={{ color: `${FOREST}60` }}>
          Every white glove delivery follows our meticulous care process
        </p>
        <div className="space-y-6">
          {PROTOCOL_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-start gap-4">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: i === 4 ? `${GOLD}15` : `${WINE}08` }}
                  >
                    <Icon className="w-[18px] h-[18px]" style={{ color: i === 4 ? GOLD : WINE }} />
                  </div>
                  {i < PROTOCOL_STEPS.length - 1 && (
                    <div
                      className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-6"
                      style={{ backgroundColor: `${WINE}15` }}
                    />
                  )}
                </div>
                <div className="pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold" style={{ color: GOLD }}>
                      Step {i + 1}
                    </span>
                    <span className="text-[13px] font-semibold" style={{ color: FOREST }}>
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed" style={{ color: `${FOREST}70` }}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Photo documentation */}
      <div className="pt-6 border-t border-[var(--brd)]/30 text-center">
        <Camera className="w-6 h-6 mx-auto mb-2" style={{ color: FOREST }} />
        <p className="text-[13px] font-semibold" style={{ color: FOREST }}>
          Photo Documentation Included
        </p>
        <p className="text-[11px] mt-1 max-w-sm mx-auto" style={{ color: `${FOREST}60` }}>
          Before and after photos of your item at pickup and delivery for your records and peace of mind.
        </p>
      </div>

      {/* Price card */}
      <div
        className="bg-white rounded-2xl border-2 shadow-sm p-6 md:p-8 text-center"
        style={{ borderColor: GOLD }}
      >
        <p className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: GOLD }}>
          White Glove Service
        </p>
        {(weightSurcharge > 0 || truckBreakdown) && (
          <div className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b max-w-md mx-auto" style={{ borderColor: "#E2DDD5", color: `${FOREST}75` }}>
            {weightSurcharge > 0 ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>Weight handling: </span>
                +{fmtPrice(weightSurcharge)}
              </p>
            ) : null}
            {truckBreakdown ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>Vehicle: </span>
                {truckBreakdown}
              </p>
            ) : null}
          </div>
        )}
        <p className="font-hero text-[40px] md:text-[48px]" style={{ color: WINE }}>
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
          style={{ backgroundColor: confirmed ? FOREST : WINE }}
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
          Balance of {fmtPrice(price + tax - deposit)} due on delivery
        </p>
      </div>
    </section>
  );
}
