import {
  type Quote,
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";
import { decideBookingPayment } from "@/lib/quotes/booking-payment-window";
import {
  premiumShellInk,
  premiumShellRuleRgba,
  type PremiumShellKind,
} from "../quote-premium-shell";
import { SIGNATURE_CTA } from "../signature-quote-ui";
import { formatPlatformDisplay } from "@/lib/date-format";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
  /** Optional Your Protection card rendered above Investment Summary. */
  protectionSlot?: React.ReactNode;
  /** Premium shell (deep-green Signature) or "none" for the cream fallback. */
  premiumShellKind?: PremiumShellKind;
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

export default function EventLayout({
  quote,
  onConfirm,
  confirmed,
  protectionSlot,
  premiumShellKind = "none",
}: Props) {
  /* ── Premium-shell palette (deep-green Signature) with cream fallback,
        mirroring WhiteGloveLayout so events read as the same premium flow. ── */
  const premium = premiumShellKind !== "none";
  const ink = premiumShellInk(premiumShellKind);
  const C = {
    heading: ink?.primary ?? WINE,
    body: ink?.body ?? FOREST_BODY,
    strong: ink?.primary ?? FOREST,
    muted: ink?.muted ?? FOREST_MUTED,
    kicker: ink?.kicker ?? `${FOREST}70`,
    secondary: ink?.secondary ?? `${FOREST}75`,
    rule: premiumShellRuleRgba(premiumShellKind),
    panelBorder: ink?.borderSubtle ?? "#E2DDD5",
    panelBg: premium ? "rgba(244, 250, 245, 0.05)" : "rgba(255,255,255,0.9)",
    chipBg: premium ? "rgba(244, 250, 245, 0.08)" : `${FOREST}12`,
    chipText: ink?.primary ?? FOREST,
    priceColor: ink?.primary ?? WINE,
    ctaFill: premium ? SIGNATURE_CTA : FOREST,
  };

  const f = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const grandTotal = price + tax;
  const serverDeposit = quote.deposit_amount != null ? Number(quote.deposit_amount) : null;
  const deposit =
    serverDeposit != null && serverDeposit > 0 ? serverDeposit : calculateDeposit("event", price);

  // Deposit-vs-full copy that reflects the real amount, not a hardcoded line.
  const bookingDecision = decideBookingPayment({
    moveDate: quote.move_date,
    deposit,
    grandTotal,
  });
  const dueToday = Math.min(grandTotal, Math.max(0, bookingDecision.amountToCharge));
  const balanceDue = Math.max(0, grandTotal - dueToday);
  const paidInFull = balanceDue < 2;

  const eventName = (f.event_name as string) ?? null;
  const deliveryDate = (f.delivery_date as string) ?? quote.move_date ?? null;
  const returnDate = (f.return_date as string) ?? null;
  const setupFee = (f.setup_fee as number) ?? 0;
  const returnCharge = (f.return_charge as number) ?? 0;
  const crewSize = (f.event_crew as number) ?? (f.crew_size as number) ?? quote.est_crew_size ?? 2;
  const truckSize = quote.truck_primary ?? null;
  const arrivalWindow = (f.event_arrival_window as string) ?? null;
  const hardCutoff = (f.event_hard_cutoff as string) ?? null;

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

  const chip = (label: string, filled = false) => (
    <span
      className="text-[9px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full"
      style={
        filled
          ? { backgroundColor: C.chipBg, color: C.chipText }
          : { border: `1px solid ${C.rule}`, color: C.secondary }
      }
    >
      {label}
    </span>
  );

  // Origin → venue, typographic (no icons) to match the premium layouts.
  const routeRow = (from: string | null | undefined, to: string | null | undefined) => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="min-w-0">
        <p className="text-[9px] font-bold tracking-[0.16em] uppercase" style={{ color: C.kicker }}>
          Origin
        </p>
        <p className="text-[12px] font-medium mt-0.5 truncate" style={{ color: C.strong }}>
          {from || "TBD"}
        </p>
      </div>
      <span className="text-[13px]" style={{ color: C.secondary }} aria-hidden>
        &rarr;
      </span>
      <div className="min-w-0 text-right">
        <p className="text-[9px] font-bold tracking-[0.16em] uppercase" style={{ color: C.kicker }}>
          Venue
        </p>
        <p className="text-[12px] font-medium mt-0.5 truncate" style={{ color: C.strong }}>
          {to || "TBD"}
        </p>
      </div>
    </div>
  );

  return (
    <section className="mb-10 space-y-8">
      {/* ── Event header ── */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {eventName && chip(eventName, true)}
          {showOnSiteBadge && chip("On-site event")}
        </div>
        <h2 className="font-hero text-[26px] md:text-[30px]" style={{ color: C.heading }}>
          Event Logistics
        </h2>
        {isMulti && (
          <p className="text-[11px] mt-1.5 font-medium" style={{ color: C.secondary }}>
            {eventLegs.length} round trips included in this quote
          </p>
        )}

        {/* Route(s) */}
        <div className="mt-5 pt-5 space-y-4" style={{ borderTop: `1px solid ${C.rule}` }}>
          {isMulti ? (
            eventLegs.map((leg, idx) => (
              <div
                key={idx}
                className="rounded-xl p-4"
                style={{ border: `1px solid ${C.panelBorder}`, backgroundColor: C.panelBg }}
              >
                <p className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[9px] font-bold tracking-[0.16em] uppercase"
                    style={{ color: C.kicker }}
                  >
                    {leg.label || `Event ${idx + 1}`}
                  </span>
                  {leg.is_on_site ? chip("On-site event") : null}
                </p>
                {routeRow(leg.from_address, leg.is_on_site ? leg.from_address : leg.to_address)}
                <p className="text-[10px] mt-3" style={{ color: C.muted }}>
                  Deliver {fmtShort(leg.delivery_date)} &middot; Return {fmtShort(leg.return_date)}
                  {leg.same_day ? " (same day)" : ""}
                </p>
              </div>
            ))
          ) : (
            routeRow(quote.from_address, quote.to_address)
          )}
        </div>
      </div>

      {/* ── Service Breakdown ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${C.panelBorder}`, backgroundColor: C.panelBg }}
      >
        <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h3
            className="text-[11px] font-bold tracking-[0.16em] uppercase"
            style={{ color: C.heading }}
          >
            Service Breakdown
          </h3>
        </div>
        <div>
          {isMulti ? (
            <>
              {eventLegs.map((leg, idx) => (
                <div key={idx} className="px-5 py-4" style={{ borderTop: idx > 0 ? `1px solid ${C.rule}` : undefined }}>
                  <p
                    className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2"
                    style={{ color: C.kicker }}
                  >
                    {leg.label || `Event ${idx + 1}`}
                  </p>
                  <div className="pl-3 space-y-1" style={{ borderLeft: `2px solid ${C.rule}` }}>
                    <p className="text-[11px]" style={{ color: C.body }}>
                      <span className="font-semibold uppercase tracking-wide">Delivery</span>
                      <span className="ml-2" style={{ color: C.muted }}>{fmtShort(leg.delivery_date)}</span>
                      {(leg.event_crew ?? 0) > 0 && (
                        <span className="ml-2" style={{ color: C.muted }}>{leg.event_crew}-person crew</span>
                      )}
                    </p>
                    <p className="text-[11px]" style={{ color: C.body }}>
                      <span className="font-semibold uppercase tracking-wide">Return</span>
                      <span className="ml-2" style={{ color: C.muted }}>{fmtShort(leg.return_date)}</span>
                    </p>
                  </div>
                </div>
              ))}
              {hasSetup && (
                <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.rule}` }}>
                  <p className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: C.strong }}>
                    Setup (program)
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                    {(f.setup_label as string) ?? "On-site setup service"}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="px-5 py-4">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: C.strong }}>
                    Delivery
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: C.muted }}>{fmtShort(deliveryDate)}</span>
                </p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={{ color: C.body }}>
                  {crewSize > 0 && <span>{crewSize}-person crew</span>}
                  {truckSize && <span>&middot; {truckSize}</span>}
                  {arrivalWindow && <span>&middot; Load-in {arrivalWindow}</span>}
                  {hardCutoff && <span>&middot; Off-site by {hardCutoff}</span>}
                </p>
              </div>

              {hasSetup && (
                <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.rule}` }}>
                  <p className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: C.strong }}>
                    Setup at venue
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                    {(f.setup_label as string) ?? "On-site setup service"}
                  </p>
                </div>
              )}

              {hasReturn && (
                <div className="px-5 py-4" style={{ borderColor: C.rule }}>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: C.strong }}>
                      Return (teardown)
                    </span>
                    {returnDate && (
                      <span className="text-[10px] font-medium" style={{ color: C.muted }}>{fmtShort(returnDate)}</span>
                    )}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                    Same crew, no re-briefing needed
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Protection slot renders here (above Investment Summary) so the
          client sees coverage next to the price, not below the confirm CTA. */}
      {protectionSlot}

      {/* ── Investment Summary ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1.5px solid ${premium ? C.rule : FOREST}`, backgroundColor: C.panelBg }}
      >
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.rule}` }}>
          <h3
            className="text-[11px] font-bold tracking-[0.16em] uppercase"
            style={{ color: C.heading }}
          >
            Investment Summary
          </h3>
        </div>
        <div className="p-5 md:p-6">
          {isMulti && multiLegDisplayAmounts.length > 1 ? (
            <table className="w-full text-[12px] mb-5">
              <tbody>
                {eventLegs.map((leg, idx) => {
                  const displayAmt = multiLegDisplayAmounts[idx] ?? 0;
                  return displayAmt > 0 ? (
                    <tr key={idx} style={idx > 0 ? { borderTop: `1px solid ${C.rule}` } : undefined}>
                      <td className="py-2" style={{ color: C.body }}>
                        {leg.label || `Event ${idx + 1}`}, Delivery ({fmtShort(leg.delivery_date)})
                        {leg.same_day ? <span className="ml-1 text-[10px] italic">+ same-day return</span> : null}
                      </td>
                      <td className="py-2 text-right font-medium" style={{ color: C.strong }}>{fmtPrice(displayAmt)}</td>
                    </tr>
                  ) : null;
                })}
                {hasSetup && (
                  <tr style={{ borderTop: `1px solid ${C.rule}` }}>
                    <td className="py-2" style={{ color: C.body }}>Setup (program)</td>
                    <td className="py-2 text-right font-medium" style={{ color: C.strong }}>{fmtPrice(setupFee)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}
          <div className="pt-2 text-center">
            <p className="text-[36px] md:text-[44px] [font-family:var(--font-body)]" style={{ color: C.priceColor }}>
              {fmtPrice(price)}
            </p>
            <p className="text-[12px] mt-1 mb-5" style={{ color: C.secondary }}>
              +{fmtPrice(tax)} HST &middot; Total {fmtPrice(grandTotal)}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.14em] uppercase text-white transition-opacity hover:opacity-90 ${confirmed ? "opacity-80" : ""}`}
              style={{ backgroundColor: C.ctaFill }}
            >
              {confirmed ? "Confirmed" : `Confirm & Book — ${fmtPrice(dueToday)}`}
            </button>
            <p className="text-[10px] mt-2.5" style={{ color: C.muted }}>
              {paidInFull
                ? "Paid in full at booking · No balance due"
                : `${fmtPrice(dueToday)} deposit today · ${fmtPrice(balanceDue)} balance before your event`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
