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
  WG_ASSEMBLY_OPTIONS,
  WG_ITEM_CATEGORIES,
  WG_WEIGHT_CLASS_OPTIONS,
} from "@/lib/quotes/white-glove-pricing";

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
}

export default function WhiteGloveLayout({
  quote,
  onConfirm,
  confirmed,
}: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const tax = Math.round(price * TAX_RATE);
  const deposit = calculateDeposit("white_glove", price);
  const declaredValue = f?.declared_value as number | undefined;
  const weightSurcharge =
    typeof f?.weight_surcharge === "number" && f.weight_surcharge > 0
      ? f.weight_surcharge
      : 0;
  const truckBreakdown: string | null = null;
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
    <section className="mb-10 space-y-8">
      {/* Scope: quoted items */}
      <div>
        <div className="mb-4">
          <h2 className="admin-section-h2 mb-0.5">Your delivery scope</h2>
          <p className="text-[11px]" style={{ color: `${FOREST}60` }}>
            Items and handling included in this quote
          </p>
        </div>

        {rows.length === 0 ? (
          <p
            className="text-[13px] leading-relaxed pl-1"
            style={{ color: `${FOREST}80` }}
          >
            Scope details will appear here once your coordinator finalizes line
            items. Questions? Reply to your quote email.
          </p>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border border-[var(--brd)]/40 bg-white/80">
            <table className="w-full min-w-[30rem] text-left text-[12px] border-collapse">
              <thead>
                <tr
                  className="border-b border-[#E2DDD5]"
                  style={{ backgroundColor: `${FOREST}08` }}
                >
                  <th
                    scope="col"
                    className="py-2.5 pl-3 pr-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: FOREST }}
                  >
                    Item
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 w-[3rem] text-center font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: FOREST }}
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: FOREST }}
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: FOREST }}
                  >
                    Weight
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 pr-3 pl-2 font-bold uppercase tracking-[0.08em] text-[10px]"
                    style={{ color: FOREST }}
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
                      className={
                        idx > 0 ? "border-t border-[#E2DDD5]" : undefined
                      }
                    >
                      <th
                        scope="row"
                        className="py-2 pl-3 pr-2 align-top text-left font-semibold leading-snug"
                        style={{ color: FOREST }}
                      >
                        {row.description}
                        {row.notes ? (
                          <span
                            className="mt-1 block font-normal leading-snug"
                            style={{ color: `${FOREST}72` }}
                          >
                            {row.notes}
                          </span>
                        ) : null}
                      </th>
                      <td
                        className="py-2 px-2 align-top text-center tabular-nums font-semibold"
                        style={{ color: FOREST }}
                      >
                        {row.quantity}
                      </td>
                      <td
                        className="py-2 px-2 align-top leading-snug"
                        style={{ color: `${FOREST}75` }}
                      >
                        {row.categoryLabel}
                      </td>
                      <td
                        className="py-2 px-2 align-top leading-snug"
                        style={{ color: `${FOREST}75` }}
                      >
                        {row.weightLabel || ""}
                      </td>
                      <td
                        className="py-2 pr-3 pl-2 align-top leading-snug"
                        style={{ color: `${FOREST}75` }}
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

        <div className="flex flex-wrap gap-2 mt-4">
          {declaredValue != null && (
            <span
              className="text-[10px] font-bold tracking-wide px-3 py-1 rounded-full"
              style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
            >
              Declared value: {fmtPrice(declaredValue)}
            </span>
          )}
          {f?.enhanced_insurance ? (
            <span
              className="text-[10px] font-bold tracking-wide px-3 py-1 rounded-full"
              style={{ backgroundColor: `${FOREST}10`, color: FOREST }}
            >
              Enhanced insurance
            </span>
          ) : null}
        </div>
      </div>

      {/* Route */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        <h2 className="admin-section-h2 mb-3">Route</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
              Pickup
            </p>
            <p
              className="text-[12px] font-medium break-words"
              style={{ color: FOREST }}
            >
              {(quote.from_address || "").trim() || "Provided on booking"}
            </p>
          </div>
          <p
            className="shrink-0 text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]"
            aria-hidden
          >
            To
          </p>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5C5853]">
              Delivery
            </p>
            <p
              className="text-[12px] font-medium break-words"
              style={{ color: FOREST }}
            >
              {(quote.to_address || "").trim() || "Provided on booking"}
            </p>
          </div>
        </div>
        {quote.distance_km != null && (
          <p
            className="text-[10px] text-center mt-2"
            style={{ color: `${FOREST}50` }}
          >
            {quote.distance_km} km
            {quote.drive_time_min ? ` · ~${quote.drive_time_min} min` : ""}
          </p>
        )}
        {crewN != null && (
          <p
            className="text-[12px] mt-3 leading-snug"
            style={{ color: `${FOREST}75` }}
          >
            Planned crew: {crewN} logistics professional{crewN === 1 ? "" : "s"}{" "}
            (aligned with your inclusions).
          </p>
        )}
      </div>

      {(buildingReqs.length > 0 || buildingNote || deliveryInstr) && (
        <div className="pt-6 border-t border-[var(--brd)]/30 space-y-3">
          <h2 className="admin-section-h2">Site and delivery notes</h2>
          {buildingReqs.length > 0 ? (
            <ul className="list-none pl-0 space-y-1.5">
              {buildingReqs.map((key) => (
                <li
                  key={key}
                  className="text-[12px] leading-snug pl-3 relative"
                  style={{ color: FOREST }}
                >
                  <span
                    className="absolute left-0 top-[0.35em] w-1 h-1 rounded-full"
                    style={{ backgroundColor: FOREST }}
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
                style={{ color: `${FOREST}55` }}
              >
                Building note
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: FOREST }}
              >
                {buildingNote}
              </p>
            </div>
          ) : null}
          {deliveryInstr ? (
            <div>
              <p
                className="text-[10px] font-bold tracking-wide uppercase mb-1"
                style={{ color: `${FOREST}55` }}
              >
                Delivery instructions
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: FOREST }}
              >
                {deliveryInstr}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Photo documentation */}
      <div className="pt-6 border-t border-[var(--brd)]/30 text-center">
        <p className="text-[13px] font-semibold" style={{ color: FOREST }}>
          Photo documentation
        </p>
        <p
          className="text-[11px] mt-1 max-w-sm mx-auto leading-relaxed"
          style={{ color: `${FOREST}60` }}
        >
          Before and after photos at pickup and delivery for your records.
        </p>
      </div>

      {/* Price card */}
      <div
        className="bg-white rounded-2xl border-2 shadow-sm p-6 md:p-8 text-center"
        style={{ borderColor: FOREST }}
      >
        <p
          className="text-[11px] font-semibold tracking-wider uppercase mb-2"
          style={{ color: FOREST }}
        >
          White glove service
        </p>
        {(weightSurcharge > 0 || truckBreakdown) && (
          <div
            className="text-left text-[11px] space-y-1 mb-4 pb-4 border-b max-w-md mx-auto"
            style={{ borderColor: "#E2DDD5", color: `${FOREST}75` }}
          >
            {weightSurcharge > 0 ? (
              <p>
                <span className="font-semibold" style={{ color: FOREST }}>
                  Weight handling:{" "}
                </span>
                +{fmtPrice(weightSurcharge)}
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
          className="text-[40px] md:text-[48px] [font-family:var(--font-body)]"
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
            "SELECTED"
          ) : price < 500 ? (
            `CONFIRM DELIVERY · ${fmtPrice(price + tax)}`
          ) : (
            `CONFIRM DELIVERY · ${fmtPrice(deposit)} DEPOSIT`
          )}
        </button>
        <p
          className="text-[10px] mt-2 leading-relaxed"
          style={{ color: `${FOREST}50` }}
        >
          {price < 500
            ? "Full payment is due no later than 48 hours before your scheduled delivery."
            : `Deposit due now to reserve your date. Remaining balance of ${fmtPrice(price + tax - deposit)} is due no later than 48 hours before your scheduled delivery.`}
        </p>
      </div>
    </section>
  );
}
