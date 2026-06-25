import OutboundShipmentDetailClient from "./OutboundShipmentDetailClient";

export const dynamic = "force-dynamic";

export default async function OutboundShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OutboundShipmentDetailClient id={id} />;
}
