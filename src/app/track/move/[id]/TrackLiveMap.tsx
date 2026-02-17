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

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith("pk.your-") || MAPBOX_TOKEN === "pk.your-mapbox-token") {
    return (
      <div className="rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] h-[320px] flex flex-col items-center justify-center gap-2 px-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#E7E5E4]">
          <svg className="w-6 h-6 text-[#999]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-[#1A1A1A]">Live tracking map</p>
        <p className="text-[11px] text-[#666] text-center max-w-[240px]">
          Add <code className="bg-white px-1.5 py-0.5 rounded text-[10px]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to .env.local to enable.
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
