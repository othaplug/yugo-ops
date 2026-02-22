"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

const MapboxMap = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => {
    const M = mod.default;
    const Marker = mod.Marker;
    const Nav = mod.NavigationControl;
    return function Map({ markers, center }: { markers: { id: string; lat: number; lng: number; name: string }[]; center: { lat: number; lng: number } }) {
      return (
        <M
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: markers.length > 1 ? 12 : 14 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        >
          {markers.map((m) => (
            <Marker key={m.id} longitude={m.lng} latitude={m.lat} anchor="center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform animate-pulse"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                title={m.name}
              >
                {(m.name?.replace("Team ", "") || "?").slice(0, 1).toUpperCase()}
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

interface Session {
  id: string;
  jobId: string;
  jobType: string;
  jobName: string;
  status: string;
  teamName: string;
  updatedAt: string;
  toAddress: string | null;
  detailHref: string;
}

interface Marker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  jobName: string;
  jobId: string;
  status: string;
  updatedAt: string;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function DispatchMapView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "list">("map");

  const load = async () => {
    try {
      const r = await fetch("/api/tracking/active-map");
      const d = await r.json();
      setSessions(d.sessions || []);
      setMarkers(d.markers || []);
    } catch {
      setSessions([]);
      setMarkers([]);
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
          setSessions(d.sessions);
          const m: Marker[] = d.sessions
            .filter((s: any) => s.lastLocation?.lat != null && s.lastLocation?.lng != null)
            .map((s: any) => ({
              id: s.id,
              lat: s.lastLocation.lat,
              lng: s.lastLocation.lng,
              name: s.teamName,
              jobName: s.jobName,
              jobId: s.jobId,
              status: s.status,
              updatedAt: s.updatedAt || "",
            }));
          setMarkers(m);
        }
      } catch {}
    });
    return () => es.close();
  }, []);

  const center =
    markers.length > 0
      ? {
          lat: markers.reduce((s, m) => s + m.lat, 0) / markers.length,
          lng: markers.reduce((s, m) => s + m.lng, 0) / markers.length,
        }
      : { lat: 43.665, lng: -79.385 };

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-8 text-center text-[var(--tx3)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">Active Operations</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${view === "map" ? "bg-[var(--gold)] text-[#0D0D0D]" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]"}`}
          >
            Map
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${view === "list" ? "bg-[var(--gold)] text-[#0D0D0D]" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]"}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {view === "map" && (
          <div className="lg:col-span-2 rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--card)]" style={{ minHeight: 400 }}>
            {HAS_MAPBOX ? (
              <div style={{ height: 400 }}>
                <MapboxMap markers={markers} center={center} />
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-[var(--tx3)] text-[12px]">
                Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for map
              </div>
            )}
          </div>
        )}
        <div className={view === "map" ? "" : "lg:col-span-3"}>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--brd)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">
                Active Jobs ({sessions.length})
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">
                  No active tracking sessions
                </div>
              ) : (
                sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={s.detailHref}
                    className="block px-4 py-3 border-b border-[var(--brd)] last:border-0 hover:bg-[var(--bg)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shrink-0" />
                      <span className="text-[12px] font-semibold text-[var(--tx)] truncate">
                        {s.teamName}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">
                      {s.jobName} · {s.jobId}
                    </div>
                    <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                      {CREW_STATUS_TO_LABEL[s.status] || s.status}
                    </div>
                    {s.toAddress && (
                      <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                        At: {s.toAddress}
                      </div>
                    )}
                    <div className="text-[9px] text-[var(--tx3)] mt-0.5">
                      Last update: {formatRelative(s.updatedAt)}
                    </div>
                    <div className="text-[10px] text-[var(--gold)] mt-1">View Job Detail →</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
