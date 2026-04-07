export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ActivityPageClient from "./ActivityPageClient";
import type { ActivityEventRow } from "../components/activity-feed-shared";

export default async function AdminActivityPage() {
  const admin = createAdminClient();
  let rows: ActivityEventRow[] = [];
  try {
    const { data } = await admin
      .from("status_events")
      .select(
        "id, entity_type, entity_id, event_type, description, icon, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(120);
    rows = (data ?? []) as ActivityEventRow[];
  } catch {
    rows = [];
  }

  return <ActivityPageClient initialEvents={rows} />;
}
