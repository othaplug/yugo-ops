import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const body = await req.json();
  const { vehicle_id, maintenance_date, maintenance_type, cost, notes } = body;

  if (!vehicle_id || !maintenance_type) {
    return NextResponse.json({ error: "vehicle_id and maintenance_type required" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("vehicle_maintenance_log")
    .insert({
      vehicle_id,
      maintenance_date: maintenance_date || new Date().toISOString().split("T")[0],
      maintenance_type,
      cost: cost ?? 0,
      notes: notes || null,
      created_by: user!.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
