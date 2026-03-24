/**
 * Crew GPS — worker hooks (loaded via importScripts from crew-sw.js).
 * navigator.geolocation is not available in service workers; the crew job page
 * sends positions. Background sync retries use replayQueue in crew-sw.js.
 */

self.addEventListener("message", (event) => {
  const d = event.data;
  if (!d || typeof d !== "object") return;
  if (d.type === "START_TRACKING") {
    try {
      self.__yugoTrackingSessionId = d.sessionId || null;
    } catch (_) {}
  }
  if (d.type === "STOP_TRACKING") {
    try {
      self.__yugoTrackingSessionId = null;
    } catch (_) {}
  }
});
