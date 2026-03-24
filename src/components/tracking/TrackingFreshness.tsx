"use client";

/**
 * Admin / dispatch: shows how fresh crew GPS data is (by last update timestamp).
 */
export function TrackingFreshness({
  lastUpdate,
  className = "",
}: {
  lastUpdate?: string | null;
  className?: string;
}) {
  if (!lastUpdate) {
    return <span className={`text-[var(--tx3)] ${className}`.trim()}>No GPS yet</span>;
  }
  const secondsAgo = (Date.now() - new Date(lastUpdate).getTime()) / 1000;
  if (secondsAgo < 0) {
    return <span className={`text-[var(--tx3)] ${className}`.trim()}>—</span>;
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
    <span className={`text-red-500 ${className}`.trim()}>
      {Math.round(secondsAgo / 60)}m ago — GPS offline
    </span>
  );
}
