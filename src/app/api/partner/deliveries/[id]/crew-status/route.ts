import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { isUuid } from "@/lib/move-code";

/** Partner-scoped crew status for a delivery. Returns liveStage, crew position. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();

  const byUuid = isUuid(slug);
  const { data: delivery } = byUuid
    ? await admin.from("deliveries").select("id, crew_id, stage, organization_id").eq("id", slug).single()
    : await admin.from("deliveries").select("id, crew_id, stage, organization_id").ilike("delivery_number", slug).single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (delivery.organization_id !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let crew: { current_lat: number; current_lng: number; name: string } | null = null;
  let liveStage: string | null = delivery.stage || null;

  const { data: ts } = await admin
    .from("tracking_sessions")
    .select("status, last_location, is_active")
    .eq("job_id", delivery.id)
    .eq("job_type", "delivery")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ts?.last_location && typeof ts.last_location === "object" && "lat" in ts.last_location && "lng" in ts.last_location) {
    const loc = ts.last_location as { lat: number; lng: number };
    crew = { current_lat: loc.lat, current_lng: loc.lng, name: "Crew" };
    liveStage = ts.status || liveStage;
  } else if (delivery.crew_id) {
    const { data: c } = await admin
      .from("crews")
      .select("current_lat, current_lng, name")
      .eq("id", delivery.crew_id)
      .single();
    if (c && c.current_lat != null && c.current_lng != null) {
      crew = { current_lat: c.current_lat, current_lng: c.current_lng, name: c.name || "Crew" };
    }
  }

  return NextResponse.json(
    { crew, liveStage, hasActiveTracking: !!ts?.is_active },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
