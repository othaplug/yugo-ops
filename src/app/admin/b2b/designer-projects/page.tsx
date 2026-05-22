export const metadata = { title: "Designer Projects" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import DesignerProjectsListClient from "./DesignerProjectsListClient";

export default async function DesignerProjectsPage() {
  const db = createAdminClient();

  const [{ data: projects }, { data: partners }] = await Promise.all([
    db
      .from("projects")
      .select(
        `
        id, project_number, project_name, end_client_name, site_address,
        install_unit, designer_phase, status, target_end_date, estimated_budget,
        coordinator_name, delivery_job_id, partner_id, created_at,
        organizations:partner_id(id, name, type),
        project_vendors(id, vendor_name, readiness, sort_order),
        project_inventory(id, item_name, item_status, status, vendor_id)
      `,
      )
      .not("designer_phase", "is", null)
      .order("created_at", { ascending: false }),
    db
      .from("organizations")
      .select("id, name, type")
      .in("type", ["designer", "interior_designer"])
      .order("name"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <DesignerProjectsListClient
      projects={(projects ?? []) as any[]}
      partners={partners ?? []}
    />
  );
}
