/**
 * GET   /api/admin/outbound-shipments/[id] — read a single shipment
 * PATCH /api/admin/outbound-shipments/[id] — partial update (mid-flow edits)
 * DELETE /api/admin/outbound-shipments/[id] — soft-cancel (only when status='draft')
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const EDITABLE_FIELDS = new Set<string>([
  // Partner
  "partner_id",
  "partner_name",
  "partner_contact_name",
  "partner_contact_email",
  "partner_contact_phone",
  "business_name",
  // Consignor
  "consignor_name",
  "consignor_email",
  "consignor_phone",
  "consignor_address",
  "consignor_postal",
  "consignor_access",
  "consignor_notes",
  // Items + service
  "items",
  "total_pieces",
  "declared_value",
  "requires_palletization",
  "requires_crating",
  "requires_assembly",
  "service_level",
  "special_instructions",
  // Pickup
  "scheduled_pickup_date",
  "scheduled_pickup_window",
  "pickup_arrived_at",
  "pickup_notes",
  "pickup_condition",
  "pickup_condition_notes",
  // Warehouse
  "storage_location",
  // Palletization
  "pallet_count",
  "pallet_dimensions",
  "pallet_weight_lb",
  "crating_method",
  // Carrier
  "carrier_name",
  "carrier_pro_number",
  "carrier_bol_number",
  "carrier_pickup_appointment_at",
  // Pricing
  "pickup_price",
  "palletization_price",
  "warehouse_intake_fee",
  "hold_days",
  "hold_price_total",
  "declared_value_fee",
  "subtotal",
  "tax_amount",
  "total_price",
  "billing_method",
  // Ops
  "assigned_crew_members",
  "internal_notes",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;

  const admin = createAdminClient();
  // Accept either UUID or shipment_number for convenience.
  const { data, error } = await admin
    .from("outbound_shipments")
    .select("*")
    .or(`id.eq.${id},shipment_number.eq.${id}`)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ shipment: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist filter: silently drop any client-supplied keys not in the
  // editable set. Stops `status`, `created_at`, `partner_tracking_token`
  // etc. from being clobbered via this route — those have dedicated
  // transition / regenerate endpoints.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE_FIELDS.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable fields supplied" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("outbound_shipments")
    .update(patch)
    .or(`id.eq.${id},shipment_number.eq.${id}`)
    .select("id, shipment_number, status")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || "Update failed" },
      { status: 500 },
    );
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "outbound_shipment_updated",
    resourceType: "outbound_shipment",
    resourceId: updated.id,
    details: { shipment_number: updated.shipment_number, fields: Object.keys(patch) },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;

  const admin = createAdminClient();
  // Refuse to delete once the shipment has moved past 'draft'. This avoids
  // losing operational history. Coordinators who need to cancel an active
  // shipment should use the transition endpoint to move it to 'cancelled'.
  const { data: row } = await admin
    .from("outbound_shipments")
    .select("id, status, shipment_number")
    .or(`id.eq.${id},shipment_number.eq.${id}`)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "draft") {
    return NextResponse.json(
      {
        error: `Cannot delete: shipment is '${row.status}'. Cancel it via the transition endpoint instead.`,
      },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("outbound_shipments")
    .delete()
    .eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "outbound_shipment_deleted",
    resourceType: "outbound_shipment",
    resourceId: row.id,
    details: { shipment_number: row.shipment_number },
  });
  return NextResponse.json({ ok: true });
}
