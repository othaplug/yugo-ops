import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyOnCheckpoint } from "@/lib/tracking-notifications";
import { maybeNotifyB2BOneOffOutForDelivery } from "@/lib/b2b-delivery-business-notifications";
import { applyEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-sync";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";
import { isTerminalJobStatus } from "@/lib/moves/job-terminal";
import {
  applyCheckpointProgressToJobRow,
  ensureJobCompleted,
  repairJobCompletionFromEvidence,
  runDeliveryCompletionFollowUp,
  runMoveCompletionFollowUp,
} from "@/lib/moves/complete-move-job";
import {
  EN_ROUTE_CHECKIN_DELAY_MS,
  scheduleEnRouteMidMoveCheckin,
  scheduleLongUnloadCheckinIfNeeded,
} from "@/lib/moves/schedule-mid-move-client-sms";
import {
  persistDeliveryArrivedLateIfNeeded,
  persistMoveArrivalOnTimeIfNeeded,
} from "@/lib/crew/persist-arrival-punctuality";
import {
  getCrewStatusFlowForMove,
  getCrewStatusFlowForDelivery,
  isAllowedTrackingCheckpointStatus,
} from "@/lib/crew/service-type-flow";

export async function POST(req: NextRequest) {
  // Checkpoints always allowed; `crew_tracking` gates live location pings only.

  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, status, note, lat, lng } = body;
  if (!sessionId || !status) {
    return NextResponse.json(
      { error: "sessionId and status required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: session, error: fetchErr } = await admin
    .from("tracking_sessions")
    .select(
      "id, job_id, job_type, team_id, status, checkpoints, is_active, last_location, started_at",
    )
    .eq("id", sessionId)
    .single();

  if (fetchErr || !session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.team_id !== payload.teamId)
    return NextResponse.json({ error: "Not your session" }, { status: 403 });
  if (!session.is_active && status !== "completed")
    return NextResponse.json({ error: "Session completed" }, { status: 400 });

  if (!isAllowedTrackingCheckpointStatus(String(status))) {
    return NextResponse.json({ error: "Invalid checkpoint status" }, { status: 400 });
  }

  let moveServiceType: string | null | undefined;
  let moveMoveType: string | null | undefined;
  if (session.job_type === "move") {
    const { data: moveRow } = await admin
      .from("moves")
      .select("service_type, move_type")
      .eq("id", session.job_id)
      .maybeSingle();
    moveServiceType = moveRow?.service_type as string | null | undefined;
    moveMoveType = moveRow?.move_type as string | null | undefined;
  }
  let deliveryServiceType: string | null | undefined;
  let deliveryBookingType: string | null | undefined;
  if (session.job_type === "delivery") {
    const { data: dRow } = await admin
      .from("deliveries")
      .select("source_quote_id, booking_type")
      .eq("id", session.job_id)
      .maybeSingle();
    deliveryBookingType = dRow?.booking_type as string | null | undefined;
    if (dRow?.source_quote_id) {
      const { data: q } = await admin
        .from("quotes")
        .select("service_type")
        .eq("id", dRow.source_quote_id)
        .maybeSingle();
      deliveryServiceType = (q?.service_type as string | null) ?? null;
    }
  }
  const flowForJob =
    session.job_type === "move"
      ? getCrewStatusFlowForMove(moveServiceType, moveMoveType)
      : getCrewStatusFlowForDelivery(deliveryServiceType, deliveryBookingType);
  const allowed = new Set<string>([...flowForJob, "completed"]);
  if (session.job_type === "delivery") {
    allowed.add("en_route");
    allowed.add("arrived");
    allowed.add("delivering");
  }
  if (!allowed.has(String(status))) {
    return NextResponse.json(
      { error: "That step is not part of this job type flow" },
      { status: 400 },
    );
  }

  const jobTable = session.job_type === "move" ? "moves" : "deliveries";
  const { data: jobStatusRow } = await admin
    .from(jobTable)
    .select("status")
    .eq("id", session.job_id)
    .maybeSingle();
  if (
    jobStatusRow &&
    isTerminalJobStatus(jobStatusRow.status as string, session.job_type as "move" | "delivery") &&
    status !== "completed"
  ) {
    return NextResponse.json(
      {
        error:
          "This job is already completed. Refresh the crew app if steps look out of date.",
      },
      { status: 409 },
    );
  }

  const checkpoints = Array.isArray(session.checkpoints)
    ? [...session.checkpoints]
    : [];
  const now = new Date().toISOString();

  // Use provided coords → session last_location → crew row as fallback so the
  // team stays visible on the admin map even when GPS is unavailable.
  const prevLoc = session.last_location as {
    lat?: number;
    lng?: number;
  } | null;
  let effectiveLat: number | null =
    lat != null ? Number(lat) : (prevLoc?.lat ?? null);
  let effectiveLng: number | null =
    lng != null ? Number(lng) : (prevLoc?.lng ?? null);
  if (effectiveLat == null || effectiveLng == null) {
    const { data: crewPos } = await admin
      .from("crews")
      .select("current_lat, current_lng")
      .eq("id", session.team_id)
      .single();
    if (crewPos?.current_lat != null && crewPos?.current_lng != null) {
      effectiveLat = Number(crewPos.current_lat);
      effectiveLng = Number(crewPos.current_lng);
    }
  }
  const hasPosition = effectiveLat != null && effectiveLng != null;

  const newCheckpoint = {
    status,
    timestamp: now,
    lat: effectiveLat,
    lng: effectiveLng,
    note: (note || "").trim() || null,
  };
  checkpoints.push(newCheckpoint);

  const isCompleted = status === "completed";
  const lastLocation = hasPosition
    ? { lat: effectiveLat!, lng: effectiveLng!, accuracy: 0, timestamp: now }
    : undefined;
  const updates: Record<string, unknown> = {
    status,
    checkpoints,
    updated_at: now,
    ...(lastLocation && { last_location: lastLocation }),
  };
  if (isCompleted) {
    updates.is_active = false;
    updates.completed_at = now;
  }

  const { error: updateErr } = await admin
    .from("tracking_sessions")
    .update(updates)
    .eq("id", sessionId);

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (session.job_type === "move" && status === "arrived_at_pickup") {
    persistMoveArrivalOnTimeIfNeeded(admin, session.job_id, now).catch((e) =>
      console.error("[checkpoint] move arrival punctuality:", e),
    );
  } else if (
    session.job_type === "delivery" &&
    status === "arrived_at_destination"
  ) {
    persistDeliveryArrivedLateIfNeeded(admin, session.job_id, now).catch((e) =>
      console.error("[checkpoint] delivery arrival punctuality:", e),
    );
  }

  // Keep crew position current so the admin map always shows active teams
  if (hasPosition) {
    const statusMap: Record<string, string> = {
      en_route_to_pickup: "en_route_pickup",
      arrived_at_pickup: "at_pickup",
      inventory_check: "loading",
      loading: "loading",
      wrapping: "loading",
      en_route_to_destination: "en_route_delivery",
      en_route_venue: "en_route_delivery",
      en_route_return: "returning",
      arrived_at_destination: "at_delivery",
      arrived_venue: "at_delivery",
      unloading: "unloading",
      unloading_setup: "unloading",
      event_active: "at_delivery",
      teardown: "loading",
      loading_return: "loading",
      unloading_return: "unloading",
      unwrapping_placement: "unloading",
      walkthrough_photos: "at_delivery",
      working: "at_pickup",
      delivering_bins: "at_delivery",
      collecting_bins: "at_pickup",
      en_route: "en_route_pickup",
      arrived: "at_pickup",
    };
    await Promise.all([
      admin
        .from("crews")
        .update({
          current_lat: effectiveLat,
          current_lng: effectiveLng,
          updated_at: now,
        })
        .eq("id", session.team_id),
      admin.from("crew_locations").upsert(
        {
          crew_id: session.team_id,
          lat: effectiveLat!,
          lng: effectiveLng!,
          status: statusMap[status] || "idle",
          updated_at: now,
        },
        { onConflict: "crew_id" },
      ),
    ]);
  }

  // Sync move/delivery status and stage with crew tracking for admin and dashboard
  if (isCompleted) {
    const sessionStart = session.started_at
      ? new Date(session.started_at as string).getTime()
      : null;
    const sessionEnd = new Date(now).getTime();
    const actualHours = sessionStart
      ? Math.round(((sessionEnd - sessionStart) / 3_600_000) * 100) / 100
      : null;

    const fin = await ensureJobCompleted(admin, {
      jobId: session.job_id,
      jobType: session.job_type as "move" | "delivery",
      completedAt: now,
      actualHours,
    });

    let runCompletionFollowUp = fin.ok && !fin.wasAlreadyComplete;

    if (!fin.ok) {
      console.error("[checkpoint] ensureJobCompleted failed, attempting evidence repair:", fin.error);
      const repaired = await repairJobCompletionFromEvidence(
        admin,
        session.job_id,
        session.job_type as "move" | "delivery",
      );
      if (!repaired.ok) {
        return NextResponse.json(
          {
            error:
              "Session was closed but the job record could not be updated. Contact the office so they can fix the move status.",
            code: "COMPLETION_SYNC_FAILED",
          },
          { status: 503 },
        );
      }
      const jobTable = session.job_type === "move" ? "moves" : "deliveries";
      const { data: statusCheck } = await admin
        .from(jobTable)
        .select("status")
        .eq("id", session.job_id)
        .maybeSingle();
      if (
        !statusCheck ||
        !isTerminalJobStatus(statusCheck.status as string, session.job_type as "move" | "delivery")
      ) {
        return NextResponse.json(
          {
            error:
              "Session was closed but the job record could not be updated. Contact the office so they can fix the move status.",
            code: "COMPLETION_SYNC_FAILED",
          },
          { status: 503 },
        );
      }
      runCompletionFollowUp = repaired.transitioned;
    }

    if (runCompletionFollowUp) {
      if (session.job_type === "move") {
        await runMoveCompletionFollowUp(admin, session.job_id, {
          source: "crew_checkpoint",
          marginActualHours: actualHours,
        });
      } else {
        await runDeliveryCompletionFollowUp(admin, session.job_id);
      }
      notifyJobCompletedForCrewProfiles(admin, {
        jobType: session.job_type as "move" | "delivery",
        jobId: session.job_id,
      }).catch((e) => console.error("[crew-profile] checkpoint completion:", e));
    }
  } else {
    const applied = await applyCheckpointProgressToJobRow(admin, {
      jobId: session.job_id,
      jobType: session.job_type as "move" | "delivery",
      checkpointStatus: String(status),
      now,
    });
    if (applied && session.job_type === "move") {
      try {
        if (status === "en_route_to_destination") {
          await scheduleEnRouteMidMoveCheckin(
            admin,
            session.job_id,
            new Date(Date.now() + EN_ROUTE_CHECKIN_DELAY_MS),
          );
        }
        if (status === "unloading") {
          await scheduleLongUnloadCheckinIfNeeded(
            admin,
            session.job_id,
            session.started_at as string | null,
            now,
          );
        }
      } catch (e) {
        console.error("[checkpoint] mid-move SMS schedule:", e);
      }
    }
  }

  if (session.job_type === "move") {
    applyEstateServiceChecklistAutomation(admin, session.job_id).catch((e) =>
      console.error("[checkpoint] estate checklist sync failed:", e),
    );
  }

  // Fetch job details for notifications
  let teamName = "";
  let jobName = "";
  let fromAddress: string | undefined;
  let toAddress: string | undefined;
  const { data: crew } = await admin
    .from("crews")
    .select("name")
    .eq("id", session.team_id)
    .single();
  teamName = crew?.name || "Crew";
  if (session.job_type === "move") {
    const { data: m } = await admin
      .from("moves")
      .select("client_name, from_address, to_address")
      .eq("id", session.job_id)
      .single();
    jobName = m?.client_name || session.job_id;
    fromAddress = m?.from_address || undefined;
    toAddress = m?.to_address || undefined;
  } else {
    const { data: d } = await admin
      .from("deliveries")
      .select("customer_name, client_name, pickup_address, delivery_address")
      .eq("id", session.job_id)
      .single();
    jobName = d
      ? `${d.customer_name || ""} (${d.client_name || ""})`
      : session.job_id;
    fromAddress = d?.pickup_address || undefined;
    toAddress = d?.delivery_address || undefined;
  }

  notifyOnCheckpoint(
    status as any,
    session.job_id,
    session.job_type as "move" | "delivery",
    teamName,
    jobName,
    fromAddress,
    toAddress,
  ).catch(() => {});

  if (session.job_type === "delivery") {
    maybeNotifyB2BOneOffOutForDelivery(session.job_id, status).catch(() => {});
  }

  // Move summary, invoice, and receipt PDFs are generated above via generateMovePDFs (same as signoff/notify-complete)

  return NextResponse.json({ ok: true, status, checkpoint: newCheckpoint });
}
