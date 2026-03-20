"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAPBOX_TOKEN =
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN)) || "";
const USE_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

type Center = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

const YUGO_GOLD = "#C9A94E";
const YUGO_GREEN = "#22C55E";

/** Stages where crew is heading to pickup; otherwise heading to dropoff */
const PICKUP_STAGES = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route",
  "on_route",
  "arrived",
  "arrived_on_site",
];

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `
    <div style="
      width: 14px;
      height: 14px;
      background: ${YUGO_GOLD};
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `
    <div style="
      width: 14px;
      height: 14px;
      background: ${YUGO_GREEN};
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function makeCrewIcon() {
  return L.divIcon({
    className: "crew-marker",
    html: `
      <div style="
        width: 18px;
        height: 18px;
        background: ${YUGO_GOLD};
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(201,169,78,0.4);
        animation: leaflet-crew-pulse 2s infinite;
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapController({
  center,
  pickup,
  dropoff,
  crew,
}: {
  center: Center;
  pickup: Center | null;
  dropoff: Center | null;
  crew: Crew;
}) {
  const map = useMap();
  const hasCrew = crew != null;
  const hasRoute = pickup && dropoff;

  useEffect(() => {
    if (hasRoute) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      );
      if (hasCrew && crew) {
        bounds.extend([crew.current_lat, crew.current_lng]);
      }
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    } else {
      const zoom = hasCrew ? 14 : 10;
      map.setView([center.lat, center.lng], zoom);
    }
  }, [map, center.lat, center.lng, pickup, dropoff, crew, hasRoute, hasCrew]);

  return null;
}

function MapResizeOnSignalLeaflet({ signal }: { signal: number }) {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        map.invalidateSize();
      } catch {
        /* map teardown */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [signal, map]);
  return null;
}

export function TrackLiveMapLeaflet({
  center,
  crew,
  pickup,
  dropoff,
  liveStage,
  resizeSignal = 0,
}: {
  center: Center;
  crew: Crew;
  pickup?: Center | null;
  dropoff?: Center | null;
  /** Current stage: tracking line goes from vehicle to the address they're heading to */
  liveStage?: string | null;
  resizeSignal?: number;
}) {
  const hasPosition = crew != null;
  const hasRoute = pickup && dropoff;

  /** Tracking line: crew → current destination, or when no crew show planned route pickup → dropoff */
  const trackingLineStraight: [number, number][] = useMemo(() => {
    if (!pickup || !dropoff) return [];
    if (crew) {
      const currentDestination = PICKUP_STAGES.includes(liveStage || "") ? pickup : dropoff;
      return [
        [crew.current_lat, crew.current_lng],
        [currentDestination.lat, currentDestination.lng],
      ];
    }
    return [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
  }, [crew, pickup, dropoff, liveStage]);

  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const lastFetchRef = useRef<string>("");

  const currentDestination = useMemo(() => {
    if (!pickup || !dropoff) return null;
    return PICKUP_STAGES.includes(liveStage || "") ? pickup : dropoff;
  }, [pickup, dropoff, liveStage]);

  const fetchDrivingRoute = useCallback(async (from: Center, to: Center) => {
    if (!MAPBOX_TOKEN || !USE_MAPBOX) return;
    const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}-${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    if (lastFetchRef.current === key) return;
    lastFetchRef.current = key;
    try {
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const coordsList = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      if (Array.isArray(coordsList) && coordsList.length >= 2) {
        setRouteLine(coordsList.map(([lng, lat]) => [lat, lng] as [number, number]));
      } else {
        setRouteLine(null);
      }
    } catch {
      setRouteLine(null);
    }
  }, []);

  useEffect(() => {
    if (crew && currentDestination) {
      fetchDrivingRoute(
        { lat: crew.current_lat, lng: crew.current_lng },
        currentDestination
      );
      return;
    }
    if (pickup && dropoff) {
      // No crew yet: show planned route pickup → dropoff so user sees where crew is going
      fetchDrivingRoute(pickup, dropoff);
      return;
    }
    lastFetchRef.current = "";
    setRouteLine(null);
  }, [crew?.current_lat, crew?.current_lng, currentDestination?.lat, currentDestination?.lng, pickup, dropoff, fetchDrivingRoute]);

  const purpleLinePositions = routeLine && routeLine.length >= 2 ? routeLine : trackingLineStraight;

  const zoom = hasPosition ? 14 : 10;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={center} pickup={pickup ?? null} dropoff={dropoff ?? null} crew={crew} />
      <MapResizeOnSignalLeaflet signal={resizeSignal} />
      {USE_MAPBOX ? (
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution=""
        />
      ) : (
        <TileLayer
          attribution=""
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      {purpleLinePositions.length >= 2 && (
        <Polyline
          positions={purpleLinePositions}
          color="#8B5CF6"
          weight={5}
          opacity={1}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>Pickup</Popup>
        </Marker>
      )}
      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>Drop-off</Popup>
        </Marker>
      )}
      {hasPosition && crew && (
        <Marker position={[crew.current_lat, crew.current_lng]} icon={makeCrewIcon()}>
          <Popup>{(crew.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
