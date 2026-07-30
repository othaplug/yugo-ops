import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getFeatureConfig } from "@/lib/platform-settings";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { MOVE_DAY_STAGE_FLOW, labelForDayType } from "@/lib/move-projects/day-types";
import {
  closeActiveTrackingSessionsForJob,
  persistActualMarginForMove,
} from "@/lib/moves/complete-move-job";
import { sessionJobDurationMinutes } from "@/lib/crew/session-job-duration-minutes";

const eligibleFinalStage = (dayType: string, stages: string[]): string | null => {
  const flow = MOVE_DAY_STAGE_FLOW[String(dayType || "move")] ?? MOVE_DAY_STAGE_FLOW.move;
  const list =
    stages.length > 0 ? stages : Array.isArray(flow.stages) ? flow.stages : [];
  return list.length > 0 ? list[list.length - 1]! : null;
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsed: {
    move_id?: string;
    day_id?: string;
    completion_notes?: string | null;
  };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const moveId = typeof parsed.move_id === "string" ? parsed.move_id.trim() : "";
  const dayId = typeof parsed.day_id === "string" ? parsed.day_id.trim() : "";
  if (!moveId || !dayId) {
    return NextResponse.json({ error: "move_id and day_id are required" }, { status: 400 });
  }
  const notes =
    typeof parsed.completion_notes === "string"
      ? parsed.completion_notes.trim().slice(0, 2000)
      : "";

  const db = createAdminClient();

  const { data: mv } = await db
    .from("moves")
    .select("id, crew_id, client_name, client_phone, move_code")
    .eq("id", moveId)
    .maybeSingle();

  if (!mv || mv.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: dayRow } = await db
    .from("move_project_days")
    .select(
      "id, move_id, project_id, day_number, day_type, status, stages, current_stage, requires_pod, completion_notice_sent, estimated_hours, crew_size, crew_day_state",
    )
    .eq("id", dayId)
    .eq("move_id", moveId)
    .maybeSingle();

  if (!dayRow) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const stLc = String(dayRow.status || "").toLowerCase();
  if (stLc === "completed") {
    return NextResponse.json({ error: "This day is already marked complete" }, { status: 400 });
  }
  if (stLc === "cancelled") {
    return NextResponse.json({ error: "This day was cancelled" }, { status: 400 });
  }

  const stagesRaw = dayRow.stages;
  const stages = Array.isArray(stagesRaw)
    ? stagesRaw.filter((x): x is string => typeof x === "string")
    : [];
  const want = eligibleFinalStage(String(dayRow.day_type || "move"), stages);
  const cur = typeof dayRow.current_stage === "string" ? dayRow.current_stage.trim() : "";
  if (want && cur !== want) {
    return NextResponse.json(
      { error: `Advance to "${want}" before closing this project day.` },
      { status: 400 },
    );
  }

  const needsPod = !!(dayRow as { requires_pod?: boolean }).requires_pod;
  const dayTypeLc = String(dayRow.day_type || "").toLowerCase();
  const isCargo = dayTypeLc === "move" || dayTypeLc === "volume";

  if (needsPod && isCargo) {
    const { data: pod } = await db
      .from("proof_of_delivery")
      .select("id")
      .eq("move_id", moveId)
      .maybeSingle();
    if (!pod?.id) {
      return NextResponse.json(
        { error: "Proof of delivery is required before you can finish this cargo day." },
        { status: 400 },
      );
    }
  }

  const nowIso = new Date().toISOString();

  const { error: finishErr } = await db
    .from("move_project_days")
    .update({
      status: "completed",
      completed_at: nowIso,
      completion_notes: notes || null,
    })
    .eq("id", dayId);

  if (finishErr) return NextResponse.json({ error: finishErr.message }, { status: 500 });

  // Auto-close the day: stop the crew's live tracking session/timer so the day
  // ends cleanly WITHOUT a client sign-off (operator directive — pack day
  // closes for the day; the actual move still happens on day 2). Best-effort.
  try {
    await closeActiveTrackingSessionsForJob(db, moveId, "move", nowIso);
  } catch (e) {
    console.error("[move-project-day/complete] close sessions:", e);
  }

  const { data: allDays } = await db
    .from("move_project_days")
    .select("id, status")
    .eq("move_id", moveId);

  const allDone = (allDays || []).every((d) => String(d.status || "").toLowerCase() === "completed");

  if (allDone) {
    await db.from("move_projects").update({ status: "completed", updated_at: nowIso }).eq("id", dayRow.project_id);

    // Every day is done → recompute the ACTUAL expense from real worked hours.
    // Each project day is its own tracking session; sum them (per-business-day
    // spans, so overnight gaps aren't counted) to get the true multi-day labour
    // and bake it into the move's actual margin snapshot. Best-effort.
    try {
      const { data: sessions } = await db
        .from("tracking_sessions")
        .select("started_at, completed_at, updated_at, status, checkpoints")
        .eq("job_id", moveId)
        .eq("job_type", "move");
      let totalMinutes = 0;
      for (const s of sessions ?? []) {
        totalMinutes += sessionJobDurationMinutes(
          s as Parameters<typeof sessionJobDurationMinutes>[0],
        );
      }
      const totalHours =
        totalMinutes > 0 ? Math.round((totalMinutes / 60) * 100) / 100 : null;
      if (totalHours != null) {
        await persistActualMarginForMove(db, moveId, totalHours);
      }
    } catch (e) {
      console.error("[move-project-day/complete] actual margin recalc:", e);
    }
  }

  const cfg = await getFeatureConfig(["sms_eta_enabled"]);
  if (!(dayRow as { completion_notice_sent?: boolean }).completion_notice_sent && cfg.sms_eta_enabled === "true") {
    const phone = typeof mv.client_phone === "string" ? mv.client_phone.replace(/\s/g, "") : "";
    if (phone.length >= 10) {
      const first =
        typeof mv.client_name === "string" ? mv.client_name.trim().split(/\s+/)[0] || "there" : "there";
      const dayWord = labelForDayType(dayTypeLc);
      const { data: nextDay } = await db
        .from("move_project_days")
        .select("date, label, day_type")
        .eq("move_id", moveId)
        .neq("status", "completed")
        .order("day_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      // Pack-day recap: on a luxury Estate move, a room-count reassurance turns
      // the completion text into a trust moment ("your home is packed").
      let recapLine = "";
      if (dayTypeLc === "pack") {
        const cds = (dayRow as { crew_day_state?: unknown }).crew_day_state;
        const rooms =
          cds && typeof cds === "object" && !Array.isArray(cds)
            ? (cds as { pack_rooms?: Record<string, unknown> }).pack_rooms
            : null;
        const roomCount =
          rooms && typeof rooms === "object"
            ? Object.values(rooms).filter(Boolean).length
            : 0;
        if (roomCount > 0) {
          recapLine = `Your home is packed and protected — ${roomCount} ${
            roomCount === 1 ? "room" : "rooms"
          } wrapped and ready for moving day.`;
        }
      }
      let bodySms = "";
      if (!nextDay) {
        bodySms = [
          `Hi ${first},`,
          `Thank you for hosting us today. We have finished ${dayWord.toLowerCase()} work for your move with Yugo, and we will confirm any final steps with your coordinator shortly.`,
          `Any questions? Reply here anytime, or call (647) 370-4525.`,
        ].join("\n\n");
      } else {
        const nd = typeof nextDay.date === "string" ? nextDay.date.slice(0, 10) : "";
        const nextLabel =
          typeof nextDay.label === "string" && nextDay.label.trim().length > 0
            ? nextDay.label.trim().toLowerCase()
            : labelForDayType(String(nextDay.day_type || "move")).toLowerCase();
        bodySms = [
          `Hi ${first},`,
          recapLine
            ? `${recapLine} Next on ${nd}: ${nextLabel}.`
            : `We have wrapped ${dayWord.toLowerCase()} for today. Next on ${nd}: ${nextLabel}.`,
          `If you need anything tonight, reply here anytime, or call (647) 370-4525.`,
        ].join("\n\n");
      }
      const smsResult = await sendSMS(phone, bodySms);
      if (smsResult.success) {
        await db.from("move_project_days").update({ completion_notice_sent: true }).eq("id", dayId);
      }
    }
  }

  // Overrun watch: compare this day's real worked hours to its planned budget.
  // If it ran well over, flag the coordinator so they can reconfirm the next
  // day's start window with the client instead of the schedule silently drifting.
  let overrunNote = "";
  try {
    const estHrs = Number((dayRow as { estimated_hours?: number }).estimated_hours) || 0;
    if (estHrs > 0) {
      const { data: lastSess } = await db
        .from("tracking_sessions")
        .select("started_at, completed_at, updated_at, status, checkpoints")
        .eq("job_id", moveId)
        .eq("job_type", "move")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastSess) {
        const actualHrs =
          sessionJobDurationMinutes(
            lastSess as Parameters<typeof sessionJobDurationMinutes>[0],
          ) / 60;
        if (actualHrs > estHrs * 1.25) {
          overrunNote = ` · ran ${actualHrs.toFixed(1)}h vs ${estHrs}h planned — reconfirm next-day timing with the client`;
        }
      }
    }
  } catch {
    /* best-effort */
  }

  await notifyAdmins(
    overrunNote ? "move_project_day_overrun" : "move_project_day_completed",
    {
      moveId,
      description: `${labelForDayType(dayTypeLc)} marked complete · ${mv.move_code || moveId}${overrunNote}`,
    },
  );

  return NextResponse.json({ ok: true, all_project_days_done: allDone });
}
