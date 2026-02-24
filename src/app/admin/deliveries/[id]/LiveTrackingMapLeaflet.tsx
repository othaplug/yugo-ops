"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const YUGO_GOLD = "#C9A962";

/** Crew car icon for map marker (golden hatchback) */
function makeCrewIcon() {
  return L.divIcon({
    className: "crew-marker truck-marker truck-marker-animated",
    html: `<div style="position:relative;width:44px;height:44px;"><img src="/crew-car.png" alt="" width="44" height="44" style="display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));" /></div>`,
    iconSize: [44, 48],
    iconAnchor: [22, 44],
  });
}

/** Tracking line from vehicle to destination (matches client progress bar purple) */
const ROUTE_LINE_OPTIONS = { color: "#8B5CF6", weight: 5, opacity: 1 };

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
}: {
  center: { longitude: number; latitude: number };
  crew: { current_lat: number; current_lng: number; name?: string } | null;
  crewName?: string;
  destination?: { lat: number; lng: number };
  /** When "dark", use dark base tiles to match admin/crew appearance */
  mapTheme?: "light" | "dark";
}) {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const hasPosition = crew != null;
  const destArr: [number, number] | undefined =
    destination ? [destination.lat, destination.lng] : undefined;
  const tileUrl =
    mapTheme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

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
      {hasPosition && crew && destArr && (
        <Polyline
          positions={[[crew.current_lat, crew.current_lng], destArr]}
          pathOptions={ROUTE_LINE_OPTIONS}
        />
      )}
      {hasPosition && crew && (
        <Marker
          position={[crew.current_lat, crew.current_lng]}
          icon={makeCrewIcon()}
        >
          <Popup>{(crewName || crew.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
