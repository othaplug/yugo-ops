"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import BackButton from "../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  drop_off_scheduled: "Drop-off Scheduled",
  bins_delivered: "Delivered",
  in_use: "In Use",
  pickup_scheduled: "Pickup Scheduled",
  bins_collected: "Collected",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "text-[var(--grn)]",
  drop_off_scheduled: "text-[var(--blue)]",
  bins_delivered: "text-[var(--grn)]",
  in_use: "text-[var(--blue)]",
  pickup_scheduled: "text-[var(--blue)]",
  bins_collected: "text-[var(--grn)]",
  completed: "text-[var(--grn)]",
  overdue: "text-[var(--red)]",
  cancelled: "text-[var(--tx3)]",
};

const BUNDLE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1BR",
  "2br": "2BR",
  "3br": "3BR",
  "4br_plus": "4BR+",
  individual: "Custom",
};

interface BinOrder {
  id: string;
  order_number: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  delivery_address: string;
  bundle_type: string;
  bin_count: number;
  move_date: string;
  drop_off_date: string;
  pickup_date: string;
  status: string;
  total: number;
  source: string;
  created_at: string;
  drop_off_completed_at: string | null;
  pickup_completed_at: string | null;
  bins_missing: number;
  move_id: string | null;
}

interface Stats {
  activeOrders: number;
  dropoffsThisWeek: number;
  pickupsThisWeek: number;
  revenue30d: number;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="relative my-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[var(--brd)]" />
      </div>
      <div className="relative flex justify-start">
        <span className="bg-[var(--bg)] pr-4 text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 select-none">
          {label}
        </span>
      </div>
    </div>
  );
}

function KpiBlock({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="cursor-default">
      <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/82 mb-2">{label}</p>
      <p
        className={`text-[28px] font-bold font-heading leading-none ${
          accent ? "text-[var(--grn)]" : "text-[var(--tx)]"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[9px] text-[var(--tx3)] mt-1.5">{sub}</p>}
    </div>
  );
}

export default function BinRentalsClient({ orders, stats }: { orders: BinOrder[]; stats: Stats }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const router = useRouter();

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.client_name.toLowerCase().includes(q) ||
          o.client_email.toLowerCase().includes(q) ||
          o.delivery_address.toLowerCase().includes(q),
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 md:px-8 py-6 md:py-8 animate-fade-up min-w-0 w-full">
      <div className="mb-6">
        <BackButton label="Back" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)] mb-1.5">Operations</p>
          <h1 className="admin-page-hero text-[var(--tx)]">Bin Rentals</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-1.5 max-w-[640px]">
            Track bin orders, drop offs, and pickups across every active rental.
          </p>
        </div>
        <Link
          href="/admin/quotes/new?service=bin_rental"
          className="inline-flex items-center justify-center gap-2 shrink-0 rounded-lg bg-[var(--yu3-wine)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-on-wine)] shadow-sm transition-colors hover:bg-[var(--yu3-wine-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]"
        >
          Generate quote
        </Link>
      </div>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--brd)]" />
        </div>
        <div className="relative flex justify-start">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            className="bg-[var(--bg)] pr-4 flex items-center gap-2 text-left min-w-0 touch-manipulation hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E2D]/40 rounded-sm"
            aria-expanded={summaryOpen}
          >
            {summaryOpen ? (
              <CaretDown className="w-3.5 h-3.5 shrink-0 text-[var(--tx3)]" weight="bold" aria-hidden />
            ) : (
              <CaretRight className="w-3.5 h-3.5 shrink-0 text-[var(--tx3)]" weight="bold" aria-hidden />
            )}
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 select-none">
              Summary
            </span>
          </button>
        </div>
      </div>

      {summaryOpen ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
          <KpiBlock label="Active Orders" value={String(stats.activeOrders)} sub="In progress" />
          <KpiBlock label="Drop-offs This Week" value={String(stats.dropoffsThisWeek)} />
          <KpiBlock label="Pickups This Week" value={String(stats.pickupsThisWeek)} />
          <KpiBlock label="Revenue (30d)" value={formatCompactCurrency(stats.revenue30d)} sub="Paid orders" accent />
        </div>
      ) : null}

      <SectionDivider label="Orders" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order, client, address…"
          className="admin-input flex-1 min-w-0"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-select sm:min-w-[160px]"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="md:hidden divide-y divide-[var(--brd)] border-t border-b border-[var(--brd)]">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--tx3)]">
            {search || statusFilter !== "all" ? "No orders match your filter." : "No bin orders yet."}
          </div>
        ) : (
          filtered.map((o) => (
            <Link
              key={o.id}
              href={`/admin/bin-rentals/${o.id}`}
              className="block py-4 text-left hover:bg-[var(--gdim)]/40 transition-colors active:opacity-90 touch-manipulation"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-[15px] text-[var(--gold)]">
                    <span className="truncate inline-block max-w-full align-bottom">{o.order_number}</span>
                    {o.status === "overdue" && (
                      <span className="text-red-400 text-[11px] font-semibold ml-1.5 normal-case">Overdue</span>
                    )}
                  </div>
                  <p className="text-[14px] font-semibold text-[var(--tx)] truncate mt-0.5">{o.client_name}</p>
                  <p className="text-[12px] text-[var(--tx3)] truncate">{o.client_email}</p>
                </div>
                <span
                  className={`shrink-0 dt-badge tracking-[0.04em] ${
                    STATUS_STYLES[o.status] || "text-[var(--tx3)]"
                  }`}
                >
                  {STATUS_LABELS[o.status] || o.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-[var(--tx2)]">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] block mb-0.5">
                    Bundle
                  </span>
                  {BUNDLE_LABELS[o.bundle_type] || o.bundle_type}{" "}
                  <span className="text-[var(--tx3)]">({o.bin_count})</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] block mb-0.5">
                    Move date
                  </span>
                  {fmtDate(o.move_date)}
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] block mb-0.5">
                    Drop-off
                  </span>
                  {fmtDate(o.drop_off_date)}
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] block mb-0.5">
                    Pickup
                  </span>
                  {fmtDate(o.pickup_date)}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px]">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">Total</span>
                <span className="text-[17px] font-bold text-[var(--tx)]">${Number(o.total).toFixed(0)}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)]">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Client</th>
              <th>Bundle</th>
              <th>Move Date</th>
              <th>Drop-off</th>
              <th>Pickup</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[var(--yu3-ink-muted)]">
                  {search || statusFilter !== "all" ? "No orders match your filter." : "No bin orders yet."}
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/admin/bin-rentals/${o.id}`)}
                className="cursor-pointer"
              >
                <td className="font-mono font-semibold text-[var(--yu3-ink-strong)] whitespace-nowrap">
                  {o.order_number}
                  {o.status === "overdue" && (
                    <span className="text-[var(--red)] text-[11px] font-semibold ml-1.5 normal-case">Overdue</span>
                  )}
                </td>
                <td>
                  <div className="font-medium text-[var(--yu3-ink-strong)]">{o.client_name}</div>
                  <div className="text-[11px] text-[var(--yu3-ink-muted)]">{o.client_email}</div>
                </td>
                <td>
                  <span className="font-medium">{BUNDLE_LABELS[o.bundle_type] || o.bundle_type}</span>
                  <span className="text-[var(--yu3-ink-muted)] ml-1">({o.bin_count})</span>
                </td>
                <td className="text-[var(--yu3-ink-muted)] whitespace-nowrap [font-feature-settings:'tnum'_1]">{fmtDate(o.move_date)}</td>
                <td className="text-[var(--yu3-ink-muted)] whitespace-nowrap [font-feature-settings:'tnum'_1]">{fmtDate(o.drop_off_date)}</td>
                <td className="text-[var(--yu3-ink-muted)] whitespace-nowrap [font-feature-settings:'tnum'_1]">{fmtDate(o.pickup_date)}</td>
                <td>
                  <span
                    className={`dt-badge tracking-[0.04em] ${
                      STATUS_STYLES[o.status] || "text-[var(--yu3-ink-muted)]"
                    }`}
                  >
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="text-right font-semibold text-[var(--yu3-ink-strong)] whitespace-nowrap [font-feature-settings:'tnum'_1]">${Number(o.total).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[var(--tx3)] mt-4 text-right">{filtered.length} of {orders.length} orders</p>
    </div>
  );
}
