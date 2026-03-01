"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import { formatJobId, getMoveDetailPath } from "@/lib/move-code";

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 172800) return "yesterday";
  return `${Math.floor(sec / 86400)} days ago`;
}

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
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

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

  const confirmApproveWithFee = () => {
    if (!approveModal) return;
    const dollars = parseFloat(approveFeeDollars);
    const feeCents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
    handleReview(approveModal.id, "approved", feeCents);
  };

  const getMoveData = (r: any) => {
    const move = r.moves ?? r.move;
    return Array.isArray(move) ? move[0] : move;
  };

  const renderItem = (r: any) => {
    const moveData = getMoveData(r);
    const clientName = moveData?.client_name ?? "—";
    const rawCode = moveData?.move_code || moveData?.id?.slice(0, 8) || "";
    const moveCode = rawCode ? formatJobId(rawCode, "move") : "—";

    return (
      <div
        key={r.id}
        className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 mb-3 hover:border-[var(--gold)]/40 hover:bg-[var(--bg2)]/50 transition-all"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={getMoveDetailPath(moveData ? { move_code: moveData.move_code, id: r.move_id } : { id: r.move_id })}
                className="text-[13px] font-semibold text-[var(--gold)] hover:underline"
              >
                {clientName}
              </Link>
              <span className="text-[11px] font-mono text-[var(--tx2)]">{moveCode}</span>
              <span
                className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                  r.urgency === "urgent" ? "bg-[var(--rdim)] text-[var(--red)]" : "bg-[var(--gdim)] text-[var(--gold)]"
                }`}
              >
                {r.urgency}
              </span>
              {r.status !== "pending" && (
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                    r.status === "approved" ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--rdim)] text-[var(--red)]"
                  }`}
                >
                  {r.status}
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] font-medium text-[var(--tx2)]">{r.type}</div>
            <p className="mt-2 text-[12px] text-[var(--tx)]">{r.description}</p>
            <div className="mt-2 text-[10px] text-[var(--tx3)]">
              {r.status === "pending" ? formatRelative(r.created_at) : new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2 shrink-0">
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
          )}
        </div>
      </div>
    );
  };

  const renderCard = (r: any) => {
    const moveData = getMoveData(r);
    const clientName = moveData?.client_name ?? "—";
    const rawCode = moveData?.move_code || moveData?.id?.slice(0, 8) || "";
    const moveCode = rawCode ? formatJobId(rawCode, "move") : "—";

    return (
      <div
        key={r.id}
        className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 hover:border-[var(--gold)]/40 transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[13px] text-[var(--tx)] truncate">{clientName}</div>
            <div className="text-[11px] font-mono text-[var(--tx2)] mt-0.5">{moveCode}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                  r.urgency === "urgent" ? "bg-[var(--rdim)] text-[var(--red)]" : "bg-[var(--gdim)] text-[var(--gold)]"
                }`}
              >
                {r.urgency}
              </span>
              {r.status !== "pending" && (
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                    r.status === "approved" ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--rdim)] text-[var(--red)]"
                  }`}
                >
                  {r.status}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">{r.type}</div>
            <div className="text-[10px] text-[var(--tx3)] mt-0.5">{formatRelative(r.created_at)}</div>
          </div>
          {r.status === "pending" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openApproveModal(r.id)}
                disabled={loadingId === r.id}
                className="px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-[var(--grn)] text-white hover:bg-[var(--grn)]/90 disabled:opacity-50"
              >
                {loadingId === r.id ? "…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleReview(r.id, "rejected")}
                disabled={loadingId === r.id}
                className="px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-[var(--red)] text-white hover:bg-[var(--red)]/90 disabled:opacity-50"
              >
                {loadingId === r.id ? "…" : "Reject"}
              </button>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11px] text-[var(--tx2)] line-clamp-2">{r.description}</p>
        <Link
          href={getMoveDetailPath(moveData ? { move_code: moveData.move_code, id: r.move_id } : { id: r.move_id })}
          className="mt-2 inline-block text-[10px] font-semibold text-[var(--gold)] hover:underline"
        >
          View move →
        </Link>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--gold)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Pending</div>
          <div className="text-xl font-bold font-heading text-[var(--tx)]">{pending.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--grn)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Approved today</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{approvedToday.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--red)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Rejected</div>
          <div className="text-xl font-bold font-heading text-[var(--red)]">{rejected.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--blue)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Total approved</div>
          <div className="text-xl font-bold font-heading text-[var(--blue)]">{approved.length}</div>
        </div>
      </div>

      {/* Filter bar + view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                statusFilter === f.value
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "bg-[var(--bg)] text-[var(--tx2)] hover:bg-[var(--bg2)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              viewMode === "list" ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx2)] hover:bg-[var(--bg2)]"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("card")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              viewMode === "card" ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx2)] hover:bg-[var(--bg2)]"
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length > 0 ? (
        viewMode === "list" ? (
          <div>{filtered.map(renderItem)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(renderCard)}</div>
        )
      ) : (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-12 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No change requests yet.</p>
          <p className="text-[11px] text-[var(--tx3)] mt-1">Clients submit requests from their move portal.</p>
        </div>
      )}

      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="approve-modal-title">
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
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none mb-4"
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
