import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMoveProjectWithTree } from "@/lib/move-projects/fetch";
import { formatMoveDate } from "@/lib/date-format";
import MoveProjectDetailClient from "./MoveProjectDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminMoveProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { project, phases = [], error } = await fetchMoveProjectWithTree(db, id);
  if (error || !project) notFound();

  const { data: comms } = await db
    .from("move_project_communications")
    .select("id, comm_type, subject, sent_at, recipient_kind")
    .eq("project_id", id)
    .order("sent_at", { ascending: false })
    .limit(30);

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-6 py-6 space-y-6">
      <div>
        <Link href="/admin/move-projects" className="text-[11px] font-medium text-[var(--yu-accent)] hover:underline">
          Move projects
        </Link>
        <h1 className="admin-page-hero text-[var(--tx)] mt-2">{String(project.project_name)}</h1>
        <p className="text-[11px] text-[var(--tx3)] mt-1">
          {project.start_date ? formatMoveDate(String(project.start_date)) : ""}
          {project.end_date ? ` — ${formatMoveDate(String(project.end_date))}` : ""}
          {typeof project.total_days === "number" ? ` · ${project.total_days} days` : ""}
        </p>
      </div>

      <MoveProjectDetailClient
        projectId={id}
        initialPhases={phases}
        initialComms={comms ?? []}
      />
    </div>
  );
}
