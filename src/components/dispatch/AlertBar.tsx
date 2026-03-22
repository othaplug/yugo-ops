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
  { dot: string; iconColor: string; Icon: React.ElementType }
> = {
  unassigned: { dot: "bg-amber-500", iconColor: "text-amber-500", Icon: AlertTriangle },
  gps_offline: { dot: "bg-red-500",  iconColor: "text-red-400",   Icon: WifiOff },
  overdue:     { dot: "bg-red-500",  iconColor: "text-red-400",   Icon: Clock },
  problem:     { dot: "bg-orange-500", iconColor: "text-orange-400", Icon: AlertTriangle },
};

interface AlertBarProps {
  alerts: DispatchAlert[];
}

function consolidateDispatchAlerts(alerts: DispatchAlert[]): DispatchAlert[] {
  const gps  = alerts.filter((a) => a.type === "gps_offline");
  const rest = alerts.filter((a) => a.type !== "gps_offline");
  if (gps.length <= 1) return alerts;

  const names = gps.map((g) => {
    const m = g.message.match(/^(.+?)\s+GPS offline/i);
    return m ? m[1].trim() : g.message;
  });

  const MAX_NAMES = 2;
  const label =
    names.length > MAX_NAMES
      ? `${names.slice(0, MAX_NAMES).join(", ")} +${names.length - MAX_NAMES}`
      : names.join(", ");

  const combined: DispatchAlert = {
    id: "gps-offline-group",
    type: "gps_offline",
    message: `GPS stale · ${label}`,
    action: "Check",
    href: gps.find((g) => g.href)?.href ?? "/admin/crew",
  };
  return [...rest, combined];
}

export default function AlertBar({ alerts }: AlertBarProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = consolidateDispatchAlerts(alerts).filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => {
        const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.problem;
        const { Icon } = cfg;
        return (
          <div
            key={a.id}
            className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.iconColor}`} />
            <span className="text-[11px] text-[var(--tx2)] whitespace-nowrap">
              {a.message}
            </span>
            {a.href && (
              <Link
                href={a.href}
                className="text-[11px] font-semibold text-[var(--gold)] hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                {a.action} →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setDismissed((p) => new Set([...p, a.id]))}
              className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-white/10 transition-all shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
