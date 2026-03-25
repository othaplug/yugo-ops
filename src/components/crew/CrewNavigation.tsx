"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Source, useMap } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ArrowBendDownLeft,
  ArrowBendDownRight,
  ArrowRight,
  ForkKnife,
  MapPin,
  NavigationArrow,
  SignIn,
  TrafficCone,
} from "@phosphor-icons/react";
import { markCrewLocationAllowed } from "@/lib/crew/useCrewPersistentTracking";
import { fetchIntelligentRoute } from "@/lib/routing/intelligent-directions";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

const REROUTE_DEVIATION_M = 200;
const ARRIVAL_RADIUS_M = 100;
const POST_MIN_MS = 1100;
const REVERSE_GEOCODE_MS = 45_000;

const GOLD = "#B8962E";
/** Burgundy route line (wine) — distinct from gold UI accents. */
const WINE_ROUTE = "#7B1F2F";
const FIRST_PERSON_PITCH = 62;
const NAV_FOLLOW_ZOOM = 17;

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

/**
 * Keeps the map in first-person follow mode (pitch + heading) while `followNavigation` is on,
 * and renders the floating control to re-center on GPS + resume follow + refresh the route.
 */
function CrewNavMapFollowAndRecenter({
  userPos,
  navBearingDeg,
  followNavigation,
  setFollowNavigation,
  setMapBearing,
  onRecenter,
}: {
  userPos: { lat: number; lng: number } | null;
  navBearingDeg: number | null;
  followNavigation: boolean;
  setFollowNavigation: (v: boolean) => void;
  setMapBearing: (deg: number) => void;
  onRecenter: (origin: { lat: number; lng: number }) => void;
}) {
  const { current: mapRef } = useMap();

  useEffect(() => {
    if (!followNavigation || !userPos || !mapRef?.getMap) return;
    const map = mapRef.getMap();
    const bearing = navBearingDeg ?? map.getBearing();
    setMapBearing(bearing);
    try {
      map.jumpTo({
        center: [userPos.lng, userPos.lat],
        bearing,
        pitch: FIRST_PERSON_PITCH,
        zoom: Math.max(map.getZoom(), NAV_FOLLOW_ZOOM),
      });
    } catch {
      /* map may be tearing down */
    }
  }, [userPos?.lat, userPos?.lng, navBearingDeg, followNavigation, mapRef]);

  return (
    <button
      type="button"
      onClick={() => {
        const u = userPos;
        if (!u) return;
        setFollowNavigation(true);
        const map = mapRef?.getMap?.();
        const bearing = navBearingDeg ?? map?.getBearing() ?? 0;
        if (map) {
          setMapBearing(bearing);
          try {
            map.flyTo({
              center: [u.lng, u.lat],
              bearing,
              pitch: FIRST_PERSON_PITCH,
              zoom: NAV_FOLLOW_ZOOM,
              duration: 650,
            });
          } catch {
            /* ignore */
          }
        }
        onRecenter(u);
      }}
      disabled={!userPos}
      className="absolute bottom-24 right-3 z-10 bg-white rounded-full p-3 shadow-lg text-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
      aria-label="Center on my location and follow navigation"
      title="My location & navigation view"
    >
      <NavigationArrow size={22} weight="bold" aria-hidden />
    </button>
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

function distancePointToSegmentMeters(
  latP: number,
  lngP: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
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
  if (c1 <= 0) return Math.hypot(xa, ya);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(xb - xa, yb - ya);
  const t = c1 / c2;
  const px = xa + t * vx;
  const py = ya + t * vy;
  return Math.hypot(px, py);
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

function formatDistanceM(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export type CrewNavDestination = { lat: number; lng: number; address: string };

type RouteStep = {
  maneuver?: { instruction?: string; type?: string; modifier?: string; location?: [number, number] };
  distance?: number;
};

function ManeuverIcon({ type, modifier }: { type?: string; modifier?: string }) {
  const t = (type || "").toLowerCase();
  const m = (modifier || "").toLowerCase();
  if (m.includes("left") || t.includes("left")) return <ArrowBendDownLeft className="w-8 h-8 shrink-0" weight="bold" />;
  if (m.includes("right") || t.includes("right")) return <ArrowBendDownRight className="w-8 h-8 shrink-0" weight="bold" />;
  if (t.includes("merge")) return <SignIn className="w-8 h-8 shrink-0" weight="bold" />;
  if (t.includes("roundabout") || t.includes("rotary")) return <TrafficCone className="w-8 h-8 shrink-0" weight="bold" />;
  if (t.includes("fork")) return <ForkKnife className="w-8 h-8 shrink-0" weight="bold" />;
  if (t.includes("arrive")) return <MapPin className="w-8 h-8 shrink-0" weight="bold" />;
  return <ArrowRight className="w-8 h-8 shrink-0" weight="bold" />;
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
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [routeDurationSec, setRouteDurationSec] = useState<number | null>(null);
  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [nextInstruction, setNextInstruction] = useState("Loading route…");
  const [maneuverMeta, setManeuverMeta] = useState<{ type?: string; modifier?: string }>({});
  const [etaLabel, setEtaLabel] = useState("—");
  const [distRemainLabel, setDistRemainLabel] = useState("—");
  const [mapError, setMapError] = useState<string | null>(null);
  const [speedDisplay, setSpeedDisplay] = useState<string | null>(null);
  const [torontoWarnings, setTorontoWarnings] = useState<string[]>([]);
  /** Degrees clockwise from north — device heading or course-over-ground. */
  const [navBearingDeg, setNavBearingDeg] = useState<number | null>(null);
  /** Map bearing used to rotate the crew arrow relative to the camera. */
  const [mapBearing, setMapBearing] = useState(0);
  /** When true, camera follows GPS in first-person (pitch + bearing). */
  const [followNavigation, setFollowNavigation] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const prevGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastNavBearingRef = useRef<number | null>(null);
  /** After a high-accuracy watch fails (timeout / unavailable), retry once with relaxed options. */
  const geoRelaxedRetryDoneRef = useRef(false);
  const lastPostRef = useRef(0);
  const lastReverseRef = useRef(0);
  const approxPlaceRef = useRef<string | null>(null);
  const arrivedRef = useRef(false);
  const fetchRouteInFlight = useRef(false);
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

  const isNight = useMemo(() => {
    const h = new Date().getHours();
    return h >= 19 || h < 7;
  }, []);

  const mapStyle = isNight ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";

  const lineGeoJson = useMemo(() => {
    if (!routeCoords || routeCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: routeCoords },
    };
  }, [routeCoords]);

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
        setTorontoWarnings([]);
        return;
      }
      const r = intelligent.route;
      setRouteCoords(intelligent.coordinates);
      const dur = typeof r.duration === "number" ? r.duration : null;
      const dist = typeof r.distance === "number" ? r.distance : null;
      setRouteDurationSec(dur);
      setRouteDistanceM(dist);
      const legSteps = (r.legs?.[0]?.steps || []) as RouteStep[];
      setSteps(legSteps);
      const first = legSteps[0]?.maneuver;
      setNextInstruction(first?.instruction || "Follow the route");
      setManeuverMeta({ type: first?.type, modifier: first?.modifier });
      if (dur != null) setEtaLabel(formatEta(dur));
      if (dist != null) setDistRemainLabel(formatDistanceM(dist));
      setTorontoWarnings(intelligent.torontoWarnings);
      setMapError(null);
    } catch {
      setMapError("Route request failed.");
      setTorontoWarnings([]);
    } finally {
      fetchRouteInFlight.current = false;
    }
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
    setTorontoWarnings([]);
    prevGeoRef.current = null;
    lastNavBearingRef.current = null;
    setNavBearingDeg(null);
    setFollowNavigation(true);
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

        let bearing: number | null = null;
        const head =
          typeof heading === "number" && !Number.isNaN(heading) && heading >= 0 ? heading : null;
        if (head != null) {
          bearing = head;
        } else if (prevGeoRef.current && typeof speed === "number" && !Number.isNaN(speed) && speed > 0.5) {
          bearing = calcBearing(prevGeoRef.current, { lat: latitude, lng: longitude });
        } else if (lastNavBearingRef.current != null) {
          bearing = lastNavBearingRef.current;
        }
        prevGeoRef.current = { lat: latitude, lng: longitude };
        if (bearing != null) lastNavBearingRef.current = bearing;
        setNavBearingDeg(bearing);

        if (speed != null && !Number.isNaN(speed) && speed >= 0) {
          const kmh = speed * 3.6;
          setSpeedDisplay(kmh >= 1 ? `${Math.round(kmh)} km/h` : null);
        } else {
          setSpeedDisplay(null);
        }

        const dest = destRef.current;
        const distToDestM = haversineM(latitude, longitude, dest.lat, dest.lng);
        setDistRemainLabel(formatDistanceM(distToDestM));

        const rd = routeDurationRef.current;
        const rdist = routeDistanceRef.current;
        let etaSec: number | null = null;
        if (rd != null && rdist != null && rdist > 1) {
          etaSec = rd * (distToDestM / rdist);
          setEtaLabel(formatEta(etaSec));
        } else if (speed != null && !Number.isNaN(speed) && speed > 0.5) {
          etaSec = distToDestM / speed;
          setEtaLabel(formatEta(etaSec));
        } else {
          setEtaLabel("—");
        }

        const rc = routeCoordsRef.current;
        if (rc && rc.length >= 2) {
          const offM = minDistanceToRouteM(latitude, longitude, rc);
          if (offM > REROUTE_DEVIATION_M) {
            void fetchRoute({ lat: latitude, lng: longitude });
          }
        }

        const st = stepsRef.current;
        if (st.length && rc && rc.length >= 2) {
          let bestIdx = 0;
          let bestD = Infinity;
          for (let i = 0; i < st.length; i++) {
            const loc = st[i]?.maneuver?.location;
            if (!loc) continue;
            const d = haversineM(latitude, longitude, loc[1], loc[0]);
            if (d < bestD) {
              bestD = d;
              bestIdx = i;
            }
          }
          const next = st[bestIdx + 1];
          const cur = st[bestIdx];
          if (next?.maneuver?.instruction) {
            const stepDist = typeof next.distance === "number" ? next.distance : bestD;
            setNextInstruction(
              stepDist > 30 ? `In ${formatDistanceM(stepDist)}: ${next.maneuver.instruction}` : next.maneuver.instruction
            );
            setManeuverMeta({ type: next.maneuver.type, modifier: next.maneuver.modifier });
          } else if (cur?.maneuver?.instruction) {
            setNextInstruction(cur.maneuver.instruction);
            setManeuverMeta({ type: cur.maneuver.type, modifier: cur.maneuver.modifier });
          }
        }

        void postLocation(position.coords, etaSec, Math.round(distToDestM));

        if (!gotFirstFix) {
          gotFirstFix = true;
          void fetchRoute({ lat: latitude, lng: longitude });
        }

        if (!arrivedRef.current && distToDestM < ARRIVAL_RADIUS_M) {
          arrivedRef.current = true;
          setNextInstruction("You have arrived");
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

  const initialView = useMemo(() => {
    const lat = userPos?.lat ?? destination.lat;
    const lng = userPos?.lng ?? destination.lng;
    return {
      latitude: lat,
      longitude: lng,
      zoom: NAV_FOLLOW_ZOOM,
      bearing: 0,
      pitch: FIRST_PERSON_PITCH,
    };
  }, [userPos?.lat, userPos?.lng, destination.lat, destination.lng]);

  if (!HAS_MAPBOX) {
    return (
      <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col items-center justify-center bg-[var(--bg)] p-6 text-center">
        <p className="text-[var(--tx)] font-semibold mb-2">Mapbox is not configured</p>
        <p className="text-[13px] text-[var(--tx3)] mb-4">Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for in-app navigation.</p>
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-black">
      <div className="shrink-0 text-white p-4 flex items-start gap-3 border-b border-white/10 bg-[#1a3d2e]">
        <ManeuverIcon type={maneuverMeta.type} modifier={maneuverMeta.modifier} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold leading-snug">{nextInstruction}</p>
          <p className="text-[13px] opacity-85 mt-0.5">{distRemainLabel} remaining</p>
          {torontoWarnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] leading-snug text-amber-100/95 bg-black/25 rounded-lg px-2.5 py-2 border border-amber-400/25">
              {torontoWarnings.map((w, i) => (
                <li key={`${i}-${w.slice(0, 24)}`}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialView}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
          reuseMaps
          onMoveEnd={(e) => setMapBearing(e.viewState.bearing)}
          onDragStart={() => setFollowNavigation(false)}
          onZoomStart={() => setFollowNavigation(false)}
          onRotateStart={() => setFollowNavigation(false)}
          onPitchStart={() => setFollowNavigation(false)}
        >
          {lineGeoJson && (
            <Source id="crew-nav-route" type="geojson" data={lineGeoJson}>
              <Layer
                id="crew-nav-route-line"
                type="line"
                paint={{
                  "line-color": WINE_ROUTE,
                  "line-width": 5,
                  "line-opacity": 0.92,
                }}
              />
            </Source>
          )}
          {userPos && (
            <Marker longitude={userPos.lng} latitude={userPos.lat} anchor="center">
              <div
                className="flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                style={{
                  transform:
                    navBearingDeg != null ? `rotate(${navBearingDeg - mapBearing}deg)` : undefined,
                }}
              >
                <NavigationArrow className="text-[#22C55E]" size={44} weight="fill" aria-hidden />
              </div>
            </Marker>
          )}
          <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
            <div className="w-3 h-3 rounded-full border-2 border-white shadow-md" style={{ background: GOLD }} />
          </Marker>
          <NavigationControl position="bottom-right" showCompass showZoom />
          <CrewNavMapFollowAndRecenter
            userPos={userPos}
            navBearingDeg={navBearingDeg}
            followNavigation={followNavigation}
            setFollowNavigation={setFollowNavigation}
            setMapBearing={setMapBearing}
            onRecenter={(origin) => void fetchRoute(origin)}
          />
        </Map>

        {speedDisplay && (
          <div className="absolute top-3 right-3 bg-black/70 text-white text-[12px] font-bold px-2.5 py-1 rounded-lg">
            {speedDisplay}
          </div>
        )}
        {mapError && (
          <div className="absolute top-12 left-3 right-3 bg-red-900/90 text-white text-[12px] px-3 py-2 rounded-lg">{mapError}</div>
        )}

      </div>

      <div className="shrink-0 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#4a1528]">
        <div>
          <p className="text-2xl font-bold leading-none">{etaLabel}</p>
          <p className="text-[11px] opacity-80 mt-1 uppercase tracking-wide">ETA</p>
        </div>
        <div className="text-right min-w-0 flex-1 max-w-[55%]">
          <p className="text-[13px] font-medium truncate">{destination.address}</p>
          <p className="text-[12px] opacity-75 mt-0.5">{distRemainLabel}</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Exit Nav
        </button>
      </div>
    </div>
  );
}
