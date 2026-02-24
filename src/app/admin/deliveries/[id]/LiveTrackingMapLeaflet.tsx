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

/** Bold tracking line from vehicle to destination (design: black line leading to address) */
const ROUTE_LINE_OPTIONS = { color: "#1A1A1A", weight: 5, opacity: 1 };

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
}: {
  center: { longitude: number; latitude: number };
  crew: { current_lat: number; current_lng: number; name?: string } | null;
  crewName?: string;
  destination?: { lat: number; lng: number };
}) {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const hasPosition = crew != null;
  const destArr: [number, number] | undefined =
    destination ? [destination.lat, destination.lng] : undefined;

  return (
    <MapContainer
      center={centerArr}
      zoom={hasPosition ? 14 : 10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={centerArr} hasPosition={hasPosition} destination={destArr} />
      <TileLayer
        attribution=""
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
