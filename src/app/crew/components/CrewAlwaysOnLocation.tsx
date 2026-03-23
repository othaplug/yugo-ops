"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { registerCrewServiceWorker } from "@/lib/crew/register-sw";

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
  const [status, setStatus] = useState<"live" | "off" | "unavailable" | "denied">("off");

  const isOnJobPage = pathname?.startsWith("/crew/dashboard/job/") ?? false;
  const isPublicPage = pathname === "/crew/login" || pathname === "/crew/setup" || !pathname;

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
        setStatus("live");
        sendPosition(pos.coords);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("off");
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

  return (
    <div className="fixed bottom-4 left-4 z-40 md:left-[232px]">
      {status === "live" ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--card)] border border-[var(--brd)] shadow-lg text-[11px] font-medium text-[var(--tx2)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
          </span>
          <span className="text-[#22C55E] font-semibold">Location Live</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (status === "denied") {
              alert("Location permission was denied. Please enable location access in your browser settings and reload the page.");
            } else {
              startTracking();
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--card)] border border-[#F59E0B]/40 shadow-lg text-[11px] font-medium hover:border-[#F59E0B] transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          <span className="text-[#F59E0B] font-semibold">
            {status === "denied" ? "Location Denied" : status === "unavailable" ? "GPS Unavailable" : "Location Off"}
          </span>
          {status !== "denied" && status !== "unavailable" && (
            <span className="text-[var(--tx3)] ml-0.5">· Tap to reconnect</span>
          )}
        </button>
      )}
    </div>
  );
}
