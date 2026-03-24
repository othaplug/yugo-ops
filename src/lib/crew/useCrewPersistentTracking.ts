"use client";

import { useEffect, useRef, useCallback } from "react";

/** Tiny silent WAV (8 kHz mono) as data URL — keeps iOS audio context alive without a static asset. */
function silentWavDataUrl(seconds = 0.4): string {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) v.setUint8(44 + i, 128);
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${typeof btoa !== "undefined" ? btoa(bin) : ""}`;
}

const FOREGROUND_MS = 15_000;
const BACKGROUND_MS = 60_000;
const IDLE_MS = 30_000;

export type GeoPermissionState = "unsupported" | "denied" | "prompt" | "granted" | "unknown";

export async function checkLocationPermissions(): Promise<{
  status: GeoPermissionState;
  message?: string;
}> {
  if (!("geolocation" in navigator)) {
    return {
      status: "unsupported",
      message: "This device does not support GPS tracking.",
    };
  }
  try {
    const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    if (p.state === "denied") {
      return {
        status: "denied",
        message:
          "Location access is required for live tracking. Enable location in your device settings: Settings → Privacy → Location Services → Browser → Allow.",
      };
    }
    if (p.state === "prompt") {
      return {
        status: "prompt",
        message: 'We need your location for live tracking. Tap "Allow" when prompted.',
      };
    }
    return { status: "granted" };
  } catch {
    return { status: "unknown" };
  }
}

function postToServiceWorker(data: object) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage(data);
    })
    .catch(() => {});
}

async function registerTrackingSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } }).sync;
    if (sync?.register) await sync.register("tracking-sync");
  } catch {
    // Background Sync may be unavailable
  }
}

export function useCrewPersistentTracking(opts: {
  sessionId: string | undefined;
  isActive: boolean;
  onAutoAdvanced: () => void;
  onPermissionChange?: (s: GeoPermissionState) => void;
}) {
  const { sessionId, isActive, onAutoAdvanced, onPermissionChange } = opts;
  const onAutoAdvancedRef = useRef(onAutoAdvanced);
  onAutoAdvancedRef.current = onAutoAdvanced;

  const permRef = useRef(onPermissionChange);
  permRef.current = onPermissionChange;

  const sessionIdRef = useRef(sessionId);
  const isActiveRef = useRef(isActive);
  sessionIdRef.current = sessionId;
  isActiveRef.current = isActive;

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const bgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  const oscillatorRef = useRef<{ ctx: AudioContext; osc: OscillatorNode } | null>(null);

  const sendPosition = useCallback(async (coords: GeolocationCoordinates, source: "foreground" | "background") => {
    const sid = sessionIdRef.current;
    const body: Record<string, unknown> = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      timestamp: new Date().toISOString(),
      source,
    };
    if (sid) body.sessionId = sid;

    try {
      const res = await fetch("/api/tracking/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("bad");
      const data = await res.json().catch(() => null);
      if (data?.autoAdvanced) onAutoAdvancedRef.current();
    } catch {
      await registerTrackingSync();
      navigator.serviceWorker?.controller?.postMessage("replay-queue");
    }
  }, []);

  const clearBg = useCallback(() => {
    if (bgIntervalRef.current != null) {
      clearInterval(bgIntervalRef.current);
      bgIntervalRef.current = null;
    }
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveAudioRef.current) {
      keepAliveAudioRef.current.pause();
      keepAliveAudioRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.osc.stop();
        void oscillatorRef.current.ctx.close();
      } catch {
        /* ignore */
      }
      oscillatorRef.current = null;
    }
  }, []);

  const startKeepAlive = useCallback(() => {
    if (keepAliveAudioRef.current || oscillatorRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscillatorRef.current = { ctx, osc };
      }
    } catch {
      /* ignore */
    }
    const a = new Audio();
    a.src = silentWavDataUrl(0.5);
    a.loop = true;
    a.volume = 0;
    keepAliveAudioRef.current = a;
    void a.play().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkLocationPermissions().then((r) => {
      if (!cancelled) permRef.current?.(r.status);
    });
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        p.onchange = () => {
          checkLocationPermissions().then((r) => permRef.current?.(r.status));
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      permRef.current?.("unsupported");
      return;
    }

    const throttleMs = () => {
      const sid = sessionIdRef.current;
      const act = isActiveRef.current;
      if (!sid || !act) return IDLE_MS;
      return document.hidden ? BACKGROUND_MS : FOREGROUND_MS;
    };

    const tickWatch = (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentRef.current < throttleMs()) return;
      lastSentRef.current = now;
      void sendPosition(pos.coords, document.hidden ? "background" : "foreground");
    };

    const runBackgroundInterval = () => {
      clearBg();
      const sid = sessionIdRef.current;
      const act = isActiveRef.current;
      if (!document.hidden || !sid || !act) return;
      bgIntervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void sendPosition(pos.coords, "background");
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      }, BACKGROUND_MS);
    };

    const onVisibility = () => {
      if (document.hidden) {
        startKeepAlive();
        runBackgroundInterval();
      } else {
        stopKeepAlive();
        clearBg();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    watchIdRef.current = navigator.geolocation.watchPosition(
      tickWatch,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) permRef.current?.("denied");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    onVisibility();

    const sid = sessionIdRef.current;
    const act = isActiveRef.current;
    if (sid && act) {
      postToServiceWorker({ type: "START_TRACKING", sessionId: sid });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearBg();
      stopKeepAlive();
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      postToServiceWorker({ type: "STOP_TRACKING" });
    };
  }, [sessionId, isActive, sendPosition, clearBg, startKeepAlive, stopKeepAlive]);

  return { recheckPermission: checkLocationPermissions };
}
