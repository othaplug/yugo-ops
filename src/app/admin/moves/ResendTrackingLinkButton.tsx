"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import { Mail } from "lucide-react";

export default function ResendTrackingLinkButton({ move }: { move: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    const toEmail = (move.client_email || move.customer_email || "").trim();
    if (!toEmail) {
      toast("Add client email first (click name → edit contact)", "alertTriangle");
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
      toast(`Tracking link sent to ${move.client_name || toEmail}`, "mail");
    } catch {
      toast("Network error — try again", "alertTriangle");
    } finally {
      setLoading(false);
    }
  };

  const hasEmail = !!(move.client_email || move.customer_email || "").trim();

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      title={hasEmail ? "Send magic-link tracking URL to client email" : "Add client email first (click name → edit contact)"}
    >
      <Mail className="w-[10px] h-[10px]" />
      {loading ? "Sending…" : "Resend tracking link"}
    </button>
  );
}
