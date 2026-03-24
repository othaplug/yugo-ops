export const metadata = { title: "Inbound Shipments" };
export const dynamic = "force-dynamic";

import InboundShipmentsClient from "./InboundShipmentsClient";

export default function AdminInboundShipmentsPage() {
  return <InboundShipmentsClient />;
}
