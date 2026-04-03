export const metadata = { title: "New Inbound Shipment" };
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import NewInboundShipmentClient from "./NewInboundShipmentClient";
import { getPartnerCategory } from "@/utils/partnerType";

export default async function NewInboundShipmentPage() {
  const db = createAdminClient();
  const { data: partners } = await db
    .from("organizations")
    .select("id, name, type, vertical, email, phone, contact_name")
    .not("type", "eq", "b2c")
    .order("name");

  const rissdPartners = (partners || []).filter(
    (p) =>
      getPartnerCategory({ vertical: p.vertical, type: p.type }) !==
      "property_management",
  );

  return <NewInboundShipmentClient partners={rissdPartners} />;
}
