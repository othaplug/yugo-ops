"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAPBOX_TOKEN =
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN)) || "";
const USE_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

type Coord = { lat: number; lng: number };
type CrewPos = { current_lat: number; current_lng: number; name?: string } | null;

const GOLD = "#C9A94E";
const GREEN = "#22C55E";

function lastKnownIcon() {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;inset:0;border-radius:50%;background:#22C55E;opacity:0.18;animation:crew-ring 2.4s ease-out infinite"></span>
      <span style="position:absolute;inset:4px;border-radius:50%;background:#22C55E;opacity:0.3"></span>
      <span style="position:relative;width:16px;height:16px;border-radius:50%;background:#22C55E;border:3px solid #fff;box-shadow:0 2px 10px rgba(34,197,94,.5);display:flex;align-items:center;justify-content:center">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:12px;height:12px;background:${GOLD};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:12px;height:12px;background:${GREEN};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Elegant animated crew marker: dot + expanding ring (no truck icon). */
function crewIcon() {
  return L.divIcon({
    className: "crew-marker crew-marker-elegant",
    html: `<div class="crew-marker-inner" style="position:relative;width:20px;height:20px">
      <span style="position:absolute;inset:0;border-radius:50%;background:${GOLD};box-shadow:0 2px 8px rgba(0,0,0,.25);animation:crew-dot-glow 2s ease-in-out infinite"></span>
      <span style="position:absolute;inset:-4px;border:2px solid ${GOLD};border-radius:50%;opacity:0.4;animation:crew-ring 2s ease-out infinite"></span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function useAnimatedCrewPos(target: CrewPos, ms = 2000): CrewPos {
  const [pos, setPos] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!target) { setPos(null); prevRef.current = null; return; }
    const prev = prevRef.current;
    prevRef.current = target;
    if (!prev) { setPos(target); return; }
    if (prev.current_lat === target.current_lat && prev.current_lng === target.current_lng) { setPos(target); return; }

    const sLat = prev.current_lat, sLng = prev.current_lng;
    const dLat = target.current_lat - sLat, dLng = target.current_lng - sLng;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - t0) / ms, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setPos({ current_lat: sLat + dLat * e, current_lng: sLng + dLng * e, name: target.name });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target?.current_lat, target?.current_lng, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}

function MapController({ center, pickup, dropoff, crew }: { center: Coord; pickup: Coord | null; dropoff: Coord | null; crew: CrewPos }) {
  const map = useMap();
  useEffect(() => {
    const pts: Coord[] = [];
    if (crew) pts.push({ lat: crew.current_lat, lng: crew.current_lng });
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    if (pts.length >= 2) {
      const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 14);
    } else {
      map.setView([center.lat, center.lng], 10);
    }
  }, [map, center, pickup, dropoff, crew]);
  return null;
}

export default function DeliveryTrackMap({
  center,
  crew,
  pickup,
  dropoff,
  liveStage,
  lastKnownPos,
}: {
  center: Coord;
  crew: CrewPos;
  pickup?: Coord | null;
  dropoff?: Coord | null;
  liveStage?: string | null;
  lastKnownPos?: Coord | null;
}) {
  const animCrew = useAnimatedCrewPos(crew);

  const PICKUP_STAGES = ["en_route_to_pickup", "arrived_at_pickup", "en_route", "on_route", "arrived", "arrived_on_site"];
  const isPrePickup = PICKUP_STAGES.includes(liveStage || "") || !(liveStage ?? "").trim();
  const trackingDestination = isPrePickup && pickup ? pickup : dropoff;

  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const lastFetchRef = useRef<string>("");

  const fetchDrivingRoute = useCallback(async (from: Coord, to: Coord) => {
    if (!MAPBOX_TOKEN || !USE_MAPBOX) return;
    const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}-${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    if (lastFetchRef.current === key) return;
    lastFetchRef.current = key;
    try {
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const coordsList = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      if (Array.isArray(coordsList) && coordsList.length >= 2) {
        setRouteLine(coordsList.map(([lng, lat]) => [lat, lng] as [number, number]));
      } else {
        setRouteLine(null);
      }
    } catch {
      setRouteLine(null);
    }
  }, []);

  // Single primitive key so useEffect dependency array size never changes
  const routeDepsKey = [
    crew?.current_lat,
    crew?.current_lng,
    trackingDestination?.lat,
    trackingDestination?.lng,
    pickup?.lat,
    pickup?.lng,
    dropoff?.lat,
    dropoff?.lng,
  ]
    .map((n) => (n != null ? String(n) : ""))
    .join("|");

  useEffect(() => {
    const from = crew ?? animCrew;
    if (from && trackingDestination) {
      fetchDrivingRoute(
        { lat: from.current_lat, lng: from.current_lng },
        { lat: trackingDestination.lat, lng: trackingDestination.lng }
      );
      return;
    }
    if (!pickup || !dropoff) {
      lastFetchRef.current = "";
      setRouteLine(null);
      return;
    }
    // No crew position yet: show planned route pickup → dropoff so user sees where crew is going
    fetchDrivingRoute(pickup, dropoff);
  }, [routeDepsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const trackingLineStraight: [number, number][] = useMemo(() => {
    if (animCrew && trackingDestination)
      return [[animCrew.current_lat, animCrew.current_lng], [trackingDestination.lat, trackingDestination.lng]];
    if (pickup && dropoff)
      return [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
    return [];
  }, [animCrew, trackingDestination, pickup, dropoff]);

  const purpleLinePositions =
    (routeLine && routeLine.length >= 2)
      ? routeLine
      : trackingLineStraight.length >= 2
        ? trackingLineStraight
        : [];

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={crew ? 14 : 10}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      className="track-live-map"
    >
      <MapController center={center} pickup={pickup ?? null} dropoff={dropoff ?? null} crew={crew} />
      {USE_MAPBOX ? (
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution=""
        />
      ) : (
        <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      )}
      {purpleLinePositions.length >= 2 && (
        <Polyline positions={purpleLinePositions} color="#8B5CF6" weight={4} opacity={0.9} lineCap="round" lineJoin="round" />
      )}
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup>Pickup</Popup>
        </Marker>
      )}
      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>Destination</Popup>
        </Marker>
      )}
      {animCrew && (
        <Marker position={[animCrew.current_lat, animCrew.current_lng]} icon={crewIcon()}>
          <Popup>{animCrew.name || "Crew"}</Popup>
        </Marker>
      )}
      {lastKnownPos && (
        <Marker position={[lastKnownPos.lat, lastKnownPos.lng]} icon={lastKnownIcon()}>
          <Popup>Job completed here</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
