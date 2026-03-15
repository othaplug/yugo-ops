import { createAdminClient } from "@/lib/supabase/admin";
import ResidentialMovesClient from "./ResidentialMovesClient";

export const metadata = { title: "Residential Moves" };

export default async function ResidentialMovesPage() {
  const db = createAdminClient();
  const { data: moves } = await db
    .from("moves")
    .select("*")
    .eq("move_type", "residential")
    .order("created_at", { ascending: false });

  return <ResidentialMovesClient moves={moves || []} />;
}