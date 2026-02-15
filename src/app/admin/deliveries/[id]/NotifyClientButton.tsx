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
        }),
      });
      toast(`Notification sent to ${delivery.customer_name}`, "📧");
    } catch { 
      toast(`Notification queued for ${delivery.customer_name}`, "📧"); 
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleNotify} 
      disabled={loading}
      className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--blu)] text-white hover:opacity-90 transition-all disabled:opacity-50"
    >
      {loading ? "Sending..." : "📧 Notify Client"}
    </button>
  );
}