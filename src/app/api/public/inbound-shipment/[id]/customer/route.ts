import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { appendInboundShipmentLog } from "@/lib/inbound-shipment-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const token = (body.token as string) || "";
  if (!verifyTrackToken("inbound_shipment", id, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
  }

  const {
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    customer_postal,
    customer_access,
    customer_notes,
    partner_resolution_choice,
    partner_resolution_notes,
  } = body;

  if (!customer_name || !customer_email || !customer_phone || !customer_address) {
    return NextResponse.json(
      { error: "customer_name, customer_email, customer_phone, and customer_address are required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data: row } = await db.from("inbound_shipments").select("id, status").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: updated, error } = await db
    .from("inbound_shipments")
    .update({
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      customer_postal: customer_postal || null,
      customer_access: customer_access || null,
      customer_notes: customer_notes || null,
      customer_provided_at: new Date().toISOString(),
      partner_resolution_choice: partner_resolution_choice || null,
      partner_resolution_notes: partner_resolution_notes || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await appendInboundShipmentLog(db, id, row.status, {
    notes: "Customer details submitted via secure link",
    createdBy: "public_form",
  });

  return NextResponse.json({ ok: true, shipment: updated });
}
