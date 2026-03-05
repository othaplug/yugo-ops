import { MapPin, ArrowRight, Package, Check, Truck } from "lucide-react";
import {
  type Quote,
  WINE,
  FOREST,
  GOLD,
  CREAM,
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

export default function B2BOneOffLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("b2b_oneoff", price);
  const isFullPayment = price < 300;

  return (
    <section className="mb-10 space-y-6">
      {/* Item & Route card */}
      <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm overflow-hidden">
        <div className="p-5 md:p-7">
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${FOREST}08` }}
            >
              <Truck className="w-6 h-6" style={{ color: FOREST }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: FOREST }}>
                {(f?.item_description as string) ?? "Delivery Service"}
              </p>
              {f?.item_category ? (
                <span
                  className="inline-block mt-1 text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${GOLD}12`, color: GOLD }}
                >
                  {toTitleCase(String(f.item_category))}
                </span>
              ) : null}
            </div>
          </div>

          {/* Route */}
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: CREAM }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: WINE }} />
                <div>
                  <p
                    className="text-[10px] font-semibold tracking-wider uppercase"
                    style={{ color: `${FOREST}80` }}
                  >
                    Pickup
                  </p>
                  <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                    {quote.from_address}
                  </p>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-start gap-2 justify-end">
                <div>
                  <p
                    className="text-[10px] font-semibold tracking-wider uppercase"
                    style={{ color: `${FOREST}80` }}
                  >
                    Delivery
                  </p>
                  <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                    {quote.to_address}
                  </p>
                </div>
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FOREST }} />
              </div>
            </div>
          </div>
          {quote.distance_km != null && (
            <p className="text-[10px] text-center mt-2" style={{ color: `${FOREST}50` }}>
              {quote.distance_km} km
              {quote.drive_time_min ? ` \u00b7 ~${quote.drive_time_min} min` : ""}
            </p>
          )}
        </div>

        {/* Includes strip */}
        <div className="px-5 md:px-7 py-4 border-t border-[#E2DDD5]" style={{ backgroundColor: `${FOREST}03` }}>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {["Professional handling", "Protective wrapping", "Careful delivery"].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Check className="w-3 h-3" style={{ color: GOLD }} />
                <span className="text-[11px]" style={{ color: FOREST }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price + CTA */}
      <div className="bg-white rounded-2xl border-2 shadow-sm p-6 text-center" style={{ borderColor: GOLD }}>
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
          style={{ backgroundColor: confirmed ? FOREST : FOREST }}
        >
          {confirmed ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Confirmed
            </span>
          ) : isFullPayment ? (
            `Confirm Delivery \u2014 ${fmtPrice(price + tax)}`
          ) : (
            `Confirm Delivery \u2014 ${fmtPrice(deposit)} Deposit`
          )}
        </button>
        <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
          {isFullPayment
            ? "Full payment at confirmation"
            : `${fmtPrice(deposit)} deposit \u00b7 Balance of ${fmtPrice(price + tax - deposit)} due on delivery`}
        </p>
      </div>
    </section>
  );
}
