"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const GOLD = "#C9A962";

function makeCrewArrowIcon() {
  return L.divIcon({
    className: "crew-marker crew-marker-arrow",
    html: `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center">
      <svg width="44" height="44" viewBox="0 0 44 44" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.45))" aria-hidden="true">
        <polygon points="22,5 34,36 22,29 10,36" fill="${GOLD}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function MapController({
  center,
  crews,
  zoom,
}: {
  center: [number, number];
  crews: { current_lat: number; current_lng: number }[];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (crews.length > 0) {
      const bounds = L.latLngBounds(
        crews.map((c) => [c.current_lat, c.current_lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView(center, zoom);
    }
  }, [map, center, crews, zoom]);
  return null;
}

export function CrewMapLeaflet({
  crews,
  center,
  zoom,
  onCrewClick,
}: {
  crews: { id: string; name: string; current_lat: number; current_lng: number }[];
  center: { longitude: number; latitude: number };
  zoom: number;
  onCrewClick?: (id: string) => void;
}) {
  const centerArr: [number, number] = [center.latitude, center.longitude];

  return (
    <MapContainer
      center={centerArr}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={centerArr} crews={crews} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {crews.map((c) => (
        <Marker
          key={c.id}
          position={[c.current_lat, c.current_lng]}
          icon={makeCrewArrowIcon()}
          eventHandlers={{
            click: () => onCrewClick?.(c.id),
          }}
        >
          <Popup>{(c.name || "Crew").replace("Team ", "")}</Popup>
          <Tooltip permanent direction="top" offset={[0, -44]} className="crew-label-tooltip">
            {(c.name || "Crew").replace("Team ", "")}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
