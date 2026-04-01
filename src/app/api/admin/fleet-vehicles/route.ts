import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET() {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("fleet_vehicles")
    .select("*, vehicle_maintenance_log(id, maintenance_date, maintenance_type, cost, notes)")
    .order("display_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const { vehicle_type, license_plate, display_name, capacity_cuft, capacity_lbs, current_mileage, status, default_team_id, notes, phone } = body;

  if (!vehicle_type || !license_plate) {
    return NextResponse.json({ error: "vehicle_type and license_plate required" }, { status: 400 });
  }

  const typeDefaults: Record<string, { cuft: number; lbs: number; name: string }> = {
    sprinter: { cuft: 370, lbs: 3500, name: "Sprinter Van" },
    "16ft": { cuft: 800, lbs: 5000, name: "16ft Box Truck" },
    "20ft": { cuft: 1100, lbs: 7000, name: "20ft Box Truck" },
    "24ft": { cuft: 1400, lbs: 10000, name: "24ft Box Truck" },
    "26ft": { cuft: 1700, lbs: 12000, name: "26ft Box Truck" },
  };
  const defaults = typeDefaults[vehicle_type] || { cuft: 0, lbs: 0, name: vehicle_type };

  const phoneNorm =
    typeof phone === "string" && phone.trim() !== "" ? phone.trim() : null;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("fleet_vehicles")
    .insert({
      vehicle_type,
      license_plate: license_plate.toUpperCase(),
      display_name: display_name || defaults.name,
      capacity_cuft: capacity_cuft ?? defaults.cuft,
      capacity_lbs: capacity_lbs ?? defaults.lbs,
      current_mileage: current_mileage ?? 0,
      status: status ?? "active",
      default_team_id: default_team_id || null,
      notes: notes || null,
      phone: phoneNorm,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A vehicle with that plate already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  updates.updated_at = new Date().toISOString();

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("fleet_vehicles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireRole("owner");
  if (authErr) return authErr;

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb.from("fleet_vehicles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
