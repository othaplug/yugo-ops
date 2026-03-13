import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyOnCheckpoint } from "@/lib/tracking-notifications";
import { getPlatformToggles } from "@/lib/platform-settings";
import { syncDealStageByMoveId } from "@/lib/hubspot/sync-deal-stage";

export async function POST(req: NextRequest) {
  const toggles = await getPlatformToggles();
  if (!toggles.crew_tracking) {
    return NextResponse.json({ error: "Crew GPS tracking is disabled" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, status, note, lat, lng } = body;
  if (!sessionId || !status) {
    return NextResponse.json({ error: "sessionId and status required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: session, error: fetchErr } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, team_id, status, checkpoints, is_active, last_location")
    .eq("id", sessionId)
    .single();

  if (fetchErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.team_id !== payload.teamId) return NextResponse.json({ error: "Not your session" }, { status: 403 });
  if (!session.is_active && status !== "completed") return NextResponse.json({ error: "Session completed" }, { status: 400 });

  const checkpoints = Array.isArray(session.checkpoints) ? [...session.checkpoints] : [];
  const now = new Date().toISOString();

  // Use provided coords → session last_location → crew row as fallback so the
  // team stays visible on the admin map even when GPS is unavailable.
  const prevLoc = session.last_location as { lat?: number; lng?: number } | null;
  let effectiveLat: number | null = lat != null ? Number(lat) : (prevLoc?.lat ?? null);
  let effectiveLng: number | null = lng != null ? Number(lng) : (prevLoc?.lng ?? null);
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

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Keep crew position current so the admin map always shows active teams
  if (hasPosition) {
    const statusMap: Record<string, string> = {
      en_route_to_pickup: "en_route_pickup",
      arrived_at_pickup: "at_pickup",
      loading: "loading",
      en_route_to_destination: "en_route_delivery",
      arrived_at_destination: "at_delivery",
      unloading: "unloading",
    };
    await Promise.all([
      admin
        .from("crews")
        .update({ current_lat: effectiveLat, current_lng: effectiveLng, updated_at: now })
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
  const enRouteStatuses = ["en_route_to_pickup", "en_route_to_destination", "on_route", "en_route"];
  if (isCompleted) {
    await admin
      .from(table)
      .update({
        status: session.job_type === "move" ? "completed" : "delivered",
        stage: "completed",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", session.job_id);
    if (session.job_type === "move") {
      syncDealStageByMoveId(session.job_id, "completed").catch(() => {});
      const { createReviewRequestIfEligible } = await import("@/lib/review-request-helper");
      createReviewRequestIfEligible(admin, session.job_id).catch((e) => console.error("[review] create failed:", e));
    }
  } else if (enRouteStatuses.includes(status)) {
    await admin.from(table).update({ status: "in_progress", stage: status, updated_at: now }).eq("id", session.job_id);
    if (session.job_type === "move") {
      syncDealStageByMoveId(session.job_id, "in_progress").catch(() => {});
    }
  } else {
    await admin.from(table).update({ stage: status, updated_at: now }).eq("id", session.job_id);
  }

  // Fetch job details for notifications
  let teamName = "";
  let jobName = "";
  let fromAddress: string | undefined;
  let toAddress: string | undefined;
  const { data: crew } = await admin.from("crews").select("name").eq("id", session.team_id).single();
  teamName = crew?.name || "Crew";
  if (session.job_type === "move") {
    const { data: m } = await admin.from("moves").select("client_name, from_address, to_address").eq("id", session.job_id).single();
    jobName = m?.client_name || session.job_id;
    fromAddress = m?.from_address || undefined;
    toAddress = m?.to_address || undefined;
  } else {
    const { data: d } = await admin.from("deliveries").select("customer_name, client_name, pickup_address, delivery_address").eq("id", session.job_id).single();
    jobName = d ? `${d.customer_name || ""} (${d.client_name || ""})` : session.job_id;
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
    toAddress
  ).catch(() => {});

  // Generate invoice + move snapshot PDFs on completion
  if (isCompleted && session.job_type === "move") {
    import("@/lib/post-move-documents")
      .then(({ generatePostMoveDocuments }) => generatePostMoveDocuments(session.job_id))
      .catch((err) => console.error("[checkpoint] post-move documents failed:", err));
  }

  return NextResponse.json({ ok: true, status, checkpoint: newCheckpoint });
}
