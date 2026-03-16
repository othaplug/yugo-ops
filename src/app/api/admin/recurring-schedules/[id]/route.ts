import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "schedule_name", "frequency", "days_of_week", "booking_type",
    "vehicle_type", "day_type", "default_num_stops", "default_services",
    "time_window", "default_pickup_address", "is_active", "is_paused",
    "next_generation_date", "crew_id",
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }

  const admin = createAdminClient();
  const { data, error: dbError } = await admin
    .from("recurring_delivery_schedules")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const admin = createAdminClient();
  const { error: dbError } = await admin
    .from("recurring_delivery_schedules")
    .delete()
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
