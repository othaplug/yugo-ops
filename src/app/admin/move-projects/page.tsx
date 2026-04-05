import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoveDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  quoted: "Quoted",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function AdminMoveProjectsPage() {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("move_projects")
    .select("id, project_name, status, start_date, end_date, total_days, total_price, updated_at")
    .order("start_date", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-8">
        <p className="text-sm text-red-600">Failed to load projects: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-6 py-6">
      <div className="mb-6">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)] mb-1">Moves</p>
        <h1 className="admin-page-hero text-[var(--tx)]">Move projects</h1>
        <p className="text-[11px] text-[var(--tx3)] mt-1">
          Multi-day residential and office schedules linked to quotes.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
        <ul className="divide-y divide-[var(--brd)]">
          {(rows ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">No move projects yet.</li>
          ) : (
            (rows ?? []).map((r) => (
              <li key={r.id as string}>
                <Link
                  href={`/admin/move-projects/${r.id as string}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-[var(--gdim)] transition-colors"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--tx)]">{String(r.project_name)}</p>
                    <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                      {r.start_date ? formatMoveDate(String(r.start_date)) : "—"}
                      {r.end_date ? ` — ${formatMoveDate(String(r.end_date))}` : ""}
                      {typeof r.total_days === "number" ? ` · ${r.total_days} days` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.total_price != null && Number(r.total_price) > 0 && (
                      <span className="text-[12px] font-medium text-[var(--tx)] tabular-nums">
                        ${Number(r.total_price).toLocaleString()}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-[var(--brd)] text-[var(--tx2)]">
                      {STATUS_LABEL[String(r.status)] ?? String(r.status)}
                    </span>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
