"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

const LiveTrackingMapLeaflet = dynamic(
  () => import("./LiveTrackingMapLeaflet").then((mod) => mod.LiveTrackingMapLeaflet),
  { ssr: false }
);

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
      destination,
    }: {
      center: { longitude: number; latitude: number };
      hasPosition: boolean;
      crew: { current_lat: number; current_lng: number; name?: string } | null;
      crewName?: string;
      token: string;
      mapStyle: string;
      destination?: { lat: number; lng: number };
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
              <div className="truck-marker-animated" style={{ width: 44, height: 44 }}>
                <img src="/crew-car.png" alt="" width={44} height={44} className="block drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
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
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

interface Crew {
  id: string;
  name: string;
  current_lat: number | null;
  current_lng: number | null;
}

export default function LiveTrackingMap({
  crewId,
  crewName,
  destination,
  moveId,
}: {
  crewId: string;
  crewName?: string;
  /** Optional destination for route line / bounds (e.g. move to_address) */
  destination?: { lat: number; lng: number };
  /** Optional move ID for move detail: fetches crew status and shows status card overlay */
  moveId?: string;
}) {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const supabase = createClient();
  const mapStyle = "mapbox://styles/mapbox/dark-v11";

  // Initial fetch + realtime subscription for crew position
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

  // Fetch and subscribe to live stage when moveId provided (admin move detail)
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!moveId) return;

    const subscribeIfNeeded = (sessionId: string) => {
      if (!sessionId || subscribedSessionIdRef.current === sessionId) return;
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      subscribedSessionIdRef.current = sessionId;
      const ch = supabase
        .channel(`tracking-session-${sessionId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "tracking_sessions", filter: `id=eq.${sessionId}` },
          (payload) => {
            const row = payload.new as { status?: string };
            if (row?.status) setLiveStage(row.status);
          }
        )
        .subscribe();
      sessionChannelRef.current = ch;
    };

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/moves/${moveId}/crew-status`);
        const data = await res.json();
        if (data?.liveStage != null) setLiveStage(data.liveStage);
        if (data?.sessionId) subscribeIfNeeded(data.sessionId);
      } catch {
        // ignore
      }
    };

    load();
    const pollId = setInterval(load, 5000);

    return () => {
      clearInterval(pollId);
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      subscribedSessionIdRef.current = null;
    };
  }, [moveId]);

  const hasPosition = crew?.current_lat != null && crew?.current_lng != null;
  const center = hasPosition
    ? { longitude: crew!.current_lng!, latitude: crew!.current_lat! }
    : DEFAULT_CENTER;

  if (!HAS_MAPBOX) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-2">Live Crew Tracking</h3>
        <p className="text-[11px] text-[var(--tx3)] mb-3">
          {crewName || crew?.name || "Crew"} • {hasPosition ? "Live position updating" : "Waiting for GPS..."}
        </p>
        <div className="relative rounded-lg border border-[var(--brd)] overflow-hidden" style={{ height: 320 }}>
          {liveStage && (
            <div className="absolute top-3 left-3 z-10 rounded-lg border border-[var(--brd)] bg-[var(--card)] px-4 py-3 shadow-md flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
              </span>
              <div>
                <div className="text-[13px] font-bold text-[var(--tx)]">
                  {CREW_STATUS_TO_LABEL[liveStage] || liveStage.replace(/_/g, " ")}
                </div>
                <div className="text-[11px] text-[var(--tx3)]">
                  {liveStage === "loading"
                    ? "Crew is loading items"
                    : liveStage === "unloading"
                      ? "Crew is unloading items"
                      : liveStage === "completed"
                        ? "Move is complete"
                        : "Crew is on the way"}
                </div>
              </div>
            </div>
          )}
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-[var(--bg)] text-[var(--tx3)] text-[12px]">
              Loading map...
            </div>
          ) : (
            <LiveTrackingMapLeaflet
              center={center}
              crew={hasPosition && crew && crew.current_lat != null && crew.current_lng != null
                ? { current_lat: crew.current_lat, current_lng: crew.current_lng, name: crew.name }
                : null}
              crewName={crewName}
              destination={destination}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-2">Live Crew Tracking</h3>
      <p className="text-[11px] text-[var(--tx3)] mb-3">
        {crewName || crew?.name || "Crew"} • {hasPosition ? "Live position updating" : "Waiting for GPS..."}
      </p>
      <div className="relative rounded-lg border border-[var(--brd)] overflow-hidden" style={{ height: 320 }}>
        {liveStage && (
          <div className="absolute top-3 left-3 z-10 rounded-lg border border-[var(--brd)] bg-[var(--card)] px-4 py-3 shadow-md flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
            </span>
            <div>
              <div className="text-[13px] font-bold text-[var(--tx)]">
                {CREW_STATUS_TO_LABEL[liveStage] || liveStage.replace(/_/g, " ")}
              </div>
              <div className="text-[11px] text-[var(--tx3)]">
                {liveStage === "loading"
                  ? "Crew is loading items"
                  : liveStage === "unloading"
                    ? "Crew is unloading items"
                    : liveStage === "completed"
                      ? "Move is complete"
                      : "Crew is on the way"}
              </div>
            </div>
          </div>
        )}
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
            destination={destination ?? undefined}
          />
        )}
      </div>
    </div>
  );
}
