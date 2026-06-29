"use client";

/**
 * Admin button for firing the T-24h pre-move reminder email + SMS
 * on-demand. Same copy as the daily cron — used when:
 *   - a move slipped past its automated reminder window
 *   - the move was rescheduled and needs a fresh "tomorrow" nudge
 *   - the operator wants to re-send after fixing an email or phone
 *
 * Backing endpoint: POST /api/admin/moves/[id]/send-move-reminder.
 */

import { useState } from "react";
import { useToast } from "../components/Toast";
import { Bell } from "@phosphor-icons/react";

export default function SendMoveReminderButton({
  move,
}: {
  move: {
    id: string;
    move_code?: string | null;
    client_email?: string | null;
    client_phone?: string | null;
  };
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    const code = move.move_code || move.id;
    const targets: string[] = [];
    if (move.client_email) targets.push(`email (${move.client_email})`);
    if (move.client_phone) targets.push(`SMS (${move.client_phone})`);
    if (targets.length === 0) {
      toast("No client_email or client_phone on this move.", "alertTriangle");
      return;
    }
    if (
      !window.confirm(
        `Send the move-day reminder for ${code}?\n\nWill send to: ${targets.join(" + ")}.\n\nUse for off-cycle reminders or after a reschedule.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/moves/${move.id}/send-move-reminder`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        emailOk?: boolean;
        smsOk?: boolean;
        emailError?: string | null;
        smsError?: string | null;
        error?: string;
      };
      if (!res.ok) {
        toast(data.error || `Failed (${res.status})`, "alertTriangle");
        return;
      }
      const parts: string[] = [];
      if (data.emailOk) parts.push("email");
      if (data.smsOk) parts.push("SMS");
      if (parts.length === 0) {
        const why = data.emailError || data.smsError || "no channel succeeded";
        toast(`Reminder failed: ${why}`, "alertTriangle");
      } else {
        toast(`Move reminder sent (${parts.join(" + ")})`, "bell");
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
      onClick={handleSend}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      title="Send the pre-move-day reminder email + SMS now (mirrors the daily cron template)."
    >
      <Bell className="w-[10px] h-[10px]" />
      {loading ? "Sending…" : "Send move reminder"}
    </button>
  );
}
