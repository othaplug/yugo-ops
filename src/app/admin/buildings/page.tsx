import { createAdminClient } from "@/lib/supabase/admin";
import BuildingsAdminClient from "./BuildingsAdminClient";

export const metadata = { title: "Buildings" };
export const dynamic = "force-dynamic";

export default async function AdminBuildingsPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("building_profiles")
    .select(
      "id, address, building_name, complexity_rating, verified, times_moved_here, last_move_date, updated_at, elevator_system",
    )
    .order("complexity_rating", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(400);

  return <BuildingsAdminClient initial={data ?? []} />;
}
