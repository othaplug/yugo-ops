export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ProjectDetailClient from "./ProjectDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const db = createAdminClient();
  const { data: project } = await db.from("projects").select("name").eq("id", projectId).single();
  const name = project?.name ? `Project ${project.name}` : "Project";
  return { title: name };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <div className="animate-fade-up">
      <ProjectDetailClient projectId={projectId} />
    </div>
  );
}
