"use client";

import { useEffect, useState } from "react";
import { CloudSun, Drop, Thermometer, Wind, CloudRain } from "@phosphor-icons/react";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import WineFadeRule from "./WineFadeRule";

type AreaPayload = { brief: MoveWeatherBrief; alert: string | null; label: string };

/**
 * Shown on the crew dashboard when there are no jobs today — uses service-area
 * forecast from `/api/crew/weather` (`areaWeather`).
 */
export default function CrewAreaWeather() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AreaPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crew/weather")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("weather"))))
      .then((d: { areaWeather?: AreaPayload | null }) => {
        if (!cancelled && d.areaWeather?.brief) setData(d.areaWeather);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-[var(--bg)]/30 px-4 py-3 animate-pulse">
        <div className="h-3 w-28 rounded bg-[var(--brd)]/50 mb-3" />
        <div className="h-4 w-full rounded bg-[var(--brd)]/30" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-[var(--bg)]/30 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <CloudSun size={18} className="text-[var(--gold)]" weight="duotone" aria-hidden />
          <p className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/70">Today&apos;s outlook</p>
        </div>
        <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
          Forecast isn&apos;t available right now. When you have jobs on the schedule, you&apos;ll see conditions for each stop here too.
        </p>
      </div>
    );
  }

  const { brief, alert, label } = data;

  return (
    <div className="rounded-2xl bg-[var(--bg)]/30 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CloudSun size={18} className="text-[var(--gold)] shrink-0" weight="duotone" aria-hidden />
          <p className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/70 truncate">Today&apos;s outlook</p>
        </div>
        <span className="text-[9px] font-medium text-[var(--tx3)] truncate max-w-[140px]" title={label}>
          {label}
        </span>
      </div>
      <div className="px-4 pb-1">
        <WineFadeRule />
      </div>
      <div className="px-4 py-3 pt-2">
        {alert && (
          <div className="mb-3 flex gap-2 rounded-lg bg-sky-500/10 px-2.5 py-1.5">
            <CloudRain size={14} className="text-sky-400 shrink-0 mt-0.5" weight="duotone" aria-hidden />
            <p className="text-[10px] text-[var(--tx2)] leading-snug">{alert}</p>
          </div>
        )}
        <p className="capitalize text-[11px] text-[var(--tx3)] mb-2">{brief.conditionsSummary}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[var(--tx2)]">
          <span className="inline-flex items-center gap-1">
            <Thermometer size={12} className="text-orange-300/90" aria-hidden />
            {brief.tempLowC}°–{brief.tempHighC}°C
            {brief.feelsLikeAvgC != null && (
              <span className="text-[var(--tx3)]">~{brief.feelsLikeAvgC}° feels</span>
            )}
          </span>
          {brief.windMaxKmh != null && (
            <span className="inline-flex items-center gap-1">
              <Wind size={12} className="text-sky-300/80" aria-hidden />
              {brief.windMaxKmh} km/h
              {brief.windGustMaxKmh != null && brief.windGustMaxKmh > brief.windMaxKmh
                ? ` · gusts ${brief.windGustMaxKmh}`
                : ""}
            </span>
          )}
          {brief.precipProbabilityMax != null && (
            <span className="inline-flex items-center gap-1 text-[var(--tx3)]">
              <Drop size={12} className="text-sky-400/70" aria-hidden />
              {Math.round(brief.precipProbabilityMax * 100)}% rain chance
            </span>
          )}
        </div>
        {brief.roadConditionsNote && (
          <div className="mt-3 pt-3 space-y-2">
            <WineFadeRule />
            <p className="text-[10px] leading-snug text-[var(--tx2)]">{brief.roadConditionsNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
