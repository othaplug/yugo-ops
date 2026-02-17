import { createClient } from "@/lib/supabase/server";
import CreateMoveForm from "./CreateMoveForm";

export default async function NewMovePage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: crews }] = await Promise.all([
    supabase.from("organizations").select("id, name, type, email, contact_name, phone, address").eq("type", "b2c").order("name"),
    supabase.from("crews").select("id, name, members").order("name"),
  ]);

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <CreateMoveForm organizations={orgs || []} crews={crews || []} />
    </div>
  );
}
