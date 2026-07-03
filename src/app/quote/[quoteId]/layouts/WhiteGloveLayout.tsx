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
import { toTitleCase } from "@/lib/format-text";
import {
  WG_ASSEMBLY_OPTIONS,
  WG_ITEM_CATEGORIES,
  WG_WEIGHT_CLASS_OPTIONS,
} from "@/lib/quotes/white-glove-pricing";
import { decideBookingPayment } from "@/lib/quotes/booking-payment-window";
import {
  premiumShellInk,
  premiumShellRuleRgba,
  type PremiumShellKind,
} from "../quote-premium-shell";
import { SIGNATURE_CTA } from "../signature-quote-ui";

const WG_BUILDING_LABELS: Record<string, string> = {
  elevator_booking: "Elevator booking required",
  insurance_certificate: "Insurance certificate required",
  restricted_hours: "Restricted move hours",
  loading_dock_booking: "Loading dock booking required",
};

type WgDisplayRow = {
  description: string;
  quantity: number;
  categoryLabel: string;
  weightLabel: string;
  assemblyLabel: string | null;
  notes: string | null;
  fragile: boolean;
  highValue: boolean;
};

const wgRowHandlingCell = (row: WgDisplayRow): string => {
  const parts: string[] = [];
  if (row.assemblyLabel) parts.push(row.assemblyLabel);
  if (row.fragile) parts.push("Fragile handling");
  if (row.highValue) parts.push("High value");
  return parts.join(" · ");
};

const parseWgFactorRows = (
  f: Record<string, unknown> | null,
): WgDisplayRow[] => {
  if (!f) return [];
  const raw = f.white_glove_items;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: WgDisplayRow[] = [];
    for (const el of raw) {
      if (!el || typeof el !== "object") continue;
      const o = el as Record<string, unknown>;
      const description = String(o.description ?? "").trim();
      if (!description) continue;
      const cat = String(o.category ?? "medium").toLowerCase();
      const wc = String(o.weight_class ?? "50_150").toLowerCase();
      const asm = String(o.assembly ?? "none").toLowerCase();
      const categoryLabel =
        WG_ITEM_CATEGORIES.find((c) => c.value === cat)?.label ??
        toTitleCase(cat.replace(/_/g, " "));
      const weightLabel =
        WG_WEIGHT_CLASS_OPTIONS.find((w) => w.value === wc)?.label ??
        toTitleCase(wc.replace(/_/g, " "));
      const assemblyOpt = WG_ASSEMBLY_OPTIONS.find((a) => a.value === asm);
      const assemblyLabel =
        assemblyOpt && assemblyOpt.value !== "none" ? assemblyOpt.label : null;
      const qty = Math.max(1, Math.min(99, Number(o.quantity) || 1));
      const notesRaw = o.notes;
      const notes =
        typeof notesRaw === "string" && notesRaw.trim().length > 0
          ? notesRaw.trim()
          : null;
      out.push({
        description,
        quantity: qty,
        categoryLabel,
        weightLabel,
        assemblyLabel,
        notes,
        fragile: o.is_fragile === true,
        highValue: o.is_high_value === true,
      });
    }
    if (out.length > 0) return out;
  }

  const legacyDesc = String(f.item_description ?? "").trim();
  if (!legacyDesc) return [];
  const legacyCat = String(f.item_category ?? "premium item");
  return [
    {
      description: legacyDesc,
      quantity: 1,
      categoryLabel: toTitleCase(legacyCat.replace(/_/g, " ")),
      weightLabel:
        typeof f.weight_class === "string" && f.weight_class.trim()
          ? (WG_WEIGHT_CLASS_OPTIONS.find((w) => w.value === f.weight_class)
              ?.label ?? toTitleCase(f.weight_class.replace(/_/g, " ")))
          : "",
      assemblyLabel: null,
      notes: null,
      fragile: false,
      highValue: false,
    },
  ];
};

interface Props {
  quote: Quote;
  onConfirm: () => void;
  confirmed: boolean;
  /** Premium green (signature) shell, matching the residential premium flow. */
  premiumShellKind?: PremiumShellKind;
  /** "delivery" = item transport; "service" = move / in-home setup / project. */
  whiteGloveKind?: "delivery" | "service";
  /** Optional Your Protection card rendered above the price / review card. */
  protectionSlot?: React.ReactNode;
}

export default function WhiteGloveLayout({
  quote,
  onConfirm,
  confirmed,
  premiumShellKind = "none",
  whiteGloveKind = "delivery",
  protectionSlot,
}: Props) {
  const isService = whiteGloveKind === "service";
  /* ── Premium-shell palette (deep-green Signature) with cream fallback ── */
  const premium = premiumShellKind !== "none";
  const ink = premiumShellInk(premiumShellKind);
  const C = {
    heading: ink?.primary ?? FOREST,
    body: ink?.body ?? FOREST_BODY,
    strong: ink?.primary ?? FOREST,
    muted: ink?.muted ?? FOREST_MUTED,
    kicker: ink?.kicker ?? `${FOREST}70`,
    secondary: ink?.secondary ?? `${FOREST}75`,
    rule: premiumShellRuleRgba(premiumShellKind),
    panelBorder: ink?.borderSubtle ?? "#E2DDD5",
    panelBg: premium ? "rgba(244, 250, 245, 0.05)" : "rgba(255,255,255,0.8)",
    chipBg: premium ? "rgba(244, 250, 245, 0.08)" : `${FOREST}12`,
    chipText: ink?.primary ?? FOREST,
    priceColor: ink?.primary ?? WINE,
    ctaFill: premium ? SIGNATURE_CTA : FOREST,
  };

  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("white_glove", price);
  // Same booking-window rule as SingleItemLayout, bookings inside the
  // 48h cancellation window collect full payment up front to match the
  // non-refundable policy. See src/lib/quotes/booking-payment-window.ts.
  const wgBookingDecision = decideBookingPayment({
    moveDate: quote.move_date,
    deposit,
    grandTotal: price + tax,
  });
  const wgIsFullPayment = price < 500 || wgBookingDecision.requireFullPayment;
  const declaredValue = f?.declared_value as number | undefined;
  const weightSurcharge =
    typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0
      ? f.weight_surcharge
      : 0;
  const rows = parseWgFactorRows(f);
  const crewN =
    typeof quote.est_crew_size === "number" && quote.est_crew_size > 0
      ? quote.est_crew_size
      : null;

  const buildingReqs = Array.isArray(f?.specialty_building_requirements)
    ? (f!.specialty_building_requirements as string[])
    : [];
  const buildingNote =
    typeof f?.white_glove_building_requirements_note === "string" &&
    f.white_glove_building_requirements_note.trim().length > 0
      ? f.white_glove_building_requirements_note.trim()
      : null;
  const deliveryInstr =
    typeof f?.white_glove_delivery_instructions === "string" &&
    f.white_glove_delivery_instructions.trim().length > 0
      ? f.white_glove_delivery_instructions.trim()
      : null;

  return (
    <section className="mb-10 space-y-8 max-w-3xl mx-auto w-full">
      {/* Scope: quoted items */}
      <div>
        <div className="mb-4 text-center">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1.5"
            style={{ color: C.kicker }}
          >
            White glove
          </p>
          <h2
            className="font-hero text-2xl md:text-[1.7rem] mb-1"
            style={{ color: C.heading }}
          >
            {isService ? "Your service scope" : "Your delivery scope"}
          </h2>
          <p className="text-[12px]" style={{ color: C.muted }}>
            Items and handling included in this quote
          </p>
        </div>

        {rows.length === 0 ? (
          <p
            className="text-[13px] leading-relaxed text-center"
            style={{ color: C.body }}
          >
            Scope details will appear here once your coordinator finalizes line
            items. Questions? Reply to your quote email.
          </p>
        ) : (
          <div
            className="w-full overflow-x-auto rounded-lg border"
            style={{ borderColor: C.panelBorder, backgroundColor: C.panelBg }}
          >
            <table className="w-full min-w-[30rem] text-left text-[12px] border-collapse">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: C.rule,
                    backgroundColor: premium
                      ? "rgba(244, 250, 245, 0.04)"
                      : `${FOREST}08`,
                  }}
                >
                  <th
                    scope="col"
                    className="py-2.5 pl-3 pr-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: C.strong }}
                  >
                    Item
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 w-[3rem] text-center font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: C.strong }}
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: C.strong }}
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: C.strong }}
                  >
                    Weight
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 pr-3 pl-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: C.strong }}
                  >
                    Handling
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const handling = wgRowHandlingCell(row);
                  return (
                    <tr
                      key={`${idx}-${row.description.slice(0, 24)}`}
                      className={idx > 0 ? "border-t" : undefined}
                      style={idx > 0 ? { borderColor: C.rule } : undefined}
                    >
                      <th
                        scope="row"
                        className="py-2 pl-3 pr-2 align-top text-left font-semibold leading-snug"
                        style={{ color: C.strong }}
                      >
                        {row.description}
                        {row.notes ? (
                          <span
                            className="mt-1 block font-normal leading-snug"
                            style={{ color: C.secondary }}
                          >
                            {row.notes}
                          </span>
                        ) : null}
                      </th>
                      <td
                        className="py-2 px-2 align-top text-center tabular-nums font-semibold"
                        style={{ color: C.strong }}
                      >
                        {row.quantity}
                      </td>
                      <td
                        className="py-2 px-2 align-top leading-snug"
                        style={{ color: C.secondary }}
                      >
                        {row.categoryLabel}
                      </td>
                      <td
                        className="py-2 px-2 align-top leading-snug"
                        style={{ color: C.secondary }}
                      >
                        {row.weightLabel || ""}
                      </td>
                      <td
                        className="py-2 pr-3 pl-2 align-top leading-snug"
                        style={{ color: C.secondary }}
                      >
                        {handling || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {declaredValue != null && (
            <span
              className="text-[10px] font-bold tracking-wide px-3 py-1 rounded-full"
              style={{ backgroundColor: C.chipBg, color: C.chipText }}
            >
              Declared value: {fmtPrice(declaredValue)}
            </span>
          )}
          {f?.enhanced_insurance ? (
            <span
              className="text-[10px] font-bold tracking-wide px-3 py-1 rounded-full"
              style={{ backgroundColor: C.chipBg, color: C.chipText }}
            >
              Enhanced insurance
            </span>
          ) : null}
        </div>
      </div>

      {/* Route */}
      <div className="pt-6 border-t" style={{ borderColor: C.rule }}>
        <h2
          className="text-[13px] font-bold uppercase tracking-[0.14em] mb-3 text-center"
          style={{ color: C.kicker }}
        >
          Route
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="text-[9px] font-bold tracking-[0.14em] uppercase"
              style={{ color: C.muted }}
            >
              {isService ? "From" : "Pickup"}
            </p>
            <p
              className="text-[12px] font-medium break-words"
              style={{ color: C.strong }}
            >
              {(quote.from_address || "").trim() || "Provided on booking"}
            </p>
          </div>
          <p
            className="shrink-0 text-[9px] font-bold tracking-[0.14em] uppercase"
            style={{ color: C.muted }}
            aria-hidden
          >
            To
          </p>
          <div className="flex-1 min-w-0 text-right">
            <p
              className="text-[9px] font-bold tracking-[0.14em] uppercase"
              style={{ color: C.muted }}
            >
              {isService ? "To" : "Delivery"}
            </p>
            <p
              className="text-[12px] font-medium break-words"
              style={{ color: C.strong }}
            >
              {(quote.to_address || "").trim() || "Provided on booking"}
            </p>
          </div>
        </div>
        {quote.distance_km != null && (
          <p
            className="text-[10px] text-center mt-2"
            style={{ color: C.muted }}
          >
            {quote.distance_km} km
            {quote.drive_time_min ? ` · ~${quote.drive_time_min} min` : ""}
          </p>
        )}
        {crewN != null && (
          <p
            className="text-[12px] mt-3 leading-snug text-center"
            style={{ color: C.secondary }}
          >
            Planned crew: {crewN} white glove professional
            {crewN === 1 ? "" : "s"} (aligned with your inclusions).
          </p>
        )}
      </div>

      {(buildingReqs.length > 0 || buildingNote || deliveryInstr) && (
        <div className="pt-6 border-t space-y-3" style={{ borderColor: C.rule }}>
          <h2
            className="text-[13px] font-bold uppercase tracking-[0.14em] text-center"
            style={{ color: C.kicker }}
          >
            Site and delivery notes
          </h2>
          {buildingReqs.length > 0 ? (
            <ul className="list-none pl-0 space-y-1.5">
              {buildingReqs.map((key) => (
                <li
                  key={key}
                  className="text-[12px] leading-snug pl-3 relative"
                  style={{ color: C.strong }}
                >
                  <span
                    className="absolute left-0 top-[0.35em] w-1 h-1 rounded-full"
                    style={{ backgroundColor: C.kicker }}
                    aria-hidden
                  />
                  <span>
                    {WG_BUILDING_LABELS[key] ??
                      toTitleCase(key.replace(/_/g, " "))}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {buildingNote ? (
            <div>
              <p
                className="text-[10px] font-bold tracking-wide uppercase mb-1"
                style={{ color: C.muted }}
              >
                Building note
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: C.strong }}
              >
                {buildingNote}
              </p>
            </div>
          ) : null}
          {deliveryInstr ? (
            <div>
              <p
                className="text-[10px] font-bold tracking-wide uppercase mb-1"
                style={{ color: C.muted }}
              >
                Delivery instructions
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: C.strong }}
              >
                {deliveryInstr}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Photo documentation */}
      <div className="pt-6 border-t text-center" style={{ borderColor: C.rule }}>
        <p className="text-[13px] font-semibold" style={{ color: C.strong }}>
          Photo documentation
        </p>
        <p
          className="text-[11px] mt-1 max-w-sm mx-auto leading-relaxed"
          style={{ color: C.muted }}
        >
          {isService
            ? "Before and after photos of your items and setup for your records."
            : "Before and after photos at pickup and delivery for your records."}
        </p>
      </div>

      {/* Protection slot renders here (above the price card) so the client
          reviews coverage next to the price, not below the confirm CTA. */}
      {protectionSlot}

      {/* Price / review card */}
      <div
        className="rounded-2xl border p-6 md:p-8 text-center"
        style={{
          borderColor: premium ? C.panelBorder : FOREST,
          borderWidth: premium ? 1 : 2,
          backgroundColor: C.panelBg,
        }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.16em] uppercase mb-2"
          style={{ color: C.kicker }}
        >
          White glove service
        </p>
        {weightSurcharge > 0 ? (
          <div
            className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b max-w-md mx-auto"
            style={{ borderColor: C.rule, color: C.secondary }}
          >
            <p>
              <span className="font-semibold" style={{ color: C.strong }}>
                Weight handling:{" "}
              </span>
              +{fmtPrice(weightSurcharge)}
            </p>
          </div>
        ) : null}
        <p
          className="font-hero text-[40px] md:text-[48px] leading-none"
          style={{ color: C.priceColor }}
        >
          {fmtPrice(price)}
        </p>
        <p className="text-[12px] mt-2 mb-5" style={{ color: C.muted }}>
          +{fmtPrice(tax)} HST · Total {fmtPrice(price + tax)}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className={`w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90 ${
            confirmed ? "opacity-80" : ""
          }`}
          style={{ backgroundColor: C.ctaFill }}
        >
          {confirmed ? (
            "SELECTED"
          ) : wgIsFullPayment ? (
            `CONFIRM & CONTINUE · ${fmtPrice(price + tax)}`
          ) : (
            `CONFIRM & CONTINUE · ${fmtPrice(deposit)} DEPOSIT`
          )}
        </button>
        <p
          className="text-[10px] mt-2 leading-relaxed"
          style={{ color: C.muted }}
        >
          {wgIsFullPayment
            ? "Full payment is due now to confirm this service."
            : `Deposit due now to reserve your date. Remaining balance of ${fmtPrice(price + tax - deposit)} is due no later than 48 hours before your scheduled service.`}
        </p>
      </div>
    </section>
  );
}
