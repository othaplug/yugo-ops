"use client";

import React, { useState, useRef } from "react";
import { Check, CaretDown as ChevronDown, CaretUp as ChevronUp } from "@phosphor-icons/react";
import { isClientLogisticsDeliveryServiceType } from "@/lib/quotes/b2b-quote-copy";
import {
  agreementCheckboxLabel,
  agreementDocumentTitle,
  buildBinRentalAgreementSections,
  buildNonBinAgreementSections,
} from "@/lib/contracts/agreement-terms";
import {
  WINE,
  FOREST,
  CREAM,
  FOREST_BODY,
  FOREST_MUTED,
  QUOTE_EYEBROW_CLASS,
  QUOTE_SECTION_H2_CLASS,
} from "@/app/quote/[quoteId]/quote-shared";
import { ESTATE_ON_WINE, ESTATE_ROSE } from "@/app/quote/[quoteId]/estate-quote-ui";

/** Nested under the quote step h2 (e.g. “Review & book”) — not a second section heading */
const AGREEMENT_DOC_TITLE_CLASS =
  "font-hero text-xl md:text-[1.5rem] leading-snug tracking-tight";

/* ── Types ── */

export interface ContractAddon {
  name: string;
  price: number;
  quantity?: number;
}

export interface ContractQuoteData {
  quoteId: string;
  serviceType: string;
  packageLabel: string;
  fromAddress: string;
  toAddress: string;
  fromAccess: string | null;
  toAccess: string | null;
  moveDate: string | null;
  preferredTime: string | null;
  /** Resolved for display: coordinator `arrival_window`, else `preferred_time`. */
  arrivalTimeWindow: string | null;
  moveSize: string | null;
  distanceKm: number | null;
  driveTimeMin: number | null;
  basePrice: number;
  addons: ContractAddon[];
  addonTotal: number;
  totalBeforeTax: number;
  tax: number;
  grandTotal: number;
  deposit: number;
  /** Multi-event: show each leg instead of a single From/To pair */
  eventLegs?: {
    label: string;
    fromAddress: string;
    toAddress: string;
    deliveryDate: string;
    returnDate: string;
  }[];
  /** Bin rental: delivery / move reference / pickup schedule (not a origin→destination move). */
  binRentalSchedule?: {
    deliveryDate: string | null;
    deliveryAddress: string;
    moveDate: string | null;
    pickupDate: string | null;
    pickupAddress: string;
    cycleDays: number;
  };
  /** Multiple pickups (optional); when more than one stop, replaces single From card. */
  pickupStops?: { address: string; accessLine: string | null }[];
  dropoffStops?: { address: string; accessLine: string | null }[];
  /** B2B quote settled on Net invoice — no card deposit in this flow */
  b2bNet30Invoice?: boolean;
  /** Residential tier when `serviceType` is `local_move` (tailors agreement copy). */
  residentialTier?: string | null;
}

interface Props {
  quoteData: ContractQuoteData;
  companyLegalName: string;
  companyDisplayName: string;
  onSigned: (data: { typed_name: string; signed_at: string; pdf_url?: string }) => void;
  onContractStarted?: () => void;
  /**
   * Residential Estate flow only: page shell is wine; use ESTATE_ON_WINE + rose CTA.
   * All other quote types / tiers sit on cream — omit or false for forest/wine-on-cream contrast.
   */
  estateAgreementChrome?: boolean;
}

/* ── Cancellation policies by service type ── */

const CANCELLATION_POLICY: Record<string, string> = {
  local_move:
    "Full refund if cancelled 48 or more hours before your scheduled move date. Cancellations within 48 hours: deposit is non-refundable.",
  long_distance:
    "Full refund if cancelled 72 or more hours before your scheduled move date. Cancellations within 72 hours: deposit is non-refundable.",
  office_move:
    "Full refund if cancelled 72 or more hours before your scheduled relocation date. Cancellations within 72 hours: deposit is non-refundable.",
  single_item:
    "Full refund if cancelled 24 or more hours before your scheduled delivery. Cancellations within 24 hours: deposit is non-refundable.",
  white_glove:
    "Full refund if cancelled 48 or more hours before your scheduled delivery. Cancellations within 48 hours: deposit is non-refundable.",
  specialty:
    "Full refund if cancelled 72 or more hours before your scheduled date. Custom crating materials, if already ordered, are non-refundable regardless of cancellation timing.",
  b2b_oneoff:
    "Full refund if cancelled 24 or more hours before your scheduled delivery. Cancellations within 24 hours: amount paid is non-refundable.",
  b2b_delivery:
    "Full refund if cancelled 24 or more hours before your scheduled delivery. Cancellations within 24 hours: amount paid is non-refundable.",
  event:
    "Full refund if cancelled 72 or more hours before your first scheduled delivery date. Cancellations within 72 hours: deposit is non-refundable.",
  labour_only:
    "Full refund if cancelled 48 or more hours before your scheduled service. Cancellations within 48 hours: deposit is non-refundable.",
  bin_rental:
    "Full refund if cancelled 48 or more hours before your scheduled bin delivery date. Cancellations within 48 hours of delivery, or after bins have been dispatched or delivered: fees may apply as set out in your quote.",
};

const BALANCE_DUE: Record<string, string> = {
  local_move: "48 hours before your move date",
  long_distance: "before departure date",
  office_move: "per agreed phasing schedule",
  single_item: "upon delivery",
  white_glove: "upon delivery",
  specialty: "upon project completion",
  b2b_oneoff: "upon delivery",
  b2b_delivery: "upon delivery",
  event: "before final return date per quote",
  labour_only: "before service date",
  bin_rental: "included in the amount due at booking (full payment)",
};

/** Agreement card title + subtitle (client-facing). */
const AGREEMENT_HEADER: Record<string, { title: string; subtitle: string }> = {
  local_move: {
    title: "Residential Move Agreement",
    subtitle: "Please review and sign to continue—your move is reserved once payment is complete.",
  },
  long_distance: {
    title: "Long Distance Move Agreement",
    subtitle: "Please review and sign to continue—we will hold your dates once payment is complete.",
  },
  office_move: {
    title: "Office Relocation Agreement",
    subtitle: "Please review and sign to continue your relocation on the terms we quoted.",
  },
  single_item: {
    title: "Delivery Service Agreement",
    subtitle: "Please review and sign to confirm this delivery.",
  },
  white_glove: {
    title: "White Glove Delivery Agreement",
    subtitle: "Please review and sign—white-glove service begins once you confirm below.",
  },
  specialty: {
    title: "Specialty Service Agreement",
    subtitle: "Please review and sign to confirm this specialty engagement.",
  },
  b2b_oneoff: {
    title: "Commercial Delivery Agreement",
    subtitle: "Please review and sign to confirm this delivery on the terms quoted.",
  },
  b2b_delivery: {
    title: "Commercial Delivery Agreement",
    subtitle: "Please review and sign to confirm this delivery on the terms quoted.",
  },
  event: {
    title: "Event Logistics Agreement",
    subtitle: "Please review and sign—we will hold your logistics window once you confirm.",
  },
  labour_only: {
    title: "Labour Service Agreement",
    subtitle: "Please review and sign to confirm your on-site crew booking.",
  },
  bin_rental: {
    title: "Bin Rental Agreement",
    subtitle: "Please review and sign—your bin delivery is confirmed once you complete payment.",
  },
};

function fmtPrice(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function ContractSign({
  quoteData,
  companyLegalName,
  companyDisplayName,
  onSigned,
  onContractStarted,
  estateAgreementChrome = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contractStartedRef = useRef(false);

  const q = quoteData;
  const canSign = typedName.trim().length >= 2 && agreed && !signing && !signed;
  const balance = q.grandTotal - q.deposit;
  const cancellation = CANCELLATION_POLICY[q.serviceType] ?? CANCELLATION_POLICY.local_move;
  const balanceDue = BALANCE_DUE[q.serviceType] ?? "before service date";
  const isBinRental = q.serviceType === "bin_rental";
  const isB2BDelivery = q.serviceType === "b2b_oneoff" || q.serviceType === "b2b_delivery";
  const isLogisticsDeliveryCopy = isClientLogisticsDeliveryServiceType(q.serviceType);
  const br = q.binRentalSchedule;
  const b2bNet30Invoice = Boolean(q.b2bNet30Invoice);
  const paidInFullAtBooking =
    !b2bNet30Invoice && q.grandTotal > 0 && balance <= 0.005;
  const agreementMeta =
    AGREEMENT_HEADER[q.serviceType] ??
    (isClientLogisticsDeliveryServiceType(q.serviceType)
      ? {
          title: "Delivery Service Agreement",
          subtitle: "Please review and sign to confirm this delivery.",
        }
      : {
          title: "Service Agreement",
          subtitle: "Please review and sign to continue on the terms we quoted.",
        });
  const agreementHeader = {
    title: agreementDocumentTitle(q.serviceType, q.residentialTier),
    subtitle:
      q.serviceType === "local_move" && q.residentialTier === "estate"
        ? "Your Estate experience is outlined below—please review and sign to reserve your date."
        : q.serviceType === "local_move" && q.residentialTier === "signature"
          ? "Your Signature move is outlined below—please review and sign to continue."
          : q.serviceType === "local_move" && q.residentialTier === "essential"
            ? "Your Essential move is outlined below—please review and sign to continue."
            : agreementMeta.subtitle,
  };
  const agreementSignLabel = agreementCheckboxLabel(q.serviceType, q.residentialTier);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTypedName(e.target.value);
    if (!contractStartedRef.current && e.target.value.length === 1) {
      contractStartedRef.current = true;
      onContractStarted?.();
    }
  };

  const handleSign = async () => {
    if (!canSign) return;
    setSigning(true);
    setError(null);

    try {
      const res = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: q.quoteId,
          typed_name: typedName.trim(),
          agreement_version: "1.3",
          user_agent: navigator.userAgent,
          contract_data: {
            service_type: q.serviceType,
            residential_tier: q.residentialTier ?? null,
            package_label: q.packageLabel,
            b2b_net30_invoice: b2bNet30Invoice,
            paid_in_full_at_booking: paidInFullAtBooking,
            from_address: q.fromAddress,
            to_address: q.toAddress,
            move_date: q.moveDate,
            base_price: q.basePrice,
            addons: q.addons,
            addon_total: q.addonTotal,
            total_before_tax: q.totalBeforeTax,
            tax: q.tax,
            grand_total: q.grandTotal,
            deposit: q.deposit,
            ...(br
              ? {
                  bin_rental_schedule: {
                    delivery_date: br.deliveryDate,
                    delivery_address: br.deliveryAddress,
                    move_date: br.moveDate,
                    pickup_date: br.pickupDate,
                    pickup_address: br.pickupAddress,
                    cycle_days: br.cycleDays,
                  },
                }
              : {}),
            ...(q.pickupStops && q.pickupStops.length > 1
              ? {
                  pickup_stops: q.pickupStops.map((s) => ({
                    address: s.address,
                    access_line: s.accessLine,
                  })),
                }
              : {}),
            ...(q.dropoffStops && q.dropoffStops.length > 1
              ? {
                  dropoff_stops: q.dropoffStops.map((s) => ({
                    address: s.address,
                    access_line: s.accessLine,
                  })),
                }
              : {}),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to process signature. Please try again.");
        setSigning(false);
        return;
      }

      setSigned(true);
      setSignedAt(data.signed_at);
      onSigned({
        typed_name: typedName.trim(),
        signed_at: data.signed_at,
        pdf_url: data.pdf_url,
      });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  const onWineShell = estateAgreementChrome;

  /* ── Signed confirmation state ── */
  if (signed) {
    const sInk = onWineShell ? ESTATE_ON_WINE.primary : WINE;
    const sBody = onWineShell ? ESTATE_ON_WINE.body : FOREST_BODY;
    const sCheck = onWineShell ? ESTATE_ON_WINE.kicker : FOREST;
    const sRule = onWineShell ? ESTATE_ON_WINE.hairline : `${FOREST}10`;
    return (
      <div className="pt-1">
        <div className="flex items-start gap-3 pb-5">
          <Check className="w-6 h-6 shrink-0 mt-0.5" style={{ color: sCheck }} weight="bold" aria-hidden />
          <div className="min-w-0">
            <h3 className={AGREEMENT_DOC_TITLE_CLASS} style={{ color: sInk }}>
              You&apos;re all set
            </h3>
            <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: sBody }}>
              Agreement signed by <b>{typedName}</b>
              {signedAt && (
                <>
                  {" "}on{" "}
                  {new Date(signedAt).toLocaleDateString("en-CA", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(signedAt).toLocaleTimeString("en-CA", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </>
              )}
            </p>
          </div>
        </div>
        <hr className="border-0 h-px w-full" style={{ backgroundColor: sRule }} />
      </div>
    );
  }

  /** Section heading on the quote page (“Reserve Your Date”) replaces the inner agreement title. */
  const hideAgreementTitleBlock = true;

  const agreementTheme = onWineShell
    ? {
        receiptClass:
          "rounded-none border-0 bg-transparent py-5 px-4 sm:px-6 shadow-none text-[12px]",
        signatureClass:
          "rounded-none border-0 bg-transparent px-4 py-6 sm:px-6 shadow-none space-y-4 text-[12px]",
        accentBar: ESTATE_ROSE,
        sectionEyebrow: ESTATE_ON_WINE.kicker,
        ink: ESTATE_ON_WINE.primary,
        inkBody: ESTATE_ON_WINE.body,
        inkMuted: ESTATE_ON_WINE.muted,
        borderHair: ESTATE_ON_WINE.hairline,
        addonRail: ESTATE_ON_WINE.borderSubtle,
        totalMoney: ESTATE_ON_WINE.primary,
        toggle: ESTATE_ON_WINE.kicker,
        signEyebrow: ESTATE_ON_WINE.kicker,
        signBody: ESTATE_ON_WINE.body,
        signLabel: ESTATE_ON_WINE.muted,
        signDate: ESTATE_ON_WINE.muted,
        signCta: ESTATE_ROSE,
        signCtaDisabled: "rgba(102,20,61,0.42)",
        focusRingOffsetClass: "peer-focus-visible:ring-offset-[#2B0416]",
        legalFooter: ESTATE_ON_WINE.muted,
      }
    : {
        receiptClass:
          "rounded-none border-0 bg-transparent py-5 px-4 sm:px-6 shadow-none text-[12px]",
        signatureClass:
          "rounded-none border-0 bg-transparent px-4 py-6 sm:px-6 shadow-none space-y-4 text-[12px]",
        accentBar: WINE,
        sectionEyebrow: FOREST,
        ink: WINE,
        inkBody: FOREST_BODY,
        inkMuted: FOREST_MUTED,
        borderHair: `${FOREST}22`,
        addonRail: `${FOREST}20`,
        totalMoney: WINE,
        toggle: FOREST,
        signEyebrow: FOREST,
        signBody: FOREST_BODY,
        signLabel: FOREST_MUTED,
        signDate: FOREST_MUTED,
        signCta: FOREST,
        signCtaDisabled: "rgba(44,62,45,0.38)",
        focusRingOffsetClass: "peer-focus-visible:ring-offset-[#FAF7F2]",
        legalFooter: FOREST_MUTED,
      };

  const agreementSections = (isBinRental
    ? buildBinRentalAgreementSections({
        companyLegalName,
        companyDisplayName,
        fmtPrice,
        grandTotal: q.grandTotal,
        cancellation,
        cycleDays: br?.cycleDays ?? 12,
        hasScheduleDetails: Boolean(br),
      })
    : buildNonBinAgreementSections({
        serviceType: q.serviceType,
        packageLabel: q.packageLabel,
        residentialTier: q.residentialTier,
        companyLegalName,
        companyDisplayName,
        isLogisticsDelivery: isLogisticsDeliveryCopy,
        b2bNet30Invoice,
        paidInFullAtBooking,
        fmtPrice,
        grandTotal: q.grandTotal,
        deposit: q.deposit,
        balance,
        balanceDue,
        cancellation,
      })
  ).map((section, idx) => (
    <div key={idx}>
      <h3 className="font-bold text-[12px] mb-1 uppercase tracking-wider">{section.title}</h3>
      <p className="whitespace-pre-line">{section.body}</p>
    </div>
  ));

  const fullTermsScrollPanel = (
    <div
      className="p-4 rounded-none text-[11px] leading-relaxed space-y-4 max-h-[50vh] overflow-y-auto border"
      style={{ backgroundColor: CREAM, color: FOREST, borderColor: `${FOREST}15` }}
    >
      {agreementSections}
      <div className="pt-2 border-t" style={{ borderColor: `${FOREST}12` }}>
        <p className="text-[11px] leading-snug" style={{ color: FOREST_MUTED }}>
          This agreement is binding under the Ontario Electronic Commerce Act, 2000. A typed signature with agreement
          checkbox, timestamp, and IP address constitutes a valid electronic signature. For our complete Terms of
          Service and Privacy Policy, visit{" "}
          <a
            href="https://helloyugo.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80 transition-opacity"
            style={{ color: WINE }}
          >
            helloyugo.com/terms
          </a>
          .
        </p>
      </div>
    </div>
  );

  const readAgreementToggle = (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      className={
        onWineShell
          ? "flex w-full items-center gap-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-85"
          : "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-70"
      }
      style={{ color: agreementTheme.toggle }}
    >
      {expanded ? (
        <>
          <ChevronUp className="w-4 h-4 shrink-0" /> Hide full terms
        </>
      ) : (
        <>
          <ChevronDown className="w-4 h-4 shrink-0" /> Read full agreement
        </>
      )}
    </button>
  );

  /* ── Main contract + signature layout ── */
  return (
    <div className={onWineShell ? "space-y-5" : "space-y-6"}>
      {!hideAgreementTitleBlock ? (
        <>
          <div className="text-center max-w-2xl mx-auto">
            <h3 className={AGREEMENT_DOC_TITLE_CLASS} style={{ color: WINE }}>
              {agreementHeader.title}
            </h3>
            <p className="text-[12px] mt-2 leading-relaxed" style={{ color: FOREST_BODY }}>
              {agreementHeader.subtitle}
            </p>
          </div>

          <hr className="border-0 h-px w-full" style={{ backgroundColor: `${FOREST}10` }} />
        </>
      ) : null}

      {/* ─── Pricing section ─── */}
      <div className={agreementTheme.receiptClass} style={{ color: agreementTheme.ink }}>
        <div className="h-1 w-14 mb-4 rounded-sm shrink-0" style={{ backgroundColor: agreementTheme.accentBar }} aria-hidden />
        <p className={`${QUOTE_EYEBROW_CLASS} mb-3`} style={{ color: agreementTheme.sectionEyebrow }}>
          Investment summary
        </p>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[12px]" style={{ color: agreementTheme.ink }}>
              {isBinRental ? "Rental package" : "Base Rate"}
            </span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: agreementTheme.ink }}>
              {fmtPrice(q.basePrice)}
            </span>
          </div>
          {q.addons.length > 0 && (
            <>
              {q.addons.map((a, i) => (
                <div
                  key={i}
                  className="flex justify-between items-baseline pl-3 ml-1"
                  style={{ borderLeft: `2px solid ${agreementTheme.addonRail}` }}
                >
                  <span className="text-[11px]" style={{ color: agreementTheme.inkBody }}>
                    {a.name}
                    {a.quantity && a.quantity > 1 ? ` ×${a.quantity}` : ""}
                  </span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: agreementTheme.ink }}>
                    {fmtPrice(a.price)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-[11px]" style={{ color: agreementTheme.inkBody }}>
                  Add-on subtotal
                </span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: agreementTheme.ink }}>
                  {fmtPrice(q.addonTotal)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mt-3 pt-3 space-y-1.5 border-t" style={{ borderColor: agreementTheme.borderHair }}>
          <div className="flex justify-between items-baseline">
            <span className="text-[12px]" style={{ color: agreementTheme.inkBody }}>
              Total before tax
            </span>
            <span className="text-[12px] font-medium tabular-nums" style={{ color: agreementTheme.ink }}>
              {fmtPrice(q.totalBeforeTax)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[12px]" style={{ color: agreementTheme.inkBody }}>
              HST (13%)
            </span>
            <span className="text-[12px] font-medium tabular-nums" style={{ color: agreementTheme.ink }}>
              {fmtPrice(q.tax)}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-baseline gap-4 pt-3 mt-3 border-t" style={{ borderColor: agreementTheme.borderHair }}>
          <span className="text-[13px] font-bold" style={{ color: agreementTheme.ink }}>
            Total
          </span>
          <span
            className={`${QUOTE_SECTION_H2_CLASS} font-bold tabular-nums${onWineShell ? " font-serif" : ""}`}
            style={{ color: agreementTheme.totalMoney }}
          >
            {fmtPrice(q.grandTotal)}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-[12px] font-semibold" style={{ color: agreementTheme.ink }}>
              {b2bNet30Invoice
                ? "Invoice (Net 30)"
                : paidInFullAtBooking
                  ? isBinRental
                    ? "Total due at booking"
                    : "Total due now"
                  : "Deposit due now"}
            </span>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: agreementTheme.ink }}>
              {fmtPrice(b2bNet30Invoice ? 0 : paidInFullAtBooking ? q.grandTotal : q.deposit)}
            </span>
          </div>
          {!paidInFullAtBooking && !b2bNet30Invoice && (
            <div className="flex justify-between items-baseline gap-4 pt-1">
              <span className="text-[12px]" style={{ color: agreementTheme.inkBody }}>
                Balance due {balanceDue}
              </span>
              <span className="text-[12px] font-medium tabular-nums" style={{ color: agreementTheme.ink }}>
                {fmtPrice(balance)}
              </span>
            </div>
          )}
          {b2bNet30Invoice && (
            <p className="text-[11px] leading-relaxed pt-1" style={{ color: agreementTheme.inkBody }}>
              Total {fmtPrice(q.grandTotal)} (incl. HST) per quote. Payment per Net 30 invoice after confirmation — no
              card charge on this page.
            </p>
          )}
          {paidInFullAtBooking && isBinRental && (
            <p className="text-[11px] leading-relaxed pt-1" style={{ color: agreementTheme.inkBody }}>
              Full rental fee (incl. HST) is collected after you sign, unless your coordinator instructs otherwise. A
              card may stay on file per Sections 3–4 below.
            </p>
          )}
          {paidInFullAtBooking && isLogisticsDeliveryCopy && !isBinRental && (
            <p className="text-[11px] leading-relaxed pt-1" style={{ color: agreementTheme.inkBody }}>
              Full payment (incl. HST) is collected after you sign to confirm this delivery booking.
            </p>
          )}
        </div>
      </div>

      {/* ── Expand / collapse full agreement (+ full terms on cream when open) ── */}
      {onWineShell ? (
        <div
          className="px-4 sm:px-6 pt-2 border-t space-y-3"
          style={{ borderColor: agreementTheme.borderHair }}
        >
          {readAgreementToggle}
          {expanded ? fullTermsScrollPanel : null}
        </div>
      ) : (
        <>
          {readAgreementToggle}
          {expanded ? fullTermsScrollPanel : null}
        </>
      )}

      {/* ── Signature section ── */}
      <div
        className={agreementTheme.signatureClass}
        style={onWineShell ? { borderTop: `1px solid ${agreementTheme.borderHair}` } : undefined}
      >
        <p className={QUOTE_EYEBROW_CLASS} style={{ color: agreementTheme.signEyebrow }}>
          Your signature
        </p>

        <p className="text-[11px] leading-relaxed" style={{ color: agreementTheme.signBody }}>
          {isBinRental ? (
            <>
              By signing below, you confirm that you have read the {agreementSignLabel}, accept its terms, and
              authorize {companyDisplayName} to deliver and collect your bins as scheduled.
            </>
          ) : isClientLogisticsDeliveryServiceType(q.serviceType) ? (
            <>
              By signing below, you confirm that you have read the {agreementSignLabel}, accept its terms, and
              authorize {companyDisplayName} to complete this delivery as quoted.
            </>
          ) : (
            <>
              By signing below, you confirm that you have read the {agreementSignLabel}, accept its terms, and
              authorize {companyDisplayName} to carry out the service we described together.
            </>
          )}
        </p>

        <div>
          <label className={`block ${QUOTE_EYEBROW_CLASS} mb-1.5`} style={{ color: agreementTheme.signLabel }}>
            Full legal name (as it should appear)
          </label>
          <input
            type="text"
            value={typedName}
            onChange={handleNameChange}
            placeholder="e.g. Harold Blackwood"
            className="w-full px-3 py-3 rounded-none border text-[20px] md:text-[22px] font-hero outline-none transition-colors"
            style={{
              borderColor: typedName.trim().length >= 2 ? (onWineShell ? ESTATE_ROSE : FOREST) : "#D5D0C8",
              color: onWineShell ? ESTATE_ROSE : FOREST,
              backgroundColor: "#FFFFFF",
            }}
          />
        </div>

        <label
          className="flex cursor-pointer select-none items-start gap-3 rounded-md text-[12px] leading-relaxed"
          style={{ color: agreementTheme.signBody }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="peer sr-only focus:outline-none"
          />
          <span className="flex h-[1lh] shrink-0 items-center justify-center">
            <span
              className={`inline-flex size-5 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#2C3E2D] peer-focus-visible:ring-offset-2 ${agreementTheme.focusRingOffsetClass}`}
              style={{
                borderColor: agreed ? (onWineShell ? ESTATE_ROSE : FOREST) : "#D5D0C8",
                backgroundColor: agreed ? (onWineShell ? ESTATE_ROSE : FOREST) : "transparent",
              }}
              aria-hidden
            >
              {agreed && <Check className="w-3.5 h-3.5 text-white" weight="bold" aria-hidden />}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            {isBinRental ? (
              <>
                I have read the <b>{agreementSignLabel}</b> and agree to its terms—including payment, rental timing,
                card on file, cancellation, what may not go in the bins, and care of the equipment.
              </>
            ) : (
              <>
                I have read the <b>{agreementSignLabel}</b> and agree to its terms—including your quoted investment,
                payment and cancellation, what we cannot transport, liability, and the rest of the agreement above.
              </>
            )}
          </span>
        </label>

        <p className="text-[11px] pl-8" style={{ color: agreementTheme.signDate }}>
          Date:{" "}
          {new Date().toLocaleDateString("en-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        {error && (
          <div
            className="px-4 py-3 rounded-none text-[12px] font-medium border"
            style={{
              backgroundColor: "#FEF2F2",
              color: "#991B1B",
              borderColor: "#FECACA",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleSign}
            disabled={!canSign}
            className="w-full max-w-md py-3.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canSign ? agreementTheme.signCta : agreementTheme.signCtaDisabled,
            }}
          >
            {signing ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: "rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                  }}
                />
                Processing&hellip;
              </span>
            ) : (
              "Sign & continue"
            )}
          </button>
        </div>

        <p className="text-center text-[11px] leading-snug" style={{ color: agreementTheme.legalFooter }}>
          Your electronic signature is legally binding under the Ontario Electronic Commerce Act, 2000
        </p>
      </div>
    </div>
  );
}
