"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { registerCrewServiceWorker } from "@/lib/crew/register-sw";
import {
  markCrewLocationAllowed,
  readCrewGeoOptIn,
  revokeCrewLocationMemory,
} from "@/lib/crew/useCrewPersistentTracking";
const IDLE_INTERVAL_MS = 30_000;

/**
 * Sends crew/tablet location to the API 24/7 when not on a job detail page
 * so admin tracking always shows position.
 * Renders a small live indicator visible to the crew.
 */
export default function CrewAlwaysOnLocation() {
  useEffect(() => {
    registerCrewServiceWorker();
  }, []);

  const pathname = usePathname();
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const [status, setStatus] = useState<
    "live" | "off" | "unavailable" | "denied"
  >("off");

  useLayoutEffect(() => {
    if (readCrewGeoOptIn()) setStatus("live");
  }, []);

  const isOnJobPage = pathname?.startsWith("/crew/dashboard/job/") ?? false;
  const isPublicPage =
    pathname === "/crew/login" || pathname === "/crew/setup" || !pathname;

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTracking = useCallback(() => {
    if (isOnJobPage || isPublicPage || !("geolocation" in navigator)) {
      if (!("geolocation" in navigator)) setStatus("unavailable");
      return;
    }

    stopWatch();

    const sendPosition = (coords: GeolocationCoordinates) => {
      const now = Date.now();
      if (now - lastSentRef.current < IDLE_INTERVAL_MS) return;
      lastSentRef.current = now;
      setStatus("live");

      fetch("/api/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy ?? 0,
          speed: coords.speed,
          heading: coords.heading,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        markCrewLocationAllowed();
        setStatus("live");
        sendPosition(pos.coords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          revokeCrewLocationMemory();
          setStatus("denied");
        } else setStatus("off");
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    );
  }, [isOnJobPage, isPublicPage, stopWatch]);

  useEffect(() => {
    startTracking();
    return () => stopWatch();
  }, [startTracking, stopWatch]);

  // On job pages, the job page handles its own GPS — hide this indicator
  if (isOnJobPage || isPublicPage) return null;

  const topOffset =
    "top-[max(0.75rem,env(safe-area-inset-top,0px))] lg:top-[max(1rem,env(safe-area-inset-top,0px))]";
  const rowClass =
    "flex max-w-[min(100%,calc(100vw-5.5rem))] items-center gap-2.5 text-left [font-family:var(--font-body)]";

  return (
    <div
      className={`fixed z-40 right-3 lg:right-6 ${topOffset} max-w-[calc(100vw-2rem)]`}
      role="region"
      aria-label="Location sharing status"
    >
      {status === "live" ? (
        <div
          className={`${rowClass} text-[10px] font-bold uppercase tracking-[0.12em] text-[#243524]`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2C3E2D] opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2C3E2D]" />
          </span>
          <span>Location live</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (status === "denied") {
              alert(
                "Location permission was denied. Please enable location access in your browser settings and reload the page.",
              );
            } else {
              startTracking();
            }
          }}
          className={`group ${rowClass} flex-wrap gap-x-2 gap-y-1 rounded-md py-0.5 -my-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E2D]/25 focus-visible:ring-offset-2`}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                status === "denied" ? "bg-[var(--red)]" : "bg-[#5C1A33]"
              }`}
              aria-hidden
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                status === "denied" ? "text-[var(--red)]" : "text-[#5C1A33]"
              }`}
            >
              {status === "denied"
                ? "Location denied"
                : status === "unavailable"
                  ? "GPS unavailable"
                  : "Location off"}
            </span>
          </span>
          {status !== "denied" && status !== "unavailable" && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#243524]">
              <span className="text-[var(--tx3)]" aria-hidden>
                ·
              </span>
              Tap to reconnect
            </span>
          )}
        </button>
      )}
    </div>
  );
}
