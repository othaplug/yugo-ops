import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET active sessions with full job + crew details for map. Admin only. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: sessions } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, status, last_location, updated_at, team_id, crew_lead_id")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (!sessions?.length) {
    return NextResponse.json({ sessions: [], markers: [] });
  }

  const teamIds = [...new Set(sessions.map((s) => s.team_id))];
  const { data: crews } = await admin.from("crews").select("id, name").in("id", teamIds);
  const teamMap = new Map((crews || []).map((c) => [c.id, c.name]));

  const moveIds = sessions.filter((s) => s.job_type === "move").map((s) => s.job_id);
  const deliveryIds = sessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id);

  const { data: moves } = moveIds.length
    ? await admin.from("moves").select("id, client_name, move_code, to_address, from_address, to_lat, to_lng, from_lat, from_lng").in("id", moveIds)
    : { data: [] };
  const { data: deliveries } = deliveryIds.length
    ? await admin.from("deliveries").select("id, customer_name, client_name, delivery_number, delivery_address, pickup_address").in("id", deliveryIds)
    : { data: [] };

  const moveMap = new Map((moves || []).map((m) => [m.id, m]));
  const deliveryMap = new Map((deliveries || []).map((d) => [d.id, d]));

  const markers: { id: string; lat: number; lng: number; name: string; jobName: string; jobId: string; status: string; updatedAt: string }[] = [];

  for (const s of sessions) {
    const job = s.job_type === "move" ? moveMap.get(s.job_id) : deliveryMap.get(s.job_id);
    const jobName = job
      ? (s.job_type === "move" ? (job as any).client_name : `${(job as any).customer_name} (${(job as any).client_name})`)
      : "—";
    const jobId = job
      ? (s.job_type === "move" ? (job as any).move_code : (job as any).delivery_number)
      : s.job_id;
    const teamName = teamMap.get(s.team_id) || "Crew";
    const loc = s.last_location as { lat?: number; lng?: number } | null;
    if (loc?.lat != null && loc?.lng != null) {
      markers.push({
        id: s.id,
        lat: loc.lat,
        lng: loc.lng,
        name: teamName,
        jobName,
        jobId,
        status: s.status,
        updatedAt: s.updated_at || "",
      });
    }
  }

  const sessionsWithDetails = sessions.map((s) => {
    const job = s.job_type === "move" ? moveMap.get(s.job_id) : deliveryMap.get(s.job_id);
    const jobName = job
      ? (s.job_type === "move" ? (job as any).client_name : `${(job as any).customer_name} (${(job as any).client_name})`)
      : "—";
    const jobId = job
      ? (s.job_type === "move" ? (job as any).move_code : (job as any).delivery_number)
      : s.job_id;
    const toAddress = job ? (s.job_type === "move" ? (job as any).to_address : (job as any).delivery_address) : null;
    const loc = s.last_location as { lat?: number; lng?: number } | null;
    return {
      id: s.id,
      jobId,
      jobType: s.job_type,
      jobName,
      status: s.status,
      teamName: teamMap.get(s.team_id) || "—",
      lastLocation: loc,
      updatedAt: s.updated_at,
      toAddress,
      detailHref: s.job_type === "move" ? `/admin/moves/${jobId}` : `/admin/deliveries/${jobId}`,
    };
  });

  return NextResponse.json({ sessions: sessionsWithDetails, markers });
}
