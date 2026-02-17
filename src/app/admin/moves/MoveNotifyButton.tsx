"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { getMoveCode } from "@/lib/move-code";

export default function MoveNotifyButton({ move }: { move: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleNotify = async () => {
    const toEmail = (move.client_email || move.customer_email || "").trim();
    if (!toEmail) {
      toast("Add client email first (click name → edit contact)", "alertTriangle");
      return;
    }
    setLoading(true);
    try {
      const estimate = Number(move.estimate || 0);
      const moveCode = getMoveCode(move);
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "move",
          to: toEmail,
          moveId: move.id,
          moveCode,
          customerName: move.client_name,
          deliveryNumber: moveCode,
          status: move.status,
          stage: move.stage || null,
          nextAction: move.next_action || null,
          fromAddress: move.from_address || "",
          deliveryAddress: move.to_address || move.delivery_address || "",
          scheduledDate: move.scheduled_date || "",
          moveType: move.move_type || "residential",
          estimate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || (res.status === 400 ? "No recipient email" : "Failed to send");
        toast(msg, "alertTriangle");
        return;
      }
      toast(`Notification sent to ${move.client_name}`, "mail");
    } catch {
      toast("Network error — try again", "alertTriangle");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleNotify}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-colors disabled:opacity-50"
    >
      {loading ? "Sending…" : "Notify"}
    </button>
  );
}
