import { MapPin, ArrowRight, Check, Truck } from "@phosphor-icons/react";
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

export default function B2BOneOffLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("b2b_oneoff", price);
  const isFullPayment = price < 300;
  const payInvoice = f?.b2b_payment_method === "invoice";
  const retailer = typeof f?.b2b_retailer_source === "string" ? f.b2b_retailer_source.trim() : "";
  const weightSurcharge = typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0 ? f.weight_surcharge : 0;
  const truckBreakdown: string | null = null;

  return (
    <section className="mb-10 space-y-6">
      {payInvoice ? (
        <div
          className="rounded-2xl border-2 border-dashed p-5 space-y-3"
          style={{ borderColor: `${FOREST}35`, backgroundColor: `${FOREST}06` }}
        >
          <p className="text-[10px] font-bold tracking-[0.14em] capitalize" style={{ color: `${FOREST}70` }}>
            Pro forma invoice
          </p>
          <div className="flex justify-between text-[13px] font-semibold" style={{ color: FOREST }}>
            <span>Delivery service</span>
            <span>{fmtPrice(price)}</span>
          </div>
          <div className="flex justify-between text-[12px]" style={{ color: `${FOREST}75` }}>
            <span>HST (13%)</span>
            <span>{fmtPrice(tax)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t text-[15px] font-bold" style={{ borderColor: `${FOREST}20`, color: WINE }}>
            <span>Total due</span>
            <span>{fmtPrice(price + tax)}</span>
          </div>
          <p className="text-[11px] leading-snug pt-1" style={{ color: `${FOREST}72` }}>
            <strong>Terms:</strong> Net 30, payment due within 30 days of invoice date. No card payment on this quote.
            Our team will follow up with a formal invoice and scheduling details after you confirm.
          </p>
        </div>
      ) : null}

      {/* Item & Route */}
      <div>
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${FOREST}08` }}
          >
            <Truck className="w-6 h-6" style={{ color: FOREST }} />
          </div>
          <div>
            <p className="text-[var(--text-base)] font-semibold" style={{ color: FOREST }}>
              {(f?.item_description as string) ?? "Delivery Service"}
            </p>
            {f?.item_category ? (
              <span
                className="inline-block mt-1 text-[9px] font-bold tracking-wider capitalize px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${GOLD}12`, color: GOLD }}
              >
                {toTitleCase(String(f.item_category))}
              </span>
            ) : null}
            {retailer ? (
              <p className="text-[11px] mt-2" style={{ color: `${FOREST}75` }}>
                <span className="font-semibold" style={{ color: FOREST }}>Retailer:</span> {retailer}
              </p>
            ) : null}
          </div>
        </div>

        {/* Route */}
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: WINE }} />
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] capitalize text-[#5C5853]">Pickup</p>
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
                  <p className="text-[9px] font-bold tracking-[0.14em] capitalize text-[#5C5853]">Delivery</p>
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

        {/* Includes */}
        <div className="pt-4 mt-4 border-t border-[var(--brd)]/30">
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
        {(weightSurcharge > 0 || truckBreakdown) && (
          <div className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b" style={{ borderColor: "#E2DDD5", color: `${FOREST}75` }}>
            {weightSurcharge > 0 ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>Weight category: </span>
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
          {payInvoice
            ? "Net 30 invoice. No card required. Confirm below after you sign the agreement."
            : isFullPayment
              ? "Full payment at confirmation"
              : `${fmtPrice(deposit)} deposit \u00b7 Balance of ${fmtPrice(price + tax - deposit)} due on delivery`}
        </p>
      </div>
    </section>
  );
}
