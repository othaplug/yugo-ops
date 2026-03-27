import { MapPin, Check, Truck, Clock, ArrowRight } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  GOLD,
  TAX_RATE,
  fmtPrice,
  fmtShortDate,
  addDays,
  calculateDeposit,
} from "../quote-shared";

const DEFAULT_INCLUDES = [
  "Full packing & wrapping service",
  "Climate-controlled dedicated truck",
  "Dedicated 3-person moving crew",
  "Basic disassembly & reassembly",
  "Floor & wall protection",
  "Real-time GPS tracking throughout transit",
  "$2M cargo insurance included",
];

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

export default function LongDistanceLayout({ quote, onConfirm, confirmed }: Props) {
  const factors = quote.factors_applied as Record<string, unknown> | null;
  const includes = (factors?.includes as string[] | undefined) ?? DEFAULT_INCLUDES;
  const ldTruckSur = 0;
  const ldTruckLine: string | null = null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("long_distance", price);

  const moveDate = quote.move_date ? new Date(quote.move_date + "T00:00:00") : null;
  const transitDays = Math.max(1, Math.ceil((quote.distance_km ?? 500) / 400));

  const phases = [
    {
      label: "Packing Day",
      desc: "Full professional packing of all items",
      date: moveDate ? fmtShortDate(addDays(moveDate, -1)) : "Day before",
    },
    {
      label: "Loading & Departure",
      desc: "Careful loading, inventory check, departure",
      date: moveDate ? fmtShortDate(moveDate) : "Move day",
    },
    {
      label: "In Transit",
      desc: `${transitDays} day${transitDays > 1 ? "s" : ""} \u2014 climate-controlled, GPS tracked`,
      date: `${transitDays} day${transitDays > 1 ? "s" : ""}`,
    },
    {
      label: "Arrival & Setup",
      desc: "Unloading, reassembly, placement per your instructions",
      date: moveDate ? fmtShortDate(addDays(moveDate, transitDays + 1)) : "Delivery day",
    },
  ];

  return (
    <section className="mb-10 space-y-8">
      {/* Route visual */}
      <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm p-5 md:p-7">
        <h2
          className="font-heading text-[13px] font-bold tracking-wider capitalize mb-5"
          style={{ color: FOREST }}
        >
          Your Route
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: WINE }} />
              <div>
                <p className="text-[10px] font-semibold tracking-wider capitalize" style={{ color: `${FOREST}80` }}>
                  Origin
                </p>
                <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                  {quote.from_address}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center shrink-0">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${FOREST}08` }}
            >
              <Truck className="w-3.5 h-3.5" style={{ color: FOREST }} />
              <span className="text-[11px] font-semibold" style={{ color: FOREST }}>
                {quote.distance_km ?? "\u2014"} km
              </span>
            </div>
            {quote.drive_time_min != null && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" style={{ color: `${FOREST}60` }} />
                <span className="text-[10px]" style={{ color: `${FOREST}60` }}>
                  ~{Math.round(quote.drive_time_min / 60)}h drive
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-start gap-2 justify-end">
              <div>
                <p className="text-[10px] font-semibold tracking-wider capitalize" style={{ color: `${FOREST}80` }}>
                  Destination
                </p>
                <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                  {quote.to_address}
                </p>
              </div>
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} />
            </div>
          </div>
        </div>
      </div>

      {/* Price card */}
      <div
        className="bg-white rounded-2xl border-2 shadow-sm p-6 md:p-8 text-center"
        style={{ borderColor: GOLD }}
      >
        <h2 className="font-hero text-[26px] mb-1" style={{ color: WINE }}>
          All-Inclusive Flat Rate
        </h2>
        {(ldTruckLine || ldTruckSur > 0) && (
          <p className="text-[11px] mb-3 max-w-md mx-auto leading-relaxed" style={{ color: `${FOREST}75` }}>
            {ldTruckLine ? (
              <span className="font-semibold" style={{ color: FOREST }}>
                {ldTruckLine}
              </span>
            ) : (
              <>
                <span className="font-semibold" style={{ color: FOREST }}>Truck sizing: </span>
                +{fmtPrice(ldTruckSur)}
              </>
            )}
          </p>
        )}
        <p className="font-hero text-[40px] md:text-[48px] my-3" style={{ color: WINE }}>
          {fmtPrice(price)}
        </p>
        <p className="text-[12px] mb-5" style={{ color: `${FOREST}70` }}>
          +{fmtPrice(tax)} HST &middot; Total {fmtPrice(price + tax)}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className={`w-full max-w-xs mx-auto py-3.5 rounded-xl text-[13px] font-bold tracking-wide text-white transition-all ${
            confirmed ? "opacity-80" : ""
          }`}
          style={{ backgroundColor: confirmed ? FOREST : GOLD }}
        >
          {confirmed ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Selected
            </span>
          ) : (
            `Continue \u2014 ${fmtPrice(deposit)} Deposit`
          )}
        </button>
        <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
          25% deposit &middot; Balance due before delivery
        </p>
      </div>

      {/* What&apos;s included */}
      <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm p-5 md:p-7">
        <h2
          className="font-heading text-[13px] font-bold tracking-wider capitalize mb-4"
          style={{ color: FOREST }}
        >
          What&apos;s Included
        </h2>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <span className="text-[12px] leading-snug" style={{ color: FOREST }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm p-5 md:p-7">
        <h2
          className="font-heading text-[13px] font-bold tracking-wider capitalize mb-6"
          style={{ color: FOREST }}
        >
          Move Timeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {phases.map((phase, i) => (
            <div key={i} className="text-center relative">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2.5 text-[var(--text-base)] font-bold text-white"
                style={{ backgroundColor: i === 0 ? WINE : i === 3 ? FOREST : GOLD }}
              >
                {i + 1}
              </div>
              {i < phases.length - 1 && (
                <div
                  className="hidden md:block absolute top-5 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-px"
                  style={{ backgroundColor: `${GOLD}40` }}
                >
                  <ArrowRight
                    className="w-3 h-3 absolute -right-1.5 -top-1.5"
                    style={{ color: `${GOLD}60` }}
                  />
                </div>
              )}
              <p className="text-[12px] font-bold mb-0.5" style={{ color: FOREST }}>
                {phase.label}
              </p>
              <p className="text-[10px] leading-snug mb-1" style={{ color: `${FOREST}60` }}>
                {phase.desc}
              </p>
              <p className="text-[10px] font-semibold" style={{ color: GOLD }}>
                {phase.date}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
