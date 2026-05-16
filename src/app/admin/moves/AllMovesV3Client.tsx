"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { serviceTypeDisplayLabel, portfolioPmMoveServiceLabel } from "@/lib/displayLabels";
import { TIERED_SERVICE_TYPES, QUOTE_SERVICE_TYPE_DEFINITIONS } from "@/lib/quote-service-types";
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
  final_amount?: number | null;
  total_price?: number | null;
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
  neighbourhood_tier?: string | null;
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
      if (urlType) {
        // Match raw service_type / move_type slug first (matches the Service Type
        // dropdown options); fall back to normalizeType for legacy URLs.
        const rawSt = String(m.service_type ?? m.move_type ?? "").trim().toLowerCase();
        if (rawSt !== urlType.toLowerCase() && normalizeType(m) !== urlType) return false;
      }
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
    const totalEstimate = moves.reduce((a, m) => a + (Number(m.final_amount ?? m.total_price ?? m.estimate) || 0), 0);
    const confirmed = moves.filter((m) =>
      ["confirmed", "scheduled", "in_progress"].includes(
        effective(m).toLowerCase(),
      ),
    ).length;
    // `paid` is a payment flag — a move can be paid in advance and still be
    // scheduled for a future date. Don't count it as completed for the KPIs.
    const completedMoves = moves.filter((m) =>
      ["completed", "delivered"].includes(effective(m).toLowerCase()),
    );
    const completed = completedMoves.length;
    const avgMargin =
      moves
        .map((m) => Number(m.margin_percent ?? m.est_margin_percent ?? 0))
        .filter((n) => n > 0)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) || 0;

    const bookedOrCompleted = moves.filter((m) =>
      ["booked", "confirmed", "scheduled", "in_progress", "completed", "delivered", "paid"].includes(
        effective(m).toLowerCase(),
      ),
    );
    const tierCounts: Record<string, number> = {};
    for (const m of bookedOrCompleted) {
      // Only count moves whose service type actually offers tier packages.
      // Office moves, B2B deliveries, single items, labour-only etc. don't have tiers.
      // PM moves carry a default tier that doesn't reflect a real client choice — exclude them.
      const st = String(m.service_type ?? m.move_type ?? "").trim().toLowerCase();
      if (!TIERED_SERVICE_TYPES.has(st)) continue;
      const isPm = !!(m.contract_id && String(m.contract_id).trim()) || !!m.is_pm_move;
      if (isPm) continue;
      const t = (m.tier_selected || "").trim().toLowerCase();
      if (!t) continue;
      // Normalise legacy aliases (curated/essentials → essential, premier → signature)
      const normalised =
        t === "essentials" || t === "curated"
          ? "essential"
          : t === "premier"
            ? "signature"
            : t;
      tierCounts[normalised] = (tierCounts[normalised] || 0) + 1;
    }
    const TIER_LABEL: Record<string, string> = {
      essential: "Essential",
      signature: "Signature",
      estate: "Estate",
    };
    const topTierEntry = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0];
    const topTier = topTierEntry ? (TIER_LABEL[topTierEntry[0]] ?? topTierEntry[0]) : "—";

    const hoodCounts: Record<string, number> = {};
    for (const m of completedMoves) {
      const h = (m.neighbourhood_tier || "").trim();
      if (h) hoodCounts[h] = (hoodCounts[h] || 0) + 1;
    }
    const topHoodEntry = Object.entries(hoodCounts).sort((a, b) => b[1] - a[1])[0];
    const topHood = topHoodEntry ? topHoodEntry[0] : "—";

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
      {
        id: "top-tier",
        label: "Top tier",
        value: topTier,
        hint: "most booked/completed tier",
      },
      {
        id: "best-hood",
        label: "Best hood",
        value: topHood,
        hint: "most common neighbourhood on completed moves",
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
              {portfolioPmMoveServiceLabel(m) ||
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
        accessor: (m) => Number(m.final_amount ?? m.total_price ?? m.estimate ?? 0),
        align: "right",
        sortable: true,
        numeric: true,
        width: 120,
        cell: (m) => {
          const price = m.final_amount ?? m.total_price ?? m.estimate;
          return (
            <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
              {price ? formatCurrency(price) : ""}
            </span>
          );
        },
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
                r.final_amount ?? r.total_price ?? r.estimate,
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
        <label className="sr-only" htmlFor="moves-service-filter">
          Service type
        </label>
        <select
          id="moves-service-filter"
          value={urlType || "all"}
          onChange={(e) => {
            const next = e.target.value;
            const q = new URLSearchParams(params.toString());
            if (!next || next === "all") q.delete("type");
            else q.set("type", next);
            const s = q.toString();
            router.push(s ? `/admin/moves?${s}` : "/admin/moves", { scroll: false });
          }}
          className="admin-premium-input text-[13px] py-2 max-w-[260px]"
        >
          <option value="all">All service types</option>
          {QUOTE_SERVICE_TYPE_DEFINITIONS.filter((d) => d.value !== "bin_rental").map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
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
        availableViews={["list", "board"]}
        board={{
          groupBy: (m) => {
            const s = effective(m).toLowerCase();
            // `paid` / `final_payment_received` are payment flags, NOT operational
            // status — a move can be paid in advance and still be scheduled for
            // a future date. Match getStatusLabel() in lib/move-status.ts which
            // intentionally surfaces these as "Scheduled" to the operator.
            if (["completed", "delivered"].includes(s)) return "completed";
            if (["cancelled", "canceled", "expired", "no_show"].includes(s)) return "cancelled";
            if (["in_progress", "en_route", "loading", "unloading", "in_transit"].includes(s)) return "in_progress";
            if (["scheduled", "booked", "confirmed", "paid", "final_payment_received"].includes(s)) return "scheduled";
            return "draft";
          },
          columns: [
            { id: "draft", label: "Draft / Pending", tone: "neutral" },
            { id: "scheduled", label: "Scheduled", tone: "info" },
            { id: "in_progress", label: "In Progress", tone: "info" },
            { id: "completed", label: "Completed", tone: "success" },
            { id: "cancelled", label: "Cancelled", tone: "danger" },
          ],
          renderCard: (m) => (
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--yu3-ink)]">
                  {formatJobId(getMoveCode(m), "move")}
                </span>
                <StatusPill tone={statusTone(effective(m))}>
                  {getStatusLabel(effective(m)) || toTitleCase(effective(m))}
                </StatusPill>
              </div>
              <div className="text-[var(--yu3-ink)] font-medium">
                {m.client_name || "—"}
              </div>
              <div className="text-[10px] text-[var(--yu3-ink-muted)]">
                {portfolioPmMoveServiceLabel(m)}
              </div>
              <div className="text-[10px] text-[var(--yu3-ink-muted)] truncate">
                {m.from_address || "—"}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--yu3-line-subtle)]">
                <span className="text-[var(--yu3-ink-muted)]">
                  {m.scheduled_date ? formatMoveDate(m.scheduled_date) : "—"}
                </span>
                <span className="font-semibold text-[var(--yu3-ink)] tabular-nums">
                  {formatCurrency(Number(m.estimate ?? m.final_amount ?? 0))}
                </span>
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
