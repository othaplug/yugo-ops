"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

type Center = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

const DEFAULT_CENTER: Center = { lat: 43.665, lng: -79.385 };

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
          <div className="track-live-map-container relative rounded-xl overflow-hidden h-[320px] bg-[#FAFAF8] border border-[#E7E5E4] shadow-sm">
            {/* Live stage card - top-left overlay on map (screenshot style) */}
            {liveStage && (
              <div className="absolute top-3 left-3 z-10 rounded-lg border border-[#E7E5E4] bg-white px-4 py-3 shadow-md flex items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
                </span>
                <div>
                  <div className="text-[13px] font-bold text-[#1A1A1A]">
                    {liveStage === "loading" || liveStage === "unloading" ? "Packing" : CREW_STATUS_TO_LABEL[liveStage] || liveStage.replace(/_/g, " ")}
                  </div>
                  <div className="text-[11px] text-[#666]">
                    {liveStage === "loading" || liveStage === "unloading"
                      ? "Your move is being prepared"
                      : liveStage === "completed"
                        ? "Your move is complete"
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
              />
            ) : (
              <LeafletMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} />
            )}
          </div>
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
