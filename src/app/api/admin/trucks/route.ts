import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { fleetVehicleToTruckListRow } from "@/lib/fleet-vehicle-label";

async function requireTrucksAdmin() {
  const { user, error: authError } = await requireAuth();
  if (authError) return { user: null, error: authError };
  const db = createAdminClient();
  const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin =
    isSuperAdminEmail(user.email) || ["owner", "admin", "manager"].includes(platformUser?.role || "");
  if (!isAdmin) return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, error: null };
}

function uniqueQuickPlate(): string {
  const part = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `Q-${part}`;
}

/** GET: List vehicles for iPad setup (fleet_vehicles; ids are used as truck_id on devices) */
export async function GET() {
  const { error } = await requireTrucksAdmin();
  if (error) return error;

  const db = createAdminClient();
  const { data, error: qErr } = await db
    .from("fleet_vehicles")
    .select("id, display_name, license_plate, phone, created_at")
    .order("display_name");
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  const rows = (data || []).map((row) =>
    fleetVehicleToTruckListRow({
      id: row.id,
      display_name: row.display_name,
      license_plate: row.license_plate,
      phone: row.phone,
    }),
  );
  return NextResponse.json(rows);
}

/** POST: Quick-add a fleet row for tablet binding (prefer full Fleet Vehicles form for real trucks) */
export async function POST(req: NextRequest) {
  try {
    const { error: authErr } = await requireTrucksAdmin();
    if (authErr) return authErr;

    const body = await req.json();
    const name = (body.name || "").toString().trim();
    if (!name) return NextResponse.json({ error: "Truck name required" }, { status: 400 });

    const db = createAdminClient();
    let plate = uniqueQuickPlate();
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: inserted, error } = await db
        .from("fleet_vehicles")
        .insert({
          vehicle_type: "sprinter",
          license_plate: plate,
          display_name: name,
          capacity_cuft: 0,
          capacity_lbs: 0,
          current_mileage: 0,
          status: "active",
        })
        .select("id, display_name, license_plate, phone, created_at")
        .single();

      if (!error && inserted) {
        return NextResponse.json(
          fleetVehicleToTruckListRow({
            id: inserted.id,
            display_name: inserted.display_name,
            license_plate: inserted.license_plate,
            phone: inserted.phone,
          }),
        );
      }
      if (error?.code === "23505") {
        plate = uniqueQuickPlate();
        continue;
      }
      return NextResponse.json({ error: error?.message || "Failed to create" }, { status: 500 });
    }
    return NextResponse.json({ error: "Could not allocate a unique plate" }, { status: 500 });
  } catch (e) {
    console.error("[trucks] error:", e);
    return NextResponse.json({ error: "Failed to create truck" }, { status: 500 });
  }
}

/** PATCH: Update fleet vehicle display label (name) and/or phone */
export async function PATCH(req: NextRequest) {
  try {
    const { error: authErr } = await requireTrucksAdmin();
    if (authErr) return authErr;

    const body = await req.json();
    const id = (body.id || body.truckId || "").toString().trim();
    const name = (body.name || "").toString().trim();
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
    if (!id) return NextResponse.json({ error: "Truck id required" }, { status: 400 });
    const updates: { display_name?: string; phone?: string | null; updated_at?: string } = {};
    if (name !== undefined && name !== "") updates.display_name = name;
    if (phone !== undefined) updates.phone = phone;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates (name or phone)" }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const db = createAdminClient();
    const { data, error } = await db
      .from("fleet_vehicles")
      .update(updates)
      .eq("id", id)
      .select("id, display_name, license_plate, phone, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(
      fleetVehicleToTruckListRow({
        id: data.id,
        display_name: data.display_name,
        license_plate: data.license_plate,
        phone: data.phone,
      }),
    );
  } catch (e) {
    console.error("[trucks] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update truck" }, { status: 500 });
  }
}

/** DELETE: Remove fleet vehicle (blocked by jobs / FKs if still referenced) */
export async function DELETE(req: NextRequest) {
  try {
    const { error: authErr } = await requireTrucksAdmin();
    if (authErr) return authErr;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Truck id required" }, { status: 400 });

    const db = createAdminClient();
    const { error } = await db.from("fleet_vehicles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[trucks] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete truck" }, { status: 500 });
  }
}
