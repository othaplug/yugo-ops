"use client";

import "leaflet/dist/leaflet.css";
import { MapPin } from "@phosphor-icons/react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

function MyLocationButtonLeaflet() {
  const map = useMap();
  const handleClick = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 14),
      () => {}
    );
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="absolute bottom-14 right-4 z-[1000] p-2.5 bg-white rounded-lg shadow-md border border-[#E8E4DF] hover:bg-[#F5F3F0] transition-colors"
      title="My location"
      aria-label="Center on my location"
    >
      <MapPin size={16} color="#666" />
    </button>
  );
}

interface ActiveDelivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  status: string;
  delivery_address: string | null;
  crew_id: string | null;
  crew_name: string | null;
  crew_lat: number | null;
  crew_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  live_stage: string | null;
}

function makeCrewIcon(name?: string | null) {
  const initial = (name || "C").replace("Team ", "").charAt(0).toUpperCase();
  return new L.DivIcon({
    className: "",
    html: `<div style="width:44px;height:44px;position:relative;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#C9A962,#8B7332);opacity:0.25;animation:pulse 2s infinite"></span>
      <span style="position:relative;z-index:1;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#C9A962,#8B7332);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;font-family:'DM Sans',sans-serif;box-shadow:0 2px 10px rgba(201,169,98,0.45)">${initial}</span>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

const destIcon = new L.DivIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#22C55E;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ currentDelivery }: { currentDelivery: ActiveDelivery | null }) {
  const map = useMap();
  useEffect(() => {
    if (!currentDelivery) return;
    const pts: L.LatLngTuple[] = [];
    if (currentDelivery.crew_lat != null && currentDelivery.crew_lng != null) {
      pts.push([currentDelivery.crew_lat, currentDelivery.crew_lng]);
    }
    if (currentDelivery.dest_lat != null && currentDelivery.dest_lng != null) {
      pts.push([currentDelivery.dest_lat, currentDelivery.dest_lng]);
    }
    if (pts.length >= 2) {
      const bounds = L.latLngBounds(pts);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, currentDelivery?.id, currentDelivery?.crew_lat, currentDelivery?.crew_lng, currentDelivery?.dest_lat, currentDelivery?.dest_lng]);
  return null;
}

export default function PartnerMapLeaflet({
  center,
  currentDelivery,
  onSelect,
}: {
  center: { latitude: number; longitude: number };
  currentDelivery: ActiveDelivery | null;
  onSelect: (d: ActiveDelivery) => void;
}) {
  return (
    <div className="relative w-full h-full">
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
    >
      <FitBounds currentDelivery={currentDelivery} />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution=""
      />
      {currentDelivery?.crew_lat != null && currentDelivery?.crew_lng != null && (
        <Marker
          position={[currentDelivery.crew_lat, currentDelivery.crew_lng]}
          icon={makeCrewIcon(currentDelivery.crew_name)}
          eventHandlers={{ click: () => onSelect(currentDelivery) }}
        >
          <Popup>
            <strong>{currentDelivery.customer_name || currentDelivery.delivery_number}</strong>
            <br />
            {currentDelivery.crew_name && <span>Crew: {currentDelivery.crew_name}</span>}
          </Popup>
        </Marker>
      )}
      {currentDelivery?.dest_lat != null && currentDelivery?.dest_lng != null && (
        <>
          <Marker position={[currentDelivery.dest_lat, currentDelivery.dest_lng]} icon={destIcon} />
          {currentDelivery.crew_lat != null && currentDelivery.crew_lng != null && (
            <Polyline
              positions={[[currentDelivery.crew_lat, currentDelivery.crew_lng], [currentDelivery.dest_lat, currentDelivery.dest_lng]]}
              pathOptions={{ color: "#8B5CF6", weight: 4, opacity: 0.8 }}
            />
          )}
        </>
      )}
      <MyLocationButtonLeaflet />
    </MapContainer>
    </div>
  );
}
