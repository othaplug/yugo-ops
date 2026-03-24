import { notFound } from "next/navigation";
import { Metadata } from "next";
import PublicInboundTrackClient from "./PublicInboundTrackClient";

export const metadata: Metadata = {
  title: "Shipment status",
  robots: "noindex, nofollow",
};
export const dynamic = "force-dynamic";

export default async function PublicInboundTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  return <PublicInboundTrackClient id={id} token={token} />;
}
