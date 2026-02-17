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
              return (
                <div
                  key={m.id}
                  className={`flex ${isClient ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                      isClient
                        ? "bg-[#F5F5F3] text-[#1A1A1A]"
                        : "bg-[#C9A962] text-white"
                    }`}
                  >
                    <p className="text-[10px] font-semibold opacity-90 mb-0.5">
                      {isClient ? "You" : m.sender_name} · {formatMsgTime(m.created_at)}
                    </p>
                    <p className="text-[13px] leading-snug whitespace-pre-wrap">{m.content}</p>
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
