import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();
  const { data: shipment, error } = await db.from("inbound_shipments").select("*").eq("id", id).single();
  if (error || !shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: log } = await db
    .from("shipment_status_log")
    .select("*")
    .eq("shipment_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ shipment, log: log || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const body = await req.json();
  const db = createAdminClient();

  const allowed = [
    "carrier_name",
    "carrier_tracking_number",
    "carrier_eta",
    "items",
    "total_pieces",
    "customer_name",
    "customer_email",
    "customer_phone",
    "customer_address",
    "customer_postal",
    "customer_access",
    "customer_notes",
    "service_level",
    "requires_move_inside",
    "requires_assembly",
    "requires_unboxing",
    "requires_debris_removal",
    "requires_pod",
    "receiving_inspection_tier",
    "assembly_complexity",
    "special_instructions",
    "partner_issue_phone",
    "storage_location",
    "storage_start_date",
    "storage_days",
    "storage_fee_per_day",
    "storage_total",
    "delivery_scheduled_date",
    "delivery_window",
    "delivery_crew",
    "delivery_id",
    "delivery_price",
    "assembly_price",
    "storage_price",
    "receiving_fee",
    "total_price",
    "billing_method",
    "received_at",
    "received_by",
    "inspection_status",
    "inspection_notes",
    "inspection_photos",
    "inspection_items",
    "pod_captured",
    "pod_signature",
    "pod_photo_url",
    "pod_signed_at",
    "completed_at",
    "invoice_sent",
    "partner_resolution_choice",
    "partner_resolution_notes",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data: updated, error } = await db.from("inbound_shipments").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipment: updated });
}
