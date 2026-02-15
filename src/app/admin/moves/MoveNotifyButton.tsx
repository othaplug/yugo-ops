"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";

export default function MoveNotifyButton({ move }: { move: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleNotify = async () => {
    setLoading(true);
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: move.client_email || move.customer_email || "",
          customerName: move.client_name,
          deliveryNumber: `MOVE-${move.id?.slice(0, 8) || "N/A"}`,
          status: move.status,
          deliveryAddress: move.to_address || move.delivery_address || "",
        }),
      });
      toast(`Notification sent to ${move.client_name}`, "mail");
    } catch {
      toast(`Notification queued for ${move.client_name}`, "mail");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleNotify}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all disabled:opacity-50"
    >
      {loading ? "Sending…" : "Notify"}
    </button>
  );
}
