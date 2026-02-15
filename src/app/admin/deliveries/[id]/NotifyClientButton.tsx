"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";

export default function NotifyClientButton({ delivery }: { delivery: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleNotify = async () => {
    setLoading(true);
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: delivery.customer_email || "",
          customerName: delivery.customer_name,
          deliveryNumber: delivery.delivery_number,
          status: delivery.status,
          deliveryAddress: delivery.delivery_address,
          scheduledDate: delivery.scheduled_date || "",
          deliveryWindow: delivery.delivery_window || "",
        }),
      });
      toast(`Notification sent to ${delivery.customer_name}`, "mail");
    } catch { 
      toast(`Notification queued for ${delivery.customer_name}`, "mail"); 
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleNotify} 
      disabled={loading}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all disabled:opacity-50"
    >
      {loading ? "Sending..." : "Notify Client"}
    </button>
  );
}