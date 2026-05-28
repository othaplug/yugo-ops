"use client";

/**
 * R1 — Job scope picker for B2B / white-glove quotes.
 *
 * Self-contained so it can be dropped into the existing QuoteFormClient
 * without invasive refactoring of that 6000-line file. The parent passes
 * `value` + `onChange` and submission-time payload via `onSnapshot`.
 *
 * Three scopes are surfaced:
 *   direct_delivery         (default) Standard pickup + delivery.
 *   receive_and_deliver     Yugo receives inbound crates from a 3rd-party
 *                           carrier, stores briefly, then delivers.
 *                           Fritz Hansen pattern.
 *   receive_and_recover     Same as receive_and_deliver PLUS recover the
 *                           original item from the customer and return it
 *                           to the Yugo warehouse for partner pickup.
 *                           True white-glove swap.
 *
 * When scope ≠ direct_delivery the section reveals carrier / waybill /
 * ETA / declared-value inputs that the API endpoint
 * /api/admin/quotes/[id]/link-inbound-shipment consumes on quote save.
 *
 * Implementation note: this component owns ONLY the inbound-shipment
 * draft state. The address inputs / item list / pricing live in
 * QuoteFormClient. The scope picker doesn't HIDE pickup inputs because
 * (a) the parent already validates them and (b) some flows still need a
 * physical pickup (e.g. receive_and_recover originates from the
 * customer's home). Instead it adds a clear visual cue that an inbound
 * shipment is also part of the job.
 */

import * as React from "react";

export type JobScope =
  | "direct_delivery"
  | "receive_and_deliver"
  | "receive_and_recover";

export type InboundShipmentDraft = {
  carrier_name: string;
  carrier_tracking_number: string;
  carrier_eta: string; // YYYY-MM-DD or ""
  origin_country: string;
  declared_value: string; // string for input control; parsed on submit
  special_instructions: string;
};

export const EMPTY_INBOUND_DRAFT: InboundShipmentDraft = {
  carrier_name: "",
  carrier_tracking_number: "",
  carrier_eta: "",
  origin_country: "",
  declared_value: "",
  special_instructions: "",
};

const CARRIER_OPTIONS = [
  "FedEx Air Freight",
  "FedEx Ground",
  "DHL",
  "UPS Freight",
  "UPS Ground",
  "Purolator",
  "Day & Ross",
  "Manitoulin",
  "Other",
];

type ScopeMeta = {
  value: JobScope;
  label: string;
  subtitle: string;
};

const SCOPE_OPTIONS: ScopeMeta[] = [
  {
    value: "direct_delivery",
    label: "Direct delivery",
    subtitle: "Pickup → delivery. No warehouse leg.",
  },
  {
    value: "receive_and_deliver",
    label: "Receive at warehouse + deliver",
    subtitle:
      "3rd-party carrier delivers to Yugo. We inspect, store briefly, deliver to client.",
  },
  {
    value: "receive_and_recover",
    label: "Receive + deliver + recover original",
    subtitle:
      "Full swap: deliver new item, recover original, return to warehouse for partner pickup.",
  },
];

/** Returns true when the chosen scope expects an inbound_shipments row. */
export function scopeRequiresInbound(scope: JobScope): boolean {
  return scope === "receive_and_deliver" || scope === "receive_and_recover";
}

/** Strict validation — call before submitting a quote with an inbound scope. */
export function validateInboundDraft(
  draft: InboundShipmentDraft,
): { ok: true } | { ok: false; error: string } {
  const carrier = draft.carrier_name.trim();
  const tracking = draft.carrier_tracking_number.trim();
  if (!carrier && !tracking) {
    return {
      ok: false,
      error:
        "Carrier and waybill (tracking number) are both blank. Enter at least one.",
    };
  }
  // ETA optional but if provided must parse
  if (draft.carrier_eta) {
    const d = new Date(draft.carrier_eta);
    if (!Number.isFinite(d.getTime())) {
      return { ok: false, error: "Carrier ETA isn't a valid date." };
    }
  }
  // Declared value optional but if provided must be a positive number
  if (draft.declared_value) {
    const n = Number(draft.declared_value);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Declared value must be a positive number." };
    }
  }
  return { ok: true };
}

type Props = {
  /** Currently selected scope. */
  value: JobScope;
  /** Update the scope. */
  onChange: (next: JobScope) => void;
  /** Inbound-shipment draft state (controlled). */
  inbound: InboundShipmentDraft;
  /** Update the draft. */
  onInboundChange: (next: InboundShipmentDraft) => void;
  /** Inline disabled flag (e.g. while submitting). */
  disabled?: boolean;
};

export default function JobScopeSection({
  value,
  onChange,
  inbound,
  onInboundChange,
  disabled = false,
}: Props) {
  const showInbound = scopeRequiresInbound(value);

  const set = <K extends keyof InboundShipmentDraft>(
    key: K,
    val: InboundShipmentDraft[K],
  ) => {
    onInboundChange({ ...inbound, [key]: val });
  };

  return (
    <div className="rounded-xl border border-[var(--brd)] bg-white p-4 mb-4">
      <div className="mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx2)] mb-1">
          Job scope
        </div>
        <div className="text-[12px] text-[var(--tx2)]">
          Choose how Yugo handles the goods. Affects the quote workflow,
          partner-portal milestones, and the auto-generated condition
          report.
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {SCOPE_OPTIONS.map((opt) => {
          const checked = opt.value === value;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                checked
                  ? "border-[var(--wine)] bg-[var(--wine)]/[0.04]"
                  : "border-[var(--brd)] hover:bg-[var(--bg)]/40"
              }`}
            >
              <input
                type="radio"
                name="job-scope"
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="mt-0.5 accent-[var(--wine)]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tx)]">
                  {opt.label}
                </div>
                <div className="text-[11px] text-[var(--tx2)] leading-snug mt-0.5">
                  {opt.subtitle}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {showInbound && (
        <div className="border-t border-[var(--brd)] pt-3 mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx2)] mb-2">
            Inbound shipment
          </div>
          <div className="text-[11px] text-[var(--tx2)] mb-3">
            Yugo will track this carrier shipment alongside the quote.
            Carrier and waybill are required; ETA + declared value
            recommended.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tx2)] mb-1">
                Carrier
              </label>
              <select
                value={inbound.carrier_name}
                onChange={(e) => set("carrier_name", e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] bg-white"
              >
                <option value="">Select carrier…</option>
                {CARRIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tx2)] mb-1">
                Waybill / Tracking #
              </label>
              <input
                type="text"
                value={inbound.carrier_tracking_number}
                onChange={(e) =>
                  set("carrier_tracking_number", e.target.value)
                }
                disabled={disabled}
                placeholder="Air waybill or carrier tracking #"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tx2)] mb-1">
                Expected ETA
              </label>
              <input
                type="date"
                value={inbound.carrier_eta}
                onChange={(e) => set("carrier_eta", e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tx2)] mb-1">
                Origin country
              </label>
              <input
                type="text"
                value={inbound.origin_country}
                onChange={(e) => set("origin_country", e.target.value)}
                disabled={disabled}
                placeholder="e.g. Denmark, Italy, USA"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tx2)] mb-1">
                Declared cargo value (CAD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={inbound.declared_value}
                onChange={(e) => set("declared_value", e.target.value)}
                disabled={disabled}
                placeholder="3197.31"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px]"
              />
              <div className="text-[10px] text-[var(--tx2)] mt-1">
                Drives insurance coverage, handling-class warnings, and
                the partner condition report. Required when shipment
                value &gt; $5,000 CAD.
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tx2)] mb-1">
                Special handling notes
              </label>
              <textarea
                value={inbound.special_instructions}
                onChange={(e) =>
                  set("special_instructions", e.target.value)
                }
                disabled={disabled}
                placeholder="Crate count, fragile call-outs, partner-specific instructions…"
                rows={2}
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-[13px] resize-y"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
