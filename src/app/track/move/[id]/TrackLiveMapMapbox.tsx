"use client";

import { useEffect, useMemo } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import Map from "react-map-gl/mapbox";
import { Marker, NavigationControl, Source, Layer, useMap } from "react-map-gl/mapbox";

type Center = { latitude: number; longitude: number };
type CenterLatLng = { lat: number; lng: number };
type Crew = { current_lat: number; current_lng: number; name?: string } | null;

const YUGO_GOLD = "#C9A962";

function FitBoundsController({
  crew,
  pickup,
  dropoff,
  center,
}: {
  crew: Crew;
  pickup: CenterLatLng | null;
  dropoff: CenterLatLng | null;
  center: Center;
}) {
  const { current: mapRef } = useMap();
  const hasCrew = crew != null;
  const hasDropoff = dropoff != null;
  const hasPickup = pickup != null;

  useEffect(() => {
    const map = mapRef?.getMap?.();
    if (!map) return;

    const points: [number, number][] = [];
    if (hasCrew && crew) {
      points.push([crew.current_lng, crew.current_lat]);
    }
    if (hasDropoff && dropoff) {
      points.push([dropoff.lng, dropoff.lat]);
    }
    if (hasPickup && pickup) {
      points.push([pickup.lng, pickup.lat]);
    }

    if (points.length === 0) {
      map.flyTo({ center: [center.longitude, center.latitude], zoom: 10, duration: 0 });
      return;
    }

    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    map.fitBounds([sw, ne], { padding: 80, maxZoom: 14, duration: 0 });
  }, [mapRef, crew?.current_lat, crew?.current_lng, dropoff?.lat, dropoff?.lng, pickup?.lat, pickup?.lng, hasCrew, hasDropoff, hasPickup, center.latitude, center.longitude]);

  return null;
}

/** Stages where crew is heading to pickup; otherwise heading to dropoff */
const PICKUP_STAGES = ["en_route_to_pickup", "arrived_at_pickup"];

export function TrackLiveMapMapbox({
  mapboxAccessToken,
  center,
  crew,
  crewName,
  pickup,
  dropoff,
  liveStage,
}: {
  mapboxAccessToken: string;
  center: Center;
  crew: Crew;
  crewName?: string;
  pickup?: CenterLatLng | null;
  dropoff?: CenterLatLng | null;
  /** Current stage: line is drawn from vehicle to the address they're heading to */
  liveStage?: string | null;
}) {
  const hasPosition = crew != null;

  /** Full journey line (pickup → dropoff), subtle */
  const fullRouteGeoJson = useMemo(() => {
    if (!pickup || !dropoff) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [pickup.lng, pickup.lat],
          [dropoff.lng, dropoff.lat],
        ],
      },
    };
  }, [pickup, dropoff]);

  /** Tracking line: vehicle → address they're going to right now (design inspiration: bold black line to destination) */
  const trackingLineGeoJson = useMemo(() => {
    if (!crew || !pickup || !dropoff) return null;
    const currentDestination = PICKUP_STAGES.includes(liveStage || "") ? pickup : dropoff;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [crew.current_lng, crew.current_lat],
          [currentDestination.lng, currentDestination.lat],
        ],
      },
    };
  }, [crew, pickup, dropoff, liveStage]);

  return (
    <Map
      mapboxAccessToken={mapboxAccessToken}
      initialViewState={{
        ...center,
        zoom: hasPosition ? 14 : 10,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      <FitBoundsController crew={crew} pickup={pickup ?? null} dropoff={dropoff ?? null} center={center} />
      {fullRouteGeoJson && (
        <Source id="route-full" type="geojson" data={fullRouteGeoJson}>
          <Layer
            id="route-full-layer"
            type="line"
            paint={{
              "line-color": YUGO_GOLD,
              "line-width": 2,
              "line-opacity": 0.4,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}
      {trackingLineGeoJson && (
        <Source id="route-tracking" type="geojson" data={trackingLineGeoJson}>
          <Layer
            id="route-tracking-layer"
            type="line"
            paint={{
              "line-color": "#8B5CF6",
              "line-width": 5,
              "line-opacity": 1,
            }}
          />
        </Source>
      )}
      {pickup && (
        <Marker longitude={pickup.lng} latitude={pickup.lat} anchor="center">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-[#C9A962]" />
        </Marker>
      )}
      {dropoff && (
        <Marker longitude={dropoff.lng} latitude={dropoff.lat} anchor="center">
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-[#22C55E]" />
        </Marker>
      )}
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
