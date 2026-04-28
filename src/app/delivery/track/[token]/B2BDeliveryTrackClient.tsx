"use client";

import TrackDeliveryClient from "@/app/track/delivery/[id]/TrackDeliveryClient";
import { normalizeDeliveryItem } from "@/lib/delivery-items";
import type { TrackPublicStop, TrackRoutePlanPoint } from "@/lib/track-delivery-public";

function firstItemSummary(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const { name, qty } = normalizeDeliveryItem(items[0]);
  if (!name) return null;
  return qty > 1 ? `${name} ×${qty}` : name;
}

function flagsFromDelivery(d: Record<string, unknown>): { assembly: boolean; debris: boolean } {
  const hay = `${d.special_instructions || ""} ${d.instructions || ""} ${JSON.stringify(d.items || [])}`.toLowerCase();
  return {
    assembly: /\bassembl/.test(hay),
    debris: /\bdebri|debris|junk\s*removal|haul\s*away/.test(hay),
  };
}

export default function B2BDeliveryTrackClient({
  delivery,
  token,
  audience,
  coBrandName,
  initialPickup,
  initialDropoff,
  googleReviewUrl,
  podImageUrl,
  companyContactEmail,
  trackStops = null,
  routePlan = null,
}: {
  delivery: Record<string, unknown>;
  token: string;
  audience: "business" | "recipient";
  coBrandName: string | null;
  initialPickup?: { lat: number; lng: number } | null;
  initialDropoff?: { lat: number; lng: number } | null;
  googleReviewUrl?: string | null;
  podImageUrl?: string | null;
  companyContactEmail: string;
  trackStops?: TrackPublicStop[] | null;
  routePlan?: TrackRoutePlanPoint[] | null;
}) {
  const { assembly, debris } = flagsFromDelivery(delivery);
  const crewSize =
    typeof delivery.crew_count === "number"
      ? delivery.crew_count
      : typeof delivery.est_crew_size === "number"
        ? delivery.est_crew_size
        : typeof delivery.crew_size === "number"
          ? delivery.crew_size
          : null;

  const isMulti =
    Array.isArray(trackStops) && trackStops.length > 0;

  return (
    <TrackDeliveryClient
      delivery={delivery}
      token={token}
      initialPickup={initialPickup}
      initialDropoff={initialDropoff}
      googleReviewUrl={googleReviewUrl}
      companyContactEmail={companyContactEmail}
      b2bAudience={audience}
      b2bCoBrand={coBrandName}
      b2bPodImageUrl={podImageUrl || null}
      b2bItemSummary={
        isMulti && trackStops
          ? `Multi-stop route · ${trackStops.length} stops`
          : firstItemSummary(delivery.items)
      }
      b2bCrewSize={crewSize}
      b2bAssembly={assembly}
      b2bDebrisRemoval={debris}
      trackStops={trackStops}
      routePlan={routePlan}
    />
  );
}
