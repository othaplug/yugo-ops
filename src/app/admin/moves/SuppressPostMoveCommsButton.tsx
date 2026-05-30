"use client";

/**
 * Suppress every automated post-move communication for a given move:
 *   - 24-48h Google review request
 *   - 72h perks email
 *   - 365-day anniversary email
 *   - Any pending review_requests row (cancelled, not deleted)
 *
 * Use cases:
 *   - Client had a bad experience and you want a personal-only follow-up
 *   - Client explicitly opted out of marketing
 *   - VIP / sensitive move that bypasses the standard lifecycle
 *
 * Backing endpoint: POST /api/admin/moves/[id]/suppress-post-move-comms.
 * Audit-logged. Idempotent — re-running just appends a new note.
 *
 * UX:
 *   - One click → prompt for an optional reason
 *   - Confirm → POST → toast result
 *   - The internal_notes block on the move detail page documents
 *     exactly what was suppressed and by whom.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import { BellSlash } from "@phosphor-icons/react";

export default function SuppressPostMoveCommsButton({
  move,
}: {
  move: { id: string; move_code?: string | null; client_name?: string | null };
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSuppress = async () => {
    const code = move.move_code || move.id;
    const name = move.client_name || "this client";
    if (
      !window.confirm(
        `Stop all post-move emails / SMS for ${code} (${name})?\n\n` +
          `This blocks:\n` +
          `  • 24-48h review request email\n` +
          `  • 72h perks email\n` +
          `  • 365-day anniversary email\n` +
          `  • Automated SMS check-ins\n\n` +
          `Tracking, billing, and crew-side actions are unaffected.\n` +
          `Reversible later by clearing the *_sent timestamps on the move row.`,
      )
    ) {
      return;
    }
    const reason = window.prompt(
      "Optional reason (logged to internal notes):",
      "",
    );
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/moves/${move.id}/suppress-post-move-comms`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? "" }),
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
      const cancelled =
        (data as { cancelled_review_requests?: number }).cancelled_review_requests ?? 0;
      toast(
        cancelled > 0
          ? `Suppressed. Also cancelled ${cancelled} pending review request${cancelled === 1 ? "" : "s"}.`
          : "Post-move communications suppressed.",
        "check",
      );
      router.refresh();
    } catch {
      toast("Network error, try again", "alertTriangle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSuppress}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-red-400 hover:bg-[var(--card)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      title="Stop all automated post-move emails / SMS for this move (review request, perks, anniversary, SMS check-in)."
    >
      <BellSlash className="w-[10px] h-[10px]" />
      {loading ? "Suppressing…" : "Suppress post-move comms"}
    </button>
  );
}
