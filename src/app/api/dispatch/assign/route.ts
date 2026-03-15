import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

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

    const IN_PROGRESS = [
      "en_route",
      "en_route_to_pickup",
      "arrived_at_pickup",
      "loading",
      "en_route_to_destination",
      "arrived_at_destination",
      "unloading",
      "in_progress",
      "dispatched",
      "in_transit",
    ];
    const norm = (s: string | null) => (s || "").toLowerCase().replace(/-/g, "_");
    const statusNorm = norm(existing.status);
    const stageNorm = norm(existing.stage);
    const isInProgress = IN_PROGRESS.includes(statusNorm) || IN_PROGRESS.includes(stageNorm);

    if (isInProgress) {
      return NextResponse.json(
        { error: "Cannot reassign: job is in progress. Reassignment is only allowed before the crew has started." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      crew_id: crewId && crewId.trim() ? crewId.trim() : null,
      updated_at: new Date().toISOString(),
    };

    if (jobType === "move" && crewId) {
      const { data: crew } = await admin.from("crews").select("members").eq("id", crewId).single();
      if (crew?.members && Array.isArray(crew.members)) {
        update.assigned_members = crew.members;
      }
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
