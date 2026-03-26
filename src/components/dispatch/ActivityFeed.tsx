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
  Radio,
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

const TEAM_PALETTE = [
  "#22C55E",
  "#3B82F6",
  "#A855F7",
  "#F97316",
  "#EC4899",
  "#06B6D4",
  "#EAB308",
  "#14B8A6",
  "#F43F5E",
  "#8B5CF6",
];

function teamColor(crewId: string | null | undefined): string | null {
  if (!crewId) return null;
  let h = 0;
  for (let i = 0; i < crewId.length; i++) h = (h * 31 + crewId.charCodeAt(i)) & 0xffff;
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
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface ActivityFeedProps {
  events: DispatchEvent[];
  unseenIds?: Set<string>;
  onMarkSeen?: () => void;
}

export default function ActivityFeed({ events, unseenIds, onMarkSeen }: ActivityFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onMarkSeen || !unseenIds?.size) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onMarkSeen();
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onMarkSeen, unseenIds?.size]);

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0 -mx-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 px-1 pr-2">
        {events.length === 0 ? (
          <div className="py-16 sm:py-20 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--gdim)] flex items-center justify-center">
              <Radio className="w-5 h-5 text-[var(--tx3)]" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[var(--tx2)]">No activity yet</p>
              <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                Events appear here as jobs progress
              </p>
            </div>
          </div>
        ) : (
          events.map((e) => {
            const iconKey = e.icon === "package" ? "truck" : e.icon;
            const Icon = ICON_MAP[iconKey] || MessageSquare;
            const color = teamColor(e.crewId);
            const isUnseen = unseenIds?.has(e.id);

            const inner = (
              <div
                className="flex items-start gap-2.5 py-2.5 px-2 rounded-lg hover:bg-[var(--brd)]/25 transition-colors"
                style={
                  color
                    ? { borderLeft: `3px solid ${color}`, paddingLeft: "calc(0.5rem - 3px)" }
                    : undefined
                }
              >
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: color ? `${color}20` : "var(--gdim)" }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: color || "var(--tx2)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[11px] leading-snug ${
                      isUnseen ? "font-bold text-[var(--tx)]" : "text-[var(--tx2)]"
                    }`}
                  >
                    {e.description}
                  </p>
                  <p className="text-[9px] text-[var(--tx3)] mt-0.5">{formatTime(e.timestamp)}</p>
                </div>
                {isUnseen && (
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--gold)] mt-2" />
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
