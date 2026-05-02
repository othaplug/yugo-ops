import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getFeatureConfig } from "@/lib/platform-settings";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { labelForDayType } from "@/lib/move-projects/day-types";

/** PATCH residential move_project_day: stage line and optional crew checklist state */
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    move_id?: string;
    day_id?: string;
    current_stage?: string;
    crew_day_state?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const moveId = typeof body.move_id === "string" ? body.move_id.trim() : "";
  const dayId = typeof body.day_id === "string" ? body.day_id.trim() : "";
  const nextStage =
    typeof body.current_stage === "string" ? body.current_stage.trim() : "";
  const crewStatePatch =
    body.crew_day_state && typeof body.crew_day_state === "object" && !Array.isArray(body.crew_day_state)
      ? body.crew_day_state
      : null;

  if (!moveId || !dayId || (!nextStage && !crewStatePatch)) {
    return NextResponse.json(
      {
        error: "move_id and day_id are required; provide current_stage and/or crew_day_state",
      },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data: mv } = await db
    .from("moves")
    .select("id, crew_id, client_name, client_phone, move_code")
    .eq("id", moveId)
    .maybeSingle();

  if (!mv || mv.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: dayBefore } = await db
    .from("move_project_days")
    .select(
      "id, move_id, day_type, stages, current_stage, arrival_notice_sent, crew_day_state",
    )
    .eq("id", dayId)
    .eq("move_id", moveId)
    .maybeSingle();

  if (!dayBefore) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const stagesRaw = dayBefore.stages;
  const stages = Array.isArray(stagesRaw)
    ? stagesRaw.filter((x): x is string => typeof x === "string")
    : [];

  if (nextStage && stages.length > 0 && !stages.includes(nextStage)) {
    return NextResponse.json({ error: "Stage is not valid for this day" }, { status: 400 });
  }

  let mergedCrewState: Record<string, unknown> | null = null;
  if (crewStatePatch) {
    const prev = dayBefore.crew_day_state;
    const base =
      prev && typeof prev === "object" && !Array.isArray(prev)
        ? (prev as Record<string, unknown>)
        : {};
    mergedCrewState = { ...base, ...crewStatePatch };
  }

  const updates: Record<string, unknown> = {};
  if (nextStage) updates.current_stage = nextStage;
  if (mergedCrewState) updates.crew_day_state = mergedCrewState;

  const { error: upErr } = await db.from("move_project_days").update(updates).eq("id", dayId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  if (nextStage === "arrived" && !(dayBefore as { arrival_notice_sent?: boolean }).arrival_notice_sent) {
    const dayTypeLc = String(dayBefore.day_type || "").toLowerCase().trim();
    if (["pack", "unpack", "crating"].includes(dayTypeLc)) {
      const cfg = await getFeatureConfig(["sms_eta_enabled"]);
      if (cfg.sms_eta_enabled === "true") {
        const phone = typeof mv.client_phone === "string" ? mv.client_phone.replace(/\s/g, "") : "";
        if (phone.length >= 10) {
          const first =
            typeof mv.client_name === "string" ? mv.client_name.trim().split(/\s+/)[0] || "there" : "there";
          const dayWord = labelForDayType(dayTypeLc).toLowerCase();
          const bodySms = `Hi ${first}, your Yugo crew is on site today for ${dayWord}. If you need anything, text us here or call (647) 370-4525.`;
          const smsResult = await sendSMS(phone, bodySms);
          if (smsResult.success) {
            await db.from("move_project_days").update({ arrival_notice_sent: true }).eq("id", dayId);
          }
        }
      }
      await notifyAdmins("move_project_day_started", {
        moveId,
        description: `${labelForDayType(dayTypeLc)} underway · ${mv.move_code || moveId}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    current_stage: nextStage || (typeof dayBefore.current_stage === "string" ? dayBefore.current_stage : null),
    crew_day_state: mergedCrewState ?? (dayBefore.crew_day_state && typeof dayBefore.crew_day_state === "object" && !Array.isArray(dayBefore.crew_day_state) ? dayBefore.crew_day_state : {}),
  });
}
