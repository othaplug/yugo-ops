export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import NewProjectForm from "./NewProjectForm";

export default async function NewProjectPage() {
  const db = createAdminClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: partners } = await db
    .from("organizations")
    .select("id, name, type, email, contact_name")
    .not("type", "eq", "b2c")
    .order("name");

  return (
    <div className="animate-fade-up">
      <NewProjectForm
        partners={partners || []}
        currentUserId={user?.id || null}
      />
    </div>
  );
}
