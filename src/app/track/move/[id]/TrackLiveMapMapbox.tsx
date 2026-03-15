"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Map from "react-map-gl/mapbox";
import { Marker, Source, Layer, useMap } from "react-map-gl/mapbox";

type Center = { latitude: number; longitude: number };
type CenterLatLng = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

/**
 * Smooth position interpolation for the crew marker.
 * Animates from old → new position over ANIM_MS milliseconds.
 */
function useAnimatedPosition(target: { lat: number; lng: number } | null, durationMs = 2000) {
  const [pos, setPos] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!target) { setPos(null); prevRef.current = null; return; }

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

const YUGO_GOLD = "#C9A962";
const YUGO_PURPLE = "#8B5CF6";

const PICKUP_STAGES = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route",
  "on_route",
  "arrived",
  "arrived_on_site",
];

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
      map.flyTo({ center: [center.longitude, center.latitude], zoom: 10, duration: 0 });
      return;
    }

    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    map.fitBounds([sw, ne], { padding: 80, maxZoom: 15, duration: 500 });
  }, [mapRef, crew?.current_lat, crew?.current_lng, dropoff?.lat, dropoff?.lng, pickup?.lat, pickup?.lng, hasCrew, hasDropoff, hasPickup, center.latitude, center.longitude]);

  return null;
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
}) {
  const hasPosition = crew != null;
  const animatedCrew = useAnimatedPosition(
    crew ? { lat: crew.current_lat, lng: crew.current_lng } : null,
  );

  // Last known location freshness
  const isLocationStale = lastLocationAt
    ? (Date.now() - new Date(lastLocationAt).getTime()) > 5 * 60 * 1000  // >5 min
    : false;
  const lastSeenLabel = lastLocationAt
    ? (() => {
        const sec = Math.floor((Date.now() - new Date(lastLocationAt).getTime()) / 1000);
        if (sec < 60) return "Just now";
        if (sec < 120) return "1 min ago";
        if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
        return `${Math.floor(sec / 3600)}h ago`;
      })()
    : null;
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [completedCoords, setCompletedCoords] = useState<[number, number][] | null>(null);
  const [remainingCoords, setRemainingCoords] = useState<[number, number][] | null>(null);

  // Fetch real driving route: client-side Mapbox (no auth) so public track page works
  const fetchRoute = useCallback(async () => {
    if (!pickup || !dropoff || !mapboxAccessToken) return;
    const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${mapboxAccessToken}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const coordsList = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      if (Array.isArray(coordsList) && coordsList.length >= 2) {
        setRouteCoords(coordsList);
      } else {
        setRouteCoords(null);
      }
    } catch (err) {
      console.warn("[TrackLiveMap] Failed to fetch directions, using straight line", err);
      setRouteCoords(null);
    }
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, mapboxAccessToken]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

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
      const dist = Math.sqrt((lng - animatedCrew.lng) ** 2 + (lat - animatedCrew.lat) ** 2);
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

  // When Mapbox returns no route, show straight line from pickup to dropoff so route is always visible
  const fallbackGeoJson = useMemo(() => {
    if (routeCoords != null || !pickup || !dropoff) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]] as [number, number][],
      },
    };
  }, [routeCoords, pickup, dropoff]);

  return (
    <Map
      mapboxAccessToken={mapboxAccessToken}
      initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      <FitBoundsController crew={crew} pickup={pickup ?? null} dropoff={dropoff ?? null} center={center} />

      {/* Completed route: solid purple */}
      {completedGeoJson && (
        <Source id="route-completed" type="geojson" data={completedGeoJson}>
          <Layer
            id="route-completed-layer"
            type="line"
            paint={{
              "line-color": YUGO_PURPLE,
              "line-width": 5,
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {/* Remaining route: dashed purple */}
      {remainingGeoJson && (
        <Source id="route-remaining" type="geojson" data={remainingGeoJson}>
          <Layer
            id="route-remaining-layer"
            type="line"
            paint={{
              "line-color": YUGO_PURPLE,
              "line-width": 4,
              "line-opacity": 0.6,
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
              "line-color": YUGO_PURPLE,
              "line-width": 3,
              "line-opacity": 0.4,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}

      {/* Pickup marker (green dot) */}
      {pickup && (
        <Marker longitude={pickup.lng} latitude={pickup.lat} anchor="center">
          <div className="w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-white shadow-md" />
        </Marker>
      )}

      {/* Destination — Home icon (dark, pin-style) */}
      {dropoff && (
        <Marker longitude={dropoff.lng} latitude={dropoff.lat} anchor="bottom">
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border-2 border-white shadow-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
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

      {/* Crew — Car icon (red/gold when stale, with pulse) */}
      {hasPosition && animatedCrew && (
        <Marker longitude={animatedCrew.lng} latitude={animatedCrew.lat} anchor="center">
          <div className="relative" style={{ transition: "transform 0.1s linear" }}>
            {!isLocationStale && (
              <div className="absolute -inset-2 rounded-full bg-[#DC2626] opacity-20 animate-ping" style={{ animationDuration: "2s" }} />
            )}
            <div
              className="w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
              style={{ backgroundColor: isLocationStale ? YUGO_GOLD : "#DC2626" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17h2m10 0h2M3 9l2-5h14l2 5"/>
                <path d="M3 9v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/>
                <circle cx="7" cy="17" r="1.5" fill="#FFFFFF" stroke="none"/>
                <circle cx="17" cy="17" r="1.5" fill="#FFFFFF" stroke="none"/>
              </svg>
            </div>
            {speed != null && speed > 0 && !isLocationStale && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {Math.round(speed)} km/h
              </div>
            )}
            {isLocationStale && lastSeenLabel && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/75 text-[#C9A962] text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style={{
              background: "rgba(20,20,20,0.82)",
              backdropFilter: "blur(8px)",
              color: YUGO_GOLD,
              border: `1px solid ${YUGO_GOLD}40`,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={YUGO_GOLD} strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Last known location · {lastSeenLabel}
          </div>
        </div>
      )}

    </Map>
  );
}
