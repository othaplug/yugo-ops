import { createClient } from "@/lib/supabase/server";
import NewDeliveryForm from "./NewDeliveryForm";

export default async function NewDeliveryPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, type")
    .order("name");

  return (
    <div className="max-w-[600px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      <h1 className="font-heading text-[22px] md:text-[24px] font-bold text-[var(--tx)] mb-4">
        Create Project
      </h1>
      <NewDeliveryForm organizations={orgs || []} />
    </div>
  );
}