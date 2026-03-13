import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: project, error: dbErr } = await db
    .from("projects")
    .select("id, project_number, project_name, description, end_client_name, site_address, status, active_phase, start_date, target_end_date, estimated_budget, created_at")
    .eq("id", id)
    .in("partner_id", orgIds)
    .single();

  if (dbErr || !project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: phases }, { data: inventory }, { data: timeline }, { data: deliveries }] = await Promise.all([
    db.from("project_phases").select("id, phase_name, phase_order, status, scheduled_date, completed_date, description").eq("project_id", id).order("phase_order"),
    db.from("project_inventory").select("id, phase_id, item_name, vendor, quantity, status, received_date, condition_on_receipt, inspection_notes, photo_urls, storage_location, handled_by, vendor_tracking_number, vendor_carrier, expected_delivery_date").eq("project_id", id).order("created_at"),
    db.from("project_timeline").select("id, event_type, event_description, phase_id, photos, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    db.from("deliveries").select("id, delivery_number, status, scheduled_date, time_slot, total_price, items, phase_id").eq("project_id", id).order("scheduled_date"),
  ]);

  return NextResponse.json({
    ...project,
    phases: phases || [],
    inventory: inventory || [],
    timeline: timeline || [],
    deliveries: deliveries || [],
  });
}
