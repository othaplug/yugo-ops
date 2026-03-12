"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";

interface CancelMoveModalProps {
  move: {
    id: string;
    move_code?: string;
    client_name?: string;
    service_type?: string;
    scheduled_date?: string;
    deposit_amount?: number;
    square_payment_id?: string;
  };
  open: boolean;
  onClose: () => void;
  onCancelled?: () => void;
}

const REASONS = [
  { value: "client_requested", label: "Client requested" },
  { value: "date_conflict", label: "Date conflict" },
  { value: "scope_changed", label: "Scope changed" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "other", label: "Other" },
];

const POLICY_HOURS: Record<string, number> = {
  local_move: 48,
  long_distance: 72,
  office_move: 72,
  single_item: 24,
  white_glove: 24,
  specialty: 72,
};

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function CancelMoveModal({ move, open, onClose, onCancelled }: CancelMoveModalProps) {
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial" | "none">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const policyCheck = useMemo(() => {
    if (!move.scheduled_date) return { eligible: true, message: "No date set — policy cannot be evaluated." };
    const moveDate = new Date(move.scheduled_date + "T09:00:00");
    const hoursUntil = (moveDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const required = POLICY_HOURS[move.service_type ?? "local_move"] ?? 48;
    const eligible = hoursUntil >= required;
    const daysUntil = Math.max(0, Math.floor(hoursUntil / 24));

    return {
      eligible,
      message: eligible
        ? `Move is ${daysUntil} day${daysUntil !== 1 ? "s" : ""} away — full refund eligible per ${required}hr policy.`
        : `Move is within the ${required}hr cancellation window (${daysUntil}d away). Partial or no refund per policy.`,
    };
  }, [move.scheduled_date, move.service_type]);

  const depositAmount = Number(move.deposit_amount) || 0;

  async function handleSubmit() {
    if (!reason) {
      setError("Please select a reason.");
      return;
    }
    if (refundType === "partial" && (!partialAmount || Number(partialAmount) <= 0)) {
      setError("Enter a valid partial refund amount.");
      return;
    }
    if (refundType === "partial" && Number(partialAmount) > depositAmount) {
      setError("Refund amount cannot exceed the deposit paid.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/moves/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveId: move.id,
          reason,
          reasonDetail: reasonDetail.trim() || undefined,
          refundType,
          refundAmount: refundType === "partial" ? Number(partialAmount) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Cancellation failed. Please try again.");
        return;
      }

      setSuccess(true);
      onCancelled?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const selectClass = "w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] focus:border-[var(--brd)] focus:ring-1 focus:ring-[var(--brd)]/30 outline-none";
  const inputClass = selectClass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-[var(--brd)] bg-[var(--card)] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--red)]/10 flex items-center justify-center">
                <span className="text-[var(--red)] text-xl">✓</span>
              </div>
              <h2 className="text-lg font-bold text-[var(--tx)] mb-2">Move Cancelled</h2>
              <p className="text-sm text-[var(--tx2)]">
                {move.move_code || "This move"} has been cancelled.
                {refundType !== "none" && " The refund has been submitted to Square."}
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 rounded-lg bg-[var(--brd)] text-[var(--tx)] text-sm font-medium hover:bg-[var(--brd)]/80 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-[9px] font-bold text-[var(--red)] tracking-widest uppercase mb-1">Cancel Move</div>
                <h2 className="text-lg font-bold text-[var(--tx)]">
                  Cancel move for {move.client_name || "this client"}?
                </h2>
                {move.move_code && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)]">
                    {move.move_code}
                  </span>
                )}
              </div>

              {/* Policy check */}
              <div className={`rounded-lg px-4 py-3 mb-5 text-[12px] border ${
                policyCheck.eligible
                  ? "bg-[var(--green)]/5 border-[var(--green)]/20 text-[var(--green)]"
                  : "bg-[var(--red)]/5 border-[var(--red)]/20 text-[var(--red)]"
              }`}>
                {policyCheck.message}
              </div>

              {/* Reason */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1.5">
                  Cancellation Reason <span className="text-[var(--red)]">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select reason...</option>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {reason === "other" && (
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1.5">Details</label>
                  <input
                    type="text"
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    placeholder="Describe the reason..."
                    className={inputClass}
                  />
                </div>
              )}

              {/* Refund type */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-2">
                  Refund Decision
                </label>
                <div className="space-y-2">
                  {depositAmount > 0 && (
                    <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                      <input
                        type="radio"
                        name="refund"
                        value="full"
                        checked={refundType === "full"}
                        onChange={() => setRefundType("full")}
                        className="accent-[var(--gold)]"
                      />
                      Full refund ({formatCurrency(depositAmount)})
                    </label>
                  )}
                  {depositAmount > 0 && (
                    <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                      <input
                        type="radio"
                        name="refund"
                        value="partial"
                        checked={refundType === "partial"}
                        onChange={() => setRefundType("partial")}
                        className="accent-[var(--gold)]"
                      />
                      Partial refund
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                    <input
                      type="radio"
                      name="refund"
                      value="none"
                      checked={refundType === "none"}
                      onChange={() => setRefundType("none")}
                      className="accent-[var(--gold)]"
                    />
                    No refund
                  </label>
                </div>
              </div>

              {refundType === "partial" && (
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1.5">
                    Refund Amount (max {formatCurrency(depositAmount)})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] text-[13px]">$</span>
                    <input
                      type="number"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      max={depositAmount}
                      step="0.01"
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                </div>
              )}

              {!move.square_payment_id && refundType !== "none" && (
                <div className="rounded-lg px-4 py-3 mb-5 text-[12px] border bg-[var(--gold)]/5 border-[var(--gold)]/20 text-[var(--gold)]">
                  No Square payment on file. Refund will be recorded but not processed automatically.
                </div>
              )}

              {error && (
                <div className="rounded-lg px-4 py-3 mb-4 text-[12px] border bg-[var(--red)]/5 border-[var(--red)]/20 text-[var(--red)]">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-sm font-medium hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                >
                  Keep Move
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !reason}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--red)] text-white text-sm font-semibold hover:bg-[var(--red)]/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
