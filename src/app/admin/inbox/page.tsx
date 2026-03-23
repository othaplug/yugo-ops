export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import InboxClient from "./InboxClient";

export default async function InboxPage() {
  const db = createAdminClient();

  let messages: Array<{
    id: string;
    thread_id: string;
    sender_name: string;
    sender_type: string;
    content: string;
    is_read: boolean;
    created_at: string;
  }> = [];

  try {
    const { data } = await db
      .from("messages")
      .select("id, thread_id, sender_name, sender_type, content, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    messages = data ?? [];
  } catch {
    // Table may not exist — gracefully fall back to empty
  }

  const threadIds = [...new Set(messages.map((m) => m.thread_id))];

  let moveMap: Record<string, { id: string; move_code: string; client_name: string }> = {};
  if (threadIds.length > 0) {
    const { data: moves } = await db
      .from("moves")
      .select("id, move_code, client_name")
      .in("id", threadIds);

    if (moves) {
      moveMap = Object.fromEntries(moves.map((m) => [m.id, m]));
    }
  }

  const enriched = messages.map((m) => ({
    ...m,
    move_id: m.thread_id,
    move_code: moveMap[m.thread_id]?.move_code ?? null,
    client_name: moveMap[m.thread_id]?.client_name ?? null,
  }));

  return <InboxClient messages={enriched} />;
}
