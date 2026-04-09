import { createAdminClient } from "@/lib/supabase/admin";
import CreateMoveForm from "./CreateMoveForm";

export const metadata = { title: "New Move" };

export default async function NewMovePage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: crews }, { data: itemWeights }] = await Promise.all([
    db.from("organizations").select("id, name, type, email, contact_name, phone, address").eq("type", "b2c").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
    db.from("item_weights").select("slug, item_name, weight_score, category, room, is_common, display_order, active").eq("active", true).order("display_order"),
  ]);

  return (
    <div className="w-full max-w-none mx-0 px-4 sm:px-5 md:px-8 lg:px-10 py-4 md:py-6">
      <CreateMoveForm organizations={orgs || []} crews={crews || []} itemWeights={itemWeights || []} />
    </div>
  );
}
