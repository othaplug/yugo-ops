export const metadata = { title: "New Inbound Shipment" };
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import NewInboundShipmentClient from "./NewInboundShipmentClient";

export default async function NewInboundShipmentPage() {
  const db = createAdminClient();
  const { data: partners } = await db
    .from("organizations")
    .select("id, name, type, email, phone, contact_name")
    .not("type", "eq", "b2c")
    .order("name");

  return <NewInboundShipmentClient partners={partners || []} />;
}
