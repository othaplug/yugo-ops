"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { useTheme } from "@/app/admin/components/ThemeContext";
import { toTitleCase } from "@/lib/format-text";

const LiveTrackingMapLeaflet = dynamic(
  () => import("./LiveTrackingMapLeaflet").then((mod) => mod.LiveTrackingMapLeaflet),
  { ssr: false }
);

/** GeoJSON LineString feature for the driving route */
type RouteGeoJson = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
} | null;

const MapboxMap = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => {
    const M = mod.default;
    const Marker = mod.Marker;
    const Nav = mod.NavigationControl;
    const Source = mod.Source;
    const Layer = mod.Layer;
    return function MapWithControls({
      center,
      hasPosition,
      crew,
      crewName,
      token,
      mapStyle,
      destination,
      routeLineColor,
      routeGeoJson,
    }: {
      center: { longitude: number; latitude: number };
      hasPosition: boolean;
      crew: { current_lat: number; current_lng: number; name?: string } | null;
      crewName?: string;
      token: string;
      mapStyle: string;
      destination?: { lat: number; lng: number };
      routeLineColor?: string;
      routeGeoJson?: RouteGeoJson;
    }) {
      const lineGeoJson = routeGeoJson ?? (hasPosition && crew && destination
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [crew.current_lng, crew.current_lat],
                [destination.lng, destination.lat],
              ] as [number, number][],
            },
          }
        : null);

      return (
        <M
          mapboxAccessToken={token}
          initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
        >
          {lineGeoJson && (
            <Source id="route-tracking" type="geojson" data={lineGeoJson}>
              <Layer
                id="route-tracking-layer"
                type="line"
                paint={{
                  "line-color": routeLineColor ?? "#8B5CF6",
                  "line-width": 5,
                  "line-opacity": 1,
                }}
              />
            </Source>
          )}
          {destination && (
            <Marker longitude={destination.lng} latitude={destination.lat} anchor="center">
              <div className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-[#22C55E]" />
            </Marker>
          )}
          {hasPosition && crew && (
            <Marker longitude={crew.current_lng} latitude={crew.current_lat} anchor="center">
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: routeLineColor ?? "#8B5CF6" }}
                title={crewName || crew.name || "Crew"}
              />
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
  deliveryId,
}: {
  crewId: string;
  crewName?: string;
  destination?: { lat: number; lng: number };
  moveId?: string;
  /** Delivery ID: checks for an active tracking session before showing GPS */
  deliveryId?: string;
}) {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [routeGeoJson, setRouteGeoJson] = useState<RouteGeoJson>(null);
  const [routePositions, setRoutePositions] = useState<[number, number][]>([]);
  const supabase = createClient();
  const { theme } = useTheme();
  const mapStyle = theme === "light"
    ? "mapbox://styles/mapbox/light-v11"
    : "mapbox://styles/mapbox/dark-v11";
  const routeLineColor = theme === "dark" ? "#C9A962" : "#8B5CF6";

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

  // Fetch and subscribe to live stage when moveId OR deliveryId provided
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedSessionIdRef = useRef<string | null>(null);
  const jobId = moveId || deliveryId;
  const jobApiPath = moveId
    ? `/api/admin/moves/${moveId}/crew-status`
    : deliveryId
      ? `/api/admin/deliveries/${deliveryId}/crew-status`
      : null;

  useEffect(() => {
    if (!jobApiPath) return;

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
            const row = payload.new as { status?: string; is_active?: boolean };
            if (row?.status) setLiveStage(row.status);
            if (row?.is_active != null) setHasActiveSession(row.is_active);
          }
        )
        .subscribe();
      sessionChannelRef.current = ch;
    };

    const load = async () => {
      try {
        const res = await fetch(jobApiPath);
        const data = await res.json();
        if (data?.liveStage != null) setLiveStage(data.liveStage);
        if (data?.sessionId) subscribeIfNeeded(data.sessionId);
        setHasActiveSession(!!data?.hasActiveTracking);
      } catch {
        // ignore
      }
    };

    load();
    const pollId = setInterval(load, 8000);

    return () => {
      clearInterval(pollId);
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      subscribedSessionIdRef.current = null;
    };
  }, [jobId, jobApiPath]);

  const hasPosition = crew?.current_lat != null && crew?.current_lng != null;
  const center = hasPosition
    ? { longitude: crew!.current_lng!, latitude: crew!.current_lat! }
    : DEFAULT_CENTER;

  // Fetch real driving route (roads, not straight line) when we have crew position and destination
  useEffect(() => {
    if (!hasPosition || !crew || !destination) {
      setRouteGeoJson(null);
      setRoutePositions([]);
      return;
    }
    const from = `${crew.current_lng},${crew.current_lat}`;
    const to = `${destination.lng},${destination.lat}`;
    fetch(`/api/mapbox/directions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((res) => res.json())
      .then((data) => {
        const coordsList = data?.coordinates;
        if (Array.isArray(coordsList) && coordsList.length > 0) {
          setRouteGeoJson({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coordsList },
          });
          setRoutePositions(coordsList.map((c: [number, number]) => [c[1], c[0]]));
        } else {
          setRouteGeoJson(null);
          setRoutePositions([]);
        }
      })
      .catch(() => {
        setRouteGeoJson(null);
        setRoutePositions([]);
      });
  }, [hasPosition, crew?.current_lat, crew?.current_lng, destination?.lat, destination?.lng]);

  const isDeliveryMode = !!deliveryId;
  const sessionActive = hasActiveSession === true;
  const gpsLive = hasPosition && sessionActive;

  if (isDeliveryMode && !sessionActive && !loading) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-[var(--gdim)] flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--tx3)]"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <p className="text-[12px] font-medium text-[var(--tx2)]">Crew assigned — waiting to start</p>
        <p className="text-[10px] text-[var(--tx3)] mt-1">
          Live tracking will activate when {crewName || "the crew"} starts this job and their GPS goes live
        </p>
      </div>
    );
  }

  if (!HAS_MAPBOX) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-2">Live Crew Tracking</h3>
        <p className="text-[11px] text-[var(--tx3)] mb-3">
          {crewName || crew?.name || "Crew"} • {hasPosition ? "Live position updating" : "Waiting for GPS..."}
        </p>
        <div className={`relative rounded-lg border border-[var(--brd)] overflow-hidden ${isFullscreen ? "map-fullscreen" : ""}`} style={isFullscreen ? undefined : { height: 320 }}>
          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="map-fullscreen-btn top-3 right-3"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            )}
          </button>
          {liveStage && (
            <div className="absolute top-3 left-3 z-10 rounded-lg border border-[var(--brd)] bg-[var(--card)] px-4 py-3 shadow-md flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
              </span>
              <div>
                <div className="text-[13px] font-bold text-[var(--tx)]">
                  {CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)}
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
              mapTheme={theme}
              routePositions={routePositions.length > 0 ? routePositions : undefined}
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
      <div className={`relative rounded-lg border border-[var(--brd)] overflow-hidden ${isFullscreen ? "map-fullscreen" : ""}`} style={isFullscreen ? undefined : { height: 320 }}>
        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="map-fullscreen-btn top-3 right-3"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          )}
        </button>
        {liveStage && (
          <div className="absolute top-3 left-3 z-10 rounded-lg border border-[var(--brd)] bg-[var(--card)] px-4 py-3 shadow-md flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
            </span>
            <div>
              <div className="text-[13px] font-bold text-[var(--tx)]">
                {CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)}
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
            routeLineColor={routeLineColor}
            routeGeoJson={routeGeoJson ?? undefined}
          />
        )}
      </div>
    </div>
  );
}
