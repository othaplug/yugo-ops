import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function GET() {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, delivery_number, customer_name, status, delivery_address, crew_id")
    .eq("organization_id", orgId!)
    .not("status", "in", '("delivered","completed","cancelled")')
    .order("scheduled_date", { ascending: true });

  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ deliveries: [] });
  }

  const crewIds = [...new Set(deliveries.map((d) => d.crew_id).filter(Boolean))] as string[];

  let crewMap: Record<string, { name: string; current_lat: number | null; current_lng: number | null }> = {};
  if (crewIds.length > 0) {
    const { data: crews } = await admin
      .from("crews")
      .select("id, name, current_lat, current_lng")
      .in("id", crewIds);

    (crews || []).forEach((c) => {
      crewMap[c.id] = { name: c.name, current_lat: c.current_lat, current_lng: c.current_lng };
    });
  }

  const deliveryIds = deliveries.map((d) => d.id);
  let sessionMap: Record<string, { live_stage: string | null; dest_lat: number | null; dest_lng: number | null }> = {};
  if (deliveryIds.length > 0) {
    const { data: sessions } = await admin
      .from("tracking_sessions")
      .select("job_id, status, is_active")
      .in("job_id", deliveryIds)
      .eq("job_type", "delivery")
      .eq("is_active", true);

    (sessions || []).forEach((s) => {
      sessionMap[s.job_id] = { live_stage: s.status, dest_lat: null, dest_lng: null };
    });
  }

  const enriched = deliveries.map((d) => {
    const crew = d.crew_id ? crewMap[d.crew_id] : null;
    const session = sessionMap[d.id];
    return {
      id: d.id,
      delivery_number: d.delivery_number,
      customer_name: d.customer_name,
      status: d.status,
      delivery_address: d.delivery_address,
      crew_id: d.crew_id,
      crew_name: crew?.name || null,
      crew_lat: crew?.current_lat || null,
      crew_lng: crew?.current_lng || null,
      dest_lat: session?.dest_lat || null,
      dest_lng: session?.dest_lng || null,
      live_stage: session?.live_stage || null,
    };
  });

  return NextResponse.json({ deliveries: enriched });
}
