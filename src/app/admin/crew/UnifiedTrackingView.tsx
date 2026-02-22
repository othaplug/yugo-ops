"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ModalOverlay from "../components/ModalOverlay";
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
      }: {
        crews: { id: string; name: string; current_lat: number; current_lng: number }[];
        center: { lat: number; lng: number };
        zoom: number;
      }) {
        return (
          <M
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
          >
            {crews.map((c) => (
              <Marker key={c.id} longitude={c.current_lng} latitude={c.current_lat} anchor="center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #C9A962, #8B7332)",
                  }}
                  title={c.name}
                >
                  {(c.name?.replace("Team ", "") || "?").slice(0, 1).toUpperCase()}
                </div>
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
}: {
  initialCrews: Crew[];
  initialDeliveries: Delivery[];
}) {
  const [crews, setCrews] = useState<Crew[]>(initialCrews);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/tracking/crews-map");
      const d = await r.json();
      setCrews(d.crews || []);
      setActiveSessions(d.activeSessions || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/tracking/stream/all");
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
    return () => es.close();
  }, []);

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
                ? `${crewsWithPosition.length} team${crewsWithPosition.length === 1 ? "" : "s"} on map • Click a team for details`
                : "Teams appear when crews share location from the Crew Portal app on their tablet"}
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
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity: Active jobs + Teams in two equal cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
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

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
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

      <ModalOverlay
        open={!!selectedCrew}
        onClose={() => setSelectedCrew(null)}
        title={selectedCrew?.name || ""}
        maxWidth="md"
      >
        {selectedCrew && (
          <CrewDetailModal crew={selectedCrew} deliveries={initialDeliveries} />
        )}
      </ModalOverlay>
    </div>
  );
}

function CrewDetailModal({ crew, deliveries }: { crew: Crew; deliveries: Delivery[] }) {
  const isEnRoute = crew.status === "en-route";
  const crewDeliveries = deliveries.filter((d) => d.crew_id === crew.id);
  const pendingDeliveries = crewDeliveries.filter((d) => !["delivered", "cancelled"].includes(d.status));
  const activeProject = pendingDeliveries[0];
  const nextProject = pendingDeliveries[1];

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
            isEnRoute ? "bg-[var(--gdim)] text-[var(--gold)]" : "bg-[var(--grdim)] text-[var(--grn)]"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${isEnRoute ? "bg-[var(--gold)] animate-pulse" : "bg-[var(--grn)]"}`}
          />
          {isEnRoute ? "En route" : "Standby"}
        </span>
        {crew.updated_at && (
          <span className="text-[10px] text-[var(--tx3)]">Updated {formatDate(crew.updated_at)}</span>
        )}
      </div>

      {activeProject && (
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Current project</div>
          <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] space-y-1.5">
            <div className="text-[12px] font-semibold text-[var(--tx)]">
              {activeProject.delivery_number || `#${activeProject.id.slice(0, 8)}`}
            </div>
            {(activeProject.pickup_address || activeProject.delivery_address) && (
              <div className="text-[11px] text-[var(--tx2)] space-y-0.5">
                {activeProject.pickup_address && (
                  <div className="truncate">
                    <span className="text-[var(--tx3)]">From:</span> {activeProject.pickup_address}
                  </div>
                )}
                {activeProject.delivery_address && (
                  <div className="truncate">
                    <span className="text-[var(--tx3)]">To:</span> {activeProject.delivery_address}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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

      {nextProject && (
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Up next</div>
          <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)]/60 border border-[var(--brd)]/80">
            <div className="text-[12px] font-semibold text-[var(--tx)]">
              {nextProject.delivery_number || `#${nextProject.id.slice(0, 8)}`}
            </div>
            {nextProject.delivery_address && (
              <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">{nextProject.delivery_address}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
