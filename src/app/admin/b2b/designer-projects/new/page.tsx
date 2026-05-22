export const metadata = { title: "New Designer Project" };
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import NewDesignerProjectForm from "./NewDesignerProjectForm";

export default async function NewDesignerProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ partner?: string }>;
}) {
  const { partner: partnerPreselect } = await searchParams;
  const db = createAdminClient();

  const { data: partners } = await db
    .from("organizations")
    .select("id, name, type")
    .in("type", ["designer", "interior_designer"])
    .order("name");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <NewDesignerProjectForm
        partners={partners ?? []}
        preselectedPartnerId={partnerPreselect || null}
      />
    </div>
  );
}
