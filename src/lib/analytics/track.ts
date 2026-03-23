export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV === "development") {
    console.log(`[analytics] ${event}`, properties);
  }

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
  }).catch(() => {});
}
