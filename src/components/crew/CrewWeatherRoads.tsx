"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Thermometer, Wind, Car, CloudRain, Drop, TrafficCone } from "@phosphor-icons/react";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";

type JobWx = {
  id: string;
  jobId: string;
  clientName: string;
  jobType: "move" | "delivery";
  fromAddress?: string;
  toAddress?: string;
  weatherBrief?: MoveWeatherBrief | null;
  weatherAlert?: string | null;
};

function routablePair(from?: string, to?: string): boolean {
  const f = from?.trim();
  const t = to?.trim();
  if (!f || !t) return false;
  if (f === "—" || t === "—") return false;
  if (f.length < 4 || t.length < 4) return false;
  return true;
}

export default function CrewWeatherRoads({ jobs }: { jobs: JobWx[] }) {
  const [trafficByJobId, setTrafficByJobId] = useState<Record<string, DrivingTrafficBrief>>({});
  const [trafficLoading, setTrafficLoading] = useState(false);
  const fetchedKeyRef = useRef<string>("");

  const fetchKey = useMemo(() => {
    return jobs
      .filter((j) => routablePair(j.fromAddress, j.toAddress))
      .map((j) => j.id)
      .sort()
      .join("|");
  }, [jobs]);

  const [weatherByJobId, setWeatherByJobId] = useState<Record<string, { brief: MoveWeatherBrief; alert: string | null }>>({});
  const weatherFetchedRef = useRef<string>("");

  const jobsKey = useMemo(() => jobs.map((j) => j.id).sort().join("|"), [jobs]);

  useEffect(() => {
    if (!fetchKey) {
      setTrafficByJobId({});
      return;
    }
    if (fetchedKeyRef.current === fetchKey) return;
    fetchedKeyRef.current = fetchKey;
    let cancelled = false;
    setTrafficLoading(true);
    fetch("/api/crew/driving-conditions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("traffic"))))
      .then((d: { traffic?: Record<string, DrivingTrafficBrief> }) => {
        if (!cancelled) setTrafficByJobId(d.traffic || {});
      })
      .catch(() => {
        if (!cancelled) setTrafficByJobId({});
      })
      .finally(() => {
        if (!cancelled) setTrafficLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  useEffect(() => {
    if (!jobsKey || weatherFetchedRef.current === jobsKey) return;
    weatherFetchedRef.current = jobsKey;
    let cancelled = false;
    fetch("/api/crew/weather")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("weather"))))
      .then((d: { weather?: Record<string, { brief: MoveWeatherBrief; alert: string | null }> }) => {
        if (!cancelled) setWeatherByJobId(d.weather || {});
      })
      .catch(() => {
        if (!cancelled) setWeatherByJobId({});
      });
    return () => {
      cancelled = true;
    };
  }, [jobsKey]);

  const rows = useMemo(() => {
    const candidates = jobs.filter((j) => {
      const clientWx = weatherByJobId[j.id];
      const hasWx = !!(j.weatherBrief || clientWx?.brief || (j.weatherAlert && j.weatherAlert.trim()) || clientWx?.alert);
      const canRoute = routablePair(j.fromAddress, j.toAddress);
      return hasWx || canRoute;
    });
    const seen = new Set<string>();
    return candidates.filter((j) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });
  }, [jobs, weatherByJobId]);

  const showEmpty = rows.length === 0;

  if (showEmpty) {
    return (
      <div className="rounded-2xl border border-[var(--brd)]/40 bg-[var(--bg)]/40 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Car size={16} className="text-[var(--gold)]" weight="duotone" aria-hidden />
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/70">Weather &amp; Route Conditions</p>
        </div>
        <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
          Forecasts and route conditions appear when jobs have pickup addresses — ensure a street address is set for the best intel.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--brd)]/40 bg-[var(--bg)]/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--brd)]/30 flex items-center gap-2">
        <Car size={16} className="text-[var(--gold)]" weight="duotone" aria-hidden />
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/70">Weather &amp; Route Conditions</p>
      </div>
      <ul className="divide-y divide-[var(--brd)]/25">
        {rows.map((j) => {
          const traffic = trafficByJobId[j.id];
          const clientWx = weatherByJobId[j.id];
          const brief = j.weatherBrief || clientWx?.brief || null;
          const wxAlert = j.weatherAlert || clientWx?.alert || null;
          return (
            <li key={j.id} className="px-4 py-3">
              <div className="text-[11px] font-semibold text-[var(--tx)] truncate">{j.clientName}</div>
              <div className="text-[9px] font-mono text-[var(--tx3)] mt-0.5">{j.jobId}</div>
              {wxAlert && (
                <div className="mt-2 flex gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5">
                  <CloudRain size={14} className="text-sky-400 shrink-0 mt-0.5" weight="duotone" aria-hidden />
                  <p className="text-[10px] text-[var(--tx2)] leading-snug">{wxAlert}</p>
                </div>
              )}
              {brief && (
                <div className="mt-2 space-y-1.5 text-[10px] text-[var(--tx2)]">
                  <p className="capitalize text-[var(--tx3)]">{brief.conditionsSummary}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
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
                  <div className="flex gap-1.5 pt-1 border-t border-[var(--brd)]/20">
                    <Car size={12} className="text-[var(--gold)] shrink-0 mt-0.5" weight="duotone" aria-hidden />
                    <p className="text-[10px] leading-snug text-[var(--tx2)]">{brief.roadConditionsNote}</p>
                  </div>
                </div>
              )}
              {routablePair(j.fromAddress, j.toAddress) && trafficLoading && !traffic && (
                <div className="mt-2 text-[10px] text-[var(--tx3)]">Checking route conditions…</div>
              )}
              {traffic && (
                <div className={`mt-2 flex gap-1.5 ${j.weatherBrief || j.weatherAlert ? "pt-2 border-t border-[var(--brd)]/20" : ""}`}>
                  <TrafficCone size={12} className="text-[var(--gold)] shrink-0 mt-0.5" weight="duotone" aria-hidden />
                  <div className="text-[10px] text-[var(--tx2)] leading-snug space-y-1">
                    <p>{traffic.trafficSummaryLine}</p>
                    {traffic.closureNotes.length > 0 && (
                      <ul className="pl-3 list-disc text-[9px] text-amber-200/90 space-y-0.5">
                        {traffic.closureNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {routablePair(j.fromAddress, j.toAddress) && !trafficLoading && !traffic && (
                <div className="mt-2 text-[10px] text-[var(--tx3)]">Route conditions not available for this job.</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
