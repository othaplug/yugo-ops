import { createClient } from "@/lib/supabase/server";
import ClientsPageClient from "./ClientsPageClient";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("organizations")
    .select("*")
    .order("name");

  return <ClientsPageClient clients={clients || []} />;
}