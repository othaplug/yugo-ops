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

export default function MessageThreads({
  threads,
}: {
  threads: Record<string, Message[]>;
}) {
  const [openThread, setOpenThread] = useState<string | null>(null);
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

  return (
    <div className="space-y-1.5">
      {Object.entries(threads).map(([threadId, msgs]) => {
        const latest = msgs[0];
        const hasUnread = msgs.some((m) => !m.is_read);
        const isOpen = openThread === threadId;

        return (
          <div
            key={threadId}
            className="border border-[var(--brd)] rounded-lg overflow-hidden"
          >
            {/* Thread Header */}
            <div
              onClick={() => setOpenThread(isOpen ? null : threadId)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg)] transition-colors"
            >
              {hasUnread && (
                <div className="w-[5px] h-[5px] rounded-full bg-[var(--gold)]" />
              )}
              <div className="text-[10px] font-semibold flex-1">
                {latest.sender_name}
                <span className="text-[8px] text-[var(--tx3)] ml-1">
                  {latest.sender_type}
                </span>
              </div>
              <div className="text-[9px] text-[var(--tx2)] flex-[2] truncate">
                {latest.content}
              </div>
              <div className="text-[8px] text-[var(--tx3)]">
                {new Date(latest.created_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>

            {/* Thread Body */}
            {isOpen && (
              <div className="px-3 py-3 border-t border-[var(--brd)] bg-[var(--bg)]">
                {[...msgs].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-1.5 max-w-[80%] ${
                      msg.sender_type === "admin" ? "ml-auto" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed ${
                        msg.sender_type === "admin"
                          ? "bg-[var(--gdim)] border border-[rgba(201,169,98,.12)]"
                          : "bg-[var(--card)] border border-[var(--brd)]"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className="text-[8px] text-[var(--tx3)] mt-0.5">
                      {new Date(msg.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}

                {/* Reply */}
                <div className="flex gap-1 mt-2 pt-2 border-t border-[var(--brd)]">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendReply(threadId)}
                    placeholder="Reply..."
                    className="flex-1 px-2.5 py-1.5 border border-[var(--brd)] rounded-lg text-[10px] bg-[var(--card)] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
                  />
                  <button
                    onClick={() => sendReply(threadId)}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {Object.keys(threads).length === 0 && (
        <div className="text-center py-8 text-[var(--tx3)] text-[11px]">
          No messages yet. Messages will appear here when partners or clients reach out.
        </div>
      )}
    </div>
  );
}