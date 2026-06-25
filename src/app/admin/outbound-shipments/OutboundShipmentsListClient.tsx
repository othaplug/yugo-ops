"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OUTBOUND_STAGING_STATUS_LABELS, type OutboundStagingStatus } from "@/lib/outbound-staging/transitions";

type Row = {
  id: string;
  shipment_number: string;
  status: OutboundStagingStatus;
  partner_name: string | null;
  business_name: string | null;
  consignor_name: string | null;
  consignor_address: string | null;
  scheduled_pickup_date: string | null;
  total_price: number | null;
  declared_value: number | null;
  carrier_name: string | null;
  carrier_bol_number: string | null;
  created_at: string;
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "picked_up", label: "Picked up" },
  { value: "at_warehouse", label: "At warehouse" },
  { value: "palletizing", label: "Palletizing" },
  { value: "ready_for_carrier", label: "Ready for carrier" },
  { value: "handed_off", label: "Handed off" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function OutboundShipmentsListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = statusFilter ? `?status=${statusFilter}` : "";
        const res = await fetch(`/api/admin/outbound-shipments${q}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error ?? "Failed to load");
          setRows([]);
        } else {
          setError(null);
          setRows(data.shipments ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">B2B reverse logistics</p>
          <h1 className="text-[24px] font-bold text-[var(--tx)] mt-1">Outbound staging</h1>
          <p className="text-[12px] text-[var(--tx2)] mt-1">
            Residential pickup → warehouse palletize → 3rd-party carrier handoff
          </p>
        </div>
        <Link
          href="/admin/outbound-shipments/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--wine)] text-white text-[12px] font-semibold hover:opacity-90"
        >
          + New shipment
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition ${
              statusFilter === f.value
                ? "bg-[var(--wine)] text-white"
                : "bg-[var(--bg)] text-[var(--tx2)] hover:bg-[var(--wine)]/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-[var(--tx3)]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="px-6 py-12 rounded-lg border border-[var(--brd)] text-center">
          <p className="text-[14px] font-semibold text-[var(--tx)] mb-1">No shipments yet</p>
          <p className="text-[12px] text-[var(--tx3)]">
            {statusFilter
              ? "No shipments in this status."
              : "Create your first outbound staging shipment to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--tx3)] border-b border-[var(--brd)]">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Partner</th>
                <th className="py-2 pr-3">Consignor</th>
                <th className="py-2 pr-3">Pickup</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Carrier</th>
                <th className="py-2 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--brd)]/40 hover:bg-[var(--bg)]/40">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/outbound-shipments/${r.id}`} className="font-mono text-[var(--wine)] hover:underline">
                      {r.shipment_number}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-semibold text-[var(--tx)]">{r.partner_name ?? "—"}</span>
                    {r.business_name ? <span className="ml-2 text-[var(--tx3)]">{r.business_name}</span> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="text-[var(--tx)]">{r.consignor_name ?? "—"}</div>
                    <div className="text-[10px] text-[var(--tx3)] truncate max-w-[280px]">
                      {r.consignor_address ?? ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-[var(--tx)]">{r.scheduled_pickup_date ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg)] border border-[var(--brd)]">
                      {OUTBOUND_STAGING_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {r.carrier_name ? (
                      <div>
                        <div className="text-[var(--tx)]">{r.carrier_name}</div>
                        {r.carrier_bol_number && (
                          <div className="text-[10px] font-mono text-[var(--tx3)]">{r.carrier_bol_number}</div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold text-[var(--tx)]">
                    {r.total_price ? `$${Number(r.total_price).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
