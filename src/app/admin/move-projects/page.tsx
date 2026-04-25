import { createAdminClient } from "@/lib/supabase/admin";
import MoveProjectsV3Client, { type MoveProjectRow } from "./MoveProjectsV3Client";

export const dynamic = "force-dynamic";

export default async function AdminMoveProjectsPage() {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("move_projects")
    .select("id, project_name, status, start_date, end_date, total_days, total_price, updated_at")
    .order("start_date", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="w-full min-w-0 py-8">
        <p className="text-sm text-red-600">
          Failed to load projects: {error.message}
        </p>
      </div>
    );
  }

  const list: MoveProjectRow[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    project_name: String(r.project_name),
    status: String(r.status ?? ""),
    start_date: r.start_date ? String(r.start_date) : null,
    end_date: r.end_date ? String(r.end_date) : null,
    total_days: typeof r.total_days === "number" ? r.total_days : r.total_days ? Number(r.total_days) : null,
    total_price: r.total_price != null ? Number(r.total_price) : null,
    updated_at: r.updated_at ? String(r.updated_at) : null,
  }));

  return <MoveProjectsV3Client rows={list} />;
}
