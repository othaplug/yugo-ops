"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Map, { GeolocateControl, Layer, Marker, Source, useMap } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import type { GeolocateControl as GeolocateControlInstance } from "mapbox-gl";
import * as turf from "@turf/turf";
import {
  ArrowBendDownLeft,
  ArrowBendDownRight,
  ArrowRight,
  ArrowsSplit,
  Compass,
  ForkKnife,
  List,
  MapPin,
  Minus,
  NavigationArrow,
  Plus,
  SignIn,
  SpeakerHigh,
  SpeakerSlash,
  TrafficCone,
  Warning,
} from "@phosphor-icons/react";
import GlobalModal from "@/components/ui/Modal";
import { markCrewLocationAllowed } from "@/lib/crew/useCrewPersistentTracking";
import {
  fetchIntelligentRoute,
  type CrewRouteAlternative,
  type ScoredRouteSummary,
  type TrafficRouteFeatureCollection,
} from "@/lib/routing/intelligent-directions";
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

/** ~50 m cross-track — re-route when crew leaves the polyline (debounced). */
const REROUTE_DEVIATION_M = 55;
const REROUTE_MIN_INTERVAL_MS = 5000;
const ARRIVAL_RADIUS_M = 100;
/** Cap interpolated ETAs — avoids absurd UI when geometry or scale glitches. */
const MAX_SANE_ETA_SEC = 8 * 3600;
const MIN_ROUTE_DIST_FOR_ETA_SCALE_M = 50;
/** Above this, remaining-distance UI is unreliable (bad GPS / dest); show "—" and omit posted distance. */
const MAX_DISPLAY_REMAIN_M = 500_000;
const ETA_JUMP_SOFTEN_SEC = 120;
const ETA_LARGE_JUMP_SEC = 300;
const POST_MIN_MS = 1100;
const REVERSE_GEOCODE_MS = 45_000;
/** When snapping to the route polyline, prefer the earliest segment among those within this perpendicular distance of the best hit (avoids jumping to parallel geometry near the destination). */
const POLYLINE_SNAP_TIE_M = 42;
/** Search segments from max(0, lastHint - N) onward so we do not match a closer-but-wrong part of the route behind the driver. */
const POLYLINE_HINT_LOOKBACK_SEGS = 6;
/** If the window snap is farther than this from the polyline, run a full-polyline search once to re-acquire after reroute / GPS jump. */
const POLYLINE_REACQUIRE_PERP_M = 110;

const GOLD = "#2C3E2D";
/** Single solid route color (no traffic congestion segmentation in the line). */
const CREW_NAV_ROUTE_LINE_COLOR = "#2563EB";
const CREW_NAV_ROUTE_HALO_COLOR = "rgba(37, 99, 235, 0.22)";
const CREW_NAV_LINE_WIDTH = 14;
const CREW_NAV_HALO_WIDTH = CREW_NAV_LINE_WIDTH + 8;
/**
 * Dash-cam style: high pitch so the view hugs the road (low windshield / hood line).
 * Mapbox defaults max pitch to 60; we raise `maxPitch` on the map so this value applies.
 */
const CHASE_PITCH_DEG = 67;
/** Chase point behind the vehicle (m); short offset reads like a low dash mount. */
const CHASE_CAMERA_BACK_M = 22;
/** Follow mode zoom; pairs with pitch so lane detail stays readable. */
const NAV_FOLLOW_ZOOM = 18.05;

const EMPTY_TRAFFIC_ROUTE: TrafficRouteFeatureCollection = { type: "FeatureCollection", features: [] };

/** Viewport-sized shell; portaled to document.body so fixed positioning is not clipped by PageContent / tab-content transforms. */
const CREW_NAV_OVERLAY_CLASS =
  "fixed top-0 left-0 right-0 z-[var(--z-modal)] flex min-h-0 w-full flex-col overflow-hidden overscroll-contain bg-black h-dvh max-h-[100dvh]";

export type CrewNavDestination = { lat: number; lng: number; address: string };

type RouteStep = {
  name?: string;
  distance?: number;
  intersections?: Array<{ location: [number, number]; classes?: string[] }>;
  maneuver?: { instruction?: string; type?: string; modifier?: string; location?: [number, number] };
};

type CrewNavGuidance = {
  instructionText: string;
  maneuverMeta: { type?: string; modifier?: string };
  turnDistanceM: number | null;
  turnDistanceLabel: string;
  streetHeadline: string;
  thenText: string | null;
  thenMeta: { type?: string; modifier?: string };
  currentRoadName: string | null;
  callout: { lng: number; lat: number; label: string } | null;
};

const EMPTY_GUIDANCE: CrewNavGuidance = {
  instructionText: "Loading route…",
  maneuverMeta: {},
  turnDistanceM: null,
  turnDistanceLabel: "",
  streetHeadline: "",
  thenText: null,
  thenMeta: {},
  currentRoadName: null,
  callout: null,
};

function shortThenLine(step: RouteStep | undefined): string | null {
  if (!step?.maneuver?.instruction) return null;
  const t = step.maneuver.instruction.trim();
  if (t.length > 72) return `${t.slice(0, 69)}…`;
  return t;
}

function headlineStreetForStep(step: RouteStep | undefined, instructionFallback: string): string {
  const n = step?.name && String(step.name).trim();
  if (n) return n;
  return instructionFallback.slice(0, 96);
}

function routeLineStringFeature(coords: [number, number][] | null): {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
} | null {
  if (!coords || coords.length < 2) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function lngLatBoundsFromCoords(coords: [number, number][]): mapboxgl.LngLatBounds | null {
  if (coords.length < 2) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng)) return null;
  return new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
}

/** Bearing 0 = north, 90 = east — from point A toward B. */
function calcBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two compass bearings in [0, 180]. */
function angularDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Bearing toward a point ~`lookAheadM` ahead on the route (desktop / no compass). */
function bearingAlongPolylineAhead(
  coords: [number, number][],
  lat: number,
  lng: number,
  lookAheadM: number
): number | null {
  if (coords.length < 2 || lookAheadM < 8) return null;
  try {
    const line = turf.lineString(coords);
    const snapped = turf.nearestPointOnLine(line, turf.point([lng, lat]), { units: "meters" });
    const dAlong = snapped.properties.lineDistance;
    if (typeof dAlong !== "number" || !Number.isFinite(dAlong)) return null;
    const lineLen = turf.length(line, { units: "meters" });
    if (lineLen < 1) return null;
    const targetAlong = Math.min(lineLen, dAlong + lookAheadM);
    const targetPt = turf.along(line, targetAlong, { units: "meters" });
    const [tlng, tlat] = targetPt.geometry.coordinates;
    return calcBearing({ lat, lng }, { lat: tlat, lng: tlng });
  } catch {
    return null;
  }
}

/** Map center is offset behind the vehicle so the forward road fills the upper viewport (chase cam). */
function cameraLngLatForChase(
  userPos: { lat: number; lng: number },
  bearingDeg: number | null
): [number, number] {
  if (bearingDeg == null || !Number.isFinite(bearingDeg)) {
    return [userPos.lng, userPos.lat];
  }
  try {
    const behindBearing = (bearingDeg + 180) % 360;
    const pt = turf.destination(
      turf.point([userPos.lng, userPos.lat]),
      CHASE_CAMERA_BACK_M / 1000,
      behindBearing,
      { units: "kilometers" }
    );
    const [lng, lat] = pt.geometry.coordinates;
    return [lng, lat];
  } catch {
    return [userPos.lng, userPos.lat];
  }
}

/**
 * While navigation is open, keep first-person chase POV: heading-aligned, pitched, center behind GPS.
 * Omits zoom so pinch / zoom buttons can adjust scale without the next tick forcing NAV_FOLLOW_ZOOM.
 */
function CrewNavFollowCamera({
  userPos,
  bearingDeg,
  setMapBearing,
}: {
  userPos: { lat: number; lng: number } | null;
  bearingDeg: number | null;
  setMapBearing: (deg: number) => void;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!userPos) return;
    if (bearingDeg == null || !Number.isFinite(bearingDeg)) return;
    const map = mapRef?.getMap?.();
    if (!map) return;

    try {
      if (!map.isStyleLoaded()) return;
      setMapBearing(bearingDeg);
      const center = cameraLngLatForChase(userPos, bearingDeg);
      map.easeTo({
        center,
        bearing: bearingDeg,
        pitch: CHASE_PITCH_DEG,
        duration: 200,
        essential: true,
      });
    } catch {
      /* ignore */
    }
  }, [userPos?.lat, userPos?.lng, bearingDeg, mapRef, setMapBearing]);

  return null;
}

function easeToFirstPersonNav(
  map: mapboxgl.Map,
  userPos: { lat: number; lng: number },
  bearingDeg: number | null,
  setMapBearing: (deg: number) => void,
  duration = 550
) {
  const bearing = bearingDeg != null && Number.isFinite(bearingDeg) ? bearingDeg : map.getBearing();
  setMapBearing(bearing);
  const center = cameraLngLatForChase(userPos, bearingDeg);
  map.easeTo({
    center,
    bearing,
    pitch: CHASE_PITCH_DEG,
    duration,
    essential: true,
  });
}

function ManeuverGlyph({ type, modifier, className }: { type?: string; modifier?: string; className?: string }) {
  const t = (type || "").toLowerCase();
  const m = (modifier || "").toLowerCase();
  if (m.includes("left") || t.includes("left"))
    return <ArrowBendDownLeft className={className} weight="bold" aria-hidden />;
  if (m.includes("right") || t.includes("right"))
    return <ArrowBendDownRight className={className} weight="bold" aria-hidden />;
  if (t.includes("merge")) return <SignIn className={className} weight="bold" aria-hidden />;
  if (t.includes("roundabout") || t.includes("rotary"))
    return <TrafficCone className={className} weight="bold" aria-hidden />;
  if (t.includes("fork")) return <ForkKnife className={className} weight="bold" aria-hidden />;
  if (t.includes("arrive")) return <MapPin className={className} weight="bold" aria-hidden />;
  return <ArrowRight className={className} weight="bold" aria-hidden />;
}

/** Zoom +/- pair: shared pill; left / right inner corners square via divide. */
const NAV_BTN_ZOOM_ROW =
  "flex overflow-hidden rounded-xl border border-[#CBC4B8] bg-[#FFFBF7] shadow-lg divide-x divide-[#CBC4B8]";
/** Zoom cells must not use `w-full` (stack items do) or the second button collapses in a row. */
const NAV_BTN_ZOOM_CELL =
  "flex h-9 w-9 shrink-0 items-center justify-center text-[var(--tx)] active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E2D]/35";

const CREW_NAV_ROUTE_ARROWS_SOURCE_ID = "crew-nav-route-arrows";
const CREW_NAV_ROUTE_ARROWS_LAYER_ID = "crew-nav-route-arrow-symbols";

const VOICE_STORAGE_KEY = "crew_nav_voice_on";

/** Minimal floating controls: circular, high contrast, no duplicate turn preview. */
const NAV_FLOAT_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[#1A1816] shadow-md active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E2D]/35";

function CrewNavGeolocateControl({ geolocateRef }: { geolocateRef: RefObject<GeolocateControlInstance | null> }) {
  const { current: mapRef } = useMap();

  const onTrackUserLocationStart = useCallback(() => {
    const map = mapRef?.getMap?.();
    if (!map) return;
    try {
      map.easeTo({
        pitch: CHASE_PITCH_DEG,
        duration: 900,
      });
    } catch {
      /* ignore */
    }
  }, [mapRef]);

  return (
    <GeolocateControl
      ref={geolocateRef}
      followUserLocation={false}
      position="top-left"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      trackUserLocation
      showUserLocation={false}
      showAccuracyCircle={false}
      positionOptions={{ enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }}
      onTrackUserLocationStart={onTrackUserLocationStart}
    />
  );
}

/** Compass, route options, voice, report, GPS refresh; compact zoom. */
function CrewNavOpsFloatingControls({
  userPos,
  navBearingDeg,
  setMapBearing,
  onRecenter,
  mapBearing,
  geolocateRef,
  voiceMuted,
  onVoiceToggle,
  onReportOpen,
  onAlternatesOpen,
}: {
  userPos: { lat: number; lng: number } | null;
  navBearingDeg: number | null;
  setMapBearing: (deg: number) => void;
  onRecenter: (origin: { lat: number; lng: number }) => void;
  mapBearing: number;
  geolocateRef: RefObject<GeolocateControlInstance | null>;
  voiceMuted: boolean;
  onVoiceToggle: () => void;
  onReportOpen: () => void;
  onAlternatesOpen: () => void;
}) {
  const { current: mapRef } = useMap();

  return (
    <div
      className="absolute right-3 z-10 flex flex-col items-center gap-2.5"
      style={{
        bottom: "calc(9.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex flex-col items-center gap-2.5">
        <button
          type="button"
          className={NAV_FLOAT_BTN}
          aria-label="Realign to driving view"
          title="Driving view"
          onClick={() => {
            const u = userPos;
            const m = mapRef?.getMap?.();
            if (!u || !m) return;
            try {
              easeToFirstPersonNav(m, u, navBearingDeg, setMapBearing, 500);
            } catch {
              /* ignore */
            }
          }}
        >
          <span className="relative flex h-8 w-8 items-center justify-center">
            <Compass className="absolute text-[#A8A29E]" size={26} weight="regular" aria-hidden />
            <span
              className="relative z-[1] text-[8px] font-bold text-red-500 drop-shadow"
              style={{ transform: `rotate(${-mapBearing}deg)` }}
              aria-hidden
            >
              N
            </span>
          </span>
        </button>

        <button
          type="button"
          className={NAV_FLOAT_BTN}
          aria-label="Route options"
          title="Route options"
          onClick={onAlternatesOpen}
        >
          <List size={22} weight="bold" aria-hidden />
        </button>

        <button
          type="button"
          className={NAV_FLOAT_BTN}
          aria-label={voiceMuted ? "Turn voice guidance on" : "Mute voice guidance"}
          title={voiceMuted ? "Voice on" : "Voice muted"}
          onClick={onVoiceToggle}
        >
          {voiceMuted ? (
            <SpeakerSlash size={22} weight="bold" className="text-red-600" aria-hidden />
          ) : (
            <SpeakerHigh size={22} weight="bold" aria-hidden />
          )}
        </button>

        <button type="button" className={NAV_FLOAT_BTN} aria-label="Report road issue" title="Report" onClick={onReportOpen}>
          <Warning size={22} weight="bold" className="text-amber-600" aria-hidden />
        </button>

        <button
          type="button"
          className={NAV_FLOAT_BTN}
          disabled={!userPos}
          aria-label="Refresh GPS and route"
          title="My location and refresh route"
          onClick={() => {
            const u = userPos;
            if (!u) return;
            try {
              geolocateRef.current?.trigger();
            } catch {
              /* ignore */
            }
            const m = mapRef?.getMap?.();
            if (m) {
              try {
                easeToFirstPersonNav(m, u, navBearingDeg, setMapBearing, 650);
              } catch {
                /* ignore */
              }
            }
            onRecenter(u);
          }}
        >
          <NavigationArrow className="text-[#1A1816]" size={24} weight="fill" aria-hidden />
        </button>
      </div>

      <div className={`${NAV_BTN_ZOOM_ROW} rounded-full overflow-hidden border-black/10 shadow-md`}>
        <button
          type="button"
          className={NAV_BTN_ZOOM_CELL}
          aria-label="Zoom in"
          onClick={() => {
            const m = mapRef?.getMap?.();
            try {
              m?.zoomIn({ duration: 220 });
            } catch {
              /* ignore */
            }
          }}
        >
          <Plus size={18} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          className={NAV_BTN_ZOOM_CELL}
          aria-label="Zoom out"
          onClick={() => {
            const m = mapRef?.getMap?.();
            try {
              m?.zoomOut({ duration: 220 });
            } catch {
              /* ignore */
            }
          }}
        >
          <Minus size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

/** Planar projection distance from P to closest point on segment AB; `t` is 0 at A, 1 at B (clamped). */
function distancePointToSegmentMetersWithT(
  latP: number,
  lngP: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): { dist: number; t: number } {
  const R = 6371000;
  const xA = ((lngA - lngP) * Math.PI) / 180;
  const xB = ((lngB - lngP) * Math.PI) / 180;
  const yA = ((latA - latP) * Math.PI) / 180;
  const yB = ((latB - latP) * Math.PI) / 180;
  const cosP = Math.cos((latP * Math.PI) / 180);
  const xa = xA * cosP * R;
  const ya = yA * R;
  const xb = xB * cosP * R;
  const yb = yB * R;
  const vx = xb - xa;
  const vy = yb - ya;
  const wx = -xa;
  const wy = -ya;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return { dist: Math.hypot(xa, ya), t: 0 };
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return { dist: Math.hypot(xb - xa, yb - ya), t: 1 };
  const t = c1 / c2;
  const px = xa + t * vx;
  const py = ya + t * vy;
  return { dist: Math.hypot(px, py), t };
}

function distancePointToSegmentMeters(
  latP: number,
  lngP: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
  return distancePointToSegmentMetersWithT(latP, lngP, latA, lngA, latB, lngB).dist;
}

function segmentPerpendicularDistanceM(
  lat: number,
  lng: number,
  coords: [number, number][],
  segIndex: number
): number {
  const [lngA, latA] = coords[segIndex];
  const [lngB, latB] = coords[segIndex + 1];
  return distancePointToSegmentMeters(lat, lng, latA, lngA, latB, lngB);
}

/**
 * Snap to the driven route: search a forward window from the last match, prefer the earliest segment
 * among ties (stops global "nearest segment" from jumping to parallel geometry near the destination).
 * Returns remaining distance along the polyline from the snap point to the route end.
 */
function remainingDistanceAlongPolylineSnapM(
  lat: number,
  lng: number,
  coords: [number, number][],
  hintSegIndex: number
): { remainingM: number; segIndex: number; perpDistM: number } | null {
  if (coords.length < 2) return null;
  const lastSeg = coords.length - 2;
  const clampedHint = Math.max(0, Math.min(hintSegIndex, lastSeg));
  const winLo = Math.max(0, clampedHint - POLYLINE_HINT_LOOKBACK_SEGS);

  const pickInRange = (segLo: number, segHi: number) => {
    let minD = Infinity;
    for (let i = segLo; i <= segHi; i++) {
      const d = segmentPerpendicularDistanceM(lat, lng, coords, i);
      if (d < minD) minD = d;
    }
    let chosenI = segHi;
    for (let i = segLo; i <= segHi; i++) {
      const d = segmentPerpendicularDistanceM(lat, lng, coords, i);
      if (d <= minD + POLYLINE_SNAP_TIE_M) {
        chosenI = i;
        break;
      }
    }
    const [lngA, latA] = coords[chosenI];
    const [lngB, latB] = coords[chosenI + 1];
    const { dist: perpDistM, t } = distancePointToSegmentMetersWithT(lat, lng, latA, lngA, latB, lngB);
    const segLen = haversineM(latA, lngA, latB, lngB);
    let remaining = (1 - t) * segLen;
    for (let j = chosenI + 1; j < coords.length - 1; j++) {
      const [lngS, latS] = coords[j];
      const [lngE, latE] = coords[j + 1];
      remaining += haversineM(latS, lngS, latE, lngE);
    }
    return { remainingM: Math.max(0, remaining), segIndex: chosenI, perpDistM };
  };

  let result = pickInRange(winLo, lastSeg);
  if (result.perpDistM > POLYLINE_REACQUIRE_PERP_M && winLo > 0) {
    const full = pickInRange(0, lastSeg);
    if (full.perpDistM + 20 < result.perpDistM) result = full;
  }
  return result;
}

function totalPolylineLengthM(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let s = 0;
  for (let j = 0; j < coords.length - 1; j++) {
    const [lngS, latS] = coords[j];
    const [lngE, latE] = coords[j + 1];
    s += haversineM(latS, lngS, latE, lngE);
  }
  return s;
}

function minDistanceToRouteM(lat: number, lng: number, coords: [number, number][]): number {
  if (coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lngA, latA] = coords[i];
    const [lngB, latB] = coords[i + 1];
    const d = distancePointToSegmentMeters(lat, lng, latA, lngA, latB, lngB);
    if (d < min) min = d;
  }
  return min;
}

/** Geodesic cross-track distance to the driving polyline (meters). */
function crossTrackDistanceM(coords: [number, number][], lat: number, lng: number): number {
  if (coords.length < 2) return 0;
  try {
    const snapped = turf.nearestPointOnLine(turf.lineString(coords), turf.point([lng, lat]), {
      units: "meters",
    });
    const d = snapped.properties.pointDistance;
    return typeof d === "number" && Number.isFinite(d) ? d : minDistanceToRouteM(lat, lng, coords);
  } catch {
    return minDistanceToRouteM(lat, lng, coords);
  }
}

/** Distance along the route polyline from start to the snapped point (meters). */
function distanceAlongRouteMeters(coords: [number, number][], lat: number, lng: number): number | null {
  if (coords.length < 2) return null;
  try {
    const snapped = turf.nearestPointOnLine(turf.lineString(coords), turf.point([lng, lat]), {
      units: "meters",
    });
    const d = snapped.properties.lineDistance;
    return typeof d === "number" && Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

function formatDistanceM(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 50) return "< 1 min";
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Softens single-tick GPS / geometry spikes in the ETA readout. */
function smoothEtaDisplay(nextSec: number | null, prevSec: number | null): number | null {
  if (nextSec == null || !Number.isFinite(nextSec) || nextSec < 0) return prevSec;
  const clamped = Math.min(nextSec, MAX_SANE_ETA_SEC);
  if (prevSec == null || !Number.isFinite(prevSec)) return clamped;
  const delta = clamped - prevSec;
  if (Math.abs(delta) <= ETA_LARGE_JUMP_SEC) return clamped;
  return prevSec + Math.sign(delta) * ETA_JUMP_SOFTEN_SEC;
}

function resolveTurnGuidance(steps: RouteStep[], traveledAlongM: number | null): CrewNavGuidance {
  if (!steps.length) {
    return { ...EMPTY_GUIDANCE, instructionText: "Follow the route" };
  }
  if (traveledAlongM == null || !Number.isFinite(traveledAlongM) || traveledAlongM < 0) {
    const s0 = steps[0];
    const s1 = steps[1];
    const instr = s0?.maneuver?.instruction || "Follow the route";
    const dist0 = typeof s0?.distance === "number" ? s0.distance : null;
    const loc = s1?.maneuver?.location;
    return {
      instructionText: instr,
      maneuverMeta: { type: s0?.maneuver?.type, modifier: s0?.maneuver?.modifier },
      turnDistanceM: dist0,
      turnDistanceLabel: dist0 != null ? formatDistanceM(dist0) : "",
      streetHeadline: headlineStreetForStep(s1, instr),
      thenText: s1 ? shortThenLine(steps[2]) : null,
      thenMeta: { type: steps[2]?.maneuver?.type, modifier: steps[2]?.maneuver?.modifier },
      currentRoadName: (s0?.name && String(s0.name).trim()) || null,
      callout:
        loc && s1
          ? {
              lng: loc[0],
              lat: loc[1],
              label: (s1.name && String(s1.name).trim()) || headlineStreetForStep(s1, instr),
            }
          : null,
    };
  }
  let cum = 0;
  for (let i = 0; i < steps.length; i++) {
    const len = typeof steps[i].distance === "number" ? steps[i].distance! : 0;
    const end = cum + len;
    if (traveledAlongM < end) {
      const cur = steps[i];
      const next = steps[i + 1];
      const after = steps[i + 2];
      const toStepEnd = Math.max(0, end - traveledAlongM);
      if (next?.maneuver?.instruction && toStepEnd < 40) {
        const nd = typeof next.distance === "number" ? next.distance : toStepEnd;
        const loc = next.maneuver.location;
        const ni = next.maneuver.instruction!;
        return {
          instructionText: nd > 35 ? `In ${formatDistanceM(nd)}: ${ni}` : ni,
          maneuverMeta: { type: next.maneuver.type, modifier: next.maneuver.modifier },
          turnDistanceM: nd,
          turnDistanceLabel: formatDistanceM(nd),
          streetHeadline: headlineStreetForStep(next, ni),
          thenText: shortThenLine(after),
          thenMeta: { type: after?.maneuver?.type, modifier: after?.maneuver?.modifier },
          currentRoadName: (cur.name && String(cur.name).trim()) || null,
          callout:
            loc
              ? {
                  lng: loc[0],
                  lat: loc[1],
                  label: (next.name && String(next.name).trim()) || headlineStreetForStep(next, ni),
                }
              : null,
        };
      }
      const instr = cur.maneuver?.instruction || "Follow the route";
      const locNext = next?.maneuver?.location;
      if (toStepEnd > 280 && next) {
        return {
          instructionText: `In ${formatDistanceM(toStepEnd)}: ${instr}`,
          maneuverMeta: { type: cur.maneuver?.type, modifier: cur.maneuver?.modifier },
          turnDistanceM: toStepEnd,
          turnDistanceLabel: formatDistanceM(toStepEnd),
          streetHeadline: headlineStreetForStep(cur, instr),
          thenText: shortThenLine(next),
          thenMeta: { type: next.maneuver?.type, modifier: next.maneuver?.modifier },
          currentRoadName: (cur.name && String(cur.name).trim()) || null,
          callout:
            locNext
              ? {
                  lng: locNext[0],
                  lat: locNext[1],
                  label:
                    (next.name && String(next.name).trim()) ||
                    headlineStreetForStep(next, next.maneuver?.instruction || "Turn"),
                }
              : null,
        };
      }
      return {
        instructionText: instr,
        maneuverMeta: { type: cur.maneuver?.type, modifier: cur.maneuver?.modifier },
        turnDistanceM: toStepEnd,
        turnDistanceLabel: formatDistanceM(toStepEnd),
        streetHeadline: headlineStreetForStep(cur, instr),
        thenText: next?.maneuver ? shortThenLine(next) : null,
        thenMeta: { type: next?.maneuver?.type, modifier: next?.maneuver?.modifier },
        currentRoadName: (cur.name && String(cur.name).trim()) || null,
        callout:
          locNext && next
            ? {
                lng: locNext[0],
                lat: locNext[1],
                label:
                  (next.name && String(next.name).trim()) ||
                  headlineStreetForStep(next, next.maneuver?.instruction || "Turn"),
              }
            : null,
      };
    }
    cum = end;
  }
  const last = steps[steps.length - 1];
  const li = last?.maneuver?.instruction || "Follow the route";
  return {
    instructionText: li,
    maneuverMeta: { type: last?.maneuver?.type, modifier: last?.maneuver?.modifier },
    turnDistanceM: null,
    turnDistanceLabel: "",
    streetHeadline: headlineStreetForStep(last, li),
    thenText: null,
    thenMeta: {},
    currentRoadName: (last?.name && String(last.name).trim()) || null,
    callout: null,
  };
}

/** Straightahead / rename steps — visual only; voice would be constant chatter. */
const NAV_VOICE_LOW_PRIORITY_TYPES = new Set(["continue", "new name"]);

function stripLeadingInDistancePrefix(instruction: string): string {
  return instruction.replace(/^\s*In\s+[^:]+:\s*/i, "").trim();
}

function navigationManeuverVoiceKey(g: CrewNavGuidance): string {
  const stem = stripLeadingInDistancePrefix(g.instructionText.trim());
  return `${stem}|${g.maneuverMeta.type || ""}|${g.maneuverMeta.modifier || ""}`;
}

export function CrewNavigation({
  destination,
  sessionId,
  jobId,
  jobType,
  truckType,
  fuelPriceCadPerLitre,
  onExit,
  onArrived,
  onAutoAdvanced,
}: {
  destination: CrewNavDestination;
  sessionId: string;
  /** Move UUID — used to log navigation distance / fuel on arrival (moves only). */
  jobId?: string | null;
  jobType?: "move" | "delivery";
  truckType?: string | null;
  /** From platform settings (gas or diesel $/L); optional — defaults to gasoline default. */
  fuelPriceCadPerLitre?: number | null;
  onExit: () => void;
  onArrived: () => void;
  onAutoAdvanced?: () => void;
}) {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [trafficRouteGeoJson, setTrafficRouteGeoJson] =
    useState<TrafficRouteFeatureCollection>(EMPTY_TRAFFIC_ROUTE);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [routeDurationSec, setRouteDurationSec] = useState<number | null>(null);
  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [guidance, setGuidance] = useState<CrewNavGuidance>(EMPTY_GUIDANCE);
  const [arrivalClockLabel, setArrivalClockLabel] = useState<string | null>(null);
  const [routeSummaries, setRouteSummaries] = useState<ScoredRouteSummary[]>([]);
  const [routeAlternatives, setRouteAlternatives] = useState<CrewRouteAlternative[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [alternatesOpen, setAlternatesOpen] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [etaLabel, setEtaLabel] = useState("—");
  const [distRemainLabel, setDistRemainLabel] = useState("—");
  const [mapError, setMapError] = useState<string | null>(null);
  const [speedDisplay, setSpeedDisplay] = useState<string | null>(null);
  /** Degrees clockwise from north — device heading or course-over-ground. */
  const [navBearingDeg, setNavBearingDeg] = useState<number | null>(null);
  /** Map bearing used to rotate the crew arrow relative to the camera. */
  const [mapBearing, setMapBearing] = useState(0);

  const geolocateRef = useRef<GeolocateControlInstance | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  /** Throttle: at most ~2 distance-based prompts per maneuver (250 m and 80 m) plus pickup mid-route. */
  const navVoiceBucketRef = useRef<{ maneuverKey: string; spoken250: boolean; spoken80: boolean } | null>(null);
  const lastSpokenArrivalRef = useRef(false);
  const displayEtaSecRef = useRef<number | null>(null);
  const lastRerouteAtRef = useRef(0);

  const watchIdRef = useRef<number | null>(null);
  const prevGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  /** After a high-accuracy watch fails (timeout / unavailable), retry once with relaxed options. */
  const geoRelaxedRetryDoneRef = useRef(false);
  const lastPostRef = useRef(0);
  const lastReverseRef = useRef(0);
  const approxPlaceRef = useRef<string | null>(null);
  const arrivedRef = useRef(false);
  const fetchRouteInFlight = useRef(false);
  /** Last matched segment index along routeCoords — keeps polyline ETA from snapping to wrong parallel geometry. */
  const polylineHintSegRef = useRef(0);
  const routeCoordsRef = useRef<[number, number][] | null>(null);
  const stepsRef = useRef<RouteStep[]>([]);
  const routeDurationRef = useRef<number | null>(null);
  const routeDistanceRef = useRef<number | null>(null);
  const destRef = useRef(destination);
  const onArrivedRef = useRef(onArrived);
  const onAutoAdvancedRef = useRef(onAutoAdvanced);
  const sessionIdRef = useRef(sessionId);
  const jobIdRef = useRef(jobId ?? null);
  const jobTypeRef = useRef(jobType ?? "move");
  const truckTypeRef = useRef(truckType ?? null);
  const fuelPriceRef = useRef<number | undefined>(undefined);
  const routeAlternativesRef = useRef<CrewRouteAlternative[]>([]);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const navBearingDegRef = useRef<number | null>(null);

  routeAlternativesRef.current = routeAlternatives;
  userPosRef.current = userPos;
  navBearingDegRef.current = navBearingDeg;
  routeCoordsRef.current = routeCoords;
  stepsRef.current = steps;
  routeDurationRef.current = routeDurationSec;
  routeDistanceRef.current = routeDistanceM;
  destRef.current = destination;
  onArrivedRef.current = onArrived;
  onAutoAdvancedRef.current = onAutoAdvanced;
  sessionIdRef.current = sessionId;
  jobIdRef.current = jobId ?? null;
  jobTypeRef.current = jobType ?? "move";
  truckTypeRef.current = truckType ?? null;
  fuelPriceRef.current =
    typeof fuelPriceCadPerLitre === "number" && Number.isFinite(fuelPriceCadPerLitre) && fuelPriceCadPerLitre > 0
      ? fuelPriceCadPerLitre
      : undefined;

  const mapStyle = "mapbox://styles/mapbox/light-v11";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem(VOICE_STORAGE_KEY);
      if (v === "0") setVoiceOn(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, voiceOn ? "1" : "0");
      if (!voiceOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }, [voiceOn]);

  useEffect(() => {
    if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const line = guidance.instructionText.trim();
    if (!line || line === "Loading route…") return;

    const maneuverType = (guidance.maneuverMeta.type || "").toLowerCase();
    if (NAV_VOICE_LOW_PRIORITY_TYPES.has(maneuverType)) return;

    const speak = (text: string) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    };

    if (maneuverType === "arrive" || line.toLowerCase().includes("you have arrived")) {
      if (lastSpokenArrivalRef.current) return;
      lastSpokenArrivalRef.current = true;
      speak(line);
      return;
    }

    const key = navigationManeuverVoiceKey(guidance);
    const d = guidance.turnDistanceM;
    let bucket = navVoiceBucketRef.current;

    if (!bucket || bucket.maneuverKey !== key) {
      bucket = { maneuverKey: key, spoken250: false, spoken80: false };
      navVoiceBucketRef.current = bucket;
      if (d != null && Number.isFinite(d)) {
        if (d <= 80) {
          bucket.spoken80 = true;
          bucket.spoken250 = true;
          speak(line);
          return;
        }
        if (d <= 250) {
          bucket.spoken250 = true;
          speak(line);
          return;
        }
        return;
      }
      speak(line);
      return;
    }

    if (d != null && Number.isFinite(d)) {
      if (d <= 80 && !bucket.spoken80) {
        bucket.spoken80 = true;
        speak(line);
        return;
      }
      if (d <= 250 && !bucket.spoken250) {
        bucket.spoken250 = true;
        speak(line);
      }
    }
  }, [guidance, voiceOn]);

  const handleMapLoad = useCallback((e: { target: mapboxgl.Map }) => {
    mapInstanceRef.current = e.target;
    window.setTimeout(() => {
      try {
        geolocateRef.current?.trigger();
      } catch {
        /* ignore */
      }
    }, 450);
  }, []);

  const routeArrowLineData = useMemo(() => routeLineStringFeature(routeCoords), [routeCoords]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const fetchRoute = useCallback(async (origin: { lat: number; lng: number }) => {
    if (!HAS_MAPBOX || fetchRouteInFlight.current) return;
    fetchRouteInFlight.current = true;
    const dest = destRef.current;
    try {
      const intelligent = await fetchIntelligentRoute(MAPBOX_TOKEN, origin, dest, truckTypeRef.current, {
        fuelPriceCadPerLitre: fuelPriceRef.current,
      });
      if (!intelligent?.coordinates?.length) {
        setMapError("Could not compute a driving route.");
        setRouteAlternatives([]);
        setTrafficRouteGeoJson(EMPTY_TRAFFIC_ROUTE);
        return;
      }
      polylineHintSegRef.current = 0;
      displayEtaSecRef.current = null;
      navVoiceBucketRef.current = null;
      lastSpokenArrivalRef.current = false;
      const r = intelligent.route;
      setRouteAlternatives(intelligent.alternatives ?? []);
      setRouteCoords(intelligent.coordinates);
      setTrafficRouteGeoJson(intelligent.trafficRouteGeoJson);
      let dur = typeof r.duration === "number" && Number.isFinite(r.duration) && r.duration >= 0 ? r.duration : null;
      if (dur != null && dur > MAX_SANE_ETA_SEC) {
        console.warn("[CrewNav] Ignoring improbable route duration (seconds)", dur);
        dur = null;
      }
      const dist = typeof r.distance === "number" && Number.isFinite(r.distance) && r.distance >= 0 ? r.distance : null;
      setRouteDurationSec(dur);
      setRouteDistanceM(dist);
      const legSteps = (r.legs?.[0]?.steps || []) as RouteStep[];
      setSteps(legSteps);
      setGuidance(resolveTurnGuidance(legSteps, null));
      setRouteSummaries(intelligent.summaries ?? []);
      setSelectedRouteIndex(intelligent.selectedIndex);
      if (dur != null) setEtaLabel(formatEta(dur));
      if (dist != null) setDistRemainLabel(formatDistanceM(dist));
      setMapError(null);
    } catch {
      setMapError("Route request failed.");
      setRouteAlternatives([]);
      setTrafficRouteGeoJson(EMPTY_TRAFFIC_ROUTE);
    } finally {
      fetchRouteInFlight.current = false;
    }
  }, []);

  const applyRouteAlternative = useCallback((apiIndex: number) => {
    const alt = routeAlternativesRef.current.find((a) => a.index === apiIndex);
    if (!alt) return;
    polylineHintSegRef.current = 0;
    displayEtaSecRef.current = null;
    navVoiceBucketRef.current = null;
    lastSpokenArrivalRef.current = false;
    const r = alt.route;
    let dur = typeof r.duration === "number" && Number.isFinite(r.duration) && r.duration >= 0 ? r.duration : null;
    if (dur != null && dur > MAX_SANE_ETA_SEC) {
      console.warn("[CrewNav] Ignoring improbable route duration (seconds)", dur);
      dur = null;
    }
    const dist = typeof r.distance === "number" && Number.isFinite(r.distance) && r.distance >= 0 ? r.distance : null;
    setRouteCoords(alt.coordinates);
    setTrafficRouteGeoJson(alt.trafficRouteGeoJson);
    setRouteDurationSec(dur);
    setRouteDistanceM(dist);
    const legSteps = (r.legs?.[0]?.steps || []) as RouteStep[];
    setSteps(legSteps);
    setGuidance(resolveTurnGuidance(legSteps, null));
    setSelectedRouteIndex(apiIndex);
    if (dur != null) setEtaLabel(formatEta(dur));
    else setEtaLabel("—");
    if (dist != null) setDistRemainLabel(formatDistanceM(dist));
    else setDistRemainLabel("—");
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!HAS_MAPBOX) return;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const place = data?.features?.[0]?.place_name;
      if (typeof place === "string" && place.trim()) approxPlaceRef.current = place.trim().slice(0, 200);
    } catch {
      /* ignore */
    }
  }, []);

  const postLocation = useCallback(async (coords: GeolocationCoordinates, etaSeconds: number | null, distM: number | null) => {
    const now = Date.now();
    if (now - lastPostRef.current < POST_MIN_MS) return;
    lastPostRef.current = now;
    if (now - lastReverseRef.current > REVERSE_GEOCODE_MS) {
      lastReverseRef.current = now;
      void reverseGeocode(coords.latitude, coords.longitude);
    }
    try {
      const res = await fetch("/api/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          speed: coords.speed,
          heading: coords.heading,
          timestamp: new Date().toISOString(),
          source: "navigation",
          is_navigating: true,
          eta_seconds: etaSeconds,
          distance_remaining_meters: distM,
          approx_address: approxPlaceRef.current,
        }),
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.autoAdvanced) onAutoAdvancedRef.current?.();
    } catch {
      /* next tick retries */
    }
  }, [reverseGeocode]);

  useEffect(() => {
    arrivedRef.current = false;
    polylineHintSegRef.current = 0;
    displayEtaSecRef.current = null;
    lastRerouteAtRef.current = 0;
    setTrafficRouteGeoJson(EMPTY_TRAFFIC_ROUTE);
    prevGeoRef.current = null;
    setNavBearingDeg(null);
    setGuidance(EMPTY_GUIDANCE);
    setRouteSummaries([]);
    setRouteAlternatives([]);
    setSelectedRouteIndex(0);
    navVoiceBucketRef.current = null;
    lastSpokenArrivalRef.current = false;
  }, [destination.lat, destination.lng, sessionId]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setMapError("This device does not support GPS.");
      return;
    }
    let gotFirstFix = false;
    geoRelaxedRetryDoneRef.current = false;

    const clearGeoWatch = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const startGeoWatch = (opts: PositionOptions) => {
      clearGeoWatch();
      watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setMapError(null);
        markCrewLocationAllowed();
        const { latitude, longitude, speed, heading } = position.coords;
        setUserPos({ lat: latitude, lng: longitude });

        const dest = destRef.current;

        const rcBear = routeCoordsRef.current;
        const routeAheadBearing =
          rcBear && rcBear.length >= 2 ? bearingAlongPolylineAhead(rcBear, latitude, longitude, 100) : null;

        const head =
          typeof heading === "number" && !Number.isNaN(heading) && heading >= 0 ? heading : null;
        const course =
          prevGeoRef.current && typeof speed === "number" && !Number.isNaN(speed) && speed > 0.5
            ? calcBearing(prevGeoRef.current, { lat: latitude, lng: longitude })
            : null;
        const movingFastEnoughForCompass =
          typeof speed === "number" && !Number.isNaN(speed) && speed >= 1.5;

        let bearing: number | null = null;
        if (
          head != null &&
          movingFastEnoughForCompass &&
          routeAheadBearing != null &&
          angularDiffDeg(head, routeAheadBearing) <= 60
        ) {
          bearing = head;
        } else if (course != null) {
          bearing = course;
        } else if (routeAheadBearing != null) {
          bearing = routeAheadBearing;
        } else if (head != null) {
          bearing = head;
        } else {
          bearing = calcBearing(
            { lat: latitude, lng: longitude },
            { lat: dest.lat, lng: dest.lng }
          );
        }
        prevGeoRef.current = { lat: latitude, lng: longitude };
        setNavBearingDeg(bearing);

        if (speed != null && !Number.isNaN(speed) && speed >= 0) {
          const kmh = speed * 3.6;
          setSpeedDisplay(kmh >= 1 ? `${Math.round(kmh)} km/h` : null);
        } else {
          setSpeedDisplay(null);
        }

        const distToDestM = haversineM(latitude, longitude, dest.lat, dest.lng);

        const rcForEta = routeCoordsRef.current;
        const polyTotalM =
          rcForEta && rcForEta.length >= 2 ? totalPolylineLengthM(rcForEta) : null;
        const traveledTurf =
          rcForEta && rcForEta.length >= 2
            ? distanceAlongRouteMeters(rcForEta, latitude, longitude)
            : null;

        const snap =
          rcForEta && rcForEta.length >= 2
            ? remainingDistanceAlongPolylineSnapM(
                latitude,
                longitude,
                rcForEta,
                polylineHintSegRef.current
              )
            : null;
        if (snap) polylineHintSegRef.current = snap.segIndex;

        const rd = routeDurationRef.current;
        const rdist = routeDistanceRef.current;

        let remainAlongM: number | null = null;
        if (
          polyTotalM != null &&
          polyTotalM > MIN_ROUTE_DIST_FOR_ETA_SCALE_M &&
          traveledTurf != null
        ) {
          const r = polyTotalM - traveledTurf;
          if (Number.isFinite(r)) {
            remainAlongM = Math.max(0, Math.min(polyTotalM, r));
          }
        }
        if (remainAlongM == null && snap != null) {
          remainAlongM = snap.remainingM;
        }

        // Wrong polyline matches (e.g. parallel roads) can make remainAlongM << crow-flies; reject and scale by straight-line vs route length instead.
        const etaSanitySlackM = Math.max(220, Math.min(1000, 0.028 * distToDestM));
        if (remainAlongM != null && remainAlongM + etaSanitySlackM < distToDestM) {
          remainAlongM = null;
        }

        const routeCapM =
          rdist != null && rdist > MIN_ROUTE_DIST_FOR_ETA_SCALE_M
            ? rdist * 1.2
            : polyTotalM != null && polyTotalM > MIN_ROUTE_DIST_FOR_ETA_SCALE_M
              ? polyTotalM * 1.15
              : null;
        if (remainAlongM != null && routeCapM != null && remainAlongM > routeCapM + 500) {
          remainAlongM = null;
        }
        if (remainAlongM != null && remainAlongM > distToDestM * 6 + 2000) {
          remainAlongM = null;
        }

        let displayRemainM = remainAlongM != null ? remainAlongM : distToDestM;
        if (routeCapM != null) {
          displayRemainM = Math.min(displayRemainM, routeCapM);
        }
        displayRemainM = Math.min(displayRemainM, MAX_DISPLAY_REMAIN_M);

        if (
          !Number.isFinite(displayRemainM) ||
          displayRemainM < 0 ||
          distToDestM > MAX_DISPLAY_REMAIN_M
        ) {
          setDistRemainLabel("—");
        } else {
          setDistRemainLabel(formatDistanceM(displayRemainM));
        }

        let etaSec: number | null = null;
        if (rd != null && rdist != null && rdist > MIN_ROUTE_DIST_FOR_ETA_SCALE_M) {
          let ratio: number;
          if (remainAlongM != null && polyTotalM != null && polyTotalM > MIN_ROUTE_DIST_FOR_ETA_SCALE_M) {
            ratio = remainAlongM / polyTotalM;
          } else {
            ratio = distToDestM / rdist;
          }
          ratio = Math.min(1, Math.max(0, ratio));
          etaSec = rd * ratio;
          etaSec = Math.min(etaSec, MAX_SANE_ETA_SEC);
        } else if (speed != null && !Number.isNaN(speed) && speed > 0.5) {
          etaSec = Math.min(distToDestM / speed, MAX_SANE_ETA_SEC);
        }

        const smoothedEta = smoothEtaDisplay(etaSec, displayEtaSecRef.current);
        if (smoothedEta != null) {
          displayEtaSecRef.current = smoothedEta;
          setEtaLabel(formatEta(smoothedEta));
          const d = new Date(Date.now() + smoothedEta * 1000);
          setArrivalClockLabel(
            d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
          );
        } else if (etaSec == null) {
          setEtaLabel("—");
          setArrivalClockLabel(null);
        } else {
          setEtaLabel(formatEta(etaSec));
          const d = new Date(Date.now() + etaSec * 1000);
          setArrivalClockLabel(
            d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
          );
        }

        const rc = routeCoordsRef.current;
        if (rc && rc.length >= 2) {
          const offM = crossTrackDistanceM(rc, latitude, longitude);
          const now = Date.now();
          if (offM > REROUTE_DEVIATION_M && now - lastRerouteAtRef.current >= REROUTE_MIN_INTERVAL_MS) {
            lastRerouteAtRef.current = now;
            void fetchRoute({ lat: latitude, lng: longitude });
          }
        }

        const st = stepsRef.current;
        if (st.length && rc && rc.length >= 2) {
          const traveledAlongM = distanceAlongRouteMeters(rc, latitude, longitude);
          setGuidance(resolveTurnGuidance(st, traveledAlongM));
        }

        const postDistM =
          !Number.isFinite(displayRemainM) || displayRemainM < 0 || distToDestM > MAX_DISPLAY_REMAIN_M
            ? null
            : Math.round(displayRemainM);
        void postLocation(
          position.coords,
          smoothedEta != null ? Math.round(smoothedEta) : etaSec != null ? Math.round(etaSec) : null,
          postDistM
        );

        if (!gotFirstFix) {
          gotFirstFix = true;
          void fetchRoute({ lat: latitude, lng: longitude });
        }

        if (!arrivedRef.current && distToDestM < ARRIVAL_RADIUS_M) {
          arrivedRef.current = true;
          navVoiceBucketRef.current = null;
          lastSpokenArrivalRef.current = false;
          setGuidance({
            ...EMPTY_GUIDANCE,
            instructionText: "You have arrived",
            streetHeadline: destRef.current.address,
            maneuverMeta: { type: "arrive", modifier: undefined },
            turnDistanceM: null,
            turnDistanceLabel: "",
            thenText: null,
            thenMeta: {},
            currentRoadName: null,
            callout: null,
          });
          const jt = jobTypeRef.current;
          const jid = jobIdRef.current;
          const distM = routeDistanceRef.current;
          if (jt === "move" && jid && distM != null && distM > 0) {
            const distanceKm = distM / 1000;
            void fetch("/api/crew/navigation/fuel-estimate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jobId: jid,
                distanceKm,
                truckType: truckTypeRef.current,
              }),
              credentials: "same-origin",
            });
          }
          onArrivedRef.current();
        }
      },
      (err: GeolocationPositionError) => {
        if ((err.code === 3 || err.code === 2) && !geoRelaxedRetryDoneRef.current) {
          geoRelaxedRetryDoneRef.current = true;
          startGeoWatch({ enableHighAccuracy: false, maximumAge: 60_000, timeout: 60_000 });
          return;
        }
        const msg =
          err.code === 1
            ? "Location permission denied. Allow location for this site in your browser settings."
            : err.code === 3
              ? "GPS timed out. Move outdoors, wait a few seconds, or check device location settings."
              : err.code === 2
                ? "Could not determine position. Turn on device location / GPS."
                : "Location error";
        setMapError(msg);
      },
      opts
    );
    };

    startGeoWatch({ enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 });

    return () => {
      clearGeoWatch();
    };
  }, [fetchRoute, postLocation]);

  const submitNavReport = useCallback(async () => {
    const jid = jobIdRef.current;
    const jt = jobTypeRef.current;
    if (!jid || (jt !== "move" && jt !== "delivery")) {
      setReportOpen(false);
      return;
    }
    setReportBusy(true);
    try {
      const desc = `[Navigation] ${reportNote.trim() || "Road or traffic issue"}`.slice(0, 2000);
      const res = await fetch("/api/crew/incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          jobId: jid,
          jobType: jt,
          sessionId: sessionIdRef.current,
          issueType: "delay",
          description: desc,
          urgency: "medium",
        }),
      });
      if (res.ok) {
        setReportOpen(false);
        setReportNote("");
      }
    } finally {
      setReportBusy(false);
    }
  }, [reportNote]);

  const fitRouteOverview = useCallback(() => {
    if (!routeCoords?.length) return;
    const b = lngLatBoundsFromCoords(routeCoords);
    const m = mapInstanceRef.current;
    if (!b || !m) return;
    try {
      m.fitBounds(b, {
        padding: { top: 120, bottom: 180, left: 48, right: 48 },
        pitch: 0,
        duration: 950,
        maxZoom: 14,
      });
      const onMoveEnd = () => {
        m.off("moveend", onMoveEnd);
        const u = userPosRef.current;
        if (!u) return;
        try {
          easeToFirstPersonNav(m, u, navBearingDegRef.current, setMapBearing, 600);
        } catch {
          /* ignore */
        }
      };
      m.once("moveend", onMoveEnd);
    } catch {
      /* ignore */
    }
  }, [routeCoords]);

  const initialView = useMemo(() => {
    const lat = userPos?.lat ?? destination.lat;
    const lng = userPos?.lng ?? destination.lng;
    return {
      latitude: lat,
      longitude: lng,
      zoom: NAV_FOLLOW_ZOOM,
      bearing: 0,
      pitch: CHASE_PITCH_DEG,
    };
  }, [userPos?.lat, userPos?.lng, destination.lat, destination.lng]);

  if (!HAS_MAPBOX) {
    const missingToken = (
      <div
        data-modal-root
        data-crew-portal
        className={`${CREW_NAV_OVERLAY_CLASS} items-center justify-center bg-[var(--bg)] p-6 text-center`}
        role="alertdialog"
        aria-modal="true"
        aria-label="Navigation unavailable"
      >
        <p className="text-[var(--tx)] font-semibold mb-2">Mapbox is not configured</p>
        <p className="text-[13px] text-[var(--tx3)] mb-4">Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for in-app navigation.</p>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] font-semibold text-sm"
        >
          Close
        </button>
      </div>
    );
    return typeof document !== "undefined" ? createPortal(missingToken, document.body) : null;
  }

  const navUi = (
    <div
      data-modal-root
      data-crew-portal
      className={CREW_NAV_OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-label="Turn-by-turn navigation"
    >
      <p className="sr-only" aria-live="polite">
        {(guidance.streetHeadline?.trim() || guidance.instructionText.trim() || "Navigation").slice(0, 200)}
      </p>
      <div className="relative min-h-0 flex-1">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialView}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
          reuseMaps
          maxPitch={85}
          onLoad={(e) => {
            mapInstanceRef.current = e.target;
            handleMapLoad(e);
          }}
          onMoveEnd={(e) => setMapBearing(e.viewState.bearing)}
        >
          <CrewNavGeolocateControl geolocateRef={geolocateRef} />
          <CrewNavFollowCamera userPos={userPos} bearingDeg={navBearingDeg} setMapBearing={setMapBearing} />
          {trafficRouteGeoJson.features.length > 0 && (
            <Source id="crew-nav-route" type="geojson" data={trafficRouteGeoJson}>
              <Layer
                id="crew-nav-route-halo"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{
                  "line-color": CREW_NAV_ROUTE_HALO_COLOR,
                  "line-width": CREW_NAV_HALO_WIDTH,
                  "line-opacity": 0.95,
                }}
              />
              <Layer
                id="crew-nav-route-line"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{
                  "line-color": CREW_NAV_ROUTE_LINE_COLOR,
                  "line-width": CREW_NAV_LINE_WIDTH,
                  "line-opacity": 1,
                }}
              />
            </Source>
          )}
          {routeArrowLineData && (
            <Source id={CREW_NAV_ROUTE_ARROWS_SOURCE_ID} type="geojson" data={routeArrowLineData}>
              <Layer
                id={CREW_NAV_ROUTE_ARROWS_LAYER_ID}
                type="symbol"
                layout={{
                  "symbol-placement": "line",
                  "symbol-spacing": 52,
                  "text-field": "›",
                  "text-size": 19,
                  "text-allow-overlap": true,
                  "text-ignore-placement": true,
                  "text-rotation-alignment": "map",
                  "text-pitch-alignment": "viewport",
                }}
                paint={{
                  "text-color": "#ffffff",
                  "text-halo-color": "#1A1816",
                  "text-halo-width": 1.5,
                }}
              />
            </Source>
          )}
          {userPos && (
            <Marker longitude={userPos.lng} latitude={userPos.lat} anchor="center">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_3px_12px_rgba(0,0,0,0.2)]"
                style={{
                  transform:
                    navBearingDeg != null ? `rotate(${navBearingDeg - mapBearing}deg)` : undefined,
                }}
              >
                <NavigationArrow className="text-[#1A1816]" size={28} weight="fill" aria-hidden />
              </div>
            </Marker>
          )}
          <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
            <div className="w-3 h-3 rounded-full border-2 border-white shadow-md" style={{ background: GOLD }} />
          </Marker>
          {guidance.callout ? (
            <Marker longitude={guidance.callout.lng} latitude={guidance.callout.lat} anchor="bottom">
              <div className="pointer-events-none flex flex-col items-center">
                <div className="flex max-w-[min(92vw,280px)] items-center gap-2 rounded-2xl bg-[#2563EB] px-3 py-2.5 shadow-[0_4px_14px_rgba(37,99,235,0.42)]">
                  <ManeuverGlyph
                    type={guidance.maneuverMeta.type}
                    modifier={guidance.maneuverMeta.modifier}
                    className="h-6 w-6 shrink-0 text-white"
                  />
                  <div className="min-w-0">
                    <p className="text-left text-[15px] font-bold leading-snug text-white">{guidance.callout.label}</p>
                    {guidance.turnDistanceLabel ? (
                      <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-white/90">
                        {guidance.turnDistanceLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div
                  className="h-0 w-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-[#2563EB]"
                  aria-hidden
                />
              </div>
            </Marker>
          ) : null}
          <CrewNavOpsFloatingControls
            userPos={userPos}
            navBearingDeg={navBearingDeg}
            setMapBearing={setMapBearing}
            onRecenter={(origin) => void fetchRoute(origin)}
            mapBearing={mapBearing}
            geolocateRef={geolocateRef}
            voiceMuted={!voiceOn}
            onVoiceToggle={() => setVoiceOn((v) => !v)}
            onReportOpen={() => setReportOpen(true)}
            onAlternatesOpen={() => setAlternatesOpen(true)}
          />
        </Map>

        <div
          className="absolute bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))] left-3 z-10 rounded-xl border border-black/10 bg-white px-3 py-2 shadow-md"
          aria-live="polite"
        >
          <span className="text-[13px] font-semibold tabular-nums text-[#1A1816]">{speedDisplay ?? "—"}</span>
        </div>
        {mapError && (
          <div className="absolute left-3 right-3 top-[calc(0.65rem+env(safe-area-inset-top,0px))] z-10 rounded-lg bg-red-900/92 px-3 py-2 text-[12px] text-white">
            {mapError}
          </div>
        )}

      </div>

      <div className="shrink-0 rounded-t-[1.35rem] bg-white text-[#1A1816] shadow-[0_-10px_40px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[clamp(1.75rem,6vw,2.25rem)] font-bold leading-none tracking-tight text-[#5C1A33]">{etaLabel}</p>
            <p className="mt-1.5 text-[12px] tabular-nums text-neutral-600">
              {distRemainLabel}
              {arrivalClockLabel ? ` · ${arrivalClockLabel}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-[#1A1816] hover:bg-neutral-200/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E2D]/40"
              aria-label="Route overview"
              title="Route overview"
              onClick={fitRouteOverview}
            >
              <ArrowsSplit size={24} weight="bold" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900/40"
            >
              Exit
            </button>
          </div>
        </div>
        <p className="line-clamp-2 px-4 pb-1 text-[12px] text-neutral-500">{destination.address}</p>
        <div className="h-[env(safe-area-inset-bottom,0px)] min-h-0" aria-hidden />
      </div>

      <GlobalModal open={reportOpen} onClose={() => setReportOpen(false)} title="Report road issue">
        <div className="space-y-3 p-1">
          {!jobId ? (
            <p className="text-sm text-[#1A1816]">Reporting requires an active job context.</p>
          ) : (
            <>
              <p className="text-[13px] text-[#1A1816]/80">
                Sends a delay note to dispatch with your job attached. Add detail if needed.
              </p>
              <textarea
                className="min-h-[88px] w-full rounded-md border border-[#CBC4B8] px-3 py-2 text-sm"
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Road closure, hazard, or traffic."
              />
            </>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-[#CBC4B8] px-3 py-1.5 text-sm font-semibold text-[#1A1816]"
              onClick={() => setReportOpen(false)}
            >
              Close
            </button>
            {jobId ? (
              <button
                type="button"
                disabled={reportBusy}
                className="rounded-md bg-[#2C3E2D] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => void submitNavReport()}
              >
                {reportBusy ? "Sending…" : "Submit"}
              </button>
            ) : null}
          </div>
        </div>
      </GlobalModal>

      <GlobalModal open={alternatesOpen} onClose={() => setAlternatesOpen(false)} title="Route options">
        <div className="max-h-[50vh] space-y-2 overflow-y-auto p-1">
          {routeSummaries.length === 0 ? (
            <p className="text-sm text-[#1A1816]">No alternate routes are available for this trip.</p>
          ) : (
            routeSummaries.map((s) => {
              const isActive = s.index === selectedRouteIndex;
              return (
                <button
                  key={s.index}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E2D] focus-visible:ring-offset-2 ${
                    isActive ? "border-[#2C3E2D] bg-[#FAF7F2]" : "border-[#E8E4DD] bg-white hover:bg-[#FAF7F2]/80"
                  }`}
                  onClick={() => {
                    applyRouteAlternative(s.index);
                    setAlternatesOpen(false);
                  }}
                >
                  <p className="font-semibold text-[#1A1816]">
                    Option {s.index + 1}
                    {isActive ? " · Active" : ""}
                  </p>
                  <p className="text-[#1A1816]/80">
                    {s.etaLabel} · {s.distanceLabel}
                    {s.fuelCostLabel ? ` · ${s.fuelCostLabel}` : ""}
                  </p>
                  {!isActive ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tx)]">
                      Use this route
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
          <p className="text-xs text-[#1A1816]/65">
            The app starts on the fastest option. Tap another route to switch. Rerouting from GPS picks again automatically.
          </p>
        </div>
      </GlobalModal>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(navUi, document.body) : null;
}
