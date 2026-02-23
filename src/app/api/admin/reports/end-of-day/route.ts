import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** GET: List end-of-day reports (admin). */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));

  const admin = createAdminClient();

  const { data: reports, error } = await admin
    .from("end_of_day_reports")
    .select(`
      id,
      team_id,
      report_date,
      summary,
      jobs,
      crew_note,
      generated_at,
      crews(name)
    `)
    .eq("report_date", date)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reports: reports || [], date });
}
