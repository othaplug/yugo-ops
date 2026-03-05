import { createAdminClient } from "@/lib/supabase/admin";
import OfficeMovesClient from "./OfficeMovesClient";

export default async function OfficeMovesPage() {
  const db = createAdminClient();
  const { data: moves } = await db
    .from("moves")
    .select("*")
    .eq("move_type", "office")
    .order("created_at", { ascending: false });

  return <OfficeMovesClient moves={moves || []} />;
}