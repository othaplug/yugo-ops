"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useRef } from "react";
import { MapPin } from "@phosphor-icons/react";
import Map, { Marker, Source, Layer, NavigationControl, useMap } from "react-map-gl/mapbox";

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

function MyLocationButton() {
  const { current: mapRef } = useMap();
  const handleClick = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef?.getMap?.();
        if (map) map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 800 });
      },
      () => {}
    );
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="absolute bottom-36 right-3 z-10 p-2.5 bg-white rounded-lg shadow-md border border-[#E8E4DF] hover:bg-[#F5F3F0] transition-colors"
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

export default function PartnerMapMapbox({
  token,
  center,
  currentDelivery,
  onSelect,
}: {
  token: string;
  center: { latitude: number; longitude: number };
  currentDelivery: ActiveDelivery | null;
  onSelect: (d: ActiveDelivery) => void;
}) {
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);

  // Track bearing from consecutive GPS positions
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

  useEffect(() => {
    if (!currentDelivery?.crew_lat || !currentDelivery?.crew_lng) {
      setRouteCoords(null);
      return;
    }
    let cancelled = false;
    const d = currentDelivery;
    let destLat = d.dest_lat;
    let destLng = d.dest_lng;

    const applyRoute = (coords: [number, number][]) => {
      if (!cancelled) setRouteCoords(coords);
    };

    const doFetchRoute = (toLng: number, toLat: number) => {
      const from = `${d.crew_lng},${d.crew_lat}`;
      const to = `${toLng},${toLat}`;
      fetch(`/api/mapbox/directions?from=${from}&to=${to}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data?.coordinates) && data.coordinates.length >= 2) {
            applyRoute(data.coordinates);
          } else {
            applyRoute([[d.crew_lng!, d.crew_lat!], [toLng, toLat]]);
          }
        })
        .catch(() => applyRoute([[d.crew_lng!, d.crew_lat!], [toLng, toLat]]));
    };

    if ((destLat == null || destLng == null) && d.delivery_address) {
      fetch(`/api/mapbox/geocode?q=${encodeURIComponent(d.delivery_address)}&limit=1`)
        .then((res) => res.json())
        .then((data) => {
          const coords = data?.features?.[0]?.geometry?.coordinates;
          if (coords && !cancelled) doFetchRoute(coords[0], coords[1]);
        })
        .catch(() => {
          if (!cancelled) setRouteCoords(null);
        });
      return () => {
        cancelled = true;
      };
    }
    if (destLat == null || destLng == null) {
      setRouteCoords(null);
      return;
    }
    doFetchRoute(destLng, destLat);
    return () => {
      cancelled = true;
    };
  }, [currentDelivery?.id, currentDelivery?.crew_lat, currentDelivery?.crew_lng, currentDelivery?.dest_lat, currentDelivery?.dest_lng, currentDelivery?.delivery_address]);

  const routeGeoJson =
    routeCoords && routeCoords.length >= 2
      ? {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: routeCoords },
        }
      : null;

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{ ...center, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {routeGeoJson && (
        <Source id="partner-route" type="geojson" data={routeGeoJson}>
          <Layer
            id="partner-route-layer"
            type="line"
            paint={{
              "line-color": "#8B5CF6",
              "line-width": 4,
              "line-opacity": 0.8,
            }}
          />
        </Source>
      )}

      {currentDelivery?.crew_lat != null && currentDelivery?.crew_lng != null && (
        <Marker
          key="crew"
          longitude={currentDelivery.crew_lng}
          latitude={currentDelivery.crew_lat}
          anchor="center"
          onClick={() => onSelect(currentDelivery)}
        >
          <div
            className="cursor-pointer relative flex items-center justify-center"
            style={{ width: 44, height: 44 }}
            title={currentDelivery.crew_name || "Crew"}
          >
            {/* Pulse ring */}
            <span
              className="absolute rounded-full animate-ping"
              style={{ inset: 5, background: YUGO_GOLD, opacity: 0.22, animationDuration: "2s" }}
            />
            {/* Directional arrow */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 44 44"
              style={{
                transform: bearing != null ? `rotate(${bearing}deg)` : "none",
                transition: "transform 0.8s ease-out",
                filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.35))",
              }}
              aria-hidden
            >
              <polygon
                points="22,5 34,36 22,29 10,36"
                fill={YUGO_GOLD}
                stroke="white"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Marker>
      )}

      {currentDelivery?.dest_lat != null && currentDelivery?.dest_lng != null && (
        <Marker
          key="dest"
          longitude={currentDelivery.dest_lng}
          latitude={currentDelivery.dest_lat}
          anchor="center"
        >
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md bg-[#22C55E]" />
        </Marker>
      )}

      <NavigationControl position="bottom-right" showCompass showZoom />
      <MyLocationButton />
    </Map>
  );
}
