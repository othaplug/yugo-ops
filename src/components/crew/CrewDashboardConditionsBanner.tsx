"use client";

import { useId, useMemo, useState } from "react";
import { CaretDown, Cloud } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";
import JobConditionsBody from "./JobConditionsBody";
import type { JobConditionsJob } from "./useCrewJobConditions";
import { jobShowsConditionsRow } from "./useCrewJobConditions";

type Props = {
  jobs: JobConditionsJob[];
  weatherByJobId: Record<
    string,
    { brief: MoveWeatherBrief; alert: string | null }
  >;
  trafficByJobId: Record<string, DrivingTrafficBrief>;
  trafficLoading: boolean;
};

function condensedSummaryLine(
  jobs: JobConditionsJob[],
  weatherByJobId: Record<string, { brief: MoveWeatherBrief; alert: string | null }>,
): string {
  for (const j of jobs) {
    const wx = weatherByJobId[j.id];
    const brief = j.weatherBrief || wx?.brief;
    if (brief?.conditionsSummary) {
      return `${brief.conditionsSummary} · ${brief.tempLowC}–${brief.tempHighC}°C`;
    }
  }
  for (const j of jobs) {
    const wx = weatherByJobId[j.id];
    const a = (j.weatherAlert || wx?.alert || "").trim();
    if (a) {
      return a.length > 72 ? `${a.slice(0, 69).trim()}…` : a;
    }
  }
  return "Per-job weather, routes, and traffic below.";
}

/**
 * Single collapsible strip for the crew day list. Weather and route info no longer sit on each job card.
 */
export default function CrewDashboardConditionsBanner({
  jobs,
  weatherByJobId,
  trafficByJobId,
  trafficLoading,
}: Props) {
  const jobsWithRow = useMemo(
    () => jobs.filter((j) => jobShowsConditionsRow(j, weatherByJobId)),
    [jobs, weatherByJobId],
  );
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (jobsWithRow.length === 0) return null;

  const oneLine = condensedSummaryLine(jobsWithRow, weatherByJobId);

  return (
    <div className="mb-4 w-full min-w-0 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)]/50 bg-[var(--yu3-bg-surface-sunken)]/50 [font-family:var(--font-body)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full min-w-0 items-center gap-2.5 rounded-[var(--yu3-r-lg)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--yu3-wine)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]/30 sm:px-3.5 sm:py-2.5"
      >
        <Cloud
          size={18}
          className="shrink-0 text-[var(--yu3-wine)]/80"
          weight="duotone"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] leading-none">
            Weather and routes
          </p>
          <p
            className={cn(
              "mt-1 text-[12px] font-medium leading-snug text-[var(--yu3-ink)] [font-family:var(--font-body)]",
              !open && "line-clamp-2 sm:line-clamp-1",
            )}
          >
            {oneLine}
            {!open && jobsWithRow.length > 1 ? (
              <span className="text-[var(--yu3-ink-faint)] font-normal">
                {" "}
                · {jobsWithRow.length} jobs
              </span>
            ) : null}
          </p>
        </div>
        <CaretDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--yu3-wine)]/70 transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90",
          )}
          weight="bold"
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        hidden={!open}
        className={cn("border-t border-[var(--yu3-line-subtle)]/40 px-3 pb-3 sm:px-3.5", open ? "pt-3" : undefined)}
      >
        <div className="space-y-4">
          {jobsWithRow.map((job) => (
            <div key={job.id} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-ink-faint)] mb-2 [font-family:var(--font-body)] leading-none">
                {job.clientName} · {job.jobId}
              </p>
              <JobConditionsBody
                job={job}
                weatherByJobId={weatherByJobId}
                trafficByJobId={trafficByJobId}
                trafficLoading={trafficLoading}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
