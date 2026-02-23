import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { formatJobId } from "@/lib/move-code";

const STAGE_LABELS: Record<string, string> = {
  en_route_to_pickup: "Drive to pickup",
  arrived_at_pickup: "Arrived at pickup",
  loading: "Loading",
  en_route_to_destination: "Drive to destination",
  arrived_at_destination: "Arrived at destination",
  unloading: "Unloading",
  completed: "Completed",
  idle: "Idle (no movement)",
};

/** GET: Full job detail for EOD report modal — job info, sign-off, checkpoints with time breakdown. */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const jobType = searchParams.get("jobType") as "move" | "delivery" | null;
  const sessionId = searchParams.get("sessionId");
  const teamId = searchParams.get("teamId");
  const reportDate = searchParams.get("reportDate");

  if (!jobId || !jobType || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType (move|delivery) required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId: string;
  let job: {
    displayId: string;
    clientName: string;
    fromAddress?: string;
    toAddress?: string;
    type: "move" | "delivery";
    clientEmail?: string;
    clientPhone?: string;
    scheduledDate?: string;
    arrivalWindow?: string;
    crewName?: string;
  };
  if (jobType === "move") {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, move_code, client_name, from_address, to_address, client_email, client_phone, scheduled_date, arrival_window").eq("id", jobId).single()
      : await admin.from("moves").select("id, move_code, client_name, from_address, to_address, client_email, client_phone, scheduled_date, arrival_window").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!m) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    entityId = m.id;
    const { data: crew } = await admin.from("moves").select("crew_id").eq("id", m.id).single();
    let crewName: string | undefined;
    if (crew?.crew_id) {
      const { data: c } = await admin.from("crews").select("name").eq("id", crew.crew_id).single();
      crewName = c?.name ?? undefined;
    }
    job = {
      displayId: formatJobId(m.move_code || m.id, "move"),
      clientName: m.client_name || "—",
      fromAddress: m.from_address ?? undefined,
      toAddress: m.to_address ?? undefined,
      type: "move",
      clientEmail: m.client_email ?? undefined,
      clientPhone: m.client_phone ?? undefined,
      scheduledDate: m.scheduled_date ?? undefined,
      arrivalWindow: m.arrival_window ?? undefined,
      crewName,
    };
  } else {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("id, delivery_number, customer_name, client_name, pickup_address, delivery_address, customer_email, customer_phone, scheduled_date, time_slot").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, delivery_number, customer_name, client_name, pickup_address, delivery_address, customer_email, customer_phone, scheduled_date, time_slot").ilike("delivery_number", jobId).single();
    if (!d) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    entityId = d.id;
    const { data: crew } = await admin.from("deliveries").select("crew_id").eq("id", d.id).single();
    let crewName: string | undefined;
    if (crew?.crew_id) {
      const { data: c } = await admin.from("crews").select("name").eq("id", crew.crew_id).single();
      crewName = c?.name ?? undefined;
    }
    const dRow = d as { customer_email?: string; customer_phone?: string; scheduled_date?: string; time_slot?: string };
    job = {
      displayId: formatJobId(d.delivery_number || d.id, "delivery"),
      clientName: [d.customer_name, d.client_name].filter(Boolean).join(" — ") || "—",
      fromAddress: d.pickup_address ?? undefined,
      toAddress: d.delivery_address ?? undefined,
      type: "delivery",
      clientEmail: dRow.customer_email ?? undefined,
      clientPhone: dRow.customer_phone ?? undefined,
      scheduledDate: dRow.scheduled_date ?? undefined,
      arrivalWindow: dRow.time_slot ?? undefined,
      crewName,
    };
  }

  let session: { id: string; started_at: string | null; completed_at: string | null; checkpoints: { status: string; timestamp: string; lat?: number | null; lng?: number | null; note?: string | null }[] } | null = null;
  if (sessionId) {
    const { data: s } = await admin.from("tracking_sessions").select("id, started_at, completed_at, checkpoints").eq("id", sessionId).single();
    if (s) session = { id: s.id, started_at: s.started_at, completed_at: s.completed_at, checkpoints: (s.checkpoints as any[]) || [] };
  } else if (teamId && reportDate) {
    // For older reports: lookup by teamId + reportDate. Use ±1 day to handle timezone/date mismatches.
    const d = new Date(reportDate);
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const start = prev.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const end = next.toISOString().slice(0, 10) + "T23:59:59.999Z";
    const { data: sessions } = await admin
      .from("tracking_sessions")
      .select("id, started_at, completed_at, checkpoints")
      .eq("job_id", entityId)
      .eq("job_type", jobType)
      .eq("team_id", teamId)
      .gte("started_at", start)
      .lte("started_at", end)
      .order("started_at", { ascending: false })
      .limit(1);
    if (sessions?.[0]) session = { id: sessions[0].id, started_at: sessions[0].started_at, completed_at: sessions[0].completed_at, checkpoints: (sessions[0].checkpoints as any[]) || [] };
  }

  const checkpoints = session?.checkpoints ?? [];
  const timeBreakdown: { stage: string; label: string; minutes: number; from: string; to: string }[] = [];
  for (let i = 0; i < checkpoints.length; i++) {
    const curr = checkpoints[i];
    const next = checkpoints[i + 1];
    const fromTs = curr?.timestamp ? new Date(curr.timestamp).getTime() : null;
    const toTs = next?.timestamp ? new Date(next.timestamp).getTime() : (session?.completed_at ? new Date(session.completed_at).getTime() : null);
    if (fromTs != null && toTs != null && curr?.status) {
      const minutes = Math.round((toTs - fromTs) / 60000);
      timeBreakdown.push({
        stage: curr.status,
        label: STAGE_LABELS[curr.status] || curr.status.replace(/_/g, " "),
        minutes,
        from: curr.timestamp,
        to: next?.timestamp || session?.completed_at || "",
      });
    }
  }
  const totalMinutes = timeBreakdown.reduce((s, t) => s + t.minutes, 0);
  const driveMinutes = timeBreakdown.filter((t) => t.stage.includes("en_route") || t.stage.includes("on_route")).reduce((s, t) => s + t.minutes, 0);
  const loadingMinutes = timeBreakdown.filter((t) => t.stage === "loading").reduce((s, t) => s + t.minutes, 0);
  const unloadingMinutes = timeBreakdown.filter((t) => t.stage === "unloading").reduce((s, t) => s + t.minutes, 0);

  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  };

  const stopsMade = checkpoints.filter((c) => c?.status?.includes("arrived")).length;

  let kmTravelled: number | null = null;
  if (session?.id) {
    const { data: locUpdates } = await admin
      .from("location_updates")
      .select("lat, lng")
      .eq("session_id", session.id)
      .order("timestamp", { ascending: true });
    if (locUpdates && locUpdates.length >= 2) {
      kmTravelled = 0;
      for (let i = 0; i < locUpdates.length - 1; i++) {
        const a = locUpdates[i];
        const b = locUpdates[i + 1];
        if (a?.lat != null && a?.lng != null && b?.lat != null && b?.lng != null) {
          kmTravelled += haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
        }
      }
    }
    if (kmTravelled === 0) kmTravelled = null;
  }
  if (kmTravelled == null && checkpoints.length >= 2) {
    const pointsWithLoc = checkpoints
      .filter((c): c is { status: string; timestamp: string; lat: number; lng: number } =>
        c != null && typeof (c as { lat?: number }).lat === "number" && typeof (c as { lng?: number }).lng === "number"
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (pointsWithLoc.length >= 2) {
      kmTravelled = 0;
      for (let i = 0; i < pointsWithLoc.length - 1; i++) {
        kmTravelled += haversineKm(
          { lat: pointsWithLoc[i].lat, lng: pointsWithLoc[i].lng },
          { lat: pointsWithLoc[i + 1].lat, lng: pointsWithLoc[i + 1].lng }
        );
      }
    }
  }
  if (kmTravelled == null && job.fromAddress && job.toAddress) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
        url.searchParams.set("origins", job.fromAddress);
        url.searchParams.set("destinations", job.toAddress);
        url.searchParams.set("units", "metric");
        url.searchParams.set("mode", "driving");
        url.searchParams.set("key", apiKey);
        const res = await fetch(url.toString(), { next: { revalidate: 0 } });
        const data = await res.json();
        const value = data.rows?.[0]?.elements?.[0]?.distance?.value;
        if (typeof value === "number") kmTravelled = value / 1000;
      } catch {
        // ignore
      }
    }
  }

  const [
    { data: signOffRow },
    { count: photosCount },
    { data: incidents },
  ] = await Promise.all([
    admin.from("client_sign_offs").select("satisfaction_rating, signed_by, signed_at").eq("job_id", entityId).eq("job_type", jobType).maybeSingle(),
    admin.from("job_photos").select("*", { count: "exact", head: true }).eq("job_id", entityId),
    admin.from("incidents").select("id, issue_type, description, created_at").eq("job_id", entityId).eq("job_type", jobType).order("created_at", { ascending: false }).limit(5),
  ]);
  const signOff = signOffRow ? { rating: signOffRow.satisfaction_rating, signedBy: signOffRow.signed_by, signedAt: signOffRow.signed_at } : null;

  return NextResponse.json({
    job,
    signOff,
    session: session ? { startedAt: session.started_at, completedAt: session.completed_at } : null,
    timeBreakdown,
    summary: { totalMinutes, driveMinutes, loadingMinutes, unloadingMinutes },
    checkpoints,
    photosCount: photosCount ?? 0,
    incidents: incidents ?? [],
    kmTravelled: kmTravelled ?? null,
    stopsMade,
  });
}
