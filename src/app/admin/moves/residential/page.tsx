import { createClient } from "@/lib/supabase/server";
import ResidentialMovesClient from "./ResidentialMovesClient";

export default async function ResidentialMovesPage() {
  const supabase = await createClient();
  const { data: moves } = await supabase
    .from("moves")
    .select("*")
    .eq("move_type", "residential")
    .order("created_at", { ascending: false });

  return <ResidentialMovesClient moves={moves || []} />;
}