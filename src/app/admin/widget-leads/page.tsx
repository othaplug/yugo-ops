export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import WidgetLeadsClient from "./WidgetLeadsClient";

export default async function WidgetLeadsPage() {
  const db = createAdminClient();

  const { data: leads } = await db
    .from("quote_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return <WidgetLeadsClient leads={leads || []} />;
}
