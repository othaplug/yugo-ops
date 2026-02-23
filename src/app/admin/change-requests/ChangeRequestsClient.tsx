"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import { formatJobId, getMoveDetailPath } from "@/lib/move-code";

export default function ChangeRequestsClient({
  pending,
  reviewed,
}: {
  pending: any[];
  reviewed: any[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<{ id: string } | null>(null);
  const [approveFeeDollars, setApproveFeeDollars] = useState("");

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

  const renderRow = (r: any) => {
    const move = r.moves ?? r.move;
    const moveData = Array.isArray(move) ? move[0] : move;
    const clientName = moveData?.client_name ?? "—";
    const rawCode = moveData?.move_code || moveData?.id?.slice(0, 8) || "";
    const moveCode = rawCode ? formatJobId(rawCode, "move") : "—";

    return (
      <div
        key={r.id}
        className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 mb-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={getMoveDetailPath(moveData ? { move_code: moveData.move_code, id: r.move_id } : { id: r.move_id })}
                className="text-[12px] font-semibold text-[var(--gold)] hover:underline"
              >
                {clientName}
              </Link>
              <span className="text-[10px] text-[var(--tx3)]">{moveCode}</span>
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
            <div className="mt-2 text-[9px] text-[var(--tx3)]">
              {new Date(r.created_at).toLocaleString()}
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

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h2 className="text-[13px] font-bold text-[var(--tx)] mb-3">Pending ({pending.length})</h2>
          {pending.map(renderRow)}
        </div>
      )}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-[13px] font-bold text-[var(--tx)] mb-3">Reviewed</h2>
          {reviewed.map(renderRow)}
        </div>
      )}
      {pending.length === 0 && reviewed.length === 0 && (
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
