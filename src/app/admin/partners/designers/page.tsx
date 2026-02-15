import { createClient } from "@/lib/supabase/server";
import DesignerDashboard from "./DesignerDashboard";

export default async function DesignersPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    supabase.from("organizations").select("*").eq("type", "designer").order("name"),
    supabase.from("deliveries").select("*").eq("category", "designer").order("scheduled_date"),
  ]);

  return <DesignerDashboard orgs={orgs || []} deliveries={deliveries || []} />;
}