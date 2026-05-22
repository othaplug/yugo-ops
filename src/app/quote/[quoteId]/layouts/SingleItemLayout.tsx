import { ArrowRight, Check } from "@phosphor-icons/react";
import {
  type Quote,
  WINE,
  FOREST,
  TAX_RATE,
  fmtPrice,
  calculateDeposit,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";
import {
  resolveSingleItemLines,
  type SingleItemLine,
} from "@/lib/quotes/single-item-types";
import { getSingleItemQuoteCopy } from "@/lib/quotes/single-item-copy";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
}

const DEFAULT_INCLUDES = [
  "Professional Handling And Transport",
  "Protective Blanket Wrapping For All Items",
  "Careful Loading And Unloading",
  "Floor And Entryway Protection At Both Locations",
];

export default function SingleItemLayout({
  quote,
  onConfirm,
  confirmed,
}: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("single_item", price);
  const isFullPayment = price < 500;

  // Resolve the per-line array. Old quotes with scalar fields synthesize
  // a one-row array; new quotes pass through unchanged. Single source of
  // truth — see src/lib/quotes/single-item-types.ts.
  const quoteItemsRaw = (quote as unknown as { quote_items?: unknown }).quote_items;
  const lines: SingleItemLine[] = resolveSingleItemLines(quoteItemsRaw, {
    item_description: f?.item_description as string | null | undefined,
    item_category: f?.item_category as string | null | undefined,
    item_weight_class: f?.weight_class as string | null | undefined,
    assembly_needed: f?.assembly as string | null | undefined,
    stair_carry: f?.stair_carry as boolean | null | undefined,
    stair_flights: f?.stair_flights as number | null | undefined,
    number_of_items: f?.single_item_quantity as number | null | undefined,
  });

  // Residential vs commercial copy mode — see single-item-copy.ts for the
  // detection rules. Uses access types + per-line signals + free-text notes.
  const copy = getSingleItemQuoteCopy({
    from_access: quote.from_access as string | null | undefined,
    to_access: quote.to_access as string | null | undefined,
    walkthrough_notes: (quote as unknown as { walkthrough_notes?: string | null })
      .walkthrough_notes,
    booking_notes: (quote as unknown as { booking_notes?: string | null })
      .booking_notes,
    quote_items: quoteItemsRaw,
    scalars: {
      item_description: f?.item_description as string | null | undefined,
      item_category: f?.item_category as string | null | undefined,
      item_weight_class: f?.weight_class as string | null | undefined,
      assembly_needed: f?.assembly as string | null | undefined,
      stair_carry: f?.stair_carry as boolean | null | undefined,
      stair_flights: f?.stair_flights as number | null | undefined,
      number_of_items: f?.single_item_quantity as number | null | undefined,
    },
  });

  const specialHandling =
    typeof f?.single_item_special_handling === "string" &&
    f.single_item_special_handling.trim().length > 0
      ? f.single_item_special_handling.trim()
      : null;
  const weightSurcharge =
    typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0
      ? f.weight_surcharge
      : 0;
  const truckBreakdown: string | null = null;
  const baseIncludes = (f?.includes as string[] | undefined) ?? DEFAULT_INCLUDES;

  // Assembly / disassembly are charged per-line in the engine, so they are
  // already part of the quote total. Surface them in the "What's Included"
  // section so the client sees the labour they're paying for — otherwise
  // the bullet list reads like a flat haul.
  const hasDisassemblyAtPickup = lines.some((l) => {
    const a = (l.assembly || "").toLowerCase();
    return a === "both" || a.includes("disassembly");
  });
  const hasAssemblyAtDelivery = lines.some((l) => {
    const a = (l.assembly || "").toLowerCase();
    return a === "both" || a === "assembly at delivery";
  });
  const assemblyIncludes: string[] = [];
  if (hasDisassemblyAtPickup && hasAssemblyAtDelivery) {
    assemblyIncludes.push("Disassembly at pickup and reassembly at delivery");
  } else if (hasAssemblyAtDelivery) {
    assemblyIncludes.push("Assembly at delivery");
  } else if (hasDisassemblyAtPickup) {
    assemblyIncludes.push("Disassembly at pickup");
  }
  const includes = [...baseIncludes, ...assemblyIncludes];

  // Junk-removal display: client sees what's being hauled away (confirms
  // the scope they discussed with the coordinator). We deliberately don't
  // mention a drop-off facility — that's an operational detail.
  const junkPickupFrom = (f?.junk_pickup_from as string | null) ?? null;
  const junkItems = (f?.junk_items_description as string | null) ?? null;
  const showJunkLine = junkPickupFrom && junkItems && junkItems.trim().length > 0;

  return (
    <section className="mb-10 space-y-6">
      {/* Item details */}
      <div>
        {lines.length === 1 ? (
          // Single-item view: keep the existing icon + label treatment.
          <SingleItemHeader line={lines[0]!} fallbackLabel={copy.itemFallbackLabel} />
        ) : (
          // Multi-item view: stacked cards.
          <div className="space-y-3">
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: `${FOREST}80` }}>
              {lines.length} items
            </p>
            {lines.map((l, i) => (
              <SingleItemHeader
                key={l.id || i}
                line={l}
                fallbackLabel={`${copy.itemFallbackLabel} ${i + 1}`}
                compact
              />
            ))}
          </div>
        )}

        {/* Route */}
        <div className="mt-4 pt-4 border-t border-[var(--brd)]/30">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
                PICKUP
              </p>
              <p
                className="text-[12px] font-medium truncate"
                style={{ color: FOREST }}
              >
                {quote.from_address}
              </p>
            </div>
            <ArrowRight
              className="w-4 h-4 shrink-0"
              style={{ color: FOREST }}
            />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
                {copy.mode === "residential" ? "DESTINATION" : "DELIVERY"}
              </p>
              <p
                className="text-[12px] font-medium truncate"
                style={{ color: FOREST }}
              >
                {quote.to_address}
              </p>
            </div>
          </div>
          {quote.distance_km != null && (
            <p
              className="text-[10px] text-center mt-2"
              style={{ color: `${FOREST}50` }}
            >
              {quote.distance_km} km
              {quote.drive_time_min
                ? ` · ~${quote.drive_time_min} min`
                : ""}
            </p>
          )}
        </div>
      </div>

      {specialHandling ? (
        <div
          className="rounded-xl border-2 p-4 mt-4"
          style={{ borderColor: `${FOREST}55`, backgroundColor: `${FOREST}08` }}
        >
          <p
            className="text-[9px] font-bold tracking-[0.14em] uppercase mb-1.5"
            style={{ color: WINE }}
          >
            SPECIAL HANDLING INSTRUCTIONS
          </p>
          <p
            className="text-[13px] leading-relaxed font-medium"
            style={{ color: FOREST }}
          >
            {specialHandling}
          </p>
        </div>
      ) : null}

      {/* Service includes */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="admin-section-h2 mb-3">{copy.includesSectionLabel}</h2>
        <div className="space-y-2">
          {includes.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                style={{ color: FOREST }}
              />
              <span
                className="text-[12px] leading-snug"
                style={{ color: FOREST }}
              >
                {item}
              </span>
            </div>
          ))}
          {showJunkLine && (
            <div className="flex items-start gap-2">
              <Check
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                style={{ color: FOREST }}
              />
              <span
                className="text-[12px] leading-snug"
                style={{ color: FOREST }}
              >
                Junk removal: {junkItems} — hauled away. Disposal included.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Price + CTA */}
      <div
        className="bg-white rounded-2xl border-2 shadow-sm p-6 text-center"
        style={{ borderColor: FOREST }}
      >
        {(weightSurcharge > 0 || truckBreakdown) && (
          <div
            className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b"
            style={{ borderColor: "#E2DDD5", color: `${FOREST}75` }}
          >
            {weightSurcharge > 0 ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>
                  Weight handling:{" "}
                </span>
                +{fmtPrice(weightSurcharge)} (from size / weight class)
              </p>
            ) : null}
            {truckBreakdown ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>
                  Vehicle:{" "}
                </span>
                {truckBreakdown}
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
        <p className="text-[12px] mt-1 mb-5" style={{ color: `${FOREST}70` }}>
          +{fmtPrice(tax)} HST · Total {fmtPrice(price + tax)}
        </p>
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
              <Check className="w-4 h-4" /> SELECTED
            </span>
          ) : isFullPayment ? (
            copy.confirmButtonLabel(fmtPrice(price + tax))
          ) : (
            copy.confirmButtonLabel(`${fmtPrice(deposit)} DEPOSIT`)
          )}
        </button>
        <p className="text-[10px] mt-2" style={{ color: `${FOREST}50` }}>
          {copy.paymentNote(isFullPayment)}
        </p>
      </div>
    </section>
  );
}

function SingleItemHeader({
  line,
  fallbackLabel,
  compact,
}: {
  line: SingleItemLine;
  fallbackLabel: string;
  compact?: boolean;
}) {
  const category = toTitleCase(line.item_category || "item").replace(/_/g, " ");
  const weight = line.weight_class || null;
  const qty = Math.max(1, Math.floor(line.quantity || 1));
  const description = line.item_description?.trim() || fallbackLabel;
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${FOREST}15`, color: FOREST }}
          >
            {category}
          </span>
          {weight && (
            <span
              className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${FOREST}10`, color: FOREST }}
            >
              {weight}
            </span>
          )}
          {qty > 1 && (
            <span
              className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${FOREST}10`, color: FOREST }}
            >
              ×{qty}
            </span>
          )}
        </div>
        <p
          className={
            compact
              ? "text-[13px] font-semibold"
              : "text-[var(--text-base)] font-semibold"
          }
          style={{ color: FOREST }}
        >
          {description}
        </p>
        {line.stair_carry && (
          <p className="text-[11px] mt-1" style={{ color: `${FOREST}60` }}>
            Stair carry · {line.stair_flights ?? 1} flight
            {(line.stair_flights ?? 1) === 1 ? "" : "s"}
          </p>
        )}
        {line.assembly && line.assembly.toLowerCase() !== "none" && (
          <p className="text-[11px] mt-1" style={{ color: `${FOREST}60` }}>
            {line.assembly} included.
          </p>
        )}
      </div>
    </div>
  );
}
