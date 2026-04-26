"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import { formatAdminCreatedAt } from "@/lib/date-format";
import { csvField } from "@/lib/admin-csv-field";
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type BulkAction,
  type ViewMode,
} from "@/design-system/admin/table";
import { useToast } from "../components/Toast";
import SectionDivider from "@/components/ui/SectionDivider";
import { PageHeader } from "@/design-system/admin/layout";
import { StatusPill } from "@/design-system/admin/primitives";
import { Button } from "@/design-system/admin/primitives";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { Plus } from "@phosphor-icons/react";
import type { ComponentProps } from "react";

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

function claimStatusTone(s: string): ComponentProps<typeof StatusPill>["tone"] {
  switch (s) {
    case "submitted":
      return "neutral";
    case "under_review":
      return "info";
    case "approved":
    case "settled":
      return "success";
    case "partially_approved":
      return "warning";
    case "denied":
      return "danger";
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClaimsListClient({
  claims: initialClaims,
  stats: initialStats,
}: {
  claims: Claim[];
  stats: Stats;
}) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
        const labels: Record<string, string> = {
          resolve: "Marked resolved",
          close: "Closed",
        };
        toast(
          `${labels[action]} ${data.updated} claim${data.updated !== 1 ? "s" : ""}`,
          "check",
        );
        setSelectedIds(new Set());
        router.refresh();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [toast, router],
  );

  const bulkActions = useMemo<BulkAction<Claim>[]>(
    () => [
      {
        id: "resolve",
        label: "Mark resolved",
        run: (r) =>
          runBulk(
            "resolve",
            r.map((c) => c.id),
          ),
      },
      {
        id: "close",
        label: "Close",
        danger: true,
        run: (r) =>
          runBulk(
            "close",
            r.map((c) => c.id),
          ),
      },
    ],
    [runBulk],
  );

  const columns = useMemo<ColumnDef<Claim>[]>(
    () => [
      {
        id: "claim_number",
        shortLabel: "Claim",
        header: "Claim #",
        accessor: (c) => c.claim_number,
        width: 120,
        cell: (c) => (
          <Link
            href={`/admin/claims/${c.id}`}
            className="font-semibold text-[var(--yu3-ink)] hover:underline tabular-nums"
            onClick={(e) => e.stopPropagation()}
          >
            {c.claim_number}
          </Link>
        ),
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Create date",
        accessor: (c) => c.created_at,
        sortable: true,
        width: 160,
        cell: (c) => (
          <span className="text-[11px] text-[var(--yu3-ink-muted)] tabular-nums whitespace-nowrap">
            {formatAdminCreatedAt(c.created_at)}
          </span>
        ),
      },
      {
        id: "date",
        shortLabel: "Submitted",
        header: "Submitted",
        accessor: (c) => c.submitted_at || c.created_at,
        sortable: true,
        width: 100,
        cell: (c) =>
          new Date(c.submitted_at || c.created_at).toLocaleDateString("en-CA", {
            month: "short",
            day: "numeric",
          }),
      },
      {
        id: "client",
        shortLabel: "Client",
        header: "Client",
        accessor: (c) => c.client_name,
        width: 200,
        cell: (c) => (
          <div className="min-w-0">
            <div className="text-[var(--yu3-ink)] font-medium truncate">
              {c.client_name}
            </div>
            <div className="text-[11px] text-[var(--yu3-ink-faint)] truncate">
              {c.client_email}
            </div>
          </div>
        ),
      },
      {
        id: "move",
        shortLabel: "Move",
        header: "Move",
        accessor: (c) => c.move_code || c.move_id || "",
        width: 120,
        cell: (c) =>
          c.move_code ? (
            <Link
              href={`/admin/moves/${c.move_code}`}
              className="text-[12px] font-semibold text-[var(--yu3-ink)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {c.move_code}
            </Link>
          ) : c.move_id ? (
            <Link
              href={`/admin/moves/${c.move_id}`}
              className="text-[12px] font-semibold text-[var(--yu3-ink)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View move
            </Link>
          ) : null,
      },
      {
        id: "items",
        shortLabel: "Items",
        header: "Items",
        accessor: (c) => (Array.isArray(c.items) ? c.items.length : 0),
        width: 80,
        cell: (c) => {
          const n = Array.isArray(c.items) ? c.items.length : 0;
          return `${n} item${n !== 1 ? "s" : ""}`;
        },
      },
      {
        id: "claimed",
        shortLabel: "Claimed",
        header: "Claimed",
        accessor: (c) => c.total_claimed_value,
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (c) => (
          <span className="text-[var(--yu3-ink)] font-semibold tabular-nums">
            {formatCurrency(c.total_claimed_value)}
          </span>
        ),
      },
      {
        id: "approved",
        shortLabel: "Approved",
        header: "Approved",
        accessor: (c) => c.approved_amount ?? 0,
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (c) =>
          c.approved_amount != null ? (
            <span className="text-[var(--yu3-ink-muted)] tabular-nums">
              {formatCurrency(c.approved_amount)}
            </span>
          ) : null,
      },
      {
        id: "status",
        shortLabel: "Status",
        header: "Status",
        accessor: (c) => c.status,
        sortable: true,
        width: 150,
        cell: (c) => (
          <StatusPill tone={claimStatusTone(c.status)}>
            {statusLabel(c.status)}
          </StatusPill>
        ),
      },
      {
        id: "crew",
        shortLabel: "Crew",
        header: "Crew",
        accessor: (c) => c.crew_team || "",
        width: 100,
        cell: (c) =>
          c.crew_team ? (
            <span className="text-[var(--yu3-ink-muted)]">{c.crew_team}</span>
          ) : null,
      },
    ],
    [],
  );

  const refreshClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/claims");
      if (!res.ok) return;
      const json = await res.json();
      const allClaims: Claim[] = json.claims || [];
      setClaims(allClaims);
      const now = new Date();
      const thirtyDaysAgo = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      setStats({
        openCount: allClaims.filter((c) =>
          ["submitted", "under_review"].includes(c.status),
        ).length,
        reviewCount: allClaims.filter((c) => c.status === "under_review")
          .length,
        resolvedCount: allClaims.filter(
          (c) =>
            [
              "approved",
              "partially_approved",
              "denied",
              "settled",
              "closed",
            ].includes(c.status) &&
            c.resolved_at &&
            c.resolved_at >= thirtyDaysAgo,
        ).length,
        totalPaidOut: allClaims
          .filter(
            (c) =>
              c.approved_amount &&
              c.resolved_at &&
              c.resolved_at >= thirtyDaysAgo,
          )
          .reduce((sum, c) => sum + (c.approved_amount || 0), 0),
      });
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshClaims, 30_000);
    return () => clearInterval(interval);
  }, [refreshClaims]);

  const filtered = useMemo(
    () =>
      statusFilter ? claims.filter((c) => c.status === statusFilter) : claims,
    [claims, statusFilter],
  );

  const onExport = useCallback(() => {
    const headers = [
      "Claim #",
      "Create date",
      "Submitted",
      "Client",
      "Email",
      "Move",
      "Items",
      "Claimed",
      "Approved",
      "Status",
      "Crew",
    ];
    const lines = filtered.map((c) => {
      const n = Array.isArray(c.items) ? c.items.length : 0;
      return [
        c.claim_number,
        formatAdminCreatedAt(c.created_at),
        new Date(c.submitted_at || c.created_at).toLocaleDateString("en-CA"),
        c.client_name,
        c.client_email,
        c.move_code || c.move_id || "",
        `${n} item(s)`,
        String(c.total_claimed_value),
        c.approved_amount != null ? String(c.approved_amount) : "",
        c.status,
        c.crew_team || "",
      ]
        .map((x) => csvField(String(x)))
        .join(",");
    });
    const csv = [headers.map(csvField).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yugo-claims.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Operations"
        title="Claims"
        description="Damage, loss, and service claims across moves and deliveries."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={16} />}
            onClick={() => router.push("/admin/claims/new")}
          >
            New claim
          </Button>
        }
      />
      <KpiStrip
        tiles={[
          {
            id: "open",
            label: "Open claims",
            value: String(stats.openCount),
            hint: "awaiting action",
          },
          {
            id: "review",
            label: "Under review",
            value: String(stats.reviewCount),
            hint: "being assessed",
          },
          {
            id: "resolved",
            label: "Resolved 30d",
            value: String(stats.resolvedCount),
            hint: "last 30 days",
          },
          {
            id: "paid",
            label: "Paid 30d",
            value: formatCurrency(stats.totalPaidOut),
            hint: "approved payouts",
          },
        ]}
        columns={4}
      />

      <SectionDivider label="All Claims" />

      <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => setStatusFilter(o.value)}
            className={`shrink-0 admin-btn admin-btn-sm ${
              statusFilter === o.value
                ? "admin-btn-primary"
                : "admin-btn-secondary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <DataTable<Claim>
        columns={columns}
        rows={filtered}
        rowId={(c) => c.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        bulkActions={bulkActions}
        onRowClick={(c) => router.push(`/admin/claims/${c.id}`)}
        onExport={onExport}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
        searchPlaceholder="Search by claim #, client, email…"
        emptyState={
          <div className="px-2 py-8 text-center">
            <p className="text-[15px] font-semibold text-[var(--yu3-ink)]">
              {claims.length === 0
                ? "No claims yet"
                : "No claims match your filters"}
            </p>
          </div>
        }
      />
    </div>
  );
}
