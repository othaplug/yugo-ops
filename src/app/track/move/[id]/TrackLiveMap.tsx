"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import {
  ChatCircle,
  CornersIn,
  CornersOut,
  NavigationArrow,
  Phone,
} from "@phosphor-icons/react";
import { CREAM, FOREST, TEXT_MUTED_ON_LIGHT } from "@/lib/client-theme";
import { QUOTE_EYEBROW_CLASS } from "@/app/quote/[quoteId]/quote-shared";

type Center = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

const DEFAULT_CENTER: Center = { lat: 43.665, lng: -79.385 };

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
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
  { ssr: false, loading: () => <MapLoading /> },
);

const LeafletMap = dynamic(
  () => import("./TrackLiveMapLeaflet").then((mod) => mod.TrackLiveMapLeaflet),
  { ssr: false, loading: () => <MapLoading /> },
);

function MapLoading() {
  return (
    <div
      className="w-full h-full min-h-[320px] flex items-center justify-center text-[13px]"
      style={{ background: CREAM, color: TEXT_MUTED_ON_LIGHT }}
    >
      Loading map…
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

export default function TrackLiveMap({
  moveId,
  token,
  move,
  crew,
  onLiveStageChange,
  isEstate = false,
  revealCrewNames = true,
  crewAssigned = false,
}: {
  moveId: string;
  token: string;
  move?: {
    scheduled_date?: string | null;
    arrival_window?: string | null;
    crew_id?: string | null;
  };
  crew?: { name: string; members?: string[] } | null;
  onLiveStageChange?: (stage: string | null) => void;
  isEstate?: boolean;
  /** When false, crew team names are hidden until the track page allows reveal. */
  revealCrewNames?: boolean;
  crewAssigned?: boolean;
}) {
  const [crewLoc, setCrewLoc] = useState<{
    current_lat: number;
    current_lng: number;
    name: string;
  } | null>(null);
  const [center, setCenter] = useState<Center>(DEFAULT_CENTER);
  const [pickup, setPickup] = useState<Center | null>(null);
  const [dropoff, setDropoff] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navEtaSeconds, setNavEtaSeconds] = useState<number | null>(null);
  const [navDistanceRemainingM, setNavDistanceRemainingM] = useState<
    number | null
  >(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crewSpeed, setCrewSpeed] = useState<number | null>(null);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  /** Bumps when container size changes (e.g. fullscreen) so Mapbox/Leaflet can call resize — do not use as React `key` (remount breaks Mapbox DOM cleanup). */
  const [mapResizeSignal, setMapResizeSignal] = useState(0);

  // Crew phone (for direct call)
  const [crewPhone, setCrewPhone] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);

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
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/crew-status?token=${encodeURIComponent(token)}`,
      );
      const data = await res.json();
      if (data.crew) setCrewLoc(data.crew);
      else setCrewLoc(null);
      setLiveStage(data.liveStage ?? null);
      setLastLocationAt(data.lastLocationAt ?? null);
      setHasActiveTracking(!!data.hasActiveTracking);
      onLiveStageChange?.(data.liveStage ?? null);
      if (data.center?.lat != null && data.center?.lng != null)
        setCenter({ lat: data.center.lat, lng: data.center.lng });
      if (data.pickup?.lat != null && data.pickup?.lng != null)
        setPickup({ lat: data.pickup.lat, lng: data.pickup.lng });
      else setPickup(null);
      if (data.dropoff?.lat != null && data.dropoff?.lng != null)
        setDropoff({ lat: data.dropoff.lat, lng: data.dropoff.lng });
      else setDropoff(null);
      setEtaMinutes(data.etaMinutes ?? null);
      setIsNavigating(Boolean(data.is_navigating));
      setNavEtaSeconds(
        data.nav_eta_seconds != null ? Number(data.nav_eta_seconds) : null,
      );
      setNavDistanceRemainingM(
        data.nav_distance_remaining_m != null
          ? Number(data.nav_distance_remaining_m)
          : null,
      );
      if (data.crewPhone) setCrewPhone(data.crewPhone);
      if (data.dispatchPhone) setDispatchPhone(data.dispatchPhone);
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
            setCrewLoc({
              current_lat: Number(loc.lat),
              current_lng: Number(loc.lng),
              name: crew?.name || "Crew",
            });
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
              setCrewLoc({
                current_lat: loc.lat,
                current_lng: loc.lng,
                name: "Crew",
              });
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
          pollId = setInterval(loadInitial, 10000);
        };
      } else {
        pollId = setInterval(loadInitial, 10000);
      }
    });

    return () => {
      cancelled = true;
      es?.close();
      clearInterval(pollId);
    };
  }, [moveId, token, loadInitial, onLiveStageChange]);

  useEffect(() => {
    if (!hasActiveTracking) return;
    const t = setTimeout(() => setMapResizeSignal((s) => s + 1), 200);
    return () => clearTimeout(t);
  }, [hasActiveTracking]);

  useEffect(() => {
    if (loading || hasActiveTracking) return;
    if (!pickup && !dropoff) return;
    const t = setTimeout(() => setMapResizeSignal((s) => s + 1), 80);
    return () => clearTimeout(t);
  }, [loading, hasActiveTracking, pickup, dropoff]);

  const mapCenter = { latitude: center.lat, longitude: center.lng };
  const scheduledStr = move?.scheduled_date
    ? new Date(move.scheduled_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  // Compute ETA (client-side Haversine fallback when server ETA is unavailable)
  const computedEtaMinutes =
    crewLoc &&
    liveStage &&
    [
      "en_route_to_pickup",
      "en_route_to_destination",
      "on_route",
      "en_route",
      "loading",
      "arrived_at_pickup",
    ].includes(liveStage)
      ? (() => {
          const toPickup = liveStage === "en_route_to_pickup";
          const dest = toPickup ? pickup : (dropoff ?? pickup);
          if (!dest) return null;
          const km = haversineKm(
            crewLoc.current_lat,
            crewLoc.current_lng,
            dest.lat,
            dest.lng,
          );
          return Math.max(1, Math.round((km / 35) * 60));
        })()
      : null;
  const navEtaMinutes =
    navEtaSeconds != null && Number.isFinite(navEtaSeconds)
      ? Math.max(1, Math.round(navEtaSeconds / 60))
      : null;
  const displayEta = navEtaMinutes ?? etaMinutes ?? computedEtaMinutes;

  // Distance from crew to client
  const distToClient =
    crewLoc && clientLat && clientLng
      ? haversineKm(
          crewLoc.current_lat,
          crewLoc.current_lng,
          clientLat,
          clientLng,
        )
      : null;

  const maskCrewIdentity = crewAssigned && !revealCrewNames;
  const displayCrewTitle = maskCrewIdentity
    ? "Your crew"
    : crew?.name || "Your Crew";
  const showPlaceholder = !loading && !hasActiveTracking;
  const canShowMap = !loading && (hasActiveTracking || !!pickup || !!dropoff);

  return (
    <div className="space-y-4">
      {hasActiveTracking && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
          </span>
          <span
            className="text-[13px] font-semibold text-[#22C55E]"
          >
            LIVE
          </span>
        </div>
      )}

      {showPlaceholder && (
        <div
          className="border p-5 rounded-none"
          style={
            isEstate
              ? {
                  borderColor: "rgba(237, 230, 220, 0.2)",
                  background: "#321018",
                }
              : {
                  borderColor: `${FOREST}18`,
                  background: CREAM,
                }
          }
        >
          <p
            className="text-[15px] font-semibold leading-snug mb-1.5"
            style={{ color: isEstate ? "#F5F0E8" : FOREST }}
          >
            Your crew will appear here on move day.
          </p>
          <p
            className="text-[14px] leading-relaxed mb-4"
            style={{
              color: isEstate ? "rgba(237, 230, 220, 0.78)" : TEXT_MUTED_ON_LIGHT,
            }}
          >
            We turn on the live map when your crew starts the job.
          </p>
          {scheduledStr && (
            <p
              className="text-[13px] mb-2"
              style={{
                color: isEstate ? "rgba(237, 230, 220, 0.78)" : TEXT_MUTED_ON_LIGHT,
              }}
            >
              Scheduled:{" "}
              <span
                className="font-medium"
                style={{ color: isEstate ? "#F5F0E8" : FOREST }}
              >
                {scheduledStr}
              </span>
            </p>
          )}
          {move?.arrival_window && (
            <p
              className="text-[13px] mb-1"
              style={{
                color: isEstate ? "rgba(237, 230, 220, 0.78)" : TEXT_MUTED_ON_LIGHT,
              }}
            >
              Crew arrives:{" "}
              <span
                className="font-medium"
                style={{ color: isEstate ? "#F5F0E8" : FOREST }}
              >
                {move.arrival_window}
              </span>
            </p>
          )}
          <div
            className="mt-4 pt-4"
            style={{
              borderTop: isEstate
                ? "1px solid rgba(237, 230, 220, 0.12)"
                : `1px solid ${FOREST}12`,
            }}
          >
            <p
              className="text-[12px] leading-relaxed"
              style={{
                color: isEstate ? "rgba(237, 230, 220, 0.62)" : `${FOREST}99`,
              }}
            >
              No live location yet — the route preview below is for your
              reference.
            </p>
          </div>
        </div>
      )}

      {canShowMap && (
        <>
          <div
            className={`track-live-map-container relative overflow-hidden transition-all duration-300 ease-out rounded-none! ${
              hasActiveTracking
                ? isFullscreen
                  ? "map-fullscreen"
                  : "h-[42dvh] min-h-[260px] sm:min-h-[300px] md:h-[50vh] md:min-h-[320px] border"
                : "mt-4 h-[200px] min-h-[180px] sm:min-h-[200px] border"
            }`}
            style={
              hasActiveTracking && !isFullscreen
                ? { borderColor: `${FOREST}18`, background: CREAM }
                : !hasActiveTracking
                  ? { borderColor: `${FOREST}18`, background: CREAM }
                  : undefined
            }
          >
            <div className="track-live-map-fill absolute inset-0 w-full h-full min-h-0">
              {HAS_MAPBOX && MAPBOX_TOKEN ? (
                <MapboxMap
                  mapboxAccessToken={MAPBOX_TOKEN}
                  center={mapCenter}
                  crew={hasActiveTracking ? crewLoc : null}
                  crewName={
                    hasActiveTracking
                      ? maskCrewIdentity
                        ? "Your crew"
                        : crewLoc?.name || crew?.name
                      : undefined
                  }
                  pickup={pickup}
                  dropoff={dropoff}
                  liveStage={hasActiveTracking ? liveStage : null}
                  clientLat={hasActiveTracking ? clientLat : null}
                  clientLng={hasActiveTracking ? clientLng : null}
                  speed={hasActiveTracking ? crewSpeed : null}
                  lastLocationAt={hasActiveTracking ? lastLocationAt : null}
                  resizeSignal={mapResizeSignal}
                  isNavigating={hasActiveTracking && isNavigating}
                  etaOverlayMinutes={hasActiveTracking ? displayEta : null}
                  distanceRemainingM={
                    hasActiveTracking ? navDistanceRemainingM : null
                  }
                  isEstate={isEstate}
                />
              ) : (
                <LeafletMap
                  center={center}
                  crew={hasActiveTracking ? crewLoc : null}
                  pickup={pickup}
                  dropoff={dropoff}
                  liveStage={hasActiveTracking ? liveStage : null}
                  resizeSignal={mapResizeSignal}
                />
              )}
            </div>

            {!hasActiveTracking && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none px-4 text-center bg-[#FFFBF7]/95"
                aria-hidden="true"
              >
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: FOREST }}
                >
                  Live map paused
                </span>
                <span
                  className="text-[12px] mt-1 max-w-[240px] leading-snug"
                  style={{
                    color: TEXT_MUTED_ON_LIGHT,
                  }}
                >
                  Turns on automatically when your crew is en route.
                </span>
              </div>
            )}

            {hasActiveTracking && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsFullscreen((f) => !f);
                    setDrawerExpanded(false);
                    setTimeout(() => setMapResizeSignal((k) => k + 1), 350);
                  }}
                  className="map-fullscreen-btn top-3 right-3 z-20"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Expand map"}
                >
                  {isFullscreen ? (
                    <CornersIn size={16} className="text-current" aria-hidden />
                  ) : (
                    <CornersOut
                      size={16}
                      className="text-current"
                      aria-hidden
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (clientLat && clientLng)
                      setCenter({ lat: clientLat, lng: clientLng });
                    else if ("geolocation" in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) =>
                          setCenter({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                          }),
                        () => {},
                      );
                    }
                  }}
                  className="map-fullscreen-btn bottom-3 left-3 z-20"
                  style={{
                    bottom: crewLoc
                      ? drawerExpanded
                        ? "260px"
                        : "72px"
                      : "12px",
                    transition: "bottom 0.3s ease",
                  }}
                  title="My location"
                  aria-label="My location"
                >
                  <NavigationArrow
                    size={16}
                    className="text-current"
                    aria-hidden
                  />
                </button>
              </>
            )}

            {/* Bottom crew drawer */}
            {hasActiveTracking && crewLoc && (
              <div
                className="absolute bottom-0 left-0 right-0 z-10 bg-white border-t border-[#E7E5E4] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-bottom"
                style={{
                  borderRadius: "16px 16px 0 0",
                  maxHeight: drawerExpanded ? "320px" : "68px",
                  overflow: "hidden",
                  transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)",
                  willChange: "max-height",
                }}
              >
                {/* Tap handle */}
                <button
                  type="button"
                  onClick={() => setDrawerExpanded((e) => !e)}
                  className="w-full flex flex-col items-center pt-2 pb-1 cursor-pointer active:scale-95 transition-transform"
                  aria-label={
                    drawerExpanded
                      ? "Collapse crew details"
                      : "Expand crew details"
                  }
                >
                  <div
                    className="w-10 h-1 rounded-full bg-[#D4D4D4] transition-transform duration-300"
                    style={{
                      transform: drawerExpanded ? "scaleX(1.4)" : "scaleX(1)",
                    }}
                  />
                </button>

                {/* Compact row (always visible) */}
                <div className="flex items-center gap-2.5 px-3 pb-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #2C3E2D, #3d5a40)",
                    }}
                  >
                    {(maskCrewIdentity ? "Y" : (crew?.name || "Y"))
                      .replace("Team ", "")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[14px] font-bold text-[#1A1A1A] truncate">
                        {displayCrewTitle}
                      </span>
                      {!maskCrewIdentity && crew?.members && (
                        <span className="text-[11px] text-[#454545]">
                          {crew.members.length} movers
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#22C55E]/15 text-[#22C55E]">
                        <span className="relative flex h-1 w-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                          <span className="relative inline-flex rounded-full h-1 w-1 bg-[#22C55E]" />
                        </span>
                        {CREW_STATUS_TO_LABEL[liveStage || ""] ||
                          toTitleCase(liveStage || "") ||
                          "Live"}
                      </span>
                    </div>
                  </div>
                  <a
                    href={`tel:${(crewPhone || dispatchPhone || process.env.NEXT_PUBLIC_YUGO_PHONE || "+16473704525").replace(/[^\d+]/g, "")}`}
                    className="shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg border border-[#E7E5E4] bg-white text-[12px] font-semibold text-[#1A1A1A] hover:border-[#2C3E2D] transition-colors"
                  >
                    <Phone
                      size={13}
                      className="text-current shrink-0"
                      aria-hidden
                    />
                    {crewPhone ? "Call crew" : "Call dispatch"}
                  </a>
                </div>

                {/* Expanded details */}
                <div
                  className="px-3 pb-4 space-y-3 border-t border-[#F0EFED]"
                  style={{
                    opacity: drawerExpanded ? 1 : 0,
                    transition: "opacity 0.25s ease 0.1s",
                  }}
                >
                  {/* ETA + last update */}
                  {(displayEta != null || lastLocationAt) && (
                    <div className="flex items-center gap-4 pt-3 text-[12px] text-[#454545]">
                      {displayEta != null && (
                        <span className="font-semibold text-[var(--tx)]">
                          ~{displayEta} min ETA
                        </span>
                      )}
                      {lastLocationAt && (
                        <span>
                          Updated {formatRelativeTime(lastLocationAt)}
                        </span>
                      )}
                      {distToClient != null && (
                        <span>{distToClient.toFixed(1)} km away</span>
                      )}
                    </div>
                  )}

                  {/* Crew members */}
                  {!maskCrewIdentity &&
                    crew?.members &&
                    crew.members.length > 0 && (
                      <div>
                        <div
                          className={`${QUOTE_EYEBROW_CLASS} mb-2`}
                          style={{ color: `${FOREST}90` }}
                        >
                          Your Team
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {crew.members.map((name, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E7E5E4]"
                            >
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ backgroundColor: FOREST }}
                              >
                                {(name || "?").slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-[12px] font-medium text-[#1A1A1A]">
                                {name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  {maskCrewIdentity && (
                    <p className="pt-3 text-[12px] leading-relaxed text-[#454545]">
                      Crew names are shared within three days of your move.
                    </p>
                  )}

                  {/* Call + Text buttons */}
                  <div className="flex gap-2 pt-1">
                    <a
                      href={`tel:${(crewPhone || dispatchPhone || process.env.NEXT_PUBLIC_YUGO_PHONE || "+16473704525").replace(/[^\d+]/g, "")}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E7E5E4] bg-white text-[13px] font-semibold text-[#1A1A1A] hover:border-[#2C3E2D] transition-colors"
                    >
                      <Phone size={14} className="text-current shrink-0" />
                      {crewPhone ? "Call crew" : "Call dispatch"}
                    </a>
                    <a
                      href={`sms:${(dispatchPhone || crewPhone || process.env.NEXT_PUBLIC_YUGO_PHONE || "+16473704525").replace(/[^\d+]/g, "")}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E7E5E4] bg-white text-[13px] font-semibold text-[#1A1A1A] hover:border-[#2C3E2D] transition-colors"
                    >
                      <ChatCircle
                        size={14}
                        className="text-current shrink-0"
                        aria-hidden
                      />
                      Text
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div
          className="h-[200px] flex items-center justify-center border text-[13px] rounded-none"
          style={{
            borderColor: `${FOREST}18`,
            background: CREAM,
            color: TEXT_MUTED_ON_LIGHT,
          }}
        >
          Loading…
        </div>
      )}
    </div>
  );
}
