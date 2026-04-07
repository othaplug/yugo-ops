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
      <div className={`${shellClass} px-4 py-4 animate-pulse`}>
        <div className="h-3 w-28 rounded bg-[var(--brd)]/40 mb-3" />
        <div className="h-4 w-full rounded bg-[var(--brd)]/25" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={shellClass}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full px-4 py-3.5 flex items-center justify-between gap-2 text-left hover:bg-[#2C3E2D]/4 transition-colors ${open ? "rounded-t-2xl" : "rounded-2xl"}`}
          aria-expanded={open}
          aria-controls="crew-area-weather-empty"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CloudSun size={18} className="text-[#5C1A33] shrink-0" weight="duotone" aria-hidden />
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] [font-family:var(--font-body)]">
              Today&apos;s outlook
            </span>
          </div>
          <CaretDown
            size={16}
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
            <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
              Forecast isn&apos;t available right now. When you have jobs on the
              schedule, you&apos;ll see conditions for each stop here too.
            </p>
          </div>
        )}
      </div>
    );
  }

  const { brief, alert, label } = data;

  return (
    <div className={shellClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-4 py-3.5 flex items-center justify-between gap-2 text-left hover:bg-[#2C3E2D]/4 transition-colors ${open ? "rounded-t-2xl" : "rounded-2xl"}`}
        aria-expanded={open}
        aria-controls="crew-area-weather-body"
      >
        <div className="flex items-center gap-2 min-w-0">
          <CloudSun size={18} className="text-[#5C1A33] shrink-0" weight="duotone" aria-hidden />
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] truncate [font-family:var(--font-body)]">
            Today&apos;s outlook
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <span
            className="text-[10px] font-medium text-[var(--tx3)] truncate max-w-[120px] sm:max-w-[140px]"
            title={label}
          >
            {label}
          </span>
          <CaretDown
            size={16}
            weight="bold"
            className={`shrink-0 text-[var(--tx3)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </div>
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
                  size={14}
                  className="text-sky-400 shrink-0 mt-0.5"
                  weight="duotone"
                  aria-hidden
                />
                <p className="text-[10px] text-[var(--tx2)] leading-snug">
                  {alert}
                </p>
              </div>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--tx)] mb-2 [font-family:var(--font-body)]">
              {brief.conditionsSummary}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-[var(--tx2)]">
              <span className="inline-flex items-center gap-1">
                <Thermometer size={12} className="text-[var(--tx2)]" aria-hidden />
                {brief.tempLowC}°–{brief.tempHighC}°C
                {brief.feelsLikeAvgC != null && (
                  <span className="text-[var(--tx3)]">
                    ~{brief.feelsLikeAvgC}° feels
                  </span>
                )}
              </span>
              {brief.windMaxKmh != null && (
                <span className="inline-flex items-center gap-1">
                  <Wind size={12} className="text-[var(--tx2)]" aria-hidden />
                  {brief.windMaxKmh} km/h
                  {brief.windGustMaxKmh != null &&
                  brief.windGustMaxKmh > brief.windMaxKmh
                    ? ` · gusts ${brief.windGustMaxKmh}`
                    : ""}
                </span>
              )}
              {brief.precipProbabilityMax != null && (
                <span className="inline-flex items-center gap-1 text-[var(--tx3)]">
                  <Drop size={12} className="text-[#5C1A33]/55" aria-hidden />
                  {Math.round(brief.precipProbabilityMax * 100)}% rain chance
                </span>
              )}
            </div>
            {brief.roadConditionsNote && (
              <div className="mt-3 pt-3 space-y-2">
                <WineFadeRule />
                <p className="text-[10px] leading-snug text-[var(--tx2)]">
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
