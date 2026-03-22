"use client";

import { useState } from "react";
import Link from "next/link";
import { Warning as AlertTriangle, WifiSlash as WifiOff, Clock, X } from "@phosphor-icons/react";

export interface DispatchAlert {
  id: string;
  type: "unassigned" | "gps_offline" | "overdue" | "problem";
  message: string;
  action: string;
  href?: string;
}

const TYPE_CONFIG: Record<
  DispatchAlert["type"],
  { bg: string; border: string; iconColor: string; Icon: React.ElementType }
> = {
  unassigned: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    iconColor: "text-amber-500",
    Icon: AlertTriangle,
  },
  gps_offline: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    iconColor: "text-red-500",
    Icon: WifiOff,
  },
  overdue: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    iconColor: "text-red-500",
    Icon: Clock,
  },
  problem: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    iconColor: "text-orange-500",
    Icon: AlertTriangle,
  },
};

interface AlertBarProps {
  alerts: DispatchAlert[];
}

/** Merge multiple GPS-offline rows into one banner to reduce vertical noise. */
function consolidateDispatchAlerts(alerts: DispatchAlert[]): DispatchAlert[] {
  const gps = alerts.filter((a) => a.type === "gps_offline");
  const rest = alerts.filter((a) => a.type !== "gps_offline");
  if (gps.length <= 1) return alerts;

  const names = gps.map((g) => {
    const m = g.message.match(/^(.+?)\s+GPS offline/i);
    return m ? m[1].trim() : g.message;
  });
  const href = gps.find((g) => g.href)?.href ?? "/admin/crew";
  const combined: DispatchAlert = {
    id: "gps-offline-group",
    type: "gps_offline",
    message: `Stale GPS (10+ min): ${names.join(", ")}`,
    action: "Check",
    href,
  };
  return [...rest, combined];
}

export default function AlertBar({ alerts }: AlertBarProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = consolidateDispatchAlerts(alerts).filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) =>
    setDismissed((prev) => new Set([...prev, id]));

  return (
    <div className="space-y-3">
      {visible.map((a) => {
        const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.problem;
        const { Icon } = cfg;
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 ${cfg.bg} border ${cfg.border} rounded-lg`}
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0 text-[12px] text-[var(--tx2)]">
              {a.message}
              {a.href ? (
                <Link
                  href={a.href}
                  className="ml-2 font-semibold text-[var(--gold)] hover:underline whitespace-nowrap"
                >
                  {a.action} →
                </Link>
              ) : (
                <span className="ml-2 font-semibold text-[var(--tx3)]">{a.action}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              className={`shrink-0 p-1 rounded-lg ${cfg.iconColor} hover:bg-black/10 transition-colors touch-manipulation`}
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
