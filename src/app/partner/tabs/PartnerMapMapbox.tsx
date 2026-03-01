"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";

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
        return (
          <Marker
            key={`crew-${d.id}`}
            longitude={d.crew_lng}
            latitude={d.crew_lat}
            anchor="center"
            onClick={() => onSelect(d)}
          >
            <div className="cursor-pointer" style={{ width: 40, height: 40 }}>
              <img src="/crew-car.png" alt="" width={40} height={40} className="block drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]" />
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
    </Map>
  );
}
