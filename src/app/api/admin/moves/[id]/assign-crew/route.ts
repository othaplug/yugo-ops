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

  const { data: primary } = await admin
    .from("moves")
    .select("id, crew_id, assigned_members, event_group_id")
    .eq("id", moveId)
    .maybeSingle();

  // Event bookings are two linked move rows (delivery + return) sharing an
  // event_group_id. Assigning a crew to one leg MUST assign the other, or the
  // return leg keeps a different (or no) crew — and every crew write on it
  // (tracking, sign-off, completion) then 404s on the crew_id ownership guard,
  // leaving part 2 stuck at "client sign-off" while it can never be completed.
  // So assignment fans out to the whole event group. Non-event moves resolve to
  // just this row.
  const groupId = (primary as { event_group_id?: string | null })?.event_group_id ?? null;
  const targets = groupId
    ? (
        (
          await admin
            .from("moves")
            .select("id, crew_id, assigned_members, status")
            .eq("event_group_id", groupId)
        ).data ?? []
      )
    : primary
      ? [{ ...primary, status: undefined as string | undefined }]
      : [];
  if (targets.length === 0) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  // Statuses where (re)assigning should reset the row to "scheduled". A leg that
  // is already done, cancelled, or actively being worked keeps its status so we
  // never un-complete a finished delivery when assigning the return.
  const KEEP_STATUS = new Set([
    "completed",
    "cancelled",
    "in_progress",
    "en_route_to_pickup",
    "arrived_at_pickup",
    "en_route_venue",
    "arrived_venue",
    "event_active",
    "teardown",
    "en_route_return",
    "en_route_to_destination",
    "arrived_at_destination",
    "arrived",
    "working",
  ]);

  for (const t of targets) {
    // Preserve a previously chosen member subset when the crew is unchanged on
    // THAT row; only snapshot the full roster on a genuinely new crew.
    const assigned_members = resolveAssignedMembers({
      previousCrewId: (t.crew_id as string | null | undefined) ?? undefined,
      nextCrewId: body.crew_id,
      existingMembers: t.assigned_members,
      snapshotMembers: snap.assigned_members,
    });
    const current = (t as { status?: string | null }).status ?? null;
    const update: Record<string, unknown> = {
      crew_id: body.crew_id,
      assigned_members,
      assigned_crew_name: snap.assigned_crew_name,
    };
    if (!current || !KEEP_STATUS.has(current)) update.status = "scheduled";

    const { error } = await admin.from("moves").update(update).eq("id", t.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, assigned: targets.length });
}
