"use client";

import { useState } from "react";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { useToast } from "../../components/Toast";

interface BalancePaymentSectionProps {
  move: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onUpdate: (move: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const OVERRIDE_REASONS = [
  { value: "wire_transfer",    label: "Wire transfer received" },
  { value: "cheque_deposited", label: "Cheque deposited" },
  { value: "other",            label: "Other (explain below)" },
];

function getBalanceStatus(move: any): { label: string; color: string } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const balanceAmount = Number(move.balance_amount || 0);
  if (balanceAmount > 0 && move.balance_paid_at) {
    return { label: "Additional balance due", color: "text-[var(--gold)]" };
  }
  if (move.balance_paid_at) {
    if (move.balance_method === "card") return { label: "Card charged", color: "text-[var(--grn)]" };
    return { label: "Paid", color: "text-[var(--grn)]" };
  }
  if (balanceAmount <= 0) return { label: "No balance due", color: "text-[var(--tx3)]" };

  if (move.scheduled_date) {
    const moveDate = new Date(move.scheduled_date + "T00:00:00");
    const hoursUntil = (moveDate.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 24) return { label: "Overdue", color: "text-[var(--red)]" };
  }

  return { label: "Pending", color: "text-[var(--gold)]" };
}

export default function BalancePaymentSection({ move, onUpdate }: BalancePaymentSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"override" | "card" | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("wire_transfer");
  const [overrideNote, setOverrideNote] = useState("");

  const balanceAmount = Number(move.balance_amount || 0);
  const isBalancePaid = !!move.balance_paid_at;

  if (balanceAmount <= 0 && !isBalancePaid) return null;

  const status = getBalanceStatus(move);

  const handleOverride = async () => {
    if (overrideReason === "other" && !overrideNote.trim()) {
      toast("Please explain the reason before submitting", "alertTriangle");
      return;
    }
    setLoading("override");
    try {
      const res = await fetch(`/api/admin/moves/${move.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_as_paid_override",
          marked_by: "admin",
          reason: overrideReason,
          reason_note: overrideNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onUpdate(data);
      toast("Balance marked as paid", "check");
      setShowOverride(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to mark as paid", "alertTriangle");
    } finally {
      setLoading(null);
    }
  };

  const handleChargeCard = async () => {
    if (!window.confirm(`Charge ${formatCurrency(balanceAmount)} CAD to the client's card on file?`)) return;
    setLoading("card");
    try {
      const res = await fetch(`/api/admin/moves/${move.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "charge_card_now", marked_by: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onUpdate(data);
      toast("Card charged successfully", "check");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to charge card", "alertTriangle");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-4 transition-colors">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-3">Balance Payment</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        <div>
          <span className="text-[10px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Balance amount</span>
          <div className="text-[15px] font-bold text-[var(--tx)]">{formatCurrency(balanceAmount)}</div>
          {balanceAmount > 0 && <div className="text-[9px] text-[var(--tx3)]">+{formatCurrency(calcHST(balanceAmount))} HST</div>}
        </div>
        <div>
          <span className="text-[10px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Payment status</span>
          <div className={`text-[13px] font-bold ${status.color}`}>{status.label}</div>
        </div>
        {move.balance_method && (
          <div>
            <span className="text-[10px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Method</span>
            <div className="text-[13px] font-medium text-[var(--tx)]">
              {move.balance_method === "card" ? "Credit Card" : "Admin Override"}
              {move.balance_auto_charged && " (auto)"}
            </div>
          </div>
        )}
      </div>

      {balanceAmount > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--brd)]/50 flex flex-wrap items-center gap-2">
          {move.square_card_id && (
            <button
              type="button"
              onClick={handleChargeCard}
              disabled={loading !== null}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/40 hover:bg-[var(--gold)]/25 transition-colors disabled:opacity-50"
            >
              {loading === "card" ? "Charging…" : "Charge Card Now"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowOverride((v) => !v)}
            disabled={loading !== null}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--bg2)] text-[var(--tx3)] border border-[var(--brd)] hover:text-[var(--tx)] hover:border-[var(--brd)]/80 transition-colors disabled:opacity-50"
          >
            Mark as Paid (Override)
          </button>
        </div>
      )}

      {showOverride && balanceAmount > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--brd)]/50 space-y-3">
          <p className="text-[10px] text-[var(--tx3)]">
            Use only for exceptional cases — wire transfer, cheque, or a legacy arrangement. All overrides are audit-logged.
          </p>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1.5">Reason</label>
            <div className="flex flex-col gap-2">
              {OVERRIDE_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="overrideReason"
                    value={r.value}
                    checked={overrideReason === r.value}
                    onChange={() => setOverrideReason(r.value)}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[11px] text-[var(--tx)]">{r.label}</span>
                </label>
              ))}
            </div>
          </div>
          {overrideReason === "other" && (
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1.5">Explanation *</label>
              <input
                type="text"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Describe the payment method…"
                className="w-full px-3 py-2 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)]/50"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOverride}
              disabled={loading !== null}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--grn)]/15 text-[var(--grn)] border border-[var(--grn)]/40 hover:bg-[var(--grn)]/25 transition-colors disabled:opacity-50"
            >
              {loading === "override" ? "Recording…" : "Confirm Override"}
            </button>
            <button
              type="button"
              onClick={() => setShowOverride(false)}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--bg2)] text-[var(--tx3)] border border-[var(--brd)] hover:text-[var(--tx)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
