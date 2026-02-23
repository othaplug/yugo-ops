"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "../../components/Toast";

type Message = {
  id: string;
  sender_name: string;
  sender_type: string;
  content: string;
  is_read?: boolean;
  created_at: string;
};

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  if (today) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function ClientMessagesSection({ moveId, clientName }: { moveId: string; clientName?: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const justSentRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/moves/${moveId}/messages`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch");
        if (!cancelled) setMessages(data.messages ?? []);
      } catch (e) {
        if (!cancelled) toast(e instanceof Error ? e.message : "Failed to load messages", "alertTriangle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [moveId]);

  useEffect(() => {
    if (justSentRef.current) {
      justSentRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/moves/${moveId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, senderName: "Yugo" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      justSentRef.current = true;
      setMessages((prev) => [...prev, data.message]);
      setReply("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send", "x");
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter((m) => m.sender_type === "client" && !m.is_read).length;

  return (
    <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)]">
          Client Messages
          {unreadCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--gold)] text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </h3>
      </div>

      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading messages…</p>
      ) : (
        <div className="space-y-3 max-h-[280px] overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-[11px] text-[var(--tx3)]">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-[11px]">
                <span className="font-medium text-[var(--tx2)]">
                  {m.sender_type === "client" ? (clientName || m.sender_name) : m.sender_name}
                </span>
                <span className="text-[var(--tx3)] ml-1.5">· {formatMsgTime(m.created_at)}</span>
                <p className="mt-0.5 text-[var(--tx2)] leading-snug whitespace-pre-wrap">{m.content}</p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSend} className="mt-3 pt-3 border-t border-[var(--brd)]/40">
        <div className="flex gap-2">
          <input
            type="text"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply..."
            maxLength={2000}
            disabled={sending}
            className="flex-1 rounded-md border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[11px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="rounded-md px-4 py-2 text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
