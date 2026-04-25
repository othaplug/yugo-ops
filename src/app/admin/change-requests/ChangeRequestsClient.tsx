"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "../components/Toast"
import { csvField } from "@/lib/admin-csv-field"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type ViewMode,
} from "@/design-system/admin/table"
import { formatAdminCreatedAt } from "@/lib/date-format";
import { formatJobId, getMoveCode, getMoveDetailPath } from "@/lib/move-code";
import { toTitleCase } from "@/lib/format-text";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

function getMoveData(r: unknown) {
  const o = r as { moves?: unknown; move?: unknown }
  const move = o.moves ?? o.move
  return Array.isArray(move) ? move[0] : move
}

export default function ChangeRequestsClient({
  all,
  pending,
  reviewed,
}: {
  all: any[];
  pending: any[];
  reviewed: any[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<{ id: string } | null>(null);
  const [approveFeeDollars, setApproveFeeDollars] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ColumnSort | null>({ columnId: "created_at", direction: "desc" });
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const approved = reviewed.filter((r: any) => r.status === "approved");
  const rejected = reviewed.filter((r: any) => r.status === "rejected");
  const approvedToday = approved.filter((r: any) => r.reviewed_at && isToday(r.reviewed_at));

  const filtered = useMemo(() => {
    if (statusFilter === "all") return all;
    return all.filter((r: any) => (r.status || "").toLowerCase() === statusFilter);
  }, [all, statusFilter]);

  const handleReview = async (id: string, status: "approved" | "rejected", feeCents?: number) => {
    setLoadingId(id);
    try {
      const body: { status: string; fee_cents?: number } = { status };
      if (status === "approved" && typeof feeCents === "number" && feeCents > 0) body.fee_cents = feeCents;
      const res = await fetch(`/api/admin/change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast(status === "approved" ? "Approved" : "Rejected", "check");
      setApproveModal(null);
      setApproveFeeDollars("");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setLoadingId(null);
    }
  };

  const openApproveModal = (id: string) => {
    setApproveModal({ id });
    setApproveFeeDollars("");
  };

  const onExport = useCallback(() => {
    const headers = [
      "Client",
      "Move",
      "Urgency",
      "Status",
      "Type",
      "Description",
      "Create date",
    ]
    const lines = (filtered as { id: string; move_id: string; urgency: string; status: string; type: string; description: string; created_at: string }[]).map(
      (row) => {
        const moveData = getMoveData(row);
        const rawCode = moveData?.move_code || (moveData ? getMoveCode(moveData as { move_code?: string | null; id?: string | null }) : "");
        const moveCode = rawCode ? formatJobId(rawCode, "move") : "";
        return [
          String(moveData?.client_name ?? ""),
          moveCode,
          String(row.urgency),
          row.status,
          toTitleCase(row.type),
          String(row.description ?? ""),
          formatAdminCreatedAt(row.created_at),
        ]
          .map((c) => csvField(c))
          .join(",")
      },
    );
    const csv = [headers.map(csvField).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "change-requests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(
    () => [
      {
        id: "client",
        header: "Client",
        accessor: (r) => {
          const moveData = getMoveData(r);
          return (moveData as { client_name?: string } | null)?.client_name ?? "";
        },
        sortable: true,
        width: 160,
        cell: (r) => {
          const moveData = getMoveData(r);
          const clientName = (moveData as { client_name?: string } | null)?.client_name;
          if (!clientName) return null;
          const rid = (r as { move_id: string }).move_id;
          return (
            <Link
              href={getMoveDetailPath(
                moveData
                  ? { move_code: (moveData as { move_code?: string }).move_code, id: rid }
                  : { id: rid },
              )}
              className="text-[13px] font-semibold text-[var(--yu3-ink)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {clientName}
            </Link>
          );
        },
      },
      {
        id: "moveCode",
        shortLabel: "Move",
        header: "Move code",
        accessor: (r) => {
          const moveData = getMoveData(r);
          const rawCode =
            (moveData as { move_code?: string } | null)?.move_code ||
            (moveData ? getMoveCode(moveData as { move_code?: string | null; id?: string | null }) : "");
          return rawCode ? formatJobId(rawCode, "move") : "";
        },
        sortable: true,
        width: 120,
        cell: (r) => {
          const moveData = getMoveData(r);
          const rawCode =
            (moveData as { move_code?: string } | null)?.move_code ||
            (moveData ? getMoveCode(moveData as { move_code?: string | null; id?: string | null }) : "");
          const moveCode = rawCode ? formatJobId(rawCode, "move") : "";
          if (!moveCode) return null;
          return <span className="text-[12px] font-mono font-semibold text-[var(--yu3-ink)]">{moveCode}</span>;
        },
      },
      {
        id: "urgency",
        header: "Urgency",
        accessor: (r) => String((r as { urgency: string }).urgency),
        sortable: true,
        width: 100,
        cell: (r) => {
          const u = (r as { urgency: string }).urgency;
          return (
            <span
              className={`text-[9px] font-bold uppercase tracking-[0.08em] ${
                u === "urgent" ? "text-[var(--yu3-danger)]" : "text-[var(--yu3-ink-muted)]"
              }`}
            >
              {u}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessor: (r) => String((r as { status: string }).status),
        sortable: true,
        width: 110,
        cell: (r) => {
          const s = (r as { status: string }).status;
          if (s === "pending") return null;
          return (
            <span
              className={`text-[9px] font-bold uppercase tracking-[0.08em] ${
                s === "approved" ? "text-[var(--yu3-success)]" : "text-[var(--yu3-danger)]"
              }`}
            >
              {toTitleCase(s)}
            </span>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        accessor: (r) => String((r as { type: string }).type),
        sortable: true,
        width: 100,
        cell: (r) => (
          <span className="text-[11px] font-medium text-[var(--yu3-ink-muted)]">{toTitleCase((r as { type: string }).type)}</span>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessor: (r) => String((r as { description: string }).description ?? ""),
        sortable: true,
        minWidth: 160,
        cell: (r) => (
          <span className="text-[12px] text-[var(--yu3-ink)] line-clamp-2 max-w-[200px]">{(r as { description: string }).description}</span>
        ),
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Create date",
        accessor: (r) => String((r as { created_at: string }).created_at),
        sortable: true,
        width: 150,
        cell: (r) => (
          <span className="text-[10px] text-[var(--yu3-ink-faint)] tabular-nums whitespace-nowrap">
            {formatAdminCreatedAt((r as { created_at: string }).created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        accessor: () => "",
        sortable: false,
        width: 180,
        cell: (r) =>
          (r as { status: string }).status === "pending" ? (
            <div className="flex gap-2" data-yu3-noclick onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openApproveModal((r as { id: string }).id)}
                disabled={loadingId === (r as { id: string }).id}
                className="admin-btn admin-btn-sm admin-btn-primary"
              >
                {loadingId === (r as { id: string }).id ? "…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleReview((r as { id: string }).id, "rejected")}
                disabled={loadingId === (r as { id: string }).id}
                className="admin-btn admin-btn-sm admin-btn-danger"
              >
                {loadingId === (r as { id: string }).id ? "…" : "Reject"}
              </button>
            </div>
          ) : null,
      },
    ],
    [loadingId],
  );

  const confirmApproveWithFee = () => {
    if (!approveModal) return;
    const dollars = parseFloat(approveFeeDollars);
    const feeCents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
    handleReview(approveModal.id, "approved", feeCents);
  };

  return (
    <div className="space-y-8">
      {/* Stats bar */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)] mb-4">Overview</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--brd)]/30">
          <div className="px-4 py-2 first:pl-0">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]">Pending</div>
            <div className="text-xl font-bold font-heading text-[var(--tx)]">{pending.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]">Approved today</div>
            <div className="text-xl font-bold font-heading text-[var(--grn)]">{approvedToday.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]">Rejected</div>
            <div className="text-xl font-bold font-heading text-[var(--red)]">{rejected.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]">Total approved</div>
            <div className="text-xl font-bold font-heading text-[var(--blue)]">{approved.length}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)] mb-4 uppercase">Filter</div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 admin-btn admin-btn-sm ${
                statusFilter === f.value ? "admin-btn-primary" : "admin-btn-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-4">Change requests</div>
        <DataTable<Record<string, unknown>>
          columns={columns}
          rows={filtered as Record<string, unknown>[]}
          rowId={(r) => String((r as { id: string }).id)}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          onExport={onExport}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          availableViews={["list"]}
          searchPlaceholder="Search change requests…"
          emptyState={
            <div className="px-2 py-8 text-center max-w-sm mx-auto">
              <p className="text-[15px] font-semibold text-[var(--yu3-ink)] mb-1">No change requests yet</p>
              <p className="text-[12px] text-[var(--yu3-ink-muted)]">Clients submit requests from their move portal.</p>
            </div>
          }
        />
      </div>

      {approveModal && (
        <ModalDialogFrame
          zClassName="z-[99999]"
          onBackdropClick={() => { setApproveModal(null); setApproveFeeDollars(""); }}
          panelClassName="bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] border border-[var(--yu3-line)] shadow-[var(--yu3-shadow-lg)] rounded-[var(--yu3-r-lg)] p-5 w-full max-w-sm modal-card"
          ariaLabelledBy="approve-modal-title"
        >
            <h2 id="approve-modal-title" className="text-[15px] font-semibold text-[var(--tx)] mb-3">Approve change request</h2>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tx3)] mb-1.5">Optional fee ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={approveFeeDollars}
              onChange={(e) => setApproveFeeDollars(e.target.value)}
              className="admin-input w-full mb-4 tabular-nums"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setApproveModal(null); setApproveFeeDollars(""); }}
                className="admin-btn admin-btn-sm admin-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApproveWithFee}
                disabled={loadingId === approveModal.id}
                className="admin-btn admin-btn-sm admin-btn-primary"
              >
                {loadingId === approveModal.id ? "…" : "Approve"}
              </button>
            </div>
        </ModalDialogFrame>
      )}
    </div>
  );
}
