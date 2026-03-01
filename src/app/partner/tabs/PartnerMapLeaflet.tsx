"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";

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

const crewIcon = new L.Icon({
  iconUrl: "/crew-car.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const destIcon = new L.DivIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#22C55E;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function PartnerMapLeaflet({
  center,
  deliveries,
  onSelect,
}: {
  center: { latitude: number; longitude: number };
  deliveries: ActiveDelivery[];
  onSelect: (d: ActiveDelivery) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current && deliveries.length > 0) {
      const bounds = L.latLngBounds(
        deliveries
          .filter((d) => d.crew_lat != null)
          .flatMap((d) => {
            const pts: L.LatLngTuple[] = [[d.crew_lat!, d.crew_lng!]];
            if (d.dest_lat != null && d.dest_lng != null) pts.push([d.dest_lat, d.dest_lng]);
            return pts;
          })
      );
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [deliveries]);

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      ref={mapRef}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution=""
      />
      {deliveries.map((d) => {
        if (d.crew_lat == null || d.crew_lng == null) return null;
        return (
          <div key={d.id}>
            <Marker position={[d.crew_lat, d.crew_lng]} icon={crewIcon} eventHandlers={{ click: () => onSelect(d) }}>
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
    </MapContainer>
  );
}
