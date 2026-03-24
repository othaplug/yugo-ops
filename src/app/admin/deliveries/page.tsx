export const metadata = { title: "Jobs" };
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

  const [
    { data: deliveries },
    { data: projects },
    { data: partners },
  ] = await Promise.all([
    db.from("deliveries").select("*").order("created_at", { ascending: false }),
    db.from("projects").select("*, organizations:partner_id(name, type)").order("created_at", { ascending: false }),
    db.from("organizations").select("id, name, type").not("type", "eq", "b2c").order("name"),
  ]);

  const initialView = params.view === "recurring" ? "recurring" : params.view === "projects" ? "projects" : undefined;

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up w-full">
      <AllDeliveriesView
        deliveries={deliveries || []}
        projects={projects || []}
        partners={partners || []}
        today={today}
        initialView={initialView}
        initialScheduleId={params.schedule || undefined}
      />
    </div>
  );
}