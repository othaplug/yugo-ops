"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const IDLE_INTERVAL_MS = 30_000; // 30s when idle (not on a job page)

/**
 * Business hours: 7 AM – 8 PM Toronto time.
 * Outside this window, idle tracking stops to save battery.
 */
function isBusinessHours(): boolean {
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Toronto",
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
      10,
    );
    return hour >= 7 && hour < 20;
  } catch {
    return true; // default to tracking if timezone API fails
  }
}

/** Sends crew location to the API when not on a job detail page so the admin tracking page always shows position. */
export default function CrewAlwaysOnLocation() {
  const pathname = usePathname();
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const businessHoursRef = useRef(true);

  const isOnJobPage = pathname?.startsWith("/crew/dashboard/job/") ?? false;
  const isPublicPage = pathname === "/crew/login" || pathname === "/crew/setup" || !pathname;

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOnJobPage || isPublicPage || !("geolocation" in navigator)) return;

    const checkBusinessHours = () => {
      businessHoursRef.current = isBusinessHours();
    };
    checkBusinessHours();
    const bhInterval = setInterval(checkBusinessHours, 60_000);

    const sendPosition = (coords: GeolocationCoordinates) => {
      if (!businessHoursRef.current) return;
      const now = Date.now();
      if (now - lastSentRef.current < IDLE_INTERVAL_MS) return;
      lastSentRef.current = now;

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
      (pos) => sendPosition(pos.coords),
      () => {},
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => {
      stopWatch();
      clearInterval(bhInterval);
    };
  }, [isOnJobPage, isPublicPage, stopWatch]);

  return null;
}
