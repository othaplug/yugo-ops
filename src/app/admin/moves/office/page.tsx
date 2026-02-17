import { createClient } from "@/lib/supabase/server";
import OfficeMovesClient from "./OfficeMovesClient";

export default async function OfficeMovesPage() {
  const supabase = await createClient();
  const { data: moves } = await supabase
    .from("moves")
    .select("*")
    .eq("move_type", "office")
    .order("created_at", { ascending: false });

  return <OfficeMovesClient moves={moves || []} />;
}