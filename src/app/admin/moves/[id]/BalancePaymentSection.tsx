"use client";

import { useState } from "react";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { useToast } from "../../components/Toast";

interface BalancePaymentSectionProps {
  move: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onUpdate: (move: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function getBalanceStatus(move: any): { label: string; color: string } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const balanceAmount = Number(move.balance_amount || 0);
  if (balanceAmount > 0 && move.balance_paid_at) {
    return { label: "Additional balance due", color: "text-[var(--gold)]" };
  }
  if (move.balance_paid_at) {
    if (move.balance_method === "etransfer") return { label: "E-transfer received", color: "text-[var(--grn)]" };
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
  const [loading, setLoading] = useState<"etransfer" | "card" | null>(null);

  const balanceAmount = Number(move.balance_amount || 0);
  const isBalancePaid = !!move.balance_paid_at;

  if (balanceAmount <= 0 && !isBalancePaid) return null;

  const status = getBalanceStatus(move);

  const handleETransfer = async () => {
    if (!window.confirm("Confirm that you've received the e-transfer for this move's balance?")) return;
    setLoading("etransfer");
    try {
      const res = await fetch(`/api/admin/moves/${move.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_etransfer_received", marked_by: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onUpdate(data);
      toast("E-transfer marked as received", "check");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to mark e-transfer", "alertTriangle");
    } finally {
      setLoading(null);
    }
  };

  const handleChargeCard = async () => {
    const ccTotal = (balanceAmount * 1.033 + 0.15).toFixed(2);
    if (!window.confirm(`Charge ${ccTotal} CAD to the client's card on file? This includes the 3.3% processing fee.`)) return;
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
          <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Balance amount</span>
          <div className="text-[15px] font-bold text-[var(--tx)]">{formatCurrency(balanceAmount)}</div>
          {balanceAmount > 0 && <div className="text-[9px] text-[var(--tx3)]">+{formatCurrency(calcHST(balanceAmount))} HST</div>}
        </div>
        <div>
          <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Payment status</span>
          <div className={`text-[13px] font-bold ${status.color}`}>{status.label}</div>
        </div>
        {move.balance_method && (
          <div>
            <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Method</span>
            <div className="text-[13px] font-medium text-[var(--tx)]">
              {move.balance_method === "etransfer" ? "E-Transfer" : "Credit Card"}
              {move.balance_auto_charged && " (auto)"}
            </div>
          </div>
        )}
      </div>

      {balanceAmount > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--brd)]/50 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleETransfer}
            disabled={loading !== null}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--grn)]/15 text-[var(--grn)] border border-[var(--grn)]/40 hover:bg-[var(--grn)]/25 transition-colors disabled:opacity-50"
          >
            {loading === "etransfer" ? "Processing…" : "Mark E-Transfer Received"}
          </button>
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
        </div>
      )}
    </div>
  );
}
