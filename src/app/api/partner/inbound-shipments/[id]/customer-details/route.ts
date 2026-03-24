import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendInboundShipmentLog } from "@/lib/inbound-shipment-service";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: partnerRows } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const orgId = partnerRows?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();
  const { data: row } = await db.from("inbound_shipments").select("id, organization_id, status").eq("id", id).single();
  if (!row || row.organization_id !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
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

  const patch: Record<string, unknown> = {
    customer_provided_at: new Date().toISOString(),
  };
  if (customer_name !== undefined) patch.customer_name = customer_name;
  if (customer_email !== undefined) patch.customer_email = customer_email;
  if (customer_phone !== undefined) patch.customer_phone = customer_phone;
  if (customer_address !== undefined) patch.customer_address = customer_address;
  if (customer_postal !== undefined) patch.customer_postal = customer_postal;
  if (customer_access !== undefined) patch.customer_access = customer_access;
  if (customer_notes !== undefined) patch.customer_notes = customer_notes;
  if (partner_resolution_choice !== undefined) patch.partner_resolution_choice = partner_resolution_choice;
  if (partner_resolution_notes !== undefined) patch.partner_resolution_notes = partner_resolution_notes;

  const { data: updated, error } = await db.from("inbound_shipments").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await appendInboundShipmentLog(db, id, row.status, {
    notes: "Partner updated customer or resolution details",
    createdBy: user.email ?? user.id,
  });

  return NextResponse.json({ shipment: updated });
}
