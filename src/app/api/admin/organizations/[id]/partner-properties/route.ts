import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id: partnerId } = await params;
  const db = createAdminClient();
  const { data: org } = await db.from("organizations").select("id, vertical, type").eq("id", partnerId).single();
  if (!org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  const vertical = String((org as { vertical?: string; type?: string }).vertical || (org as { type?: string }).type || "");
  if (!isPropertyManagementDeliveryVertical(vertical)) {
    return NextResponse.json({ error: "Not a property management partner" }, { status: 400 });
  }

  const body = await req.json();
  const building_name = typeof body.building_name === "string" ? body.building_name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!building_name || !address) {
    return NextResponse.json({ error: "building_name and address are required" }, { status: 400 });
  }

  const unit_types = Array.isArray(body.unit_types) ? body.unit_types.filter((x: unknown) => typeof x === "string") : null;
  const move_hours =
    String(body.move_hours || "").toLowerCase() === "custom" && typeof body.custom_move_hours === "string" && body.custom_move_hours.trim()
      ? body.custom_move_hours.trim()
      : typeof body.move_hours === "string"
        ? body.move_hours.trim() || null
        : null;

  const row = {
    partner_id: partnerId,
    building_name,
    address,
    postal_code: typeof body.postal_code === "string" ? body.postal_code.trim() || null : null,
    total_units: typeof body.total_units === "number" && Number.isFinite(body.total_units) ? body.total_units : null,
    unit_types: unit_types && unit_types.length ? unit_types : null,
    has_loading_dock: !!body.has_loading_dock,
    has_move_elevator: !!body.has_move_elevator,
    elevator_type: typeof body.elevator_type === "string" ? body.elevator_type.trim() || null : null,
    move_hours,
    parking_type: typeof body.parking_type === "string" ? body.parking_type.trim() || null : null,
    building_contact_name: typeof body.building_contact_name === "string" ? body.building_contact_name.trim() || null : null,
    building_contact_phone: typeof body.building_contact_phone === "string" ? body.building_contact_phone.trim() || null : null,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    active: true,
  };

  const { data, error } = await db.from("partner_properties").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ property: data });
}
