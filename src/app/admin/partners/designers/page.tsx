import { createAdminClient } from "@/lib/supabase/admin";
import DesignerDashboard from "./DesignerDashboard";

const DESIGNER_ORG_TYPES = ["designer", "interior_designer"];

export default async function DesignersPage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    db.from("organizations").select("*").in("type", DESIGNER_ORG_TYPES).order("name"),
    db.from("deliveries").select("*").eq("category", "designer").order("scheduled_date"),
  ]);

  const designerOrgIds = (orgs || []).map((o) => o.id);
  const { data: projects } =
    designerOrgIds.length > 0
      ? await db
          .from("projects")
          .select("*, organizations:partner_id(name, type)")
          .in("partner_id", designerOrgIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <DesignerDashboard
      orgs={orgs || []}
      deliveries={deliveries || []}
      projects={projects || []}
    />
  );
}