"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Truck,
  CalendarBlank,
  CurrencyDollar,
  MagnifyingGlass,
  ArrowSquareOut,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";

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
  confirmed: "bg-blue-500/15 text-blue-400",
  drop_off_scheduled: "bg-purple-500/15 text-purple-400",
  bins_delivered: "bg-emerald-500/15 text-emerald-400",
  in_use: "bg-amber-500/15 text-amber-400",
  pickup_scheduled: "bg-sky-500/15 text-sky-400",
  bins_collected: "bg-teal-500/15 text-teal-400",
  completed: "bg-green-500/15 text-green-400",
  overdue: "bg-red-500/15 text-red-400",
  cancelled: "bg-neutral-500/15 text-neutral-400",
};

const BUNDLE_LABELS: Record<string, string> = {
  studio: "Studio", "1br": "1BR", "2br": "2BR",
  "3br": "3BR", "4br_plus": "4BR+", individual: "Custom",
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

export default function BinRentalsClient({ orders, stats }: { orders: BinOrder[]; stats: Stats }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  return (
    <PageContent>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<Package size={18} color="#C9A962" />}
          label="Active Orders"
          value={String(stats.activeOrders)}
          color="#C9A962"
        />
        <StatCard
          icon={<Truck size={18} color="#7C9FD4" />}
          label="Drop-offs This Week"
          value={String(stats.dropoffsThisWeek)}
          color="#7C9FD4"
        />
        <StatCard
          icon={<CalendarBlank size={18} color="#B07FD4" />}
          label="Pickups This Week"
          value={String(stats.pickupsThisWeek)}
          color="#B07FD4"
        />
        <StatCard
          icon={<CurrencyDollar size={18} color="#22c55e" />}
          label="Revenue (30d)"
          value={fmtMoney(stats.revenue30d)}
          color="#22c55e"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order, client, address…"
            className="w-full pl-8 pr-4 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:outline-none focus:border-[var(--gold)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--tx)] focus:outline-none focus:border-[var(--gold)]"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Link
          href="/admin/quotes/new"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30 rounded-lg text-[13px] font-medium hover:bg-[var(--gold)]/25 transition-colors whitespace-nowrap"
        >
          <ArrowSquareOut size={14} /> Generate quote
        </Link>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                {["Order", "Client", "Bundle", "Move Date", "Drop-off", "Pickup", "Status", "Total"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold tracking-widest uppercase text-[var(--tx3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--tx3)]">
                    {search || statusFilter !== "all" ? "No orders match your filter." : "No bin orders yet."}
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/admin/bin-rentals/${o.id}`)}
                  className="border-b border-[var(--brd)]/50 hover:bg-[var(--gdim)]/50 cursor-pointer transition-colors last:border-0"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-[var(--gold)]">
                    <div className="flex items-center gap-1.5">
                      {o.order_number}
                      {o.status === "overdue" && <Warning size={12} color="#ef4444" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--tx)]">{o.client_name}</div>
                    <div className="text-[11px] text-[var(--tx3)]">{o.client_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{BUNDLE_LABELS[o.bundle_type] || o.bundle_type}</span>
                    <span className="text-[var(--tx3)] ml-1">({o.bin_count})</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--tx2)]">{fmtDate(o.move_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {o.drop_off_completed_at
                        ? <CheckCircle size={12} color="#22c55e" />
                        : <span className="w-3 h-3 rounded-full border border-[var(--brd)]" />}
                      <span className="text-[var(--tx2)]">{fmtDate(o.drop_off_date)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {o.pickup_completed_at
                        ? <CheckCircle size={12} color="#22c55e" />
                        : <span className="w-3 h-3 rounded-full border border-[var(--brd)]" />}
                      <span className="text-[var(--tx2)]">{fmtDate(o.pickup_date)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[o.status] || "bg-[var(--gdim)] text-[var(--tx3)]"}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--tx)]">
                    ${Number(o.total).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[var(--tx3)] mt-3 text-right">
        {filtered.length} of {orders.length} orders
      </p>
    </PageContent>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3)]">{label}</span>
      </div>
      <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
