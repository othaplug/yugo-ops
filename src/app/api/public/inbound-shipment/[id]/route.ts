import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { INBOUND_SHIPMENT_STATUS_LABELS, INBOUND_SERVICE_LEVEL_LABELS } from "@/lib/inbound-shipment-labels";

export const dynamic = "force-dynamic";

/** Public read for carrier / non-partner tracking (token required). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("inbound_shipment", id, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: shipment, error } = await db.from("inbound_shipments").select("*").eq("id", id).single();
  if (error || !shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: log } = await db
    .from("shipment_status_log")
    .select("id, status, notes, created_at")
    .eq("shipment_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    shipment: {
      ...shipment,
      status_label: INBOUND_SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status,
      service_level_label: INBOUND_SERVICE_LEVEL_LABELS[shipment.service_level] ?? shipment.service_level,
    },
    log: log || [],
  });
}
