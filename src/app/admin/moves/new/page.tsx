import { createAdminClient } from "@/lib/supabase/admin";
import CreateMoveForm from "./CreateMoveForm";

export default async function NewMovePage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: crews }, { data: itemWeights }] = await Promise.all([
    db.from("organizations").select("id, name, type, email, contact_name, phone, address").eq("type", "b2c").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
    db.from("item_weights").select("slug, item_name, weight_score, category, room, is_common, display_order, active").eq("active", true).order("display_order"),
  ]);

  return (
    <div className="max-w-[720px] mx-auto px-4 md:px-5 py-4 md:py-5">
      <CreateMoveForm organizations={orgs || []} crews={crews || []} itemWeights={itemWeights || []} />
    </div>
  );
}
