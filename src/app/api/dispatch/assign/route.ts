import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { isDispatchJobInProgress } from "@/lib/dispatch-job-in-progress";
import { fetchCrewAssignmentSnapshot } from "@/lib/crew-job-snapshot";

/** PATCH: Assign crew to a move or delivery. Staff only. */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  try {
    const body = await req.json().catch(() => ({}));
    const { jobId, jobType, crewId } = body as {
      jobId: string;
      jobType: "move" | "delivery";
      crewId: string | null;
    };

    if (!jobId || !jobType) {
      return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
    }
    if (jobType !== "move" && jobType !== "delivery") {
      return NextResponse.json({ error: "jobType must be move or delivery" }, { status: 400 });
    }

    const admin = createAdminClient();
    const table = jobType === "move" ? "moves" : "deliveries";
    const codeCol = jobType === "move" ? "move_code" : "delivery_number";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

    const { data: existing } = isUuid
      ? await admin.from(table).select("id, status, stage").eq("id", jobId).maybeSingle()
      : await admin.from(table).select("id, status, stage").ilike(codeCol, jobId).maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (isDispatchJobInProgress(existing.status, existing.stage)) {
      return NextResponse.json(
        { error: "Cannot reassign: job is in progress. Reassignment is only allowed before the crew has started." },
        { status: 400 }
      );
    }

    const trimmedCrew = crewId && String(crewId).trim() ? String(crewId).trim() : null;
    const update: Record<string, unknown> = {
      crew_id: trimmedCrew,
      updated_at: new Date().toISOString(),
    };

    if (trimmedCrew) {
      const snap = await fetchCrewAssignmentSnapshot(admin, trimmedCrew);
      update.assigned_members = snap.assigned_members;
      update.assigned_crew_name = snap.assigned_crew_name;
    } else {
      update.assigned_members = [];
      update.assigned_crew_name = null;
    }

    const { data: updated, error } = await admin
      .from(table)
      .update(update)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, [jobType]: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to assign crew" },
      { status: 500 }
    );
  }
}
