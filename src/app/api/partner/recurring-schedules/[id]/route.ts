import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const supabase = await createClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("recurring_delivery_schedules")
    .select("id, organization_id")
    .eq("id", id)
    .single();

  if (!existing || !orgIds.includes(existing.organization_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = [
    "schedule_name", "frequency", "days_of_week", "booking_type",
    "vehicle_type", "day_type", "default_num_stops", "default_services",
    "time_window", "default_pickup_address", "is_active", "is_paused",
    "next_generation_date",
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }

  const { data, error: dbError } = await supabase
    .from("recurring_delivery_schedules")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("recurring_delivery_schedules")
    .select("id, organization_id")
    .eq("id", id)
    .single();

  if (!existing || !orgIds.includes(existing.organization_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: dbError } = await supabase
    .from("recurring_delivery_schedules")
    .delete()
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
