import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const VALID_REASONS = ["client_refused", "small_move", "not_applicable"];

// POST /api/crew/walkthrough/[jobId]/skip
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* body optional */ }

  const skipReason = String(body.skip_reason || "not_applicable");
  if (!VALID_REASONS.includes(skipReason)) {
    return NextResponse.json({ error: "Invalid skip reason" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  let moveId = jobId;
  if (!isUuid) {
    const { data } = await admin
      .from("moves")
      .select("id, crew_id")
      .ilike("move_code", jobId.replace(/^#/, "").toUpperCase())
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    if (data.crew_id !== payload.teamId) return NextResponse.json({ error: "Not assigned to your team" }, { status: 403 });
    moveId = data.id;
  } else {
    const { data } = await admin.from("moves").select("id, crew_id").eq("id", jobId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    if (data.crew_id !== payload.teamId) return NextResponse.json({ error: "Not assigned to your team" }, { status: 403 });
  }

  await admin
    .from("moves")
    .update({
      walkthrough_completed: true,
      walkthrough_completed_at: new Date().toISOString(),
      walkthrough_skipped: true,
      walkthrough_skip_reason: skipReason,
      walkthrough_crew_member: payload.crewMemberId ?? null,
    })
    .eq("id", moveId);

  return NextResponse.json({ ok: true });
}
