import { createClient } from "@/lib/supabase/server";
import MessagesClient from "./MessagesClient";
import { SAMPLE_MESSAGES } from "./sampleMessages";

export default async function MessagesPage() {
  const supabase = await createClient();
  let all: { id: string; thread_id: string; sender_name: string; sender_type: string; content: string; is_read: boolean; created_at: string }[] = [];

  try {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    all = messages || [];

    // Seed sample messages when table is empty (dev/demo)
    if (all.length === 0) {
      const toInsert = SAMPLE_MESSAGES.map(({ thread_id, sender_name, sender_type, content, is_read, created_at }) => ({
        thread_id,
        sender_name,
        sender_type,
        content,
        is_read,
        created_at,
      }));
      const { error } = await supabase.from("messages").insert(toInsert);
      if (!error) {
        const { data: seeded } = await supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: true });
        all = seeded || [];
      }
    }
  } catch {
    // Table may not exist yet; pass empty threads
  }

  // Group messages by thread_id
  let threads: Record<string, typeof all> = {};
  all.forEach((msg) => {
    if (!threads[msg.thread_id]) threads[msg.thread_id] = [];
    threads[msg.thread_id].push(msg);
  });

  // Fallback: use sample data when DB is empty (e.g. table doesn't exist)
  if (Object.keys(threads).length === 0) {
    threads = SAMPLE_MESSAGES.reduce((acc, m, i) => {
      const row = { ...m, id: `sample-${i}` };
      if (!acc[m.thread_id]) acc[m.thread_id] = [];
      acc[m.thread_id].push(row as typeof all[0]);
      return acc;
    }, {} as Record<string, typeof all>);
    all = Object.values(threads).flat();
  }

  const unreadCount = all.filter((m) => !m.is_read).length;
  const slackConnected = !!process.env.SLACK_BOT_TOKEN;

  return (
    <MessagesClient
      initialThreads={threads}
      initialUnreadCount={unreadCount}
      slackConnected={slackConnected}
    />
  );
}
