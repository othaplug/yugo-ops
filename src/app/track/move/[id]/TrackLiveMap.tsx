"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

type Center = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

const DEFAULT_CENTER: Center = { lat: 43.665, lng: -79.385 };

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

const MapboxMap = dynamic(
  () =>
    import("./TrackLiveMapMapbox").then((mod) => mod.TrackLiveMapMapbox),
  { ssr: false, loading: () => <MapLoading /> }
);

const LeafletMap = dynamic(
  () =>
    import("./TrackLiveMapLeaflet").then((mod) => mod.TrackLiveMapLeaflet),
  { ssr: false, loading: () => <MapLoading /> }
);

function MapLoading() {
  return (
    <div className="w-full h-full min-h-[320px] flex items-center justify-center bg-[#FAFAF8] text-[#666] text-[12px]">
      Loading map...
    </div>
  );
}

export default function TrackLiveMap({
  moveId,
  token,
}: {
  moveId: string;
  token: string;
}) {
  const [crew, setCrew] = useState<{ current_lat: number; current_lng: number; name: string } | null>(null);
  const [center, setCenter] = useState<Center>(DEFAULT_CENTER);
  const [pickup, setPickup] = useState<Center | null>(null);
  const [dropoff, setDropoff] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/track/moves/${moveId}/crew-status?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.crew) setCrew(data.crew);
        if (data.center?.lat != null && data.center?.lng != null) {
          setCenter({ lat: data.center.lat, lng: data.center.lng });
        }
        if (data.pickup?.lat != null && data.pickup?.lng != null) {
          setPickup({ lat: data.pickup.lat, lng: data.pickup.lng });
        } else {
          setPickup(null);
        }
        if (data.dropoff?.lat != null && data.dropoff?.lng != null) {
          setDropoff({ lat: data.dropoff.lat, lng: data.dropoff.lng });
        } else {
          setDropoff(null);
        }
      } catch {
        if (!cancelled) setCrew(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [moveId, token]);

  const mapCenter = { latitude: center.lat, longitude: center.lng };

  return (
    <div className="track-live-map-container rounded-xl overflow-hidden h-[320px] bg-[#FAFAF8] border border-[#E7E5E4] shadow-sm">
      {loading ? (
        <MapLoading />
      ) : HAS_MAPBOX && MAPBOX_TOKEN ? (
        <MapboxMap
          mapboxAccessToken={MAPBOX_TOKEN}
          center={mapCenter}
          crew={crew}
          crewName={crew?.name}
        />
      ) : (
        <LeafletMap center={center} crew={crew} pickup={pickup} dropoff={dropoff} />
      )}
    </div>
  );
}
