import { createClient } from "@/lib/supabase/server";
import NewDeliveryForm from "./NewDeliveryForm";

export default async function NewDeliveryPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, type")
    .order("name");

  return (
    <div className="max-w-[600px] mx-auto px-5 md:px-6 py-5">
      <NewDeliveryForm organizations={orgs || []} />
    </div>
  );
}