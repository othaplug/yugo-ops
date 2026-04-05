"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Map from "react-map-gl/mapbox";
import { Marker, Source, Layer, useMap } from "react-map-gl/mapbox";
import { House, Sun } from "@phosphor-icons/react";

type Center = { latitude: number; longitude: number };
type CenterLatLng = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

/**
 * Smooth position interpolation for the crew marker.
 * Animates from old → new position over ANIM_MS milliseconds.
 */
function useAnimatedPosition(
  target: { lat: number; lng: number } | null,
  durationMs = 2000,
) {
  const [pos, setPos] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!target) {
      setPos(null);
      prevRef.current = null;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = target;

    if (!prev || (prev.lat === target.lat && prev.lng === target.lng)) {
      setPos(target);
      return;
    }

    const startLat = prev.lat;
    const startLng = prev.lng;
    const dLat = target.lat - startLat;
    const dLng = target.lng - startLng;
    const start = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
      setPos({ lat: startLat + dLat * ease, lng: startLng + dLng * ease });
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target?.lat, target?.lng, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return pos;
}

const YUGO_GOLD = "#2C3E2D";
const ROUTE_GOLD = "#2C3E2D";
const ROUTE_ESTATE = "#C9A571";
const CREW_RED = "#DC2626";

/** Bearing in degrees (0 = north, 90 = east) from point A → point B. */
function calcBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Tracks heading from consecutive raw GPS positions. */
function useBearing(
  rawLat: number | null | undefined,
  rawLng: number | null | undefined,
): number | null {
  const [bearing, setBearing] = useState<number | null>(null);
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (rawLat == null || rawLng == null) return;
    const curr = { lat: rawLat, lng: rawLng };
    const prev = prevRef.current;
    if (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) {
      const b = calcBearing(prev, curr);
      setBearing(b);
    }
    prevRef.current = curr;
  }, [rawLat, rawLng]);
  return bearing;
}

const PICKUP_STAGES = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route",
  "on_route",
  "arrived",
  "arrived_on_site",
];

function MapResizeOnSignal({ signal }: { signal: number }) {
  const { current: mapRef } = useMap();
  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map) return;
    const id = requestAnimationFrame(() => {
      try {
        map.resize();
      } catch {
        /* map may be destroying */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [signal, mapRef]);
  return null;
}

function FitBoundsController({
  crew,
  pickup,
  dropoff,
  center,
}: {
  crew: Crew;
  pickup: CenterLatLng | null;
  dropoff: CenterLatLng | null;
  center: Center;
}) {
  const { current: mapRef } = useMap();
  const hasCrew = crew != null;
  const hasDropoff = dropoff != null;
  const hasPickup = pickup != null;

  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map) return;

    const points: [number, number][] = [];
    if (hasCrew && crew) points.push([crew.current_lng, crew.current_lat]);
    if (hasDropoff && dropoff) points.push([dropoff.lng, dropoff.lat]);
    if (hasPickup && pickup) points.push([pickup.lng, pickup.lat]);

    if (points.length === 0) {
      map.flyTo({
        center: [center.longitude, center.latitude],
        zoom: 10,
        duration: 0,
      });
      return;
    }

    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    map.fitBounds([sw, ne], { padding: 80, maxZoom: 15, duration: 500 });
  }, [
    mapRef,
    crew?.current_lat,
    crew?.current_lng,
    dropoff?.lat,
    dropoff?.lng,
    pickup?.lat,
    pickup?.lng,
    hasCrew,
    hasDropoff,
    hasPickup,
    center.latitude,
    center.longitude,
  ]);

  return null;
}

function formatDistClientM(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m) || m < 0) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function TrackLiveMapMapbox({
  mapboxAccessToken,
  center,
  crew,
  crewName,
  pickup,
  dropoff,
  liveStage,
  clientLat,
  clientLng,
  speed,
  lastLocationAt,
  resizeSignal = 0,
  isNavigating = false,
  etaOverlayMinutes = null,
  distanceRemainingM = null,
  isEstate = false,
}: {
  mapboxAccessToken: string;
  center: Center;
  crew: Crew;
  crewName?: string;
  pickup?: CenterLatLng | null;
  dropoff?: CenterLatLng | null;
  liveStage?: string | null;
  clientLat?: number | null;
  clientLng?: number | null;
  speed?: number | null;
  lastLocationAt?: string | null;
  resizeSignal?: number;
  isNavigating?: boolean;
  etaOverlayMinutes?: number | null;
  distanceRemainingM?: number | null;
  /** Dark Mapbox style for Estate live tracking */
  isEstate?: boolean;
}) {
  const routeColor = isEstate ? ROUTE_ESTATE : ROUTE_GOLD;
  const accentPin = isEstate ? ROUTE_ESTATE : YUGO_GOLD;
  const hasPosition = crew != null;
  const animatedCrew = useAnimatedPosition(
    crew ? { lat: crew.current_lat, lng: crew.current_lng } : null,
  );
  const bearing = useBearing(crew?.current_lat, crew?.current_lng);

  // Last known location freshness
  const isLocationStale = lastLocationAt
    ? Date.now() - new Date(lastLocationAt).getTime() > 5 * 60 * 1000 // >5 min
    : false;
  const lastSeenLabel = lastLocationAt
    ? (() => {
        const sec = Math.floor(
          (Date.now() - new Date(lastLocationAt).getTime()) / 1000,
        );
        if (sec < 60) return "Just now";
        if (sec < 120) return "1 min ago";
        if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
        return `${Math.floor(sec / 3600)}h ago`;
      })()
    : null;
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(
    null,
  );
  const [completedCoords, setCompletedCoords] = useState<
    [number, number][] | null
  >(null);
  const [remainingCoords, setRemainingCoords] = useState<
    [number, number][] | null
  >(null);

  // During pickup stages: route runs from crew → pickup address.
  // During destination stages: route runs from pickup → dropoff (full planned route).
  const isPickupPhase = PICKUP_STAGES.includes(liveStage || "");
  const routeOrigin = isPickupPhase && animatedCrew ? animatedCrew : pickup;
  const routeDest = isPickupPhase ? pickup : dropoff;

  // Fetch real driving route: client-side Mapbox (no auth) so public track page works
  const fetchRoute = useCallback(async () => {
    if (!routeOrigin || !routeDest || !mapboxAccessToken) return;
    if (routeOrigin === routeDest) return;
    const coords = `${routeOrigin.lng},${routeOrigin.lat};${routeDest.lng},${routeDest.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?geometries=geojson&access_token=${mapboxAccessToken}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const coordsList = data?.routes?.[0]?.geometry?.coordinates as
        | [number, number][]
        | undefined;
      if (Array.isArray(coordsList) && coordsList.length >= 2) {
        setRouteCoords(coordsList);
      } else {
        setRouteCoords(null);
      }
    } catch (err) {
      console.warn(
        "[TrackLiveMap] Failed to fetch directions, using straight line",
        err,
      );
      setRouteCoords(null);
    }
    // During pickup phase we re-fetch as crew moves (every ~30s via parent poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    routeOrigin?.lat,
    routeOrigin?.lng,
    routeDest?.lat,
    routeDest?.lng,
    mapboxAccessToken,
  ]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // Split route into completed and remaining based on animated crew position
  useEffect(() => {
    if (!routeCoords || !animatedCrew) {
      setCompletedCoords(null);
      setRemainingCoords(routeCoords);
      return;
    }

    let minDist = Infinity;
    let splitIdx = 0;
    for (let i = 0; i < routeCoords.length; i++) {
      const [lng, lat] = routeCoords[i];
      const dist = Math.sqrt(
        (lng - animatedCrew.lng) ** 2 + (lat - animatedCrew.lat) ** 2,
      );
      if (dist < minDist) {
        minDist = dist;
        splitIdx = i;
      }
    }

    setCompletedCoords(routeCoords.slice(0, splitIdx + 1));
    setRemainingCoords(routeCoords.slice(splitIdx));
  }, [routeCoords, animatedCrew?.lat, animatedCrew?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Completed portion GeoJSON (solid gold line)
  const completedGeoJson = useMemo(() => {
    if (!completedCoords || completedCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: completedCoords },
    };
  }, [completedCoords]);

  // Remaining portion GeoJSON (dashed gold line)
  const remainingGeoJson = useMemo(() => {
    if (!remainingCoords || remainingCoords.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: remainingCoords },
    };
  }, [remainingCoords]);

  // When Mapbox returns no route, show straight line from origin to destination
  const fallbackGeoJson = useMemo(() => {
    if (routeCoords != null || !routeOrigin || !routeDest) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [routeOrigin.lng, routeOrigin.lat],
          [routeDest.lng, routeDest.lat],
        ] as [number, number][],
      },
    };
  }, [routeCoords, routeOrigin, routeDest]);

  return (
    <Map
      mapboxAccessToken={mapboxAccessToken}
      reuseMaps
      initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={
        isEstate
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/light-v11"
      }
    >
      <FitBoundsController
        crew={crew}
        pickup={pickup ?? null}
        dropoff={dropoff ?? null}
        center={center}
      />
      <MapResizeOnSignal signal={resizeSignal} />

      {/* Completed route: solid gold */}
      {completedGeoJson && (
        <Source id="route-completed" type="geojson" data={completedGeoJson}>
          <Layer
            id="route-completed-layer"
            type="line"
            paint={{
              "line-color": routeColor,
              "line-width": 5,
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {/* Remaining route: dashed gold */}
      {remainingGeoJson && (
        <Source id="route-remaining" type="geojson" data={remainingGeoJson}>
          <Layer
            id="route-remaining-layer"
            type="line"
            paint={{
              "line-color": routeColor,
              "line-width": 4,
              "line-opacity": 0.65,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}

      {/* Fallback route (straight line) */}
      {fallbackGeoJson && (
        <Source id="route-fallback" type="geojson" data={fallbackGeoJson}>
          <Layer
            id="route-fallback-layer"
            type="line"
            paint={{
              "line-color": routeColor,
              "line-width": 3,
              "line-opacity": 0.45,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}

      {/* Pickup marker:
          - During pickup phase: gold pulsing "active destination" pin
          - During destination phase: small green dot (origin reference) */}
      {pickup && (
        <Marker
          longitude={pickup.lng}
          latitude={pickup.lat}
          anchor={isPickupPhase ? "bottom" : "center"}
        >
          {isPickupPhase ? (
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-[#2C3E2D] border-2 border-white shadow-lg flex items-center justify-center relative">
                <div
                  className="absolute -inset-1.5 rounded-full bg-[#2C3E2D] opacity-25 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
                <Sun size={16} color="#FFFFFF" aria-hidden />
              </div>
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#2C3E2D] -mt-0.5" />
            </div>
          ) : (
            <div className="w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-white shadow-md" />
          )}
        </Marker>
      )}

      {/* Destination, Home icon (dark, pin-style); dimmed during pickup phase */}
      {dropoff && (
        <Marker longitude={dropoff.lng} latitude={dropoff.lat} anchor="bottom">
          <div
            className="flex flex-col items-center"
            style={{ opacity: isPickupPhase ? 0.45 : 1 }}
          >
            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border-2 border-white shadow-lg flex items-center justify-center">
              <House size={16} color="#FFFFFF" aria-hidden />
            </div>
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#1A1A1A] -mt-0.5" />
          </div>
        </Marker>
      )}

      {/* Client position (blue dot) */}
      {clientLat != null && clientLng != null && (
        <Marker longitude={clientLng} latitude={clientLat} anchor="center">
          <div className="relative">
            <div className="w-4 h-4 rounded-full bg-[#3B82F6] border-2 border-white shadow-md" />
            <div className="absolute inset-0 rounded-full bg-[#3B82F6] opacity-30 animate-ping" />
          </div>
        </Marker>
      )}

      {/* Crew, directional arrow rotated to heading */}
      {hasPosition && animatedCrew && (
        <Marker
          longitude={animatedCrew.lng}
          latitude={animatedCrew.lat}
          anchor="center"
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            {/* Pulse ring */}
            {!isLocationStale && (
              <span
                className="absolute rounded-full animate-ping"
                style={{
                  inset: 3,
                  background: isLocationStale ? accentPin : CREW_RED,
                  opacity: 0.22,
                  animationDuration: "2s",
                }}
              />
            )}
            {/* Arrow SVG, rotates to heading */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 44 44"
              style={{
                transform: bearing != null ? `rotate(${bearing}deg)` : "none",
                transition: "transform 0.8s ease-out",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
              }}
              aria-hidden
            >
              {/* Arrow pointing north (up); CSS rotation turns it to heading */}
              <polygon
                points="22,5 34,36 22,29 10,36"
                fill={isLocationStale ? accentPin : CREW_RED}
                stroke="white"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* Speed badge */}
            {speed != null && speed > 0 && !isLocationStale && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {Math.round(speed)} km/h
              </div>
            )}
            {/* Stale label */}
            {isLocationStale && lastSeenLabel && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/75 text-[#2C3E2D] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {lastSeenLabel}
              </div>
            )}
          </div>
        </Marker>
      )}

      {/* Last known location badge (when stale) */}
      {isLocationStale && hasPosition && lastSeenLabel && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
            style={{
              background: "rgba(20,20,20,0.82)",
              backdropFilter: "blur(8px)",
              color: accentPin,
              border: `1px solid ${accentPin}40`,
            }}
          >
            Last known location · {lastSeenLabel}
          </div>
        </div>
      )}

      {hasPosition && etaOverlayMinutes != null && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            className="rounded-lg px-3 py-2 shadow-lg text-white max-w-[220px]"
            style={{ background: "rgba(74, 21, 40, 0.92)" }}
          >
            <span className="text-lg font-bold tabular-nums">
              {etaOverlayMinutes} min
            </span>
            <span className="text-[12px] ml-1.5 opacity-85">
              estimated arrival
            </span>
            {distanceRemainingM != null && distanceRemainingM > 0 && (
              <p className="text-[11px] opacity-80 mt-0.5">
                {formatDistClientM(distanceRemainingM)} remaining
              </p>
            )}
            {isNavigating && (
              <p className="text-[10px] opacity-70 mt-1">
                Crew is navigating in the Yugo app
              </p>
            )}
          </div>
        </div>
      )}
    </Map>
  );
}
