"use client";

import "mapbox-gl/dist/mapbox-gl.css";
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
      className="absolute bottom-14 right-4 z-10 p-2.5 bg-white rounded-lg shadow-md border border-[#E8E4DF] hover:bg-[#F5F3F0] transition-colors"
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

export default function PartnerMapMapbox({
  token,
  center,
  deliveries,
  onSelect,
}: {
  token: string;
  center: { latitude: number; longitude: number };
  deliveries: ActiveDelivery[];
  onSelect: (d: ActiveDelivery) => void;
}) {
  const routeFeatures = deliveries
    .filter((d) => d.crew_lat != null && d.dest_lat != null && d.dest_lng != null)
    .map((d) => ({
      type: "Feature" as const,
      properties: { id: d.id },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [d.crew_lng!, d.crew_lat!],
          [d.dest_lng!, d.dest_lat!],
        ],
      },
    }));

  const routeGeoJson = {
    type: "FeatureCollection" as const,
    features: routeFeatures,
  };

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{ ...center, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {routeFeatures.length > 0 && (
        <Source id="partner-routes" type="geojson" data={routeGeoJson}>
          <Layer
            id="partner-routes-layer"
            type="line"
            paint={{
              "line-color": "#8B5CF6",
              "line-width": 4,
              "line-opacity": 0.8,
            }}
          />
        </Source>
      )}

      {deliveries.map((d) => {
        if (d.crew_lat == null || d.crew_lng == null) return null;
        const initial = (d.crew_name || "C").replace("Team ", "").charAt(0).toUpperCase();
        return (
          <Marker
            key={`crew-${d.id}`}
            longitude={d.crew_lng}
            latitude={d.crew_lat}
            anchor="center"
            onClick={() => onSelect(d)}
          >
            <div className="cursor-pointer relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }} />
              <span className="absolute inset-[3px] rounded-full opacity-20 animate-pulse" style={{ background: "#C9A962" }} />
              <span
                className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-body font-bold text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)", boxShadow: "0 2px 10px rgba(201,169,98,0.45)" }}
              >
                {initial}
              </span>
            </div>
          </Marker>
        );
      })}

      {deliveries.map((d) => {
        if (d.dest_lat == null || d.dest_lng == null) return null;
        return (
          <Marker key={`dest-${d.id}`} longitude={d.dest_lng} latitude={d.dest_lat} anchor="center">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md bg-[#22C55E]" />
          </Marker>
        );
      })}

      <NavigationControl position="bottom-right" showCompass showZoom />
      <MyLocationButton />
    </Map>
  );
}
