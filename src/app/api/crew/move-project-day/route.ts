import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

/** PATCH crew stage line on the active residential move_project_day row */
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { move_id?: string; day_id?: string; current_stage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const moveId = typeof body.move_id === "string" ? body.move_id.trim() : "";
  const dayId = typeof body.day_id === "string" ? body.day_id.trim() : "";
  const nextStage =
    typeof body.current_stage === "string" ? body.current_stage.trim() : "";

  if (!moveId || !dayId || !nextStage) {
    return NextResponse.json(
      { error: "move_id, day_id, and current_stage are required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data: mv } = await db
    .from("moves")
    .select("id, crew_id")
    .eq("id", moveId)
    .maybeSingle();

  if (!mv || mv.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: day } = await db
    .from("move_project_days")
    .select("id, move_id, stages, current_stage")
    .eq("id", dayId)
    .eq("move_id", moveId)
    .maybeSingle();

  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const stagesRaw = day.stages;
  const stages = Array.isArray(stagesRaw)
    ? stagesRaw.filter((x): x is string => typeof x === "string")
    : [];

  if (stages.length > 0 && !stages.includes(nextStage)) {
    return NextResponse.json({ error: "Stage is not valid for this day" }, { status: 400 });
  }

  const { error: upErr } = await db
    .from("move_project_days")
    .update({ current_stage: nextStage })
    .eq("id", dayId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, current_stage: nextStage });
}
