"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";

export default function SendB2BOneOffInvoiceButton({
  delivery,
  onSent,
  pendingInvoice,
}: {
  delivery: { id: string; payment_received_at?: string | null };
  onSent?: () => void;
  /** When an invoice row exists but Square has not marked it paid yet */
  pendingInvoice?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/delivery-b2b-one-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: delivery.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Failed to send invoice", "alertTriangle");
        setLoading(false);
        return;
      }
      if (data.message === "Invoice already exists") {
        toast("An invoice already exists for this delivery.", "check");
        onSent?.();
        setLoading(false);
        return;
      }
      toast(
        data.squareInvoiceUrl
          ? "Square invoice sent to the business contact."
          : "Square invoice created. Share the link from admin if email was not used.",
        "check",
      );
      onSent?.();
    } catch {
      toast("Failed to send invoice", "alertTriangle");
    }
    setLoading(false);
  };

  const paid = !!delivery.payment_received_at;
  const blocked = paid || !!pendingInvoice;

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={loading || blocked}
      className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--bg)] transition-all disabled:opacity-50"
    >
      {loading ? "Sending…" : paid ? "Paid" : pendingInvoice ? "Invoice outstanding" : "Send Square invoice"}
    </button>
  );
}
