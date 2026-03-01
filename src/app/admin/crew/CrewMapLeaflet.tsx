"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Crew car icon for map markers */
function makeCrewIcon() {
  return L.divIcon({
    className: "crew-marker truck-marker truck-marker-animated",
    html: `<div style="position:relative;width:36px;height:36px;"><img src="/crew-car.png" alt="" width="36" height="36" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));" /></div>`,
    iconSize: [40, 44],
    iconAnchor: [20, 40],
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
          icon={makeCrewIcon()}
          eventHandlers={{
            click: () => onCrewClick?.(c.id),
          }}
        >
          <Popup>{(c.name || "Crew").replace("Team ", "")}</Popup>
          <Tooltip permanent direction="top" offset={[0, -36]} className="crew-label-tooltip">
            {(c.name || "Crew").replace("Team ", "")}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
