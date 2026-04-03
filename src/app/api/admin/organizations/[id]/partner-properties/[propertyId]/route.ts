import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; propertyId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id: partnerId, propertyId } = await params;
  const db = createAdminClient();
  const { data: org } = await db.from("organizations").select("id, vertical, type").eq("id", partnerId).single();
  if (!org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  const vertical = String((org as { vertical?: string; type?: string }).vertical || (org as { type?: string }).type || "");
  if (!isPropertyManagementDeliveryVertical(vertical)) {
    return NextResponse.json({ error: "Not a property management partner" }, { status: 400 });
  }

  const { data: existing } = await db
    .from("partner_properties")
    .select("id, partner_id")
    .eq("id", propertyId)
    .eq("partner_id", partnerId)
    .single();
  if (!existing) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.building_name === "string") updates.building_name = body.building_name.trim();
  if (typeof body.address === "string") updates.address = body.address.trim();
  if (typeof body.postal_code === "string") updates.postal_code = body.postal_code.trim() || null;
  if (body.total_units === null) updates.total_units = null;
  else if (typeof body.total_units === "number" && Number.isFinite(body.total_units)) updates.total_units = body.total_units;
  if (Array.isArray(body.unit_types)) {
    const ut = body.unit_types.filter((x: unknown) => typeof x === "string");
    updates.unit_types = ut.length ? ut : null;
  }
  if (typeof body.has_loading_dock === "boolean") updates.has_loading_dock = body.has_loading_dock;
  if (typeof body.has_move_elevator === "boolean") updates.has_move_elevator = body.has_move_elevator;
  if (typeof body.elevator_type === "string") updates.elevator_type = body.elevator_type.trim() || null;
  if (typeof body.move_hours === "string") {
    const mh = body.move_hours.trim();
    if (mh.toLowerCase() === "custom" && typeof body.custom_move_hours === "string" && body.custom_move_hours.trim()) {
      updates.move_hours = body.custom_move_hours.trim();
    } else {
      updates.move_hours = mh || null;
    }
  }
  if (typeof body.parking_type === "string") updates.parking_type = body.parking_type.trim() || null;
  if (typeof body.building_contact_name === "string") updates.building_contact_name = body.building_contact_name.trim() || null;
  if (typeof body.building_contact_phone === "string") updates.building_contact_phone = body.building_contact_phone.trim() || null;
  // Allow clearing notes: client sends JSON null or "" for empty field (typeof null !== "string")
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    if (body.notes == null || body.notes === "") updates.notes = null;
    else if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
  }
  if (typeof body.active === "boolean") updates.active = body.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (typeof updates.building_name === "string" && !updates.building_name) {
    return NextResponse.json({ error: "building_name cannot be empty" }, { status: 400 });
  }
  if (typeof updates.address === "string" && !updates.address) {
    return NextResponse.json({ error: "address cannot be empty" }, { status: 400 });
  }

  const { data, error } = await db.from("partner_properties").update(updates).eq("id", propertyId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ property: data });
}
