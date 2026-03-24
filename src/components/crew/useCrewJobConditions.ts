"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";

export type JobConditionsJob = {
  id: string;
  jobId: string;
  clientName: string;
  jobType: "move" | "delivery";
  fromAddress?: string;
  toAddress?: string;
  weatherBrief?: MoveWeatherBrief | null;
  weatherAlert?: string | null;
};

export function routablePair(from?: string, to?: string): boolean {
  const f = from?.trim();
  const t = to?.trim();
  if (!f || !t) return false;
  if (f === "-" || t === "-") return false;
  if (f.length < 4 || t.length < 4) return false;
  return true;
}

export type CrewJobConditionsState = {
  weatherByJobId: Record<string, { brief: MoveWeatherBrief; alert: string | null }>;
  trafficByJobId: Record<string, DrivingTrafficBrief>;
  trafficLoading: boolean;
};

/**
 * Fetches per-job weather and driving/traffic briefs for the crew dashboard (single batch).
 */
export function useCrewJobConditions(jobs: JobConditionsJob[]): CrewJobConditionsState {
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

  const [weatherByJobId, setWeatherByJobId] = useState<
    Record<string, { brief: MoveWeatherBrief; alert: string | null }>
  >({});
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

  return { weatherByJobId, trafficByJobId, trafficLoading };
}

export function jobShowsConditionsRow(
  job: JobConditionsJob,
  weatherByJobId: Record<string, { brief: MoveWeatherBrief; alert: string | null }>,
): boolean {
  const clientWx = weatherByJobId[job.id];
  const hasWx = !!(
    job.weatherBrief ||
    clientWx?.brief ||
    (job.weatherAlert && job.weatherAlert.trim()) ||
    clientWx?.alert
  );
  const canRoute = routablePair(job.fromAddress, job.toAddress);
  return hasWx || canRoute;
}
