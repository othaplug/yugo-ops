import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLegalBranding } from "@/lib/legal-branding";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";
import TrackDeliveryClient from "./TrackDeliveryClient";
import { loadTrackDeliveryPublicData } from "@/lib/track-delivery-public-load";

export const metadata: Metadata = {
  title: "Track Your Delivery",
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

export default async function TrackDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const { token } = await searchParams;
  const supabase = createAdminClient();

  const byUuid = isUuid(slug);
  const { data: delivery, error } = byUuid
    ? await supabase.from("deliveries").select("*").eq("id", slug).single()
    : await supabase.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (error || !delivery) notFound();
  if (!verifyTrackToken("delivery", delivery.id, token || "")) notFound();

  const pickupAddr = delivery.pickup_address || delivery.from_address;
  const dropoffAddr = delivery.delivery_address || delivery.to_address;
  const totalStops = Number((delivery as { total_stops?: number }).total_stops) || 0;
  const isMultiStop =
    !!(delivery as { is_multi_stop?: boolean }).is_multi_stop || totalStops > 2;

  const [[pickupCoords, dropoffCoords], reviewCfg, { trackStops, routePlan }] =
    await Promise.all([
      Promise.all([
        pickupAddr ? geocode(pickupAddr) : null,
        dropoffAddr ? geocode(dropoffAddr) : null,
      ]),
      supabase
        .from("platform_config")
        .select("value")
        .eq("key", "google_review_url")
        .maybeSingle(),
      loadTrackDeliveryPublicData(supabase, delivery.id, isMultiStop, geocode),
    ]);

  const googleReviewUrl = reviewCfg.data?.value || null;

  const { email: companyContactEmail } = await getLegalBranding();

  return (
    <TrackDeliveryClient
      delivery={delivery}
      token={token || ""}
      initialPickup={pickupCoords}
      initialDropoff={dropoffCoords}
      googleReviewUrl={googleReviewUrl}
      companyContactEmail={companyContactEmail}
      trackStops={trackStops}
      routePlan={routePlan}
    />
  );
}
