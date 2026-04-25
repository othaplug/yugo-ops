"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CaretRight, ArrowRight } from "@phosphor-icons/react";
import { INBOUND_SHIPMENT_STATUS_LABELS } from "@/lib/inbound-shipment-labels";
import { RissdWorkflowHint } from "@/components/admin/AdminContextHints";
import { KpiStrip, type KpiTile } from "@/design-system/admin/dashboard";
import { PageHeader } from "@/design-system/admin/layout";
import { Button } from "@/design-system/admin/primitives/Button";

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
    return n?.trim() || "";
  } catch {
    return "";
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

  const statTiles: KpiTile[] = stats
    ? [
        { id: "awaiting", label: "Awaiting", value: stats.awaiting },
        { id: "in_transit", label: "In transit", value: stats.in_transit },
        { id: "at_facility", label: "At facility", value: stats.at_facility },
        { id: "ready", label: "Ready to deliver", value: stats.ready },
        { id: "delivered", label: "Delivered", value: stats.delivered },
      ]
    : [];

  return (
    <div className="w-full min-w-0 py-5 md:py-6">
      <PageHeader
        className="mb-6"
        eyebrow="B2B"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Inbound Shipments</span>
            <RissdWorkflowHint ariaLabel="What RISSD means" />
          </span>
        }
        description="Track partner-sent freight from origin to delivery scheduling."
        actions={
          <Button asChild variant="primary" size="md" uppercase className="self-start sm:self-auto">
            <Link
              href="/admin/inbound-shipments/new"
              className="inline-flex items-center gap-1.5"
            >
              New inbound shipment
              <CaretRight size={14} weight="bold" aria-hidden className="opacity-90" />
            </Link>
          </Button>
        }
      />

      {repeatSenders.length > 0 && (
        <aside className="mb-6 flex flex-col gap-3 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-wine-tint)]/35 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="text-sm text-[var(--yu3-ink)]">
            <p className="font-semibold text-[var(--yu3-ink-strong)]">Repeat sender</p>
            {repeatSenders.map((r) => (
              <p key={r.email} className="mt-1 text-[var(--yu3-ink-muted)]">
                {r.business_name || r.email} has {r.count} shipments without a
                partner account. Consider creating a partner for volume pricing.
              </p>
            ))}
          </div>
          <Button asChild variant="secondary" size="sm" className="shrink-0">
            <Link href="/admin/partners" className="inline-flex items-center gap-1.5">
              Partners
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </Button>
        </aside>
      )}

      {stats ? (
        <section className="mb-8" aria-label="Shipment status summary">
          <KpiStrip variant="pills" tiles={statTiles} />
        </section>
      ) : null}

      <section
        aria-label="Inbound shipments list"
        className="overflow-hidden rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)]"
      >
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Item</th>
                <th scope="col">Status</th>
                <th scope="col">Received</th>
                <th scope="col">Delivery</th>
                <th scope="col">Customer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-[var(--yu3-ink-faint)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-[var(--yu3-ink-faint)]"
                  >
                    No inbound shipments yet.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/admin/inbound-shipments/${s.id}`}
                        className="font-mono text-[12px] font-semibold text-[var(--yu3-ink-strong)] hover:underline tabular-nums"
                      >
                        {s.shipment_number}
                      </Link>
                    </td>
                    <td className="text-[var(--yu3-ink)]">{itemTitle(s.items)}</td>
                    <td
                      className={
                        s.status === "delivered"
                          ? "text-[var(--yu3-success)] font-medium"
                          : "text-[var(--yu3-ink-muted)]"
                      }
                    >
                      {INBOUND_SHIPMENT_STATUS_LABELS[s.status] || s.status}
                    </td>
                    <td className="tabular-nums text-[var(--yu3-ink-muted)]">
                      {s.received_at
                        ? new Date(s.received_at).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </td>
                    <td className="tabular-nums text-[var(--yu3-ink-muted)]">
                      {s.delivery_scheduled_date
                        ? new Date(
                            s.delivery_scheduled_date + "T12:00:00",
                          ).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </td>
                    <td className="text-[var(--yu3-ink-muted)]">
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
