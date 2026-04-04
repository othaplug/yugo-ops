import { ArrowRight, OfficeChair, Check } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
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

const DEFAULT_INCLUDES = [
  "Professional Handling And Transport",
  "Protective Blanket Wrapping For All Items",
  "Careful Loading And Unloading",
  "Floor And Entryway Protection At Both Locations",
];

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
  const truckBreakdown: string | null = null;
  const includes = (f?.includes as string[] | undefined) ?? DEFAULT_INCLUDES;

  return (
    <section className="mb-10 space-y-6">
      {/* Item details */}
      <div>
        <div className="flex items-start gap-4">
          <OfficeChair className="w-7 h-7 shrink-0 mt-0.5" style={{ color: WINE }} weight="duotone" aria-hidden />
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${FOREST}15`, color: FOREST }}
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
            <p className="text-[var(--text-base)] font-semibold" style={{ color: FOREST }}>
              {(f?.item_description as string) ?? "Single Item Delivery"}
            </p>
            {f?.assembly_surcharge != null && (
              <p className="text-[11px] mt-1" style={{ color: `${FOREST}60` }}>
                Full assembly included where quoted.
              </p>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="mt-4 pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">PICKUP</p>
              <p className="text-[12px] font-medium truncate" style={{ color: FOREST }}>
                {quote.from_address}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">DELIVERY</p>
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
          style={{ borderColor: `${FOREST}55`, backgroundColor: `${FOREST}08` }}
        >
          <p className="text-[9px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: WINE }}>
            SPECIAL HANDLING INSTRUCTIONS
          </p>
          <p className="text-[13px] leading-relaxed font-medium" style={{ color: FOREST }}>
            {specialHandling}
          </p>
        </div>
      ) : null}

      {/* Service includes */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="admin-section-h2 mb-3">
          Your Delivery Includes
        </h2>
        <div className="space-y-2">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FOREST }} />
              <span className="text-[12px] leading-snug" style={{ color: FOREST }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Price + CTA */}
      <div className="bg-white rounded-2xl border-2 shadow-sm p-6 text-center" style={{ borderColor: FOREST }}>
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
          className={`w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90 ${
            confirmed ? "opacity-80" : ""
          }`}
          style={{ backgroundColor: FOREST }}
        >
          {confirmed ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> SELECTED
            </span>
          ) : isFullPayment ? (
            `CONFIRM DELIVERY — ${fmtPrice(price + tax)}`
          ) : (
            `CONFIRM DELIVERY — ${fmtPrice(deposit)} DEPOSIT`
          )}
        </button>
        <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
          {isFullPayment
            ? "Full payment required to confirm booking."
            : "Deposit due now; remaining balance due on delivery per your quote."}
        </p>
      </div>
    </section>
  );
}
