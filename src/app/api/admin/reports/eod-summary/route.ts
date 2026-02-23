import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** GET: Today's EOD summary for Command Center (teams submitted, pending). */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const today = new Date().toISOString().split("T")[0];
  const admin = createAdminClient();

  const [{ data: reports }, { data: crews }] = await Promise.all([
    admin.from("end_of_day_reports").select("team_id, summary, generated_at").eq("report_date", today),
    admin.from("crews").select("id, name").order("name"),
  ]);

  const submittedTeamIds = new Set((reports || []).map((r) => r.team_id));
  const pending = (crews || []).filter((c) => !submittedTeamIds.has(c.id));
  const submitted = (reports || []).map((r) => {
    const crew = (crews || []).find((c) => c.id === r.team_id);
    return { teamId: r.team_id, teamName: crew?.name || "Team", summary: r.summary, generatedAt: r.generated_at };
  });

  return NextResponse.json({
    date: today,
    submitted,
    pending: pending.map((c) => ({ teamId: c.id, teamName: c.name })),
    totalTeams: (crews || []).length,
    submittedCount: submitted.length,
  });
}
