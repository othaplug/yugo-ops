import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "No organization linked" }, { status: 403 });

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("recurring_delivery_schedules")
    .select("*")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ schedules: data || [] });
}

export async function POST(req: NextRequest) {
  const { orgIds, userId, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "No organization linked" }, { status: 403 });

  const body = await req.json();
  const {
    organization_id,
    schedule_name,
    frequency,
    days_of_week,
    booking_type,
    vehicle_type,
    day_type,
    default_num_stops,
    default_services,
    time_window,
    default_pickup_address,
  } = body;

  if (!orgIds.includes(organization_id)) {
    return NextResponse.json({ error: "Unauthorized organization" }, { status: 403 });
  }
  if (!schedule_name?.trim()) return NextResponse.json({ error: "Schedule name is required" }, { status: 400 });
  if (!frequency) return NextResponse.json({ error: "Frequency is required" }, { status: 400 });
  if (!days_of_week?.length) return NextResponse.json({ error: "At least one day of week is required" }, { status: 400 });

  // Compute next generation date: find the next occurrence based on days_of_week
  const today = new Date();
  const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon … 7=Sun
  const sortedDays: number[] = [...days_of_week].sort((a, b) => a - b);
  let daysUntilNext = sortedDays.find((d) => d > todayDow);
  if (daysUntilNext == null) daysUntilNext = sortedDays[0] + 7;
  else daysUntilNext = daysUntilNext - todayDow;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("recurring_delivery_schedules")
    .insert({
      organization_id,
      schedule_name: schedule_name.trim(),
      frequency: frequency || "weekly",
      days_of_week: sortedDays,
      booking_type: booking_type || "day_rate",
      vehicle_type: vehicle_type || null,
      day_type: day_type || "full_day",
      default_num_stops: default_num_stops || null,
      default_services: default_services || [],
      time_window: time_window || "morning",
      default_pickup_address: default_pickup_address || null,
      is_active: true,
      is_paused: false,
      next_generation_date: nextDate.toISOString().slice(0, 10),
      created_by_source: "partner_portal",
      created_by_user: userId || null,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}
