export const metadata = { title: "Deliveries" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import AllDeliveriesView from "./AllProjectsView";

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; schedule?: string }>;
}) {
  const db = createAdminClient();
  const today = getTodayString();
  const params = await searchParams;
  const { data: deliveries } = await db
    .from("deliveries")
    .select("*")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <AllDeliveriesView
        deliveries={deliveries || []}
        today={today}
        initialView={params.view === "recurring" ? "recurring" : undefined}
        initialScheduleId={params.schedule || undefined}
      />
    </div>
  );
}