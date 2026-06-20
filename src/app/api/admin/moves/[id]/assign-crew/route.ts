import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import {
  fetchCrewAssignmentSnapshot,
  resolveAssignedMembers,
} from "@/lib/crew-job-snapshot";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;
  const body = (await req.json()) as { crew_id: string };

  if (!body.crew_id) {
    return NextResponse.json({ error: "crew_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const snap = await fetchCrewAssignmentSnapshot(admin, body.crew_id);

  // Preserve a previously chosen member subset when the crew is unchanged;
  // only snapshot the full roster on a genuinely new crew.
  const { data: existing } = await admin
    .from("moves")
    .select("crew_id, assigned_members")
    .eq("id", moveId)
    .maybeSingle();
  const assigned_members = resolveAssignedMembers({
    previousCrewId: existing?.crew_id as string | null | undefined,
    nextCrewId: body.crew_id,
    existingMembers: existing?.assigned_members,
    snapshotMembers: snap.assigned_members,
  });

  const { error } = await admin
    .from("moves")
    .update({
      crew_id: body.crew_id,
      status: "scheduled",
      assigned_members,
      assigned_crew_name: snap.assigned_crew_name,
    })
    .eq("id", moveId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
