"use client";

/**
 * Admin button for sending the end-customer tracking SMS + email on a
 * B2B delivery. Mirrors the auto-fire path now baked into
 * /api/admin/deliveries/create, but as a manual trigger for:
 *   - deliveries booked before the auto-fire path shipped
 *   - reschedules where the customer needs a fresh nudge
 *   - operator-driven resends after a number/email correction
 *
 * Backing endpoint: POST /api/admin/deliveries/[id]/send-customer-tracking.
 */

import { useState } from "react";
import { useToast } from "../../components/Toast";
import { PaperPlaneTilt as Send } from "@phosphor-icons/react";

export default function SendCustomerTrackingButton({
  delivery,
}: {
  delivery: {
    id: string;
    delivery_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
  };
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    const phone = (delivery.customer_phone || "").trim();
    const email = (delivery.customer_email || "").trim();
    if (!phone && !email) {
      toast(
        "No customer phone or email on this delivery. Edit the delivery first.",
        "alertTriangle",
      );
      return;
    }
    const targets: string[] = [];
    if (phone) targets.push(`SMS (${phone})`);
    if (email) targets.push(`email (${email})`);
    if (
      !window.confirm(
        `Send the customer tracking link for ${delivery.delivery_number || delivery.id}?\n\nWill send to: ${targets.join(" + ")}.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/deliveries/${delivery.id}/send-customer-tracking`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sent_to?: string[];
        token_issued?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast(data.error || `Failed (${res.status})`, "alertTriangle");
        return;
      }
      const parts = data.sent_to ?? [];
      toast(
        `Customer tracking sent (${parts.join(", ") || "delivered"})${data.token_issued ? " — token issued" : ""}`,
        "mail",
      );
    } catch {
      toast("Network error, try again", "alertTriangle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      title="Send the end-customer their tracking link (SMS + email) with the day + time window."
    >
      <Send className="w-[10px] h-[10px]" />
      {loading ? "Sending…" : "Send customer tracking"}
    </button>
  );
}
