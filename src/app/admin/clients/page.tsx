export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ClientsV3Client from "./ClientsV3Client";

export default async function ClientsPage() {
  const db = createAdminClient();
  const { data: rawClients } = await db
    .from("organizations")
    .select("*")
    .eq("type", "b2c")
    .order("created_at", { ascending: false });

  const clients = (rawClients ?? []).filter((c) => !(c.name || "").startsWith("_"));
  const b2cIds = clients.map((c) => c.id);
  const { data: moves } = b2cIds.length > 0
    ? await db
        .from("moves")
        .select("id, organization_id, move_type, scheduled_date, status, estimate")
        .in("organization_id", b2cIds)
        .order("created_at", { ascending: false })
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

  return <ClientsV3Client clients={clients} moveClientData={latestByOrg} />;
}
