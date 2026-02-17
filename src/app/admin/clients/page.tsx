import { createClient } from "@/lib/supabase/server";
import ClientsPageClient from "./ClientsPageClient";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("organizations")
    .select("*")
    .order("name");

  const b2cIds = (clients ?? []).filter((c) => c.type === "b2c").map((c) => c.id);
  const { data: moves } = b2cIds.length > 0
    ? await supabase
        .from("moves")
        .select("id, organization_id, move_type, scheduled_date, status, estimate")
        .in("organization_id", b2cIds)
        .order("scheduled_date", { ascending: false })
    : { data: [] };

  const latestByOrg = new Map<string, { move_type: string; scheduled_date: string | null; status: string; estimate: number }>();
  for (const m of moves ?? []) {
    if (m.organization_id && !latestByOrg.has(m.organization_id)) {
      latestByOrg.set(m.organization_id, {
        move_type: m.move_type || "residential",
        scheduled_date: m.scheduled_date,
        status: m.status || "",
        estimate: Number(m.estimate || 0),
      });
    }
  }

  const moveClientData = latestByOrg;

  return <ClientsPageClient clients={clients || []} moveClientData={moveClientData} />;
}