export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Audit Log" };

import { createAdminClient } from "@/lib/supabase/admin";
import AuditLogClient from "./AuditLogClient";
import type { ActivityEventRow } from "../components/activity-feed-shared";

export default async function AuditLogPage() {
  const admin = createAdminClient();
  let events: ActivityEventRow[] = [];
  try {
    const { data } = await admin
      .from("status_events")
      .select("id, entity_type, entity_id, event_type, description, icon, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    events = (data ?? []) as ActivityEventRow[];
  } catch {
    events = [];
  }

  return <AuditLogClient events={events} />;
}
