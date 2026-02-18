"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const YUGO_GOLD = "#C9A962";

function makeCrewIcon(name: string) {
  return L.divIcon({
    className: "crew-marker",
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, ${YUGO_GOLD}, #8B7332);
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">${(name?.replace("Team ", "") || "?").slice(0, 1).toUpperCase()}</div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function MapController({
  center,
  hasPosition,
}: {
  center: [number, number];
  hasPosition: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, hasPosition ? 14 : 10);
  }, [map, center, hasPosition]);
  return null;
}

export function LiveTrackingMapLeaflet({
  center,
  crew,
  crewName,
}: {
  center: { longitude: number; latitude: number };
  crew: { current_lat: number; current_lng: number; name?: string } | null;
  crewName?: string;
}) {
  const centerArr: [number, number] = [center.latitude, center.longitude];
  const hasPosition = crew != null;

  return (
    <MapContainer
      center={centerArr}
      zoom={hasPosition ? 14 : 10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={centerArr} hasPosition={hasPosition} />
      <TileLayer
        attribution=""
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasPosition && crew && (
        <Marker
          position={[crew.current_lat, crew.current_lng]}
          icon={makeCrewIcon(crewName || crew.name || "Crew")}
        >
          <Popup>{(crewName || crew.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
