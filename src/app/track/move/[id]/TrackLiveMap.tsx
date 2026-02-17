"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapboxMap = dynamic(
  () =>
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;
      return function MapWithControls({
        center,
        crew,
        crewName,
        token,
      }: {
        center: { longitude: number; latitude: number };
        crew: { current_lat: number; current_lng: number; name?: string } | null;
        crewName?: string;
        token: string;
      }) {
        const hasPosition = crew != null;
        return (
          <M
            mapboxAccessToken={token}
            initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/light-v11"
          >
            {hasPosition && crew && (
              <Marker longitude={crew.current_lng} latitude={crew.current_lat} anchor="center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-bold text-white shadow-lg border-2 border-white"
                  style={{
                    background: "linear-gradient(135deg, #C9A962, #8B7332)",
                  }}
                >
                  {(crewName || crew?.name || "?").replace("Team ", "").slice(0, 1).toUpperCase()}
                </div>
              </Marker>
            )}
            <Nav position="bottom-right" showCompass showZoom />
          </M>
        );
      };
    }),
  { ssr: false }
);

const DEFAULT_CENTER = { longitude: -79.385, latitude: 43.665 };
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function TrackLiveMap({
  moveId,
  token,
}: {
  moveId: string;
  token: string;
}) {
  const [crew, setCrew] = useState<{ current_lat: number; current_lng: number; name: string } | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
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
          setCenter({ latitude: data.center.lat, longitude: data.center.lng });
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

  if (!MAPBOX_TOKEN) {
    return (
      <div className="rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] h-[320px] flex items-center justify-center">
        <p className="text-[12px] text-[#666]">
          Map unavailable. Add <code className="bg-white px-1 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to enable.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#E7E5E4] overflow-hidden h-[320px]">
      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-[#FAFAF8] text-[#666] text-[12px]">
          Loading map...
        </div>
      ) : (
        <MapboxMap
          token={MAPBOX_TOKEN}
          center={center}
          crew={crew}
          crewName={crew?.name}
        />
      )}
    </div>
  );
}
