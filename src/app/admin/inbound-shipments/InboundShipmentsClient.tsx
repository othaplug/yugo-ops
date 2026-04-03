"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowRight,
} from "@phosphor-icons/react";
import { INBOUND_SHIPMENT_STATUS_LABELS } from "@/lib/inbound-shipment-labels";

type Shipment = {
  id: string;
  shipment_number: string;
  status: string;
  partner_name: string | null;
  business_name: string | null;
  items: unknown;
  created_at: string;
  received_at: string | null;
  delivery_scheduled_date: string | null;
  customer_name: string | null;
  organization_id: string | null;
  business_email: string | null;
};

type Stats = {
  awaiting: number;
  in_transit: number;
  at_facility: number;
  ready: number;
  delivered: number;
};

function itemTitle(items: unknown): string {
  try {
    const arr = Array.isArray(items) ? items : [];
    const n = (arr[0] as { name?: string })?.name;
    return n?.trim() || "—";
  } catch {
    return "—";
  }
}

export default function InboundShipmentsClient() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [repeatSenders, setRepeatSenders] = useState<{ email: string; count: number; business_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/inbound-shipments");
    const j = await res.json();
    if (res.ok) {
      setShipments(j.shipments || []);
      setStats(j.stats || null);
      setRepeatSenders(j.repeatSenders || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-6 py-5 md:py-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--tx3)]/60 mb-1.5">B2B</p>
          <h1 className="admin-page-hero text-[var(--tx)]">
            Inbound Shipments
          </h1>
          <p className="text-sm text-[var(--tx3)] mt-2">Receive, inspect, store & deliver (RISSD)</p>
        </div>
        <Link
          href="/admin/inbound-shipments/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold)] text-[#1a1a1a] text-sm font-semibold hover:opacity-90"
        >
          <Plus size={18} weight="bold" aria-hidden />
          New Inbound Shipment
        </Link>
      </div>

      {repeatSenders.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm">
            <span className="font-semibold text-[var(--tx)]">Repeat sender</span>
            {repeatSenders.map((r) => (
              <span key={r.email} className="block text-[var(--tx3)] mt-0.5">
                {r.business_name || r.email} has {r.count} shipments without a partner account. Consider creating a partner for volume pricing.
              </span>
            ))}
          </div>
          <Link
            href="/admin/partners"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-800 hover:underline shrink-0"
          >
            Partners <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { key: "awaiting", label: "Awaiting", value: stats.awaiting },
            { key: "in_transit", label: "In transit", value: stats.in_transit },
            { key: "at_facility", label: "At facility", value: stats.at_facility },
            { key: "ready", label: "Ready to deliver", value: stats.ready },
            { key: "delivered", label: "Delivered", value: stats.delivered },
          ].map(({ key, label, value }) => (
            <div
              key={key}
              className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-4 py-3"
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)]">{label}</div>
              <div className="text-xl font-semibold text-[var(--tx)]">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--brd)] text-left text-[var(--tx3)] text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold">Delivery</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--tx3)]">
                    Loading…
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--tx3)]">
                    No inbound shipments yet.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--brd)]/60 hover:bg-[var(--bg2)]/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/inbound-shipments/${s.id}`} className="font-mono text-[var(--gold)] font-semibold hover:underline">
                        {s.shipment_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--tx)]">{itemTitle(s.items)}</td>
                    <td className="px-4 py-3">{INBOUND_SHIPMENT_STATUS_LABELS[s.status] || s.status}</td>
                    <td className="px-4 py-3 text-[var(--tx3)]">
                      {s.received_at
                        ? new Date(s.received_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--tx3)]">
                      {s.delivery_scheduled_date
                        ? new Date(s.delivery_scheduled_date + "T12:00:00").toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })
                        : "TBD"}
                    </td>
                    <td className="px-4 py-3 text-[var(--tx3)]">
                      {s.customer_name?.trim()
                        ? s.customer_name
                        : s.organization_id
                          ? "Pending details"
                          : "Pending details"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
