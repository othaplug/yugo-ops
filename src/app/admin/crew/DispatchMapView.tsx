"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { fetchIntelligentRoute, type ScoredRouteSummary } from "@/lib/routing/intelligent-directions";
import { useTheme } from "../components/ThemeContext";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

const ROUTE_GOLD = "#2C3E2D";

const MapboxMap = dynamic(
  () =>
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;
      const Source = mod.Source;
      const Layer = mod.Layer;
      return function Map({
        markers,
        center,
        routeFeatures,
        mapStyle,
        mapStyleIsLight,
      }: {
        markers: { id: string; lat: number; lng: number; name: string }[];
        center: { lat: number; lng: number };
        routeFeatures: { id: string; coordinates: [number, number][] }[];
        mapStyle: string;
        mapStyleIsLight: boolean;
      }) {
        const labelChrome = mapStyleIsLight
          ? {
              background: "rgba(255,255,255,0.94)",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            }
          : {
              background: "rgba(8,10,16,0.84)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 2px 14px rgba(0,0,0,0.55)",
            };
        const labelText = mapStyleIsLight ? "#1a1816" : "#ffffff";
        return (
          <M
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: markers.length > 1 ? 12 : 14 }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={mapStyle}
          >
            {routeFeatures.map((rf) => (
              <Source
                key={`src-${rf.id}`}
                id={`route-${rf.id}`}
                type="geojson"
                data={{
                  type: "Feature",
                  properties: {},
                  geometry: { type: "LineString", coordinates: rf.coordinates },
                }}
              >
                <Layer
                  id={`route-line-${rf.id}`}
                  type="line"
                  paint={{
                    "line-color": ROUTE_GOLD,
                    "line-width": 4,
                    "line-opacity": 0.85,
                  }}
                />
              </Source>
            ))}
            {markers.map((m) => (
              <Marker key={m.id} longitude={m.lng} latitude={m.lat} anchor="center">
                <div className="relative cursor-pointer hover:scale-110 transition-transform" title={m.name}>
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-sm whitespace-nowrap pointer-events-none"
                    style={labelChrome}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#2C3E2D", boxShadow: "0 0 6px #2C3E2D" }} />
                    <span
                      className="text-[11px] font-bold tracking-[0.06em]"
                      style={{ color: labelText }}
                    >
                      {m.name.replace("Team ", "")}
                    </span>
                  </div>
                  <svg
                    width="22"
                    height="40"
                    viewBox="0 0 22 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.55)) drop-shadow(0 2px 6px rgba(0,0,0,0.75))" }}
                  >
                    <rect x="1.5" y="4" width="19" height="32" rx="4" fill="white" fillOpacity="0.96" />
                    <rect x="3" y="5" width="16" height="8" rx="2.5" fill="#2C3E2D" fillOpacity="0.88" />
                    <rect x="10" y="14" width="2" height="19" rx="1" fill="black" fillOpacity="0.07" />
                    <ellipse cx="1.5" cy="12" rx="2.5" ry="4.5" fill="black" fillOpacity="0.38" />
                    <ellipse cx="1.5" cy="28" rx="2.5" ry="4.5" fill="black" fillOpacity="0.38" />
                    <ellipse cx="20.5" cy="12" rx="2.5" ry="4.5" fill="black" fillOpacity="0.38" />
                    <ellipse cx="20.5" cy="28" rx="2.5" ry="4.5" fill="black" fillOpacity="0.38" />
                    <rect x="3" y="4" width="5" height="2.5" rx="1" fill="rgba(255,255,200,0.9)" />
                    <rect x="14" y="4" width="5" height="2.5" rx="1" fill="rgba(255,255,200,0.9)" />
                    <rect x="3" y="34" width="5" height="2.5" rx="1" fill="rgba(255,70,70,0.75)" />
                    <rect x="14" y="34" width="5" height="2.5" rx="1" fill="rgba(255,70,70,0.75)" />
                  </svg>
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
  lastLocation?: { lat?: number; lng?: number } | null;
  routeDestination?: { lat: number; lng: number } | null;
  isNavigating?: boolean;
  navEtaSeconds?: number | null;
  navDistanceRemainingM?: number | null;
  truckType?: string;
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

const EN_ROUTE_FOR_ROUTE = new Set([
  "en_route_to_pickup",
  "en_route_to_destination",
  "en_route",
  "on_route",
  "in_transit",
]);

export default function DispatchMapView() {
  const { theme } = useTheme();
  const mapStyle =
    theme === "light"
      ? "mapbox://styles/mapbox/light-v11"
      : "mapbox://styles/mapbox/dark-v11";
  const mapStyleIsLight = theme === "light";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [routeFeatures, setRouteFeatures] = useState<{ id: string; coordinates: [number, number][] }[]>([]);
  const [routeInsights, setRouteInsights] = useState<
    Record<string, { summaries: ScoredRouteSummary[]; torontoWarnings: string[] }>
  >({});
  const [fuelPriceCadPerLitre, setFuelPriceCadPerLitre] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "list">("map");

  const sessionsKey = useMemo(
    () =>
      sessions
        .map((s) => {
          const loc = s.lastLocation;
          const d = s.routeDestination;
          return `${s.id}:${loc?.lat},${loc?.lng}:${d?.lat},${d?.lng}:${s.status}:${s.isNavigating ? 1 : 0}:${s.truckType ?? ""}`;
        })
        .join("|"),
    [sessions]
  );

  useEffect(() => {
    if (!HAS_MAPBOX || !MAPBOX_TOKEN) {
      setRouteFeatures([]);
      setRouteInsights({});
      return;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        sessions.map(async (s) => {
          const loc = s.lastLocation;
          const dest = s.routeDestination;
          if (loc?.lat == null || loc?.lng == null || !dest?.lat || !dest?.lng) return null;
          const showRoute = s.isNavigating || EN_ROUTE_FOR_ROUTE.has(s.status);
          if (!showRoute) return null;
          try {
            const result = await fetchIntelligentRoute(
              MAPBOX_TOKEN,
              { lat: loc.lat, lng: loc.lng },
              dest,
              s.truckType ?? null,
              { fuelPriceCadPerLitre }
            );
            if (!result?.coordinates?.length) return null;
            return {
              id: s.id,
              coordinates: result.coordinates,
              summaries: result.summaries,
              torontoWarnings: result.torontoWarnings,
            };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const out: { id: string; coordinates: [number, number][] }[] = [];
      const insights: Record<string, { summaries: ScoredRouteSummary[]; torontoWarnings: string[] }> = {};
      for (const p of pairs) {
        if (!p) continue;
        out.push({ id: p.id, coordinates: p.coordinates });
        insights[p.id] = { summaries: p.summaries, torontoWarnings: p.torontoWarnings };
      }
      setRouteFeatures(out);
      setRouteInsights(insights);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionsKey, fuelPriceCadPerLitre]); // eslint-disable-line react-hooks/exhaustive-deps -- sessions read from closure when key changes

  const load = async () => {
    try {
      const r = await fetch("/api/tracking/active-map");
      const d = await r.json();
      setSessions(d.sessions || []);
      setMarkers(d.markers || []);
      setFuelPriceCadPerLitre(typeof d.fuelPriceCadPerLitre === "number" ? d.fuelPriceCadPerLitre : undefined);
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
          setSessions((prev) => {
            const prevById = new Map(prev.map((x) => [x.id, x]));
            return (d.sessions as Session[]).map((s) => {
              const old = prevById.get(s.id);
                return {
                ...s,
                routeDestination: s.routeDestination ?? old?.routeDestination,
                isNavigating: s.isNavigating ?? old?.isNavigating,
                navEtaSeconds: s.navEtaSeconds ?? old?.navEtaSeconds,
                navDistanceRemainingM: s.navDistanceRemainingM ?? old?.navDistanceRemainingM,
                lastLocation: s.lastLocation ?? old?.lastLocation,
                toAddress: s.toAddress ?? old?.toAddress ?? null,
                truckType: s.truckType ?? old?.truckType,
              };
            });
          });
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
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-sm p-8 text-center text-[var(--tx2)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="admin-section-h2">Active Operations</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("map")}
            className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.06em] ${view === "map" ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]"}`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.06em] ${view === "list" ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]"}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {view === "map" && (
          <div className="lg:col-span-2 rounded-sm border border-[var(--brd)] overflow-hidden bg-[var(--card)]" style={{ minHeight: 400 }}>
            {HAS_MAPBOX ? (
              <div style={{ height: 400 }}>
                <MapboxMap
                  key={mapStyle}
                  markers={markers}
                  center={center}
                  routeFeatures={routeFeatures}
                  mapStyle={mapStyle}
                  mapStyleIsLight={mapStyleIsLight}
                />
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-[var(--tx2)] text-[12px]">
                Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for map
              </div>
            )}
          </div>
        )}
        <div className={view === "map" ? "" : "lg:col-span-3"}>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--brd)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tx2)]">
                Active Jobs ({sessions.length})
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-[var(--tx2)]">
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
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--admin-primary-fill)] shrink-0" />
                      <span className="text-[12px] font-semibold text-[var(--tx)] truncate">
                        {s.teamName}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">
                      {s.jobName} · {s.jobId}
                    </div>
                    <div className="text-[10px] text-[var(--tx2)] mt-0.5">
                      {CREW_STATUS_TO_LABEL[s.status] || s.status}
                    </div>
                    {s.toAddress && (
                      <div className="text-[10px] text-[var(--tx2)] mt-0.5 truncate">
                        At: {s.toAddress}
                      </div>
                    )}
                    {s.navEtaSeconds != null && s.navEtaSeconds > 0 && (
                      <div className="text-[10px] text-[var(--gold)] mt-0.5 font-semibold">
                        ETA ~{Math.max(1, Math.round(s.navEtaSeconds / 60))} min
                        {s.navDistanceRemainingM != null && s.navDistanceRemainingM > 0 && (
                          <span className="text-[var(--tx2)] font-normal">
                            {" "}
                            · {s.navDistanceRemainingM >= 1000 ? `${(s.navDistanceRemainingM / 1000).toFixed(1)} km` : `${Math.round(s.navDistanceRemainingM)} m`}
                          </span>
                        )}
                      </div>
                    )}
                    {routeInsights[s.id]?.torontoWarnings?.length ? (
                      <ul className="text-[9px] text-amber-600/95 dark:text-amber-400/90 mt-1 space-y-0.5 list-disc pl-3.5">
                        {routeInsights[s.id].torontoWarnings.map((w, i) => (
                          <li key={`${i}-${w.slice(0, 32)}`}>{w}</li>
                        ))}
                      </ul>
                    ) : null}
                    {routeInsights[s.id]?.summaries?.length ? (
                      <div className="text-[9px] text-[var(--tx2)] mt-1.5 leading-snug border-t border-[var(--brd)] pt-1.5">
                        {(() => {
                          const sums = routeInsights[s.id].summaries;
                          const best = sums[0];
                          if (!best) return null;
                          return (
                            <>
                              <div className="font-semibold text-[var(--gold)]">Route selected</div>
                              <div>
                                {best.distanceLabel} · ETA {best.etaLabel} · Fuel {best.fuelCostLabel} · Score{" "}
                                {best.score}
                              </div>
                              {best.congestionNote ? (
                                <div className="text-[var(--tx2)] mt-0.5">{best.congestionNote}</div>
                              ) : null}
                              {sums.length > 1 ? (
                                <div className="mt-1">
                                  <div className="font-medium text-[var(--tx2)]">Other Mapbox alternatives</div>
                                  <ul className="mt-0.5 space-y-0.5">
                                    {sums.slice(1).map((alt) => (
                                      <li key={alt.index}>
                                        {alt.distanceLabel} · {alt.etaLabel} · {alt.fuelCostLabel} · Score{" "}
                                        {alt.score}
                                        {alt.congestionNote ? ` — ${alt.congestionNote}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                    <div className="text-[9px] text-[var(--tx2)] mt-0.5">
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
