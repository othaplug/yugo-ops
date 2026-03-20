import { MapPin, ArrowRight, Diamond, Check } from "@phosphor-icons/react";
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

export default function SingleItemLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("single_item", price);
  const isFullPayment = price < 500;

  const category = toTitleCase((f?.item_category as string) ?? "item");
  const weight = f?.weight_class as string | undefined;
  const specialHandling =
    typeof f?.single_item_special_handling === "string" && f.single_item_special_handling.trim().length > 0
      ? f.single_item_special_handling.trim()
      : null;
  const weightSurcharge = typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0 ? f.weight_surcharge : 0;
  const truckBreakdown =
    typeof f?.truck_breakdown_line === "string" && f.truck_breakdown_line.trim().length > 0
      ? f.truck_breakdown_line.trim()
      : null;
  const includes = (f?.includes as string[] | undefined) ?? [
    "Professional handling & transport",
    "Protective blanket wrapping",
    "Careful loading & unloading",
    "Floor protection at both locations",
  ];

  return (
    <section className="mb-10 space-y-6">
      {/* Item details */}
      <div>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${WINE}10` }}
          >
            <Diamond className="w-7 h-7" style={{ color: WINE }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
              >
                {category}
              </span>
              {weight && (
                <span
                  className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${FOREST}10`, color: FOREST }}
                >
                  {weight}
                </span>
              )}
            </div>
            <p className="text-[14px] font-semibold" style={{ color: FOREST }}>
              {(f?.item_description as string) ?? "Single Item Delivery"}
            </p>
            {f?.assembly_surcharge != null && (
              <p className="text-[11px] mt-1" style={{ color: `${FOREST}60` }}>
                Assembly / disassembly included
              </p>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="mt-4 pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Pickup</p>
              <p className="text-[12px] font-medium truncate" style={{ color: FOREST }}>
                {quote.from_address}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Delivery</p>
              <p className="text-[12px] font-medium truncate" style={{ color: FOREST }}>
                {quote.to_address}
              </p>
            </div>
          </div>
          {quote.distance_km != null && (
            <p className="text-[10px] text-center mt-2" style={{ color: `${FOREST}50` }}>
              {quote.distance_km} km{quote.drive_time_min ? ` \u00b7 ~${quote.drive_time_min} min` : ""}
            </p>
          )}
        </div>
      </div>

      {specialHandling ? (
        <div
          className="rounded-xl border-2 p-4 mt-4"
          style={{ borderColor: `${GOLD}55`, backgroundColor: `${GOLD}08` }}
        >
          <p className="text-[9px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: WINE }}>
            Special handling instructions
          </p>
          <p className="text-[13px] leading-relaxed font-medium" style={{ color: FOREST }}>
            {specialHandling}
          </p>
        </div>
      ) : null}

      {/* Service includes */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">
          Service Includes
        </h2>
        <div className="space-y-2">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <span className="text-[12px] leading-snug" style={{ color: FOREST }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Price + CTA */}
      <div className="bg-white rounded-2xl border-2 shadow-sm p-6 text-center" style={{ borderColor: GOLD }}>
        {(weightSurcharge > 0 || truckBreakdown) && (
          <div className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b" style={{ borderColor: "#E2DDD5", color: `${FOREST}75` }}>
            {weightSurcharge > 0 ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>Weight handling: </span>
                +{fmtPrice(weightSurcharge)} (from size / weight class)
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
        <p className="font-hero text-[36px] md:text-[42px]" style={{ color: WINE }}>
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
          ) : isFullPayment ? (
            `Book Now \u2014 ${fmtPrice(price + tax)}`
          ) : (
            `Book Now \u2014 ${fmtPrice(deposit)} Deposit`
          )}
        </button>
        <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
          {isFullPayment
            ? "Full payment at booking"
            : `${fmtPrice(deposit)} deposit \u00b7 Balance of ${fmtPrice(price + tax - deposit)} due on delivery`}
        </p>
      </div>
    </section>
  );
}
