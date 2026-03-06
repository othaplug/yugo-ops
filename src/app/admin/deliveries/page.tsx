export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import AllDeliveriesView from "./AllProjectsView";

export default async function DeliveriesPage() {
  const db = createAdminClient();
  const today = getTodayString();
  const { data: deliveries } = await db
    .from("deliveries")
    .select("*")
    .order("scheduled_date", { ascending: true });

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <AllDeliveriesView deliveries={deliveries || []} today={today} />
    </div>
  );
}