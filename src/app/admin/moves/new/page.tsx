import { createAdminClient } from "@/lib/supabase/admin";
import CreateMoveForm from "./CreateMoveForm";

export default async function NewMovePage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: crews }] = await Promise.all([
    db.from("organizations").select("id, name, type, email, contact_name, phone, address").eq("type", "b2c").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <CreateMoveForm organizations={orgs || []} crews={crews || []} />
    </div>
  );
}
