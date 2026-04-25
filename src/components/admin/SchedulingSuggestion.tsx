"use client";

import { useState, useEffect } from "react";
import { Lightning, CheckCircle, Warning, CalendarBlank, UsersThree } from "@phosphor-icons/react";

interface Alternative {
  date: string;
  window: string;
  team_name: string | null;
  crew_ids: string[];
}

interface SchedulingResult {
  status: "available" | "partial" | "unavailable" | "none";
  alternatives?: Alternative[];
}

interface Props {
  moveId: string;
}

export default function SchedulingSuggestion({ moveId }: Props) {
  const [data, setData] = useState<SchedulingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/client/scheduling-status?moveId=${moveId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [moveId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--brd)]/40 bg-[var(--card)] p-4 animate-pulse">
        <div className="h-4 w-40 bg-[var(--brd)]/30 rounded" />
      </div>
    );
  }

  if (!data || data.status === "none") return null;

  return (
    <div className="rounded-xl border border-[var(--brd)]/40 bg-[var(--card)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--brd)]/30">
        <Lightning size={14} className="text-[var(--accent-text)]" weight="duotone" />
        <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">Scheduling Intelligence</span>
      </div>

      <div className="px-4 py-3">
        {data.status === "available" && (
          <div className="flex items-center gap-2 text-[var(--grn)]">
            <CheckCircle size={16} weight="duotone" />
            <span className="text-[12px] font-semibold">Crew available for requested slot</span>
          </div>
        )}

        {data.status === "unavailable" && (
          <div className="flex items-center gap-2 text-[var(--red)]">
            <Warning size={16} weight="duotone" />
            <span className="text-[12px] font-semibold">No crew available for requested slot</span>
          </div>
        )}

        {data.status === "partial" && data.alternatives && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Warning size={16} weight="duotone" />
              <span className="text-[12px] font-semibold">Requested slot has limited availability</span>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                Suggested alternatives
              </span>
              {data.alternatives.slice(0, 4).map((alt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-[var(--brd)]/30 bg-[var(--bg)] px-3 py-2"
                >
                  <CalendarBlank size={12} className="text-[var(--tx3)] shrink-0" />
                  <span className="text-[11px] font-medium text-[var(--tx)] tabular-nums">
                    {new Date(alt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-[10px] text-[var(--tx3)]">{alt.window}</span>
                  {alt.team_name && (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--accent-text)] ml-auto">
                      <UsersThree size={10} />
                      {alt.team_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
