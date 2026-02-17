"use client";

import { useState } from "react";

export default function TrackMessageForm({ moveId, token }: { moveId: string; token: string }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/message?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setMessage("");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Send a message to your coordinator..."
        rows={3}
        maxLength={2000}
        disabled={sending || sent}
        className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none disabled:opacity-50 resize-y transition-colors"
      />
      {error && <p className="text-[11px] text-[var(--red)]">{error}</p>}
      {sent && <p className="text-[11px] text-[var(--grn)]">Message sent. We&apos;ll get back to you soon.</p>}
      <button
        type="submit"
        disabled={sending || !message.trim() || sent}
        className="rounded-lg px-4 py-2 text-[12px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {sending ? "Sending…" : sent ? "Sent" : "Send Message"}
      </button>
    </form>
  );
}
