"use client";

import "leaflet/dist/leaflet.css";
import { MapPin } from "@phosphor-icons/react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";

const YUGO_GOLD = "#2C3E2D";

function calcBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

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
  is_job_active: boolean;
}

function makeCrewArrowIcon(bearing: number | null = null) {
  const rot = bearing != null ? bearing : 0;
  return new L.DivIcon({
    className: "",
    html: `<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;inset:5px;border-radius:50%;background:${YUGO_GOLD};opacity:0.18;animation:pulse 2s ease-out infinite"></span>
      <svg width="36" height="36" viewBox="0 0 44 44" style="transform:rotate(${rot}deg);transition:transform 0.8s ease-out;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35))" aria-hidden="true">
        <polygon points="22,5 34,36 22,29 10,36" fill="${YUGO_GOLD}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
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
  const [bearing, setBearing] = useState<number | null>(null);
  const prevCrewRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const lat = currentDelivery?.crew_lat;
    const lng = currentDelivery?.crew_lng;
    if (lat == null || lng == null) return;
    const curr = { lat, lng };
    const prev = prevCrewRef.current;
    if (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) {
      setBearing(calcBearing(prev, curr));
    }
    prevCrewRef.current = curr;
  }, [currentDelivery?.crew_lat, currentDelivery?.crew_lng]);

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
          icon={makeCrewArrowIcon(bearing)}
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
