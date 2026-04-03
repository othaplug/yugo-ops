"use client";

import React, { useState, useRef } from "react";
import { Check, CaretDown as ChevronDown, CaretUp as ChevronUp, FileText, Calendar, MapPin, Ruler, Clock } from "@phosphor-icons/react";
import { toTitleCase, formatAccessForDisplay, formatAddressForDisplay } from "@/lib/format-text";
import { isClientLogisticsDeliveryServiceType } from "@/lib/quotes/b2b-quote-copy";
import {
  agreementCheckboxLabel,
  agreementDocumentTitle,
  buildBinRentalAgreementSections,
  buildNonBinAgreementSections,
} from "@/lib/contracts/agreement-terms";

const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const GOLD = "#B8962E";
const CREAM = "#FAF7F2";

const MOVE_SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br": "4 Bedroom",
  "5br_plus": "5+ Bedroom",
  partial: "Partial Move",
};

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

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ContractSign({
  quoteData,
  companyLegalName,
  companyDisplayName,
  onSigned,
  onContractStarted,
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
  const serviceHeading = isBinRental
    ? "Bin Rental"
    : q.serviceType === "local_move" && q.packageLabel?.trim()
      ? q.packageLabel.trim()
      : toTitleCase(q.serviceType);
  const scheduleSectionTitle =
    isBinRental
      ? "Your rental schedule"
      : q.eventLegs && q.eventLegs.length > 0
        ? "Event logistics"
        : isLogisticsDeliveryCopy
          ? "Your Delivery"
          : "Your Move";

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

  /* ── Signed confirmation state ── */
  if (signed) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm overflow-hidden">
        <div
          className="px-5 py-5 flex items-center gap-3"
          style={{ backgroundColor: `${FOREST}06` }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${FOREST}12` }}
          >
            <Check className="w-5 h-5" style={{ color: FOREST }} />
          </div>
          <div>
            <h2 className="font-heading text-[var(--text-base)] font-bold" style={{ color: FOREST }}>
              You&apos;re all set
            </h2>
            <p className="text-[12px]" style={{ color: `${FOREST}70` }}>
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
      </div>
    );
  }

  /* ── Main contract + signature layout ── */
  return (
    <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-[#E2DDD5]"
        style={{ backgroundColor: `${FOREST}06` }}
      >
        <div className="flex items-center gap-2.5">
          <FileText className="w-[18px] h-[18px]" style={{ color: FOREST }} />
          <div>
            <h2
              className="font-heading text-[var(--text-base)] font-bold tracking-wider uppercase"
              style={{ color: FOREST }}
            >
              {agreementHeader.title}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: `${FOREST}70` }}>
              {agreementHeader.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5 space-y-4">
        {/* ── Service & financial summary ── */}
        <div
          className="rounded-2xl overflow-hidden text-[12px]"
          style={{
            color: FOREST,
            boxShadow: `0 2px 4px ${FOREST}08, 0 8px 24px ${FOREST}06, 0 0 0 1px ${FOREST}08`,
          }}
        >
          {/* ─── Premium header band ─── */}
          <div
            className="relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${WINE} 0%, ${WINE}E8 50%, ${WINE}D0 100%)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `radial-gradient(circle at 15% 50%, ${GOLD} 0%, transparent 60%), radial-gradient(circle at 85% 30%, ${GOLD} 0%, transparent 50%)`,
              }}
            />
            <div className="relative px-5 py-4 md:px-6 md:py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[9px] font-bold tracking-[0.18em] uppercase mb-1"
                    style={{ color: `${GOLD}CC` }}
                  >
                    Your Service
                  </p>
                  <h3 className="font-hero text-[20px] md:text-[22px] text-white leading-tight">
                    {serviceHeading}
                  </h3>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-[0.08em] uppercase shrink-0"
                  style={{
                    color: GOLD,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    border: `1px solid ${GOLD}40`,
                  }}
                >
                  {q.packageLabel}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Move details section ─── */}
          <div
            className="rounded-b-2xl overflow-hidden"
            style={{ backgroundColor: "#FFFFFF", border: `1px solid ${FOREST}08`, borderTop: "none" }}
          >
            <div className="px-5 py-5 md:px-6 md:py-6">
              <p
                className="text-[9px] font-bold tracking-[0.16em] uppercase mb-5"
                style={{ color: `${FOREST}50` }}
              >
                {scheduleSectionTitle}
              </p>

              {isBinRental && br ? (
                <div className="space-y-3">
                  <div
                    className="rounded-xl px-4 py-3 text-left"
                    style={{ backgroundColor: `${WINE}04`, border: `1px solid ${WINE}15` }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: WINE }}>
                      Bin delivery
                    </p>
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: FOREST }}>
                      {fmtDate(br.deliveryDate)}
                    </p>
                    <p className="text-[11px] mt-1.5 flex items-start gap-1" style={{ color: `${FOREST}70` }}>
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {br.deliveryAddress}
                    </p>
                  </div>
                  <div
                    className="rounded-xl px-4 py-3 text-left"
                    style={{ backgroundColor: `${GOLD}05`, border: `1px solid ${GOLD}18` }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: GOLD }}>
                      Your move day (reference)
                    </p>
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: FOREST }}>
                      {fmtDate(br.moveDate)}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: `${FOREST}55` }}>
                      Bins are for packing around this date; rental length is governed by the included cycle below.
                    </p>
                  </div>
                  <div
                    className="rounded-xl px-4 py-3 text-left"
                    style={{ backgroundColor: `${WINE}04`, border: `1px solid ${WINE}15` }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: WINE }}>
                      Bin pickup
                    </p>
                    <p className="text-[12px] font-semibold leading-snug" style={{ color: FOREST }}>
                      {fmtDate(br.pickupDate)}
                    </p>
                    <p className="text-[11px] mt-1.5 flex items-start gap-1" style={{ color: `${FOREST}70` }}>
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {br.pickupAddress}
                    </p>
                    <p className="text-[10px] mt-1.5" style={{ color: `${FOREST}55` }}>
                      Bins must be emptied, stacked, and ready as described in this agreement.
                    </p>
                  </div>
                  <p className="text-[11px] leading-relaxed px-1" style={{ color: `${FOREST}75` }}>
                    <strong className="text-[var(--tx)]">Rental cycle:</strong> {br.cycleDays}-day included period from
                    delivery unless your quote states otherwise. Late returns or missing/damaged bins may incur
                    additional charges (your quote and Section 3–5 below apply).
                  </p>
                </div>
              ) : q.pickupStops && q.pickupStops.length > 1 ? (
                <div className="space-y-5 text-left">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: `${FOREST}55` }}>
                      Pickup locations
                    </p>
                    <div className="space-y-3">
                      {q.pickupStops.map((s, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl px-4 py-3"
                          style={{ backgroundColor: `${WINE}04`, border: `1px solid ${WINE}10` }}
                        >
                          <span
                            className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] uppercase mb-1"
                            style={{ color: WINE }}
                          >
                            <MapPin className="w-3 h-3" />
                            {q.pickupStops!.length > 1 ? `Pickup ${idx + 1}` : "Pickup"}
                          </span>
                          <p className="text-[13px] md:text-[var(--text-base)] leading-snug font-semibold" style={{ color: FOREST }}>
                            {formatAddressForDisplay(s.address)}
                          </p>
                          {s.accessLine ? (
                            <p className="text-[10px] mt-1" style={{ color: `${FOREST}55` }}>
                              Access: {s.accessLine}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: `${FOREST}55` }}>
                      {q.pickupStops.length} pickup locations — crew will visit each stop.
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: `${FOREST}55` }}>
                      Destination
                    </p>
                    <div className="space-y-3">
                      {(q.dropoffStops && q.dropoffStops.length > 0
                        ? q.dropoffStops
                        : [{ address: q.toAddress, accessLine: formatAccessForDisplay(q.toAccess) }]
                      ).map((s, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl px-4 py-3"
                          style={{ backgroundColor: `${GOLD}05`, border: `1px solid ${GOLD}12` }}
                        >
                          <span
                            className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] uppercase mb-1"
                            style={{ color: GOLD }}
                          >
                            <MapPin className="w-3 h-3" />
                            {(q.dropoffStops?.length ?? 0) > 1 ? `Destination ${idx + 1}` : "To"}
                          </span>
                          <p className="text-[13px] md:text-[var(--text-base)] leading-snug font-semibold" style={{ color: FOREST }}>
                            {formatAddressForDisplay(s.address)}
                          </p>
                          {s.accessLine ? (
                            <p className="text-[10px] mt-1" style={{ color: `${FOREST}55` }}>
                              Access: {s.accessLine}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : q.eventLegs && q.eventLegs.length > 0 ? (
                <div className="space-y-3">
                  {q.eventLegs.map((leg, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl px-4 py-3 text-left"
                      style={{ backgroundColor: `${WINE}04`, border: `1px solid ${WINE}15` }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: WINE }}>
                        {leg.label}
                      </p>
                      <p className="text-[12px] font-semibold leading-snug" style={{ color: FOREST }}>
                        {leg.fromAddress} → {leg.toAddress}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: `${FOREST}55` }}>
                        {leg.deliveryDate} – {leg.returnDate}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4">
                  {/* Static route line */}
                  <div className="relative shrink-0 w-[3px] rounded-full" style={{ minHeight: "7rem" }}>
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ background: `linear-gradient(to bottom, ${WINE}, ${GOLD})`, opacity: 0.2 }}
                    />
                    <span
                      className="absolute left-1/2 -translate-x-1/2 top-0 w-[11px] h-[11px] rounded-full z-10"
                      style={{
                        backgroundColor: WINE,
                        boxShadow: `0 0 0 3px #fff, 0 0 0 4px ${WINE}25`,
                      }}
                    />
                    <span
                      className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[11px] h-[11px] rounded-full z-10"
                      style={{
                        backgroundColor: GOLD,
                        boxShadow: `0 0 0 3px #fff, 0 0 0 4px ${GOLD}25`,
                      }}
                    />
                  </div>

                  {/* Address cards */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{ backgroundColor: `${WINE}04`, border: `1px solid ${WINE}10` }}
                    >
                      <span
                        className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] uppercase mb-1"
                        style={{ color: WINE }}
                      >
                        <MapPin className="w-3 h-3" />
                        From
                      </span>
                      <p className="text-[13px] md:text-[var(--text-base)] leading-snug font-semibold" style={{ color: FOREST }}>
                        {q.fromAddress}
                      </p>
                      {formatAccessForDisplay(q.fromAccess) && (
                        <p className="text-[10px] mt-1" style={{ color: `${FOREST}55` }}>
                          {formatAccessForDisplay(q.fromAccess)}
                        </p>
                      )}
                    </div>

                    <div
                      className="rounded-xl px-4 py-3"
                      style={{ backgroundColor: `${GOLD}05`, border: `1px solid ${GOLD}12` }}
                    >
                      <span
                        className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] uppercase mb-1"
                        style={{ color: GOLD }}
                      >
                        <MapPin className="w-3 h-3" />
                        To
                      </span>
                      <p className="text-[13px] md:text-[var(--text-base)] leading-snug font-semibold" style={{ color: FOREST }}>
                        {q.toAddress}
                      </p>
                      {formatAccessForDisplay(q.toAccess) && (
                        <p className="text-[10px] mt-1" style={{ color: `${FOREST}55` }}>
                          {formatAccessForDisplay(q.toAccess)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom detail bar */}
              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 px-4 py-3 rounded-xl"
                style={{ backgroundColor: CREAM, border: `1px solid ${FOREST}08` }}
              >
                {isBinRental && br ? (
                  <>
                    {br.deliveryDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-semibold" style={{ color: FOREST }}>
                          Delivery {fmtDate(br.deliveryDate)}
                        </span>
                      </div>
                    )}
                    {br.moveDate && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-medium" style={{ color: FOREST }}>
                          Move day {fmtDate(br.moveDate)}
                        </span>
                      </div>
                    )}
                    {br.pickupDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-medium" style={{ color: FOREST }}>
                          Pickup {fmtDate(br.pickupDate)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Ruler className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      <span className="text-[12px] font-medium" style={{ color: FOREST }}>
                        {br.cycleDays}-day rental cycle included
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {q.moveDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-semibold" style={{ color: FOREST }}>
                          {fmtDate(q.moveDate)}
                        </span>
                      </div>
                    )}
                    {q.preferredTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-medium" style={{ color: FOREST }}>
                          Arrival: {q.preferredTime}
                        </span>
                      </div>
                    )}
                    {q.moveSize && (
                      <div className="flex items-center gap-2">
                        <Ruler className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-medium" style={{ color: FOREST }}>
                          {MOVE_SIZE_LABELS[q.moveSize] ?? q.moveSize}
                        </span>
                      </div>
                    )}
                    {q.distanceKm != null && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        <span className="text-[12px] font-medium" style={{ color: FOREST }}>
                          {q.distanceKm} km{q.driveTimeMin ? ` · ~${q.driveTimeMin} min` : ""}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 px-5 md:px-6">
              <div className="flex-1 h-px" style={{ backgroundColor: `${FOREST}10` }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${GOLD}50` }} />
              <div className="flex-1 h-px" style={{ backgroundColor: `${FOREST}10` }} />
            </div>

            {/* ─── Pricing section ─── */}
            <div className="px-5 py-5 md:px-6 md:py-6">
              <p
                className="text-[10px] font-bold tracking-[0.18em] uppercase mb-3"
                style={{ color: `${FOREST}55` }}
              >
                Investment Summary
              </p>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px]" style={{ color: `${FOREST}80` }}>
                    {isBinRental ? "Rental package" : "Base Rate"}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: FOREST }}>{fmtPrice(q.basePrice)}</span>
                </div>
                {q.addons.length > 0 && (
                  <>
                    {q.addons.map((a, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-baseline pl-3 ml-1"
                        style={{ borderLeft: `2px solid ${GOLD}30` }}
                      >
                        <span className="text-[11px]" style={{ color: `${FOREST}70` }}>
                          {a.name}{a.quantity && a.quantity > 1 ? ` ×${a.quantity}` : ""}
                        </span>
                        <span className="text-[12px] font-medium tabular-nums" style={{ color: FOREST }}>{fmtPrice(a.price)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-[11px]" style={{ color: `${FOREST}55` }}>Add-on subtotal</span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: FOREST }}>{fmtPrice(q.addonTotal)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Tax & totals */}
              <div
                className="mt-3 pt-3 space-y-1.5"
                style={{ borderTop: `1px solid ${FOREST}10` }}
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px]" style={{ color: `${FOREST}70` }}>Total before tax</span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: FOREST }}>{fmtPrice(q.totalBeforeTax)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px]" style={{ color: `${FOREST}70` }}>HST (13%)</span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: FOREST }}>{fmtPrice(q.tax)}</span>
                </div>
              </div>

              {/* Grand total card */}
              <div
                className="mt-4 rounded-xl px-4 py-3"
                style={{
                  background: `linear-gradient(135deg, ${WINE}08 0%, ${WINE}04 100%)`,
                  border: `1px solid ${WINE}18`,
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-bold" style={{ color: WINE }}>Total</span>
                  <span className="font-hero text-[22px]" style={{ color: WINE }}>{fmtPrice(q.grandTotal)}</span>
                </div>
              </div>

              {/* Deposit & balance (bin rental: full payment at booking) */}
              <div className="mt-3 flex flex-col gap-2">
                <div
                  className="flex justify-between items-center rounded-lg px-4 py-2.5"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}08, ${GOLD}04)`,
                    border: `1px solid ${GOLD}20`,
                  }}
                >
                  <span className="text-[12px] font-semibold" style={{ color: FOREST }}>
                    {b2bNet30Invoice
                      ? "Invoice (Net 30)"
                      : paidInFullAtBooking
                        ? isBinRental
                          ? "Total due at booking"
                          : "Total due now"
                        : "Deposit due now"}
                  </span>
                  <span
                    className="text-[16px] font-bold"
                    style={{
                      color: GOLD,
                      backgroundImage: `linear-gradient(135deg, ${GOLD}, #D4AF37)`,
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {fmtPrice(
                      b2bNet30Invoice ? 0 : paidInFullAtBooking ? q.grandTotal : q.deposit,
                    )}
                  </span>
                </div>
                {!paidInFullAtBooking && !b2bNet30Invoice && (
                  <div className="flex justify-between items-baseline px-4">
                    <span className="text-[12px]" style={{ color: `${FOREST}55` }}>
                      Balance due {balanceDue}
                    </span>
                    <span className="text-[12px] font-medium tabular-nums" style={{ color: FOREST }}>
                      {fmtPrice(balance)}
                    </span>
                  </div>
                )}
                {b2bNet30Invoice && (
                  <p className="text-[10px] px-4 leading-relaxed" style={{ color: `${FOREST}55` }}>
                    Total {fmtPrice(q.grandTotal)} (incl. HST) per quote. Payment per Net 30 invoice after
                    confirmation — no card charge on this page.
                  </p>
                )}
                {paidInFullAtBooking && isBinRental && (
                  <p className="text-[10px] px-4 leading-relaxed" style={{ color: `${FOREST}55` }}>
                    Full rental fee (incl. HST) is collected after you sign, unless your coordinator instructs otherwise.
                    A card may stay on file per Sections 3–4 below.
                  </p>
                )}
                {paidInFullAtBooking && isLogisticsDeliveryCopy && !isBinRental && (
                  <p className="text-[10px] px-4 leading-relaxed" style={{ color: `${FOREST}55` }}>
                    Full payment (incl. HST) is collected after you sign to confirm this delivery booking.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Expand / collapse full agreement ── */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-[12px] font-semibold transition-colors hover:opacity-80"
          style={{ color: GOLD }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" /> Hide full terms
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" /> Read full agreement
            </>
          )}
        </button>

        {/* ── Full contract terms (collapsible) ── */}
        {expanded && (
          <div
            className="p-4 rounded-xl text-[11px] leading-relaxed space-y-4 max-h-[50vh] overflow-y-auto"
            style={{ backgroundColor: CREAM, color: FOREST, border: `1px solid ${FOREST}12` }}
          >
            {(isBinRental
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
            ))}

            <div className="pt-2 border-t" style={{ borderColor: `${FOREST}12` }}>
              <p className="text-[10px]" style={{ color: `${FOREST}50` }}>
                This agreement is binding under the Ontario Electronic Commerce Act, 2000. A typed
                signature with agreement checkbox, timestamp, and IP address constitutes a valid
                electronic signature. For our complete Terms of Service and Privacy Policy,
                visit{" "}
                <a
                  href="https://helloyugo.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80 transition-opacity"
                  style={{ color: GOLD }}
                >
                  helloyugo.com/terms
                </a>.
              </p>
            </div>
          </div>
        )}

        {/* ── Divider ── */}
        <div className="border-t" style={{ borderColor: "#E2DDD5" }} />

        {/* ── Signature section ── */}
        <div className="space-y-4">
          <p className="text-[12px] font-semibold" style={{ color: FOREST }}>
            Your signature
          </p>

          <p className="text-[11px] leading-relaxed" style={{ color: `${FOREST}80` }}>
            {isBinRental ? (
              <>
                By signing below, you confirm that you have read the {agreementSignLabel}, accept its
                terms, and authorize {companyDisplayName} to deliver and collect your bins as scheduled.
              </>
            ) : isClientLogisticsDeliveryServiceType(q.serviceType) ? (
              <>
                By signing below, you confirm that you have read the {agreementSignLabel}, accept its
                terms, and authorize {companyDisplayName} to complete this delivery as quoted.
              </>
            ) : (
              <>
                By signing below, you confirm that you have read the {agreementSignLabel}, accept its
                terms, and authorize {companyDisplayName} to carry out the service we described together.
              </>
            )}
          </p>

          {/* Typed name input */}
          <div>
            <label
              className="block text-[11px] font-semibold tracking-wider uppercase mb-1.5"
              style={{ color: FOREST }}
            >
              Full legal name (as it should appear)
            </label>
            <input
              type="text"
              value={typedName}
              onChange={handleNameChange}
              placeholder="e.g. Harold Blackwood"
              className="w-full px-4 py-3 rounded-xl border text-[22px] font-hero outline-none transition-colors"
              style={{
                borderColor: typedName.trim().length >= 2 ? GOLD : "#D5D0C8",
                color: WINE,
                backgroundColor: "#FAFAF8",
              }}
            />
          </div>

          {/* Agreement checkbox — real input inside label so the box and text both toggle */}
          <label className="flex items-start gap-3 cursor-pointer select-none rounded-md">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="peer sr-only focus:outline-none"
            />
            <span
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#B8962E] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white"
              style={{
                borderColor: agreed ? GOLD : "#D5D0C8",
                backgroundColor: agreed ? GOLD : "transparent",
              }}
              aria-hidden
            >
              {agreed && <Check className="w-3.5 h-3.5 text-white" weight="bold" aria-hidden />}
            </span>
            <span className="text-[12px] leading-snug flex-1 min-w-0 pt-0.5" style={{ color: FOREST }}>
              {isBinRental ? (
                <>
                  I have read the <b>{agreementSignLabel}</b> and agree to its terms—including payment, rental
                  timing, card on file, cancellation, what may not go in the bins, and care of the equipment.
                </>
              ) : (
                <>
                  I have read the <b>{agreementSignLabel}</b> and agree to its terms—including your quoted
                  investment, payment and cancellation, what we cannot transport, liability, and the rest of
                  the agreement above.
                </>
              )}
            </span>
          </label>

          {/* Auto-populated date */}
          <p className="text-[11px] pl-8" style={{ color: "#5A655C" }}>
            Date:{" "}
            {new Date().toLocaleDateString("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          {/* Error */}
          {error && (
            <div
              className="px-4 py-3 rounded-xl text-[12px] font-medium"
              style={{
                backgroundColor: "#FEF2F2",
                color: "#991B1B",
                border: "1px solid #FECACA",
              }}
            >
              {error}
            </div>
          )}

          {/* Sign button — width-capped so it reads as a control, not a full-width slab */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSign}
              disabled={!canSign}
              className="w-full max-w-[17.5rem] py-2.5 px-5 rounded-lg text-[13px] font-semibold text-white transition-[opacity,transform] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ backgroundColor: canSign ? GOLD : `${GOLD}60` }}
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
                "Sign & continue to payment"
              )}
            </button>
          </div>

          <p className="text-center text-[10px]" style={{ color: `${FOREST}40` }}>
            Your electronic signature is legally binding under the Ontario Electronic Commerce
            Act, 2000
          </p>
        </div>
      </div>
    </div>
  );
}
