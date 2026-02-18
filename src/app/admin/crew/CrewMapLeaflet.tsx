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
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, ${YUGO_GOLD}, #8B7332);
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">${(name?.replace("Team ", "") || "?").slice(0, 1).toUpperCase()}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
}: {
  crews: { id: string; name: string; current_lat: number; current_lng: number }[];
  center: { longitude: number; latitude: number };
  zoom: number;
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
        attribution=""
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {crews.map((c) => (
        <Marker
          key={c.id}
          position={[c.current_lat, c.current_lng]}
          icon={makeCrewIcon(c.name)}
        >
          <Popup>{(c.name || "Crew").replace("Team ", "")}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
