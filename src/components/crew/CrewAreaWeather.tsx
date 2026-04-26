"use client";

import { useEffect, useState } from "react";
import {
  CloudSun,
  Drop,
  Thermometer,
  Wind,
  CloudRain,
  CaretDown,
} from "@phosphor-icons/react";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import WineFadeRule from "./WineFadeRule";

type AreaPayload = {
  brief: MoveWeatherBrief;
  alert: string | null;
  label: string;
};

/**
 * Shown on the crew dashboard when there are no jobs today — uses service-area
 * forecast from `/api/crew/weather` (`areaWeather`).
 */
export default function CrewAreaWeather() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AreaPayload | null>(null);
  const [open, setOpen] = useState(false);

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

  const shellClass =
    "rounded-2xl bg-[#FFFBF7] shadow-[0_2px_22px_rgba(44,62,45,0.07)] overflow-hidden border border-[var(--brd)]/20";

  if (loading) {
    return (
      <div className={`${shellClass} px-4 py-3 animate-pulse`}>
        <div className="h-3 w-28 rounded bg-[var(--brd)]/40 mb-2" />
        <div className="h-4 w-full max-w-xs rounded bg-[var(--brd)]/25" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={shellClass}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full min-h-[44px] px-3 sm:px-4 py-2 flex flex-nowrap items-center justify-between gap-2 text-left hover:bg-[#2C3E2D]/4 transition-colors touch-manipulation"
          aria-expanded={open}
          aria-controls="crew-area-weather-empty"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CloudSun
              size={20}
              className="shrink-0 text-[#5C1A33]"
              weight="duotone"
              aria-hidden
            />
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] [font-family:var(--font-body)] leading-none">
              Today&apos;s outlook
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--tx3)] [font-family:var(--font-body)]">
              Unavailable
            </span>
          </div>
          <CaretDown
            size={18}
            weight="bold"
            className={`shrink-0 text-[var(--tx3)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {open && (
          <div id="crew-area-weather-empty" className="px-4 pb-4 pt-0">
            <div className="px-0 pb-3">
              <WineFadeRule />
            </div>
            <p className="text-[14px] text-[var(--tx2)] leading-relaxed">
              Forecast isn&apos;t available right now. When you have jobs on the
              schedule, you&apos;ll see conditions for each stop here too.
            </p>
          </div>
        )}
      </div>
    );
  }

  const { brief, alert, label } = data;
  const oneLine = `${label} · ${brief.tempLowC}° to ${brief.tempHighC}°C`;

  return (
    <div className={shellClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] px-3 sm:px-4 py-2 flex flex-nowrap items-center justify-between gap-2 text-left hover:bg-[#2C3E2D]/4 transition-colors touch-manipulation"
        aria-expanded={open}
        aria-controls="crew-area-weather-body"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CloudSun
            size={20}
            className="shrink-0 text-[#5C1A33]"
            weight="duotone"
            aria-hidden
          />
          <span className="shrink-0 text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] [font-family:var(--font-body)] leading-none">
            Outlook
          </span>
          <span
            className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--tx)] [font-family:var(--font-body)]"
            title={oneLine}
          >
            {oneLine}
          </span>
        </div>
        <CaretDown
          size={18}
          weight="bold"
          className={`shrink-0 text-[var(--tx3)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <>
          <div className="px-4 pb-1">
            <WineFadeRule />
          </div>
          <div id="crew-area-weather-body" className="px-4 py-3 pt-2">
            {alert && (
              <div className="mb-3 flex gap-2 rounded-lg bg-sky-500/10 px-2.5 py-1.5">
                <CloudRain
                  size={16}
                  className="text-sky-400 shrink-0 mt-0.5"
                  weight="duotone"
                  aria-hidden
                />
                <p className="text-[14px] text-[var(--tx2)] leading-snug">
                  {alert}
                </p>
              </div>
            )}
            <p className="text-[14px] font-semibold text-[var(--tx)] mb-2 [font-family:var(--font-body)]">
              {brief.conditionsSummary}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[14px] text-[var(--tx2)]">
              <span className="inline-flex items-center gap-1">
                <Thermometer size={14} className="text-[var(--tx2)]" aria-hidden />
                {brief.tempLowC}° to {brief.tempHighC}°C
                {brief.feelsLikeAvgC != null && (
                  <span className="text-[var(--tx3)]">
                    ~{brief.feelsLikeAvgC}° feels
                  </span>
                )}
              </span>
              {brief.windMaxKmh != null && (
                <span className="inline-flex items-center gap-1">
                  <Wind size={14} className="text-[var(--tx2)]" aria-hidden />
                  {brief.windMaxKmh} km/h
                  {brief.windGustMaxKmh != null &&
                  brief.windGustMaxKmh > brief.windMaxKmh
                    ? ` · gusts ${brief.windGustMaxKmh}`
                    : ""}
                </span>
              )}
              {brief.precipProbabilityMax != null && (
                <span className="inline-flex items-center gap-1 text-[var(--tx3)]">
                  <Drop size={14} className="text-[#5C1A33]/55" aria-hidden />
                  {Math.round(brief.precipProbabilityMax * 100)}% rain chance
                </span>
              )}
            </div>
            {brief.roadConditionsNote && (
              <div className="mt-3 pt-3 space-y-2">
                <WineFadeRule />
                <p className="text-[14px] leading-relaxed text-[var(--tx2)]">
                  {brief.roadConditionsNote}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
