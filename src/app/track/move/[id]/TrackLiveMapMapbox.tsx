"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Map from "react-map-gl/mapbox";
import { Marker, NavigationControl } from "react-map-gl/mapbox";

type Center = { latitude: number; longitude: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

export function TrackLiveMapMapbox({
  mapboxAccessToken,
  center,
  crew,
  crewName,
}: {
  mapboxAccessToken: string;
  center: Center;
  crew: Crew;
  crewName?: string;
}) {
  const hasPosition = crew != null;

  return (
    <Map
      mapboxAccessToken={mapboxAccessToken}
      initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
    >
      {hasPosition && crew && (
        <Marker longitude={crew.current_lng} latitude={crew.current_lat} anchor="center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-bold text-white shadow-lg border-2 border-white"
            style={{
              background: "linear-gradient(135deg, #C9A962, #8B7332)",
            }}
          >
            {(crewName || crew?.name || "?").replace("Team ", "").slice(0, 1).toUpperCase()}
          </div>
        </Marker>
      )}
      <NavigationControl position="bottom-right" showCompass showZoom />
    </Map>
  );
}
