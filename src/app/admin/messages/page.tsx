import { createClient } from "@/lib/supabase/server";
import MessageThreads from "./MessageThreads";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  const all = messages || [];

  // Group messages by thread_id
  const threads: Record<string, typeof all> = {};
  all.forEach((msg) => {
    if (!threads[msg.thread_id]) threads[msg.thread_id] = [];
    threads[msg.thread_id].push(msg);
  });

  const unreadCount = all.filter((m) => !m.is_read).length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4 max-w-[200px]">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Threads</div>
            <div className="text-xl font-bold font-heading">{Object.keys(threads).length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Unread</div>
            <div className="text-xl font-bold font-heading text-[var(--gold)]">{unreadCount}</div>
          </div>
        </div>

        {/* Slack integration note */}
        <div className="mb-4 px-4 py-2.5 bg-[var(--gdim)]/50 border border-[var(--gold)]/20 rounded-lg">
          <div className="text-[10px] font-semibold text-[var(--gold)]">Slack connected</div>
          <div className="text-[9px] text-[var(--tx3)] mt-0.5">Messages sync with #ops-inbox. Reply from admin or Slack.</div>
        </div>

        <MessageThreads threads={threads} />
    </div>
  );
}