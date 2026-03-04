"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Regular tracker marker (circle, no car). Color matches route line: purple light theme, gold dark. */
function makeCrewIcon(mapTheme: "light" | "dark" = "light") {
  const fill = mapTheme === "dark" ? "#C9A962" : "#8B5CF6";
  return L.divIcon({
    className: "crew-marker-tracker",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${fill};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeDestinationIcon() {
  return L.divIcon({
    className: "dest-marker",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#22C55E;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Tracking line from vehicle to destination - light: purple, dark: gold for visibility */
const ROUTE_LINE_LIGHT = { color: "#8B5CF6", weight: 5, opacity: 1 };
const ROUTE_LINE_DARK = { color: "#C9A962", weight: 5, opacity: 1 };

function MapController({
  center,
  hasPosition,
  destination,
}: {
  center: [number, number];
  hasPosition: boolean;
  destination?: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    if (hasPosition && destination) {
      const bounds = L.latLngBounds([center, destination]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView(center, hasPosition ? 14 : 10);
    }
  }, [map, center, hasPosition, destination]);
  return null;
}

export function LiveTrackingMapLeaflet({
  center,
  crew,
  crewName,
  destination,
  mapTheme = "light",
  routePositions,
}: {
  center: { longitude: number; latitude: number };
  crew: { current_lat: number; current_lng: number; name?: string } | null;
  crewName?: string;
  destination?: { lat: number; lng: number };
  /** When "dark", use dark base tiles to match admin/crew appearance */
  mapTheme?: "light" | "dark";
  /** Real driving route [lat, lng][] from Mapbox; when provided, drawn instead of straight line */
  routePositions?: [number, number][];
}) {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const hasPosition = crew != null;
  const destArr: [number, number] | undefined =
    destination ? [destination.lat, destination.lng] : undefined;
  const tileUrl =
    mapTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const linePositions: [number, number][] =
    routePositions && routePositions.length > 0
      ? routePositions
      : hasPosition && crew && destArr
        ? [[crew.current_lat, crew.current_lng], destArr]
        : [];

  return (
    <MapContainer
      center={centerArr}
      zoom={hasPosition ? 14 : 10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={centerArr} hasPosition={hasPosition} destination={destArr} />
      <TileLayer attribution="" url={tileUrl} />
      {linePositions.length >= 2 && (
        <Polyline
          positions={linePositions}
          pathOptions={mapTheme === "dark" ? ROUTE_LINE_DARK : ROUTE_LINE_LIGHT}
        />
      )}
      {destArr && (
        <Marker position={destArr} icon={makeDestinationIcon()}>
          <Popup>Destination</Popup>
        </Marker>
      )}
      {hasPosition && crew && (
        <Marker
          position={[crew.current_lat, crew.current_lng]}
          icon={makeCrewIcon(mapTheme)}
        >
          <Popup>{(crewName || crew.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
