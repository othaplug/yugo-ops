"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { KpiStrip, type KpiTile } from "@/design-system/admin/dashboard";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  FileText,
  ArrowRight,
  CurrencyDollar,
} from "@phosphor-icons/react";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);

export interface CrewAnalyticsItem {
  id: string;
  name: string;
  members: string[];
  jobsCompleted: number;
  signOffs: number;
  signOffRate: number;
  avgSatisfaction: number | null;
  avgDuration: number;
}

type Stage = {
  status: string;
  label: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
};

type JobRow = {
  sessionId: string;
  jobId: string;
  jobType: "move" | "delivery";
  date: string | null;
  clientName: string;
  route: string;
  totalDuration: number | null;
  quotedMinutes: number | null;
  onTime: boolean | null;
  rating: number | null;
  tip: number;
  hasSignOff: boolean;
  stages: Stage[];
};

type TrendPoint = {
  week: string;
  weekLabel: string;
  jobs: number;
  avgDuration: number | null;
  avgRating: number | null;
  tips: number;
};

type CrewDetail = {
  crew: { id: string; name: string; members: string[] };
  jobs: JobRow[];
  trends: TrendPoint[];
  summary: {
    totalJobs: number;
    avgRating: number | null;
    onTimeRate: number | null;
    totalTips: number;
  };
  from: string;
  to: string;
};

const RANGE_PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

/**
 * Stage colours — semantic groupings:
 *   slate  → travel        blue → arrived/at-location
 *   amber  → admin         green → active work (load/unload)
 *   wine   → completion    light grey → untracked
 * Hex values are used directly because the design system doesn't define CSS variables for these.
 */
const STAGE_COLORS: Record<string, string> = {
  // Travel
  en_route_to_pickup: "#94a3b8",
  en_route_to_destination: "#94a3b8",
  in_transit: "#94a3b8",
  travel_to_pickup: "#94a3b8",
  en_route: "#94a3b8",
  // At location
  arrived_at_pickup: "#3b82f6",
  arrived_at_destination: "#3b82f6",
  arrived_pickup: "#3b82f6",
  arrived_destination: "#3b82f6",
  arrived: "#3b82f6",
  // Admin / inventory
  inventory_check: "#f59e0b",
  // Active work
  loading: "#2B3927",
  unloading: "#2B3927",
  delivering: "#2B3927",
  // Completion
  walkthrough_photos: "#66143D",
  client_signoff: "#66143D",
  completed: "#66143D",
  // Untracked / gaps
  idle: "#e5e7eb",
  gap: "#e5e7eb",
};

/** Stages considered "untracked" — bars are dimmed, labels italicised. */
const UNTRACKED_STAGES = new Set(["idle", "gap"]);

/** Rename "idle" / "gap" stages to "Untracked" for display. */
function getStageDisplayLabel(status: string, originalLabel: string): string {
  if (status === "idle" || status === "gap") return "Untracked";
  return originalLabel;
}

/** Merge consecutive stages with the same status (e.g. duplicate "At pickup"). */
function mergeAdjacentStages(stages: Stage[]): Stage[] {
  if (!stages.length) return stages;
  const merged: Stage[] = [{ ...stages[0] }];
  for (let i = 1; i < stages.length; i++) {
    const curr = stages[i];
    const last = merged[merged.length - 1];
    const endTs = last.endedAt ? new Date(last.endedAt).getTime() : null;
    const startTs = curr.startedAt ? new Date(curr.startedAt).getTime() : null;
    const consecutive =
      endTs !== null &&
      startTs !== null &&
      Math.abs(startTs - endTs) <= 2 * 60 * 1000; // ≤ 2 min gap
    if (curr.status === last.status && consecutive) {
      merged[merged.length - 1] = {
        ...last,
        endedAt: curr.endedAt,
        duration: (last.duration ?? 0) + (curr.duration ?? 0),
      };
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

/** Efficiency = active work minutes / (active + untracked minutes). */
function calculateEfficiencyScore(stages: Stage[]): {
  score: number;
  activeMinutes: number;
  untrackedMinutes: number;
} {
  const ACTIVE = new Set(["loading", "unloading", "inventory_check", "walkthrough_photos", "client_signoff", "delivering"]);
  const UNTRACKED = new Set(["idle", "gap"]);
  const activeMinutes = stages.filter((s) => ACTIVE.has(s.status)).reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const untrackedMinutes = stages.filter((s) => UNTRACKED.has(s.status)).reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const total = activeMinutes + untrackedMinutes;
  const score = total > 0 ? Math.round((activeMinutes / total) * 100) : 100;
  return { score, activeMinutes, untrackedMinutes };
}

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDuration(mins: number | null) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function CrewAnalyticsClient({
  analytics: initialAnalytics,
  from: initialFrom,
  to: initialTo,
}: {
  analytics: CrewAnalyticsItem[];
  from: string;
  to: string;
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [loading, setLoading] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(initialTo + "T00:00:00");
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [crewDetail, setCrewDetail] = useState<CrewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const fetchData = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crew-analytics?from=${f}&to=${t}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
        setFrom(data.from);
        setTo(data.to);
      }
    } catch {
      /* graceful fail */
    }
    setLoading(false);
  }, []);

  const fetchCrewDetail = useCallback(
    async (crewId: string, f: string, t: string) => {
      setDetailLoading(true);
      setCrewDetail(null);
      try {
        const res = await fetch(
          `/api/admin/crew-analytics/crew?id=${crewId}&from=${f}&to=${t}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          setCrewDetail(data);
        }
      } catch {
        /* graceful fail */
      }
      setDetailLoading(false);
    },
    [],
  );

  const openCrewDetail = useCallback(
    (crewId: string) => {
      setSelectedCrewId(crewId);
      setExpandedJobId(null);
      fetchCrewDetail(crewId, from, to);
    },
    [from, to, fetchCrewDetail],
  );

  const applyPreset = (days: number) => {
    const t = fmtDate(new Date());
    const f = fmtDate(new Date(Date.now() - days * 86400000));
    setFrom(f);
    setTo(t);
    setCalOpen(false);
    fetchData(f, t);
    if (selectedCrewId) fetchCrewDetail(selectedCrewId, f, t);
  };

  const applyCustomRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const f = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const t = rangeStart < rangeEnd ? rangeEnd : rangeStart;
    setFrom(f);
    setTo(t);
    setCalOpen(false);
    fetchData(f, t);
    if (selectedCrewId) fetchCrewDetail(selectedCrewId, f, t);
  };

  const handleDayClick = (dateKey: string) => {
    if (!rangeStart || rangeEnd) {
      setRangeStart(dateKey);
      setRangeEnd(null);
    } else {
      setRangeEnd(dateKey);
    }
  };

  useEffect(() => {
    setAnalytics(initialAnalytics);
  }, [initialAnalytics]);

  const sorted = useMemo(
    () => [...analytics].sort((a, b) => b.jobsCompleted - a.jobsCompleted),
    [analytics],
  );
  const maxJobs = useMemo(
    () => Math.max(...sorted.map((a) => a.jobsCompleted), 1),
    [sorted],
  );

  const totalJobs = sorted.reduce((s, a) => s + a.jobsCompleted, 0);
  const avgSatAll = (() => {
    const ratings = sorted
      .filter((a) => a.avgSatisfaction != null)
      .map((a) => a.avgSatisfaction!);
    return ratings.length > 0
      ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
      : "";
  })();
  const avgSignOff =
    sorted.length > 0
      ? Math.round(
          sorted.reduce((s, a) => s + a.signOffRate, 0) / sorted.length,
        )
      : 0;
  const bestCrew = sorted.length > 0 ? sorted[0] : null;

  const currentPreset = RANGE_PRESETS.find((p) => {
    const expected = fmtDate(new Date(Date.now() - p.days * 86400000));
    return from === expected && to === fmtDate(new Date());
  });

  const calYear = calMonth.getFullYear();
  const calMo = calMonth.getMonth();
  const calLabel = calMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(calYear, calMo, 1).getDay();
  const daysInMonth = new Date(calYear, calMo + 1, 0).getDate();
  const adjFirst = firstDay === 0 ? 6 : firstDay - 1;
  const calCells: (number | null)[] = [];
  for (let i = 0; i < adjFirst; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const isInRange = (dateKey: string) => {
    if (!rangeStart) return false;
    if (!rangeEnd) return dateKey === rangeStart;
    const a = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const b = rangeStart < rangeEnd ? rangeEnd : rangeStart;
    return dateKey >= a && dateKey <= b;
  };

  // If a crew is selected, show the detail view
  if (selectedCrewId) {
    const crewItem = analytics.find((a) => a.id === selectedCrewId);
    return (
      <CrewDetailView
        crewId={selectedCrewId}
        crewItem={crewItem}
        detail={crewDetail}
        loading={detailLoading}
        expandedJobId={expandedJobId}
        setExpandedJobId={setExpandedJobId}
        from={from}
        to={to}
        onBack={() => {
          setSelectedCrewId(null);
          setCrewDetail(null);
        }}
      />
    );
  }

  return (
    <div className="w-full min-w-0 py-5 md:py-6 animate-fade-up">
      {/* Header */}
      <div className="mb-1 flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx2)]/85 mb-1.5 [font-family:var(--font-body)]">
            Operations
          </p>
          <h1 className="admin-page-hero text-[var(--tx)]">Crew Performance</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-1.5 max-w-[640px]">
            Performance trends across crews and individual members.
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="admin-btn admin-btn-secondary self-start sm:mt-0.5"
        >
          <FileText size={14} weight="regular" aria-hidden />
          EOD Reports
          <ArrowRight size={12} weight="bold" aria-hidden />
        </Link>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mt-2 mb-5 font-medium">
        {totalJobs} jobs · {sorted.length} crew{sorted.length !== 1 ? "s" : ""}
        {avgSatAll ? ` · ${avgSatAll}/5 avg satisfaction` : ""}
        {" · "}
        {avgSignOff}% sign-off rate
      </p>

      {/* Date filter */}
      <div className="mb-5 relative">
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                currentPreset?.days === p.days
                  ? "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20"
                  : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]/50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCalOpen(!calOpen)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
              calOpen || !currentPreset
                ? "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20"
                : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]/50"
            }`}
          >
            <CalendarBlank
              size={12}
              weight="regular"
              className="text-current"
            />
            {!currentPreset ? `${fmtLabel(from)}, ${fmtLabel(to)}` : "Custom"}
          </button>
          {loading && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
            </div>
          )}
        </div>

        {calOpen && (
          <div className="absolute left-0 top-full mt-2 z-40 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-xl p-4 w-[300px] sm:w-[340px]">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setCalMonth(new Date(calYear, calMo - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)]"
              >
                <CaretLeft
                  size={16}
                  weight="regular"
                  className="text-current"
                />
              </button>
              <span className="text-[13px] font-semibold text-[var(--tx)]">
                {calLabel}
              </span>
              <button
                type="button"
                onClick={() => setCalMonth(new Date(calYear, calMo + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)]"
              >
                <CaretRight
                  size={16}
                  weight="regular"
                  className="text-current"
                />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold text-[var(--tx3)] py-1"
                >
                  {d}
                </div>
              ))}
              {calCells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const dateKey = `${calYear}-${String(calMo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const inRange = isInRange(dateKey);
                const isStart = dateKey === rangeStart;
                const isEnd = dateKey === rangeEnd;
                const todayKey = fmtDate(new Date());
                const isToday = dateKey === todayKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDayClick(dateKey)}
                    className={`w-full aspect-square rounded-lg text-[12px] font-medium transition-colors ${
                      isStart || isEnd
                        ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]"
                        : inRange
                          ? "bg-[var(--gold)]/15 text-[var(--gold)]"
                          : isToday
                            ? "ring-1 ring-inset ring-[var(--gold)]/50 text-[var(--tx)]"
                            : "text-[var(--tx)] hover:bg-[var(--bg)]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--brd)]">
              <div className="text-[11px] text-[var(--tx3)]">
                {rangeStart ? fmtLabel(rangeStart) : "Start"} →{" "}
                {rangeEnd ? fmtLabel(rangeEnd) : "End"}
              </div>
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={!rangeStart || !rangeEnd}
                className="admin-btn admin-btn-sm admin-btn-primary"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary strip */}
      <div className="border-t border-[var(--brd)]/30 pt-6 mt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx2)]/85 mb-4 [font-family:var(--font-body)]">
          Overview
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCell
            label="Total Jobs"
            value={String(totalJobs)}
            sub={`${sorted.length} crews`}
          />
          <SummaryCell
            label="Satisfaction"
            value={avgSatAll || "No data"}
            sub={avgSatAll ? "/5 avg" : ""}
          />
          <SummaryCell label="Sign-off Rate" value={`${avgSignOff}%`} />
          <SummaryCell
            label="Top Performer"
            value={bestCrew?.name || "No data"}
            sub={bestCrew ? `${bestCrew.jobsCompleted} jobs` : ""}
          />
        </div>
      </div>

      {/* Crew comparison table */}
      {sorted.length === 0 && !loading ? (
        <div className="border-t border-[var(--brd)]/30 pt-6 mt-6 py-16 text-center">
          <p className="text-[13px] text-[var(--tx3)]">
            No crew activity in this period
          </p>
          <p className="text-[11px] text-[var(--tx3)] mt-1">
            Try a different date range.
          </p>
        </div>
      ) : (
        <div className="border-t border-[var(--brd)]/30 pt-6 mt-6">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx2)]/85 mb-4 [font-family:var(--font-body)]">
            Crew Comparison
          </div>
          {/* Same grid as rows: rank column + crew + four metrics + chevron */}
          <div
            className="hidden sm:grid grid-cols-[1.75rem_minmax(0,1fr)_5rem_5rem_5rem_5rem_1.5rem] gap-x-3 items-end px-4 py-2 text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--tx3)]/60 [font-family:var(--font-body)]"
            role="row"
          >
            {/* Must stay in normal flow — sr-only is position:absolute and breaks grid alignment */}
            <span aria-hidden className="block min-h-[1px] w-full" />
            <span className="min-w-0">Crew</span>
            <span className="text-right tabular-nums">Jobs</span>
            <span className="text-right">Satisfaction</span>
            <span className="text-right">Sign-off</span>
            <span className="text-right">Avg Time</span>
            <span aria-hidden className="block min-h-[1px] w-full" />
          </div>
          <div>
            {sorted.map((a, rank) => {
              const barW = maxJobs > 0 ? (a.jobsCompleted / maxJobs) * 100 : 0;
              const satColor =
                a.avgSatisfaction != null
                  ? a.avgSatisfaction >= 4.5
                    ? "var(--grn)"
                    : a.avgSatisfaction >= 3.5
                      ? "var(--org)"
                      : "var(--red)"
                  : "var(--tx3)";
              const isTopPerformer = rank === 0 && a.jobsCompleted > 0;

              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openCrewDetail(a.id)}
                  className={`group w-full text-left flex sm:grid sm:grid-cols-[1.75rem_minmax(0,1fr)_5rem_5rem_5rem_5rem_1.5rem] sm:gap-x-3 sm:gap-y-2 sm:items-start items-center gap-3 py-3.5 px-4 -mx-1 transition-all hover:bg-[var(--gdim)] cursor-pointer rounded-xl ${rank > 0 ? "border-t border-[var(--brd)]/20" : ""}`}
                >
                  {/* Rank badge — column 1, spans both rows on desktop */}
                  <div
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold sm:row-span-2 sm:self-start sm:pt-0.5 ${
                      isTopPerformer
                        ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]"
                        : "bg-[var(--brd)]/25 text-[var(--tx2)]"
                    }`}
                  >
                    #{rank + 1}
                  </div>

                  {/* Crew block: name + progress; column/stack on mobile, grid cells on sm+ */}
                  <div className="min-w-0 flex-1 flex flex-col gap-2 sm:contents">
                    <div className="min-w-0 sm:col-start-2 sm:row-start-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold text-[var(--tx)] group-hover:text-[var(--admin-primary-fill)] transition-colors truncate max-w-full">
                          {a.name}
                        </span>
                        {isTopPerformer && (
                          <span className="shrink-0 dt-badge tracking-[0.04em] text-[var(--admin-primary-fill)]">
                            TOP
                          </span>
                        )}
                        {a.members.length > 0 && (
                          <span className="text-[10px] text-[var(--tx3)] truncate hidden sm:inline basis-full sm:basis-auto">
                            {a.members.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full min-w-0 sm:col-start-2 sm:col-end-7 sm:row-start-2 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary-fill)] transition-all duration-500"
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats — desktop, columns 3–6, row 1 */}
                  <span className="hidden sm:block sm:col-start-3 sm:row-start-1 text-right text-[12px] font-bold text-[var(--tx)] tabular-nums self-center">
                    {a.jobsCompleted}
                  </span>
                  <span
                    className="hidden sm:block sm:col-start-4 sm:row-start-1 text-right text-[12px] font-semibold tabular-nums self-center"
                    style={{ color: satColor }}
                  >
                    {a.avgSatisfaction != null ? `${a.avgSatisfaction}/5` : ""}
                  </span>
                  <span
                    className={`hidden sm:block sm:col-start-5 sm:row-start-1 text-right text-[12px] font-semibold tabular-nums self-center ${a.signOffRate >= 80 ? "text-[var(--grn)]" : "text-[var(--tx2)]"}`}
                  >
                    {a.signOffRate}%
                  </span>
                  <span className="hidden sm:block sm:col-start-6 sm:row-start-1 text-right text-[12px] text-[var(--tx3)] tabular-nums self-center">
                    {a.avgDuration > 0 ? `${a.avgDuration}m` : ""}
                  </span>

                  {/* Chevron — column 7, spans rows */}
                  <CaretRight
                    weight="regular"
                    className="hidden sm:block sm:col-start-7 sm:row-span-2 sm:self-center shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity justify-self-end"
                    aria-hidden
                  />

                  {/* Stats - mobile */}
                  <div className="sm:hidden flex flex-col items-end gap-0.5 text-right text-[11px] shrink-0">
                    <span className="font-bold text-[var(--tx)]">
                      {a.jobsCompleted} jobs
                    </span>
                    <span style={{ color: satColor }}>
                      {a.avgSatisfaction != null
                        ? `${a.avgSatisfaction}/5`
                        : ""}
                    </span>
                  </div>

                  <CaretRight
                    weight="regular"
                    className="sm:hidden shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Crew Detail View ─────────────────────────────────────────────────────────

function CrewDetailView({
  crewId,
  crewItem,
  detail,
  loading,
  expandedJobId,
  setExpandedJobId,
  from,
  to,
  onBack,
}: {
  crewId: string;
  crewItem: CrewAnalyticsItem | undefined;
  detail: CrewDetail | null;
  loading: boolean;
  expandedJobId: string | null;
  setExpandedJobId: (id: string | null) => void;
  from: string;
  to: string;
  onBack: () => void;
}) {
  const [activeChart, setActiveChart] = useState<
    "duration" | "rating" | "jobs"
  >("jobs");
  const name = detail?.crew.name || crewItem?.name || "Crew";

  const kpiTiles = useMemo((): KpiTile[] => {
    if (!detail) return [];
    const s = detail.summary;
    const r = s.avgRating;
    const satValue = r != null ? `${r}/5` : "N/A";
    const satValueClass =
      r == null
        ? "text-[var(--yu3-ink-faint)]"
        : r >= 4.5
          ? "text-[var(--yu3-forest)]"
          : r >= 3.5
            ? "text-[var(--yu3-warning)]"
            : "text-[var(--yu3-danger)]";

    const otr = s.onTimeRate;
    const otrValue = otr != null ? `${otr}%` : "N/A";
    const otrValueClass =
      otr == null
        ? "text-[var(--yu3-ink-faint)]"
        : otr >= 80
          ? "text-[var(--yu3-success)]"
          : "text-[var(--yu3-warning)]";

    const tipsValue =
      s.totalTips > 0
        ? `$${s.totalTips.toLocaleString()}`
        : "$0";
    const tipsValueClass =
      s.totalTips > 0
        ? "text-[var(--yu3-forest)]"
        : "text-[var(--yu3-ink-muted)]";

    return [
      {
        id: "jobs",
        label: "Jobs completed",
        value: String(s.totalJobs),
        valueClassName: "text-[var(--yu3-ink-strong)]",
      },
      {
        id: "satisfaction",
        label: "Avg satisfaction",
        value: satValue,
        valueClassName: satValueClass,
      },
      {
        id: "ontime",
        label: "On-time rate",
        value: otrValue,
        valueClassName: otrValueClass,
      },
      {
        id: "tips",
        label: "Total tips",
        value: tipsValue,
        valueClassName: tipsValueClass,
      },
    ];
  }, [detail]);

  return (
    <div className="w-full min-w-0 py-5 md:py-6 animate-fade-up">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
        >
          <CaretLeft size={14} weight="regular" className="text-current" />
          All Crews
        </button>
        <span className="text-[var(--brd)]">/</span>
        <span className="text-[12px] font-bold text-[var(--tx)]">{name}</span>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
          <p className="text-[12px] text-[var(--tx3)]">Loading crew data…</p>
        </div>
      )}

      {!loading && detail && (
        <>
          {/* Crew header */}
          <div className="flex flex-wrap items-start gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="admin-page-hero text-[var(--tx)]">{name}</h1>
              {detail.crew.members.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detail.crew.members.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--brd)]/50 text-[11px] font-medium text-[var(--tx2)]"
                    >
                      <div className="w-4 h-4 rounded-md border border-[var(--brd)] flex items-center justify-center text-[9px] font-bold text-[var(--tx)]">
                        {m.charAt(0).toUpperCase()}
                      </div>
                      {m}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[var(--tx3)] mt-2">
                {fmtLabel(from)}, {fmtLabel(to)}
              </p>
            </div>
          </div>

          <KpiStrip
            variant="grid"
            columns={4}
            tiles={kpiTiles}
            className="mb-8 sm:grid-cols-4 md:grid-cols-4"
            gridCardClassName="border-0"
          />

          {/* Performance Charts */}
          {detail.trends.length > 1 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
                  Performance Trends
                </div>
                <div className="flex gap-1">
                  {(["jobs", "duration", "rating"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setActiveChart(c)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                        activeChart === c
                          ? "bg-[var(--gold)]/10 text-[var(--gold)]"
                          : "text-[var(--tx3)] hover:text-[var(--tx)]"
                      }`}
                    >
                      {c === "jobs"
                        ? "Jobs"
                        : c === "duration"
                          ? "Avg Time"
                          : "Rating"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-sm p-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === "jobs" ? (
                    <LineChart
                      data={detail.trends}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="weekLabel"
                        tick={{ fontSize: 10, fill: "var(--tx3)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--tx3)" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--brd)",
                          borderRadius: 6,
                          fontSize: 11,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        }}
                        labelStyle={{
                          color: "var(--tx)",
                          fontWeight: 600,
                          fontFamily: "var(--font-body)",
                        }}
                        formatter={(v) => [String(v ?? ""), "Jobs"]}
                        itemStyle={{ color: "var(--tx)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="jobs"
                        stroke="var(--tx)"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                          fill: "var(--tx)",
                        }}
                        connectNulls
                      />
                    </LineChart>
                  ) : activeChart === "duration" ? (
                    <LineChart
                      data={detail.trends}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="weekLabel"
                        tick={{ fontSize: 10, fill: "var(--tx3)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--tx3)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--brd)",
                          borderRadius: 6,
                          fontSize: 11,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        }}
                        labelStyle={{
                          color: "var(--tx)",
                          fontWeight: 600,
                          fontFamily: "var(--font-body)",
                        }}
                        formatter={(v) => [
                          `${v != null ? `${v} min` : ""}`,
                          "Avg Duration",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgDuration"
                        stroke="var(--tx)"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                          fill: "var(--tx)",
                        }}
                        connectNulls
                      />
                    </LineChart>
                  ) : (
                    <LineChart
                      data={detail.trends}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="weekLabel"
                        tick={{ fontSize: 10, fill: "var(--tx3)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 5]}
                        tick={{ fontSize: 10, fill: "var(--tx3)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--brd)",
                          borderRadius: 6,
                          fontSize: 11,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        }}
                        labelStyle={{
                          color: "var(--tx)",
                          fontWeight: 600,
                          fontFamily: "var(--font-body)",
                        }}
                        formatter={(v) => [
                          `${v != null ? `${v}/5` : ""}`,
                          "Avg Rating",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgRating"
                        stroke="var(--tx)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--tx)" }}
                        connectNulls
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Job History Table */}
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx2)]/85 mb-4 [font-family:var(--font-body)]">
              Job History, {detail.jobs.length} job
              {detail.jobs.length !== 1 ? "s" : ""}
            </div>

            {detail.jobs.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[var(--tx3)]">
                No completed jobs in this period.
              </div>
            ) : (
              <>
                {/* Table header - desktop */}
                <div className="hidden md:grid grid-cols-[100px_1fr_120px_70px_70px_60px_32px] gap-2 px-4 py-2 text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--tx3)]/60">
                  <span>Date</span>
                  <span>Client / Route</span>
                  <span>Type</span>
                  <span className="text-right">Time</span>
                  <span className="text-center">On Time</span>
                  <span className="text-center">Rating</span>
                  <span />
                </div>

                <div>
                  {detail.jobs.map((job, idx) => {
                    const isExpanded = expandedJobId === job.sessionId;
                    const onTimeColor =
                      job.onTime === true
                        ? "var(--grn)"
                        : job.onTime === false
                          ? "var(--red)"
                          : "var(--tx3)";
                    const satColor =
                      job.rating != null
                        ? job.rating >= 4.5
                          ? "var(--grn)"
                          : job.rating >= 3.5
                            ? "var(--org)"
                            : "var(--red)"
                        : "var(--tx3)";

                    return (
                      <div
                        key={job.sessionId}
                        className={`border-[var(--brd)]/20 ${idx > 0 ? "border-t" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedJobId(isExpanded ? null : job.sessionId)
                          }
                          className="group w-full text-left"
                        >
                          {/* Mobile layout */}
                          <div className="md:hidden py-3.5 px-4 -mx-1 hover:bg-[var(--brd)]/5 rounded-xl transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-[var(--tx3)]">
                                {job.date
                                  ? new Date(
                                      job.date + "T00:00:00",
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : ""}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="dt-badge tracking-[0.04em] text-[var(--tx3)]">
                                  {job.jobType === "move" ? "Move" : "Delivery"}
                                </span>
                                {job.onTime != null && (
                                  <span
                                    className="text-[10px] font-bold"
                                    style={{ color: onTimeColor }}
                                  >
                                    {job.onTime ? "✓" : "Late"}
                                  </span>
                                )}
                                {job.rating != null && (
                                  <span
                                    className="text-[10px] font-bold"
                                    style={{ color: satColor }}
                                  >
                                    ★ {job.rating}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[13px] font-semibold text-[var(--tx)] truncate">
                              {job.clientName}
                            </p>
                            <p className="text-[11px] text-[var(--tx3)] truncate mt-0.5">
                              {job.route}
                            </p>
                          </div>

                          {/* Desktop layout */}
                          <div className="hidden md:grid grid-cols-[100px_1fr_120px_70px_70px_60px_32px] gap-2 items-center py-3.5 px-4 -mx-1 hover:bg-[var(--brd)]/5 rounded-xl transition-colors">
                            <span className="text-[12px] text-[var(--tx3)]">
                              {job.date
                                ? new Date(
                                    job.date + "T00:00:00",
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : ""}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[var(--tx)] truncate">
                                {job.clientName}
                              </p>
                              <p className="text-[11px] text-[var(--tx3)] truncate">
                                {job.route}
                              </p>
                            </div>
                            <span className="text-[11px] font-medium text-[var(--tx2)]">
                              {job.jobType === "move" ? "Move" : "Delivery"}
                            </span>
                            <TimeWithEstimate
                              actual={job.totalDuration}
                              estimated={job.quotedMinutes}
                            />
                            <span
                              className="text-center text-[13px] font-bold"
                              style={{ color: onTimeColor }}
                            >
                              {job.onTime === true
                                ? "✓"
                                : job.onTime === false
                                  ? "✗"
                                  : ""}
                            </span>
                            <span
                              className="text-center text-[12px] font-semibold"
                              style={{ color: satColor }}
                            >
                              {job.rating != null ? `${job.rating}/5` : ""}
                            </span>
                            <CaretRight
                              weight="regular"
                              className={`w-4 h-4 text-[var(--tx3)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              aria-hidden
                            />
                          </div>
                        </button>

                        {/* Expanded time breakdown */}
                        {isExpanded && (
                          <div className="pb-4 px-4 -mx-1">
                            <div className="bg-[var(--bg)] rounded-xl p-4 mt-1">
                              <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/60 mb-3">
                                Time Breakdown
                              </div>
                              {job.stages.length === 0 ? (
                                <p className="text-[12px] text-[var(--tx3)]">
                                  No stage data available.
                                </p>
                              ) : (
                                (() => {
                                  const mergedStages = mergeAdjacentStages(job.stages);
                                  const safeTotalDur = Math.max(
                                    mergedStages.reduce((sum, s) => sum + (s.duration ?? 0), 0),
                                    1,
                                  );
                                  const efficiency = calculateEfficiencyScore(mergedStages);
                                  const hasUntracked = efficiency.untrackedMinutes > 0;
                                  return (
                                    <div className="space-y-2">
                                      {mergedStages.map((stage, si) => {
                                        const isUntracked = UNTRACKED_STAGES.has(stage.status);
                                        const stageColor = STAGE_COLORS[stage.status] || "#94a3b8";
                                        const durationMin = stage.duration ?? 0;
                                        const barPct =
                                          durationMin > 0
                                            ? Math.max(2, Math.min(100, (durationMin / safeTotalDur) * 100))
                                            : 0;
                                        const displayLabel = getStageDisplayLabel(stage.status, stage.label);
                                        return (
                                          <div
                                            key={si}
                                            className="flex items-center gap-3"
                                          >
                                            <div
                                              className="w-2 h-2 rounded-full shrink-0"
                                              style={{ backgroundColor: stageColor, opacity: isUntracked ? 0.5 : 1 }}
                                            />
                                            <div className="w-28 shrink-0">
                                              <p className={`text-[11px] font-medium truncate ${isUntracked ? "italic text-[var(--tx3)]" : "text-[var(--tx2)]"}`}>
                                                {displayLabel}
                                              </p>
                                              <p className="text-[9px] text-[var(--tx3)]">
                                                {fmtTime(stage.startedAt)}
                                                {stage.endedAt
                                                  ? ` → ${fmtTime(stage.endedAt)}`
                                                  : ""}
                                              </p>
                                            </div>
                                            <div className="flex-1 h-2 rounded-full bg-[var(--brd)]/40 overflow-hidden">
                                              {barPct > 0 && (
                                                <div
                                                  className="h-full rounded-full transition-all"
                                                  style={{
                                                    width: `${barPct}%`,
                                                    backgroundColor: stageColor,
                                                    opacity: isUntracked ? 0.4 : 1,
                                                  }}
                                                />
                                              )}
                                            </div>
                                            <span className={`w-12 text-right text-[11px] font-semibold tabular-nums shrink-0 ${isUntracked ? "text-[var(--tx3)]" : "text-[var(--tx)]"}`}>
                                              {fmtDuration(durationMin)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                      <div className="flex items-center justify-between pt-2 border-t border-[var(--brd)]/30 mt-3">
                                        <span className="text-[11px] font-bold text-[var(--tx3)] uppercase tracking-wide">
                                          Total
                                        </span>
                                        <span className="text-[13px] font-bold text-[var(--tx)]">
                                          {fmtDuration(job.totalDuration)}
                                        </span>
                                      </div>
                                      {/* Untracked time note */}
                                      {hasUntracked && (
                                        <div className="mt-2 p-2.5 bg-[var(--org)]/10 border border-[var(--org)]/25 rounded-lg text-[11px] text-[var(--tx2)]">
                                          <span className="font-semibold">Untracked time detected.</span>{" "}
                                          Stage transitions may have been missed — likely loading or unloading that happened while the app sat on a previous stage.
                                          {efficiency.score < 70 && efficiency.untrackedMinutes > 30 && (
                                            <span className="block mt-1 text-[var(--tx3)]">
                                              {efficiency.untrackedMinutes}m untracked · {efficiency.score}% tracked efficiency. Consider reviewing with crew lead.
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              )}

                              {/* Sign-off / tip info */}
                              {(job.hasSignOff || job.tip > 0) && (
                                <div className="flex gap-3 mt-4 pt-3 border-t border-[var(--brd)]/30">
                                  {job.hasSignOff && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--grn)] font-medium">
                                      <Check
                                        size={12}
                                        className="text-current"
                                        weight="bold"
                                      />
                                      Client signed off
                                    </div>
                                  )}
                                  {job.tip > 0 && (
                                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--tx2)]">
                                      <CurrencyDollar
                                        size={14}
                                        className="text-[var(--grn)] shrink-0"
                                        weight="regular"
                                        aria-hidden
                                      />
                                      ${job.tip} tip
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function TimeWithEstimate({
  actual,
  estimated,
}: {
  actual: number | null;
  estimated: number | null;
}) {
  if (!estimated || estimated <= 0) {
    return (
      <span className="text-right text-[12px] font-semibold text-[var(--tx)] tabular-nums">
        {fmtDuration(actual)}
      </span>
    );
  }
  const ratio = (actual ?? 0) / estimated;
  const color =
    ratio <= 1.0
      ? "var(--grn)"
      : ratio <= 1.15
        ? "var(--org)"
        : "var(--red)";
  return (
    <span className="text-right tabular-nums">
      <span className="block text-[12px] font-semibold" style={{ color }}>
        {fmtDuration(actual)}
      </span>
      <span className="block text-[10px] font-normal text-[var(--tx3)]">
        of {fmtDuration(estimated)}
      </span>
    </span>
  );
}

function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="py-3">
      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">
        {label}
      </div>
      <div className="text-[22px] sm:text-[26px] font-bold text-[var(--tx)] leading-tight truncate">
        {value}
        {sub && (
          <span className="text-[11px] font-normal text-[var(--tx3)] ml-1">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

