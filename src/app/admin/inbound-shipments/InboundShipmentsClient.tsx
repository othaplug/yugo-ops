"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CaretRight, ArrowRight } from "@phosphor-icons/react";
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
  const [repeatSenders, setRepeatSenders] = useState<
    { email: string; count: number; business_name: string | null }[]
  >([]);
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

  const statItems = stats
    ? [
        { key: "awaiting", label: "Awaiting", value: stats.awaiting },
        { key: "in_transit", label: "In transit", value: stats.in_transit },
        {
          key: "at_facility",
          label: "At facility",
          value: stats.at_facility,
        },
        { key: "ready", label: "Ready to deliver", value: stats.ready },
        { key: "delivered", label: "Delivered", value: stats.delivered },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-10 flex flex-col gap-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tx3)]/55">
            B2B
          </p>
          <h1 className="admin-page-hero text-[var(--tx)]">
            Inbound Shipments
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-[var(--tx3)]/90">
            Receive, inspect, store & deliver (RISSD)
          </p>
        </div>
        <Link
          href="/admin/inbound-shipments/new"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#2C3E2D]/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C3E2D] transition-colors hover:bg-[#2C3E2D]/[0.06] dark:border-[var(--brd)] dark:text-[var(--tx2)] dark:hover:bg-[var(--hover)] sm:self-auto"
        >
          New inbound shipment
          <CaretRight size={14} weight="bold" aria-hidden className="opacity-80" />
        </Link>
      </header>

      {repeatSenders.length > 0 && (
        <aside className="mb-8 flex flex-col gap-3 rounded-2xl bg-[var(--org)]/[0.06] px-4 py-3.5 ring-1 ring-[var(--org)]/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="text-sm text-[var(--tx2)]">
            <p className="font-semibold text-[var(--tx)]">Repeat sender</p>
            {repeatSenders.map((r) => (
              <p key={r.email} className="mt-1 text-[var(--tx3)]">
                {r.business_name || r.email} has {r.count} shipments without a
                partner account. Consider creating a partner for volume pricing.
              </p>
            ))}
          </div>
          <Link
            href="/admin/partners"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C3E2D] hover:underline dark:text-[var(--tx2)]"
          >
            Partners
            <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        </aside>
      )}

      {stats && (
        <section
          className="mb-10 overflow-hidden rounded-2xl bg-[var(--brd)]/[0.28] p-px shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-[var(--brd)]/35 dark:shadow-none"
          aria-label="Shipment status summary"
        >
          <dl className="grid grid-cols-2 gap-px sm:grid-cols-5">
            {statItems.map(({ key, label, value }) => (
              <div key={key} className="bg-[var(--card)] px-4 py-4 sm:px-5 sm:py-5">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/65">
                  {label}
                </dt>
                <dd className="mt-1.5 font-heading text-2xl font-semibold tabular-nums tracking-tight text-[var(--tx)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-label="Inbound shipments list">
        <div className="overflow-x-auto rounded-2xl bg-[var(--card)] shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-[var(--brd)]/40 dark:shadow-none dark:ring-[var(--brd)]/50">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--brd)]/50 text-left">
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Reference
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Item
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Received
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Delivery
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Customer
                </th>
              </tr>
            </thead>
            <tbody className="text-[var(--tx2)]">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-[var(--tx3)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-[15px] text-[var(--tx3)]/85"
                  >
                    No inbound shipments yet.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--brd)]/[0.35] transition-colors last:border-b-0 hover:bg-[var(--hover)]/80"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/inbound-shipments/${s.id}`}
                        className="font-mono text-[0.8125rem] font-semibold text-[#2C3E2D] underline-offset-2 hover:underline dark:text-[var(--tx2)]"
                      >
                        {s.shipment_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--tx)]">
                      {itemTitle(s.items)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--tx2)]">
                      {INBOUND_SHIPMENT_STATUS_LABELS[s.status] || s.status}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--tx3)]">
                      {s.received_at
                        ? new Date(s.received_at).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--tx3)]">
                      {s.delivery_scheduled_date
                        ? new Date(
                            s.delivery_scheduled_date + "T12:00:00",
                          ).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })
                        : "TBD"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--tx3)]">
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
      </section>
    </div>
  );
}
