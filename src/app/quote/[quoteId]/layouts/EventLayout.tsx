import { MapPin, Calendar, Check, Users, Truck, Star, ArrowRight } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  GOLD,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "TBD";
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShort(d: string | null | undefined): string {
  if (!d) return "TBD";
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export default function EventLayout({ quote, onConfirm, confirmed }: Props) {
  const f = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("event", price + tax);

  const eventName = (f.event_name as string) ?? null;
  const deliveryDate = (f.delivery_date as string) ?? quote.move_date ?? null;
  const returnDate = (f.return_date as string) ?? null;
  const deliveryCharge = (f.delivery_charge as number) ?? 0;
  const setupFee = (f.setup_fee as number) ?? 0;
  const returnCharge = (f.return_charge as number) ?? 0;
  const crewSize = (f.crew_size as number) ?? quote.est_crew_size ?? 2;
  const deliveryHours = (f.delivery_hours as number) ?? null;
  const returnHours = (f.return_hours as number) ?? null;
  const truckSize = quote.truck_primary ?? null;

  const includes = (f.includes as string[]) ?? [
    "Professional moving crew",
    "Inventory and protection",
    "Venue delivery and placement",
    "Same crew for return, no re-briefing",
    "All equipment and materials",
  ];

  const hasSetup = setupFee > 0;
  const hasReturn = returnCharge > 0;

  return (
    <section className="mb-10 space-y-8">
      {/* Event header */}
      <div>
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${WINE}10` }}
          >
            <Star className="w-6 h-6" style={{ color: WINE }} />
          </div>
          <div>
            {eventName && (
              <span
                className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
              >
                {eventName}
              </span>
            )}
            <h2 className="font-hero text-[26px] mt-2" style={{ color: WINE }}>
              Event Logistics
            </h2>
          </div>
        </div>

        {/* Route */}
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: WINE }} />
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Origin</p>
                  <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.from_address}</p>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-start gap-2 justify-end">
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Venue</p>
                  <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.to_address}</p>
                </div>
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FOREST }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase breakdown */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: `${GOLD}40` }}>
        <div className="px-5 py-3.5 border-b" style={{ backgroundColor: `${GOLD}08`, borderColor: `${GOLD}25` }}>
          <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: WINE }}>
            Service Breakdown
          </h2>
        </div>
        <div className="divide-y" style={{ borderColor: "#E2DDD5" }}>
          {/* Delivery */}
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: WINE }}>1</div>
                  <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: WINE }}>Delivery</span>
                  <span className="text-[10px] font-medium" style={{ color: `${FOREST}70` }}>{fmtShort(deliveryDate)}</span>
                </div>
                <div className="pl-7 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: `${FOREST}60` }}>
                  {crewSize > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{crewSize} movers</span>}
                  {truckSize && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{truckSize} truck</span>}
                  {deliveryHours && <span>~{deliveryHours}h</span>}
                </div>
              </div>
              <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: FOREST }}>
                {fmtPrice(deliveryCharge)}
              </span>
            </div>
          </div>

          {/* Setup */}
          {hasSetup && (
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: GOLD }}>S</div>
                    <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: GOLD }}>Setup at Venue</span>
                  </div>
                  <div className="pl-7 text-[10px]" style={{ color: `${FOREST}60` }}>
                    {(f.setup_label as string) ?? "On-site setup service"}
                  </div>
                </div>
                <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: FOREST }}>
                  {fmtPrice(setupFee)}
                </span>
              </div>
            </div>
          )}

          {/* Return */}
          {hasReturn && (
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: FOREST }}>2</div>
                    <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: FOREST }}>Return (Teardown)</span>
                    {returnDate && <span className="text-[10px] font-medium" style={{ color: `${FOREST}70` }}>{fmtShort(returnDate)}</span>}
                  </div>
                  <div className="pl-7 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: `${FOREST}60` }}>
                    <span>Same crew, no re-briefing needed</span>
                    {returnHours && <span>~{returnHours}h estimated</span>}
                  </div>
                </div>
                <span className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: FOREST }}>
                  {fmtPrice(returnCharge)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dates summary */}
      <div className="grid sm:grid-cols-2 gap-3">
        {deliveryDate && (
          <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${WINE}06`, border: `1px solid ${WINE}15` }}>
            <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: `${WINE}60` }}>Delivery Date</p>
              <p className="text-[12px] font-semibold" style={{ color: WINE }}>{fmtDate(deliveryDate)}</p>
            </div>
          </div>
        )}
        {returnDate && (
          <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${FOREST}06`, border: `1px solid ${FOREST}15` }}>
            <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: `${FOREST}60` }}>Return Date</p>
              <p className="text-[12px] font-semibold" style={{ color: FOREST }}>{fmtDate(returnDate)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Includes */}
      <div className="pt-5 border-t border-[var(--brd)]/30">
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">
          Service Includes
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <span className="text-[12px] leading-snug" style={{ color: FOREST }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Investment summary */}
      <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: GOLD }}>
        <div className="px-5 py-4 border-b" style={{ backgroundColor: `${GOLD}08`, borderColor: "#E2DDD5" }}>
          <h2 className="font-heading text-[13px] font-bold tracking-wider uppercase" style={{ color: WINE }}>
            Investment Summary
          </h2>
        </div>
        <div className="p-5 md:p-6">
          <table className="w-full text-[12px] mb-4">
            <tbody>
              {deliveryCharge > 0 && (
                <tr>
                  <td className="py-2" style={{ color: `${FOREST}80` }}>Delivery ({fmtShort(deliveryDate)})</td>
                  <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(deliveryCharge)}</td>
                </tr>
              )}
              {hasSetup && (
                <tr className="border-t" style={{ borderColor: "#E2DDD5" }}>
                  <td className="py-2" style={{ color: `${FOREST}80` }}>Setup at venue</td>
                  <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(setupFee)}</td>
                </tr>
              )}
              {hasReturn && (
                <tr className="border-t" style={{ borderColor: "#E2DDD5" }}>
                  <td className="py-2" style={{ color: `${FOREST}80` }}>Return ({fmtShort(returnDate ?? null)})</td>
                  <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(returnCharge)}</td>
                </tr>
              )}
            </tbody>
          </table>
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
              className={`w-full max-w-xs mx-auto py-3.5 rounded-xl text-[13px] font-bold tracking-wide text-white transition-all ${confirmed ? "opacity-80" : ""}`}
              style={{ backgroundColor: confirmed ? FOREST : GOLD }}
            >
              {confirmed ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Confirmed
                </span>
              ) : (
                `Confirm Event Booking ${fmtPrice(deposit)} Deposit`
              )}
            </button>
            <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
              25% deposit &middot; Balance of {fmtPrice(price + tax - deposit)} due before event
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
