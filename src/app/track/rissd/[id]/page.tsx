import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken, signTrackToken } from "@/lib/track-token";
import RissdCustomerTrackClient from "./RissdCustomerTrackClient";

export const metadata: Metadata = {
  title: "Your delivery",
  robots: "noindex, nofollow",
};
export const dynamic = "force-dynamic";

export default async function RissdCustomerTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token || !verifyTrackToken("inbound_shipment", id, token)) notFound();

  const db = createAdminClient();
  const { data: shipment } = await db.from("inbound_shipments").select("*").eq("id", id).single();
  if (!shipment) notFound();

  if (shipment.delivery_id) {
    const dt = signTrackToken("delivery", shipment.delivery_id);
    redirect(`/track/delivery/${shipment.delivery_id}?token=${encodeURIComponent(dt)}`);
  }

  return <RissdCustomerTrackClient shipment={shipment} />;
}
