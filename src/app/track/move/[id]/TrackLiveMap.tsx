"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

type Center = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

const DEFAULT_CENTER: Center = { lat: 43.665, lng: -79.385 };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

const MapboxMap = dynamic(
  () => import("./TrackLiveMapMapbox").then((mod) => mod.TrackLiveMapMapbox),
  { ssr: false, loading: () => <MapLoading /> }
);

const LeafletMap = dynamic(
  () => import("./TrackLiveMapLeaflet").then((mod) => mod.TrackLiveMapLeaflet),
  { ssr: false, loading: () => <MapLoading /> }
);

function MapLoading() {
  return (
    <div className="w-full h-full min-h-[320px] flex items-center justify-center bg-[#FAFAF8] text-[#666] text-[12px]">
      Loading map...
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  if (sec < 120) return "1 minute ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  return `${Math.floor(sec / 3600)} hours ago`;
}

/* Status progression stages */
const PROGRESSION = [
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "en_route", label: "En Route" },
  { key: "loading", label: "Loading" },
  { key: "in_transit", label: "In Transit" },
  { key: "arriving", label: "Arriving" },
  { key: "completed", label: "Complete" },
];

function getProgressionIndex(stage: string | null): number {
  if (!stage) return 0;
  const map: Record<string, number> = {
    en_route_to_pickup: 2,
    arrived_at_pickup: 2,
    loading: 3,
    en_route_to_destination: 4,
    arrived_at_destination: 5,
    unloading: 5,
    completed: 6,
  };
  return map[stage] ?? 0;
}

export default function TrackLiveMap({
  moveId,
  token,
  move,
  crew,
  onLiveStageChange,
}: {
  moveId: string;
  token: string;
  move?: { scheduled_date?: string | null; arrival_window?: string | null; crew_id?: string | null };
  crew?: { name: string; members?: string[] } | null;
  onLiveStageChange?: (stage: string | null) => void;
}) {
  const [crewLoc, setCrewLoc] = useState<{ current_lat: number; current_lng: number; name: string } | null>(null);
  const [center, setCenter] = useState<Center>(DEFAULT_CENTER);
  const [pickup, setPickup] = useState<Center | null>(null);
  const [dropoff, setDropoff] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crewSpeed, setCrewSpeed] = useState<number | null>(null);

  // Client geolocation
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Request client geolocation
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setClientLat(pos.coords.latitude);
        setClientLng(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/moves/${moveId}/crew-status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.crew) setCrewLoc(data.crew);
      else setCrewLoc(null);
      setLiveStage(data.liveStage ?? null);
      setLastLocationAt(data.lastLocationAt ?? null);
      setHasActiveTracking(!!data.hasActiveTracking);
      onLiveStageChange?.(data.liveStage ?? null);
      if (data.center?.lat != null && data.center?.lng != null) setCenter({ lat: data.center.lat, lng: data.center.lng });
      if (data.pickup?.lat != null && data.pickup?.lng != null) setPickup({ lat: data.pickup.lat, lng: data.pickup.lng });
      else setPickup(null);
      if (data.dropoff?.lat != null && data.dropoff?.lng != null) setDropoff({ lat: data.dropoff.lat, lng: data.dropoff.lng });
      else setDropoff(null);
      setEtaMinutes(data.etaMinutes ?? null);
      return data.hasActiveTracking;
    } catch {
      setCrewLoc(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, [moveId, token, onLiveStageChange]);

  // Supabase Realtime for live crew position updates
  useEffect(() => {
    if (!move?.crew_id) return;

    const channel = supabase
      .channel(`client-tracking-${moveId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crew_locations",
          filter: `current_move_id=eq.${moveId}`,
        },
        (payload) => {
          const loc = payload.new as {
            lat: number;
            lng: number;
            speed: number | null;
            heading: number | null;
            status: string;
            updated_at: string;
          };
          if (loc?.lat != null && loc?.lng != null) {
            setCrewLoc({ current_lat: Number(loc.lat), current_lng: Number(loc.lng), name: crew?.name || "Crew" });
            setLastLocationAt(loc.updated_at || new Date().toISOString());
            if (loc.speed != null) setCrewSpeed(Number(loc.speed));

            // Map crew_locations status back to tracking stage
            const statusMap: Record<string, string> = {
              en_route_pickup: "en_route_to_pickup",
              at_pickup: "arrived_at_pickup",
              loading: "loading",
              en_route_delivery: "en_route_to_destination",
              at_delivery: "arrived_at_destination",
              unloading: "unloading",
            };
            if (loc.status && statusMap[loc.status]) {
              setLiveStage(statusMap[loc.status]);
              onLiveStageChange?.(statusMap[loc.status]);
            }
            setHasActiveTracking(true);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, moveId, move?.crew_id, crew?.name, onLiveStageChange]);

  // Initial load + EventSource + polling fallback
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let pollId: ReturnType<typeof setInterval>;

    loadInitial().then((active) => {
      if (cancelled) return;
      if (active && typeof EventSource !== "undefined") {
        const url = `/api/tracking/stream/${moveId}?token=${encodeURIComponent(token)}&jobType=move`;
        es = new EventSource(url);
        es.addEventListener("location", (e) => {
          try {
            const loc = JSON.parse(e.data);
            if (loc?.lat != null && loc?.lng != null) {
              setCrewLoc({ current_lat: loc.lat, current_lng: loc.lng, name: "Crew" });
              setLastLocationAt(loc.timestamp || new Date().toISOString());
              if (loc.speed != null) setCrewSpeed(Number(loc.speed));
            }
          } catch {} // eslint-disable-line no-empty
        });
        es.addEventListener("checkpoint", (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d?.status) {
              setLiveStage(d.status);
              onLiveStageChange?.(d.status);
            }
          } catch {} // eslint-disable-line no-empty
        });
        es.onerror = () => {
          es?.close();
          es = null;
          pollId = setInterval(loadInitial, 15000);
        };
      } else {
        pollId = setInterval(loadInitial, 15000);
      }
    });

    return () => {
      cancelled = true;
      es?.close();
      clearInterval(pollId);
    };
  }, [moveId, token, loadInitial, onLiveStageChange]);

  const mapCenter = { latitude: center.lat, longitude: center.lng };
  const scheduledStr = move?.scheduled_date
    ? new Date(move.scheduled_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  // Compute ETA
  const computedEtaMinutes =
    crewLoc && liveStage && ["en_route_to_pickup", "en_route_to_destination", "on_route", "en_route"].includes(liveStage)
      ? (() => {
          const dest = liveStage === "en_route_to_pickup" ? pickup : dropoff ?? pickup;
          if (!dest) return null;
          const km = haversineKm(crewLoc.current_lat, crewLoc.current_lng, dest.lat, dest.lng);
          return Math.max(1, Math.round((km / 35) * 60));
        })()
      : null;
  const displayEta = etaMinutes ?? computedEtaMinutes;

  // Distance from crew to client
  const distToClient = crewLoc && clientLat && clientLng
    ? haversineKm(crewLoc.current_lat, crewLoc.current_lng, clientLat, clientLng)
    : null;

  const crewMembers = crew?.members?.length ? crew.members.join(", ") : crew?.name || "";
  const showPlaceholder = !loading && !hasActiveTracking;
  const progressionIdx = getProgressionIndex(liveStage);

  return (
    <div className="space-y-4">
      {/* Status progression bar */}
      {hasActiveTracking && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
          {PROGRESSION.map((step, i) => {
            const isActive = i === progressionIdx;
            const isDone = i < progressionIdx;
            return (
              <div key={step.key} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold whitespace-nowrap transition-all ${isDone ? "bg-[#22C55E]/15 text-[#22C55E]" : isActive ? "bg-[#C9A962]/20 text-[#C9A962]" : "bg-[#E7E5E4] text-[#999]"}`}>
                  {isDone && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                  {isActive && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9A962] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C9A962]" />
                    </span>
                  )}
                  {step.label}
                </div>
                {i < PROGRESSION.length - 1 && (
                  <div className={`w-3 h-0.5 rounded-full ${isDone ? "bg-[#22C55E]" : "bg-[#E7E5E4]"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasActiveTracking && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
          </span>
          <span className="text-[12px] font-semibold text-[#22C55E]">LIVE</span>
        </div>
      )}

      {showPlaceholder ? (
        <div className="rounded-xl border border-[#E7E5E4] bg-[#FAFAF8] p-5">
          <p className="text-[14px] text-[#1A1A1A] mb-2">Your crew will appear here on move day.</p>
          <p className="text-[13px] text-[#666] mb-4">Live tracking activates when your crew begins.</p>
          {scheduledStr && <p className="text-[12px] text-[#666] mb-1">Scheduled: {scheduledStr}</p>}
          {move?.arrival_window && <p className="text-[12px] text-[#666] mb-1">Crew arrives: {move.arrival_window}</p>}
          {crewMembers && <p className="text-[12px] text-[#666]">Your crew: {crewMembers}</p>}
          {/* Static map with pickup/delivery preview */}
          {(pickup || dropoff) && (
            <div className="mt-4 rounded-xl overflow-hidden h-[200px] border border-[#E7E5E4]">
              {HAS_MAPBOX && MAPBOX_TOKEN ? (
                <MapboxMap
                  mapboxAccessToken={MAPBOX_TOKEN}
                  center={mapCenter}
                  crew={null}
                  pickup={pickup}
                  dropoff={dropoff}
                  liveStage={null}
                />
              ) : (
                <LeafletMap center={center} crew={null} pickup={pickup} dropoff={dropoff} liveStage={null} />
              )}
            </div>
          )}
        </div>
      ) : !loading && hasActiveTracking ? (
        <>
          <div className={`track-live-map-container relative rounded-xl overflow-hidden ${isFullscreen ? "map-fullscreen" : "h-[50vh] min-h-[320px]"} bg-[#FAFAF8] border border-[#E7E5E4]`}>
            {/* Map fills container; fullscreen uses absolute inset-0 so map resizes */}
            <div className="track-live-map-fill absolute inset-0 w-full h-full min-h-0">
            {HAS_MAPBOX && MAPBOX_TOKEN ? (
              <MapboxMap
                mapboxAccessToken={MAPBOX_TOKEN}
                center={mapCenter}
                crew={crewLoc}
                crewName={crewLoc?.name || crew?.name}
                pickup={pickup}
                dropoff={dropoff}
                liveStage={liveStage}
                clientLat={clientLat}
                clientLng={clientLng}
                speed={crewSpeed}
              />
            ) : (
              <LeafletMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
            )}
            </div>

            {/* Fullscreen toggle – above map */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="map-fullscreen-btn top-3 right-3 z-20"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Expand map"}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              )}
            </button>

            {/* Recenter on client */}
            <button
              type="button"
              onClick={() => {
                if (clientLat && clientLng) setCenter({ lat: clientLat, lng: clientLng });
                else if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => {}
                  );
                }
              }}
              className="map-fullscreen-btn bottom-12 left-3 z-20"
              title="My location"
              aria-label="My location"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </button>

            {/* Bottom info card – compact */}
            {crewLoc && (
              <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-xl border-t border-[#E7E5E4] shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-3 py-2.5 safe-area-bottom">
                <div className="w-8 h-0.5 rounded-full bg-[#E0E0E0] mx-auto mb-2" />
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                  >
                    {(crew?.name || "Y").replace("Team ", "").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-bold text-[#1A1A1A] truncate">{crew?.name || "Your Crew"}</span>
                      {crew?.members && <span className="text-[10px] text-[#666]">{crew.members.length} movers</span>}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#22C55E]/15 text-[#22C55E]">
                        <span className="relative flex h-1 w-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" /><span className="relative inline-flex rounded-full h-1 w-1 bg-[#22C55E]" /></span>
                        {CREW_STATUS_TO_LABEL[liveStage || ""] || toTitleCase(liveStage || "") || "Live"}
                      </span>
                    </div>
                    {(displayEta != null || lastLocationAt) && (
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[#666]">
                        {displayEta != null && <span className="font-semibold text-[#C9A962]">~{displayEta} min</span>}
                        {lastLocationAt && <span>{formatRelativeTime(lastLocationAt)}</span>}
                      </div>
                    )}
                  </div>
                  <a
                    href={`tel:${process.env.NEXT_PUBLIC_YUGO_PHONE ? encodeURIComponent(process.env.NEXT_PUBLIC_YUGO_PHONE.replace(/[^\d+]/g, "")) : "+16473704525"}`}
                    className="shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg border border-[#E7E5E4] bg-white text-[12px] font-semibold text-[#1A1A1A] hover:border-[#C9A962] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Call Crew
                  </a>
                </div>
              </div>
            )}
          </div>
        </>
      ) : loading ? (
        <div className="rounded-xl h-[200px] flex items-center justify-center bg-[#FAFAF8] border border-[#E7E5E4] text-[#666] text-[12px]">
          Loading...
        </div>
      ) : null}
    </div>
  );
}
