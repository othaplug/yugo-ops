"use client";

import { useEffect, useRef } from "react";
import {
  MapPin,
  Package,
  MessageSquare,
  DollarSign,
  Star,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

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

/* Same palette as map tracking — each team gets a consistent color by hashing crew ID */
const TEAM_PALETTE = [
  "#22C55E", // green
  "#3B82F6", // blue
  "#A855F7", // purple
  "#F97316", // orange
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#EAB308", // yellow
  "#14B8A6", // teal
  "#F43F5E", // rose
  "#8B5CF6", // violet
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
  pod: Package,
  review: Star,
  map: MapPin,
  package: Package,
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 px-1 pr-2">
        {events.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[var(--tx3)]">
            No activity yet today
          </div>
        ) : (
          events.map((e) => {
            const Icon = ICON_MAP[e.icon] || MessageSquare;
            const color = teamColor(e.crewId);
            const isUnseen = unseenIds?.has(e.id);
            const content = (
              <div
                className="flex items-start gap-2 py-2 px-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
                style={color ? { borderLeft: `3px solid ${color}` } : undefined}
              >
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: color ? `${color}20` : "var(--gdim)",
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: color || "var(--tx2)" }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[11px] leading-snug ${isUnseen ? "font-bold text-[var(--tx)]" : "text-[var(--tx2)]"}`}
                  >
                    {e.description}
                  </p>
                  <p className="text-[9px] text-[var(--tx3)] mt-0.5">{formatTime(e.timestamp)}</p>
                </div>
              </div>
            );

            return <div key={e.id}>{content}</div>;
          })
        )}
      </div>
    </div>
  );
}
