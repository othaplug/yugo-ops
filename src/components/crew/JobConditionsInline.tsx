"use client";

import { Car, CloudRain, Drop, Thermometer, TrafficCone, Wind } from "@phosphor-icons/react";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";
import type { JobConditionsJob } from "./useCrewJobConditions";
import { jobShowsConditionsRow, routablePair } from "./useCrewJobConditions";
import WineFadeRule from "./WineFadeRule";

type Props = {
  job: JobConditionsJob;
  weatherByJobId: Record<string, { brief: MoveWeatherBrief; alert: string | null }>;
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

  return (
    <div className={`rounded-xl bg-[var(--bg)]/25 px-2 py-2 sm:px-2.5 sm:py-2.5 space-y-2 ${className}`}>
      <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/55 flex items-center gap-1.5">
        <Car size={12} className="text-[var(--gold)]/90 shrink-0" weight="duotone" aria-hidden />
        Route &amp; weather
      </p>

      {wxAlert && (
        <div className="flex gap-2 rounded-lg bg-sky-500/10 px-2 py-1.5">
          <CloudRain size={12} className="text-sky-400 shrink-0 mt-0.5" weight="duotone" aria-hidden />
          <p className="text-[10px] text-[var(--tx2)] leading-snug">{wxAlert}</p>
        </div>
      )}

      {brief && (
        <div className="space-y-1 text-[10px] text-[var(--tx2)]">
          <p className="uppercase text-[var(--tx3)]">{brief.conditionsSummary}</p>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Thermometer size={11} className="text-orange-300/85" aria-hidden />
              {brief.tempLowC}°–{brief.tempHighC}°C
            </span>
            {brief.windMaxKmh != null && (
              <span className="inline-flex items-center gap-1 text-[var(--tx3)]">
                <Wind size={11} className="text-sky-300/75" aria-hidden />
                {brief.windMaxKmh} km/h
              </span>
            )}
            {brief.precipProbabilityMax != null && (
              <span className="inline-flex items-center gap-1 text-[var(--tx3)]">
                <Drop size={11} className="text-sky-400/65" aria-hidden />
                {Math.round(brief.precipProbabilityMax * 100)}% rain
              </span>
            )}
          </div>
          {brief.roadConditionsNote?.trim() && (
            <div className="pt-2 space-y-2">
              <WineFadeRule />
              <p className="text-[10px] text-[var(--tx3)] leading-snug">{brief.roadConditionsNote}</p>
            </div>
          )}
        </div>
      )}

      {canRoute && trafficLoading && !traffic && (
        <p className="text-[10px] text-[var(--tx3)] animate-pulse">Checking route traffic…</p>
      )}
      {traffic && (
        <div className="flex flex-col gap-2 pt-1">
          <WineFadeRule />
          <div className="flex gap-1.5">
          <TrafficCone size={12} className="text-[var(--gold)]/90 shrink-0 mt-0.5" weight="duotone" aria-hidden />
          <div className="text-[10px] text-[var(--tx2)] leading-snug space-y-1 min-w-0">
            <p>{traffic.trafficSummaryLine}</p>
            {traffic.closureNotes.length > 0 && (
              <ul className="pl-2.5 list-disc text-[9px] text-amber-200/85 space-y-0.5">
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
        <p className="text-[10px] text-[var(--tx3)]">Live traffic isn&apos;t available for this route yet.</p>
      )}
    </div>
  );
}
