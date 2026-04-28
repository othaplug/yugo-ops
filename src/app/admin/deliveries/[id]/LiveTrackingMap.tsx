"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { useTheme } from "@/app/admin/components/ThemeContext";
import { toTitleCase } from "@/lib/format-text";
import { CornersIn, CornersOut } from "@phosphor-icons/react";
import { TrackingFreshness } from "@/components/tracking/TrackingFreshness";

const LiveTrackingMapLeaflet = dynamic(
  () =>
    import("./LiveTrackingMapLeaflet").then(
      (mod) => mod.LiveTrackingMapLeaflet,
    ),
  { ssr: false },
);

/** GeoJSON LineString feature for the driving route */
type RouteGeoJson = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
} | null;

function calcBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const MapboxMap = dynamic(
  () =>
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;
      const Source = mod.Source;
      const Layer = mod.Layer;
      return function MapWithControls({
        center,
        hasPosition,
        crew,
        crewName,
        crewBearing,
        token,
        mapStyle,
        pickup,
        dropoff,
        routeLineColor,
        routeGeoJson,
        markerEtaLine,
        markerEtaLightChrome,
      }: {
        center: { longitude: number; latitude: number };
        hasPosition: boolean;
        crew: {
          current_lat: number;
          current_lng: number;
          name?: string;
        } | null;
        crewName?: string;
        crewBearing: number | null;
        token: string;
        mapStyle: string;
        pickup?: { lat: number; lng: number };
        dropoff?: { lat: number; lng: number };
        routeLineColor?: string;
        routeGeoJson?: RouteGeoJson;
        /** ETA + distance chip above crew arrow (admin dispatch) */
        markerEtaLine?: string | null;
        markerEtaLightChrome?: boolean;
      }) {
        const lineGeoJson = routeGeoJson ?? null;
        const etaPillBg = markerEtaLightChrome ? "#2C3E2D" : "rgba(8,10,16,0.92)";
        const etaPillColor = markerEtaLightChrome ? "#F9EDE4" : "rgba(255,255,255,0.92)";
        const etaPillBorder = markerEtaLightChrome
          ? "1px solid rgba(44,62,45,0.35)"
          : "1px solid rgba(255,255,255,0.12)";

        return (
          <M
            mapboxAccessToken={token}
            initialViewState={{ ...center, zoom: hasPosition ? 14 : 10 }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={mapStyle}
          >
            {lineGeoJson && (
              <Source id="route-tracking" type="geojson" data={lineGeoJson}>
                <Layer
                  id="route-tracking-layer"
                  type="line"
                  paint={{
                    "line-color": routeLineColor ?? "#2C3E2D",
                    "line-width": 7,
                    "line-opacity": 0.92,
                  }}
                />
              </Source>
            )}
            {pickup && (
              <Marker
                longitude={pickup.lng}
                latitude={pickup.lat}
                anchor="center"
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-[#22C55E]"
                  title="Pickup"
                />
              </Marker>
            )}
            {dropoff && (
              <Marker
                longitude={dropoff.lng}
                latitude={dropoff.lat}
                anchor="center"
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-[#2C3E2D]"
                  title="Drop-off"
                />
              </Marker>
            )}
            {hasPosition && crew && (
              <Marker
                longitude={crew.current_lng}
                latitude={crew.current_lat}
                anchor="center"
              >
                <div
                  className="relative flex flex-col items-center justify-end pointer-events-none"
                  style={{ width: 44, minHeight: 40 }}
                  title={crewName || crew.name || "Crew"}
                >
                  {markerEtaLine ? (
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md max-w-[min(200px,70vw)] text-center shadow-md"
                      style={{
                        background: etaPillBg,
                        color: etaPillColor,
                        border: etaPillBorder,
                        fontFamily: "var(--font-body)",
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {markerEtaLine}
                    </div>
                  ) : null}
                  <div
                    className="relative flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40 }}
                  >
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 44 44"
                      style={{
                        transform:
                          crewBearing != null
                            ? `rotate(${crewBearing}deg)`
                            : "none",
                        transition: "transform 0.8s ease-out",
                        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
                      }}
                      aria-hidden
                    >
                      <polygon
                        points="22,5 34,36 22,29 10,36"
                        fill={routeLineColor ?? "#2C3E2D"}
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </Marker>
            )}
            <Nav position="bottom-right" showCompass showZoom />
          </M>
        );
      };
    }),
  { ssr: false },
);

const DEFAULT_CENTER = { longitude: -79.385, latitude: 43.665 };
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

interface Crew {
  id: string;
  name: string;
  current_lat: number | null;
  current_lng: number | null;
  updated_at?: string | null;
}

/** Stages where crew is heading to pickup (or at pickup); otherwise route shows to dropoff.
 * Includes legacy/variant statuses from crew app and tracking_sessions. */
const PICKUP_STAGES = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route",
  "on_route",
  "arrived",
  "arrived_on_site",
];

function formatAdminNavEta(sec: number | null, distM: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const m = Math.max(1, Math.round(sec / 60));
  const eta = m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  if (distM != null && Number.isFinite(distM) && distM >= 0) {
    const d = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`;
    return `${eta} · ${d} remaining`;
  }
  return `${eta} ETA`;
}

/** Prefer live nav from crew app; fall back to Mapbox route duration/distance. */
function resolveAdminEtaDisplay(
  liveStage: string | null,
  navSec: number | null,
  navDistM: number | null,
  dirSec: number | null,
  dirDistM: number | null,
): string | null {
  if (liveStage === "completed") return null;
  if (navSec != null && Number.isFinite(navSec) && navSec >= 0) {
    return formatAdminNavEta(navSec, navDistM);
  }
  return formatAdminNavEta(dirSec, dirDistM);
}

function TrackingStatusOverlay({
  liveStage,
  sessionActive,
  displayEtaLine,
}: {
  liveStage: string | null;
  sessionActive: boolean;
  displayEtaLine: string | null;
}) {
  const hasCard =
    Boolean(liveStage) || (sessionActive && Boolean(displayEtaLine));
  if (!hasCard) return null;

  return (
    <div className="absolute top-3 left-3 z-10 rounded-lg border border-[var(--brd)] bg-[var(--card)] px-4 py-3 shadow-md flex items-start gap-3 max-w-[min(280px,calc(100%-24px))]">
      <span className="relative flex h-3 w-3 shrink-0 mt-0.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
      </span>
      <div className="min-w-0 flex-1">
        {liveStage ? (
          <>
            <div className="text-[13px] font-bold text-[var(--tx)]">
              {CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)}
            </div>
            <div className="text-[11px] text-[var(--tx3)]">
              {liveStage === "loading"
                ? "Crew is loading items"
                : liveStage === "unloading"
                  ? "Crew is unloading items"
                  : liveStage === "completed"
                    ? "Move is complete"
                    : liveStage === "scheduled"
                      ? "Crew hasn't departed yet"
                      : "Crew is on the way"}
            </div>
          </>
        ) : null}
        {sessionActive && displayEtaLine ? (
          <div
            className={`text-[11px] font-semibold text-[var(--tx)] ${liveStage ? "mt-1.5 pt-1.5 border-t border-[var(--brd)]/40" : ""}`}
          >
            {displayEtaLine}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LiveTrackingMap({
  crewId,
  crewName,
  destination,
  pickup,
  dropoff,
  moveId,
  deliveryId,
  hideHeader,
}: {
  crewId: string;
  crewName?: string;
  destination?: { lat: number; lng: number };
  /** Delivery: pickup coords (route shows crew → pickup when en route to pick up) */
  pickup?: { lat: number; lng: number };
  /** Delivery: dropoff coords (route shows crew → dropoff when en route to destination) */
  dropoff?: { lat: number; lng: number };
  moveId?: string;
  /** Delivery ID: checks for an active tracking session before showing GPS */
  deliveryId?: string;
  /** When the map is inside a CollapsibleSection that already shows title/crew name, hide the internal card header */
  hideHeader?: boolean;
}) {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(
    null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [routeGeoJson, setRouteGeoJson] = useState<RouteGeoJson>(null);
  const [routePositions, setRoutePositions] = useState<[number, number][]>([]);
  const [resolvedPickup, setResolvedPickup] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [resolvedDropoff, setResolvedDropoff] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [crewBearing, setCrewBearing] = useState<number | null>(null);
  const [navEtaSeconds, setNavEtaSeconds] = useState<number | null>(null);
  const [navDistanceRemainingM, setNavDistanceRemainingM] = useState<number | null>(null);
  const [directionsEtaSeconds, setDirectionsEtaSeconds] = useState<number | null>(
    null,
  );
  const [directionsDistanceM, setDirectionsDistanceM] = useState<number | null>(
    null,
  );
  const [crewGpsHeading, setCrewGpsHeading] = useState<number | null>(null);
  const prevCrewPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const supabase = createClient();
  const { theme } = useTheme();
  const mapStyle =
    theme === "light"
      ? "mapbox://styles/mapbox/light-v11"
      : "mapbox://styles/mapbox/dark-v11";
  const routeLineColor = "#2C3E2D";

  // When deliveryId is set and parent didn't pass coords, fetch delivery and geocode so we can draw the route
  useEffect(() => {
    if (!deliveryId || (pickup && dropoff)) return;
    let cancelled = false;
    supabase
      .from("deliveries")
      .select(
        "pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng",
      )
      .eq("id", deliveryId)
      .single()
      .then(({ data: d }) => {
        if (cancelled || !d) return;
        if (!pickup) {
          if (d.pickup_lat != null && d.pickup_lng != null)
            setResolvedPickup({
              lat: Number(d.pickup_lat),
              lng: Number(d.pickup_lng),
            });
          else if (d.pickup_address?.trim())
            fetch(
              `/api/mapbox/geocode?q=${encodeURIComponent(d.pickup_address.trim())}&limit=1`,
              { credentials: "include" },
            )
              .then((r) => r.json())
              .then((data) => {
                if (cancelled) return;
                const c = data?.features?.[0]?.geometry?.coordinates;
                if (Array.isArray(c) && c.length >= 2)
                  setResolvedPickup({ lng: c[0], lat: c[1] });
              });
        }
        if (!dropoff) {
          if (d.delivery_lat != null && d.delivery_lng != null)
            setResolvedDropoff({
              lat: Number(d.delivery_lat),
              lng: Number(d.delivery_lng),
            });
          else if (d.delivery_address?.trim())
            fetch(
              `/api/mapbox/geocode?q=${encodeURIComponent(d.delivery_address.trim())}&limit=1`,
              { credentials: "include" },
            )
              .then((r) => r.json())
              .then((data) => {
                if (cancelled) return;
                const c = data?.features?.[0]?.geometry?.coordinates;
                if (Array.isArray(c) && c.length >= 2)
                  setResolvedDropoff({ lng: c[0], lat: c[1] });
              });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryId, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  const effectivePickup = pickup ?? resolvedPickup;
  const effectiveDropoff = dropoff ?? resolvedDropoff;

  // Current destination: for delivery/move use stage to pick pickup vs dropoff; else use single destination.
  /** Unknown stage → assume en route to destination (not pickup) so the route line shows the forward leg. */
  const headingToPickup = liveStage ? PICKUP_STAGES.includes(liveStage) : false;
  const effectiveDestination =
    (deliveryId || moveId) && (effectivePickup || effectiveDropoff)
      ? headingToPickup
        ? (effectivePickup ?? effectiveDropoff)
        : (effectiveDropoff ?? effectivePickup)
      : destination;

  // Initial fetch + realtime subscription for crew position
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("crews")
        .select("id, name, current_lat, current_lng, updated_at")
        .eq("id", crewId)
        .single();

      if (!error && data) setCrew(data);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`crew-${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crews",
          filter: `id=eq.${crewId}`,
        },
        (payload) => {
          const row = payload.new as Crew;
          if (row) setCrew(row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewId, supabase]);

  // Fresher GPS + heading from crew_locations (same source as unified tracking)
  useEffect(() => {
    const channel = supabase
      .channel(`admin-live-crew-loc-${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crew_locations",
          filter: `crew_id=eq.${crewId}`,
        },
        (payload) => {
          const row = payload.new as {
            lat?: unknown;
            lng?: unknown;
            heading?: unknown;
            updated_at?: string | null;
          };
          if (!row || row.lat == null || row.lng == null) return;
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setCrew((prev) => {
            if (!prev || prev.id !== crewId) return prev;
            return {
              ...prev,
              current_lat: lat,
              current_lng: lng,
              updated_at: row.updated_at ?? prev.updated_at,
            };
          });
          if (row.heading != null && Number.isFinite(Number(row.heading))) {
            setCrewGpsHeading(Number(row.heading));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewId, supabase]);

  useEffect(() => {
    if (!crew || crew.current_lat == null || crew.current_lng == null) {
      prevCrewPosRef.current = null;
      return;
    }
    const curr = { lat: crew.current_lat, lng: crew.current_lng };
    const prev = prevCrewPosRef.current;
    if (prev && (prev.lat !== curr.lat || prev.lng !== curr.lng)) {
      setCrewBearing(calcBearing(prev, curr));
    }
    prevCrewPosRef.current = curr;
  }, [crew?.current_lat, crew?.current_lng]);

  const arrowBearing = crewGpsHeading ?? crewBearing;

  // Fetch and subscribe to live stage when moveId OR deliveryId provided
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const subscribedSessionIdRef = useRef<string | null>(null);
  const jobId = moveId || deliveryId;
  const jobApiPath = moveId
    ? `/api/admin/moves/${moveId}/crew-status`
    : deliveryId
      ? `/api/admin/deliveries/${deliveryId}/crew-status`
      : null;

  useEffect(() => {
    if (!jobApiPath) return;

    const subscribeIfNeeded = (sessionId: string) => {
      if (!sessionId || subscribedSessionIdRef.current === sessionId) return;
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      subscribedSessionIdRef.current = sessionId;
      const ch = supabase
        .channel(`tracking-session-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tracking_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as { status?: string; is_active?: boolean };
            if (row?.status) setLiveStage(row.status);
            if (row?.is_active != null) setHasActiveSession(row.is_active);
          },
        )
        .subscribe();
      sessionChannelRef.current = ch;
    };

    const load = async () => {
      try {
        const res = await fetch(jobApiPath);
        const data = await res.json();
        if (data?.liveStage != null) setLiveStage(data.liveStage);
        if (data?.sessionId) subscribeIfNeeded(data.sessionId);
        setHasActiveSession(!!data?.hasActiveTracking);
        if (data?.navEtaSeconds != null && Number.isFinite(Number(data.navEtaSeconds))) {
          setNavEtaSeconds(Math.round(Number(data.navEtaSeconds)));
        } else {
          setNavEtaSeconds(null);
        }
        if (
          data?.navDistanceRemainingM != null &&
          Number.isFinite(Number(data.navDistanceRemainingM))
        ) {
          setNavDistanceRemainingM(Math.round(Number(data.navDistanceRemainingM)));
        } else {
          setNavDistanceRemainingM(null);
        }
      } catch {
        // ignore
      }
    };

    load();
    const pollId = setInterval(load, 8000);

    return () => {
      clearInterval(pollId);
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      subscribedSessionIdRef.current = null;
    };
  }, [jobId, jobApiPath]);

  const hasPosition = crew?.current_lat != null && crew?.current_lng != null;
  const center = hasPosition
    ? { longitude: crew!.current_lng!, latitude: crew!.current_lat! }
    : DEFAULT_CENTER;

  // Fetch driving route: use client-side Mapbox when token available so route always fetches
  useEffect(() => {
    if (!hasPosition || !crew || !effectiveDestination) {
      setRouteGeoJson(null);
      setRoutePositions([]);
      setDirectionsEtaSeconds(null);
      setDirectionsDistanceM(null);
      return;
    }
    const from = `${crew.current_lng},${crew.current_lat}`;
    const to = `${effectiveDestination.lng},${effectiveDestination.lat}`;
    const url = MAPBOX_TOKEN
      ? `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from};${to}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
      : `/api/mapbox/directions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    fetch(url, MAPBOX_TOKEN ? undefined : { credentials: "include" })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        const coordsList =
          data?.coordinates ?? data?.routes?.[0]?.geometry?.coordinates;
        const route0 = data?.routes?.[0];
        const durRaw =
          data?.duration != null
            ? Number(data.duration)
            : route0?.duration != null
              ? Number(route0.duration)
              : NaN;
        const distRaw =
          data?.distance != null
            ? Number(data.distance)
            : route0?.distance != null
              ? Number(route0.distance)
              : NaN;
        const dur =
          Number.isFinite(durRaw) && durRaw >= 0 ? durRaw : null;
        const distM =
          Number.isFinite(distRaw) && distRaw >= 0 ? distRaw : null;
        if (Array.isArray(coordsList) && coordsList.length > 0) {
          setRouteGeoJson({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coordsList },
          });
          setRoutePositions(
            coordsList.map((c: [number, number]) => [c[1], c[0]]),
          );
          setDirectionsEtaSeconds(dur);
          setDirectionsDistanceM(distM);
        } else {
          setRouteGeoJson(null);
          setRoutePositions([]);
          setDirectionsEtaSeconds(null);
          setDirectionsDistanceM(null);
        }
      })
      .catch(() => {
        setRouteGeoJson(null);
        setRoutePositions([]);
        setDirectionsEtaSeconds(null);
        setDirectionsDistanceM(null);
      });
  }, [
    hasPosition,
    crew?.current_lat,
    crew?.current_lng,
    effectiveDestination?.lat,
    effectiveDestination?.lng,
  ]);

  // When directions API fails, show straight line so route is always visible
  const fallbackRouteGeoJson = useMemo((): RouteGeoJson => {
    if (routeGeoJson || !hasPosition || !crew || !effectiveDestination)
      return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [crew.current_lng!, crew.current_lat!],
          [effectiveDestination.lng, effectiveDestination.lat],
        ],
      },
    };
  }, [
    routeGeoJson,
    hasPosition,
    crew?.current_lat,
    crew?.current_lng,
    effectiveDestination?.lat,
    effectiveDestination?.lng,
  ]);

  const isDeliveryMode = !!deliveryId;
  const sessionActive = hasActiveSession === true;
  const gpsLive = hasPosition && sessionActive;
  const displayEtaLine = useMemo(
    () =>
      resolveAdminEtaDisplay(
        liveStage,
        navEtaSeconds,
        navDistanceRemainingM,
        directionsEtaSeconds,
        directionsDistanceM,
      ),
    [
      liveStage,
      navEtaSeconds,
      navDistanceRemainingM,
      directionsEtaSeconds,
      directionsDistanceM,
    ],
  );
  const showMarkerEta =
    Boolean(displayEtaLine) &&
    sessionActive &&
    hasPosition &&
    liveStage !== "completed";

  if (isDeliveryMode && !sessionActive && !loading) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-[12px] font-medium text-[var(--tx2)]">
          Crew assigned, waiting to start
        </p>
        <p className="text-[10px] text-[var(--tx3)] mt-1">
          Live tracking will activate when {crewName || "the crew"} starts this
          job and their GPS goes live
        </p>
      </div>
    );
  }

  if (!HAS_MAPBOX) {
    return (
      <div className={hideHeader ? undefined : "space-y-3"}>
        {!hideHeader && (
          <>
            <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">
              Live Crew Tracking
            </h3>
            <p className="text-[11px] text-[var(--tx3)]">
              {crewName || crew?.name || "Crew"} •{" "}
              {hasPosition ? "Live position updating" : "Waiting for GPS..."}
              {crew?.updated_at ? (
                <span className="block mt-1 text-[10px]">
                  <TrackingFreshness
                    crewOnJob={sessionActive}
                    lastUpdate={crew.updated_at}
                  />
                </span>
              ) : null}
            </p>
          </>
        )}
        <div
          className={`relative w-full rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--bg)] ${isFullscreen ? "map-fullscreen" : ""}`}
          style={isFullscreen ? undefined : { height: 320 }}
        >
          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="map-fullscreen-btn top-3 right-3"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <CornersIn size={16} className="text-current" aria-hidden />
            ) : (
              <CornersOut size={16} className="text-current" aria-hidden />
            )}
          </button>
          <TrackingStatusOverlay
            liveStage={liveStage}
            sessionActive={sessionActive}
            displayEtaLine={displayEtaLine}
          />
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-[var(--bg)] text-[var(--tx3)] text-[12px]">
              Loading map...
            </div>
          ) : (
            <LiveTrackingMapLeaflet
              center={center}
              crew={
                hasPosition &&
                crew &&
                crew.current_lat != null &&
                crew.current_lng != null
                  ? {
                      current_lat: crew.current_lat,
                      current_lng: crew.current_lng,
                      name: crew.name,
                    }
                  : null
              }
              crewName={crewName}
              crewBearing={arrowBearing}
              pickup={effectivePickup ?? undefined}
              dropoff={effectiveDropoff ?? undefined}
              destination={effectiveDestination ?? undefined}
              mapTheme={theme}
              routePositions={
                routePositions.length > 0 ? routePositions : undefined
              }
              markerEtaLine={showMarkerEta ? displayEtaLine : null}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={hideHeader ? undefined : "space-y-3"}>
      {!hideHeader && (
        <>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">
            Live Crew Tracking
          </h3>
          <p className="text-[11px] text-[var(--tx3)]">
            {crewName || crew?.name || "Crew"} •{" "}
            {hasPosition ? "Live position updating" : "Waiting for GPS..."}
            {crew?.updated_at ? (
              <span className="block mt-1 text-[10px]">
                <TrackingFreshness
                  crewOnJob={sessionActive}
                  lastUpdate={crew.updated_at}
                />
              </span>
            ) : null}
          </p>
        </>
      )}
      <div
        className={`relative w-full rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--bg)] ${isFullscreen ? "map-fullscreen" : ""}`}
        style={isFullscreen ? undefined : { height: 320 }}
      >
        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="map-fullscreen-btn top-3 right-3"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <CornersIn size={16} className="text-current" aria-hidden />
          ) : (
            <CornersOut size={16} className="text-current" aria-hidden />
          )}
        </button>
        <TrackingStatusOverlay
          liveStage={liveStage}
          sessionActive={sessionActive}
          displayEtaLine={displayEtaLine}
        />
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-[var(--bg)] text-[var(--tx3)] text-[12px]">
            Loading map...
          </div>
        ) : (
          <MapboxMap
            token={MAPBOX_TOKEN}
            center={center}
            hasPosition={hasPosition}
            crew={
              hasPosition &&
              crew &&
              crew.current_lat != null &&
              crew.current_lng != null
                ? {
                    current_lat: crew.current_lat,
                    current_lng: crew.current_lng,
                    name: crew.name,
                  }
                : null
            }
            crewName={crewName}
            crewBearing={arrowBearing}
            mapStyle={mapStyle}
            pickup={effectivePickup ?? undefined}
            dropoff={effectiveDropoff ?? undefined}
            routeLineColor={routeLineColor}
            routeGeoJson={routeGeoJson ?? fallbackRouteGeoJson ?? undefined}
            markerEtaLine={showMarkerEta ? displayEtaLine : null}
            markerEtaLightChrome={theme === "light"}
          />
        )}
      </div>
    </div>
  );
}
