import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import B2BDeliveryTrackClient from "./B2BDeliveryTrackClient";

export const metadata: Metadata = {
  title: "Track your delivery",
  robots: "noindex, nofollow",
};
export const dynamic = "force-dynamic";

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const data = await res.json();
    const feat = data?.features?.[0];
    if (feat?.center) return { lng: feat.center[0], lat: feat.center[1] };
  } catch {}
  return null;
}

export default async function B2BDeliveryTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const raw = decodeURIComponent((await params).token?.trim() || "");
  if (!raw) notFound();

  const supabase = createAdminClient();
  const { data: byPrimary } = await supabase
    .from("deliveries")
    .select("*")
    .eq("tracking_token", raw)
    .maybeSingle();
  const { data: byRecipient } = !byPrimary
    ? await supabase.from("deliveries").select("*").eq("recipient_tracking_token", raw).maybeSingle()
    : { data: null };
  const delivery = byPrimary || byRecipient;
  if (!delivery) notFound();

  const audience =
    delivery.recipient_tracking_token === raw ? ("recipient" as const) : ("business" as const);

  if (!delivery.tracking_token) notFound();

  const sessionToken =
    audience === "recipient" && delivery.recipient_tracking_token
      ? delivery.recipient_tracking_token
      : delivery.tracking_token;

  const pickupAddr = delivery.pickup_address || delivery.from_address;
  const dropoffAddr = delivery.delivery_address || delivery.to_address;

  const [{ data: pod }, reviewCfg] = await Promise.all([
    supabase
      .from("proof_of_delivery")
      .select("photos_delivery, signature_data")
      .eq("delivery_id", delivery.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("platform_config").select("value").eq("key", "google_review_url").maybeSingle(),
  ]);

  const podPhotos = (pod?.photos_delivery as { url?: string }[] | undefined) || [];
  const podImageUrl =
    podPhotos[0]?.url ||
    (typeof pod?.signature_data === "string" && pod.signature_data.startsWith("http")
      ? pod.signature_data
      : null);

  const [[pickupCoords, dropoffCoords], googleReviewUrl] = await Promise.all([
    Promise.all([
      pickupAddr ? geocode(pickupAddr) : null,
      dropoffAddr ? geocode(dropoffAddr) : null,
    ]),
    Promise.resolve(reviewCfg.data?.value || null),
  ]);

  return (
    <B2BDeliveryTrackClient
      delivery={delivery}
      token={sessionToken}
      audience={audience}
      coBrandName={(delivery.business_name || "").trim() || null}
      initialPickup={pickupCoords}
      initialDropoff={dropoffCoords}
      googleReviewUrl={googleReviewUrl}
      podImageUrl={podImageUrl}
    />
  );
}
