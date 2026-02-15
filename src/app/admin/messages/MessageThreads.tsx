"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  thread_id: string;
  sender_name: string;
  sender_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function formatTimeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHrs < 24) return `${diffHrs} hrs ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export default function MessageThreads({
  threads,
}: {
  threads: Record<string, Message[]>;
}) {
  const [openThread, setOpenThread] = useState<string | null>(Object.keys(threads)[0] || null);
  const [replyText, setReplyText] = useState("");
  const supabase = createClient();
  const router = useRouter();

  const sendReply = async (threadId: string) => {
    if (!replyText.trim()) return;

    await supabase.from("messages").insert({
      thread_id: threadId,
      sender_name: "J. Oche",
      sender_type: "admin",
      content: replyText.trim(),
      is_read: true,
    });

    setReplyText("");
    router.refresh();
  };

  const threadEntries = Object.entries(threads);
  const selectedMsgs = openThread ? threads[openThread] : null;

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-0 border border-[var(--brd)] rounded-xl overflow-hidden bg-[var(--card)]">
      {/* Thread list */}
      <div className="border-r border-[var(--brd)] max-h-[500px] overflow-y-auto">
        {threadEntries.map(([threadId, msgs]) => {
          const latest = msgs[0];
          const hasUnread = msgs.some((m) => !m.is_read);
          const isSelected = openThread === threadId;
          const label = latest?.sender_name || "Unknown";
          const type = latest?.sender_type === "admin" ? "B2B" : "B2C";

          return (
            <div
              key={threadId}
              onClick={() => setOpenThread(threadId)}
              className={`flex items-start gap-2 px-4 py-3 cursor-pointer transition-colors border-b border-[var(--brd)] last:border-0 ${
                isSelected ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]/50"
              }`}
            >
              {hasUnread && (
                <div className="w-2 h-2 rounded-full bg-[var(--grn)] mt-1.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[var(--tx)]">
                  {label} <span className="text-[9px] font-normal text-[var(--tx3)]">{type}</span>
                </div>
                <div className="text-[10px] text-[var(--tx3)] truncate mt-0.5">{latest?.content}</div>
                <div className="text-[9px] text-[var(--tx3)] mt-0.5">{formatTimeAgo(latest?.created_at || "")}</div>
              </div>
            </div>
          );
        })}
        {threadEntries.length === 0 && (
          <div className="p-6 text-center text-[11px] text-[var(--tx3)]">
            No threads yet. Messages from clients and Slack will appear here.
          </div>
        )}
      </div>

      {/* Conversation view */}
      <div className="flex flex-col min-h-[400px]">
        {selectedMsgs ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {[...selectedMsgs].reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] ${msg.sender_type === "admin" ? "order-2" : ""}`}>
                    <div
                      className={`px-3 py-2 rounded-lg text-[11px] leading-relaxed ${
                        msg.sender_type === "admin"
                          ? "bg-[var(--gdim)] border border-[var(--gold)]/30 text-[var(--tx)]"
                          : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className="text-[9px] text-[var(--tx3)] mt-0.5">
                      {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[var(--brd)] flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply(openThread!)}
                placeholder="Reply..."
                className="flex-1 px-4 py-2.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--bg)] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
              />
              <button
                onClick={() => sendReply(openThread!)}
                className="px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[11px] text-[var(--tx3)] p-8">
            Select a thread to view conversation
          </div>
        )}
      </div>
    </div>
  );
}
