import { Fragment } from "react";
import { MapPin, Calendar, Check, Users, Truck, Star, ArrowRight } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";
import { formatPlatformDisplay } from "@/lib/date-format";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "TBD";
  return formatPlatformDisplay(new Date(d + "T00:00:00"), {
    month: "long",
    day: "numeric",
  }, "TBD");
}

function fmtShort(d: string | null | undefined): string {
  if (!d) return "TBD";
  return formatPlatformDisplay(new Date(d + "T00:00:00"), {
    month: "short",
    day: "numeric",
  }, "TBD");
}

type EventLegFactor = {
  label?: string;
  from_address?: string;
  to_address?: string;
  delivery_date?: string;
  return_date?: string;
  delivery_charge?: number;
  return_charge?: number;
  event_crew?: number;
  event_hours?: number;
  return_hours?: number;
  same_day?: boolean;
  is_on_site?: boolean;
  event_type_label?: string;
};

/** Scale an array of amounts so they sum exactly to `target`, giving the remainder to the last item. */
function scaleToTotal(amounts: number[], target: number): number[] {
  const engineSum = amounts.reduce((a, b) => a + b, 0);
  if (engineSum === 0 || Math.abs(engineSum - target) < 2) return amounts;
  let remaining = target;
  return amounts.map((amt, idx) => {
    if (idx === amounts.length - 1) return remaining;
    const scaled = Math.round((amt / engineSum) * target);
    remaining -= scaled;
    return scaled;
  });
}

export default function EventLayout({ quote, onConfirm, confirmed }: Props) {
  const f = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const serverDeposit = quote.deposit_amount != null ? Number(quote.deposit_amount) : null;
  const deposit =
    serverDeposit != null && serverDeposit > 0 ? serverDeposit : calculateDeposit("event", price);

  const eventName = (f.event_name as string) ?? null;
  const deliveryDate = (f.delivery_date as string) ?? quote.move_date ?? null;
  const returnDate = (f.return_date as string) ?? null;
  const deliveryCharge = (f.delivery_charge as number) ?? 0;
  const setupFee = (f.setup_fee as number) ?? 0;
  const returnCharge = (f.return_charge as number) ?? 0;
  const crewSize = (f.event_crew as number) ?? (f.crew_size as number) ?? quote.est_crew_size ?? 2;
  const deliveryHours = (f.event_hours as number) ?? (f.delivery_hours as number) ?? null;
  const returnHours = (f.return_hours as number) ?? null;
  const truckSize = quote.truck_primary ?? null;

  const hasSetup = setupFee > 0;
  const hasReturn = returnCharge > 0;
  const isMulti = f.event_mode === "multi" && Array.isArray(f.event_legs);
  const eventLegs: EventLegFactor[] = isMulti ? ((f.event_legs as EventLegFactor[]) || []) : [];
  const showOnSiteBadge =
    !!f.event_same_location_onsite ||
    !!f.event_has_on_site_leg ||
    (isMulti && eventLegs.some((l) => l.is_on_site));

  // Per-leg display amounts: equal split when legs have identical scope (same
  // crew, hours, same-day flag); proportional scaling otherwise.
  const multiLegDisplayAmounts: number[] = [];
  if (isMulti && eventLegs.length > 0) {
    const subTotal = price - setupFee;
    const ref = eventLegs[0];
    const legsAreEqual =
      eventLegs.length > 1 &&
      eventLegs.every(
        (l) =>
          l.event_crew === ref.event_crew &&
          l.event_hours === ref.event_hours &&
          l.same_day === ref.same_day,
      );

    if (legsAreEqual) {
      const perLeg = Math.floor(subTotal / eventLegs.length);
      const remainder = subTotal - perLeg * eventLegs.length;
      eventLegs.forEach((_, idx) =>
        multiLegDisplayAmounts.push(
          idx === eventLegs.length - 1 ? perLeg + remainder : perLeg,
        ),
      );
    } else {
      const engineAmounts = eventLegs.map(
        (leg) => (leg.delivery_charge ?? 0) + (leg.return_charge ?? 0),
      );
      scaleToTotal(engineAmounts, subTotal).forEach((amt) =>
        multiLegDisplayAmounts.push(amt),
      );
    }
  }

  return (
    <section className="mb-10 space-y-8">
      {/* Event header */}
      <div>
        <div className="flex items-start gap-4 mb-5">
          <Star className="w-6 h-6 shrink-0 mt-1" style={{ color: WINE }} aria-hidden />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {eventName && (
                <span
                  className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${FOREST}15`, color: FOREST }}
                >
                  {eventName}
                </span>
              )}
              {showOnSiteBadge && (
                <span
                  className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border"
                  style={{ borderColor: `${FOREST}40`, color: FOREST }}
                >
                  On-site Event
                </span>
              )}
            </div>
            <h2 className="font-hero text-[26px] mt-2" style={{ color: WINE }}>
              Event Logistics
            </h2>
            {isMulti && (
              <p className="text-[11px] mt-1.5 font-medium" style={{ color: `${FOREST}80` }}>
                {eventLegs.length} round trips included in this quote
              </p>
            )}
          </div>
        </div>

        {/* Route(s) */}
        <div className="pt-4 border-t border-[var(--brd)]/30 space-y-4">
          {isMulti ? (
            eventLegs.map((leg, idx) => (
              <div key={idx} className="rounded-xl border p-3" style={{ borderColor: `${FOREST}30` }}>
                <p className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2 flex flex-wrap items-center gap-2" style={{ color: WINE }}>
                  <span>{leg.label || `Event ${idx + 1}`}</span>
                  {leg.is_on_site ? (
                    <span className="normal-case font-semibold text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${FOREST}35`, color: FOREST }}>
                      On-site Event
                    </span>
                  ) : null}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">Origin</p>
                    <p className="text-[11px] font-medium" style={{ color: FOREST }}>{leg.from_address}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">Venue</p>
                    <p className="text-[11px] font-medium" style={{ color: FOREST }}>{leg.to_address}</p>
                  </div>
                </div>
                <p className="text-[10px] mt-2" style={{ color: `${FOREST}65` }}>
                  Deliver {fmtShort(leg.delivery_date)} · Return {fmtShort(leg.return_date)}
                  {leg.same_day ? " (same day)" : ""}
                </p>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: WINE }} />
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">Origin</p>
                    <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.from_address}</p>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-start gap-2 justify-end">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">Venue</p>
                    <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.to_address}</p>
                  </div>
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FOREST }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase breakdown */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: `${FOREST}40` }}>
        <div className="px-5 py-3.5 border-b" style={{ backgroundColor: `${FOREST}08`, borderColor: `${FOREST}25` }}>
          <h2 className="admin-section-h2" style={{ color: WINE }}>
            Service Breakdown
          </h2>
        </div>
        <div className="divide-y" style={{ borderColor: "#E2DDD5" }}>
          {isMulti ? (
            <>
              {eventLegs.map((leg, idx) => {
                const displayAmt = multiLegDisplayAmounts[idx] ?? (leg.delivery_charge ?? 0) + (leg.return_charge ?? 0);
                const returnAmt = leg.return_charge ?? 0;
                const isSameDay = !!leg.same_day;

                return (
                  <div key={idx} className="px-5 py-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: WINE }}>
                      {leg.label || `Event ${idx + 1}`}
                    </p>
                    <div className="flex items-start gap-4 pl-2 border-l-2" style={{ borderColor: `${WINE}40` }}>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold uppercase" style={{ color: WINE }}>Delivery</span>
                        <span className="text-[10px] ml-2" style={{ color: `${FOREST}70` }}>{fmtShort(leg.delivery_date)}</span>
                        <div className="text-[10px] mt-0.5" style={{ color: `${FOREST}60` }}>
                          {(leg.event_crew ?? 0) > 0 && `${leg.event_crew}-person crew`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 pl-2 border-l-2" style={{ borderColor: `${FOREST}40` }}>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold uppercase" style={{ color: FOREST }}>Return</span>
                        <span className="text-[10px] ml-2" style={{ color: `${FOREST}70` }}>{fmtShort(leg.return_date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {hasSetup && (
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: FOREST }}>S</div>
                        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: FOREST }}>Setup (program)</span>
                      </div>
                      <div className="pl-7 text-[10px]" style={{ color: `${FOREST}60` }}>
                        {(f.setup_label as string) ?? "On-site setup service"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: WINE }}>1</div>
                      <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: WINE }}>Delivery</span>
                      <span className="text-[10px] font-medium" style={{ color: `${FOREST}70` }}>{fmtShort(deliveryDate)}</span>
                    </div>
                    <div className="pl-7 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: `${FOREST}60` }}>
                      {crewSize > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{crewSize} movers</span>}
                      {truckSize && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{truckSize} truck</span>}
                    </div>
                  </div>
                </div>
              </div>

              {hasSetup && (
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: FOREST }}>S</div>
                        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: FOREST }}>Setup at Venue</span>
                      </div>
                      <div className="pl-7 text-[10px]" style={{ color: `${FOREST}60` }}>
                        {(f.setup_label as string) ?? "On-site setup service"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hasReturn && (
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: FOREST }}>2</div>
                        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: FOREST }}>Return (Teardown)</span>
                        {returnDate && <span className="text-[10px] font-medium" style={{ color: `${FOREST}70` }}>{fmtShort(returnDate)}</span>}
                      </div>
                      <div className="pl-7 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: `${FOREST}60` }}>
                        <span>Same crew, no re-briefing needed</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dates summary (single-event only; multi shows dates per leg above) */}
      <div className="grid sm:grid-cols-2 gap-3">
        {!isMulti && deliveryDate && (
          <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${WINE}06`, border: `1px solid ${WINE}15` }}>
            <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: `${WINE}60` }}>Delivery Date</p>
              <p className="text-[12px] font-semibold" style={{ color: WINE }}>{fmtDate(deliveryDate)}</p>
            </div>
          </div>
        )}
        {!isMulti && returnDate && (
          <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${FOREST}06`, border: `1px solid ${FOREST}15` }}>
            <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: `${FOREST}60` }}>Return Date</p>
              <p className="text-[12px] font-semibold" style={{ color: FOREST }}>{fmtDate(returnDate)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Investment summary */}
      <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden" style={{ borderColor: FOREST }}>
        <div className="px-5 py-4 border-b" style={{ backgroundColor: `${FOREST}08`, borderColor: "#E2DDD5" }}>
          <h2 className="font-heading text-[13px] font-bold tracking-wider uppercase" style={{ color: WINE }}>
            Investment Summary
          </h2>
        </div>
        <div className="p-5 md:p-6">
          {/* Line items — multi-event programs only.
              Single-event Delivery / Setup / Return lines were
              removed 2026-06-11 per operator: a one-off event quote
              read as "Delivery $550 / Return $350" with the rest of
              the price unexplained, which confused clients more
              than it helped. Multi-event programs keep the per-leg
              breakdown because each leg IS a distinct sub-event the
              client booked. Setup/return for single events are
              rolled into the headline price below. */}
          {isMulti && multiLegDisplayAmounts.length > 1 ? (
            <table className="w-full text-[12px] mb-4">
              <tbody>
                {eventLegs.map((leg, idx) => {
                  const displayAmt = multiLegDisplayAmounts[idx] ?? 0;
                  return displayAmt > 0 ? (
                    <tr key={idx} className={idx > 0 ? "border-t" : undefined} style={idx > 0 ? { borderColor: "#E2DDD5" } : undefined}>
                      <td className="py-2" style={{ color: `${FOREST}80` }}>
                        {leg.label || `Event ${idx + 1}`}, Delivery ({fmtShort(leg.delivery_date)})
                        {leg.same_day ? <span className="ml-1 text-[10px] italic">+ same-day return</span> : null}
                      </td>
                      <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(displayAmt)}</td>
                    </tr>
                  ) : null;
                })}
                {hasSetup && (
                  <tr className="border-t" style={{ borderColor: "#E2DDD5" }}>
                    <td className="py-2" style={{ color: `${FOREST}80` }}>Setup (program)</td>
                    <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(setupFee)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}
          <div className="pt-4 text-center">
            <p className="text-[36px] md:text-[44px] [font-family:var(--font-body)]" style={{ color: WINE }}>
              {fmtPrice(price)}
            </p>
            <p className="text-[12px] mt-1 mb-5" style={{ color: `${FOREST}70` }}>
              +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90 ${confirmed ? "opacity-80" : ""}`}
              style={{ backgroundColor: FOREST }}
            >
              {confirmed ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Confirmed
                </span>
              ) : (
                `Confirm & Book — ${fmtPrice(price + tax)}`
              )}
            </button>
            <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
              Full payment at booking &middot; No balance due
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
