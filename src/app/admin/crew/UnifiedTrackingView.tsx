"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

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
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;
      return function Map({
        crews,
        center,
        zoom,
        onCrewClick,
      }: {
        crews: { id: string; name: string; current_lat: number; current_lng: number }[];
        center: { lat: number; lng: number };
        zoom: number;
        onCrewClick?: (id: string) => void;
      }) {
        return (
          <M
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
          >
            {crews.map((c) => (
              <Marker key={c.id} longitude={c.current_lng} latitude={c.current_lat} anchor="bottom">
                <button
                  type="button"
                  onClick={() => onCrewClick?.(c.id)}
                  className="cursor-pointer hover:scale-110 transition-transform truck-marker-animated flex flex-col items-center"
                  title={c.name}
                >
                  <img src="/crew-car.png" alt="" width={40} height={40} className="block drop-shadow-md" />
                  <span className="text-[10px] font-semibold text-[var(--tx)] whitespace-nowrap mt-0.5 px-1.5 py-0.5 rounded bg-[var(--card)]/95 border border-[var(--brd)] shadow-sm">
                    {(c.name || "Crew").replace("Team ", "")}
                  </span>
                </button>
              </Marker>
            ))}
            <Nav position="bottom-right" showCompass showZoom />
          </M>
        );
      };
    }),
  { ssr: false }
);

const CrewMapLeaflet = dynamic(
  () => import("./CrewMapLeaflet").then((mod) => mod.CrewMapLeaflet),
  { ssr: false }
);

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

interface Delivery {
  id: string;
  delivery_number?: string;
  crew_id: string;
  scheduled_date?: string;
  status: string;
  delivery_address?: string;
  pickup_address?: string;
}

interface Move {
  id: string;
  move_code?: string;
  crew_id: string;
  scheduled_date?: string;
  status: string;
  from_address?: string;
  to_address?: string;
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
}

/** Session payload from tracking stream API */
interface StreamSessionPayload {
  team_id: string;
  lastLocation?: { lat: number; lng: number } | null;
  status?: string;
  updatedAt?: string;
}

const DEFAULT_CENTER = { lat: 43.665, lng: -79.385 };

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function UnifiedTrackingView({
  initialCrews,
  initialDeliveries,
  todayMoves = [],
  todayDeliveries = [],
}: {
  initialCrews: Crew[];
  initialDeliveries: Delivery[];
  todayMoves?: Move[];
  todayDeliveries?: Delivery[];
}) {
  const [crews, setCrews] = useState<Crew[]>(initialCrews);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventSourceConnected, setEventSourceConnected] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  useEffect(() => {
    load();
  }, [load]);

  // EventSource for live updates (primary)
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

    es.addEventListener("error", () => {
      setEventSourceConnected(false);
    });

    es.addEventListener("sessions", (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d?.sessions) {
          setActiveSessions(
            d.sessions.map((s: any) => ({
              id: s.id,
              jobId: s.jobId,
              jobType: s.job_type,
              status: s.status,
              teamName: s.teamName,
              teamId: s.team_id,
              lastLocation: s.lastLocation,
              updatedAt: s.updatedAt || "",
              detailHref: s.detailHref,
            }))
          );
          setCrews((prev) => {
            const sessions = d.sessions as StreamSessionPayload[];
            const sessionByTeam = new Map<string, StreamSessionPayload>(
              sessions.map((s) => [s.team_id, s])
            );
            return prev.map((c) => {
              const s = sessionByTeam.get(c.id);
              if (!s?.lastLocation?.lat) return c;
              return {
                ...c,
                current_lat: s.lastLocation.lat,
                current_lng: s.lastLocation.lng,
                status: s.status && !["completed", "not_started"].includes(s.status) ? "en-route" : c.status,
                updated_at: s.updatedAt,
              };
            });
          });
        }
      } catch {}
    });

    return () => {
      es.close();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // 15s polling fallback when EventSource is not connected or has errored
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

  const crewsWithPosition = crews.filter((c) => c.current_lat != null && c.current_lng != null);
  const center =
    crewsWithPosition.length > 0
      ? {
          lat: crewsWithPosition.reduce((s, c) => s + (c.current_lat || 0), 0) / crewsWithPosition.length,
          lng: crewsWithPosition.reduce((s, c) => s + (c.current_lng || 0), 0) / crewsWithPosition.length,
        }
      : DEFAULT_CENTER;
  const zoom = crewsWithPosition.length > 1 ? 12 : 14;

  return (
    <div className="space-y-6">
      {/* Single map section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">Live Tracking</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              {crewsWithPosition.length > 0
                ? `${crewsWithPosition.length} team${crewsWithPosition.length === 1 ? "" : "s"} on map • Full-time tracking (job or not) • Click a team for details`
                : crews.length > 0
                  ? "No location yet — have crews open the Crew app (dashboard or job) and allow location access so they appear on the map."
                  : "Teams appear when crews share location from the Crew Portal app (tracking is always on when the app sends position)."}
            </p>
          </div>
          {loading && (
            <span className="text-[10px] text-[var(--tx3)] animate-pulse">Updating...</span>
          )}
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden min-h-[280px] sm:min-h-[360px]">
          <div className="w-full rounded-lg overflow-hidden relative h-[280px] sm:h-[360px] md:h-[420px]" style={{ minHeight: 280 }}>
            {HAS_MAPBOX ? (
              <MapboxMap
                crews={crewsWithPosition.map((c) => ({
                  id: c.id,
                  name: c.name,
                  current_lat: c.current_lat!,
                  current_lng: c.current_lng!,
                }))}
                center={center}
                zoom={zoom}
                onCrewClick={(id) => setSelectedCrew(crews.find((c) => c.id === id) || null)}
              />
            ) : (
              <div className="w-full h-full min-h-[280px] bg-[var(--bg2)]">
                <CrewMapLeaflet
                  crews={crewsWithPosition.map((c) => ({
                    id: c.id,
                    name: c.name,
                    current_lat: c.current_lat!,
                    current_lng: c.current_lng!,
                  }))}
                  center={{ latitude: center.lat, longitude: center.lng }}
                  zoom={zoom}
                  onCrewClick={(id) => setSelectedCrew(crews.find((c) => c.id === id) || null)}
                />
              </div>
            )}
            {selectedCrew && (
              <CrewDetailOverlay
                crew={selectedCrew}
                session={activeSessions.find((s) => s.teamId === selectedCrew.id)}
                deliveries={initialDeliveries}
                todayMoves={todayMoves}
                todayDeliveries={todayDeliveries}
                onClose={() => setSelectedCrew(null)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Activity: Active jobs + Teams - horizontal scroll on mobile, grid on desktop */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide md:overflow-visible md:grid md:grid-cols-2 lg:grid-cols-3 pb-2 px-1 md:gap-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="bg-[var(--card)] border border-[var(--brd)] min-w-[280px] shrink-0 snap-start md:min-w-0 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h3 className="text-[13px] font-bold text-[var(--tx)]">Active jobs</h3>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              {activeSessions.length === 0
                ? "No crews are tracking a job right now"
                : `${activeSessions.length} job${activeSessions.length === 1 ? "" : "s"} in progress`}
            </p>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {activeSessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">
                Tap a team below to see their assignments
              </div>
            ) : (
              activeSessions.map((s) => (
                <Link
                  key={s.id}
                  href={s.detailHref}
                  className="block px-4 py-3 border-b border-[var(--brd)] last:border-0 hover:bg-[var(--bg)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shrink-0" />
                    <span className="text-[12px] font-semibold text-[var(--tx)] truncate">{s.teamName}</span>
                  </div>
                  <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">{s.jobId}</div>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                    {CREW_STATUS_TO_LABEL[s.status] || s.status} · {formatRelative(s.updatedAt)}
                  </div>
                  <div className="text-[10px] text-[var(--gold)] mt-1">View job →</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] min-w-[280px] shrink-0 snap-start md:min-w-0 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <h3 className="text-[13px] font-bold text-[var(--tx)]">Teams</h3>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              Click a team for details and current job
            </p>
          </div>
          <div className="p-4">
            {crews.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[var(--tx3)]">No teams yet</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {crews.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCrew(c)}
                    className="flex items-center gap-3 px-4 py-3 bg-[var(--bg)] border border-[var(--brd)] rounded-xl hover:border-[var(--gold)] transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-[var(--gold)] bg-[var(--gdim)] group-hover:bg-[var(--gold)]/20 transition-colors shrink-0">
                      {(c.name?.replace("Team ", "") || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-[var(--tx)] truncate">{c.name}</div>
                      <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                        {c.status === "en-route" ? `En route · ${c.current_job || "—"}` : c.current_job || "Standby"}
                      </div>
                    </div>
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        c.status === "en-route" ? "bg-[var(--org)] animate-pulse" : "bg-[var(--grn)]"
                      }`}
                      title={c.status === "en-route" ? "En route" : "Standby"}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg)] to-transparent pointer-events-none md:hidden" aria-hidden />
      </div>

    </div>
  );
}

function CrewDetailOverlay({
  crew,
  session,
  deliveries,
  todayMoves = [],
  todayDeliveries = [],
  onClose,
}: {
  crew: Crew;
  session?: Session;
  deliveries: Delivery[];
  todayMoves?: Move[];
  todayDeliveries?: Delivery[];
  onClose: () => void;
}) {
  const isEnRoute = crew.status === "en-route";
  const crewDeliveries = deliveries.filter((d) => d.crew_id === crew.id);
  const pendingDeliveries = crewDeliveries.filter((d) => !["delivered", "cancelled"].includes(d.status));
  const activeProject = pendingDeliveries[0];
  const crewTodayMoves = todayMoves.filter((m) => m.crew_id === crew.id);
  const crewTodayDeliveries = todayDeliveries.filter((d) => d.crew_id === crew.id);
  const currentJob =
    activeProject
      ? { label: activeProject.delivery_number || `#${activeProject.id.slice(0, 8)}`, type: "delivery" as const, address: activeProject.delivery_address || activeProject.pickup_address }
      : crewTodayMoves[0]
        ? { label: crewTodayMoves[0].move_code || `#${crewTodayMoves[0].id.slice(0, 8)}`, type: "move" as const, address: crewTodayMoves[0].to_address || crewTodayMoves[0].from_address }
        : crewTodayDeliveries[0]
          ? { label: crewTodayDeliveries[0].delivery_number || `#${crewTodayDeliveries[0].id.slice(0, 8)}`, type: "delivery" as const, address: crewTodayDeliveries[0].delivery_address || crewTodayDeliveries[0].pickup_address }
          : null;
  const statusLabel = session ? (CREW_STATUS_TO_LABEL[session.status] || session.status) : (isEnRoute ? "En route" : "Standby");

  return (
    <div
      className="absolute top-4 right-4 w-[320px] max-h-[400px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-2xl p-5 shadow-lg z-20 animate-fade-up"
      role="dialog"
      aria-label="Crew details"
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="text-[14px] font-bold text-[var(--tx)] truncate flex-1">{crew.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg)] hover:text-[var(--tx)] transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l14 14M15 1L1 15" />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
              isEnRoute ? "bg-[var(--gdim)] text-[var(--gold)]" : "bg-[var(--grdim)] text-[var(--grn)]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isEnRoute ? "bg-[var(--gold)] animate-pulse" : "bg-[var(--grn)]"}`} />
            {statusLabel}
          </span>
          {crew.updated_at && (
            <span className="text-[10px] text-[var(--tx3)]">Updated {formatDate(crew.updated_at)}</span>
          )}
        </div>

        {currentJob && (
          <>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Current job</div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">{currentJob.label}</div>
              {currentJob.address && (
                <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">{currentJob.address}</div>
              )}
            </div>
            {session && (
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Progress stage</div>
                <div className="text-[12px] text-[var(--tx)]">{CREW_STATUS_TO_LABEL[session.status] || session.status}</div>
              </div>
            )}
          </>
        )}

        {crew.delay_minutes != null && crew.delay_minutes > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ordim)] border border-[var(--org)]/30">
            <span className="text-[12px] font-semibold text-[var(--org)]">~{crew.delay_minutes} min delay</span>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team members</div>
          <div className="flex flex-wrap gap-2">
            {(crew.members || []).map((m) => (
              <span
                key={m}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {currentJob && (
          <Link
            href={currentJob.type === "move" ? `/admin/moves/${currentJob.label}` : `/admin/deliveries/${currentJob.label}`}
            className="block text-center py-2.5 rounded-xl bg-[var(--gdim)] text-[var(--gold)] text-[12px] font-semibold hover:bg-[var(--gold)]/20 transition-colors"
          >
            View job →
          </Link>
        )}
      </div>
    </div>
  );
}
