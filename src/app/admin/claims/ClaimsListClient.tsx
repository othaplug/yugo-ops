"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import DataTable, { type ColumnDef, type BulkAction } from "@/components/admin/DataTable";
import { formatAdminCreatedAt } from "@/lib/date-format";
import { useToast } from "../components/Toast";
import CreateButton from "../components/CreateButton";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  client_email: string;
  move_id: string | null;
  move_code?: string | null;
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
    case "submitted": return "text-[var(--gold)]";
    case "under_review": return "text-blue-700 dark:text-sky-300";
    case "approved": return "text-[var(--grn)]";
    case "partially_approved": return "text-amber-500";
    case "denied": return "text-[var(--red)]";
    case "settled": case "closed": return "text-[var(--tx3)]";
    default: return "text-[var(--tx3)]";
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
    id: "created_at",
    label: "Create date",
    accessor: (c) => c.created_at,
    sortable: true,
    render: (c) => (
      <span className="text-[11px] text-[var(--tx2)] tabular-nums whitespace-nowrap">
        {formatAdminCreatedAt(c.created_at)}
      </span>
    ),
    exportAccessor: (c) => formatAdminCreatedAt(c.created_at),
  },
  {
    id: "date",
    label: "Submitted",
    accessor: (c) => c.submitted_at || c.created_at,
    sortable: true,
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
    id: "move",
    label: "Move",
    accessor: (c) => c.move_code || c.move_id || "",
    render: (c) =>
      c.move_code ? (
        <Link
          href={`/admin/moves/${c.move_code}`}
          className="text-[11px] font-semibold text-[#2C3E2D] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {c.move_code}
        </Link>
      ) : c.move_id ? (
        <Link
          href={`/admin/moves/${c.move_id}`}
          className="text-[11px] font-semibold text-[#2C3E2D] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View move
        </Link>
      ) : (
        "-"
      ),
    searchable: true,
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
    render: (c) => (c.approved_amount != null ? formatCurrency(c.approved_amount) : "-"),
    align: "right",
  },
  {
    id: "status",
    label: "Status",
    accessor: (c) => c.status,
    render: (c) => (
      <span className={`dt-badge tracking-[0.04em] ${statusBadge(c.status)}`}>
        {statusLabel(c.status)}
      </span>
    ),
  },
  {
    id: "crew",
    label: "Crew",
    accessor: (c) => c.crew_team || "",
    render: (c) => c.crew_team || "-",
  },
];

export default function ClaimsListClient({ claims: initialClaims, stats: initialStats }: { claims: Claim[]; stats: Stats }) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [statusFilter, setStatusFilter] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const runBulk = useCallback(
    async (action: "resolve" | "close", ids: string[]) => {
      const res = await fetch("/api/admin/claims/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      if (data.ok) {
        const labels: Record<string, string> = { resolve: "Marked resolved", close: "Closed" };
        toast(`${labels[action]} ${data.updated} claim${data.updated !== 1 ? "s" : ""}`, "check");
        router.refresh();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [toast, router],
  );

  const bulkActions: BulkAction[] = useMemo(
    () => [
      { label: "Mark Resolved", onClick: (ids) => runBulk("resolve", ids) },
      { label: "Close", onClick: (ids) => runBulk("close", ids), variant: "danger" as const },
    ],
    [runBulk],
  );

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
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">Operations</p>
          <h1 className="admin-page-hero text-[var(--tx)]">Claims</h1>
        </div>
        <CreateButton href="/admin/claims/new" title="New Claim" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Open Claims" value={String(stats.openCount)} sub="awaiting action" warn={stats.openCount > 0} />
        <KpiCard label="Under Review" value={String(stats.reviewCount)} sub="being assessed" />
        <KpiCard label="Resolved (30d)" value={String(stats.resolvedCount)} sub="last 30 days" accent={stats.resolvedCount > 0} />
        <KpiCard label="Paid Out (30d)" value={formatCurrency(stats.totalPaidOut)} sub="approved payouts" />
      </div>

      <SectionDivider label="All Claims" />

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setStatusFilter(o.value)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all touch-manipulation border ${
              statusFilter === o.value
                ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                : "bg-[var(--bg)] text-[var(--tx)] border-[var(--brd)] hover:bg-[var(--bg2)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable<Claim>
        data={filtered}
        columns={claimColumns}
        keyField="id"
        tableId="claims-list"
        defaultSortCol="created_at"
        defaultSortDir="desc"
        searchable
        searchPlaceholder="Search by claim #, client, email…"
        pagination
        exportable
        exportFilename="yugo-claims"
        columnToggle
        selectable
        bulkActions={bulkActions}
        mobileCardLayout={{
          primaryColumnId: "client",
          subtitleColumnId: "claim_number",
          amountColumnId: "claimed",
          metaColumnIds: ["created_at", "date", "move", "status", "items", "approved", "crew"],
        }}
        onRowClick={(c) => router.push(`/admin/claims/${c.id}`)}
        emptyMessage={claims.length === 0 ? "No claims yet" : "No claims match your filters"}
      />
    </div>
  );
}
