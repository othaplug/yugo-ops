"use client";

import "leaflet/dist/leaflet.css";
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
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

function FitBounds({ deliveries }: { deliveries: ActiveDelivery[] }) {
  const map = useMap();
  useEffect(() => {
    if (deliveries.length === 0) return;
    const pts = deliveries
      .filter((d) => d.crew_lat != null)
      .flatMap((d) => {
        const arr: L.LatLngTuple[] = [[d.crew_lat!, d.crew_lng!]];
        if (d.dest_lat != null && d.dest_lng != null) arr.push([d.dest_lat, d.dest_lng]);
        return arr;
      });
    if (pts.length > 0) {
      const bounds = L.latLngBounds(pts);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, deliveries]);
  return null;
}

export default function PartnerMapLeaflet({
  center,
  deliveries,
  onSelect,
}: {
  center: { latitude: number; longitude: number };
  deliveries: ActiveDelivery[];
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
      <FitBounds deliveries={deliveries} />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution=""
      />
      {deliveries.map((d) => {
        if (d.crew_lat == null || d.crew_lng == null) return null;
        return (
          <div key={d.id}>
            <Marker position={[d.crew_lat, d.crew_lng]} icon={makeCrewIcon(d.crew_name)} eventHandlers={{ click: () => onSelect(d) }}>
              <Popup>
                <strong>{d.customer_name || d.delivery_number}</strong>
                <br />
                {d.crew_name && <span>Crew: {d.crew_name}</span>}
              </Popup>
            </Marker>
            {d.dest_lat != null && d.dest_lng != null && (
              <>
                <Marker position={[d.dest_lat, d.dest_lng]} icon={destIcon} />
                <Polyline
                  positions={[[d.crew_lat, d.crew_lng], [d.dest_lat, d.dest_lng]]}
                  pathOptions={{ color: "#8B5CF6", weight: 4, opacity: 0.8 }}
                />
              </>
            )}
          </div>
        );
      })}
      <MyLocationButtonLeaflet />
    </MapContainer>
    </div>
  );
}
