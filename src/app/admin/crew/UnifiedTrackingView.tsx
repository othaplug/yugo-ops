"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import { CaretRight, House, MapPin, X, Warning } from "@phosphor-icons/react";
import { TrackingFreshness } from "@/components/tracking/TrackingFreshness";
import { useTheme } from "../components/ThemeContext";
import { formatJobId, getMoveCode } from "@/lib/move-code";
import {
  TierLetterBadge,
  residentialTierFullLabel,
} from "@/design-system/admin/primitives";

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
  at_pickup: "#2C3E2D",
  loading: "#2C3E2D",
  en_route_delivery: "#3B82F6",
  at_delivery: "#2C3E2D",
  unloading: "#2C3E2D",
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
  tier_selected?: string | null;
  /** Present when server sends full row (crews-map / page). */
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
}

interface Delivery {
  id: string;
  delivery_number?: string;
  crew_id: string;
  scheduled_date?: string;
  status: string;
  delivery_address?: string;
  pickup_address?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
}

interface Session {
  id: string;
  /** UUID of moves.id or deliveries.id — use for matching todayMoves / todayDeliveries. */
  jobRecordId?: string;
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
  nav_eta_seconds?: number | null;
  nav_distance_remaining_m?: number | null;
  is_navigating?: boolean;
}

interface StreamSessionPayload {
  team_id: string;
  job_id?: string;
  lastLocation?: { lat: number; lng: number } | null;
  status?: string;
  updatedAt?: string;
}

/* ── Helpers ── */

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
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

/** List / map label: member names when available, otherwise team name without a leading "Team " prefix. */
function crewMemberLine(
  members: string[] | undefined | null,
  teamName: string,
): string {
  if (members && members.length > 0) {
    const parts = members.map((m) => m.trim()).filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  return (teamName || "Crew").replace(/^Team\s+/i, "");
}

/** Two-letter avatar from the first member when possible, else from the team name. */
function crewAvatarInitials(
  members: string[] | undefined | null,
  teamName: string,
): string {
  if (members && members.length > 0) {
    const first = members[0].trim();
    if (first) {
      const w = first.split(/\s+/).filter(Boolean);
      if (w.length >= 2) {
        const a = w[0][0] ?? "";
        const b = w[w.length - 1][0] ?? "";
        return `${a}${b}`.toUpperCase().slice(0, 2);
      }
      return first.slice(0, 2).toUpperCase();
    }
  }
  return (teamName || "?")
    .replace(/^Team\s+/i, "")
    .slice(0, 2)
    .toUpperCase();
}

/** crew_locations row first, then tracking session stage, then coarse crew en-route fallback — matches CrewPopup. */
function effectiveTrackingStatus(
  crew: Crew,
  crewLocation: CrewLocation | undefined,
  session: Session | undefined,
): string {
  return (
    crewLocation?.status ||
    session?.status ||
    (crew.status === "en-route" ? "en_route_pickup" : "idle")
  );
}

function getOfflineMinutes(updatedAt: string | undefined): number {
  if (!updatedAt) return 999;
  return (Date.now() - new Date(updatedAt).getTime()) / 60000;
}

/** Match LiveTrackingMap: leg toward pickup vs destination. */
const SESSION_STATUS_HEADING_PICKUP = new Set([
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route",
  "on_route",
  "arrived",
  "arrived_on_site",
  "loading",
]);

type RouteEndMarker = {
  lng: number;
  lat: number;
  role: "pickup" | "dropoff";
};

function routeTargetsPickupLeg(
  sessionStatus: string | undefined,
  crewLocStatus: string | undefined,
): boolean {
  const cl = (crewLocStatus || "").toLowerCase();
  if (
    cl === "en_route_delivery" ||
    cl === "at_delivery" ||
    cl === "unloading" ||
    cl === "returning"
  )
    return false;
  if (cl === "en_route_pickup" || cl === "at_pickup" || cl === "loading")
    return true;
  const s = (sessionStatus || "").trim().toLowerCase();
  if (!s) return false;
  return SESSION_STATUS_HEADING_PICKUP.has(s);
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
          const lng =
            loc != null
              ? Number(loc.lng)
              : crew?.current_lng != null
                ? Number(crew.current_lng)
                : NaN;
          const lat =
            loc != null
              ? Number(loc.lat)
              : crew?.current_lat != null
                ? Number(crew.current_lat)
                : NaN;
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

      /** While a team stays selected, keep their marker in frame as GPS updates (throttled). */
      function FollowSelectedCrewOnGps({
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
        const lastEaseAt = useRef(0);
        trackingRef.current = { crews, crewLocations };

        useEffect(() => {
          if (!selectedCrew) return;
          const map = mapRef?.getMap?.();
          if (!map) return;

          const { crews: cList, crewLocations: locMap } = trackingRef.current;
          const loc = locMap.get(selectedCrew);
          const crew = cList.find((x) => x.id === selectedCrew);
          const lng =
            loc != null
              ? Number(loc.lng)
              : crew?.current_lng != null
                ? Number(crew.current_lng)
                : NaN;
          const lat =
            loc != null
              ? Number(loc.lat)
              : crew?.current_lat != null
                ? Number(crew.current_lat)
                : NaN;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          const now = Date.now();
          if (now - lastEaseAt.current < 1100) return;
          lastEaseAt.current = now;

          const bottomPad =
            typeof window !== "undefined"
              ? Math.min(300, Math.round(window.innerHeight * 0.38))
              : 200;

          try {
            map.easeTo({
              center: [lng, lat],
              zoom: Math.max(map.getZoom(), 13.5),
              duration: 600,
              padding: {
                top: 72,
                left: 40,
                right: 40,
                bottom: bottomPad,
              },
            });
          } catch {
            /* map may be tearing down */
          }
        }, [selectedCrew, mapRef, crewLocations, crews]);

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
        routeEnds,
        office,
        activeSessions,
        mapStyle,
        mapStyleIsLight,
      }: {
        crews: Crew[];
        crewLocations: Map<string, CrewLocation>;
        center: { lat: number; lng: number };
        zoom: number;
        selectedCrew: string | null;
        onCrewClick: (id: string) => void;
        routeLines: Map<string, [number, number][]>;
        routeEnds: Map<string, RouteEndMarker>;
        office: OfficeConfig;
        activeSessions: Session[];
        mapStyle: string;
        mapStyleIsLight: boolean;
      }) {
        const crewLabelChrome = mapStyleIsLight
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
        const crewLabelText = mapStyleIsLight ? "#1a1816" : "#ffffff";
        const crewFreshTone = mapStyleIsLight
          ? ("light" as const)
          : ("dark" as const);
        const hqBadgeStyle = mapStyleIsLight
          ? {
              background: "linear-gradient(135deg, #ffffff 0%, #f2efe9 100%)",
              color: "#2C3E2D",
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }
          : {
              background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)",
              color: "#2C3E2D",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            };
        const hqDotStyle = mapStyleIsLight
          ? {
              background:
                "radial-gradient(circle at 35% 35%, #4a6b4e, #2C3E2D)",
              boxShadow:
                "0 0 0 2px rgba(44,62,45,0.2), 0 0 8px rgba(44,62,45,0.25), 0 1px 3px rgba(0,0,0,0.15)",
            }
          : {
              background:
                "radial-gradient(circle at 35% 35%, #4a6b4e, #2C3E2D)",
              boxShadow:
                "0 0 0 3px var(--gdim), 0 0 10px var(--gdim), 0 1px 3px rgba(0,0,0,0.4)",
            };
        /** Forest on light basemap; bright rose on dark / wine mode so the line stays visible on Mapbox dark tiles. */
        const routeLineColor = mapStyleIsLight ? "#2C3E2D" : "#FB7185";
        return (
          <M
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: center.lng,
              latitude: center.lat,
              zoom,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={mapStyle}
          >
            <FlyToSelectedCrew
              crews={crews}
              crewLocations={crewLocations}
              selectedCrew={selectedCrew}
            />
            <FollowSelectedCrewOnGps
              crews={crews}
              crewLocations={crewLocations}
              selectedCrew={selectedCrew}
            />
            {/* Route lines for active jobs */}
            {Array.from(routeLines.entries()).map(([crewId, coords]) => {
              if (coords.length < 2) return null;
              const geojson = {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: coords },
              };
              return (
                <Source
                  key={`route-${crewId}`}
                  id={`route-${crewId}`}
                  type="geojson"
                  data={geojson}
                >
                  <Layer
                    id={`route-line-${crewId}`}
                    type="line"
                    paint={{
                      "line-color": routeLineColor,
                      "line-width": mapStyleIsLight ? 6 : 7,
                      "line-opacity": mapStyleIsLight ? 0.9 : 0.95,
                    }}
                  />
                </Source>
              );
            })}

            {/* Route destination: where this leg is headed (pickup vs delivery address) */}
            {Array.from(routeEnds.entries()).map(([crewId, end]) => (
              <Marker
                key={`route-end-${crewId}`}
                longitude={end.lng}
                latitude={end.lat}
                anchor="center"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{
                    background: end.role === "pickup" ? "#22C55E" : "#2C3E2D",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.28)",
                  }}
                  title={
                    end.role === "pickup"
                      ? "Next stop: pickup"
                      : "Next stop: destination"
                  }
                  aria-label={
                    end.role === "pickup"
                      ? "Next stop: pickup"
                      : "Next stop: destination"
                  }
                >
                  {end.role === "pickup" ? (
                    <MapPin
                      size={20}
                      weight="fill"
                      className="text-white"
                      aria-hidden
                    />
                  ) : (
                    <House
                      size={20}
                      weight="fill"
                      className="text-white"
                      aria-hidden
                    />
                  )}
                </div>
              </Marker>
            ))}

            {/* Yugo HQ marker */}
            <Marker
              longitude={office.lng}
              latitude={office.lat}
              anchor="bottom"
            >
              <div className="flex flex-col items-center group cursor-default">
                {/* Label */}
                <span
                  className="mb-1 px-2.5 py-1 rounded-sm text-[9px] font-semibold tracking-[0.06em] uppercase whitespace-nowrap opacity-90 group-hover:opacity-100 transition-opacity"
                  style={hqBadgeStyle}
                >
                  Yugo HQ
                </span>
                {/* Pin shaft + dot */}
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full" style={hqDotStyle} />
                  <div
                    className="w-px h-2"
                    style={{
                      background:
                        "linear-gradient(to bottom, #2C3E2D, transparent)",
                    }}
                  />
                </div>
              </div>
            </Marker>

            {/* Crew markers */}
            {crews
              .filter((c) => c.current_lat != null && c.current_lng != null)
              .map((c) => {
                const loc = crewLocations.get(c.id);
                const session = activeSessions.find((s) => s.teamId === c.id);
                const status = effectiveTrackingStatus(c, loc, session);
                const ringColor = teamColor(c.id);
                const offMin = getOfflineMinutes(
                  loc?.updated_at || c.updated_at,
                );
                const isSelected = selectedCrew === c.id;
                const heading =
                  loc?.heading != null ? Number(loc.heading) : null;

                let warningBadge: "yellow" | "red" | null = null;
                if (isOnJob(status)) {
                  if (offMin >= 15) warningBadge = "red";
                  else if (offMin >= 5) warningBadge = "yellow";
                }

                return (
                  <Marker
                    key={c.id}
                    longitude={c.current_lng!}
                    latitude={c.current_lat!}
                    anchor="center"
                  >
                    <button
                      type="button"
                      onClick={() => onCrewClick(c.id)}
                      className={`relative cursor-pointer transition-transform ${isSelected ? "scale-125 z-10" : "hover:scale-110"}`}
                      title={`${crewMemberLine(c.members, c.name)}, ${getStatusLabel(status)}`}
                    >
                      {/* Glass pill label, always horizontal above the marker */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-col items-center gap-0.5 pointer-events-none max-w-[min(200px,70vw)]">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm whitespace-nowrap"
                          style={crewLabelChrome}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background: ringColor,
                              boxShadow: isOnJob(status)
                                ? `0 0 6px ${ringColor}`
                                : undefined,
                            }}
                          />
                          <span
                            className="text-[11px] font-bold tracking-[0.06em]"
                            style={{ color: crewLabelText }}
                          >
                            {crewMemberLine(c.members, c.name)}
                          </span>
                        </div>
                        <span
                          className={`text-[8px] font-medium text-center px-1 leading-tight ${mapStyleIsLight ? "text-[var(--tx3)]" : "text-white/70"}`}
                        >
                          <TrackingFreshness
                            tone={crewFreshTone}
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
                            transform:
                              heading != null
                                ? `rotate(${heading}deg)`
                                : "none",
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
                          style={{
                            backgroundColor:
                              warningBadge === "red" ? "#EF4444" : "#F59E0B",
                          }}
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
  { ssr: false },
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
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const status = effectiveTrackingStatus(crew, crewLocation, session);
  const speedKmh =
    crewLocation?.speed != null
      ? Math.round(Number(crewLocation.speed) * 3.6)
      : null;
  const offMin = getOfflineMinutes(crewLocation?.updated_at || crew.updated_at);

  const crewMoves = todayMoves.filter((m) => m.crew_id === crew.id);
  const currentMove = crewMoves.find((m) =>
    ["in_progress", "confirmed", "scheduled"].includes(m.status),
  );

  const clientName =
    crewLocation?.current_client_name || currentMove?.client_name || null;
  const fromAddr =
    crewLocation?.current_from_address || currentMove?.from_address || null;
  const toAddr =
    crewLocation?.current_to_address || currentMove?.to_address || null;

  const navSec = crewLocation?.nav_eta_seconds;
  const etaMin =
    navSec != null && Number.isFinite(Number(navSec)) && Number(navSec) >= 0
      ? Math.max(1, Math.round(Number(navSec) / 60))
      : null;
  const navDistM = crewLocation?.nav_distance_remaining_m;

  const detailHref =
    session?.detailHref ||
    (currentMove
      ? `/admin/moves/${currentMove.move_code || currentMove.id}`
      : null);

  return (
    <div
      className={`fixed sm:absolute bottom-0 sm:top-4 left-0 right-0 sm:left-auto sm:right-4 sm:bottom-auto w-full sm:w-[340px] flex flex-col overflow-hidden bg-[var(--card)] border-t sm:border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl shadow-xl z-30 animate-fade-up transition-[height,max-height] duration-300 ease-out ${
        sheetExpanded ? "max-sm:h-[min(70vh,720px)]" : "max-sm:h-[38vh]"
      } sm:max-h-[480px] sm:h-auto`}
      role="dialog"
      aria-label="Crew details"
    >
      <div className="sm:hidden shrink-0 flex justify-center pt-2.5 pb-1">
        <button
          type="button"
          onClick={() => setSheetExpanded((e) => !e)}
          aria-expanded={sheetExpanded}
          aria-label={
            sheetExpanded ? "Collapse crew details" : "Expand crew details"
          }
          className="flex w-full max-w-[120px] items-center justify-center rounded-lg py-1.5 touch-manipulation active:bg-[var(--bg)]/50"
        >
          <span
            className="h-1 w-9 rounded-full bg-[var(--tx3)]/45"
            aria-hidden
          />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 pt-0 sm:pt-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shadow"
              style={{
                background: "linear-gradient(135deg, #2C3E2D, #5C1A33)",
              }}
            >
              {crewAvatarInitials(crew.members, crew.name)}
            </div>
            <div>
              <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)]">
                {crewMemberLine(crew.members, crew.name)}
              </h3>
              <span className="text-[10px] text-[var(--tx3)]">
                {crew.members && crew.members.length > 0
                  ? `${crew.members.length} mover${crew.members.length !== 1 ? "s" : ""}`
                  : (crew.name || "Crew").replace(/^Team\s+/i, "")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--tx3)] hover:bg-[var(--bg)] hover:text-[var(--tx)] transition-colors"
            aria-label="Close"
          >
            <X size={16} weight="regular" className="text-current" />
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center gap-1.5 dt-badge tracking-[0.04em]"
            style={{
              color: STATUS_RING[status] || "#6B7280",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_RING[status] || "#6B7280" }}
            />
            {getStatusLabel(status)}
          </span>
        </div>

        {/* Current job */}
        {(clientName || currentMove) && (
          <div className="pt-3 mt-3 border-t border-[var(--brd)]/30">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
              Current Job
            </div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">
              {clientName || "-"}
            </div>
            {fromAddr && toAddr && (
              <div className="text-[11px] text-[var(--tx2)] mt-1">
                {fromAddr} → {toAddr}
              </div>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3 pt-3 mt-3 border-t border-[var(--brd)]/30">
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
              Speed
            </div>
            <div className="text-[var(--text-base)] font-bold text-[var(--tx)] mt-0.5">
              {speedKmh != null ? `${speedKmh}` : "-"}
            </div>
            <div className="text-[8px] text-[var(--tx3)]">km/h</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
              ETA
            </div>
            <div className="text-[var(--text-base)] font-bold text-[var(--tx)] mt-0.5">
              {etaMin != null ? `${etaMin}` : "-"}
            </div>
            <div className="text-[8px] text-[var(--tx3)]">min</div>
            {navDistM != null && Number.isFinite(Number(navDistM)) && (
              <div className="text-[8px] text-[var(--tx3)] mt-0.5">
                {Number(navDistM) < 1000
                  ? `${Math.round(Number(navDistM))} m`
                  : `${(Number(navDistM) / 1000).toFixed(1)} km`}{" "}
                left
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
              Last GPS
            </div>
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
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">
            Team
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(crew.members || []).map((m) => (
              <span
                key={m}
                className="px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {detailHref && (
          <Link
            href={detailHref}
            className="flex items-center justify-center gap-1 py-2.5 rounded-sm border border-[var(--brd)] bg-[var(--bg)] text-[var(--tx)] text-[11px] font-bold uppercase tracking-[0.06em] hover:bg-[var(--bg2)] transition-colors [font-family:var(--font-body)]"
          >
            View job details
            <CaretRight
              size={14}
              weight="bold"
              className="shrink-0"
              aria-hidden
            />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */

const DEFAULT_OFFICE: OfficeConfig = {
  lat: 43.66027,
  lng: -79.35365,
  address: "50 Carroll St, Toronto, ON M4M 3G3",
  radiusM: 200,
};

export default function UnifiedTrackingView({
  initialCrews,
  initialDeliveries,
  todayMoves = [],
  todayDeliveries = [],
  routeMoves,
  routeDeliveries,
  office = DEFAULT_OFFICE,
}: {
  initialCrews: Crew[];
  initialDeliveries: Delivery[];
  todayMoves?: Move[];
  todayDeliveries?: Delivery[];
  /** When set, used to resolve pickup/delivery coords for polylines (not limited to today's schedule). */
  routeMoves?: Move[];
  routeDeliveries?: Delivery[];
  office?: OfficeConfig;
}) {
  const movesForRoutes = routeMoves ?? todayMoves;
  const deliveriesForRoutes = routeDeliveries ?? todayDeliveries;
  const [crews, setCrews] = useState<Crew[]>(initialCrews);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventSourceConnected, setEventSourceConnected] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [crewLocations, setCrewLocations] = useState<Map<string, CrewLocation>>(
    new Map(),
  );
  const [routeOverlay, setRouteOverlay] = useState<{
    lines: Map<string, [number, number][]>;
    ends: Map<string, RouteEndMarker>;
  }>(() => ({ lines: new Map(), ends: new Map() }));
  const [activePanel, setActivePanel] = useState<"jobs" | "teams">("jobs");
  const [jobsPanelExpanded, setJobsPanelExpanded] = useState(true);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);

  const { theme } = useTheme();
  const mapStyleIsLight = theme === "light";
  const mapStyle = mapStyleIsLight
    ? "mapbox://styles/mapbox/light-v11"
    : "mapbox://styles/mapbox/dark-v11";

  // Tick to refresh relative times
  useEffect(() => {
    const id = setInterval(() => setRelativeTimeTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  /** One live job on the map: auto-select that team so the view follows GPS without an extra click. */
  useEffect(() => {
    const withPos = activeSessions.filter(
      (s) =>
        s.teamId &&
        crews.some(
          (c) =>
            c.id === s.teamId && c.current_lat != null && c.current_lng != null,
        ),
    );
    if (withPos.length !== 1) return;
    const tid = withPos[0].teamId;
    if (!tid) return;
    setSelectedCrew((prev) => (prev != null ? prev : tid));
  }, [activeSessions, crews]);

  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/tracking/crews-map");
      const d = await r.json();
      if (r.ok && d && Array.isArray(d.crews)) {
        setCrews(d.crews);
        setActiveSessions(
          Array.isArray(d.activeSessions) ? d.activeSessions : [],
        );
        if (Array.isArray(d.crewLocations)) {
          setCrewLocations(
            new Map(
              (d.crewLocations as CrewLocation[]).map((row) => [
                row.crew_id,
                row,
              ]),
            ),
          );
        }
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
              next.set(loc.crew_id, {
                ...loc,
                nav_eta_seconds:
                  loc.nav_eta_seconds != null
                    ? Number(loc.nav_eta_seconds)
                    : null,
                nav_distance_remaining_m:
                  loc.nav_distance_remaining_m != null
                    ? Number(loc.nav_distance_remaining_m)
                    : null,
                is_navigating: Boolean(loc.is_navigating),
              });
              return next;
            });
            // Also update crew position for map markers
            setCrews((prev) =>
              prev.map((c) =>
                c.id === loc.crew_id
                  ? {
                      ...c,
                      current_lat: Number(loc.lat),
                      current_lng: Number(loc.lng),
                      updated_at: loc.updated_at,
                    }
                  : c,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    es.addEventListener("error", () => {
      setEventSourceConnected(false);
    });

    es.addEventListener("sessions", (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d?.sessions) {
          setActiveSessions(
            d.sessions.map((s: any) => ({
              // eslint-disable-line @typescript-eslint/no-explicit-any
              id: s.id,
              jobRecordId: s.jobRecordId || s.job_id,
              jobId: s.jobId,
              jobType: s.job_type,
              status: s.status,
              teamName: s.teamName,
              teamId: s.team_id,
              lastLocation: s.lastLocation,
              updatedAt: s.updatedAt || "",
              detailHref: s.detailHref,
              jobName: s.jobName,
            })),
          );
          setCrews((prev) => {
            const sessions = d.sessions as StreamSessionPayload[];
            const sessionByTeam = new Map<string, StreamSessionPayload>(
              sessions.map((s) => [s.team_id, s]),
            );
            return prev.map((c) => {
              const s = sessionByTeam.get(c.id);
              if (!s) return c;
              const hasLoc =
                s.lastLocation?.lat != null && s.lastLocation?.lng != null;
              // Fall back to crewLocations (Supabase Realtime) if session has no position
              const loc = !hasLoc ? crewLocations.get(c.id) : null;
              const fallbackLat = loc?.lat ?? c.current_lat;
              const fallbackLng = loc?.lng ?? c.current_lng;
              return {
                ...c,
                current_lat: hasLoc ? s.lastLocation!.lat : fallbackLat,
                current_lng: hasLoc ? s.lastLocation!.lng : fallbackLng,
                status:
                  s.status && !["completed", "not_started"].includes(s.status)
                    ? "en-route"
                    : "standby",
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

  const routeFetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Fetch route lines: correct job (UUID), pickup vs delivery leg, moves + deliveries; debounced.
  useEffect(() => {
    if (!HAS_MAPBOX) return;
    if (routeFetchDebounceRef.current)
      clearTimeout(routeFetchDebounceRef.current);
    routeFetchDebounceRef.current = setTimeout(() => {
      routeFetchDebounceRef.current = null;
      void (async () => {
        const newRoutes = new Map<string, [number, number][]>();
        const newEnds = new Map<string, RouteEndMarker>();
        for (const s of activeSessions) {
          if (!s.jobRecordId) continue;
          const crew = crews.find((c) => c.id === s.teamId);
          if (
            crew == null ||
            crew.current_lat == null ||
            crew.current_lng == null
          )
            continue;

          const loc = crewLocations.get(s.teamId);
          const pickupLeg = routeTargetsPickupLeg(s.status, loc?.status);
          const move =
            s.jobType === "move"
              ? movesForRoutes.find((m) => m.id === s.jobRecordId)
              : undefined;
          const delivery =
            s.jobType === "delivery"
              ? deliveriesForRoutes.find((d) => d.id === s.jobRecordId)
              : undefined;

          let destLngLat: [number, number] | null = null;

          if (s.jobType === "move" && move) {
            if (pickupLeg && move.from_lat != null && move.from_lng != null) {
              destLngLat = [Number(move.from_lng), Number(move.from_lat)];
            } else if (
              !pickupLeg &&
              move.to_lat != null &&
              move.to_lng != null
            ) {
              destLngLat = [Number(move.to_lng), Number(move.to_lat)];
            }
          } else if (s.jobType === "delivery" && delivery) {
            if (
              pickupLeg &&
              delivery.pickup_lat != null &&
              delivery.pickup_lng != null
            ) {
              destLngLat = [
                Number(delivery.pickup_lng),
                Number(delivery.pickup_lat),
              ];
            } else if (
              !pickupLeg &&
              delivery.delivery_lat != null &&
              delivery.delivery_lng != null
            ) {
              destLngLat = [
                Number(delivery.delivery_lng),
                Number(delivery.delivery_lat),
              ];
            }
          }

          let destAddr: string | null = null;
          if (!destLngLat) {
            if (pickupLeg) {
              destAddr =
                loc?.current_from_address ||
                move?.from_address ||
                delivery?.pickup_address ||
                null;
            } else {
              destAddr =
                loc?.current_to_address ||
                move?.to_address ||
                delivery?.delivery_address ||
                null;
            }
          }

          let resolvedDest: [number, number] | null = destLngLat;
          if (!resolvedDest && destAddr?.trim()) {
            try {
              const geoRes = await fetch(
                `/api/mapbox/geocode?q=${encodeURIComponent(destAddr.trim())}&limit=1`,
                { credentials: "include" },
              );
              const geoData = await geoRes.json();
              const feature = geoData?.features?.[0];
              const coords = feature?.geometry?.coordinates;
              if (coords && coords.length >= 2) {
                resolvedDest = [coords[0], coords[1]];
              }
            } catch {
              /* geocode failed */
            }
          }
          if (!resolvedDest) continue;

          const from = `${crew.current_lng},${crew.current_lat}`;
          const toParam = `${resolvedDest[0]},${resolvedDest[1]}`;

          let lineCoords: [number, number][] | null = null;
          try {
            const res = await fetch(
              `/api/mapbox/directions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(toParam)}`,
              { credentials: "include" },
            );
            if (res.ok) {
              const data = await res.json();
              if (
                Array.isArray(data?.coordinates) &&
                data.coordinates.length >= 2
              ) {
                lineCoords = data.coordinates;
              }
            } else {
              console.warn("[UnifiedTracking] directions API", res.status);
            }
          } catch (err) {
            console.warn("[UnifiedTracking] route fetch failed", err);
          }

          if (!lineCoords) {
            lineCoords = [
              [Number(crew.current_lng), Number(crew.current_lat)],
              resolvedDest,
            ];
          }
          newRoutes.set(s.teamId, lineCoords);
          const endCoord = lineCoords[lineCoords.length - 1];
          if (endCoord && endCoord.length >= 2) {
            newEnds.set(s.teamId, {
              lng: endCoord[0],
              lat: endCoord[1],
              role: pickupLeg ? "pickup" : "dropoff",
            });
          }
        }
        setRouteOverlay((prev) => {
          if (prev.lines.size !== newRoutes.size) {
            return { lines: newRoutes, ends: newEnds };
          }
          for (const [k, v] of newRoutes) {
            const o = prev.lines.get(k);
            if (
              !o ||
              o.length !== v.length ||
              JSON.stringify(o) !== JSON.stringify(v)
            ) {
              return { lines: newRoutes, ends: newEnds };
            }
          }
          for (const [k, e] of newEnds) {
            const pe = prev.ends.get(k);
            if (
              !pe ||
              pe.lng !== e.lng ||
              pe.lat !== e.lat ||
              pe.role !== e.role
            ) {
              return { lines: newRoutes, ends: newEnds };
            }
          }
          for (const k of prev.ends.keys()) {
            if (!newEnds.has(k)) return { lines: newRoutes, ends: newEnds };
          }
          return prev;
        });
      })();
    }, 700);
    return () => {
      if (routeFetchDebounceRef.current)
        clearTimeout(routeFetchDebounceRef.current);
    };
  }, [
    activeSessions,
    crews,
    crewLocations,
    movesForRoutes,
    deliveriesForRoutes,
  ]);

  const crewsWithPosition = crews.filter(
    (c) => c.current_lat != null && c.current_lng != null,
  );
  const center =
    crewsWithPosition.length > 0
      ? {
          lat:
            crewsWithPosition.reduce((s, c) => s + (c.current_lat || 0), 0) /
            crewsWithPosition.length,
          lng:
            crewsWithPosition.reduce((s, c) => s + (c.current_lng || 0), 0) /
            crewsWithPosition.length,
        }
      : DEFAULT_CENTER;
  const zoom =
    crewsWithPosition.length > 1
      ? 11
      : crewsWithPosition.length === 1
        ? 14
        : 11;
  const selectedCrewData = selectedCrew
    ? crews.find((c) => c.id === selectedCrew)
    : null;

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Full-bleed map with overlaid panels */}
      <div className="relative w-full h-full">
        {/* Map */}
        <div className="absolute inset-0 w-full h-full">
          {HAS_MAPBOX ? (
            <GodEyeMap
              key={mapStyle}
              crews={crews}
              crewLocations={crewLocations}
              center={center}
              zoom={zoom}
              selectedCrew={selectedCrew}
              onCrewClick={(id) =>
                setSelectedCrew(selectedCrew === id ? null : id)
              }
              routeLines={routeOverlay.lines}
              routeEnds={routeOverlay.ends}
              office={office}
              activeSessions={activeSessions}
              mapStyle={mapStyle}
              mapStyleIsLight={mapStyleIsLight}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[var(--bg2)] text-[var(--tx2)] text-[12px]">
              Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable map
            </div>
          )}
        </div>

        {/* Top-left: connection status */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--brd)] shadow-md max-w-[min(calc(100vw-24px),20rem)] sm:max-w-none overflow-hidden">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${eventSourceConnected ? "bg-[var(--grn)]" : "bg-[var(--red)] animate-pulse"}`}
          />
          <span className="text-[12px] font-semibold text-[var(--tx)] tabular-nums">
            {eventSourceConnected ? "Live" : "Reconnecting…"}
          </span>
          <span className="text-[11px] text-[var(--tx2)] tabular-nums">
            {crewsWithPosition.length} team
            {crewsWithPosition.length !== 1 ? "s" : ""} on map
          </span>
          {loading && (
            <span className="text-[9px] text-[var(--tx3)] animate-pulse">
              Updating…
            </span>
          )}
        </div>

        {/* Bottom panel: Active Jobs + Teams, full-width bottom sheet on mobile, floating card on desktop */}
        <div
          className={`absolute bottom-0 left-0 right-0 sm:bottom-3 sm:left-3 sm:right-auto z-10 w-full sm:w-[360px] flex flex-col overflow-hidden bg-[var(--card)] border-t sm:border border-[var(--brd)] sm:rounded-xl shadow-lg rounded-t-2xl sm:rounded-xl transition-[height,max-height] duration-300 ease-out ${
            jobsPanelExpanded ? "max-sm:h-[46vh]" : "max-sm:h-[30vh]"
          } sm:max-h-[55vh] sm:h-auto`}
        >
          <div className="sm:hidden shrink-0 flex justify-center pt-1 pb-0">
            <button
              type="button"
              onClick={() => setJobsPanelExpanded((e) => !e)}
              aria-expanded={jobsPanelExpanded}
              aria-label={
                jobsPanelExpanded
                  ? "Collapse jobs and teams panel"
                  : "Expand jobs and teams panel"
              }
              className="flex w-full max-w-[120px] items-center justify-center rounded-lg py-1 touch-manipulation active:bg-[var(--bg)]/40"
            >
              <span
                className="h-1 w-9 rounded-full bg-[var(--tx3)]/45"
                aria-hidden
              />
            </button>
          </div>
          {/* Panel tabs */}
          <div className="flex shrink-0 border-b border-[var(--brd)]">
            <button
              type="button"
              onClick={() => setActivePanel("jobs")}
              className={`flex-1 px-3 py-1.5 sm:py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] tabular-nums transition-colors ${activePanel === "jobs" ? "text-[var(--accent-text)] border-b-2 border-[var(--gold)]" : "text-[var(--tx3)] hover:text-[var(--tx2)]"}`}
            >
              {(() => {
                const STALE_TAB_MS = 90 * 60 * 1000;
                const freshCount = activeSessions.filter(
                  (s) =>
                    !s.updatedAt ||
                    Date.now() - new Date(s.updatedAt).getTime() <=
                      STALE_TAB_MS,
                ).length;
                if (freshCount > 0) return `Live (${freshCount})`;
                if (activeSessions.length > 0)
                  return `Recent (${activeSessions.length})`;
                if (todayMoves.length + todayDeliveries.length > 0)
                  return `Today (${todayMoves.length + todayDeliveries.length})`;
                return "Jobs";
              })()}
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("teams")}
              className={`flex-1 px-3 py-1.5 sm:py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] tabular-nums transition-colors ${activePanel === "teams" ? "text-[var(--accent-text)] border-b-2 border-[var(--gold)]" : "text-[var(--tx3)] hover:text-[var(--tx2)]"}`}
            >
              Teams ({crews.length})
            </button>
          </div>

          {/* Panel content */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:flex-initial sm:max-h-[45vh]">
            {activePanel === "jobs" && (
              <>
                {/* Live sessions */}
                {activeSessions.length > 0 &&
                  (() => {
                    const STALE_HEADER_MS = 12 * 60 * 60 * 1000;
                    const allStale = activeSessions.every(
                      (s) =>
                        s.updatedAt &&
                        Date.now() - new Date(s.updatedAt).getTime() >
                          STALE_HEADER_MS,
                    );
                    return (
                      <>
                        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                          {!allStale ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--admin-primary-fill)] opacity-60" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--admin-primary-fill)]" />
                              </span>
                              <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--accent-text)]">
                                Active Now
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tx3)]/40" />
                              </span>
                              <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">
                                Recent Sessions
                              </span>
                            </>
                          )}
                        </div>
                        {activeSessions.map((s) => {
                          const loc = crewLocations.get(s.teamId);
                          const effectiveStatus =
                            loc?.status || s.status || "idle";
                          const statusLabel = getStatusLabel(effectiveStatus);
                          const ringColor = teamColor(s.teamId);

                          const STAGE_ORDER: Record<string, number> = {
                            en_route_pickup: 0,
                            at_pickup: 1,
                            loading: 1,
                            en_route_delivery: 2,
                            at_delivery: 3,
                            unloading: 3,
                            returning: 4,
                            completed: 4,
                            delivered: 4,
                          };
                          const stageIdx = STAGE_ORDER[effectiveStatus] ?? -1;
                          const STAGE_LABELS = [
                            "En route",
                            "Pickup",
                            "Transit",
                            "Delivery",
                            "Done",
                          ];

                          const clientName =
                            loc?.current_client_name || s.jobName || null;
                          const fromAddr = loc?.current_from_address || null;
                          const toAddr = loc?.current_to_address || null;
                          const crewForSession = crews.find(
                            (cr) => cr.id === s.teamId,
                          );

                          const STALE_CLIENT_MS = 12 * 60 * 60 * 1000;
                          const updatedMs = s.updatedAt
                            ? Date.now() - new Date(s.updatedAt).getTime()
                            : 0;
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
                                    style={{
                                      background: `linear-gradient(135deg, ${ringColor}CC, ${ringColor}80)`,
                                    }}
                                  >
                                    {crewAvatarInitials(
                                      crewForSession?.members,
                                      s.teamName,
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-bold text-[var(--tx)] truncate">
                                      {crewMemberLine(
                                        crewForSession?.members,
                                        s.teamName,
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[var(--tx3)] truncate">
                                      {clientName || "Job in progress"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span
                                    className="inline-flex items-center gap-1 dt-badge tracking-[0.04em]"
                                    style={{
                                      color: ringColor,
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: ringColor }}
                                    />
                                    {statusLabel}
                                  </span>
                                  <div className="text-[9px] text-[var(--tx3)] mt-0.5">
                                    {formatRelative(s.updatedAt)}
                                  </div>
                                </div>
                              </div>

                              {(fromAddr || toAddr) && (
                                <div className="mt-1.5 text-[10px] text-[var(--tx3)] truncate pl-9">
                                  {fromAddr && toAddr
                                    ? `${fromAddr} → ${toAddr}`
                                    : toAddr || fromAddr}
                                </div>
                              )}

                              {/* Progress bar */}
                              <div className="flex gap-0.5 mt-2 pl-9">
                                {STAGE_LABELS.map((label, i) => (
                                  <div
                                    key={label}
                                    className="flex-1 group/seg relative"
                                  >
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-500 ${
                                        i <= stageIdx
                                          ? i === stageIdx
                                            ? "animate-pulse"
                                            : ""
                                          : ""
                                      }`}
                                      style={{
                                        backgroundColor:
                                          i <= stageIdx
                                            ? ringColor
                                            : "rgba(255,255,255,0.06)",
                                        boxShadow:
                                          i === stageIdx
                                            ? `0 0 6px ${ringColor}60`
                                            : undefined,
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
                {activeSessions.length === 0 &&
                  (todayMoves.length > 0 || todayDeliveries.length > 0) && (
                    <>
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
                          Scheduled Today
                        </span>
                      </div>
                      {todayMoves.map((m) => {
                        const crew = crews.find((c) => c.id === m.crew_id);
                        const moveSlug =
                          (m.move_code && String(m.move_code).replace(/^#/, "").trim()) ||
                          getMoveCode(m);
                        const moveHref = m.move_code
                          ? String(m.move_code).replace(/^#/, "").trim().toUpperCase()
                          : m.id;
                        const moveIdLabel = formatJobId(moveSlug, "move");
                        return (
                          <Link
                            key={m.id}
                            href={`/admin/moves/${moveHref}`}
                            className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
                              <span className="text-[8px] font-bold text-[#3B82F6]">
                                M
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="text-[11px] font-semibold text-[var(--tx)] truncate">
                                  {m.client_name || moveIdLabel}
                                </div>
                                {m.tier_selected ? (
                                  <TierLetterBadge
                                    tier={m.tier_selected}
                                    label={residentialTierFullLabel(m.tier_selected)}
                                    className="shrink-0"
                                  />
                                ) : null}
                              </div>
                              <div className="text-[9px] text-[var(--tx3)] truncate tabular-nums">
                                {m.client_name ? (
                                  <>
                                    {moveIdLabel}
                                    <span className="mx-1 opacity-50">·</span>
                                  </>
                                ) : null}
                                {m.from_address ?? "-"} → {m.to_address ?? "-"}
                              </div>
                            </div>
                            {crew && (
                              <span className="text-[9px] font-medium text-[var(--accent-text)] shrink-0 max-w-[120px] truncate">
                                {crewMemberLine(crew.members, crew.name)}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                      {todayDeliveries.map((d) => {
                        const crew = crews.find((c) => c.id === d.crew_id);
                        const dlvLabel = d.delivery_number
                          ? formatJobId(String(d.delivery_number), "delivery")
                          : "";
                        return (
                          <Link
                            key={d.id}
                            href={`/admin/deliveries/${d.delivery_number || d.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                              <span className="text-[8px] font-bold text-[var(--accent-text)]">
                                D
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-semibold text-[var(--tx)] truncate tabular-nums">
                                {dlvLabel || d.delivery_number || "Delivery"}
                              </div>
                              <div className="text-[9px] text-[var(--tx3)] truncate">
                                {d.pickup_address} → {d.delivery_address}
                              </div>
                            </div>
                            {crew && (
                              <span className="text-[9px] font-medium text-[var(--accent-text)] shrink-0 max-w-[120px] truncate">
                                {crewMemberLine(crew.members, crew.name)}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </>
                  )}

                {activeSessions.length === 0 &&
                  todayMoves.length === 0 &&
                  todayDeliveries.length === 0 && (
                    <div className="px-4 py-10 text-center">
                      <div className="text-[12px] font-medium text-[var(--tx3)]">
                        No jobs today
                      </div>
                      <div className="text-[10px] text-[var(--tx3)]/60 mt-1">
                        Active jobs and crew tracking will appear here
                      </div>
                    </div>
                  )}
              </>
            )}

            {activePanel === "teams" &&
              (crews.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="text-[12px] font-medium text-[var(--tx3)]">
                    No teams configured
                  </div>
                  <div className="text-[10px] text-[var(--tx3)]/60 mt-1">
                    <Link
                      href="/admin/platform?tab=teams"
                      className="text-[var(--accent-text)] hover:underline"
                    >
                      Add teams in settings
                    </Link>
                  </div>
                </div>
              ) : (
                crews.map((c) => {
                  const loc = crewLocations.get(c.id);
                  const session = activeSessions.find((s) => s.teamId === c.id);
                  const offMin = getOfflineMinutes(
                    loc?.updated_at || c.updated_at,
                  );
                  const isNearOffice =
                    c.current_lat != null &&
                    c.current_lng != null &&
                    haversineM(
                      c.current_lat,
                      c.current_lng,
                      office.lat,
                      office.lng,
                    ) < office.radiusM;
                  const hasActiveSession = !!session;
                  const status = effectiveTrackingStatus(c, loc, session);
                  const isOff = offMin >= 30;

                  let locationLabel = "No GPS";
                  if (isNearOffice) locationLabel = "At office";
                  else if (c.current_lat && c.current_lng)
                    locationLabel = isOff
                      ? `Last seen ${formatRelative(loc?.updated_at || c.updated_at || "")}`
                      : getStatusLabel(status);

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
                          background:
                            "linear-gradient(135deg, #2C3E2D, #5C1A33)",
                          boxShadow: `0 0 0 2px ${teamColor(c.id)}`,
                        }}
                      >
                        {crewAvatarInitials(c.members, c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-[var(--tx)] truncate">
                            {crewMemberLine(c.members, c.name)}
                          </span>
                          {hasActiveSession && (
                            <span className="dt-badge tracking-[0.04em] text-[var(--accent-text)]">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                          {c.current_job ? `${c.current_job} · ` : ""}
                          {locationLabel}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOff && <Warning size={10} color="#EF4444" />}
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${isOff ? "" : hasActiveSession ? "animate-pulse" : ""}`}
                          style={{
                            backgroundColor: isOff
                              ? "#EF4444"
                              : teamColor(c.id),
                          }}
                        />
                      </div>
                    </button>
                  );
                })
              ))}
          </div>
        </div>

        {/* Crew detail popup */}
        {selectedCrewData && (
          <CrewPopup
            key={selectedCrewData.id}
            crew={selectedCrewData}
            crewLocation={crewLocations.get(selectedCrewData.id)}
            session={activeSessions.find(
              (s) => s.teamId === selectedCrewData.id,
            )}
            todayMoves={todayMoves}
            onClose={() => setSelectedCrew(null)}
            onViewJob={(href) => {}}
          />
        )}
      </div>
    </div>
  );
}
