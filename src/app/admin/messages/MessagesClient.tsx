"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/AppIcons";
import BackButton from "../components/BackButton";
import { useToast } from "../components/Toast";

interface Message {
  id: string;
  thread_id: string;
  sender_name: string;
  sender_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function formatTime(date: string) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isYesterday) return `Yesterday ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTimeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getThreadPreview(msgs: Message[]): string {
  const first = msgs[0];
  if (!first) return "New thread";
  const preview = first.content.slice(0, 50);
  return preview.length < first.content.length ? `${preview}…` : preview;
}

export default function MessagesClient({
  initialThreads,
  initialUnreadCount,
  slackConnected,
}: {
  initialThreads: Record<string, Message[]>;
  initialUnreadCount: number;
  slackConnected: boolean;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [openThread, setOpenThread] = useState<string | null>(Object.keys(initialThreads)[0] || null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [slackConnectedLocal, setSlackConnectedLocal] = useState(slackConnected);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const openThreadRef = useRef(openThread);
  openThreadRef.current = openThread;
  const supabase = createClient();
  const { toast } = useToast();

  const isConnected = slackConnectedLocal;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openThread, threads]);

  // Mark thread as read when viewing
  useEffect(() => {
    if (!openThread) return;
    const msgs = threads[openThread] || [];
    const unread = msgs.filter((m) => !m.is_read && m.sender_type !== "admin");
    if (unread.length === 0) return;

    const ids = unread.map((m) => m.id);
    const threadId = openThread;
    supabase
      .from("messages")
      .update({ is_read: true })
      .in("id", ids)
      .then(() => {
        if (openThreadRef.current !== threadId) return;
        setThreads((prev) => {
          const next = { ...prev };
          const thread = next[threadId] || [];
          next[threadId] = thread.map((m) => (ids.includes(m.id) ? { ...m, is_read: true } : m));
          return next;
        });
        setUnreadCount((c) => Math.max(0, c - unread.length));
      });
  }, [openThread, threads, supabase]);

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (payload.new) {
            const msg = payload.new as Message;
            setThreads((prev) => {
              const thread = prev[msg.thread_id] || [];
              if (thread.some((m) => m.id === msg.id)) return prev;
              return {
                ...prev,
                [msg.thread_id]: [...thread, msg].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                ),
              };
            });
            if (!msg.is_read) setUnreadCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const sendReply = useCallback(
    async (threadId: string) => {
      const text = replyText.trim();
      if (!text) return;
      setSending(true);
      try {
        const { error } = await supabase.from("messages").insert({
          thread_id: threadId,
          sender_name: "J. Oche",
          sender_type: "admin",
          content: text,
          is_read: true,
        });
        if (error) throw error;
        setReplyText("");
        toast("Message sent", "check");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to send", "x");
      } finally {
        setSending(false);
      }
    },
    [replyText, supabase, toast]
  );

  const threadEntries = Object.entries(threads).sort(([, a], [, b]) => {
    const aLatest = a[a.length - 1]?.created_at || "";
    const bLatest = b[b.length - 1]?.created_at || "";
    return new Date(bLatest).getTime() - new Date(aLatest).getTime();
  });
  const selectedMsgs = openThread ? threads[openThread] : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, threadId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply(threadId);
    }
  };

  return (
    <div className="h-[calc(100dvh-5.5rem)] min-h-[400px] flex flex-col max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* Connect banner - when Slack not connected */}
      {!isConnected && (
        <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-[var(--gdim)] to-[var(--gdim)]/50 border border-[var(--gold)]/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center">
              <Icon name="messageSquare" className="w-5 h-5 text-[var(--gold)]" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[var(--tx)]">Connect Slack for real-time sync</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                Sync #ops-inbox, reply from admin or Slack. API integration coming soon.
              </div>
            </div>
          </div>
          <button
            onClick={() => setSlackConnectedLocal(true)}
            className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all shrink-0"
          >
            Connect
          </button>
        </div>
      )}

      {/* Slack connected badge with Disconnect */}
      {isConnected && (
        <div className="mb-4 flex items-center justify-between gap-4 px-4 py-2.5 bg-[var(--grdim)]/30 border border-[var(--grn)]/20 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--grn)] animate-pulse" />
            <span className="text-[11px] font-semibold text-[var(--grn)]">Slack connected — #ops-inbox</span>
          </div>
          <button
            onClick={() => setSlackConnectedLocal(false)}
            className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--red)] hover:text-[var(--red)] transition-all shrink-0"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Channel layout - Slack style, mobile: thread list or messages */}
      <div className="flex-1 min-h-[360px] sm:min-h-[420px] flex border border-[var(--brd)] rounded-xl overflow-hidden bg-[var(--card)]">
        {/* Channel list - hidden on mobile when thread open */}
        <div className={`w-full sm:w-[280px] md:w-[320px] border-r border-[var(--brd)] flex flex-col shrink-0 ${openThread ? "hidden sm:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b border-[var(--brd)]">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Channels</div>
            <div className="text-[13px] font-semibold text-[var(--tx)] mt-0.5"># ops-inbox</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2">Threads</div>
            {threadEntries.map(([threadId, msgs]) => {
              const latest = msgs[msgs.length - 1];
              const hasUnread = msgs.some((m) => !m.is_read && m.sender_type !== "admin");
              const isSelected = openThread === threadId;
              const label = latest?.sender_name || "Unknown";
              const type = latest?.sender_type === "admin" ? "B2B" : "B2C";

              return (
                <div
                  key={threadId}
                  onClick={() => setOpenThread(threadId)}
                  className={`flex items-start gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-[var(--bg)] border-l-2 border-l-[var(--gold)]" : "hover:bg-[var(--bg)]/50"
                  }`}
                >
                  {hasUnread && <div className="w-1.5 h-1.5 rounded-full bg-[var(--grn)] mt-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--tx)] truncate">
                      {label} <span className="text-[9px] font-normal text-[var(--tx3)]">{type}</span>
                    </div>
                    <div className="text-[11px] text-[var(--tx3)] truncate mt-0.5">{getThreadPreview(msgs)}</div>
                    <div className="text-[9px] text-[var(--tx3)] mt-0.5">{formatTimeAgo(latest?.created_at || "")}</div>
                  </div>
                </div>
              );
            })}
            {threadEntries.length === 0 && (
              <div className="p-6 text-center text-[11px] text-[var(--tx3)]">
                No threads yet. Messages will appear here in real time.
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-[var(--brd)] flex items-center justify-between">
            <div>
              <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Threads</div>
              <div className="text-[14px] font-bold font-heading">{threadEntries.length}</div>
            </div>
            <div>
              <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)]">Unread</div>
              <div className="text-[14px] font-bold font-heading text-[var(--gold)]">{unreadCount}</div>
            </div>
          </div>
        </div>

        {/* Message area - Slack channel style */}
        <div className={`flex-1 flex flex-col min-w-0 ${!openThread ? "hidden sm:flex" : "flex"}`}>
          {selectedMsgs ? (
            <>
              <div className="px-4 py-3 border-b border-[var(--brd)] shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenThread(null)}
                  className="sm:hidden p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx2)]"
                  aria-label="Back to threads"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tx)]">Conversation</div>
                </div>
                {openThread && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(openThread) && (
                  <a
                    href={`/admin/moves/${openThread}`}
                    className="text-[11px] font-semibold text-[var(--gold)] hover:underline shrink-0"
                  >
                    View move →
                  </a>
                )}
              </div>

              <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedMsgs.map((msg) => {
                  const isAdmin = msg.sender_type === "admin";
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] py-2 px-3.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                          isAdmin
                            ? "bg-[rgba(201,169,98,0.14)] text-[var(--tx)] rounded-br-md"
                            : "bg-[var(--card)]/80 text-[var(--tx2)] border border-[var(--brd)]/60 rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Slack-style reply box */}
              <div className="p-4 border-t border-[var(--brd)] shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      const el = e.target;
                      el.style.height = "40px";
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => handleKeyDown(e, openThread!)}
                    placeholder="Type a message… (Shift+Enter for new line)"
                    rows={1}
                    className="flex-1 px-4 py-2.5 border border-[var(--brd)] rounded-lg text-[13px] bg-[var(--bg)] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)] resize-none overflow-y-auto"
                    style={{ minHeight: 40, maxHeight: 120 }}
                  />
                  <button
                    onClick={() => sendReply(openThread!)}
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-[40px]"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
                <div className="text-[9px] text-[var(--tx3)] mt-1.5">Press Enter to send, Shift+Enter for new line</div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-[var(--tx3)] p-8">
              <div className="text-center">
                <Icon name="messageSquare" className="w-12 h-12 mx-auto mb-3 text-[var(--tx3)]/50" />
                <p>Select a thread to view conversation</p>
                <p className="text-[10px] mt-1">Messages update in real time</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
