"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAPBOX_TOKEN =
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN)) || "";
const USE_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

type Coord = { lat: number; lng: number };
type CrewPos = { current_lat: number; current_lng: number; name?: string } | null;

const GOLD = "#C9A94E";
const GREEN = "#22C55E";

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:12px;height:12px;background:${GOLD};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:12px;height:12px;background:${GREEN};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function crewIcon() {
  return L.divIcon({
    className: "crew-marker",
    html: `<div style="width:18px;height:18px;background:${GOLD};border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 0 rgba(201,169,78,.4);animation:leaflet-crew-pulse 2s infinite"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapController({ center, pickup, dropoff, crew }: { center: Coord; pickup: Coord | null; dropoff: Coord | null; crew: CrewPos }) {
  const map = useMap();
  useEffect(() => {
    const pts: Coord[] = [];
    if (crew) pts.push({ lat: crew.current_lat, lng: crew.current_lng });
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    if (pts.length >= 2) {
      const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 14);
    } else {
      map.setView([center.lat, center.lng], 10);
    }
  }, [map, center, pickup, dropoff, crew]);
  return null;
}

export default function DeliveryTrackMap({
  center,
  crew,
  pickup,
  dropoff,
}: {
  center: Coord;
  crew: CrewPos;
  pickup?: Coord | null;
  dropoff?: Coord | null;
}) {
  const routePositions: [number, number][] = useMemo(() => {
    if (!pickup || !dropoff) return [];
    return [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
  }, [pickup, dropoff]);

  const trackingLine: [number, number][] = useMemo(() => {
    if (!crew || !dropoff) return [];
    return [[crew.current_lat, crew.current_lng], [dropoff.lat, dropoff.lng]];
  }, [crew, dropoff]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={crew ? 14 : 10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={center} pickup={pickup ?? null} dropoff={dropoff ?? null} crew={crew} />
      {USE_MAPBOX ? (
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution=""
        />
      ) : (
        <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      )}
      {routePositions.length === 2 && (
        <Polyline positions={routePositions} color={GOLD} weight={2} opacity={0.3} dashArray="4,6" lineCap="round" />
      )}
      {trackingLine.length === 2 && (
        <Polyline positions={trackingLine} color="#8B5CF6" weight={4} opacity={0.9} lineCap="round" />
      )}
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>Pickup</Popup>
        </Marker>
      )}
      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>Destination</Popup>
        </Marker>
      )}
      {crew && (
        <Marker position={[crew.current_lat, crew.current_lng]} icon={crewIcon()}>
          <Popup>{crew.name || "Crew"}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
