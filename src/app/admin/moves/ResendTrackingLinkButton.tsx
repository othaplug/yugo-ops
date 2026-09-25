"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { Envelope as Mail } from "@phosphor-icons/react";

export default function ResendTrackingLinkButton({ move }: { move: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    const toEmail = (move.client_email || move.customer_email || "").trim();
    const toPhone = (move.client_phone || "").trim();
    if (!toEmail && !toPhone) {
      toast("Add a client email or phone first (Client → Edit)", "alertTriangle");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/moves/${move.id}/send-tracking-link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data?.error || `Failed to send (${res.status})`, "alertTriangle");
        return;
      }
      const parts: string[] = [];
      if (data.emailsSent) parts.push(`${data.emailsSent} email${data.emailsSent > 1 ? "s" : ""}`);
      if (data.smsSent) parts.push(`${data.smsSent} text${data.smsSent > 1 ? "s" : ""}`);
      toast(
        parts.length ? `Tracking link sent (${parts.join(" + ")})` : "Tracking link sent",
        "mail",
      );
    } catch {
      toast("Network error, try again", "alertTriangle");
    } finally {
      setLoading(false);
    }
  };

  const hasContact = !!(
    (move.client_email || move.customer_email || "").trim() ||
    (move.client_phone || "").trim()
  );

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      title={hasContact ? "Send the tracking link to the client email and phone (and any additional contacts)" : "Add a client email or phone first (Client → Edit)"}
    >
      <Mail className="w-[10px] h-[10px]" />
      {loading ? "Sending…" : "Resend tracking link"}
    </button>
  );
}
