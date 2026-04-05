"use client";

import { Recycle, MapPin, CalendarBlank, Clock } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  TAX_RATE,
  fmtPrice,
} from "../quote-shared";
import { abbreviateAddressRegions } from "@/lib/address-abbrev";
import { formatPlatformDisplay } from "@/lib/date-format";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

function fmtLong(d: string | null | undefined): string {
  if (!d) return "To be confirmed";
  return formatPlatformDisplay(new Date(d + "T00:00:00"), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }, "To be confirmed");
}

export default function BinRentalLayout({ quote, onConfirm, confirmed }: Props) {
  const f = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const subtotal = quote.custom_price ?? 0;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;
  const lines = Array.isArray(f.bin_line_items)
    ? (f.bin_line_items as { label?: string; amount?: number }[])
    : [];
  const drop = f.bin_drop_off_date as string | undefined;
  const pick = f.bin_pickup_date as string | undefined;
  const move = f.bin_move_date as string | undefined;
  const cycle = typeof f.bin_rental_cycle_days === "number" ? f.bin_rental_cycle_days : 12;
  const deliveryAddr = abbreviateAddressRegions(quote.to_address || "");
  const pickupAddr = abbreviateAddressRegions(
    (quote.from_address && quote.from_address.trim() && quote.from_address !== quote.to_address
      ? quote.from_address
      : quote.to_address) || "",
  );
  const packing = f.bin_packing_paper === true;
  const deliveryCharged = f.bin_material_delivery_charged === true;

  return (
    <section className="mb-10 space-y-6">
      <div className="text-center space-y-2">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: `${FOREST}70` }}>
          Your bin rental quote
        </p>
        <h2 className="font-hero text-[26px] md:text-[30px]" style={{ color: WINE }}>
          Quote {quote.quote_id}
        </h2>
        <p className="text-[11px]" style={{ color: `${FOREST}65` }}>
          {quote.expires_at
            ? `Valid through ${formatPlatformDisplay(quote.expires_at, { month: "short", day: "numeric" })}`
            : "Valid 7 days"}
        </p>
      </div>

      <div
        className="rounded-2xl border p-5 md:p-6 space-y-4"
        style={{ borderColor: `${FOREST}55`, backgroundColor: `${FOREST}08` }}
      >
        <div className="flex items-center gap-3">
          <Recycle className="w-6 h-6 shrink-0" style={{ color: FOREST }} weight="regular" aria-hidden />
          <div>
            <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: `${FOREST}55` }}>
              Eco-friendly plastic bins
            </p>
            <p className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>
              Reusable, stackable, better for the planet.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white/80 border border-[#E2DDD5] p-4 space-y-3">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Your bundle</p>
          <div className="space-y-2 text-[12px]" style={{ color: FOREST }}>
            {lines.length > 0 ? (
              lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>{l.label}</span>
                  <span className="font-semibold shrink-0">{fmtPrice(Number(l.amount) || 0)}</span>
                </div>
              ))
            ) : (
              <p>Bin rental package</p>
            )}
            <p className="text-[11px] text-[var(--tx3)] pt-1 border-t border-[var(--brd)]/40">
              All bundles include zip ties (1 per bin).
              {packing ? " Packing paper included." : null}
              {deliveryCharged
                ? " Material delivery included in quote."
                : " Delivery included with your Yugo move."}
            </p>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-[11px] text-[var(--tx3)]">Subtotal + HST</span>
              <span className="text-xl font-black tabular-nums" style={{ color: FOREST }}>
                {fmtPrice(total)}
              </span>
            </div>
            <p className="text-[10px] text-[var(--tx3)]">
              {fmtPrice(subtotal)} + {fmtPrice(tax)} HST
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--brd)]/50 p-4 space-y-3 bg-white/60">
        <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Your schedule</p>
        <div className="space-y-3 text-[12px]" style={{ color: FOREST }}>
          <div className="flex gap-2">
            <CalendarBlank className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} aria-hidden />
            <div>
              <p className="font-semibold">Bin delivery</p>
              <p>{fmtLong(drop)}</p>
              <p className="text-[11px] text-[var(--tx3)] flex items-start gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                Delivered to: {deliveryAddr}
              </p>
              <p className="text-[10px] text-[var(--tx3)] mt-1">
                We&apos;ll contact you the day before to confirm a time.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} aria-hidden />
            <div>
              <p className="font-semibold">Your move day</p>
              <p>{fmtLong(move)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <CalendarBlank className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} aria-hidden />
            <div>
              <p className="font-semibold">Bin pickup</p>
              <p>{fmtLong(pick)}</p>
              <p className="text-[11px] text-[var(--tx3)] flex items-start gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                Picked up from: {pickupAddr}
              </p>
              <p className="text-[10px] text-[var(--tx3)] mt-1">All bins must be emptied and stacked.</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed border-t border-[var(--brd)]/40 pt-3" style={{ color: `${FOREST}85` }}>
          <strong className="text-[var(--tx)]">Important:</strong> {cycle}-day rental cycle included. Wardrobe boxes on move day,
          returned at pickup. Late returns may incur fees. Card on file for any late or missing items.
        </p>
      </div>

      {!confirmed && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: FOREST }}
          >
            Continue to payment
          </button>
          <p className="text-center text-[11px] leading-relaxed" style={{ color: `${FOREST}65` }}>
            Total {fmtPrice(total)} (incl. HST) — you&apos;ll review the rental agreement and pay on the next steps.
          </p>
        </div>
      )}
    </section>
  );
}
