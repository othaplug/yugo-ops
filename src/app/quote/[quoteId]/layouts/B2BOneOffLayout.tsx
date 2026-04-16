import { MapPin, ArrowRight, Check, CaretRight } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  QUOTE_EYEBROW_CLASS,
  TAX_RATE,
  fmtPrice,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";

function friendlyFleetLine(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(vehicle|truck)\s*:\s*/i, "").trim();
  s = s.replace(/^truck\s*:\s*/i, "").trim();
  return s || raw.trim();
}

interface Props {
  quote: Quote;
  onConfirm: () => void;
  /** Second action: scroll to agreement (if needed) or to payment after signing */
  onPayInFull?: () => void;
  confirmed: boolean;
}

export default function B2BOneOffLayout({
  quote,
  onConfirm,
  onPayInFull,
  confirmed,
}: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const specialtyTransport = f?.specialty_b2b_transport === true;
  const payInvoice = f?.b2b_payment_method === "invoice";
  const splitCardActions =
    specialtyTransport && !payInvoice && typeof onPayInFull === "function";
  const retailer =
    typeof f?.b2b_retailer_source === "string"
      ? f.b2b_retailer_source.trim()
      : "";
  const weightSurcharge =
    typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0
      ? f.weight_surcharge
      : 0;
  const dimensional = f?.b2b_dimensional === true;
  const verticalTitle =
    typeof f?.b2b_vertical_name === "string" && f.b2b_vertical_name.trim()
      ? f.b2b_vertical_name.trim()
      : null;
  const lineItems = Array.isArray(f?.b2b_line_items)
    ? (f.b2b_line_items as {
        description?: string;
        quantity?: number;
        fragile?: boolean;
      }[])
    : [];
  const legacyItems = Array.isArray(f?.b2b_items)
    ? (f.b2b_items as string[])
    : [];
  const handlingRaw =
    typeof f?.b2b_handling_type === "string" ? f.b2b_handling_type : null;
  const handlingLabel = handlingRaw ? handlingRaw.replace(/_/g, " ") : "";
  const truckBreakdown =
    typeof f?.truck_breakdown_line === "string" &&
    f.truck_breakdown_line.trim().length > 0
      ? f.truck_breakdown_line.trim()
      : "";
  const specialtyNotes =
    typeof f?.specialty_handling_notes === "string" &&
    f.specialty_handling_notes.trim().length > 0
      ? f.specialty_handling_notes.trim()
      : "";
  const costBreakdown = Array.isArray(f?.specialty_cost_breakdown)
    ? (f.specialty_cost_breakdown as { label?: string; amount?: number }[])
    : [];
  const crewN =
    typeof f?.specialty_crew_size === "number" ? f.specialty_crew_size : null;

  return (
    <section className="mb-10 space-y-6">
      {payInvoice ? (
        <div
          className="rounded-2xl border-2 border-dashed p-5 space-y-3"
          style={{ borderColor: `${FOREST}35`, backgroundColor: `${FOREST}06` }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.14em] uppercase"
            style={{ color: `${FOREST}70` }}
          >
            PRO FORMA INVOICE
          </p>
          <div
            className="flex justify-between text-[13px] font-semibold"
            style={{ color: FOREST }}
          >
            <span>Delivery Service</span>
            <span>{fmtPrice(price)}</span>
          </div>
          <div
            className="flex justify-between text-[12px]"
            style={{ color: `${FOREST}75` }}
          >
            <span>HST (13%)</span>
            <span>{fmtPrice(tax)}</span>
          </div>
          <div
            className="flex justify-between pt-2 border-t text-[15px] font-bold"
            style={{ borderColor: `${FOREST}20`, color: WINE }}
          >
            <span>Total Due</span>
            <span>{fmtPrice(price + tax)}</span>
          </div>
          <p
            className="text-[11px] leading-snug pt-1"
            style={{ color: `${FOREST}72` }}
          >
            <strong>Terms:</strong> Net 30, payment due within 30 days of
            invoice date. No card payment on this quote. Our team will follow up
            with a formal invoice and scheduling details after you confirm.
          </p>
        </div>
      ) : null}

      {/* Item & Route */}
      <div>
        <div className="mb-4">
          <p
            className="text-[var(--text-base)] font-semibold"
            style={{ color: FOREST }}
          >
            {specialtyTransport
              ? "Specialty Transport"
              : (verticalTitle ??
                (f?.item_description as string) ??
                "Delivery Service")}
          </p>
          {specialtyTransport &&
          typeof f?.item_description === "string" &&
          f.item_description.trim() ? (
            <p
              className="text-[12px] mt-1 font-medium leading-snug"
              style={{ color: `${FOREST}90` }}
            >
              {f.item_description.trim()}
            </p>
          ) : null}
          {specialtyTransport ? (
            <span
              className="inline-block mt-1 text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
            >
              One-off B2B
            </span>
          ) : f?.item_category ? (
            <span
              className="inline-block mt-1 text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
            >
              {dimensional
                ? "COMMERCIAL DELIVERY"
                : toTitleCase(String(f.item_category))}
            </span>
          ) : null}
          {crewN != null && crewN > 0 ? (
            <p className="text-[11px] mt-2" style={{ color: `${FOREST}75` }}>
              <span className="font-semibold" style={{ color: FOREST }}>
                Crew:{" "}
              </span>
              {crewN} people
            </p>
          ) : null}
          {retailer ? (
            <p className="text-[11px] mt-2" style={{ color: `${FOREST}75` }}>
              <span className="font-semibold" style={{ color: FOREST }}>
                Retailer:
              </span>{" "}
              {retailer}
            </p>
          ) : null}
        </div>

        {/* Items (dimensional): receipt-style rows, qty aligned, handling as own block */}
        {dimensional && (lineItems.length > 0 || legacyItems.length > 0) ? (
          <div className="pt-4 border-t border-[var(--brd)]/30">
            <div
              className="rounded-2xl border border-[#2C3E2D]/14 bg-[#FFFCF9] px-4 py-4 sm:px-5"
              style={{ boxShadow: "0 2px 12px rgba(44,62,45,0.06)" }}
            >
              <p
                className={`${QUOTE_EYEBROW_CLASS} mb-3`}
                style={{ color: FOREST_MUTED }}
              >
                Line items
              </p>
              {lineItems.length > 0 ? (
                <ul className="divide-y divide-[#2C3E2D]/10">
                  {lineItems.map((row, i) => {
                    const desc = String(row.description ?? "Item").trim() || "Item";
                    const qty =
                      row.quantity != null && Number(row.quantity) > 0
                        ? Math.round(Number(row.quantity))
                        : null;
                    return (
                      <li
                        key={i}
                        className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[13px] font-medium leading-snug"
                            style={{ color: FOREST }}
                          >
                            {desc}
                          </p>
                          {row.fragile ? (
                            <span
                              className="mt-1.5 inline-block text-[9px] font-bold tracking-[0.12em] uppercase"
                              style={{ color: FOREST_MUTED }}
                            >
                              Fragile
                            </span>
                          ) : null}
                        </div>
                        {qty != null ? (
                          <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0 sm:text-right">
                            <span
                              className="text-[9px] font-bold tracking-[0.14em] uppercase"
                              style={{ color: FOREST_MUTED }}
                            >
                              Qty
                            </span>
                            <span
                              className="text-[13px] font-semibold tabular-nums leading-none"
                              style={{ color: FOREST }}
                            >
                              {qty}
                            </span>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="space-y-2.5">
                  {legacyItems.map((s, i) => (
                    <li
                      key={i}
                      className="text-[13px] font-medium leading-snug"
                      style={{ color: FOREST }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {handlingLabel ? (
                <div className="mt-4 border-t border-[#2C3E2D]/12 pt-4">
                  <p
                    className={`${QUOTE_EYEBROW_CLASS} mb-1.5`}
                    style={{ color: FOREST_MUTED }}
                  >
                    Handling
                  </p>
                  <p
                    className="text-[13px] font-medium leading-snug"
                    style={{ color: FOREST_BODY }}
                  >
                    {toTitleCase(handlingLabel)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {specialtyNotes ? (
          <div className="pt-4 border-t border-[var(--brd)]/30">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853] mb-1">
              Special handling
            </p>
            <p className="text-[12px] leading-snug" style={{ color: FOREST }}>
              {specialtyNotes}
            </p>
          </div>
        ) : null}

        {specialtyTransport && costBreakdown.length > 0 ? (
          <div className="pt-4 border-t border-[var(--brd)]/30">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853] mb-2">
              Cost build (reference)
            </p>
            <table className="w-full text-[11px]">
              <tbody>
                {costBreakdown.map((row, i) => (
                  <tr
                    key={i}
                    className={i > 0 ? "border-t border-[#E2DDD5]" : ""}
                  >
                    <td className="py-1" style={{ color: `${FOREST}80` }}>
                      {row.label ?? "Line"}
                    </td>
                    <td
                      className="py-1 text-right font-medium"
                      style={{ color: FOREST }}
                    >
                      {typeof row.amount === "number"
                        ? fmtPrice(row.amount)
                        : "—"}
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
                <MapPin
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  style={{ color: WINE }}
                />
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
                    PICKUP
                  </p>
                  <p
                    className="text-[12px] font-medium"
                    style={{ color: FOREST }}
                  >
                    {quote.from_address}
                  </p>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-start gap-2 justify-end">
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
                    DELIVERY
                  </p>
                  <p
                    className="text-[12px] font-medium"
                    style={{ color: FOREST }}
                  >
                    {quote.to_address}
                  </p>
                </div>
                <MapPin
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  style={{ color: FOREST }}
                />
              </div>
            </div>
          </div>
          {quote.distance_km != null && (
            <p
              className="text-[10px] text-center mt-2 font-medium"
              style={{ color: `${FOREST}CC` }}
            >
              {quote.distance_km} km
              {quote.drive_time_min
                ? ` \u00b7 ~${quote.drive_time_min} min`
                : ""}
            </p>
          )}
        </div>
      </div>

      {/* Price + CTA */}
      <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
        {(weightSurcharge > 0 || truckBreakdown) && (
          <div
            className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b"
            style={{ borderColor: "#E2DDD5", color: `${FOREST}B8` }}
          >
            {weightSurcharge > 0 ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>
                  Weight category:{" "}
                </span>
                +{fmtPrice(weightSurcharge)}
              </p>
            ) : null}
            {truckBreakdown ? (
              <p className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span
                  className="text-[9px] font-bold tracking-[0.14em] uppercase shrink-0 leading-none"
                  style={{ color: FOREST }}
                >
                  Fleet
                </span>
                <span
                  className="text-[9px] font-semibold tracking-[0.12em] uppercase leading-none"
                  style={{ color: `${FOREST}B8` }}
                >
                  {friendlyFleetLine(truckBreakdown).toUpperCase()}
                </span>
              </p>
            ) : null}
          </div>
        )}
        <p
          className="font-hero text-[36px] md:text-[42px]"
          style={{ color: WINE }}
        >
          {fmtPrice(price)}
        </p>
        <p
          className="text-[12px] mt-1 mb-5 font-medium"
          style={{ color: `${FOREST}C9` }}
        >
          +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
        </p>
        {splitCardActions && !confirmed ? (
          <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 max-w-lg mx-auto">
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-none border-2 text-[10px] font-bold tracking-[0.12em] uppercase transition-opacity hover:opacity-90"
              style={{ borderColor: FOREST, color: FOREST, backgroundColor: "transparent" }}
            >
              Continue to agreement
              <CaretRight className="w-3.5 h-3.5 shrink-0" weight="bold" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onPayInFull}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center py-3 px-4 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: FOREST }}
            >
              Pay in full ({fmtPrice(price + tax)})
            </button>
          </div>
        ) : splitCardActions && confirmed ? (
          <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 max-w-lg mx-auto">
            <button
              type="button"
              disabled
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-none border-2 text-[10px] font-bold tracking-[0.12em] uppercase opacity-70 cursor-default"
              style={{ borderColor: FOREST, color: FOREST, backgroundColor: "transparent" }}
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden />
              Scope confirmed
            </button>
            <button
              type="button"
              onClick={onPayInFull}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center py-3 px-4 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: FOREST }}
            >
              Pay in full ({fmtPrice(price + tax)})
            </button>
          </div>
        ) : (
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
                <Check className="w-4 h-4" /> CONFIRMED
              </span>
            ) : payInvoice ? (
              "CONFIRM BOOKING"
            ) : specialtyTransport ? (
              `CONFIRM DELIVERY (${fmtPrice(price + tax)})`
            ) : (
              `CONFIRM DELIVERY (${fmtPrice(price + tax)})`
            )}
          </button>
        )}
        <p
          className="text-[10px] mt-2 font-medium leading-snug max-w-md mx-auto"
          style={{ color: `${FOREST}C4` }}
        >
          {payInvoice
            ? "Net 30 invoice. No card required. Confirm below after you sign the agreement."
            : splitCardActions
              ? "Continue confirms your scope, then sign. Pay in full after signing to confirm your booking."
              : "Full payment required to confirm booking."}
        </p>
      </div>
    </section>
  );
}
