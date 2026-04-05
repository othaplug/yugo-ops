import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { labelForIssueCode } from "@/lib/crew/move-day-issues";

/** GET incidents for a job. Staff only. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!platformUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jobId = req.nextUrl.searchParams.get("jobId");
  const jobType = req.nextUrl.searchParams.get("jobType");
  if (!jobId || !jobType) return NextResponse.json({ error: "jobId, jobType required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: incidents, error } = await admin
    .from("incidents")
    .select(
      "id, issue_type, description, created_at, crew_member_id, urgency, status, photo_urls, resolution_notes",
    )
    .eq("job_id", jobId)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withLabels = (incidents || []).map((i) => ({
    ...i,
    issueLabel: labelForIssueCode(i.issue_type),
  }));

  return NextResponse.json(withLabels);
}
