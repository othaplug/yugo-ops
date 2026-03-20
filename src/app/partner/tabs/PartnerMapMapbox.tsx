"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect } from "react";
import { MapPin } from "@phosphor-icons/react";
import Map, { Marker, Source, Layer, NavigationControl, useMap } from "react-map-gl/mapbox";

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
          <div className="cursor-pointer relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
            <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }} />
            <span className="absolute inset-[3px] rounded-full opacity-20 animate-pulse" style={{ background: "#C9A962" }} />
            <span
              className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)", boxShadow: "0 2px 10px rgba(201,169,98,0.45)" }}
            >
              {(currentDelivery.crew_name || "C").replace("Team ", "").charAt(0).toUpperCase()}
            </span>
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
