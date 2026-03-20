import { MapPin, Check, Users, Clock, Truck, Calendar } from "@phosphor-icons/react";
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
    weekday: "long",
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

export default function LabourOnlyLayout({ quote, onConfirm, confirmed }: Props) {
  const f = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("labour_only", price + tax);

  const crewSize = (f.crew_size as number) ?? 2;
  const hours = (f.hours as number) ?? 2;
  const labourRate = (f.labour_rate as number) ?? 85;
  const truckFee = (f.truck_fee as number) ?? 0;
  const accessSurcharge = (f.access_surcharge as number) ?? 0;
  const visits = (f.visits as number) ?? 1;
  const visit1Price = (f.visit1_price as number) ?? price;
  const visit2Price = (f.visit2_price as number) ?? 0;
  const visit2Date = (f.visit2_date as string) ?? null;
  const description = (f.labour_description as string) ?? null;

  const includes = [
    `${crewSize} professional movers`,
    "All tools and equipment",
    "Floor protection",
    `${hours} hours of service`,
    `Additional hours at $${labourRate}/hr per mover`,
  ];

  return (
    <section className="mb-10 space-y-8">
      {/* Service overview */}
      <div>
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${FOREST}08` }}
          >
            <Users className="w-6 h-6" style={{ color: FOREST }} />
          </div>
          <div>
            <span
              className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
            >
              Labour Service
            </span>
            <h2 className="font-hero text-[26px] mt-2" style={{ color: WINE }}>
              {description ? description.split(/[,.]/, 1)[0] : "Professional Labour"}
            </h2>
          </div>
        </div>

        {/* Location + date */}
        <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Work Address</p>
              <p className="text-[12px] font-medium" style={{ color: FOREST }}>{quote.from_address}</p>
            </div>
          </div>
          {quote.move_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <div>
                <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Date</p>
                <p className="text-[12px] font-medium" style={{ color: FOREST }}>{fmtDate(quote.move_date)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="mt-4 p-3 rounded-xl text-[12px] leading-relaxed" style={{ backgroundColor: `${FOREST}06`, color: FOREST, border: `1px solid ${FOREST}15` }}>
            {description}
          </div>
        )}
      </div>

      {/* Crew + time */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl text-center" style={{ backgroundColor: `${WINE}06`, border: `1px solid ${WINE}15` }}>
          <Users className="w-5 h-5 mx-auto mb-1.5" style={{ color: WINE }} />
          <p className="text-[22px] font-bold tabular-nums" style={{ color: WINE }}>{crewSize}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: `${WINE}60` }}>Movers</p>
        </div>
        <div className="p-4 rounded-xl text-center" style={{ backgroundColor: `${GOLD}08`, border: `1px solid ${GOLD}20` }}>
          <Clock className="w-5 h-5 mx-auto mb-1.5" style={{ color: GOLD }} />
          <p className="text-[22px] font-bold tabular-nums" style={{ color: GOLD }}>{hours}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: `${GOLD}80` }}>Hours</p>
        </div>
        <div className="p-4 rounded-xl text-center" style={{ backgroundColor: truckFee > 0 ? `${FOREST}06` : `${FOREST}03`, border: `1px solid ${FOREST}15` }}>
          <Truck className="w-5 h-5 mx-auto mb-1.5" style={{ color: truckFee > 0 ? FOREST : `${FOREST}40` }} />
          <p className="text-[11px] font-bold tabular-nums" style={{ color: truckFee > 0 ? FOREST : `${FOREST}40` }}>
            {truckFee > 0 ? "Included" : "No Truck"}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: `${FOREST}50` }}>Truck</p>
        </div>
      </div>

      {/* Visits breakdown if 2 visits */}
      {visits >= 2 && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: `${GOLD}40` }}>
          <div className="px-5 py-3.5 border-b" style={{ backgroundColor: `${GOLD}08`, borderColor: `${GOLD}25` }}>
            <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: WINE }}>Two-Visit Schedule</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#E2DDD5" }}>
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold" style={{ color: FOREST }}>Visit 1 — {fmtShort(quote.move_date)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: `${FOREST}60` }}>{crewSize} movers × {hours}h</p>
              </div>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: FOREST }}>{fmtPrice(visit1Price)}</span>
            </div>
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold" style={{ color: FOREST }}>Visit 2 — {fmtShort(visit2Date)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: `${FOREST}60` }}>Return visit — 15% return discount</p>
              </div>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: FOREST }}>{fmtPrice(visit2Price)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Service includes */}
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
          {/* Breakdown */}
          <table className="w-full text-[12px] mb-4">
            <tbody>
              <tr>
                <td className="py-2" style={{ color: `${FOREST}80` }}>{crewSize} movers × {hours} hrs × ${labourRate}/hr</td>
                <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(crewSize * hours * labourRate)}</td>
              </tr>
              {truckFee > 0 && (
                <tr className="border-t" style={{ borderColor: "#E2DDD5" }}>
                  <td className="py-2" style={{ color: `${FOREST}80` }}>Truck</td>
                  <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(truckFee)}</td>
                </tr>
              )}
              {accessSurcharge > 0 && (
                <tr className="border-t" style={{ borderColor: "#E2DDD5" }}>
                  <td className="py-2" style={{ color: `${FOREST}80` }}>Access surcharge</td>
                  <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(accessSurcharge)}</td>
                </tr>
              )}
              {visits >= 2 && visit2Price > 0 && (
                <tr className="border-t" style={{ borderColor: "#E2DDD5" }}>
                  <td className="py-2" style={{ color: `${FOREST}80` }}>Return visit ({fmtShort(visit2Date)})</td>
                  <td className="py-2 text-right font-medium" style={{ color: FOREST }}>{fmtPrice(visit2Price)}</td>
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
                  <Check className="w-4 h-4" /> Booked
                </span>
              ) : (
                `Pay ${fmtPrice(deposit)} Deposit & Book`
              )}
            </button>
            <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
              50% deposit &middot; Balance of {fmtPrice(price + tax - deposit)} due on day of service
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
