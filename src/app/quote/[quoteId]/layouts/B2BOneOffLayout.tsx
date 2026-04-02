import { MapPin, ArrowRight, Check, Truck, Package } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  GOLD,
  TAX_RATE,
  fmtPrice,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";
import { getB2BDeliveryFeatureList, b2bVerticalUsesPackageLeadIcon } from "@/lib/quotes/b2b-quote-copy";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

export default function B2BOneOffLayout({ quote, onConfirm, confirmed }: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const specialtyTransport = f?.specialty_b2b_transport === true;
  const payInvoice = f?.b2b_payment_method === "invoice";
  const retailer = typeof f?.b2b_retailer_source === "string" ? f.b2b_retailer_source.trim() : "";
  const weightSurcharge = typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0 ? f.weight_surcharge : 0;
  const dimensional = f?.b2b_dimensional === true;
  const verticalTitle =
    typeof f?.b2b_vertical_name === "string" && f.b2b_vertical_name.trim()
      ? f.b2b_vertical_name.trim()
      : null;
  const verticalCode = typeof f?.b2b_vertical_code === "string" ? f.b2b_vertical_code : null;
  const usePackageLead = b2bVerticalUsesPackageLeadIcon(verticalCode, verticalTitle);
  const crewFromFactors =
    typeof f?.b2b_crew === "number" && Number.isFinite(f.b2b_crew) ? Math.round(f.b2b_crew as number) : null;
  const lineItems = Array.isArray(f?.b2b_line_items)
    ? (f.b2b_line_items as { description?: string; quantity?: number; fragile?: boolean }[])
    : [];
  const legacyItems = Array.isArray(f?.b2b_items) ? (f.b2b_items as string[]) : [];
  const handlingLabel =
    typeof f?.b2b_handling_type === "string" ? f.b2b_handling_type.replace(/_/g, " ") : "";
  const coordinatorIncludes =
    specialtyTransport && Array.isArray(f?.includes) && (f.includes as string[]).length > 0
      ? (f.includes as string[])
      : null;
  const serviceIncludes =
    coordinatorIncludes ??
    getB2BDeliveryFeatureList(verticalCode, crewFromFactors ?? quote.est_crew_size, verticalTitle);
  const truckBreakdown =
    typeof f?.truck_breakdown_line === "string" && f.truck_breakdown_line.trim().length > 0
      ? f.truck_breakdown_line.trim()
      : "";
  const specialtyNotes =
    typeof f?.specialty_handling_notes === "string" && f.specialty_handling_notes.trim().length > 0
      ? f.specialty_handling_notes.trim()
      : "";
  const costBreakdown = Array.isArray(f?.specialty_cost_breakdown)
    ? (f.specialty_cost_breakdown as { label?: string; amount?: number }[])
    : [];
  const crewN = typeof f?.specialty_crew_size === "number" ? f.specialty_crew_size : null;

  return (
    <section className="mb-10 space-y-6">
      {payInvoice ? (
        <div
          className="rounded-2xl border-2 border-dashed p-5 space-y-3"
          style={{ borderColor: `${FOREST}35`, backgroundColor: `${FOREST}06` }}
        >
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: `${FOREST}70` }}>
            PRO FORMA INVOICE
          </p>
          <div className="flex justify-between text-[13px] font-semibold" style={{ color: FOREST }}>
            <span>Delivery Service</span>
            <span>{fmtPrice(price)}</span>
          </div>
          <div className="flex justify-between text-[12px]" style={{ color: `${FOREST}75` }}>
            <span>HST (13%)</span>
            <span>{fmtPrice(tax)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t text-[15px] font-bold" style={{ borderColor: `${FOREST}20`, color: WINE }}>
            <span>Total Due</span>
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
          {!usePackageLead ? (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${FOREST}08` }}
            >
              <Truck className="w-6 h-6" style={{ color: FOREST }} aria-hidden />
            </div>
          ) : (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${FOREST}08` }}
            >
              <Package className="w-6 h-6" style={{ color: FOREST }} aria-hidden />
            </div>
          )}
          <div>
            <p className="text-[var(--text-base)] font-semibold" style={{ color: FOREST }}>
              {specialtyTransport
                ? "Specialty Transport"
                : verticalTitle ?? (f?.item_description as string) ?? "Delivery Service"}
            </p>
            {specialtyTransport && typeof f?.item_description === "string" && f.item_description.trim() ? (
              <p className="text-[12px] mt-1 font-medium leading-snug" style={{ color: `${FOREST}90` }}>
                {f.item_description.trim()}
              </p>
            ) : null}
            {specialtyTransport ? (
              <span
                className="inline-block mt-1 text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${GOLD}12`, color: GOLD }}
              >
                One-off B2B
              </span>
            ) : f?.item_category ? (
              <span
                className="inline-block mt-1 text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${GOLD}12`, color: GOLD }}
              >
                {dimensional ? "COMMERCIAL DELIVERY" : toTitleCase(String(f.item_category))}
              </span>
            ) : null}
            {crewN != null && crewN > 0 ? (
              <p className="text-[11px] mt-2" style={{ color: `${FOREST}75` }}>
                <span className="font-semibold" style={{ color: FOREST }}>Crew: </span>
                {crewN} people
              </p>
            ) : null}
            {retailer ? (
              <p className="text-[11px] mt-2" style={{ color: `${FOREST}75` }}>
                <span className="font-semibold" style={{ color: FOREST }}>Retailer:</span> {retailer}
              </p>
            ) : null}
          </div>
        </div>

        {/* Items (dimensional) */}
        {dimensional && (lineItems.length > 0 || legacyItems.length > 0) ? (
          <div className="pt-4 border-t border-[var(--brd)]/30">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853] mb-2">ITEMS</p>
            <ul className="space-y-1 text-[12px] font-medium" style={{ color: FOREST }}>
              {lineItems.length > 0
                ? lineItems.map((row, i) => (
                    <li key={i}>
                      {row.description ?? "Item"}
                      {row.quantity != null && row.quantity > 1 ? ` ×${row.quantity}` : ""}
                      {row.fragile ? " (fragile)" : ""}
                    </li>
                  ))
                : legacyItems.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
            {handlingLabel ? (
              <p className="text-[11px] mt-2" style={{ color: `${FOREST}72` }}>
                <span className="font-semibold" style={{ color: FOREST }}>Handling: </span>
                {toTitleCase(handlingLabel)}
              </p>
            ) : null}
          </div>
        ) : null}

        {specialtyNotes ? (
          <div className="pt-4 border-t border-[var(--brd)]/30">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853] mb-1">Special handling</p>
            <p className="text-[12px] leading-snug" style={{ color: FOREST }}>
              {specialtyNotes}
            </p>
          </div>
        ) : null}

        {specialtyTransport && costBreakdown.length > 0 ? (
          <div className="pt-4 border-t border-[var(--brd)]/30">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853] mb-2">Cost build (reference)</p>
            <table className="w-full text-[11px]">
              <tbody>
                {costBreakdown.map((row, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-[#E2DDD5]" : ""}>
                    <td className="py-1" style={{ color: `${FOREST}80` }}>
                      {row.label ?? "Line"}
                    </td>
                    <td className="py-1 text-right font-medium" style={{ color: FOREST }}>
                      {typeof row.amount === "number" ? fmtPrice(row.amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Route */}
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: WINE }} />
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">PICKUP</p>
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
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">DELIVERY</p>
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
          <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853] mb-2">YOUR DELIVERY INCLUDES</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {serviceIncludes.map((item, i) => (
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
              <Check className="w-4 h-4" /> CONFIRMED
            </span>
          ) : payInvoice ? (
            "CONFIRM BOOKING"
          ) : specialtyTransport ? (
            `CONFIRM DELIVERY — ${fmtPrice(price + tax)}`
          ) : (
            "CONFIRM DELIVERY — FULL PAYMENT"
          )}
        </button>
        <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
          {payInvoice
            ? "Net 30 invoice. No card required. Confirm below after you sign the agreement."
            : "Full payment required to confirm booking."}
        </p>
      </div>
    </section>
  );
}
