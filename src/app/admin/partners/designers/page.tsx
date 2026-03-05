import { createAdminClient } from "@/lib/supabase/admin";
import DesignerDashboard from "./DesignerDashboard";

export default async function DesignersPage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    db.from("organizations").select("*").eq("type", "designer").order("name"),
    db.from("deliveries").select("*").eq("category", "designer").order("scheduled_date"),
  ]);

  return <DesignerDashboard orgs={orgs || []} deliveries={deliveries || []} />;
}