"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const PING_INTERVAL_MS = 20000; // 20s when not on a job (job page has its own 15s with sessionId)

/** Sends crew location to the API when not on a job detail page so the admin tracking page always shows position (full-time tracking). */
export default function CrewAlwaysOnLocation() {
  const pathname = usePathname();
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const isOnJobPage = pathname?.startsWith("/crew/dashboard/job/") ?? false;
  const isPublicPage = pathname === "/crew/login" || pathname === "/crew/setup" || !pathname;

  useEffect(() => {
    if (isOnJobPage || isPublicPage || !("geolocation" in navigator)) return;

    const sendPosition = (lat: number, lng: number, accuracy?: number) => {
      const now = Date.now();
      if (now - lastSentRef.current < PING_INTERVAL_MS) return;
      lastSentRef.current = now;
      fetch("/api/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          accuracy: accuracy ?? 0,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isOnJobPage, isPublicPage]);

  return null;
}
