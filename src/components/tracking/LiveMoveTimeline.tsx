"use client";

import { useEffect, useState, useCallback } from "react";
import { QUOTE_EYEBROW_CLASS } from "@/app/quote/[quoteId]/quote-shared";

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
  walkthrough_complete: {
    label: "Inventory walkthrough complete",
    icon: "ClipboardText",
  },
  loading: { label: "Loading started", icon: "stack" },
  en_route_to_destination: {
    label: "Loading complete, en route to new home",
    icon: "Truck",
  },
  arrived_at_destination: { label: "Arrived at new home", icon: "MapPin" },
  unloading: { label: "Unloading started", icon: "stack" },
  completed: { label: "Move complete", icon: "CheckCircle" },
};

/** Client-facing labels when the job is logistics / delivery (not a residential move). */
export const STATUS_TO_TIMELINE_DELIVERY: Record<
  string,
  { label: string; icon: string }
> = {
  confirmed: { label: "Delivery confirmed", icon: "CheckCircle" },
  dispatched: { label: "Crew dispatched", icon: "Truck" },
  en_route_to_pickup: { label: "Crew en route to pickup", icon: "Truck" },
  arrived_at_pickup: { label: "Crew arrived at pickup", icon: "MapPin" },
  walkthrough_complete: {
    label: "Walkthrough complete",
    icon: "ClipboardText",
  },
  loading: { label: "Loading started", icon: "stack" },
  en_route_to_destination: { label: "En route to drop-off", icon: "Truck" },
  arrived_at_destination: { label: "Arrived at drop-off", icon: "MapPin" },
  unloading: { label: "Unloading started", icon: "stack" },
  completed: { label: "Delivery complete", icon: "CheckCircle" },
};

interface Props {
  moveId: string;
  token: string;
  currentStatus: string;
  initialEntries?: TimelineEntry[];
  /** Use delivery-focused timeline headings (logistics / B2B / single-item / white glove). */
  useDeliveryCopy?: boolean;
  /** Dark wine card + cream type (Estate live tracking). */
  isEstate?: boolean;
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

export default function LiveMoveTimeline({
  moveId,
  token,
  currentStatus,
  initialEntries,
  useDeliveryCopy = false,
  isEstate = false,
}: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries || []);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/timeline?token=${token}`,
      );
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

  const isLive = !["completed", "delivered", "cancelled"].includes(
    currentStatus,
  );
  const currentEntry = entries.find((e) => e.status === "current");

  // Colors: light track uses forest accents; Estate uses cream on wine.
  const FOREST_HEX = "#2C3E2D";
  const GREEN = "#22C55E";
  const FOREST = "#1C3A2B";
  const CREAM = "#EDE6DC";
  const WINE_DEEP = "#321018";

  const accent = isEstate ? CREAM : FOREST_HEX;
  const headingInk = isEstate ? CREAM : FOREST;
  const borderOuter = isEstate ? "rgba(237,230,220,0.14)" : `${FOREST}15`;
  const headerBg = isEstate
    ? "linear-gradient(135deg, rgba(237,230,220,0.08), rgba(237,230,220,0.02))"
    : `linear-gradient(135deg, ${FOREST_HEX}0C, ${FOREST_HEX}06)`;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${borderOuter}` }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center justify-between gap-3"
        style={{ background: headerBg }}
      >
        <div>
          <p
            className={`${QUOTE_EYEBROW_CLASS} mb-1`}
            style={{ color: accent }}
          >
            {isLive ? "Live" : useDeliveryCopy ? "Delivery" : "Move"} Timeline
          </p>
          <h3 className="text-[15px] font-bold" style={{ color: headingInk }}>
            {useDeliveryCopy
              ? "Your Delivery, Step by Step"
              : isEstate
                ? "Your Estate Move, Step by Step"
                : "Your Move, Step by Step"}
          </h3>
        </div>
        {isLive && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: `${GREEN}14`, border: `1px solid ${GREEN}30` }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: GREEN }}
              />
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ background: GREEN }}
              />
            </span>
            <span
              className="text-[11px] font-semibold"
              style={{ color: GREEN }}
            >
              Live
            </span>
          </span>
        )}
      </div>

      {/* Timeline */}
      <div
        className="px-4 py-5 space-y-0"
        style={{ backgroundColor: isEstate ? WINE_DEEP : "#F9EDE4" }}
      >
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          const isCurrent = entry.status === "current";
          const isDone = entry.status === "completed";
          const isUpcoming = entry.status === "upcoming";

          // Dot appearance
          const dotBg = isDone ? GREEN : isCurrent ? accent : "transparent";
          const dotBorder = isDone
            ? GREEN
            : isCurrent
              ? accent
              : isEstate
                ? "rgba(237,230,220,0.25)"
                : `${FOREST}25`;
          // Connector: gold for completed→current transition, faint for upcoming
          const connectorColor = isDone
            ? `${GREEN}50`
            : isCurrent
              ? isEstate
                ? "rgba(237,230,220,0.35)"
                : `${FOREST_HEX}40`
              : isEstate
                ? "rgba(237,230,220,0.1)"
                : `${FOREST}12`;

          return (
            <div key={entry.id || index} className="flex gap-3.5">
              {/* Dot + connector column */}
              <div
                className="flex flex-col items-center shrink-0"
                style={{ width: 20 }}
              >
                {/* Dot */}
                <div
                  className="shrink-0 rounded-full z-10"
                  style={{
                    width: 20,
                    height: 20,
                    background: dotBg,
                    border: `2px solid ${dotBorder}`,
                    boxShadow: isCurrent
                      ? isEstate
                        ? "0 0 0 4px rgba(237,230,220,0.15)"
                        : `0 0 0 4px ${FOREST_HEX}20`
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
                      style={{
                        width: 6,
                        height: 6,
                        background: isEstate
                          ? "rgba(237,230,220,0.2)"
                          : `${FOREST}20`,
                      }}
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
                      className="text-[14px] font-semibold leading-tight"
                      style={{
                        color: isDone
                          ? isEstate
                            ? CREAM
                            : FOREST
                          : isCurrent
                            ? accent
                            : isEstate
                              ? "rgba(237,230,220,0.45)"
                              : `${FOREST}50`,
                      }}
                    >
                      {entry.label}
                    </p>
                    {isCurrent && (
                      <p
                        className="text-[11px] font-semibold mt-0.5"
                        style={{
                          color: isEstate
                            ? "rgba(237,230,220,0.65)"
                            : `${FOREST_HEX}90`,
                        }}
                      >
                        In progress
                      </p>
                    )}
                  </div>
                  {entry.time && !isUpcoming && (
                    <span
                      className="text-[12px] font-mono shrink-0 tabular-nums"
                      style={{
                        color: isCurrent
                          ? accent
                          : isEstate
                            ? "rgba(237,230,220,0.5)"
                            : `${FOREST}55`,
                      }}
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
        <div
          className="px-4 py-3"
          style={{
            background: isEstate
              ? "rgba(237,230,220,0.04)"
              : `${FOREST_HEX}06`,
            borderTop: isEstate
              ? "1px solid rgba(237,230,220,0.1)"
              : `1px solid ${FOREST_HEX}15`,
          }}
        >
          <p
            className="text-[12px]"
            style={{
              color: isEstate ? "rgba(237,230,220,0.5)" : `${FOREST}55`,
            }}
          >
            Updates automatically every 30 seconds
          </p>
        </div>
      )}
    </div>
  );
}
