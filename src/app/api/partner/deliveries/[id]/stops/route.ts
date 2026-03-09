import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { isUuid } from "@/lib/move-code";

/** Partner-scoped delivery stops (for day-rate bookings). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();

  const byUuid = isUuid(slug);
  const { data: delivery } = byUuid
    ? await admin.from("deliveries").select("id, organization_id").eq("id", slug).single()
    : await admin.from("deliveries").select("id, organization_id").ilike("delivery_number", slug).single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (!delivery.organization_id || !orgIds.includes(delivery.organization_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: stops } = await admin
    .from("delivery_stops")
    .select("id, stop_number, address, customer_name, customer_phone, items_description, special_instructions")
    .eq("delivery_id", delivery.id)
    .order("stop_number");

  return NextResponse.json({ stops: stops ?? [] });
}
