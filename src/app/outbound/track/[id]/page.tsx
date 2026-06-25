import { notFound } from "next/navigation";
import { headers } from "next/headers";
import OutboundTrackingClient from "./OutboundTrackingClient";

export const dynamic = "force-dynamic";

async function fetchShipment(id: string, token: string) {
  const h = await headers();
  const host = h.get("host") || "yugoplus.co";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(
    `${proto}://${host}/api/track/outbound-shipments/${id}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function OutboundTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();
  const data = await fetchShipment(id, token);
  if (!data?.shipment) notFound();
  return <OutboundTrackingClient data={data} />;
}
