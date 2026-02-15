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
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4 max-w-xs">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Threads</div>
            <div className="text-xl font-bold font-serif">{Object.keys(threads).length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Unread</div>
            <div className="text-xl font-bold font-serif text-[var(--gold)]">{unreadCount}</div>
          </div>
        </div>

        <MessageThreads threads={threads} />
    </div>
  );
}