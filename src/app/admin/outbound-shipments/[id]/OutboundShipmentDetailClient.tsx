"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  OUTBOUND_STAGING_STATUS_LABELS,
  OUTBOUND_STAGING_HAPPY_PATH,
  REQUIRED_FIELDS_FOR_TRANSITION,
  type OutboundStagingStatus,
} from "@/lib/outbound-staging/transitions";

type Shipment = Record<string, unknown> & {
  id: string;
  shipment_number: string;
  status: OutboundStagingStatus;
  partner_name: string | null;
  partner_contact_email: string | null;
  business_name: string | null;
  consignor_name: string | null;
  consignor_address: string | null;
  scheduled_pickup_date: string | null;
  scheduled_pickup_window: string | null;
  items: Array<Record<string, unknown>> | null;
  declared_value: number | null;
  total_price: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  partner_tracking_token: string | null;
  carrier_name: string | null;
  carrier_pro_number: string | null;
  carrier_bol_number: string | null;
  pallet_count: number | null;
  pallet_dimensions: string | null;
  pallet_weight_lb: number | null;
  picked_up_at: string | null;
  received_at_warehouse_at: string | null;
  palletized_at: string | null;
  ready_for_carrier_at: string | null;
  handed_off_at: string | null;
  internal_notes: string | null;
};

const FORWARD: Record<OutboundStagingStatus, OutboundStagingStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["picked_up", "cancelled"],
  picked_up: ["at_warehouse", "cancelled"],
  at_warehouse: ["palletizing", "cancelled"],
  palletizing: ["ready_for_carrier", "cancelled"],
  ready_for_carrier: ["handed_off", "cancelled"],
  handed_off: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export default function OutboundShipmentDetailClient({ id }: { id: string }) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal state for the next-status transition
  const [pendingTo, setPendingTo] = useState<OutboundStagingStatus | null>(null);
  const [patch, setPatch] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/outbound-shipments/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Failed to load");
      setShipment(null);
    } else {
      setError(null);
      setShipment(data.shipment);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function performTransition(to: OutboundStagingStatus) {
    if (!shipment) return;
    const required = REQUIRED_FIELDS_FOR_TRANSITION[to] ?? [];
    const missing = required.filter((f) => {
      const onShipment = (shipment as Record<string, unknown>)[f];
      const inPatch = patch[f];
      return !onShipment && !inPatch;
    });
    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/outbound-shipments/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Transition failed");
      } else {
        setNotice(`Status updated → ${OUTBOUND_STAGING_STATUS_LABELS[to]}`);
        setPendingTo(null);
        setPatch({});
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return <div className="p-6 text-[12px] text-[var(--tx3)]">Loading…</div>;
  if (!shipment) return <div className="p-6 text-[12px] text-red-600">{error || "Not found"}</div>;

  const forwardSteps = FORWARD[shipment.status] ?? [];
  const trackUrl = shipment.partner_tracking_token
    ? `/outbound/track/${shipment.id}?token=${encodeURIComponent(shipment.partner_tracking_token)}`
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <Link href="/admin/outbound-shipments" className="text-[11px] text-[var(--tx3)] hover:underline">
            ← All outbound shipments
          </Link>
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mt-2">B2B reverse logistics</p>
          <h1 className="text-[24px] font-bold text-[var(--tx)] mt-1">
            {shipment.shipment_number}
          </h1>
          <p className="text-[12px] text-[var(--tx2)] mt-1">
            {shipment.partner_name ?? "—"} · {shipment.business_name ?? ""}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 rounded-md bg-[var(--bg)] border border-[var(--brd)] text-[11px] font-semibold">
            {OUTBOUND_STAGING_STATUS_LABELS[shipment.status]}
          </span>
          {trackUrl && (
            <div className="mt-2">
              <Link href={trackUrl} target="_blank" className="text-[10px] text-[var(--wine)] hover:underline">
                View partner tracking →
              </Link>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2 mb-4 rounded-md bg-green-50 border border-green-200 text-[12px] text-green-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-2 mb-4 rounded-md bg-red-50 border border-red-200 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Status path */}
      <div className="rounded-lg border border-[var(--brd)] p-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-3">Lifecycle</p>
        <div className="flex flex-wrap items-center gap-2">
          {OUTBOUND_STAGING_HAPPY_PATH.map((s) => {
            const ordered = OUTBOUND_STAGING_HAPPY_PATH;
            const passed = ordered.indexOf(s) <= ordered.indexOf(shipment.status as OutboundStagingStatus);
            return (
              <span
                key={s}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                  passed
                    ? "bg-[var(--wine)] text-white"
                    : "bg-[var(--bg)] text-[var(--tx3)] border border-[var(--brd)]"
                }`}
              >
                {OUTBOUND_STAGING_STATUS_LABELS[s]}
              </span>
            );
          })}
        </div>
        {forwardSteps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--brd)]/50">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-2">Move to</p>
            <div className="flex flex-wrap gap-2">
              {forwardSteps.map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => {
                    setPendingTo(to);
                    setPatch({});
                    setError(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--wine)] text-white hover:opacity-90"
                >
                  → {OUTBOUND_STAGING_STATUS_LABELS[to]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transition modal */}
      {pendingTo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] rounded-lg max-w-lg w-full p-6">
            <h2 className="text-[16px] font-bold text-[var(--tx)] mb-1">
              Move to {OUTBOUND_STAGING_STATUS_LABELS[pendingTo]}
            </h2>
            <p className="text-[12px] text-[var(--tx2)] mb-4">
              {REQUIRED_FIELDS_FOR_TRANSITION[pendingTo]?.length
                ? "Confirm or fill in the required details for this transition."
                : "Confirm this transition?"}
            </p>
            <div className="space-y-3">
              {(REQUIRED_FIELDS_FOR_TRANSITION[pendingTo] ?? []).map((field) => {
                const existing = (shipment as Record<string, unknown>)[field];
                return (
                  <FieldInput
                    key={field}
                    label={fieldLabel(field)}
                    field={field}
                    existing={existing}
                    value={patch[field] ?? ""}
                    onChange={(v) => setPatch((p) => ({ ...p, [field]: v }))}
                  />
                );
              })}
              {pendingTo === "ready_for_carrier" && (
                <p className="text-[10px] text-[var(--tx3)]">
                  Tip: also fill in `pallet_dimensions` and `crating_method` for a complete record.
                </p>
              )}
              {pendingTo === "handed_off" && (
                <FieldInput
                  label="Carrier PRO #"
                  field="carrier_pro_number"
                  existing={shipment.carrier_pro_number}
                  value={patch.carrier_pro_number ?? ""}
                  onChange={(v) => setPatch((p) => ({ ...p, carrier_pro_number: v }))}
                />
              )}
              {pendingTo === "cancelled" && (
                <FieldInput
                  label="Cancellation reason"
                  field="cancellation_reason"
                  existing=""
                  value={patch.cancellation_reason ?? ""}
                  onChange={(v) => setPatch((p) => ({ ...p, cancellation_reason: v }))}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setPendingTo(null)} className="px-3 py-1.5 text-[11px] text-[var(--tx2)] hover:text-[var(--tx)]">
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => performTransition(pendingTo)}
                className="px-4 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--wine)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : `Confirm → ${OUTBOUND_STAGING_STATUS_LABELS[pendingTo]}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-only summary */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <SummaryCard title="Consignor">
            <SumRow label="Name" value={shipment.consignor_name ?? "—"} />
            <SumRow label="Pickup address" value={shipment.consignor_address ?? "—"} />
            <SumRow label="Scheduled" value={`${shipment.scheduled_pickup_date ?? "—"}${shipment.scheduled_pickup_window ? ` · ${shipment.scheduled_pickup_window}` : ""}`} />
          </SummaryCard>

          <SummaryCard title="Items">
            {(shipment.items ?? []).map((it, i) => (
              <div key={i} className="py-1 border-b border-[var(--brd)]/40 last:border-b-0">
                <p className="text-[12px] font-semibold text-[var(--tx)]">{String(it.name ?? "—")}</p>
                <p className="text-[10px] text-[var(--tx3)]">
                  {it.dimensions ? `${it.dimensions} · ` : ""}
                  {it.weight_lb ? `${it.weight_lb} lb · ` : ""}
                  {it.value ? `$${it.value} CAD` : ""}
                </p>
              </div>
            ))}
            {(!shipment.items || shipment.items.length === 0) && <p className="text-[12px] text-[var(--tx3)]">No items listed.</p>}
          </SummaryCard>

          <SummaryCard title="Pallet specs">
            <SumRow label="Pallet count" value={shipment.pallet_count?.toString() ?? "—"} />
            <SumRow label="Dimensions" value={shipment.pallet_dimensions ?? "—"} />
            <SumRow label="Weight" value={shipment.pallet_weight_lb ? `${shipment.pallet_weight_lb} lb` : "—"} />
          </SummaryCard>

          <SummaryCard title="Carrier handoff">
            <SumRow label="Carrier" value={shipment.carrier_name ?? "—"} />
            <SumRow label="BOL" value={shipment.carrier_bol_number ?? "—"} mono />
            <SumRow label="PRO" value={shipment.carrier_pro_number ?? "—"} mono />
          </SummaryCard>

          {shipment.internal_notes && (
            <SummaryCard title="Internal notes">
              <p className="text-[12px] text-[var(--tx2)] whitespace-pre-wrap">{shipment.internal_notes}</p>
            </SummaryCard>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <SummaryCard title="Pricing">
            <SumRow label="Declared value" value={shipment.declared_value ? `$${shipment.declared_value}` : "—"} />
            <SumRow label="Subtotal" value={shipment.subtotal ? `$${Number(shipment.subtotal).toFixed(2)}` : "—"} />
            <SumRow label="HST" value={shipment.tax_amount ? `$${Number(shipment.tax_amount).toFixed(2)}` : "—"} />
            <div className="pt-2 mt-2 border-t border-[var(--brd)]/50">
              <SumRow label="Total CAD" value={shipment.total_price ? `$${Number(shipment.total_price).toFixed(2)}` : "—"} bold />
            </div>
          </SummaryCard>

          <SummaryCard title="Milestones">
            <SumRow label="Picked up" value={fmtMs(shipment.picked_up_at)} />
            <SumRow label="At warehouse" value={fmtMs(shipment.received_at_warehouse_at)} />
            <SumRow label="Palletized" value={fmtMs(shipment.palletized_at)} />
            <SumRow label="Ready for carrier" value={fmtMs(shipment.ready_for_carrier_at)} />
            <SumRow label="Handed off" value={fmtMs(shipment.handed_off_at)} />
          </SummaryCard>
        </div>
      </div>
    </div>
  );
}

function fieldLabel(f: string): string {
  return f.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function FieldInput({
  label,
  field,
  existing,
  value,
  onChange,
}: {
  label: string;
  field: string;
  existing: unknown;
  value: string;
  onChange: (v: string) => void;
}) {
  const isDate = /_at$|_date$/.test(field) && !/picked_up_at|received_at|palletized_at|handed_off_at|completed_at|cancelled_at|started_at|appointment_at/.test(field);
  const isTs = /_at$/.test(field);
  const isNum = /pallet_count|pallet_weight_lb/.test(field);
  const inputType = isTs ? "datetime-local" : isDate ? "date" : isNum ? "number" : "text";

  return (
    <label className="block">
      <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-[var(--tx3)]">{label}</span>
      <input
        type={inputType}
        value={value}
        placeholder={existing ? `Already set: ${String(existing).slice(0, 30)}` : "Required"}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--brd)] bg-[var(--bg)] text-[12px]"
      />
    </label>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--brd)] p-4">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-2">{title}</p>
      {children}
    </div>
  );
}

function SumRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[12px]">
      <span className="text-[var(--tx2)]">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${bold ? "font-bold text-[var(--tx)]" : "text-[var(--tx)]"}`}>{value}</span>
    </div>
  );
}

function fmtMs(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}
