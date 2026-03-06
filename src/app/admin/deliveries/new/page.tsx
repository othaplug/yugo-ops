import { createAdminClient } from "@/lib/supabase/admin";
import NewDeliveryForm from "./NewDeliveryForm";

export default async function NewDeliveryPage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: crews }] = await Promise.all([
    db.from("organizations").select("id, name, type, email, contact_name, phone").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  return (
    <div className="max-w-[640px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      <h1 className="font-heading text-[22px] md:text-[24px] font-bold text-[var(--tx)] mb-4">
        Create Delivery
      </h1>
      <NewDeliveryForm organizations={orgs || []} crews={crews || []} />
    </div>
  );
}
