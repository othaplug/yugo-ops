import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyOnCheckpoint } from "@/lib/tracking-notifications";
import { getPlatformToggles } from "@/lib/platform-settings";

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
    .select("id, job_id, job_type, team_id, status, checkpoints, is_active")
    .eq("id", sessionId)
    .single();

  if (fetchErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.team_id !== payload.teamId) return NextResponse.json({ error: "Not your session" }, { status: 403 });
  if (!session.is_active && status !== "completed") return NextResponse.json({ error: "Session completed" }, { status: 400 });

  const checkpoints = Array.isArray(session.checkpoints) ? [...session.checkpoints] : [];
  const now = new Date().toISOString();
  const newCheckpoint = {
    status,
    timestamp: now,
    lat: lat ?? null,
    lng: lng ?? null,
    note: (note || "").trim() || null,
  };
  checkpoints.push(newCheckpoint);

  const isCompleted = status === "completed";
  const updates: Record<string, unknown> = {
    status,
    checkpoints,
    updated_at: now,
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

  // When crew starts live tracking (en route), set move/delivery status to in_progress globally
  const enRouteStatuses = ["en_route_to_pickup", "en_route_to_destination", "on_route", "en_route"];
  if (enRouteStatuses.includes(status)) {
    const table = session.job_type === "move" ? "moves" : "deliveries";
    await admin.from(table).update({ status: "in_progress", stage: status, updated_at: now }).eq("id", session.job_id);
  } else {
    await admin
      .from(session.job_type === "move" ? "moves" : "deliveries")
      .update({ stage: status, updated_at: now })
      .eq("id", session.job_id);
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

  return NextResponse.json({ ok: true, status, checkpoint: newCheckpoint });
}
