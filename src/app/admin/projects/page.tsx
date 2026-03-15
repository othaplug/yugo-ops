export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ProjectsListClient from "./ProjectsListClient";

export default async function ProjectsPage() {
  const db = createAdminClient();

  const [{ data: projects }, { data: partners }] = await Promise.all([
    db
      .from("projects")
      .select("*, organizations:partner_id(name, type)")
      .order("created_at", { ascending: false }),
    db
      .from("organizations")
      .select("id, name, type")
      .not("type", "eq", "b2c")
      .order("name"),
  ]);

  return (
    <div className="animate-fade-up">
      <ProjectsListClient
        projects={projects || []}
        partners={partners || []}
      />
    </div>
  );
}
