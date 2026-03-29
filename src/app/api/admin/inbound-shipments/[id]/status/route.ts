import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendInboundShipmentLog } from "@/lib/inbound-shipment-service";
import { notifyInboundShipmentStakeholders } from "@/lib/inbound-shipment-notifications";

export const dynamic = "force-dynamic";

const VALID = new Set([
  "awaiting_shipment",
  "in_transit",
  "received",
  "inspecting",
  "inspection_failed",
  "stored",
  "customer_contacted",
  "delivery_scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
]);

function notifyKind(
  next: string,
  prev: string,
  patch: Record<string, unknown>,
): Parameters<typeof notifyInboundShipmentStakeholders>[1] | null {
  if (next === "in_transit" && prev !== "in_transit") return "in_transit";
  if (next === "stored") return "stored_good";
  if (next === "inspection_failed") return "inspection_damage";
  if (next === "customer_contacted" && prev !== "customer_contacted") return "customer_contacted";
  if (next === "delivery_scheduled" && prev !== "delivery_scheduled") return "delivery_scheduled";
  if (next === "out_for_delivery" && prev !== "out_for_delivery") return "out_for_delivery";
  if (next === "delivered" && prev !== "delivered") return "delivered";
  if (next === "completed" && prev !== "completed") return "completed";
  if (patch.received_at && next === "received") return null;
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr, user } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const body = await req.json();
  const { status, notes, photos } = body;
  if (!status || !VALID.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: cur, error: fetchErr } = await db.from("inbound_shipments").select("*").eq("id", id).single();
  if (fetchErr || !cur) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prev = cur.status;
  const patch: Record<string, unknown> = { status };

  if (status === "received") {
    patch.received_at = cur.received_at || new Date().toISOString();
    patch.received_by = body.received_by || user?.email || null;
  }
  if (status === "stored") {
    patch.inspection_status = body.inspection_status || "good";
    patch.storage_start_date = cur.storage_start_date || new Date().toISOString().slice(0, 10);
  }
  if (status === "inspection_failed") {
    patch.inspection_status = body.inspection_status || "damaged";
  }

  const { data: updated, error } = await db.from("inbound_shipments").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let shipmentRow = updated;
  if (status === "delivery_scheduled" && prev !== "delivery_scheduled" && !updated.delivery_id) {
    const { ensureDeliveryForInboundShipment } = await import("@/lib/inbound-shipment-delivery");
    await ensureDeliveryForInboundShipment(db, updated as Record<string, unknown>, 25);
    const { data: refetched } = await db.from("inbound_shipments").select("*").eq("id", id).single();
    if (refetched) shipmentRow = refetched;
  }

  await appendInboundShipmentLog(db, id, status, {
    notes: notes ?? null,
    photos: Array.isArray(photos) ? photos : [],
    createdBy: user?.email ?? user?.id ?? null,
  });

  const row = {
    id: shipmentRow.id,
    shipment_number: shipmentRow.shipment_number,
    organization_id: shipmentRow.organization_id,
    partner_name: shipmentRow.partner_name,
    partner_contact_email: shipmentRow.partner_contact_email,
    business_email: shipmentRow.business_email,
    business_name: shipmentRow.business_name,
    customer_name: shipmentRow.customer_name,
    customer_email: shipmentRow.customer_email,
    customer_phone: shipmentRow.customer_phone,
    customer_address: shipmentRow.customer_address,
    carrier_name: shipmentRow.carrier_name,
    carrier_tracking_number: shipmentRow.carrier_tracking_number,
    carrier_eta: shipmentRow.carrier_eta,
    items: shipmentRow.items,
    status: shipmentRow.status,
    inspection_notes: shipmentRow.inspection_notes,
    delivery_scheduled_date: shipmentRow.delivery_scheduled_date,
    delivery_window: shipmentRow.delivery_window,
  };

  const nk = notifyKind(status, prev, patch);
  if (nk) void notifyInboundShipmentStakeholders(row, nk);

  return NextResponse.json({ shipment: shipmentRow });
}
