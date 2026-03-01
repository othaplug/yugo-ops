"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

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

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 120) return "1 minute ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  return `${Math.floor(sec / 3600)} hours ago`;
}

const TRACKING_STAGES = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

export default function TrackLiveMap({
  moveId,
  token,
  move,
  crew,
  onLiveStageChange,
}: {
  moveId: string;
  token: string;
  move?: { scheduled_date?: string | null; arrival_window?: string | null };
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

  const loadInitial = async () => {
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/crew-status?token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (data.crew) setCrewLoc(data.crew);
      else setCrewLoc(null);
      setLiveStage(data.liveStage ?? null);
      setLastLocationAt(data.lastLocationAt ?? null);
      setHasActiveTracking(!!data.hasActiveTracking);
      onLiveStageChange?.(data.liveStage ?? null);
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
      setEtaMinutes(data.etaMinutes ?? null);
      return data.hasActiveTracking;
    } catch {
      setCrewLoc(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

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
            }
          } catch {}
        });
        es.addEventListener("checkpoint", (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d?.status) {
              setLiveStage(d.status);
              onLiveStageChange?.(d.status);
            }
          } catch {}
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
  }, [moveId, token, onLiveStageChange]);

  const mapCenter = { latitude: center.lat, longitude: center.lng };
  const scheduledStr = move?.scheduled_date
    ? new Date(move.scheduled_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  // Compute ETA client-side when we have crew position + destination (updates with location stream)
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
  const crewMembers = crew?.members?.length ? crew.members.join(", ") : crew?.name || "";
  const showPlaceholder = !loading && !hasActiveTracking;

  return (
    <div className="space-y-4">
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
          <p className="text-[14px] text-[#1A1A1A] mb-2">
            Your move is scheduled for {scheduledStr || "—"}.
          </p>
          <p className="text-[13px] text-[#666] mb-4">
            Live tracking will activate when your crew begins.
          </p>
          {move?.arrival_window && (
            <p className="text-[12px] text-[#666] mb-1">
              Crew arrives between: {move.arrival_window}
            </p>
          )}
          {crewMembers && (
            <p className="text-[12px] text-[#666]">
              Your crew: {crewMembers}
            </p>
          )}
        </div>
      ) : !loading && hasActiveTracking ? (
        <>
          <div className={`track-live-map-container relative rounded-xl overflow-hidden ${isFullscreen ? "map-fullscreen" : "h-[320px]"} bg-[#FAFAF8] border border-[#E7E5E4]`}>
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

            {/* Recenter button */}
            <button
              type="button"
              onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => {}
                  );
                }
              }}
              className="map-fullscreen-btn bottom-3 left-3"
              title="My location"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </button>

            {/* Live stage card - top-left overlay on map (screenshot style) */}
            {liveStage && (
              <div className="absolute top-3 left-3 z-10 rounded-lg border border-[#E7E5E4] bg-white px-4 py-3 shadow-md flex items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
                </span>
                <div>
                  <div className="text-[13px] font-bold text-[#1A1A1A]">
                    {CREW_STATUS_TO_LABEL[liveStage] || liveStage.replace(/_/g, " ")}
                  </div>
                  <div className="text-[11px] text-[#666]">
                    {liveStage === "loading"
                      ? "Crew is loading your items"
                      : liveStage === "unloading"
                        ? "Crew is unloading your items"
                        : liveStage === "completed"
                          ? "Your move is complete"
                          : displayEta != null
                            ? `Arriving in ~${displayEta} min`
                            : "Your crew is on the way"}
                  </div>
                </div>
              </div>
            )}
            {HAS_MAPBOX && MAPBOX_TOKEN ? (
              <MapboxMap
                mapboxAccessToken={MAPBOX_TOKEN}
                center={mapCenter}
                crew={crewLoc}
                crewName={crewLoc?.name}
                pickup={pickup}
                dropoff={dropoff}
                liveStage={liveStage}
              />
            ) : (
              <LeafletMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
            )}
          </div>
          {hasActiveTracking && crewLoc && (
            <div className="flex gap-3 mt-3">
              <a href="tel:+14165551234" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#E7E5E4] bg-white text-[13px] font-medium text-[#1A1A1A] hover:border-[#C9A962]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call Crew
              </a>
              <a href="sms:+14165551234" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#E7E5E4] bg-white text-[13px] font-medium text-[#1A1A1A] hover:border-[#C9A962]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Text Crew
              </a>
            </div>
          )}
          {liveStage && (
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              {TRACKING_STAGES.map((s) => {
                const idx = TRACKING_STAGES.indexOf(s);
                const currentIdx = TRACKING_STAGES.indexOf(liveStage);
                const isPast = currentIdx > idx;
                const isCurrent = currentIdx === idx;
                return (
                  <span
                    key={s}
                    className={`transition-all duration-300 ${isPast ? "text-[#22C55E]" : isCurrent ? "text-[#C9A962] font-semibold" : "text-[#999]"}`}
                  >
                    {isPast ? "✓" : isCurrent ? "●" : "○"} {CREW_STATUS_TO_LABEL[s] || s}
                  </span>
                );
              })}
            </div>
          )}
        </>
      ) : loading ? (
        <div className="rounded-xl h-[200px] flex items-center justify-center bg-[#FAFAF8] border border-[#E7E5E4] text-[#666] text-[12px]">
          Loading...
        </div>
      ) : null}
    </div>
  );
}
