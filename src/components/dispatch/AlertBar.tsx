"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export interface DispatchAlert {
  id: string;
  type: "unassigned" | "gps_offline" | "overdue" | "problem";
  message: string;
  action: string;
  href?: string;
}

interface AlertBarProps {
  alerts: DispatchAlert[];
}

export default function AlertBar({ alerts }: AlertBarProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        {alerts.map((a) => (
          <div key={a.id} className="text-[12px] text-[var(--tx2)]">
            {a.message}
            {a.href ? (
              <Link
                href={a.href}
                className="ml-2 font-semibold text-[var(--gold)] hover:underline"
              >
                {a.action} →
              </Link>
            ) : (
              <span className="ml-2 font-semibold text-[var(--tx3)]">{a.action}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
