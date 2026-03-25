"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import { House, X, Warning } from "@phosphor-icons/react";
import { TrackingFreshness } from "@/components/tracking/TrackingFreshness";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

const DEFAULT_CENTER = { lat: 43.665, lng: -79.385 };

interface OfficeConfig {
  lat: number;
  lng: number;
  address: string;
  radiusM: number;
}

/* Status → ring color mapping */
const STATUS_RING: Record<string, string> = {
  en_route_pickup: "#22C55E",
  at_pickup: "#C9A962",
  loading: "#C9A962",
  en_route_delivery: "#3B82F6",
  at_delivery: "#C9A962",
  unloading: "#C9A962",
  returning: "#6B7280",
  idle: "#6B7280",
  offline: "#EF4444",
};

/* Distinct per-team colors — assigned by hashing the team ID so each team always gets the same color */
const TEAM_PALETTE = [
  "#22C55E", // green
  "#3B82F6", // blue
  "#A855F7", // purple
  "#F97316", // orange
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#EAB308", // yellow
  "#14B8A6", // teal
  "#F43F5E", // rose
  "#8B5CF6", // violet
];

function teamColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return TEAM_PALETTE[h % TEAM_PALETTE.length];
}

interface Crew {
  id: string;
  name: string;
  members: string[];
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  current_job: string | null;
  updated_at?: string;
  delay_minutes?: number;
}

interface Move {
  id: string;
  move_code?: string;
  crew_id: string;
  client_name?: string;
  scheduled_date?: string;
  status: string;
  from_address?: string;
  to_address?: string;
}

interface Delivery {
  id: string;
  delivery_number?: string;
  crew_id: string;
  scheduled_date?: string;
  status: string;
  delivery_address?: string;
  pickup_address?: string;
}

interface Session {
  id: string;
  jobId: string;
  jobType: string;
  status: string;
  teamName: string;
  teamId: string;
  lastLocation: { lat: number; lng: number } | null;
  updatedAt: string;
  detailHref: string;
  jobName?: string;
}

interface CrewLocation {
  crew_id: string;
  crew_name: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  status: string;
  current_move_id: string | null;
  current_client_name: string | null;
  current_from_address: string | null;
  current_to_address: string | null;
  updated_at: string;
}

interface StreamSessionPayload {
  team_id: string;
  lastLocation?: { lat: number; lng: number } | null;
  status?: string;
  updatedAt?: string;
}

/* ── Helpers ── */

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: "Idle",
    en_route_pickup: "En Route to Pickup",
    at_pickup: "At Pickup",
    loading: "Loading",
    en_route_delivery: "En Route to Delivery",
    at_delivery: "At Delivery",
    unloading: "Unloading",
    returning: "Returning",
    offline: "Offline",
  };
  return labels[status] || CREW_STATUS_TO_LABEL[status] || toTitleCase(status);
}

function isOnJob(status: string): boolean {
  return !["idle", "offline", "returning"].includes(status);
}

function getOfflineMinutes(updatedAt: string | undefined): number {
  if (!updatedAt) return 999;
  return (Date.now() - new Date(updatedAt).getTime()) / 60000;
}

/* ── Mapbox Map (dynamic import) ── */

const GodEyeMap = dynamic(
  () =>
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;
      const Source = mod.Source;
      const Layer = mod.Layer;
      const useMap = mod.useMap;

      /** When a team is chosen from the list (or jobs panel), center the map on their latest GPS fix. */
      function FlyToSelectedCrew({
        crews,
        crewLocations,
        selectedCrew,
      }: {
        crews: Crew[];
        crewLocations: Map<string, CrewLocation>;
        selectedCrew: string | null;
      }) {
        const { current: mapRef } = useMap();
        const trackingRef = useRef({ crews, crewLocations });
        trackingRef.current = { crews, crewLocations };

        useEffect(() => {
          if (!selectedCrew) return;
          const map = mapRef?.getMap?.();
          if (!map) return;

          const { crews: cList, crewLocations: locMap } = trackingRef.current;
          const loc = locMap.get(selectedCrew);
          const crew = cList.find((x) => x.id === selectedCrew);
          const lng = loc != null ? Number(loc.lng) : crew?.current_lng != null ? Number(crew.current_lng) : NaN;
          const lat = loc != null ? Number(loc.lat) : crew?.current_lat != null ? Number(crew.current_lat) : NaN;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          try {
            map.flyTo({
              center: [lng, lat],
              zoom: Math.max(map.getZoom(), 15),
              duration: 1000,
            });
          } catch {
            /* map may be tearing down */
          }
        }, [selectedCrew, mapRef]);

        return null;
      }

      return function GodEyeMapInner({
        crews,
        crewLocations,
        center,
        zoom,
        selectedCrew,
        onCrewClick,
        routeLines,
        office,
        activeSessions,
      }: {
        crews: Crew[];
        crewLocations: Map<string, CrewLocation>;
        center: { lat: number; lng: number };
        zoom: number;
        selectedCrew: string | null;
        onCrewClick: (id: string) => void;
        routeLines: Map<string, [number, number][]>;
        office: OfficeConfig;
        activeSessions: Session[];
      }) {
        return (
          <M
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
          >
            <FlyToSelectedCrew crews={crews} crewLocations={crewLocations} selectedCrew={selectedCrew} />
            {/* Route lines for active jobs */}
            {Array.from(routeLines.entries()).map(([crewId, coords]) => {
              if (coords.length < 2) return null;
              const geojson = {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: coords },
              };
              return (
                <Source key={`route-${crewId}`} id={`route-${crewId}`} type="geojson" data={geojson}>
                  <Layer
                    id={`route-line-${crewId}`}
                    type="line"
                    paint={{
                      "line-color": "#C9A962",
                      "line-width": 3,
                      "line-opacity": 0.7,
                      "line-dasharray": [2, 2],
                    }}
                  />
                </Source>
              );
            })}

            {/* Yugo HQ marker */}
            <Marker longitude={office.lng} latitude={office.lat} anchor="bottom">
              <div className="flex flex-col items-center group cursor-default">
                {/* Label */}
                <span
                  className="mb-1 px-2.5 py-1 rounded-md text-[9px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)",
                    color: "#C9A962",
                    border: "1px solid rgba(201,169,98,0.25)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  Yugo HQ
                </span>
                {/* Pin shaft + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: "radial-gradient(circle at 35% 35%, #D4B870, #A8862E)",
                      boxShadow: "0 0 0 3px rgba(201,169,98,0.18), 0 0 10px rgba(201,169,98,0.12), 0 1px 3px rgba(0,0,0,0.4)",
                    }}
                  />
                  <div
                    className="w-px h-2"
                    style={{ background: "linear-gradient(to bottom, #C9A962, transparent)" }}
                  />
                </div>
              </div>
            </Marker>

            {/* Crew markers */}
            {crews
              .filter((c) => c.current_lat != null && c.current_lng != null)
              .map((c) => {
                const loc = crewLocations.get(c.id);
                const hasJobSession = activeSessions.some((s) => s.teamId === c.id);
                const status = loc?.status || (hasJobSession && c.status === "en-route" ? "en_route_pickup" : "idle");
                const ringColor = teamColor(c.id);
                const offMin = getOfflineMinutes(loc?.updated_at || c.updated_at);
                const isSelected = selectedCrew === c.id;
                const heading = loc?.heading != null ? Number(loc.heading) : null;

                let warningBadge: "yellow" | "red" | null = null;
                if (isOnJob(status)) {
                  if (offMin >= 15) warningBadge = "red";
                  else if (offMin >= 5) warningBadge = "yellow";
                }

                return (
                  <Marker key={c.id} longitude={c.current_lng!} latitude={c.current_lat!} anchor="center">
                    <button
                      type="button"
                      onClick={() => onCrewClick(c.id)}
                      className={`relative cursor-pointer transition-transform ${isSelected ? "scale-125 z-10" : "hover:scale-110"}`}
                      title={`${c.name}, ${getStatusLabel(status)}`}
                    >
                      {/* Glass pill label, always horizontal above the marker */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-col items-center gap-0.5 pointer-events-none max-w-[min(200px,70vw)]">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{
                            background: "rgba(8,10,16,0.84)",
                            backdropFilter: "blur(10px)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            boxShadow: "0 2px 14px rgba(0,0,0,0.55)",
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: ringColor, boxShadow: isOnJob(status) ? `0 0 6px ${ringColor}` : undefined }}
                          />
                          <span className="text-[11px] font-bold tracking-[0.04em] text-white">
                            {(c.name || "Crew").replace("Team ", "")}
                          </span>
                        </div>
                        <span className="text-[8px] font-medium text-center text-white/70 px-1 leading-tight">
                          <TrackingFreshness
                            tone="dark"
                            crewOnJob={isOnJob(status)}
                            lastUpdate={loc?.updated_at || c.updated_at}
                          />
                        </span>
                      </div>

                      {/* Directional arrow (same geometry as client/partner tracking maps), rotates with GPS heading */}
                      <div className="relative flex h-11 w-11 items-center justify-center">
                        <span
                          className="absolute rounded-full animate-ping"
                          style={{
                            inset: 5,
                            background: ringColor,
                            opacity: isOnJob(status) ? 0.2 : 0.12,
                            animationDuration: "2s",
                          }}
                          aria-hidden
                        />
                        <svg
                          width="36"
                          height="36"
                          viewBox="0 0 44 44"
                          style={{
                            transform: heading != null ? `rotate(${heading}deg)` : "none",
                            transition: "transform 0.8s ease-out",
                            filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 10px ${ringColor}66)`,
                          }}
                          aria-hidden
                        >
                          <polygon
                            points="22,5 34,36 22,29 10,36"
                            fill={ringColor}
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* Warning badge */}
                      {warningBadge && (
                        <div
                          className="absolute top-3 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white z-10"
                          style={{ backgroundColor: warningBadge === "red" ? "#EF4444" : "#F59E0B" }}
                        >
                          !
                        </div>
                      )}
                    </button>
                  </Marker>
                );
              })}

            <Nav position="bottom-right" showCompass showZoom />
          </M>
        );
      };
    }),
  { ssr: false }
);

/* ── Crew detail popup ── */

function CrewPopup({
  crew,
  crewLocation,
  session,
  todayMoves,
  onClose,
  onViewJob,
}: {
  crew: Crew;
  crewLocation: CrewLocation | undefined;
  session: Session | undefined;
  todayMoves: Move[];
  onClose: () => void;
  onViewJob: (href: string) => void;
}) {
  const status = crewLocation?.status || session?.status || (crew.status === "en-route" ? "en_route_pickup" : "idle");
  const speedKmh = crewLocation?.speed != null ? Math.round(Number(crewLocation.speed) * 3.6) : null;
  const offMin = getOfflineMinutes(crewLocation?.updated_at || crew.updated_at);

  const crewMoves = todayMoves.filter((m) => m.crew_id === crew.id);
  const currentMove = crewMoves.find((m) => ["in_progress", "confirmed", "scheduled"].includes(m.status));

  const clientName = crewLocation?.current_client_name || currentMove?.client_name || null;
  const fromAddr = crewLocation?.current_from_address || currentMove?.from_address || null;
  const toAddr = crewLocation?.current_to_address || currentMove?.to_address || null;

  // Estimate ETA based on distance to destination
  let etaMin: number | null = null;
  if (crew.current_lat && crew.current_lng && toAddr && currentMove?.to_address) {
    // Simple estimate: ~35 km/h average city speed
  }

  const detailHref = session?.detailHref || (currentMove ? `/admin/moves/${currentMove.move_code || currentMove.id}` : null);

  return (
    <div
      className="fixed sm:absolute bottom-0 sm:top-4 left-0 right-0 sm:left-auto sm:right-4 sm:bottom-auto w-full sm:w-[340px] max-h-[70vh] sm:max-h-[480px] overflow-y-auto bg-[var(--card)] border-t sm:border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl z-30 animate-fade-up"
      role="dialog"
      aria-label="Crew details"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shadow"
            style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
          >
            {(crew.name || "?").replace("Team ", "").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)]">{crew.name}</h3>
            <span className="text-[10px] text-[var(--tx3)]">{crew.members?.length || 0} members</span>
          </div>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg)] hover:text-[var(--tx)] transition-colors" aria-label="Close">
          <X size={16} weight="regular" className="text-current" />
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: `${STATUS_RING[status] || "#6B7280"}20`, color: STATUS_RING[status] || "#6B7280" }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_RING[status] || "#6B7280" }} />
          {getStatusLabel(status)}
        </span>
      </div>

      {/* Current job */}
      {(clientName || currentMove) && (
        <div className="pt-3 mt-3 border-t border-[var(--brd)]/30">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Current Job</div>
          <div className="text-[12px] font-semibold text-[var(--tx)]">{clientName || "-"}</div>
          {fromAddr && toAddr && (
            <div className="text-[11px] text-[var(--tx2)] mt-1">{fromAddr} → {toAddr}</div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3 pt-3 mt-3 border-t border-[var(--brd)]/30">
        <div className="text-center">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Speed</div>
          <div className="text-[var(--text-base)] font-bold text-[var(--tx)] mt-0.5">{speedKmh != null ? `${speedKmh}` : "-"}</div>
          <div className="text-[8px] text-[var(--tx3)]">km/h</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">ETA</div>
          <div className="text-[var(--text-base)] font-bold text-[var(--tx)] mt-0.5">{etaMin != null ? `${etaMin}` : "-"}</div>
          <div className="text-[8px] text-[var(--tx3)]">min</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Last GPS</div>
          <div className="text-[11px] font-semibold text-[var(--tx)] mt-0.5">
            <TrackingFreshness
              crewOnJob={isOnJob(status)}
              lastUpdate={crewLocation?.updated_at || crew.updated_at}
            />
          </div>
        </div>
      </div>

      {/* Team members */}
      <div className="mb-3 pt-3 border-t border-[var(--brd)]/30">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">Team</div>
        <div className="flex flex-wrap gap-1.5">
          {(crew.members || []).map((m) => (
            <span key={m} className="px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]">{m}</span>
          ))}
        </div>
      </div>

      {detailHref && (
        <Link
          href={detailHref}
          className="block text-center py-2.5 rounded-xl bg-[var(--gdim)] text-[var(--gold)] text-[12px] font-semibold hover:bg-[var(--gold)]/20 transition-colors"
        >
          View Job Details →
        </Link>
      )}
    </div>
  );
}

/* ── Main component ── */

const DEFAULT_OFFICE: OfficeConfig = { lat: 43.66027, lng: -79.35365, address: "50 Carroll St, Toronto, ON M4M 3G3", radiusM: 200 };

export default function UnifiedTrackingView({
  initialCrews,
  initialDeliveries,
  todayMoves = [],
  todayDeliveries = [],
  office = DEFAULT_OFFICE,
}: {
  initialCrews: Crew[];
  initialDeliveries: Delivery[];
  todayMoves?: Move[];
  todayDeliveries?: Delivery[];
  office?: OfficeConfig;
}) {
  const [crews, setCrews] = useState<Crew[]>(initialCrews);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventSourceConnected, setEventSourceConnected] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [crewLocations, setCrewLocations] = useState<Map<string, CrewLocation>>(new Map());
  const [routeLines, setRouteLines] = useState<Map<string, [number, number][]>>(new Map());
  const [activePanel, setActivePanel] = useState<"jobs" | "teams">("jobs");
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);

  // Tick to refresh relative times
  useEffect(() => {
    const id = setInterval(() => setRelativeTimeTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/tracking/crews-map");
      const d = await r.json();
      if (r.ok && d && Array.isArray(d.crews)) {
        setCrews(d.crews);
        setActiveSessions(Array.isArray(d.activeSessions) ? d.activeSessions : []);
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Supabase Realtime on crew_locations
  useEffect(() => {
    const channel = supabase
      .channel("crew-tracking")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_locations" },
        (payload) => {
          const loc = payload.new as CrewLocation;
          if (loc?.crew_id) {
            setCrewLocations((prev) => {
              const next = new Map(prev);
              next.set(loc.crew_id, loc);
              return next;
            });
            // Also update crew position for map markers
            setCrews((prev) =>
              prev.map((c) =>
                c.id === loc.crew_id
                  ? { ...c, current_lat: Number(loc.lat), current_lng: Number(loc.lng), updated_at: loc.updated_at }
                  : c
              )
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // EventSource for session-level updates
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/tracking/stream/all");

    es.addEventListener("open", () => {
      setEventSourceConnected(true);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    });

    es.addEventListener("error", () => { setEventSourceConnected(false); });

    es.addEventListener("sessions", (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d?.sessions) {
          setActiveSessions(
            d.sessions.map((s: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
              id: s.id,
              jobId: s.jobId,
              jobType: s.job_type,
              status: s.status,
              teamName: s.teamName,
              teamId: s.team_id,
              lastLocation: s.lastLocation,
              updatedAt: s.updatedAt || "",
              detailHref: s.detailHref,
              jobName: s.jobName,
            }))
          );
          setCrews((prev) => {
            const sessions = d.sessions as StreamSessionPayload[];
            const sessionByTeam = new Map<string, StreamSessionPayload>(sessions.map((s) => [s.team_id, s]));
            return prev.map((c) => {
              const s = sessionByTeam.get(c.id);
              if (!s) return c;
              const hasLoc = s.lastLocation?.lat != null && s.lastLocation?.lng != null;
              // Fall back to crewLocations (Supabase Realtime) if session has no position
              const loc = !hasLoc ? crewLocations.get(c.id) : null;
              const fallbackLat = loc?.lat ?? c.current_lat;
              const fallbackLng = loc?.lng ?? c.current_lng;
              return {
                ...c,
                current_lat: hasLoc ? s.lastLocation!.lat : fallbackLat,
                current_lng: hasLoc ? s.lastLocation!.lng : fallbackLng,
                status: s.status && !["completed", "not_started"].includes(s.status) ? "en-route" : "standby",
                updated_at: s.updatedAt || c.updated_at,
              };
            });
          });
        }
      } catch {} // eslint-disable-line no-empty
    });

    return () => {
      es.close();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Polling fallback
  useEffect(() => {
    if (eventSourceConnected) return;
    pollIntervalRef.current = setInterval(load, 15000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [eventSourceConnected, load]);

  // Fetch route lines for active sessions
  useEffect(() => {
    if (!HAS_MAPBOX) return;
    const fetchRoutes = async () => {
      const newRoutes = new Map<string, [number, number][]>();
      for (const s of activeSessions) {
        const crew = crews.find((c) => c.id === s.teamId);
        if (!crew?.current_lat || !crew?.current_lng) continue;

        const move = todayMoves.find((m) => m.crew_id === s.teamId);
        const loc = crewLocations.get(s.teamId);
        const destAddr = loc?.current_to_address || move?.to_address;
        if (!destAddr) continue;

        try {
          const from = `${crew.current_lng},${crew.current_lat}`;
          const geoRes = await fetch(`/api/mapbox/geocode?q=${encodeURIComponent(destAddr)}&limit=1`);
          const geoData = await geoRes.json();
          const feature = geoData?.features?.[0];
          const coords = feature?.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;

          const res = await fetch(`/api/mapbox/directions?from=${from}&to=${coords[0]},${coords[1]}`);
          if (!res.ok) { console.warn("[UnifiedTracking] directions API", res.status); continue; }
          const data = await res.json();
          if (data?.coordinates && Array.isArray(data.coordinates)) {
            newRoutes.set(s.teamId, data.coordinates);
          } else {
            console.warn("[UnifiedTracking] No route for crew", s.teamId);
          }
        } catch (err) { console.warn("[UnifiedTracking] route fetch failed", err); }
      }
      if (newRoutes.size > 0) {
        setRouteLines(newRoutes);
      }
    };
    fetchRoutes();
  }, [activeSessions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const crewsWithPosition = crews.filter((c) => c.current_lat != null && c.current_lng != null);
  const center =
    crewsWithPosition.length > 0
      ? {
          lat: crewsWithPosition.reduce((s, c) => s + (c.current_lat || 0), 0) / crewsWithPosition.length,
          lng: crewsWithPosition.reduce((s, c) => s + (c.current_lng || 0), 0) / crewsWithPosition.length,
        }
      : DEFAULT_CENTER;
  const zoom = crewsWithPosition.length > 1 ? 11 : crewsWithPosition.length === 1 ? 14 : 11;
  const selectedCrewData = selectedCrew ? crews.find((c) => c.id === selectedCrew) : null;

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Full-bleed map with overlaid panels */}
      <div className="relative w-full h-full">
        {/* Map */}
        <div className="absolute inset-0 w-full h-full">
          {HAS_MAPBOX ? (
            <GodEyeMap
              crews={crews}
              crewLocations={crewLocations}
              center={center}
              zoom={zoom}
              selectedCrew={selectedCrew}
              onCrewClick={(id) => setSelectedCrew(selectedCrew === id ? null : id)}
              routeLines={routeLines}
              office={office}
              activeSessions={activeSessions}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--bg2)] text-[var(--tx3)] text-[12px]">
              Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable map
            </div>
          )}
        </div>

        {/* Top-left: connection status */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--card)]/95 border border-[var(--brd)] backdrop-blur-sm shadow-sm max-w-[calc(100vw-96px)] sm:max-w-none overflow-hidden">
          <span className={`w-2 h-2 rounded-full ${eventSourceConnected ? "bg-[var(--grn)]" : "bg-[var(--red)] animate-pulse"}`} />
          <span className="text-[10px] font-semibold text-[var(--tx2)]">
            {eventSourceConnected ? "Live" : "Reconnecting…"}
          </span>
          <span className="text-[9px] text-[var(--tx3)]">
            {crewsWithPosition.length} team{crewsWithPosition.length !== 1 ? "s" : ""} on map
          </span>
          {loading && <span className="text-[9px] text-[var(--tx3)] animate-pulse">Updating…</span>}
        </div>

        {/* Bottom panel: Active Jobs + Teams, full-width bottom sheet on mobile, floating card on desktop */}
        <div className="absolute bottom-0 left-0 right-0 sm:bottom-3 sm:left-3 sm:right-auto z-10 w-full sm:w-[360px] max-h-[46vh] sm:max-h-[55vh] bg-[var(--card)]/97 border-t sm:border border-[var(--brd)] sm:rounded-xl backdrop-blur-sm shadow-lg overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl">
          {/* Panel tabs */}
          <div className="flex border-b border-[var(--brd)]">
            <button
              type="button"
              onClick={() => setActivePanel("jobs")}
              className={`flex-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activePanel === "jobs" ? "text-[var(--gold)] border-b-2 border-[var(--gold)]" : "text-[var(--tx3)] hover:text-[var(--tx2)]"}`}
            >
              {(() => {
                const STALE_TAB_MS = 90 * 60 * 1000;
                const freshCount = activeSessions.filter((s) => !s.updatedAt || Date.now() - new Date(s.updatedAt).getTime() <= STALE_TAB_MS).length;
                if (freshCount > 0) return `Live (${freshCount})`;
                if (activeSessions.length > 0) return `Recent (${activeSessions.length})`;
                if (todayMoves.length + todayDeliveries.length > 0) return `Today (${todayMoves.length + todayDeliveries.length})`;
                return "Jobs";
              })()}
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("teams")}
              className={`flex-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activePanel === "teams" ? "text-[var(--gold)] border-b-2 border-[var(--gold)]" : "text-[var(--tx3)] hover:text-[var(--tx2)]"}`}
            >
              Teams ({crews.length})
            </button>
          </div>

          {/* Panel content */}
          <div className="overflow-y-auto max-h-[45vh]">
            {activePanel === "jobs" && (
              <>
                {/* Live sessions */}
                {activeSessions.length > 0 && (() => {
                  const STALE_HEADER_MS = 12 * 60 * 60 * 1000;
                  const allStale = activeSessions.every((s) => s.updatedAt && Date.now() - new Date(s.updatedAt).getTime() > STALE_HEADER_MS);
                  return (
                  <>
                    <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                      {!allStale ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gold)]" />
                          </span>
                          <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--gold)]">Active Now</span>
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tx3)]/40" />
                          </span>
                          <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">Recent Sessions</span>
                        </>
                      )}
                    </div>
                    {activeSessions.map((s) => {
                      const loc = crewLocations.get(s.teamId);
                      const effectiveStatus = loc?.status || s.status || "idle";
                      const statusLabel = getStatusLabel(effectiveStatus);
                      const ringColor = teamColor(s.teamId);

                      const STAGE_ORDER: Record<string, number> = {
                        en_route_pickup: 0, at_pickup: 1, loading: 1,
                        en_route_delivery: 2, at_delivery: 3, unloading: 3,
                        returning: 4, completed: 4, delivered: 4,
                      };
                      const stageIdx = STAGE_ORDER[effectiveStatus] ?? -1;
                      const STAGE_LABELS = ["En route", "Pickup", "Transit", "Delivery", "Done"];

                      const clientName = loc?.current_client_name || s.jobName || null;
                      const fromAddr = loc?.current_from_address || null;
                      const toAddr = loc?.current_to_address || null;

                      const STALE_CLIENT_MS = 12 * 60 * 60 * 1000;
                      const updatedMs = s.updatedAt ? Date.now() - new Date(s.updatedAt).getTime() : 0;
                      const isStale = updatedMs > STALE_CLIENT_MS;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedCrew(s.teamId)}
                          className={`w-full text-left px-4 py-3 border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/40 transition-colors ${isStale ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                style={{ background: `linear-gradient(135deg, ${ringColor}CC, ${ringColor}80)` }}
                              >
                                {(s.teamName || "?").replace("Team ", "").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-bold text-[var(--tx)] truncate">{s.teamName}</div>
                                <div className="text-[10px] text-[var(--tx3)] truncate">
                                  {clientName || "Job in progress"}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold" style={{ backgroundColor: `${ringColor}15`, color: ringColor }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ringColor }} />
                                {statusLabel}
                              </span>
                              <div className="text-[9px] text-[var(--tx3)] mt-0.5">{formatRelative(s.updatedAt)}</div>
                            </div>
                          </div>

                          {(fromAddr || toAddr) && (
                            <div className="mt-1.5 text-[10px] text-[var(--tx3)] truncate pl-9">
                              {fromAddr && toAddr ? `${fromAddr} → ${toAddr}` : toAddr || fromAddr}
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="flex gap-0.5 mt-2 pl-9">
                            {STAGE_LABELS.map((label, i) => (
                              <div key={label} className="flex-1 group/seg relative">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    i <= stageIdx
                                      ? i === stageIdx ? "animate-pulse" : ""
                                      : ""
                                  }`}
                                  style={{
                                    backgroundColor: i <= stageIdx ? ringColor : "rgba(255,255,255,0.06)",
                                    boxShadow: i === stageIdx ? `0 0 6px ${ringColor}60` : undefined,
                                  }}
                                />
                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] text-[var(--tx3)] whitespace-nowrap opacity-0 group-hover/seg:opacity-100 transition-opacity">
                                  {label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </>
                  );
                })()}

                {/* Today's scheduled jobs when no live sessions */}
                {activeSessions.length === 0 && (todayMoves.length > 0 || todayDeliveries.length > 0) && (
                  <>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Scheduled Today</span>
                    </div>
                    {todayMoves.map((m) => {
                      const crew = crews.find((c) => c.id === m.crew_id);
                      return (
                        <Link
                          key={m.id}
                          href={`/admin/moves/${m.move_code || m.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-[#3B82F6]">M</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold text-[var(--tx)] truncate">{m.client_name || m.move_code}</div>
                            <div className="text-[9px] text-[var(--tx3)] truncate">{m.from_address ?? "-"} → {m.to_address ?? "-"}</div>
                          </div>
                          {crew && <span className="text-[9px] font-medium text-[var(--gold)] shrink-0">{crew.name}</span>}
                        </Link>
                      );
                    })}
                    {todayDeliveries.map((d) => {
                      const crew = crews.find((c) => c.id === d.crew_id);
                      return (
                        <Link
                          key={d.id}
                          href={`/admin/deliveries/${d.delivery_number || d.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-[var(--gold)]">D</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold text-[var(--tx)] truncate">{d.delivery_number}</div>
                            <div className="text-[9px] text-[var(--tx3)] truncate">{d.pickup_address} → {d.delivery_address}</div>
                          </div>
                          {crew && <span className="text-[9px] font-medium text-[var(--gold)] shrink-0">{crew.name}</span>}
                        </Link>
                      );
                    })}
                  </>
                )}

                {activeSessions.length === 0 && todayMoves.length === 0 && todayDeliveries.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <div className="text-[12px] font-medium text-[var(--tx3)]">No jobs today</div>
                    <div className="text-[10px] text-[var(--tx3)]/60 mt-1">Active jobs and crew tracking will appear here</div>
                  </div>
                )}
              </>
            )}

            {activePanel === "teams" && (
              crews.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="text-[12px] font-medium text-[var(--tx3)]">No teams configured</div>
                  <div className="text-[10px] text-[var(--tx3)]/60 mt-1">
                    <Link href="/admin/platform?tab=teams" className="text-[var(--gold)] hover:underline">Add teams in settings</Link>
                  </div>
                </div>
              ) : (
                crews.map((c) => {
                  const loc = crewLocations.get(c.id);
                  const offMin = getOfflineMinutes(loc?.updated_at || c.updated_at);
                  const isNearOffice = c.current_lat != null && c.current_lng != null && haversineM(c.current_lat, c.current_lng, office.lat, office.lng) < office.radiusM;
                  const hasActiveSession = activeSessions.some((s) => s.teamId === c.id);
                  const status = loc?.status || (hasActiveSession && c.status === "en-route" ? "en_route_pickup" : "idle");
                  const isOff = offMin >= 30;

                  let locationLabel = "No GPS";
                  if (isNearOffice) locationLabel = "At office";
                  else if (c.current_lat && c.current_lng) locationLabel = isOff ? `Last seen ${formatRelative(loc?.updated_at || c.updated_at || "")}` : getStatusLabel(status);

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCrew(c.id)}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #C9A962, #8B7332)",
                          boxShadow: `0 0 0 2px ${teamColor(c.id)}`,
                        }}
                      >
                        {(c.name || "?").replace("Team ", "").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-[var(--tx)] truncate">{c.name}</span>
                          {hasActiveSession && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-[var(--gold)] bg-[var(--gold)]/10">LIVE</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                          {c.current_job ? `${c.current_job} · ` : ""}{locationLabel}
                        </div>
                        {c.members && c.members.length > 0 && (
                          <div className="text-[9px] text-[var(--tx3)]/60 mt-0.5 truncate">{c.members.join(", ")}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOff && (
                          <Warning size={10} color="#EF4444" />
                        )}
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${isOff ? "" : hasActiveSession ? "animate-pulse" : ""}`}
                          style={{ backgroundColor: isOff ? "#EF4444" : teamColor(c.id) }}
                        />
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Crew detail popup */}
        {selectedCrewData && (
          <CrewPopup
            crew={selectedCrewData}
            crewLocation={crewLocations.get(selectedCrewData.id)}
            session={activeSessions.find((s) => s.teamId === selectedCrewData.id)}
            todayMoves={todayMoves}
            onClose={() => setSelectedCrew(null)}
            onViewJob={(href) => {}}
          />
        )}
      </div>
    </div>
  );
}
