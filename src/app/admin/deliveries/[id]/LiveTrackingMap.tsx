"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";

const MapboxMap = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => {
    const M = mod.default;
    const Marker = mod.Marker;
    const Nav = mod.NavigationControl;
    return function MapWithControls({
      center,
      hasPosition,
      crew,
      crewName,
      token,
      mapStyle,
    }: {
      center: { longitude: number; latitude: number };
      hasPosition: boolean;
      crew: { current_lat: number; current_lng: number; name?: string } | null;
      crewName?: string;
      token: string;
      mapStyle: string;
    }) {
      return (
        <M
          mapboxAccessToken={token}
          initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
        >
          {hasPosition && crew && (
            <Marker longitude={crew.current_lng} latitude={crew.current_lat} anchor="center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #C9A962, #8B7332)",
                  border: "2px solid white",
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

interface Crew {
  id: string;
  name: string;
  current_lat: number | null;
  current_lng: number | null;
}

export default function LiveTrackingMap({ crewId, crewName }: { crewId: string; crewName?: string }) {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const mapStyle = "mapbox://styles/mapbox/dark-v11";

  // Initial fetch + realtime subscription
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("crews")
        .select("id, name, current_lat, current_lng")
        .eq("id", crewId)
        .single();

      if (!error && data) setCrew(data);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`crew-${crewId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crews", filter: `id=eq.${crewId}` },
        (payload) => {
          const row = payload.new as Crew;
          if (row) setCrew(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewId]);

  const hasPosition = crew?.current_lat != null && crew?.current_lng != null;
  const center = hasPosition
    ? { longitude: crew!.current_lng!, latitude: crew!.current_lat! }
    : DEFAULT_CENTER;

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith("pk.your-") || MAPBOX_TOKEN === "pk.your-mapbox-token") {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-2">Live Crew Tracking</h3>
        <p className="text-[12px] text-[var(--tx3)]">
          Add <code className="bg-[var(--bg)] px-1 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to your environment to enable the map.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-2">Live Crew Tracking</h3>
      <p className="text-[11px] text-[var(--tx3)] mb-3">
        {crewName || crew?.name || "Crew"} • {hasPosition ? "Live position updating" : "Waiting for GPS..."}
      </p>
      <div className="rounded-lg border border-[var(--brd)] overflow-hidden" style={{ height: 320 }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-[var(--bg)] text-[var(--tx3)] text-[12px]">
            Loading map...
          </div>
        ) : (
          <MapboxMap
            token={MAPBOX_TOKEN}
            center={center}
            hasPosition={hasPosition}
            crew={hasPosition && crew && crew.current_lat != null && crew.current_lng != null
              ? { current_lat: crew.current_lat, current_lng: crew.current_lng, name: crew.name }
              : null}
            crewName={crewName}
            mapStyle={mapStyle}
          />
        )}
      </div>
    </div>
  );
}
