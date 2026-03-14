"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { StatPctChange } from "../components/StatPctChange";
import MoveNotifyButton from "./MoveNotifyButton";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { getMoveDetailPath } from "@/lib/move-code";
import { getStatusLabel } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

/* ── Types ── */

interface Move {
  id: string;
  move_code?: string;
  client_name?: string;
  client_email?: string;
  from_address?: string;
  to_address?: string;
  scheduled_date?: string;
  estimate?: number;
  status?: string;
  move_type?: string;
  service_type?: string;
  tier_selected?: string;
  crew_id?: string;
  created_at?: string;
}

interface Quote {
  id: string;
  quote_id: string;
  contact_id: string;
  client_name: string;
  service_type: string;
  status: string;
  tiers: unknown;
  custom_price: number | null;
  sent_at: string | null;
  created_at: string;
  from_address?: string;
  to_address?: string;
}

/* ── Constants ── */

const TYPE_FILTERS = [
  { value: "", label: "All Types" },
  { value: "residential", label: "Residential" },
  { value: "office", label: "Office" },
  { value: "single_item", label: "Single Item" },
  { value: "white_glove", label: "White Glove" },
  { value: "specialty", label: "Specialty" },
  { value: "b2b", label: "B2B" },
];

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "quoted", label: "Quoted" },
  { value: "cancelled", label: "Cancelled" },
];

function normalizeType(move: Move): string {
  const mt = (move.move_type || move.service_type || "").toLowerCase();
  if (mt.includes("office") || mt.includes("commercial")) return "office";
  if (mt.includes("single")) return "single_item";
  if (mt.includes("white")) return "white_glove";
  if (mt.includes("special")) return "specialty";
  if (mt.includes("b2b")) return "b2b";
  if (mt.includes("residential") || mt.includes("local")) return "residential";
  return mt || "residential";
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    residential: "Residential",
    office: "Office",
    single_item: "Single Item",
    white_glove: "White Glove",
    specialty: "Specialty",
    b2b: "B2B",
  };
  return map[type] || type;
}

function statusBarColor(status: string): string {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  if (["confirmed", "completed", "paid"].includes(s)) return "bg-[var(--grn)]";
  if (["scheduled", "in_progress"].includes(s)) return "bg-[#3B82F6]";
  if (["quoted", "quote"].includes(s)) return "bg-[var(--gold)]";
  if (s === "cancelled") return "bg-[var(--red)]";
  return "bg-[var(--gold)]";
}

function statusBadgeStyle(status: string): string {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  if (["confirmed", "completed", "paid"].includes(s))
    return "bg-[var(--grn)]/15 text-[var(--grn)]";
  if (["scheduled", "in_progress"].includes(s)) return "bg-[#3B82F6]/15 text-[#3B82F6]";
  if (["quoted", "quote"].includes(s)) return "bg-[var(--gold)]/15 text-[var(--gold)]";
  if (s === "cancelled") return "bg-[var(--red)]/15 text-[var(--red)]";
  return "bg-[var(--gold)]/15 text-[var(--gold)]";
}

function tierBadgeStyle(tier: string): string {
  const t = (tier || "").toLowerCase();
  if (t.includes("estate")) return "bg-[#7C3AED]/15 text-[#7C3AED]";
  if (t.includes("premier")) return "bg-[var(--gold)]/15 text-[var(--gold)]";
  return "bg-[var(--brd)] text-[var(--tx3)]";
}

function quoteStatusBadge(status: string): { bg: string; text: string } {
  switch (status) {
    case "sent":
      return { bg: "bg-[var(--gold)]/15", text: "text-[var(--gold)]" };
    case "viewed":
      return { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]" };
    case "accepted":
      return { bg: "bg-[var(--grn)]/15", text: "text-[var(--grn)]" };
    case "expired":
    case "declined":
      return { bg: "bg-[var(--red)]/15", text: "text-[var(--red)]" };
    default:
      return { bg: "bg-[var(--brd)]", text: "text-[var(--tx3)]" };
  }
}

function serviceTypeLabel(st: string): string {
  const map: Record<string, string> = {
    local_move: "Residential",
    long_distance: "Residential",
    office_move: "Office",
    single_item: "Single Item",
    white_glove: "White Glove",
    specialty: "Specialty",
    b2b_delivery: "B2B",
  };
  return map[st] || st;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function quoteAmountRaw(q: Quote): number | null {
  if (q.custom_price) return q.custom_price;
  if (q.tiers && typeof q.tiers === "object") {
    const tiers = q.tiers as Record<string, { total?: number }>;
    const first = Object.values(tiers).find((t) => t?.total);
    if (first?.total) return first.total;
  }
  return null;
}

function quoteAmount(q: Quote): string {
  const raw = quoteAmountRaw(q);
  return raw != null ? formatCurrency(raw) : "—";
}

function hstAmount(n: number): string {
  return formatCurrency(Math.round(n * 0.13));
}

function truncAddr(from?: string, to?: string, max = 50): string {
  const f = (from || "").trim();
  const t = (to || "").trim();
  if (!f && !t) return "—";
  const full = f && t ? `${f} → ${t}` : f || t;
  return full.length <= max ? full : full.slice(0, max - 1) + "…";
}

const today = new Date().toISOString().slice(0, 10);

type MoveWithType = Move & { _type: string };

function moveColumns(crewMap: Record<string, string>): ColumnDef<MoveWithType>[] {
  return [
    {
      id: "move_code",
      label: "Move ID",
      accessor: (m) => m.move_code || "",
      render: (m) => (
        <span className="text-[11px] font-mono font-bold text-[var(--gold)] whitespace-nowrap">
          {m.move_code || "—"}
        </span>
      ),
      minWidth: "90px",
    },
    {
      id: "date",
      label: "Date",
      accessor: (m) => m.scheduled_date || "",
      render: (m) => (
        <span className="text-[11px] font-semibold text-[var(--tx)] tabular-nums whitespace-nowrap">
          {formatMoveDate(m.scheduled_date)}
        </span>
      ),
      minWidth: "70px",
    },
    {
      id: "client",
      label: "Client",
      accessor: (m) => m.client_name || "",
      render: (m) => (
        <div className="min-w-0">
          <span className="text-[12px] font-bold text-[var(--tx)] truncate block">{m.client_name || "—"}</span>
          <span className="text-[10px] text-[var(--tx3)] truncate block mt-0.5">{truncAddr(m.from_address, m.to_address, 40)}</span>
        </div>
      ),
      minWidth: "180px",
    },
    {
      id: "status",
      label: "Status",
      accessor: (m) => m.status || "",
      render: (m) => (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${statusBadgeStyle(m.status || "")}`}>
          {getStatusLabel(m.status ?? null)}
        </span>
      ),
    },
    {
      id: "type",
      label: "Type",
      accessor: (m) => m._type || "",
      render: (m) => (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-medium bg-[var(--bg2)] text-[var(--tx3)] border border-[var(--brd)]/50">
            {typeLabel(m._type)}
          </span>
          {m._type === "residential" && m.tier_selected && (
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide ${tierBadgeStyle(m.tier_selected)}`}>
              {toTitleCase(m.tier_selected)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "crew",
      label: "Crew",
      accessor: (m) => (m.crew_id ? crewMap[m.crew_id] || "" : ""),
      render: (m) => (
        <span className="text-[11px] text-[var(--tx3)]">{m.crew_id ? crewMap[m.crew_id] || "—" : "—"}</span>
      ),
      defaultHidden: false,
    },
    {
      id: "estimate",
      label: "Estimate",
      accessor: (m) => m.estimate ?? 0,
      render: (m) => {
        const est = Number(m.estimate ?? 0);
        return (
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[12px] font-bold text-[var(--gold)] font-heading">{formatCurrency(est)}</span>
            {est > 0 && <span className="text-[8px] text-[var(--tx3)]">+{hstAmount(est)} HST</span>}
          </span>
        );
      },
      align: "right",
      exportAccessor: (m) => m.estimate ?? 0,
    },
    {
      id: "actions",
      label: "",
      accessor: () => "",
      sortable: false,
      searchable: false,
      render: (m) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <MoveNotifyButton move={m} />
        </div>
      ),
      align: "right",
    },
  ];
}

/* ── Component ── */

export default function AllMovesClient({
  moves,
  recentQuotes,
  crewMap,
}: {
  moves: Move[];
  recentQuotes: Quote[];
  crewMap: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeType = searchParams.get("type") || "";
  const activeStatus = searchParams.get("status") || "";

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const movesWithType = useMemo(
    () => moves.map((m) => ({ ...m, _type: normalizeType(m) })),
    [moves],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    movesWithType.forEach((m) => {
      counts[m._type] = (counts[m._type] || 0) + 1;
    });
    return counts;
  }, [movesWithType]);

  const afterTypeFilter = useMemo(
    () => (activeType ? movesWithType.filter((m) => m._type === activeType) : movesWithType),
    [movesWithType, activeType],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    afterTypeFilter.forEach((m) => {
      const s = (m.status || "").toLowerCase().replace(/\s+/g, "_");
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [afterTypeFilter]);

  const filtered = useMemo(
    () =>
      activeStatus
        ? afterTypeFilter.filter(
            (m) => (m.status || "").toLowerCase().replace(/\s+/g, "_") === activeStatus,
          )
        : afterTypeFilter,
    [afterTypeFilter, activeStatus],
  );

  // Stats — react to active type filter
  const statsSource = afterTypeFilter;
  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthStart =
    now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12-01`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const totalMoves = statsSource.length;
  const totalMovesThisMonth = statsSource.filter(
    (m) => (m.scheduled_date || "") >= thisMonthStart,
  ).length;
  const totalMovesPrev = statsSource.filter((m) => {
    const d = m.scheduled_date || "";
    return d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  const upcomingMoves = statsSource.filter((m) => (m.scheduled_date || "") >= today).length;
  const upcomingPrev = (() => {
    const pt = new Date(now);
    pt.setDate(pt.getDate() - 30);
    const pts = pt.toISOString().slice(0, 10);
    return statsSource.filter(
      (m) => (m.scheduled_date || "") >= pts && (m.scheduled_date || "") < today,
    ).length;
  })();

  const totalRevenue = statsSource.reduce((s, m) => s + Number(m.estimate || 0), 0);
  const totalRevenuePrev = statsSource
    .filter((m) => {
      const d = m.scheduled_date || "";
      return d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((s, m) => s + Number(m.estimate || 0), 0);

  const avgPerMove = totalMoves > 0 ? totalRevenue / totalMoves : 0;
  const avgPrev =
    totalMovesPrev > 0
      ? statsSource
          .filter((m) => {
            const d = m.scheduled_date || "";
            return d >= lastMonthStart && d <= lastMonthEnd;
          })
          .reduce((s, m) => s + Number(m.estimate || 0), 0) / totalMovesPrev
      : 0;

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">All Moves</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">
            Manage all service types in one view
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/quotes/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors whitespace-nowrap"
          >
            New Quote
          </Link>
          <Link
            href="/admin/moves/new"
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors whitespace-nowrap"
          >
            + New Move
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
            Total Moves
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{totalMoves}</span>
            <StatPctChange current={totalMovesThisMonth} previous={totalMovesPrev} />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
            Upcoming
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--grn)]">
              {upcomingMoves}
            </span>
            <StatPctChange current={upcomingMoves} previous={upcomingPrev} />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
            Total Revenue
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--gold)]">
              {formatCompactCurrency(totalRevenue)}
            </span>
            <StatPctChange current={totalRevenue} previous={totalRevenuePrev} />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
            Avg $/Move
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">
              {formatCompactCurrency(avgPerMove)}
            </span>
            <StatPctChange current={avgPerMove} previous={avgPrev} />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--brd)]/30 pt-5 mb-5">
        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {TYPE_FILTERS.map((f) => {
            const isActive = activeType === f.value;
            const count = f.value ? typeCounts[f.value] || 0 : moves.length;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter("type", f.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-150 ${
                  isActive
                    ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)] shadow-[0_0_0_1px_rgba(201,169,98,0.25)]"
                    : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)]/50 hover:text-[var(--tx)] hover:bg-[var(--gdim)]"
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${isActive ? "text-[var(--gold)]" : "text-[var(--tx3)]/60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-0">
          {STATUS_FILTERS.map((f) => {
            const isActive = activeStatus === f.value;
            const count = f.value ? statusCounts[f.value] || 0 : afterTypeFilter.length;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter("status", f.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all duration-150 ${
                  isActive
                    ? "border-[var(--tx3)]/60 bg-[var(--bg2)] text-[var(--tx)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                    : "border-transparent text-[var(--tx3)] hover:border-[var(--brd)] hover:bg-[var(--bg2)] hover:text-[var(--tx2)]"
                }`}
              >
                {f.label}
                {f.value && count > 0 && (
                  <span className="text-[var(--tx3)]/50 tabular-nums">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Moves table */}
      <div className="border-t border-[var(--brd)]/30 pt-5 mb-8">
        <DataTable
          data={filtered}
          keyField="id"
          tableId="all-moves"
          searchable
          searchPlaceholder="Search by client, address, code…"
          pagination
          defaultPerPage={50}
          exportable
          exportFilename="yugo-moves"
          columnToggle
          selectable
          emptyMessage="No moves match the current filters"
          onRowClick={(m) => router.push(getMoveDetailPath(m))}
          columns={moveColumns(crewMap)}
        />
      </div>

      {/* Recent Quotes — horizontal scroll strip */}
      {recentQuotes.length > 0 && (
        <div className="border-t border-[var(--brd)]/30 pt-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Recent Quotes</h2>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[var(--brd)] scrollbar-track-transparent">
            {recentQuotes.map((q) => {
              const badge = quoteStatusBadge(q.status);
              return (
                <Link
                  key={q.id}
                  href={`/admin/quotes/${q.quote_id || q.id}/edit`}
                  className="shrink-0 w-[220px] p-3.5 rounded-xl border border-[var(--brd)]/30 bg-[var(--card)] hover:border-[var(--gold)]/40 hover:bg-[var(--card)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.25),0_0_0_1px_rgba(201,169,98,0.18)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 block cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-[var(--tx3)]">{q.quote_id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${badge.bg} ${badge.text}`}
                    >
                      {toTitleCase(q.status)}
                    </span>
                  </div>
                  <div className="text-[13px] font-bold text-[var(--tx)] truncate">
                    {q.client_name || "—"}
                  </div>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                    {serviceTypeLabel(q.service_type)} · {relativeTime(q.sent_at || q.created_at)}
                  </div>
                  <div className="mt-1.5">
                    <span className="text-[14px] font-bold text-[var(--gold)] font-heading">
                      {quoteAmount(q)}
                    </span>
                    {quoteAmountRaw(q) != null && (
                      <span className="text-[8px] text-[var(--tx3)] ml-0.5">+{hstAmount(quoteAmountRaw(q)!)} HST</span>
                    )}
                  </div>
                </Link>
              );
            })}
            {/* View All at the end */}
            <Link
              href="/admin/quotes"
              className="shrink-0 w-[140px] rounded-lg flex flex-col items-center justify-center gap-1.5 hover:bg-[var(--bg)]/30 transition-colors p-3.5"
            >
              <span className="text-[20px] text-[var(--gold)]">→</span>
              <span className="text-[11px] font-semibold text-[var(--gold)]">View All</span>
              <span className="text-[9px] text-[var(--tx3)]">Quotes</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
