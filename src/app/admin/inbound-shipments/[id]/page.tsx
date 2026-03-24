export const metadata = { title: "Inbound Shipment" };
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTrackToken } from "@/lib/track-token";
import InboundShipmentDetailClient from "./InboundShipmentDetailClient";

export default async function InboundShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: shipment } = await db.from("inbound_shipments").select("*").eq("id", id).single();
  if (!shipment) notFound();

  const token = signTrackToken("inbound_shipment", id);

  return <InboundShipmentDetailClient shipmentId={id} initialShipment={shipment} publicTrackToken={token} />;
}
