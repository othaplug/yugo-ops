export const metadata = { title: "New Project" };
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import NewProjectForm from "./NewProjectForm";

const DESIGNER_ORG_TYPES = ["designer", "interior_designer"];

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ partnerType?: string }>;
}) {
  const db = createAdminClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  const partnerFilter = params.partnerType;

  let query = db
    .from("organizations")
    .select("id, name, type, email, contact_name")
    .not("type", "eq", "b2c");

  if (partnerFilter === "designer") {
    query = query.in("type", DESIGNER_ORG_TYPES);
  }

  const { data: partners } = await query.order("name");

  return (
    <div className="animate-fade-up">
      <NewProjectForm
        partners={partners || []}
        currentUserId={user?.id || null}
        partnerFilter={partnerFilter}
      />
    </div>
  );
}
