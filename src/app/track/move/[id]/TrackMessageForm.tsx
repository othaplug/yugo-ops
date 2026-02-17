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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          disabled={sending || sent}
          className="flex-1 rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-4 py-2.5 text-[13px] text-[#1A1A1A] placeholder:text-[#999] focus:border-[#C9A962] outline-none disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={sending || !message.trim() || sent}
          className="rounded-lg px-5 py-2.5 text-[12px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89A52] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sending…" : sent ? "Sent" : "Send"}
        </button>
      </div>
      {error && <p className="text-[11px] text-[#D14343]">{error}</p>}
      {sent && <p className="text-[11px] text-[#22C55E]">Message sent. We&apos;ll get back to you soon.</p>}
    </form>
  );
}
