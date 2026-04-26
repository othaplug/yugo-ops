import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyOnCheckpoint } from "@/lib/tracking-notifications";
import {
  maybeNotifyB2BOneOffOutForDelivery,
  maybeNotifyB2BOneOffDelivered,
} from "@/lib/b2b-delivery-business-notifications";
import { syncDealStageByMoveId } from "@/lib/hubspot/sync-deal-stage";
import { applyEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-sync";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";
import {
  persistDeliveryArrivedLateIfNeeded,
  persistMoveArrivalOnTimeIfNeeded,
} from "@/lib/crew/persist-arrival-punctuality";
import { DELIVERY_STATUS_FLOW } from "@/lib/crew-tracking-status";
import {
  getCrewStatusFlowForMove,
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
  if (session.job_type === "move") {
    const { data: moveRow } = await admin
      .from("moves")
      .select("service_type")
      .eq("id", session.job_id)
      .maybeSingle();
    moveServiceType = moveRow?.service_type as string | null | undefined;
  }
  const flowForJob =
    session.job_type === "move"
      ? getCrewStatusFlowForMove(moveServiceType)
      : [...DELIVERY_STATUS_FLOW];
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
      arrived_at_destination: "at_delivery",
      unloading: "unloading",
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
  const table = session.job_type === "move" ? "moves" : "deliveries";
  const enRouteStatuses = [
    "en_route_to_pickup",
    "en_route_to_destination",
    "on_route",
    "en_route",
  ];
  if (isCompleted) {
    // Calculate actual job duration from session timestamps and write to move/delivery record
    const sessionStart = session.started_at
      ? new Date(session.started_at as string).getTime()
      : null;
    const sessionEnd = new Date(now).getTime();
    const actualHours = sessionStart
      ? Math.round(((sessionEnd - sessionStart) / 3_600_000) * 100) / 100
      : null;

    const { error: moveCompleteErr } = await admin
      .from(table)
      .update({
        status: session.job_type === "move" ? "completed" : "delivered",
        stage: "completed",
        completed_at: now,
        updated_at: now,
        eta_tracking_active: false,
        ...(actualHours != null && actualHours > 0
          ? { actual_hours: actualHours }
          : {}),
      })
      .eq("id", session.job_id);
    if (moveCompleteErr) {
      console.error(
        "[checkpoint] job row did not sync to completed (session already finalized):",
        moveCompleteErr.message,
      );
    }
    if (session.job_type === "move") {
      syncDealStageByMoveId(session.job_id, "completed").catch(() => {});
      const { createReviewRequestIfEligible } =
        await import("@/lib/review-request-helper");
      createReviewRequestIfEligible(admin, session.job_id).catch((e) =>
        console.error("[review] create failed:", e),
      );
      const { createClientReferralIfNeeded } =
        await import("@/lib/client-referral");
      createClientReferralIfNeeded(admin, session.job_id).catch((e) =>
        console.error("[referral] create failed:", e),
      );
      const { generateMovePDFs } =
        await import("@/lib/documents/generateMovePDFs");
      generateMovePDFs(session.job_id).catch((e) =>
        console.error("[generateMovePDFs] failed:", e),
      );

      // Calculate actual margin and persist (non-blocking)
      (async () => {
        try {
          const { calcActualMargin } = await import("@/lib/pricing/engine");
          const { data: moveForMargin } = await admin
            .from("moves")
            .select(
              "actual_hours, est_hours, actual_crew_count, crew_count, truck_primary, distance_km, tier_selected, move_size, estimate",
            )
            .eq("id", session.job_id)
            .single();
          if (moveForMargin) {
            const { data: cfgRows } = await admin
              .from("platform_config")
              .select("key, value");
            const cfg: Record<string, string> = {};
            for (const r of cfgRows ?? []) cfg[r.key] = r.value;
            const marginResult = calcActualMargin(
              {
                actualHours: actualHours,
                estimatedHours: moveForMargin.est_hours ?? null,
                actualCrew: moveForMargin.actual_crew_count ?? null,
                crewSize: moveForMargin.crew_count ?? null,
                truckType: moveForMargin.truck_primary ?? null,
                distanceKm: moveForMargin.distance_km ?? null,
                tier: moveForMargin.tier_selected ?? null,
                moveSize: moveForMargin.move_size ?? null,
                totalPrice: moveForMargin.estimate ?? null,
              },
              cfg,
            );
            await admin
              .from("moves")
              .update(marginResult)
              .eq("id", session.job_id);
          }
        } catch (e) {
          console.error("[checkpoint] margin calculation failed:", e);
        }
      })();
    }
    // Send completed SMS to client/customer
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.withyugo.com";
    fetch(`${origin}/api/eta/send-completed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: session.job_id,
        jobType: session.job_type,
      }),
    }).catch((e) => console.error("[eta] send-completed failed:", e));
    if (session.job_type === "delivery") {
      maybeNotifyB2BOneOffDelivered(session.job_id).catch(() => {});
    }
    notifyJobCompletedForCrewProfiles(admin, {
      jobType: session.job_type as "move" | "delivery",
      jobId: session.job_id,
    }).catch((e) => console.error("[crew-profile] checkpoint completion:", e));
  } else if (enRouteStatuses.includes(status)) {
    await admin
      .from(table)
      .update({ status: "in_progress", stage: status, updated_at: now })
      .eq("id", session.job_id);
    if (session.job_type === "move") {
      syncDealStageByMoveId(session.job_id, "in_progress").catch(() => {});
    }
  } else {
    await admin
      .from(table)
      .update({ stage: status, updated_at: now })
      .eq("id", session.job_id);
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
