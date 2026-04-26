"use client";

import { useId, useState } from "react";
import {
  Car,
  CaretDown,
  CloudRain,
  Drop,
  Thermometer,
  TrafficCone,
  Wind,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";
import type { JobConditionsJob } from "./useCrewJobConditions";
import { jobShowsConditionsRow, routablePair } from "./useCrewJobConditions";
import WineFadeRule from "./WineFadeRule";

type Props = {
  job: JobConditionsJob;
  weatherByJobId: Record<
    string,
    { brief: MoveWeatherBrief; alert: string | null }
  >;
  trafficByJobId: Record<string, DrivingTrafficBrief>;
  trafficLoading: boolean;
  className?: string;
};

export default function JobConditionsInline({
  job,
  weatherByJobId,
  trafficByJobId,
  trafficLoading,
  className = "",
}: Props) {
  if (!jobShowsConditionsRow(job, weatherByJobId)) return null;

  const clientWx = weatherByJobId[job.id];
  const brief = job.weatherBrief || clientWx?.brief || null;
  const wxAlert = job.weatherAlert || clientWx?.alert || null;
  const traffic = trafficByJobId[job.id];
  const canRoute = routablePair(job.fromAddress, job.toAddress);

  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const handleToggleExpanded = () => setExpanded((v) => !v);

  return (
    <div
      className={cn(
        "rounded border border-[var(--yu3-line-subtle)]/40 bg-[var(--yu3-bg-surface)]/35 [font-family:var(--font-body)] transition-[width,max-width,padding]",
        expanded
          ? "w-full min-w-0 px-2 py-1.5 rounded-[var(--yu3-r-md)]"
          : "inline-block w-fit max-w-full self-start rounded-sm px-1.5 py-px",
        className,
      )}
    >
      <button
        type="button"
        onClick={handleToggleExpanded}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          "flex min-h-0 items-center gap-1 rounded-sm text-left leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]/35",
          expanded
            ? "w-full justify-between px-0.5 py-0.5 -mx-0.5 hover:bg-[var(--yu3-wine)]/5"
            : "h-6 px-0.5 -mx-0.5 hover:bg-[var(--yu3-wine)]/5",
        )}
      >
        <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-muted)] flex items-center gap-0.5 [font-family:var(--font-body)] leading-none min-w-0">
          <Car
            size={10}
            className="text-[var(--yu3-wine)]/65 shrink-0"
            weight="duotone"
            aria-hidden
          />
          Route &amp; weather
        </span>
        <CaretDown
          size={10}
          className={cn(
            "shrink-0 text-[var(--yu3-wine)]/60 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          weight="bold"
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        hidden={!expanded}
        className={cn("space-y-2", expanded ? "pt-2" : undefined)}
      >
      {wxAlert && (
        <div className="flex gap-2 rounded-[var(--yu3-r-md)] bg-sky-500/8 border border-sky-500/15 px-2 py-1.5">
          <CloudRain
            size={12}
            className="text-sky-600 shrink-0 mt-0.5"
            weight="duotone"
            aria-hidden
          />
          <p className="text-[10px] text-[var(--yu3-ink-muted)] leading-snug [font-family:var(--font-body)]">
            {wxAlert}
          </p>
        </div>
      )}

      {brief && (
        <div className="space-y-1 text-[10px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
          <p className="uppercase text-[var(--yu3-ink-muted)] font-semibold tracking-wide">
            {brief.conditionsSummary}
          </p>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Thermometer
                size={11}
                className="text-[var(--yu3-warning)]/90"
                aria-hidden
              />
              {brief.tempLowC}°–{brief.tempHighC}°C
            </span>
            {brief.windMaxKmh != null && (
              <span className="inline-flex items-center gap-1 text-[var(--yu3-ink-muted)]">
                <Wind size={11} className="text-[var(--yu3-info)]/80" aria-hidden />
                {brief.windMaxKmh} km/h
              </span>
            )}
            {brief.precipProbabilityMax != null && (
              <span className="inline-flex items-center gap-1 text-[var(--yu3-ink-muted)]">
                <Drop size={11} className="text-sky-600/80" aria-hidden />
                {Math.round(brief.precipProbabilityMax * 100)}% rain
              </span>
            )}
          </div>
          {brief.roadConditionsNote?.trim() && (
            <div className="pt-2 space-y-2">
              <WineFadeRule />
              <p className="text-[10px] text-[var(--yu3-ink-muted)] leading-snug [font-family:var(--font-body)]">
                {brief.roadConditionsNote}
              </p>
            </div>
          )}
        </div>
      )}

      {canRoute && trafficLoading && !traffic && (
        <p className="text-[10px] text-[var(--yu3-ink-muted)] animate-pulse [font-family:var(--font-body)]">
          Checking route traffic…
        </p>
      )}
      {traffic && (
        <div className="flex flex-col gap-2 pt-1">
          <WineFadeRule />
          <div className="flex gap-1.5">
            <TrafficCone
              size={12}
              className="text-[var(--yu3-wine)]/85 shrink-0 mt-0.5"
              weight="duotone"
              aria-hidden
            />
            <div className="text-[10px] text-[var(--yu3-ink-muted)] leading-snug space-y-1 min-w-0 [font-family:var(--font-body)]">
              <p>{traffic.trafficSummaryLine}</p>
              {traffic.closureNotes.length > 0 && (
                <ul className="pl-2.5 list-disc text-[9px] text-[var(--yu3-warning)] space-y-0.5">
                  {traffic.closureNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {canRoute && !trafficLoading && !traffic && (
        <p className="text-[10px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
          Live traffic isn&apos;t available for this route yet.
        </p>
      )}
      </div>
    </div>
  );
}
