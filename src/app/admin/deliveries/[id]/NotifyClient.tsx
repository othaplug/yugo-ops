"use client";

import { useToast } from "../../components/Toast";

export default function NotifyClient({ delivery }: { delivery: any }) {
  const { toast } = useToast();

  const handleNotify = async () => {
    try {
      // Send email
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "client@example.com", // In production, pull from organizations table
          subject: `Yugo Delivery Update: ${delivery.delivery_number}`,
          html: `<p>Your delivery ${delivery.delivery_number} is now <b>${delivery.status}</b>.</p><p>Delivery to: ${delivery.delivery_address}</p>`,
        }),
      });

      toast("Client notified via email", "📧");
    } catch {
      toast("Notification failed", "❌");
    }
  };

  return (
    <button
      onClick={handleNotify}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all"
    >
      Notify Client
    </button>
  );
}