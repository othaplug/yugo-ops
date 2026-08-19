import type { ReactNode } from "react";
import {
  type Quote,
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  TAX_RATE,
  fmtPrice,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";
import { getB2BDeliveryFeatureList } from "@/lib/quotes/b2b-quote-copy";
import { B2B_TERMS_SHORT } from "@/lib/quotes/b2b-coverage-and-terms";

function friendlyFleetLine(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(vehicle|truck)\s*:\s*/i, "").trim();
  s = s.replace(/^truck\s*:\s*/i, "").trim();
  return s || raw.trim();
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(String(v).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Props {
  quote: Quote;
  onConfirm: () => void;
  onPayInFull?: () => void;
  confirmed: boolean;
  branding: {
    companyLegal: string;
    brand: string;
    email: string;
    address: string;
    hstNumber: string;
  };
  /** The shared "Your Protection" card, rendered above the price. */
  protectionSlot?: ReactNode;
  /** Current coverage cost (from the selected rider), reflected in the total. */
  coverageCost: number;
}

export default function B2BOneOffLayout({
  quote,
  onConfirm,
  onPayInFull,
  confirmed,
  branding,
  protectionSlot,
  coverageCost,
}: Props) {
  const f = quote.factors_applied as Record<string, unknown> | null;
  const price = quote.custom_price ?? 0;
  const str = (k: string): string =>
    typeof f?.[k] === "string" ? (f[k] as string).trim() : "";
  const bool = (k: string): boolean => f?.[k] === true;

  const payInvoice = f?.b2b_payment_method === "invoice"; // Net-30 partner account only
  const businessName = str("b2b_business_name");
  const deliverToName = (quote as { deliver_to_name?: string | null })
    .deliver_to_name;
  const attn = typeof deliverToName === "string" ? deliverToName.trim() : "";
  const coordinator = str("coordinator_name");
  const verticalName = str("b2b_vertical_name") || str("item_description");
  const verticalCode = str("b2b_vertical_code") || null;
  const handlingType = str("b2b_handling_type") || null;
  const scope = str("b2b_scope"); // admin-authored, auto-drafted
  const crewSize =
    typeof f?.b2b_crew === "number"
      ? (f.b2b_crew as number)
      : typeof f?.specialty_crew_size === "number"
        ? (f.specialty_crew_size as number)
        : 2;
  const lineItems = Array.isArray(f?.b2b_line_items)
    ? (f.b2b_line_items as {
        description?: string;
        quantity?: number;
        fragile?: boolean;
      }[])
    : [];
  const truckBreakdown = str("truck_breakdown_line");
  const handlingLabel = handlingType ? handlingType.replace(/_/g, " ") : "";

  const includes = getB2BDeliveryFeatureList(
    verticalCode,
    crewSize,
    verticalName || null,
    handlingType,
    {
      assemblyRequired: bool("b2b_assembly_required"),
      debrisRemoval: bool("b2b_debris_removal"),
    },
  );

  const eyebrow = (extra = "") =>
    `text-[10px] font-bold tracking-[0.14em] uppercase ${extra}`;

  const displayPrice = price + coverageCost;
  const displayTax = Math.round(displayPrice * TAX_RATE);
  const displayTotal = displayPrice + displayTax;

  return (
    <section className="mb-10 space-y-5">
      {/* ── Letterhead: who it is for, who it is from ── */}
      <div
        className="rounded-2xl border px-5 py-5 sm:px-6"
        style={{ borderColor: `${FOREST}22`, backgroundColor: "#FFFCF9" }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
              Prepared for
            </p>
            <p
              className="font-hero text-[20px] leading-tight mt-1"
              style={{ color: WINE }}
            >
              {businessName || attn || "Your Business"}
            </p>
            {attn && businessName ? (
              <p className="text-[12px] mt-0.5" style={{ color: FOREST_BODY }}>
                Attention: {attn}
              </p>
            ) : null}
          </div>
          <div className="sm:text-right shrink-0">
            <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
              Delivery quote
            </p>
            <p
              className="font-hero text-[18px] mt-1"
              style={{ color: FOREST }}
            >
              {quote.quote_id}
            </p>
            {quote.expires_at ? (
              <p className="text-[11px] mt-0.5" style={{ color: `${FOREST}A0` }}>
                Valid until {fmtDate(quote.expires_at)}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="mt-4 pt-4 border-t flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
          style={{ borderColor: `${FOREST}15` }}
        >
          <div className="text-[11px] leading-relaxed" style={{ color: `${FOREST}B0` }}>
            <span className="font-semibold" style={{ color: FOREST }}>
              {branding.companyLegal}
            </span>
            {branding.address ? <> &middot; {branding.address}</> : null}
            {branding.hstNumber ? (
              <>
                <br />
                HST {branding.hstNumber}
              </>
            ) : null}
          </div>
          {coordinator ? (
            <div>
              <div className="leading-tight">
                <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
                  Your coordinator
                </p>
                <p className="text-[12.5px] font-semibold" style={{ color: FOREST }}>
                  {coordinator}
                  {branding.email ? (
                    <span className="font-normal" style={{ color: `${FOREST}90` }}>
                      {" "}
                      &middot; {branding.email}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Scope of work ── */}
      {(scope || verticalName) && (
        <div
          className="rounded-2xl px-5 py-5 sm:px-6"
          style={{ backgroundColor: `${FOREST}06`, borderLeft: `2px solid ${FOREST}` }}
        >
          <p className={eyebrow("mb-2")} style={{ color: FOREST_MUTED }}>
            Scope of work
          </p>
          {scope ? (
            <p
              className="text-[13.5px] leading-relaxed"
              style={{ color: FOREST_BODY }}
            >
              {scope}
            </p>
          ) : (
            <p className="text-[13.5px] leading-relaxed" style={{ color: FOREST_BODY }}>
              {verticalName}
              {handlingLabel ? `, ${toTitleCase(handlingLabel)} handling` : ""}, delivered
              end to end by a dedicated Yugo crew.
            </p>
          )}
        </div>
      )}

      {/* ── What's included ── */}
      <div
        className="rounded-2xl border px-5 py-5 sm:px-6"
        style={{ borderColor: `${FOREST}18`, backgroundColor: "#FFFCF9" }}
      >
        <p className={eyebrow("mb-4")} style={{ color: FOREST_MUTED }}>
          Your delivery includes
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {includes.map((line, i) => (
            <li
              key={i}
              className="text-[12.5px] leading-snug pl-3 border-l"
              style={{ color: FOREST_BODY, borderColor: `${FOREST}2E` }}
            >
              {toTitleCase(line)}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Items, handling, route, fleet ── */}
      <div
        className="rounded-2xl border px-5 py-5 sm:px-6"
        style={{ borderColor: `${FOREST}18`, backgroundColor: "#FFFCF9" }}
      >
        {lineItems.length > 0 ? (
          <>
            <p className={eyebrow("mb-3")} style={{ color: FOREST_MUTED }}>
              Line items
            </p>
            <ul className="divide-y" style={{ borderColor: `${FOREST}10` }}>
              {lineItems.map((row, i) => {
                const desc = String(row.description ?? "Item").trim() || "Item";
                const qty =
                  row.quantity != null && Number(row.quantity) > 0
                    ? Math.round(Number(row.quantity))
                    : null;
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-4 py-2.5 first:pt-0"
                    style={{ borderColor: `${FOREST}10` }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-[13px] font-medium leading-snug"
                        style={{ color: FOREST }}
                      >
                        {desc}
                      </p>
                      {row.fragile ? (
                        <span
                          className="mt-1 inline-block text-[9px] font-bold tracking-[0.12em] uppercase"
                          style={{ color: FOREST_MUTED }}
                        >
                          Fragile
                        </span>
                      ) : null}
                    </div>
                    {qty != null ? (
                      <span
                        className="text-[13px] font-semibold tabular-nums shrink-0"
                        style={{ color: FOREST }}
                      >
                        &times;{qty}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {handlingLabel ? (
          <div
            className={lineItems.length > 0 ? "mt-4 pt-4 border-t" : ""}
            style={{ borderColor: `${FOREST}12` }}
          >
            <p className={eyebrow("mb-1")} style={{ color: FOREST_MUTED }}>
              Handling
            </p>
            <p className="text-[13px] font-medium" style={{ color: FOREST_BODY }}>
              {toTitleCase(handlingLabel)}
            </p>
          </div>
        ) : null}

        <div
          className="mt-4 pt-4 border-t"
          style={{ borderColor: `${FOREST}12` }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
                Pickup
              </p>
              <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                {quote.from_address}
              </p>
            </div>
            <span className="shrink-0 text-[14px]" style={{ color: FOREST_MUTED }} aria-hidden>
              &rarr;
            </span>
            <div className="flex-1 min-w-0 text-right">
              <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
                Delivery
              </p>
              <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                {quote.to_address}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] font-medium" style={{ color: `${FOREST}B0` }}>
            {quote.distance_km != null ? (
              <span>
                {quote.distance_km} km
                {quote.drive_time_min ? ` · ~${quote.drive_time_min} min` : ""}
              </span>
            ) : null}
            {truckBreakdown ? (
              <span>
                {quote.distance_km != null ? "· " : ""}
                {toTitleCase(friendlyFleetLine(truckBreakdown))}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {protectionSlot}

      {/* ── Price + CTA ── */}
      <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
        {coverageCost > 0 ? (
          <div className="text-left text-[12px] max-w-xs mx-auto mb-4 pb-4 border-b" style={{ borderColor: "#E2DDD5", color: FOREST_BODY }}>
            <div className="flex justify-between py-0.5"><span>Delivery</span><span className="tabular-nums">{fmtPrice(price)}</span></div>
            <div className="flex justify-between py-0.5"><span>Added protection</span><span className="tabular-nums">+{fmtPrice(coverageCost)}</span></div>
          </div>
        ) : null}
        <p className="font-hero text-[36px] md:text-[42px]" style={{ color: WINE }}>
          {fmtPrice(displayPrice)}
        </p>
        <p className="text-[12px] mt-1 mb-5 font-medium" style={{ color: `${FOREST}C9` }}>
          +{fmtPrice(displayTax)} HST &middot; Total {fmtPrice(displayTotal)}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full max-w-xs mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold tracking-[0.12em] uppercase text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: FOREST, opacity: confirmed ? 0.8 : 1 }}
        >
          {confirmed ? (
            "Confirmed"
          ) : payInvoice ? (
            "Confirm booking"
          ) : (
            `Confirm delivery (${fmtPrice(displayTotal)})`
          )}
        </button>
        <p
          className="text-[10px] mt-2 font-medium leading-snug max-w-md mx-auto"
          style={{ color: `${FOREST}C4` }}
        >
          {payInvoice
            ? "Net 30 on your approved partner account. No card required at booking."
            : "Full payment at booking confirms your delivery."}
        </p>
      </div>

      {/* ── Short-form commercial terms ── */}
      <div className="px-1">
        <p className={eyebrow("mb-3")} style={{ color: FOREST_MUTED }}>
          Commercial terms
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {B2B_TERMS_SHORT.map((t, i) => (
            <div key={i}>
              <p className="text-[11.5px] font-semibold" style={{ color: FOREST }}>
                {t.title}
              </p>
              <p className="text-[11px] leading-snug mt-0.5" style={{ color: `${FOREST}A8` }}>
                {t.body}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] mt-4" style={{ color: `${FOREST}90` }}>
          Full{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: FOREST }}
          >
            Commercial Terms &amp; Conditions
          </a>{" "}
          govern this quote.
        </p>
      </div>
    </section>
  );
}
