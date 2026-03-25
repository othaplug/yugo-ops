"use client";

/**
 * Admin / dispatch: shows how fresh crew GPS data is (by last update timestamp).
 * When the crew is not on an active job, copy stays muted (grey) — no alert colors.
 * Stale fixes while on-job use amber only; "GPS offline" wording is not shown on the map/badge.
 */
export function TrackingFreshness({
  lastUpdate,
  className = "",
  crewOnJob = true,
  tone = "light",
}: {
  lastUpdate?: string | null;
  className?: string;
  /** False for idle / offline / returning — freshness is shown in grey only. */
  crewOnJob?: boolean;
  /** `dark` for labels on the live map (dark basemap). */
  tone?: "light" | "dark";
}) {
  const muted = tone === "dark" ? "text-white/45" : "text-[var(--tx3)]";

  if (!lastUpdate) {
    return <span className={`${muted} ${className}`.trim()}>No GPS yet</span>;
  }
  const secondsAgo = (Date.now() - new Date(lastUpdate).getTime()) / 1000;
  if (secondsAgo < 0) {
    return <span className={`${muted} ${className}`.trim()}>—</span>;
  }

  if (!crewOnJob) {
    if (secondsAgo < 60) {
      return (
        <span className={`${muted} ${className}`.trim()}>{Math.max(1, Math.round(secondsAgo))}s ago</span>
      );
    }
    if (secondsAgo < 3600) {
      return <span className={`${muted} ${className}`.trim()}>{Math.round(secondsAgo / 60)}m ago</span>;
    }
    return (
      <span className={`${muted} ${className}`.trim()}>{Math.floor(secondsAgo / 3600)}h ago</span>
    );
  }

  if (secondsAgo < 30) {
    return (
      <span className={`text-emerald-500 ${className}`.trim()}>
        Live ({Math.max(1, Math.round(secondsAgo))}s ago)
      </span>
    );
  }
  if (secondsAgo < 120) {
    return (
      <span className={`text-emerald-400 ${className}`.trim()}>{Math.round(secondsAgo / 60)}m ago</span>
    );
  }
  if (secondsAgo < 600) {
    return (
      <span className={`text-amber-500 ${className}`.trim()}>{Math.round(secondsAgo / 60)}m ago</span>
    );
  }
  return (
    <span className={`text-amber-500 ${className}`.trim()}>{Math.round(secondsAgo / 60)}m ago</span>
  );
}
