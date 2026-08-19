import { useState } from "react";
import {
  MapPin,
  ArrowRight,
  Check,
  ShieldCheck,
  Certificate,
  User,
  Plus,
  X,
} from "@phosphor-icons/react";
import {
  type Quote,
  type HighValueDeclaration,
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  QUOTE_EYEBROW_CLASS,
  TAX_RATE,
  fmtPrice,
} from "../quote-shared";
import { toTitleCase } from "@/lib/format-text";
import { getB2BDeliveryFeatureList } from "@/lib/quotes/b2b-quote-copy";
import {
  B2B_COI_LINE,
  B2B_COVERAGE_HEADLINE,
  B2B_TERMS_SHORT,
} from "@/lib/quotes/b2b-coverage-and-terms";

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
  /** High-value declarations array (drives Enhanced + Signature coverage). */
  declarations: HighValueDeclaration[];
  onDeclarationsChange: (next: HighValueDeclaration[]) => void;
  /** Current coverage cost (declaration fees), already reflected in the total. */
  coverageCost: number;
}

const ENHANCED_KEY = "Enhanced Protection";
const ENHANCED_MAX = 50000;
const ENHANCED_RATE = 0.015;
const ENHANCED_MIN = 150;

function enhancedFeeFor(value: number): number {
  const v = Math.min(ENHANCED_MAX, Math.max(0, Math.round(value)));
  return v > 0 ? Math.max(ENHANCED_MIN, Math.round(v * ENHANCED_RATE)) : 0;
}

export default function B2BOneOffLayout({
  quote,
  onConfirm,
  onPayInFull,
  confirmed,
  branding,
  declarations,
  onDeclarationsChange,
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

  // ── Selectable coverage (drives the existing declarations flow) ──
  const enhancedDecl =
    declarations.find((d) => d.item_name.startsWith(ENHANCED_KEY)) ?? null;
  const signatureDecls = declarations.filter(
    (d) => !d.item_name.startsWith(ENHANCED_KEY),
  );
  const [enhancedInput, setEnhancedInput] = useState<string>(
    enhancedDecl ? String(enhancedDecl.declared_value) : "",
  );
  const [sigName, setSigName] = useState("");
  const [sigVal, setSigVal] = useState("");
  const enhancedInputNum = Math.round(Number(enhancedInput) || 0);
  const enhancedPreviewFee = enhancedFeeFor(enhancedInputNum);

  const applyEnhanced = () => {
    const v = Math.min(ENHANCED_MAX, enhancedInputNum);
    const others = declarations.filter(
      (d) => !d.item_name.startsWith(ENHANCED_KEY),
    );
    if (v > 0) {
      onDeclarationsChange([
        ...others,
        {
          item_name: `${ENHANCED_KEY} (declared value ${fmtPrice(v)})`,
          declared_value: v,
          fee: enhancedFeeFor(v),
        },
      ]);
    } else {
      onDeclarationsChange(others);
    }
  };
  const removeEnhanced = () => {
    onDeclarationsChange(
      declarations.filter((d) => !d.item_name.startsWith(ENHANCED_KEY)),
    );
    setEnhancedInput("");
  };
  const addSignature = () => {
    const v = Math.round(Number(sigVal) || 0);
    const name = sigName.trim();
    if (!name || v <= 0) return;
    onDeclarationsChange([
      ...declarations,
      { item_name: name, declared_value: v, fee: 0 },
    ]);
    setSigName("");
    setSigVal("");
  };
  const removeSignature = (idx: number) => {
    const target = signatureDecls[idx];
    if (!target) return;
    onDeclarationsChange(declarations.filter((d) => d !== target));
  };

  const displayPrice = price + coverageCost;
  const displayTax = Math.round(displayPrice * TAX_RATE);
  const displayTotal = displayPrice + displayTax;
  const inputCls =
    "w-full rounded-lg border px-3 py-2 text-[13px] outline-none";
  const inputStyle = { borderColor: `${FOREST}30`, color: FOREST } as const;

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
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${FOREST}12` }}
              >
                <User className="w-4 h-4" style={{ color: FOREST }} weight="fill" />
              </div>
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
            <li key={i} className="flex items-start gap-2.5">
              <Check
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: FOREST }}
                weight="bold"
              />
              <span className="text-[12.5px] leading-snug" style={{ color: FOREST_BODY }}>
                {toTitleCase(line)}
              </span>
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
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: WINE }} />
                <div className="min-w-0">
                  <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
                    Pickup
                  </p>
                  <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                    {quote.from_address}
                  </p>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" style={{ color: FOREST }} />
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-start gap-2 justify-end">
                <div className="min-w-0">
                  <p className={eyebrow()} style={{ color: FOREST_MUTED }}>
                    Delivery
                  </p>
                  <p className="text-[12px] font-medium" style={{ color: FOREST }}>
                    {quote.to_address}
                  </p>
                </div>
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FOREST }} />
              </div>
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

      {/* ── Yugo Asset Protection ── */}
      <div
        className="rounded-2xl border px-5 py-6 sm:px-6"
        style={{ borderColor: `${FOREST}22`, backgroundColor: `${FOREST}06` }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: FOREST }} weight="fill" />
          <p className="font-hero text-[17px]" style={{ color: WINE }}>
            Yugo Asset Protection
          </p>
        </div>
        <p
          className="text-[12.5px] leading-relaxed mb-5 max-w-2xl"
          style={{ color: FOREST_BODY }}
        >
          {B2B_COVERAGE_HEADLINE}
        </p>
        <div className="space-y-3">
          {/* Standard — included */}
          <div className="rounded-xl border px-4 py-4" style={{ borderColor: FOREST, backgroundColor: `${FOREST}0A` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold" style={{ color: FOREST }}>Standard Protection</p>
              <span className="text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full" style={{ color: "#FFFCF9", backgroundColor: FOREST }}>Included</span>
            </div>
            <p className="text-[11.5px] mt-1 leading-snug" style={{ color: FOREST_BODY }}>
              Repair or restoration of damaged items up to $30,000 per shipment, backed by our $5M commercial general liability. Real coverage, not $0.60-a-pound courier liability.
            </p>
          </div>

          {/* Enhanced — selectable */}
          <div className="rounded-xl border px-4 py-4" style={{ borderColor: enhancedDecl ? FOREST : `${FOREST}20`, backgroundColor: enhancedDecl ? `${FOREST}0A` : "#FFFCF9" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold" style={{ color: FOREST }}>Enhanced Protection</p>
              <span className="text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full" style={{ color: FOREST, backgroundColor: `${FOREST}14` }}>Full replacement</span>
            </div>
            <p className="text-[11.5px] mt-1 leading-snug" style={{ color: FOREST_BODY }}>
              Full replacement value to $50,000, $0 deductible. Declare your shipment value and we cover every dollar of it.
            </p>
            {enhancedDecl ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: `${FOREST}0C` }}>
                <div className="text-[12px]" style={{ color: FOREST }}>
                  <span className="font-semibold">Added</span> &middot; declared {fmtPrice(enhancedDecl.declared_value)} &middot; <span className="font-semibold">+{fmtPrice(enhancedDecl.fee)}</span>
                </div>
                <button type="button" onClick={removeEnhanced} className="text-[11px] font-semibold underline shrink-0" style={{ color: FOREST_MUTED }}>Remove</button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <label className="text-[10px] block mb-1" style={{ color: FOREST_MUTED }}>Declared shipment value (up to $50,000)</label>
                  <input type="number" inputMode="numeric" min={0} max={ENHANCED_MAX} value={enhancedInput} onChange={(e) => setEnhancedInput(e.target.value)} placeholder="e.g. 25000" className={inputCls} style={inputStyle} />
                </div>
                <button type="button" onClick={applyEnhanced} disabled={enhancedInputNum <= 0} className="shrink-0 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition-opacity disabled:opacity-40" style={{ backgroundColor: FOREST }}>
                  Add{enhancedPreviewFee > 0 ? ` · ${fmtPrice(enhancedPreviewFee)}` : ""}
                </button>
              </div>
            )}
            <p className="text-[10px] mt-2" style={{ color: `${FOREST}90` }}>Priced at 1.5% of declared value, $150 minimum.</p>
          </div>

          {/* Signature — declare high-value pieces */}
          <div className="rounded-xl border px-4 py-4" style={{ borderColor: `${FOREST}20`, backgroundColor: "#FFFCF9" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold" style={{ color: FOREST }}>Signature Protection</p>
              <span className="text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full" style={{ color: FOREST, backgroundColor: `${FOREST}14` }}>Quoted per item</span>
            </div>
            <p className="text-[11.5px] mt-1 leading-snug" style={{ color: FOREST_BODY }}>
              Fine art and bespoke pieces above $50,000, scheduled individually and covered nail to nail. Declare a piece and we schedule and quote it for you.
            </p>
            {signatureDecls.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {signatureDecls.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: `${FOREST}0C`, color: FOREST }}>
                    <span className="min-w-0 truncate"><span className="font-semibold">{d.item_name}</span> &middot; {fmtPrice(d.declared_value)} &middot; <span style={{ color: FOREST_MUTED }}>quoted separately</span></span>
                    <button type="button" onClick={() => removeSignature(i)} aria-label="Remove" className="shrink-0"><X className="w-3.5 h-3.5" style={{ color: FOREST_MUTED }} /></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label className="text-[10px] block mb-1" style={{ color: FOREST_MUTED }}>Piece</label>
                <input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="e.g. Commissioned canvas" className={inputCls} style={inputStyle} />
              </div>
              <div className="sm:w-32">
                <label className="text-[10px] block mb-1" style={{ color: FOREST_MUTED }}>Value</label>
                <input type="number" inputMode="numeric" min={0} value={sigVal} onChange={(e) => setSigVal(e.target.value)} placeholder="60000" className={inputCls} style={inputStyle} />
              </div>
              <button type="button" onClick={addSignature} className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ backgroundColor: `${FOREST}14`, color: FOREST }}>
                <Plus className="w-3.5 h-3.5" /> Declare
              </button>
            </div>
          </div>
        </div>
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ backgroundColor: `${FOREST}0C` }}
        >
          <Certificate className="w-4 h-4 shrink-0 mt-0.5" style={{ color: FOREST }} weight="fill" />
          <p className="text-[11.5px] leading-snug" style={{ color: FOREST_BODY }}>
            {B2B_COI_LINE}
          </p>
        </div>
      </div>

      {/* ── Price + CTA ── */}
      <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
        {coverageCost > 0 ? (
          <div className="text-left text-[12px] max-w-xs mx-auto mb-4 pb-4 border-b" style={{ borderColor: "#E2DDD5", color: FOREST_BODY }}>
            <div className="flex justify-between py-0.5"><span>Delivery</span><span className="tabular-nums">{fmtPrice(price)}</span></div>
            <div className="flex justify-between py-0.5"><span>Enhanced coverage</span><span className="tabular-nums">+{fmtPrice(coverageCost)}</span></div>
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
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Confirmed
            </span>
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
