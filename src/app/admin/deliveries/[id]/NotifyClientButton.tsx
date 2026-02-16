"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";

export default function NotifyClientButton({ delivery, clientEmail }: { delivery: any; clientEmail?: string | null }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const toEmail = (delivery.customer_email || "").trim() || (clientEmail || "").trim();

  const handleNotify = async () => {
    if (!toEmail) {
      toast("Add customer email on the delivery (Edit) or ensure the client has an email.", "x");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          fallbackTo: clientEmail || "",
          deliveryId: delivery.id,
          customerName: delivery.customer_name,
          clientName: delivery.client_name || "",
          deliveryNumber: delivery.delivery_number,
          status: delivery.status,
          deliveryAddress: delivery.delivery_address,
          pickupAddress: delivery.pickup_address || "",
          scheduledDate: delivery.scheduled_date || "",
          deliveryWindow: delivery.delivery_window || "",
          itemsCount: Array.isArray(delivery.items) ? delivery.items.length : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast(`Notification sent to ${delivery.customer_name}`, "mail");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send notification", "x");
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleNotify} 
      disabled={loading || !toEmail}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all disabled:opacity-50"
    >
      {loading ? "Sending..." : "Notify Client"}
    </button>
  );
}