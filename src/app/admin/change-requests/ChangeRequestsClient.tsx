"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { formatAdminCreatedAt } from "@/lib/date-format";
import { formatJobId, getMoveCode, getMoveDetailPath } from "@/lib/move-code";
import { toTitleCase } from "@/lib/format-text";

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

function getMoveData(r: { moves?: unknown; move?: unknown }) {
  const move = r.moves ?? r.move;
  return Array.isArray(move) ? move[0] : move;
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

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        id: "client",
        label: "Client",
        accessor: (r) => {
          const moveData = getMoveData(r);
          return moveData?.client_name ?? "-";
        },
        render: (r) => {
          const moveData = getMoveData(r);
          const clientName = moveData?.client_name ?? "-";
          return (
            <Link
              href={getMoveDetailPath(moveData ? { move_code: moveData.move_code, id: r.move_id } : { id: r.move_id })}
              className="text-[13px] font-semibold text-[var(--gold)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {clientName}
            </Link>
          );
        },
        sortable: true,
        searchable: true,
      },
      {
        id: "moveCode",
        label: "Move Code",
        accessor: (r) => {
          const moveData = getMoveData(r);
          const rawCode = moveData?.move_code || (moveData ? getMoveCode(moveData as { move_code?: string | null; id?: string | null }) : "");
          return rawCode ? formatJobId(rawCode, "move") : "-";
        },
        render: (r) => {
          const moveData = getMoveData(r);
          const rawCode = moveData?.move_code || (moveData ? getMoveCode(moveData as { move_code?: string | null; id?: string | null }) : "");
          const moveCode = rawCode ? formatJobId(rawCode, "move") : "-";
          return <span className="text-[11px] font-mono text-[var(--tx2)]">{moveCode}</span>;
        },
        sortable: true,
        searchable: true,
      },
      {
        id: "urgency",
        label: "Urgency",
        accessor: (r) => r.urgency,
        render: (r) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
              r.urgency === "urgent" ? "bg-[var(--rdim)] text-[var(--red)]" : "bg-[var(--gdim)] text-[var(--gold)]"
            }`}
          >
            {r.urgency}
          </span>
        ),
        sortable: true,
        searchable: true,
      },
      {
        id: "status",
        label: "Status",
        accessor: (r) => r.status,
        render: (r) =>
          r.status !== "pending" ? (
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                r.status === "approved" ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--rdim)] text-[var(--red)]"
              }`}
            >
              {toTitleCase(r.status)}
            </span>
          ) : (
            "-"
          ),
        sortable: true,
        searchable: true,
      },
      {
        id: "type",
        label: "Type",
        accessor: (r) => r.type,
        render: (r) => <span className="text-[11px] font-medium text-[var(--tx2)]">{toTitleCase(r.type)}</span>,
        sortable: true,
        searchable: true,
      },
      {
        id: "description",
        label: "Description",
        accessor: (r) => r.description,
        render: (r) => <span className="text-[12px] text-[var(--tx)] line-clamp-2 max-w-[200px]">{r.description}</span>,
        sortable: true,
        searchable: true,
      },
      {
        id: "created_at",
        label: "Create date",
        accessor: (r) => r.created_at,
        render: (r) => (
          <span className="text-[10px] text-[var(--tx3)] tabular-nums whitespace-nowrap">
            {formatAdminCreatedAt(r.created_at)}
          </span>
        ),
        sortable: true,
        exportAccessor: (r) => new Date(r.created_at).toISOString(),
      },
      {
        id: "actions",
        label: "Actions",
        accessor: () => "",
        render: (r) =>
          r.status === "pending" ? (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openApproveModal(r.id)}
                disabled={loadingId === r.id}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--grn)] text-white hover:bg-[var(--grn)]/90 disabled:opacity-50"
              >
                {loadingId === r.id ? "…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleReview(r.id, "rejected")}
                disabled={loadingId === r.id}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--red)] text-white hover:bg-[var(--red)]/90 disabled:opacity-50"
              >
                {loadingId === r.id ? "…" : "Reject"}
              </button>
            </div>
          ) : (
            "-"
          ),
        sortable: false,
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
        <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]/50 mb-4">Overview</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--brd)]/30">
          <div className="px-4 py-2 first:pl-0">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]/50">Pending</div>
            <div className="text-xl font-bold font-heading text-[var(--tx)]">{pending.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]/50">Approved today</div>
            <div className="text-xl font-bold font-heading text-[var(--grn)]">{approvedToday.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]/50">Rejected</div>
            <div className="text-xl font-bold font-heading text-[var(--red)]">{rejected.length}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]/50">Total approved</div>
            <div className="text-xl font-bold font-heading text-[var(--blue)]">{approved.length}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--tx3)]/50 mb-4">Filter</div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all touch-manipulation ${
                statusFilter === f.value
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "bg-[var(--bg)] text-[var(--tx2)] hover:bg-[var(--bg2)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-4">Change requests</div>
        <DataTable
          data={filtered}
          columns={columns}
          keyField="id"
          tableId="change-requests"
          defaultSortCol="created_at"
          defaultSortDir="desc"
          searchable
          pagination
          exportable
          columnToggle
          emptyMessage="No change requests yet"
          emptySubtext="Clients submit requests from their move portal."
        />
      </div>

      {approveModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="approve-modal-title">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h2 id="approve-modal-title" className="text-[13px] font-bold text-[var(--tx)] mb-3">Approve change request</h2>
            <label className="block text-[11px] font-medium text-[var(--tx2)] mb-1">Optional fee ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={approveFeeDollars}
              onChange={(e) => setApproveFeeDollars(e.target.value)}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setApproveModal(null); setApproveFeeDollars(""); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-[var(--tx2)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApproveWithFee}
                disabled={loadingId === approveModal.id}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--grn)] text-white hover:bg-[var(--grn)]/90 disabled:opacity-50"
              >
                {loadingId === approveModal.id ? "…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
