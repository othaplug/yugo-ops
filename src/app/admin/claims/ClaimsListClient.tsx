"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import CreateButton from "../components/CreateButton";

interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  client_email: string;
  move_id: string | null;
  delivery_id: string | null;
  items: { name: string }[];
  total_claimed_value: number;
  approved_amount: number | null;
  status: string;
  valuation_tier: string;
  crew_team: string | null;
  submitted_at: string;
  resolved_at: string | null;
  created_at: string;
}

interface Stats {
  openCount: number;
  reviewCount: number;
  resolvedCount: number;
  totalPaidOut: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "partially_approved", label: "Partially Approved" },
  { value: "denied", label: "Denied" },
  { value: "settled", label: "Settled" },
  { value: "closed", label: "Closed" },
];

function statusBadge(status: string): string {
  switch (status) {
    case "submitted": return "bg-[var(--gold)]/15 text-[var(--gold)]";
    case "under_review": return "bg-[#3B82F6]/15 text-[#3B82F6]";
    case "approved": return "bg-[var(--grn)]/15 text-[var(--grn)]";
    case "partially_approved": return "bg-amber-500/15 text-amber-500";
    case "denied": return "bg-[var(--red)]/15 text-[var(--red)]";
    case "settled": case "closed": return "bg-[var(--brd)] text-[var(--tx3)]";
    default: return "bg-[var(--brd)] text-[var(--tx3)]";
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const claimColumns: ColumnDef<Claim>[] = [
  {
    id: "claim_number",
    label: "Claim #",
    accessor: (c) => c.claim_number,
    searchable: true,
    render: (c) => (
      <Link href={`/admin/claims/${c.id}`} className="font-semibold text-[var(--gold)] hover:underline" onClick={(e) => e.stopPropagation()}>
        {c.claim_number}
      </Link>
    ),
  },
  {
    id: "date",
    label: "Date",
    accessor: (c) => c.submitted_at || c.created_at,
    render: (c) => new Date(c.submitted_at || c.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
  },
  {
    id: "client",
    label: "Client",
    accessor: (c) => c.client_name,
    searchable: true,
    render: (c) => (
      <div>
        <div className="text-[var(--tx)] font-medium">{c.client_name}</div>
        <div className="text-[11px] text-[var(--tx3)]">{c.client_email}</div>
      </div>
    ),
  },
  {
    id: "items",
    label: "Items",
    accessor: (c) => (Array.isArray(c.items) ? c.items.length : 0),
    render: (c) => {
      const n = Array.isArray(c.items) ? c.items.length : 0;
      return `${n} item${n !== 1 ? "s" : ""}`;
    },
  },
  {
    id: "claimed",
    label: "Claimed",
    accessor: (c) => c.total_claimed_value,
    render: (c) => <span className="text-[var(--tx)] font-medium">{formatCurrency(c.total_claimed_value)}</span>,
    align: "right",
  },
  {
    id: "approved",
    label: "Approved",
    accessor: (c) => c.approved_amount,
    render: (c) => (c.approved_amount != null ? formatCurrency(c.approved_amount) : "—"),
    align: "right",
  },
  {
    id: "status",
    label: "Status",
    accessor: (c) => c.status,
    render: (c) => (
      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadge(c.status)}`}>
        {statusLabel(c.status)}
      </span>
    ),
  },
  {
    id: "crew",
    label: "Crew",
    accessor: (c) => c.crew_team || "",
    render: (c) => c.crew_team || "—",
  },
];

export default function ClaimsListClient({ claims: initialClaims, stats: initialStats }: { claims: Claim[]; stats: Stats }) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [statusFilter, setStatusFilter] = useState("");
  const router = useRouter();

  const refreshClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/claims");
      if (!res.ok) return;
      const json = await res.json();
      const allClaims: Claim[] = json.claims || [];
      setClaims(allClaims);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      setStats({
        openCount: allClaims.filter((c) => ["submitted", "under_review"].includes(c.status)).length,
        reviewCount: allClaims.filter((c) => c.status === "under_review").length,
        resolvedCount: allClaims.filter((c) =>
          ["approved", "partially_approved", "denied", "settled", "closed"].includes(c.status) &&
          c.resolved_at && c.resolved_at >= thirtyDaysAgo
        ).length,
        totalPaidOut: allClaims
          .filter((c) => c.approved_amount && c.resolved_at && c.resolved_at >= thirtyDaysAgo)
          .reduce((sum, c) => sum + (c.approved_amount || 0), 0),
      });
    } catch { /* network errors are non-fatal */ }
  }, []);

  // Poll every 30s for new claims
  useEffect(() => {
    const interval = setInterval(refreshClaims, 30_000);
    return () => clearInterval(interval);
  }, [refreshClaims]);

  const filtered = useMemo(
    () => (statusFilter ? claims.filter((c) => c.status === statusFilter) : claims),
    [claims, statusFilter]
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--tx)]">Claims</h1>
          <p className="text-[13px] text-[var(--tx3)]">Damage claims and valuation protection payouts</p>
        </div>
        <CreateButton href="/admin/claims/new" title="New Claim" />
      </div>

      {/* Stats row — bare */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 mb-8 pt-6 border-t border-[var(--brd)]/30">
        <StatCard label="Open Claims" value={stats.openCount} color="var(--gold)" />
        <StatCard label="Under Review" value={stats.reviewCount} color="#3B82F6" />
        <StatCard label="Resolved (30d)" value={stats.resolvedCount} color="var(--grn)" />
        <StatCard label="Paid Out (30d)" value={formatCurrency(stats.totalPaidOut)} color="var(--tx)" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable<Claim>
        data={filtered}
        columns={claimColumns}
        keyField="id"
        tableId="claims-list"
        searchable
        searchPlaceholder="Search by claim #, client, email…"
        pagination
        exportable
        exportFilename="yugo-claims"
        columnToggle
        selectable
        onRowClick={(c) => router.push(`/admin/claims/${c.id}`)}
        emptyMessage={claims.length === 0 ? "No claims yet" : "No claims match your filters"}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">{label}</p>
      <p className="text-[24px] font-bold font-heading" style={{ color }}>{value}</p>
    </div>
  );
}
