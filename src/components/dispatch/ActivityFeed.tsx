"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  MapPin,
  Truck,
  ClipboardText,
  ChatText as MessageSquare,
  Money as DollarSign,
  Star,
  Warning as AlertTriangle,
  CheckCircle as CheckCircle2,
} from "@phosphor-icons/react";

export interface DispatchEvent {
  id: string;
  type: string;
  icon: string;
  description: string;
  timestamp: string;
  jobId?: string;
  jobType?: "move" | "delivery";
  href?: string;
  crewId?: string | null;
}

/* Yugo+ v3 qualitative (wine, forest, slate, umber, taupe, plum, success, danger) */
const TEAM_PALETTE = [
  "#5c1a33",
  "#2c3e2d",
  "#2f4a7a",
  "#a36208",
  "#7a5e3a",
  "#7e2f5f",
  "#2f6f3c",
  "#9b2b2b",
];

function teamColor(crewId: string | null | undefined): string | null {
  if (!crewId) return null;
  let h = 0;
  for (let i = 0; i < crewId.length; i++)
    h = (h * 31 + crewId.charCodeAt(i)) & 0xffff;
  return TEAM_PALETTE[h % TEAM_PALETTE.length];
}

const ICON_MAP: Record<string, React.ElementType> = {
  message: MessageSquare,
  eta_sms: MessageSquare,
  tip: DollarSign,
  pod: ClipboardText,
  review: Star,
  map: MapPin,
  truck: Truck,
  dollar: DollarSign,
  star: Star,
  alert: AlertTriangle,
  completed: CheckCircle2,
  check: CheckCircle2,
  status_change: CheckCircle2,
  payment_received: DollarSign,
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface ActivityFeedProps {
  events: DispatchEvent[];
  unseenIds?: Set<string>;
  onMarkSeen?: () => void;
}

export default function ActivityFeed({
  events,
  unseenIds,
  onMarkSeen,
}: ActivityFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onMarkSeen || !unseenIds?.size) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onMarkSeen();
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onMarkSeen, unseenIds?.size]);

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0 -mx-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 px-1 pr-2">
        {events.length === 0 ? (
          <div className="py-16 sm:py-20 flex flex-col items-center text-center px-2">
            <p className="text-base font-semibold text-[var(--yu3-ink)]">
              No activity yet
            </p>
            <p className="text-sm text-[var(--yu3-ink-muted)] mt-1 leading-snug max-w-[280px]">
              Events appear here as jobs progress
            </p>
          </div>
        ) : (
          events.map((e) => {
            const iconKey = e.icon === "package" ? "truck" : e.icon;
            const Icon = ICON_MAP[iconKey] || MessageSquare;
            const color = teamColor(e.crewId);
            const isUnseen = unseenIds?.has(e.id);

            const inner = (
              <div
                className="flex items-start gap-2.5 py-2.5 px-2 rounded-[var(--yu3-r-md)] hover:bg-[var(--yu3-wine-wash)] transition-colors"
                style={
                  color
                    ? {
                        borderLeft: `3px solid ${color}`,
                        paddingLeft: "calc(0.5rem - 3px)",
                      }
                    : undefined
                }
              >
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{
                    backgroundColor: color ? `${color}2a` : "var(--yu3-neutral-tint)",
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: color || "var(--yu3-ink-muted)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug ${
                      isUnseen
                        ? "font-bold text-[var(--tx)]"
                        : "text-[var(--tx2)]"
                    }`}
                  >
                    {e.description}
                  </p>
                  <p className="text-xs text-[var(--tx3)] mt-0.5 tabular-nums">
                    {formatTime(e.timestamp)}
                  </p>
                </div>
                {isUnseen && (
                  <div
                    className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--yu3-wine)] mt-2"
                    aria-hidden
                  />
                )}
              </div>
            );

            return (
              <div key={e.id}>
                {e.href ? (
                  <Link href={e.href} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
