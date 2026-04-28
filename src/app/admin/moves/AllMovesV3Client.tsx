"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { formatJobId, getMoveCode, getMoveDetailPath } from "@/lib/move-code";
import { getStatusLabel } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

import { PageHeader } from "@/design-system/admin/layout";
import { Button, StatusPill } from "@/design-system/admin/primitives";
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type BulkAction,
  type RowAction,
  type ViewMode,
} from "@/design-system/admin/table";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { Plus, Trash } from "@phosphor-icons/react";

/* ── Types ─────────────────────────────────────────────────────────────── */

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
  margin_percent?: number | null;
  margin_flag?: string | null;
  est_margin_percent?: number | null;
  display_status?: string | null;
  contract_id?: string | null;
  is_pm_move?: boolean | null;
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

/* ── Helpers ───────────────────────────────────────────────────────────── */

function effective(m: Move) {
  return (m.display_status ?? m.status ?? "").trim();
}

function normalizeType(m: Move): string {
  const mt = (m.move_type || m.service_type || "").toLowerCase();
  if (mt.includes("office") || mt.includes("commercial")) return "office";
  if (mt.includes("single")) return "single_item";
  if (mt.includes("white")) return "white_glove";
  if (mt.includes("event")) return "event";
  if (mt.includes("specialty")) return "specialty";
  if (mt.includes("b2b")) return "b2b";
  if (mt.includes("labour")) return "labour_only";
  if (mt.includes("residential") || mt.includes("local")) return "residential";
  return mt || "residential";
}

function moveSegment(m: Move): "pm" | "b2b" | "b2c" {
  const pm = !!(m.contract_id && String(m.contract_id).trim()) || !!m.is_pm_move;
  if (pm) return "pm";
  if (normalizeType(m) === "b2b") return "b2b";
  return "b2c";
}

function statusTone(
  s: string,
): React.ComponentProps<typeof StatusPill>["tone"] {
  const k = s.toLowerCase();
  if (
    [
      "completed",
      "delivered",
      "paid",
      "accepted",
      "active",
      "confirmed",
    ].includes(k)
  )
    return "success";
  if (["cancelled", "canceled", "refunded", "expired", "failed"].includes(k))
    return "danger";
  if (
    [
      "in_progress",
      "scheduled",
      "en_route",
      "loading",
      "unloading",
      "in_transit",
    ].includes(k)
  )
    return "info";
  if (["pending", "quoted", "draft", "cold", "new", "lost"].includes(k))
    return "neutral";
  return "neutral";
}

function marginTone(
  flag: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" {
  if (flag === "green") return "success";
  if (flag === "yellow") return "warning";
  if (flag === "red") return "danger";
  return "neutral";
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function AllMovesV3Client({
  moves,
  crewMap,
}: {
  moves: Move[];
  recentQuotes?: Quote[];
  crewMap: Record<string, string>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const urlType = params.get("type") || "";
  const urlStatus = params.get("status") || "";
  const urlSegment = (params.get("segment") || "all").toLowerCase();

  const [search, setSearch] = React.useState(params.get("q") || "");
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  });
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");

  const filtered = React.useMemo(() => {
    return moves.filter((m) => {
      if (urlType && normalizeType(m) !== urlType) return false;
      if (urlStatus && effective(m).toLowerCase() !== urlStatus.toLowerCase())
        return false;
      if (urlSegment === "pm" && moveSegment(m) !== "pm") return false;
      if (urlSegment === "b2b" && moveSegment(m) !== "b2b") return false;
      if (urlSegment === "b2c" && moveSegment(m) !== "b2c") return false;
      return true;
    });
  }, [moves, urlSegment, urlStatus, urlType]);

  const setSegmentParam = React.useCallback(
    (next: string) => {
      const q = new URLSearchParams(params.toString());
      if (!next || next === "all") q.delete("segment");
      else q.set("segment", next);
      const s = q.toString();
      router.push(s ? `/admin/moves?${s}` : "/admin/moves", { scroll: false });
    },
    [params, router],
  );

  const kpis = React.useMemo(() => {
    const totalEstimate = moves.reduce((a, m) => a + (m.estimate || 0), 0);
    const confirmed = moves.filter((m) =>
      ["confirmed", "scheduled", "in_progress"].includes(
        effective(m).toLowerCase(),
      ),
    ).length;
    const completed = moves.filter((m) =>
      ["completed", "delivered", "paid"].includes(effective(m).toLowerCase()),
    ).length;
    const avgMargin =
      moves
        .map((m) => Number(m.margin_percent ?? m.est_margin_percent ?? 0))
        .filter((n) => n > 0)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0;
    return [
      {
        id: "total",
        label: "Total moves",
        value: moves.length.toString(),
      },
      {
        id: "confirmed",
        label: "Active",
        value: confirmed.toString(),
        hint: "confirmed, scheduled, in progress",
      },
      {
        id: "completed",
        label: "Completed",
        value: completed.toString(),
      },
      {
        id: "margin",
        label: "Avg margin",
        value: `${avgMargin.toFixed(1)}%`,
      },
      {
        id: "revenue",
        label: "Booked estimate",
        value: formatCurrency(totalEstimate),
      },
    ];
  }, [moves]);

  const columns = React.useMemo<ColumnDef<Move>[]>(
    () => [
      {
        id: "move_code",
        shortLabel: "Move",
        header: "Move",
        accessor: (m) => m.move_code ?? "",
        sortable: true,
        searchable: true,
        width: 130,
        cell: (m) => {
          const slug = m.move_code?.replace(/^#/, "").trim()
            ? m.move_code.replace(/^#/, "").trim()
            : getMoveCode(m);
          return (
            <span className="yu3-num text-[13px] font-medium text-[var(--yu3-ink-strong)]">
              {formatJobId(slug, "move")}
            </span>
          );
        },
      },
      {
        id: "client",
        shortLabel: "Client",
        header: "Client",
        accessor: (m) => m.client_name ?? "",
        sortable: true,
        searchable: true,
        width: 220,
        cell: (m) => (
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
              {m.client_name || "Unnamed"}
            </div>
            <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
              {m.from_address}
              {m.to_address ? ` → ${m.to_address}` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "type",
        shortLabel: "Type",
        header: "Type",
        accessor: (m) => normalizeType(m),
        sortable: true,
        width: 130,
        cell: (m) => (
          <span className="inline-flex flex-col gap-0.5">
            <span className="text-[12px] text-[var(--yu3-ink)]">
              {serviceTypeDisplayLabel(normalizeType(m)) ||
                toTitleCase(normalizeType(m))}
            </span>
            {moveSegment(m) === "pm" && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#6D28D9]">
                PM
              </span>
            )}
          </span>
        ),
      },
      {
        id: "status",
        shortLabel: "Status",
        header: "Status",
        accessor: (m) => effective(m),
        sortable: true,
        width: 150,
        cell: (m) => {
          const s = effective(m);
          return (
            <StatusPill tone={statusTone(s)}>
              {getStatusLabel(s) || toTitleCase(s)}
            </StatusPill>
          );
        },
      },
      {
        id: "scheduled_date",
        shortLabel: "Date",
        header: "Date",
        accessor: (m) => m.scheduled_date ?? "",
        sortable: true,
        width: 120,
        cell: (m) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink)] whitespace-nowrap">
            {m.scheduled_date ? formatMoveDate(m.scheduled_date) : ""}
          </span>
        ),
      },
      {
        id: "crew",
        shortLabel: "Crew",
        header: "Crew",
        accessor: (m) => (m.crew_id ? (crewMap[m.crew_id] ?? "") : ""),
        sortable: true,
        width: 140,
        cell: (m) =>
          m.crew_id && crewMap[m.crew_id] ? (
            <span className="text-[12px] text-[var(--yu3-ink)] truncate">
              {crewMap[m.crew_id]}
            </span>
          ) : (
            <span className="text-[12px] text-[var(--yu3-ink-faint)]">
              Unassigned
            </span>
          ),
      },
      {
        id: "estimate",
        shortLabel: "Estimate",
        header: "Estimate",
        accessor: (m) => Number(m.estimate || 0),
        align: "right",
        sortable: true,
        numeric: true,
        width: 120,
        cell: (m) => (
          <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
            {m.estimate ? formatCurrency(m.estimate) : ""}
          </span>
        ),
      },
      {
        id: "margin",
        shortLabel: "Margin",
        header: "Margin",
        accessor: (m) => Number(m.margin_percent ?? m.est_margin_percent ?? 0),
        align: "right",
        sortable: true,
        numeric: true,
        width: 110,
        cell: (m) => {
          const pct = m.margin_percent ?? m.est_margin_percent;
          if (pct == null) return null;
          return (
            <StatusPill tone={marginTone(m.margin_flag)}>
              {Math.round(Number(pct))}%
            </StatusPill>
          );
        },
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Created",
        accessor: (m) => m.created_at ?? "",
        sortable: true,
        width: 130,
        hiddenByDefault: true,
        cell: (m) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {m.created_at ? formatAdminCreatedAt(m.created_at) : ""}
          </span>
        ),
      },
    ],
    [crewMap],
  );

  const bulkActions = React.useMemo<BulkAction<Move>[]>(
    () => [
      {
        id: "export",
        label: "Export CSV",
        run: (rows) => {
          const csv = [
            ["Move", "Client", "Status", "Date", "Estimate"].join(","),
            ...rows.map((r) =>
              [
                r.move_code,
                r.client_name,
                effective(r),
                r.scheduled_date,
                r.estimate,
              ]
                .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
                .join(","),
            ),
          ].join("\n");
          const url = URL.createObjectURL(
            new Blob([csv], { type: "text/csv" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "moves.csv";
          a.click();
          URL.revokeObjectURL(url);
        },
      },
    ],
    [],
  );

  const rowActions = React.useMemo<RowAction<Move>[]>(
    () => [
      {
        id: "open",
        label: "Open move",
        run: (m) =>
          router.push(
            getMoveDetailPath(m as { id: string; move_code?: string | null }),
          ),
      },
      {
        id: "cancel",
        label: "Cancel move",
        icon: <Trash size={14} />,
        danger: true,
        run: async (m) => {
          if (!window.confirm(`Cancel move ${m.move_code}?`)) return;
          const res = await fetch(`/api/admin/moves/${m.id}/cancel`, {
            method: "POST",
          });
          if (res.ok) router.refresh();
        },
      },
    ],
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Operations"
        title="Moves"
        description="Booked moves across every service line."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={16} />}
            onClick={() => router.push("/admin/moves/create")}
          >
            Create move
          </Button>
        }
      />
      <KpiStrip tiles={kpis} columns={5} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="moves-segment-filter">
          Move channel
        </label>
        <select
          id="moves-segment-filter"
          value={urlSegment === "pm" || urlSegment === "b2b" || urlSegment === "b2c" ? urlSegment : "all"}
          onChange={(e) => setSegmentParam(e.target.value)}
          className="admin-premium-input text-[13px] py-2 max-w-[220px]"
        >
          <option value="all">All channels</option>
          <option value="b2c">B2C (direct)</option>
          <option value="pm">Property management</option>
          <option value="b2b">B2B deliveries</option>
        </select>
      </div>
      <DataTable<Move>
        columns={columns}
        rows={filtered}
        rowId={(m) => m.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={rowActions}
        onRowClick={(m) =>
          router.push(
            getMoveDetailPath(m as { id: string; move_code?: string | null }),
          )
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
      />
    </div>
  );
}
