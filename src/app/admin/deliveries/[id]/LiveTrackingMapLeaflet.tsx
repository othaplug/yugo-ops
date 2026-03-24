"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CREW_GOLD = "#C9A962";

/** Directional arrow for crew position — same geometry as client tracking maps. */
function makeCrewArrowIcon(bearingDeg: number | null) {
  const rot = bearingDeg != null ? bearingDeg : 0;
  return L.divIcon({
    className: "crew-marker crew-marker-arrow",
    html: `<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center">
      <svg width="44" height="44" viewBox="0 0 44 44" style="transform:rotate(${rot}deg);transition:transform 0.8s ease-out;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.55))" aria-hidden="true">
        <polygon points="22,5 34,36 22,29 10,36" fill="${CREW_GOLD}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function makePickupIcon() {
  return L.divIcon({
    className: "pickup-marker",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#22C55E;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function makeDropoffIcon() {
  return L.divIcon({
    className: "dropoff-marker",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#C9A962;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Tracking line from vehicle to destination - purple everywhere */
const ROUTE_LINE_LIGHT = { color: "#8B5CF6", weight: 5, opacity: 1 };
const ROUTE_LINE_DARK = { color: "#8B5CF6", weight: 5, opacity: 1 };

function MapController({
  center,
  hasPosition,
  points,
}: {
  center: [number, number];
  hasPosition: boolean;
  points: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView(center, hasPosition ? 14 : 10);
    }
  }, [map, center, hasPosition, points]);
  return null;
}

export function LiveTrackingMapLeaflet({
  center,
  crew,
  crewName,
  crewBearing = null,
  pickup,
  dropoff,
  destination,
  mapTheme = "light",
  routePositions,
}: {
  center: { longitude: number; latitude: number };
  crew: { current_lat: number; current_lng: number; name?: string } | null;
  crewName?: string;
  crewBearing?: number | null;
  /** Pickup coords — green marker */
  pickup?: { lat: number; lng: number };
  /** Dropoff coords — gold marker */
  dropoff?: { lat: number; lng: number };
  /** Fallback when no pickup/dropoff (e.g. moves) */
  destination?: { lat: number; lng: number };
  /** When "dark", use dark base tiles to match admin/crew appearance */
  mapTheme?: "light" | "dark";
  /** Real driving route [lat, lng][] from Mapbox; when provided, drawn instead of straight line */
  routePositions?: [number, number][];
}) {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const hasPosition = crew != null;
  const routeDestArr: [number, number] | undefined =
    destination ? [destination.lat, destination.lng] : (pickup ?? dropoff) ? [(pickup ?? dropoff)!.lat, (pickup ?? dropoff)!.lng] : undefined;
  const boundsPoints = useMemo((): [number, number][] => {
    const pts: [number, number][] = [centerArr];
    if (hasPosition && crew) pts.push([crew.current_lat, crew.current_lng]);
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (dropoff) pts.push([dropoff.lat, dropoff.lng]);
    return pts;
  }, [centerArr[0], centerArr[1], hasPosition, crew?.current_lat, crew?.current_lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);
  const tileUrl =
    mapTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const linePositions: [number, number][] =
    routePositions && routePositions.length > 0
      ? routePositions
      : hasPosition && crew && routeDestArr
        ? [[crew.current_lat, crew.current_lng], routeDestArr]
        : [];

  return (
    <MapContainer
      center={centerArr}
      zoom={hasPosition ? 14 : 10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={centerArr} hasPosition={hasPosition} points={boundsPoints} />
      <TileLayer attribution="" url={tileUrl} />
      {linePositions.length >= 2 && (
        <Polyline
          positions={linePositions}
          pathOptions={mapTheme === "dark" ? ROUTE_LINE_DARK : ROUTE_LINE_LIGHT}
        />
      )}
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={makePickupIcon()}>
          <Popup>Pickup</Popup>
        </Marker>
      )}
      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={makeDropoffIcon()}>
          <Popup>Drop-off</Popup>
        </Marker>
      )}
      {!pickup && !dropoff && destination && (
        <Marker position={[destination.lat, destination.lng]} icon={makePickupIcon()}>
          <Popup>Destination</Popup>
        </Marker>
      )}
      {hasPosition && crew && (
        <Marker
          position={[crew.current_lat, crew.current_lng]}
          icon={makeCrewArrowIcon(crewBearing ?? null)}
        >
          <Popup>{(crewName || crew.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
