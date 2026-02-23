"use client";

import { useState, useEffect, useRef } from "react";
import TrackMessageForm from "./TrackMessageForm";

type Message = {
  id: string;
  sender_name: string;
  sender_type: string;
  content: string;
  created_at: string;
};

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function TrackMessageThread({ moveId, token }: { moveId: string; token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/track/moves/${moveId}/messages?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSent = (sentContent?: string) => {
    if (sentContent) {
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          sender_name: "You",
          sender_type: "client",
          content: sentContent,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    fetchMessages();
  };

  useEffect(() => {
    fetchMessages();
  }, [moveId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-[13px] text-[#666]">Loading messages…</p>
      ) : (
        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="text-[13px] text-[#666]">No messages yet. Send one below.</p>
          ) : (
            messages.map((m) => {
              const isClient = m.sender_type === "client";
              const initials = isClient ? "Me" : (m.sender_name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
              return (
                <div
                  key={m.id}
                  className={`flex w-full ${isClient ? "justify-start" : "justify-end"}`}
                >
                  <div className={`flex gap-3 max-w-[85%] sm:max-w-[80%] ${isClient ? "flex-row" : "flex-row-reverse"}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${isClient ? "bg-[#3B82F6] text-white" : "bg-[#E8D5A3] text-[#1A1A1A]"}`}>
                      {initials}
                    </div>
                    <div
                      className={`min-w-0 rounded-xl px-4 py-2.5 ${
                        isClient ? "bg-white border border-[#E7E5E4] text-[#1A1A1A]" : "bg-[#C9A962] text-[var(--btn-text-on-accent)]"
                      }`}
                    >
                      <p className="text-[13px] leading-snug whitespace-pre-wrap">{m.content}</p>
                      <p className={`text-[10px] mt-1.5 ${isClient ? "text-[#666]" : "text-white/80"}`}>{formatMsgTime(m.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <TrackMessageForm moveId={moveId} token={token} onSent={handleSent} />
    </div>
  );
}
