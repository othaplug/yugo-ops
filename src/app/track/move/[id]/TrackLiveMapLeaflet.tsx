"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Center = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

function MapController({ center, hasCrew }: { center: Center; hasCrew: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], hasCrew ? 14 : 10);
  }, [map, center.lat, center.lng, hasCrew]);
  return null;
}

function makeCrewIcon(initial: string) {
  return new L.DivIcon({
    className: "crew-marker",
    html: `<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#C9A962,#8B7332);color:white;font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${initial}</div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

export function TrackLiveMapLeaflet({
  center,
  crew,
}: {
  center: Center;
  crew: Crew;
}) {
  const hasPosition = crew != null;
  const zoom = hasPosition ? 14 : 10;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <MapController center={center} hasCrew={hasPosition} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasPosition && crew && (
        <Marker
          position={[crew.current_lat, crew.current_lng]}
          icon={makeCrewIcon((crew.name || "?").replace("Team ", "").slice(0, 1).toUpperCase())}
        >
          <Popup>{(crew.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
