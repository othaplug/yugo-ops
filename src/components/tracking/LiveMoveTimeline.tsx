"use client";

import { useEffect, useState, useCallback } from "react";

export interface TimelineEntry {
  id?: string;
  time: string;
  label: string;
  icon: string;
  status: "completed" | "current" | "upcoming";
  metadata?: Record<string, unknown>;
}

// Map move status → timeline entries shown
export const STATUS_TO_TIMELINE: Record<
  string,
  { label: string; icon: string }
> = {
  confirmed: { label: "Move confirmed", icon: "CheckCircle" },
  dispatched: { label: "Crew dispatched", icon: "Truck" },
  en_route_to_pickup: { label: "Crew en route to your home", icon: "Truck" },
  arrived_at_pickup: { label: "Crew arrived at your home", icon: "MapPin" },
  walkthrough_complete: { label: "Inventory walkthrough complete", icon: "ClipboardText" },
  loading: { label: "Loading started", icon: "Package" },
  en_route_to_destination: { label: "Loading complete, en route to new home", icon: "Truck" },
  arrived_at_destination: { label: "Arrived at new home", icon: "MapPin" },
  unloading: { label: "Unloading started", icon: "Package" },
  completed: { label: "Move complete", icon: "CheckCircle" },
};

interface Props {
  moveId: string;
  token: string;
  currentStatus: string;
  initialEntries?: TimelineEntry[];
}

function formatTime(isoOrTime: string): string {
  if (!isoOrTime) return "";
  // If already formatted like "8:02 AM" return as-is
  if (/^\d+:\d{2}\s?(AM|PM)$/i.test(isoOrTime)) return isoOrTime;
  try {
    return new Date(isoOrTime).toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoOrTime;
  }
}

export default function LiveMoveTimeline({ moveId, token, currentStatus, initialEntries }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries || []);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/moves/${moveId}/timeline?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.entries)) setEntries(data.entries);
      }
    } catch {
      // silent
    }
  }, [moveId, token]);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 30_000);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  if (entries.length === 0) return null;

  const isLive = !["completed", "delivered", "cancelled"].includes(currentStatus);
  const currentEntry = entries.find((e) => e.status === "current");

  // Colors matching the client portal light theme
  const GOLD = "#C9A962";
  const GREEN = "#22C55E";
  const FOREST = "#1C3A2B";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${FOREST}15` }}>
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center justify-between gap-3"
        style={{ background: `linear-gradient(135deg, ${GOLD}0C, ${GOLD}06)` }}
      >
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: GOLD }}>
            {isLive ? "Live" : "Move"} Timeline
          </p>
          <h3 className="text-[15px] font-bold" style={{ color: FOREST }}>Your Move, Step by Step</h3>
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${GREEN}14`, border: `1px solid ${GREEN}30` }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: GREEN }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: GREEN }} />
            </span>
            <span className="text-[10px] font-semibold" style={{ color: GREEN }}>Live</span>
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-5 space-y-0" style={{ backgroundColor: "#FAF7F2" }}>
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          const isCurrent = entry.status === "current";
          const isDone = entry.status === "completed";
          const isUpcoming = entry.status === "upcoming";

          // Dot appearance
          const dotBg = isDone ? GREEN : isCurrent ? GOLD : "transparent";
          const dotBorder = isDone ? GREEN : isCurrent ? GOLD : `${FOREST}25`;
          // Connector: gold for completed→current transition, faint for upcoming
          const connectorColor = isDone ? `${GREEN}50` : isCurrent ? `${GOLD}40` : `${FOREST}12`;

          return (
            <div key={entry.id || index} className="flex gap-3.5">
              {/* Dot + connector column */}
              <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                {/* Dot */}
                <div
                  className="shrink-0 rounded-full z-10"
                  style={{
                    width: 20,
                    height: 20,
                    background: dotBg,
                    border: `2px solid ${dotBorder}`,
                    boxShadow: isCurrent
                      ? `0 0 0 4px ${GOLD}20`
                      : isDone
                      ? `0 0 0 3px ${GREEN}14`
                      : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Inner dot for upcoming */}
                  {isUpcoming && (
                    <span
                      className="rounded-full"
                      style={{ width: 6, height: 6, background: `${FOREST}20` }}
                    />
                  )}
                  {/* Inner white dot for current/done */}
                  {(isCurrent || isDone) && (
                    <span
                      className="rounded-full"
                      style={{
                        width: isDone ? 7 : 6,
                        height: isDone ? 7 : 6,
                        background: "rgba(255,255,255,0.9)",
                        opacity: isDone ? 0.85 : 1,
                      }}
                    />
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      marginTop: 3,
                      marginBottom: 3,
                      minHeight: 18,
                      background: connectorColor,
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="text-[13px] font-semibold leading-tight"
                      style={{
                        color: isDone ? FOREST : isCurrent ? GOLD : `${FOREST}50`,
                      }}
                    >
                      {entry.label}
                    </p>
                    {isCurrent && (
                      <p className="text-[10px] font-semibold mt-0.5" style={{ color: `${GOLD}90` }}>
                        In progress
                      </p>
                    )}
                  </div>
                  {entry.time && !isUpcoming && (
                    <span
                      className="text-[11px] font-mono shrink-0 tabular-nums"
                      style={{ color: isCurrent ? GOLD : `${FOREST}55` }}
                    >
                      {formatTime(entry.time)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isLive && currentEntry && (
        <div className="px-4 py-3" style={{ background: `${GOLD}06`, borderTop: `1px solid ${GOLD}15` }}>
          <p className="text-[11px]" style={{ color: `${FOREST}55` }}>
            Updates automatically every 30 seconds
          </p>
        </div>
      )}
    </div>
  );
}
