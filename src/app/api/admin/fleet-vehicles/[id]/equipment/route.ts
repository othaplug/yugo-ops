import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

type LineIn = { equipment_id: string; assigned_quantity: number; current_quantity: number };

/** GET: truck equipment lines for a fleet vehicle */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id: truckId } = await params;
  if (!truckId) return NextResponse.json({ error: "truck id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: truck, error: tErr } = await admin
    .from("fleet_vehicles")
    .select("id")
    .eq("id", truckId)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!truck) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const { data: rows, error } = await admin
    .from("truck_equipment")
    .select(
      "id, equipment_id, assigned_quantity, current_quantity, last_checked, equipment_inventory(name, category, is_consumable)",
    )
    .eq("truck_id", truckId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ truckId, lines: rows ?? [] });
}

/**
 * PUT: replace all equipment lines for this truck (manager+).
 * Body: { lines: [{ equipment_id, assigned_quantity, current_quantity }] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const { id: truckId } = await params;
  if (!truckId) return NextResponse.json({ error: "truck id required" }, { status: 400 });

  const body = await req.json();
  const linesIn = Array.isArray(body.lines) ? body.lines : null;
  if (!linesIn) return NextResponse.json({ error: "lines array required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: truck, error: tErr } = await admin
    .from("fleet_vehicles")
    .select("id")
    .eq("id", truckId)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!truck) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const normalized: LineIn[] = [];
  const seen = new Set<string>();
  for (const row of linesIn) {
    const equipment_id = (row.equipment_id || "").toString().trim();
    if (!equipment_id || seen.has(equipment_id)) continue;
    seen.add(equipment_id);
    const assigned_quantity = Math.max(0, Math.floor(Number(row.assigned_quantity) || 0));
    const current_quantity = Math.max(0, Math.floor(Number(row.current_quantity) ?? assigned_quantity));
    normalized.push({ equipment_id, assigned_quantity, current_quantity });
  }

  const { error: delErr } = await admin.from("truck_equipment").delete().eq("truck_id", truckId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, truckId, count: 0 });
  }

  const inserts = normalized.map((L) => ({
    truck_id: truckId,
    equipment_id: L.equipment_id,
    assigned_quantity: L.assigned_quantity,
    current_quantity: L.current_quantity,
  }));

  const { error: insErr } = await admin.from("truck_equipment").insert(inserts);
  if (insErr) {
    if (insErr.code === "23503") {
      return NextResponse.json({ error: "Invalid equipment_id (not in catalog)" }, { status: 400 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, truckId, count: normalized.length });
}

/**
 * POST: seed truck from all active catalog items with default_quantity (manager+).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const { id: truckId } = await params;
  if (!truckId) return NextResponse.json({ error: "truck id required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  if (!body.seedFromDefaults) {
    return NextResponse.json({ error: "Use { seedFromDefaults: true }" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: truck, error: tErr } = await admin
    .from("fleet_vehicles")
    .select("id")
    .eq("id", truckId)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!truck) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const { data: inv, error: invErr } = await admin
    .from("equipment_inventory")
    .select("id, default_quantity")
    .eq("active", true);

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const { data: existing } = await admin.from("truck_equipment").select("equipment_id").eq("truck_id", truckId);

  const have = new Set((existing || []).map((r: { equipment_id: string }) => r.equipment_id));
  const inserts = (inv || [])
    .filter((e: { id: string }) => !have.has(e.id))
    .map((e: { id: string; default_quantity: number }) => ({
      truck_id: truckId,
      equipment_id: e.id,
      assigned_quantity: Math.max(0, Number(e.default_quantity) || 0),
      current_quantity: Math.max(0, Number(e.default_quantity) || 0),
    }));

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, truckId, added: 0, message: "Nothing to add — truck already has all active items." });
  }

  const { error: insErr } = await admin.from("truck_equipment").insert(inserts);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, truckId, added: inserts.length });
}
