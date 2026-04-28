"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackRoutePlanPoint } from "@/lib/track-delivery-public";
import { WINE } from "@/lib/client-theme";

const MAPBOX_TOKEN =
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN)) || "";
const USE_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

type Coord = { lat: number; lng: number };
type CrewPos = { current_lat: number; current_lng: number; name?: string } | null;

/** Yugo forest — crew / client map chrome (not tailwind green). */
const FOREST_MARKER = "#2C3E2D";

function calcBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function lastKnownIcon() {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;inset:0;border-radius:50%;background:#2C3E2D;opacity:0.16;animation:crew-ring 2.4s ease-out infinite"></span>
      <span style="position:absolute;inset:4px;border-radius:50%;background:#2C3E2D;opacity:0.28"></span>
      <span style="position:relative;width:16px;height:16px;border-radius:50%;background:#2C3E2D;border:3px solid #fff;box-shadow:0 2px 10px rgba(44,62,45,.45);display:flex;align-items:center;justify-content:center">
        <span style="color:#fff;font-size:7px;font-weight:800;line-height:8px;display:flex;align-items:center;justify-content:center;width:8px;height:8px" aria-hidden="true">✓</span>
      </span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const pickupIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:12px;height:12px;background:${WINE};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropoffIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:12px;height:12px;background:${FOREST_MARKER};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function planStopIcon(label: string) {
  const safe = label.replace(/[^0-9A-Za-z]/g, "").slice(0, 2) || "?";
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#2C3E2D;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800">${safe}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

/** Directional arrow marker for delivery crew — rotated to heading. */
function crewArrowIcon(bearing: number | null = null) {
  const rot = bearing != null ? bearing : 0;
  return L.divIcon({
    className: "crew-marker crew-marker-arrow",
    html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;inset:5px;border-radius:50%;background:${FOREST_MARKER};opacity:0.2;animation:crew-ring 2s ease-out infinite"></span>
      <svg width="36" height="36" viewBox="0 0 44 44" style="transform:rotate(${rot}deg);transition:transform 0.8s ease-out;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6))" aria-hidden="true">
        <polygon points="22,5 34,36 22,29 10,36" fill="${FOREST_MARKER}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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

function MapController({
  center,
  pickup,
  dropoff,
  crew,
  routePlan,
}: {
  center: Coord;
  pickup: Coord | null;
  dropoff: Coord | null;
  crew: CrewPos;
  routePlan: TrackRoutePlanPoint[] | null;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: Coord[] = [];
    if (crew) pts.push({ lat: crew.current_lat, lng: crew.current_lng });
    if (routePlan?.length) {
      routePlan.forEach((p) => pts.push({ lat: p.lat, lng: p.lng }));
    } else {
      if (pickup) pts.push(pickup);
      if (dropoff) pts.push(dropoff);
    }
    if (pts.length >= 2) {
      const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 14);
    } else {
      map.setView([center.lat, center.lng], 10);
    }
  }, [map, center, pickup, dropoff, crew, routePlan]);
  return null;
}

export default function DeliveryTrackMap({
  center,
  crew,
  pickup,
  dropoff,
  liveStage,
  lastKnownPos,
  routePlan = null,
}: {
  center: Coord;
  crew: CrewPos;
  pickup?: Coord | null;
  dropoff?: Coord | null;
  liveStage?: string | null;
  lastKnownPos?: Coord | null;
  /** Multi-stop: ordered geocoded stops with map labels (1, 2, …, D). */
  routePlan?: TrackRoutePlanPoint[] | null;
}) {
  const animCrew = useAnimatedCrewPos(crew);

  const [bearing, setBearing] = useState<number | null>(null);
  const prevCrewRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!crew) return;
    const curr = { lat: crew.current_lat, lng: crew.current_lng };
    const prev = prevCrewRef.current;
    if (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) {
      setBearing(calcBearing(prev, curr));
    }
    prevCrewRef.current = curr;
  }, [crew?.current_lat, crew?.current_lng]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const coordStr = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordStr}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
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

  const fetchDrivingRouteChain = useCallback(async (points: Coord[]) => {
    if (!MAPBOX_TOKEN || !USE_MAPBOX || points.length < 2) return;
    const key = `chain:${points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|")}`;
    if (lastFetchRef.current === key) return;
    lastFetchRef.current = key;
    try {
      const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
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

  const routePlanKey =
    routePlan?.map((p) => `${p.lat},${p.lng},${p.label}`).join("|") ?? "";

  const routeDepsKey = [
    crew?.current_lat,
    crew?.current_lng,
    trackingDestination?.lat,
    trackingDestination?.lng,
    pickup?.lat,
    pickup?.lng,
    dropoff?.lat,
    dropoff?.lng,
    routePlanKey,
  ]
    .map((n) => (n != null ? String(n) : ""))
    .join("|");

  useEffect(() => {
    const from = crew ?? animCrew;
    const planCoords =
      routePlan && routePlan.length >= 2
        ? routePlan.map((p) => ({ lat: p.lat, lng: p.lng }))
        : null;

    if (from && trackingDestination) {
      fetchDrivingRoute(
        { lat: from.current_lat, lng: from.current_lng },
        { lat: trackingDestination.lat, lng: trackingDestination.lng },
      );
      return;
    }
    if (planCoords && planCoords.length >= 2) {
      fetchDrivingRouteChain(planCoords);
      return;
    }
    if (!pickup || !dropoff) {
      lastFetchRef.current = "";
      setRouteLine(null);
      return;
    }
    fetchDrivingRoute(pickup, dropoff);
  }, [routeDepsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const chainStraight: [number, number][] = useMemo(() => {
    if (!routePlan?.length || routePlan.length < 2) return [];
    return routePlan.map((p) => [p.lat, p.lng] as [number, number]);
  }, [routePlan]);

  const trackingLineStraight: [number, number][] = useMemo(() => {
    if (animCrew && trackingDestination)
      return [[animCrew.current_lat, animCrew.current_lng], [trackingDestination.lat, trackingDestination.lng]];
    if (pickup && dropoff)
      return [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
    return [];
  }, [animCrew, trackingDestination, pickup, dropoff]);

  const purpleLinePositions =
    routeLine && routeLine.length >= 2
      ? routeLine
      : chainStraight.length >= 2
        ? chainStraight
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
      <MapController
        center={center}
        pickup={pickup ?? null}
        dropoff={dropoff ?? null}
        crew={crew}
        routePlan={routePlan ?? null}
      />
      {USE_MAPBOX ? (
        <TileLayer
          url={`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
          tileSize={512}
          zoomOffset={-1}
          attribution=""
        />
      ) : (
        <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      )}
      {purpleLinePositions.length >= 2 && (
        <Polyline positions={purpleLinePositions} color="#2C3E2D" weight={4} opacity={0.9} lineCap="round" lineJoin="round" />
      )}
      {routePlan?.length ? (
        routePlan.map((p, i) => (
          <Marker key={`${p.lat}-${p.lng}-${i}`} position={[p.lat, p.lng]} icon={planStopIcon(p.label)}>
            <Popup>{p.kind === "delivery" ? "Final delivery" : `Pickup ${p.label}`}</Popup>
          </Marker>
        ))
      ) : (
        <>
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
        </>
      )}
      {animCrew && (
        <Marker position={[animCrew.current_lat, animCrew.current_lng]} icon={crewArrowIcon(bearing)}>
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
