"use client";

/**
 * Super-admin-only button for re-firing the two booking-time emails
 * (tier confirmation + pre-move survey invite). Used when the original
 * recipient address was wrong and Resend put it on its suppression
 * list — after correcting the email on the move + contact row, this
 * resends to the new address without re-running the full
 * runPostPaymentActions orchestration.
 *
 * Backing endpoint: POST /api/admin/moves/[id]/resend-booking-emails.
 */

import { useState } from "react";
import { useToast } from "../components/Toast";
import { PaperPlaneTilt as Send } from "@phosphor-icons/react";

export default function ResendBookingEmailsButton({
  move,
}: {
  move: { id: string; client_email?: string | null; client_name?: string | null };
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResend = async () => {
    const toEmail = (move.client_email || "").trim();
    if (!toEmail) {
      toast(
        "No client_email on this move. Edit the client first.",
        "alertTriangle",
      );
      return;
    }
    if (
      !window.confirm(
        `Resend booking confirmation + pre-move survey to ${toEmail}?\n\nUse only after fixing a wrong-recipient email — the originals stay logged but the new copies will land at the corrected address.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/moves/${move.id}/resend-booking-emails`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(
          (data as { error?: string })?.error || `Failed (${res.status})`,
          "alertTriangle",
        );
        return;
      }
      const failed = (
        (data as { results?: { name: string; ok: boolean; error?: string }[] })
          .results ?? []
      ).filter((r) => !r.ok);
      if (failed.length > 0) {
        toast(
          `Partial: ${failed.map((f) => f.name).join(", ")} failed — check logs`,
          "alertTriangle",
        );
      } else {
        toast(`Booking emails resent to ${toEmail}`, "mail");
      }
    } catch {
      toast("Network error, try again", "alertTriangle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      title="Super admin only. Resend booking confirmation + pre-move survey emails."
    >
      <Send className="w-[10px] h-[10px]" />
      {loading ? "Sending…" : "Resend booking emails"}
    </button>
  );
}
