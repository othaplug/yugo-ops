"use client";

import { useEffect, useState } from "react";
import { leadResponseSlaTargetMs } from "@/lib/leads/response-sla";

export default function LeadResponseSlaCountdown({
  createdAt,
  responseSlaTargetAt,
  firstResponseAt,
  compact = false,
}: {
  createdAt: string;
  responseSlaTargetAt?: string | null;
  firstResponseAt?: string | null;
  /** Narrower copy for table cells */
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (firstResponseAt) {
    return (
      <span
        className={`tabular-nums font-semibold text-emerald-600 ${compact ? "text-[10px]" : "text-[11px]"}`}
        title="First response recorded"
      >
        SLA met
      </span>
    );
  }
  const targetMs = leadResponseSlaTargetMs({ response_sla_target_at: responseSlaTargetAt, created_at: createdAt });
  if (targetMs == null) return null;
  const secLeft = Math.floor((targetMs - now) / 1000);
  if (secLeft <= 0) {
    return (
      <span
        className={`tabular-nums font-bold text-red-400 ${compact ? "text-[10px]" : "text-[11px]"}`}
        title="5-minute first-response target"
      >
        Over SLA
      </span>
    );
  }
  const m = Math.floor(secLeft / 60);
  const s = secLeft % 60;
  const color =
    secLeft <= 120 ? "text-amber-500" : secLeft <= 180 ? "text-emerald-500" : "text-[var(--tx3)]";
  return (
    <span
      className={`tabular-nums font-mono font-bold ${color} ${compact ? "text-[10px]" : "text-[11px]"}`}
      title="Time remaining to first response (5 minute target)"
    >
      {m}:{String(s).padStart(2, "0")} left
    </span>
  );
}
