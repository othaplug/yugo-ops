"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CalendarBlank, CaretLeft, CaretRight, Check, FileText, ArrowRight } from "@phosphor-icons/react";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });

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

const STAGE_COLORS: Record<string, string> = {
  en_route_to_pickup: "#3B82F6",
  arrived_at_pickup: "#8B5CF6",
  loading: "#F59E0B",
  en_route_to_destination: "#06B6D4",
  arrived_at_destination: "#10B981",
  unloading: "#F97316",
  completed: "#22C55E",
  en_route: "#3B82F6",
  arrived: "#8B5CF6",
  delivering: "#F97316",
};

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
  if (mins == null) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
      const res = await fetch(`/api/admin/crew-analytics?from=${f}&to=${t}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
        setFrom(data.from);
        setTo(data.to);
      }
    } catch { /* graceful fail */ }
    setLoading(false);
  }, []);

  const fetchCrewDetail = useCallback(async (crewId: string, f: string, t: string) => {
    setDetailLoading(true);
    setCrewDetail(null);
    try {
      const res = await fetch(`/api/admin/crew-analytics/crew?id=${crewId}&from=${f}&to=${t}`);
      if (res.ok) {
        const data = await res.json();
        setCrewDetail(data);
      }
    } catch { /* graceful fail */ }
    setDetailLoading(false);
  }, []);

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

  const sorted = useMemo(() => [...analytics].sort((a, b) => b.jobsCompleted - a.jobsCompleted), [analytics]);
  const maxJobs = useMemo(() => Math.max(...sorted.map((a) => a.jobsCompleted), 1), [sorted]);

  const totalJobs = sorted.reduce((s, a) => s + a.jobsCompleted, 0);
  const avgSatAll = (() => {
    const ratings = sorted.filter((a) => a.avgSatisfaction != null).map((a) => a.avgSatisfaction!);
    return ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : "-";
  })();
  const avgSignOff =
    sorted.length > 0 ? Math.round(sorted.reduce((s, a) => s + a.signOffRate, 0) / sorted.length) : 0;
  const bestCrew = sorted.length > 0 ? sorted[0] : null;

  const currentPreset = RANGE_PRESETS.find((p) => {
    const expected = fmtDate(new Date(Date.now() - p.days * 86400000));
    return from === expected && to === fmtDate(new Date());
  });

  const calYear = calMonth.getFullYear();
  const calMo = calMonth.getMonth();
  const calLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
    <div className="max-w-[960px] mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] capitalize text-[var(--tx3)]/60 mb-1.5">Operations</p>
          <h1 className="font-hero text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">
            Crew Performance
          </h1>
        </div>
        <Link
          href="/admin/reports"
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--brd)]/60 bg-[var(--card)]/60 hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5 transition-all duration-200 mt-0.5"
        >
          <FileText size={13} weight="duotone" className="text-[var(--gold)] shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold text-[var(--tx2)] group-hover:text-[var(--gold)] transition-colors whitespace-nowrap">
            EOD Reports
          </span>
          <ArrowRight size={11} weight="bold" className="text-[var(--tx3)] group-hover:text-[var(--gold)] group-hover:translate-x-0.5 transition-all duration-200 shrink-0" aria-hidden />
        </Link>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mt-2 mb-5 font-medium">
        {totalJobs} jobs · {sorted.length} crew{sorted.length !== 1 ? "s" : ""}
        {avgSatAll !== "-" ? ` · ${avgSatAll}/5 avg satisfaction` : ""}
        {" · "}{avgSignOff}% sign-off rate
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
            <CalendarBlank size={12} weight="regular" className="text-current" />
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
                <CaretLeft size={16} weight="regular" className="text-current" />
              </button>
              <span className="text-[13px] font-semibold text-[var(--tx)]">{calLabel}</span>
              <button
                type="button"
                onClick={() => setCalMonth(new Date(calYear, calMo + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)]"
              >
                <CaretRight size={16} weight="regular" className="text-current" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-[var(--tx3)] py-1">
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
                        ? "bg-[var(--gold)] text-white"
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
                {rangeStart ? fmtLabel(rangeStart) : "Start"} → {rangeEnd ? fmtLabel(rangeEnd) : "End"}
              </div>
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={!rangeStart || !rangeEnd}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-white hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary strip */}
      <div className="border-t border-[var(--brd)]/30 pt-6 mt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-4">Overview</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCell label="Total Jobs" value={String(totalJobs)} sub={`${sorted.length} crews`} />
          <SummaryCell label="Satisfaction" value={avgSatAll} sub="/5 avg" accent />
          <SummaryCell label="Sign-off Rate" value={`${avgSignOff}%`} />
          <SummaryCell label="Top Performer" value={bestCrew?.name || "-"} sub={bestCrew ? `${bestCrew.jobsCompleted} jobs` : ""} accent />
        </div>
      </div>

      {/* Crew comparison table */}
      {sorted.length === 0 && !loading ? (
        <div className="border-t border-[var(--brd)]/30 pt-6 mt-6 py-16 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No crew activity in this period</p>
          <p className="text-[11px] text-[var(--tx3)] mt-1">Try a different date range.</p>
        </div>
      ) : (
        <div className="border-t border-[var(--brd)]/30 pt-6 mt-6">
          <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-4">
            Crew Comparison
          </div>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_80px_32px] gap-2 px-4 py-2 text-[10px] font-bold tracking-[0.1em] capitalize text-[var(--tx3)]/60">
            <span>Crew</span>
            <span className="text-right">Jobs</span>
            <span className="text-right">Satisfaction</span>
            <span className="text-right">Sign-off</span>
            <span className="text-right">Avg Time</span>
            <span />
          </div>
          <div>
            {sorted.map((a, rank) => {
              const barW = maxJobs > 0 ? (a.jobsCompleted / maxJobs) * 100 : 0;
              const satColor =
                a.avgSatisfaction != null
                  ? a.avgSatisfaction >= 4.5
                    ? "var(--grn)"
                    : a.avgSatisfaction >= 3.5
                      ? "var(--gold)"
                      : "var(--red)"
                  : "var(--tx3)";
              const isTopPerformer = rank === 0 && a.jobsCompleted > 0;

              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openCrewDetail(a.id)}
                  className={`group w-full text-left flex items-center gap-3 py-3.5 px-4 -mx-1 transition-all hover:bg-[var(--gdim)] cursor-pointer rounded-xl ${rank > 0 ? "border-t border-[var(--brd)]/20" : ""}`}
                >
                  {/* Rank badge */}
                  <div
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                      isTopPerformer
                        ? "bg-[var(--gold)] text-white"
                        : "bg-[var(--gold)]/10 text-[var(--gold)]"
                    }`}
                  >
                    #{rank + 1}
                  </div>

                  {/* Info + progress bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[var(--text-base)] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors truncate">
                        {a.name}
                      </span>
                      {isTopPerformer && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
                          TOP
                        </span>
                      )}
                      {a.members.length > 0 && (
                        <span className="text-[10px] text-[var(--tx3)] truncate hidden sm:inline">
                          {a.members.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats - desktop */}
                  <div className="hidden sm:flex items-center gap-6 text-right text-[12px]">
                    <span className="w-[80px] font-bold text-[var(--tx)] tabular-nums">{a.jobsCompleted}</span>
                    <span className="w-[80px] font-semibold tabular-nums" style={{ color: satColor }}>
                      {a.avgSatisfaction != null ? `${a.avgSatisfaction}/5` : "-"}
                    </span>
                    <span className={`w-[80px] font-semibold tabular-nums ${a.signOffRate >= 80 ? "text-[var(--grn)]" : "text-[var(--tx2)]"}`}>
                      {a.signOffRate}%
                    </span>
                    <span className="w-[80px] text-[var(--tx3)] tabular-nums">
                      {a.avgDuration > 0 ? `${a.avgDuration}m` : "-"}
                    </span>
                  </div>

                  {/* Stats - mobile */}
                  <div className="sm:hidden flex flex-col items-end gap-0.5 text-right text-[11px]">
                    <span className="font-bold text-[var(--tx)]">{a.jobsCompleted} jobs</span>
                    <span style={{ color: satColor }}>{a.avgSatisfaction != null ? `${a.avgSatisfaction}/5` : "-"}</span>
                  </div>

                  <CaretRight weight="regular" className="shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
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
  const [activeChart, setActiveChart] = useState<"duration" | "rating" | "jobs">("jobs");
  const name = detail?.crew.name || crewItem?.name || "Crew";

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
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
              <h1 className="font-hero text-[24px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight">
                {name}
              </h1>
              {detail.crew.members.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detail.crew.members.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--brd)]/50 text-[11px] font-medium text-[var(--tx2)]"
                    >
                      <div className="w-4 h-4 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--gold)]">
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

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <KpiCard
              label="Jobs Completed"
              value={String(detail.summary.totalJobs)}
              color="var(--gold)"
            />
            <KpiCard
              label="Avg Satisfaction"
              value={detail.summary.avgRating != null ? `${detail.summary.avgRating}/5` : "-"}
              color={
                detail.summary.avgRating != null
                  ? detail.summary.avgRating >= 4.5
                    ? "var(--grn)"
                    : detail.summary.avgRating >= 3.5
                      ? "var(--gold)"
                      : "var(--red)"
                  : "var(--tx3)"
              }
            />
            <KpiCard
              label="On-Time Rate"
              value={detail.summary.onTimeRate != null ? `${detail.summary.onTimeRate}%` : "-"}
              color={
                detail.summary.onTimeRate != null
                  ? detail.summary.onTimeRate >= 80
                    ? "var(--grn)"
                    : detail.summary.onTimeRate >= 60
                      ? "var(--gold)"
                      : "var(--red)"
                  : "var(--tx3)"
              }
            />
            <KpiCard
              label="Total Tips"
              value={
                detail.summary.totalTips > 0
                  ? `$${detail.summary.totalTips.toLocaleString()}`
                  : "-"
              }
              color="var(--grn)"
            />
          </div>

          {/* Performance Charts */}
          {detail.trends.length > 1 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50">
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
                      {c === "jobs" ? "Jobs" : c === "duration" ? "Avg Time" : "Rating"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === "jobs" ? (
                    <BarChart data={detail.trends} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          background: "#1E1E1E",
                          border: "1px solid #2A2A2A",
                          borderRadius: 8,
                          fontSize: 11,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        }}
                        labelStyle={{ color: "#E5E5E5", fontWeight: 600 }}
                        itemStyle={{ color: "var(--gold)" }}
                        cursor={{ fill: "rgba(191,168,109,0.12)" }}
                      />
                      <Bar dataKey="jobs" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : activeChart === "duration" ? (
                    <LineChart data={detail.trends} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          background: "#1E1E1E",
                          border: "1px solid #2A2A2A",
                          borderRadius: 8,
                          fontSize: 11,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        }}
                        labelStyle={{ color: "#E5E5E5", fontWeight: 600 }}
                        formatter={(v) => [`${v != null ? `${v} min` : "-"}`, "Avg Duration"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgDuration"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#3B82F6" }}
                        connectNulls
                      />
                    </LineChart>
                  ) : (
                    <LineChart data={detail.trends} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          background: "#1E1E1E",
                          border: "1px solid #2A2A2A",
                          borderRadius: 8,
                          fontSize: 11,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        }}
                        labelStyle={{ color: "#E5E5E5", fontWeight: 600 }}
                        formatter={(v) => [`${v != null ? `${v}/5` : "-"}`, "Avg Rating"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgRating"
                        stroke="var(--grn)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--grn)" }}
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
            <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-4">
              Job History, {detail.jobs.length} job{detail.jobs.length !== 1 ? "s" : ""}
            </div>

            {detail.jobs.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[var(--tx3)]">No completed jobs in this period.</div>
            ) : (
              <>
                {/* Table header - desktop */}
                <div className="hidden md:grid grid-cols-[100px_1fr_120px_70px_70px_60px_32px] gap-2 px-4 py-2 text-[10px] font-bold tracking-[0.1em] capitalize text-[var(--tx3)]/60">
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
                            ? "var(--gold)"
                            : "var(--red)"
                        : "var(--tx3)";

                    return (
                      <div
                        key={job.sessionId}
                        className={`border-[var(--brd)]/20 ${idx > 0 ? "border-t" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedJobId(isExpanded ? null : job.sessionId)}
                          className="group w-full text-left"
                        >
                          {/* Mobile layout */}
                          <div className="md:hidden py-3.5 px-4 -mx-1 hover:bg-[var(--brd)]/5 rounded-xl transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-[var(--tx3)]">
                                {job.date ? new Date(job.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--tx3)] font-medium">
                                  {job.jobType === "move" ? "Move" : "Delivery"}
                                </span>
                                {job.onTime != null && (
                                  <span className="text-[10px] font-bold" style={{ color: onTimeColor }}>
                                    {job.onTime ? "✓" : "Late"}
                                  </span>
                                )}
                                {job.rating != null && (
                                  <span className="text-[10px] font-bold" style={{ color: satColor }}>
                                    ★ {job.rating}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-[13px] font-semibold text-[var(--tx)] truncate">{job.clientName}</p>
                            <p className="text-[11px] text-[var(--tx3)] truncate mt-0.5">{job.route}</p>
                          </div>

                          {/* Desktop layout */}
                          <div className="hidden md:grid grid-cols-[100px_1fr_120px_70px_70px_60px_32px] gap-2 items-center py-3.5 px-4 -mx-1 hover:bg-[var(--brd)]/5 rounded-xl transition-colors">
                            <span className="text-[12px] text-[var(--tx3)]">
                              {job.date
                                ? new Date(job.date + "T00:00:00").toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "-"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[var(--tx)] truncate">{job.clientName}</p>
                              <p className="text-[11px] text-[var(--tx3)] truncate">{job.route}</p>
                            </div>
                            <span className="text-[11px] font-medium text-[var(--tx2)]">
                              {job.jobType === "move" ? "Move" : "Delivery"}
                            </span>
                            <span className="text-right text-[12px] font-semibold text-[var(--tx)] tabular-nums">
                              {fmtDuration(job.totalDuration)}
                              {job.quotedMinutes != null && (
                                <span className="block text-[10px] font-normal text-[var(--tx3)]">
                                  of {fmtDuration(job.quotedMinutes)}
                                </span>
                              )}
                            </span>
                            <span className="text-center text-[13px] font-bold" style={{ color: onTimeColor }}>
                              {job.onTime === true ? "✓" : job.onTime === false ? "✗" : "-"}
                            </span>
                            <span className="text-center text-[12px] font-semibold" style={{ color: satColor }}>
                              {job.rating != null ? `${job.rating}/5` : "-"}
                            </span>
                            <CaretRight weight="regular" className={`w-4 h-4 text-[var(--tx3)] transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden />
                          </div>
                        </button>

                        {/* Expanded time breakdown */}
                        {isExpanded && (
                          <div className="pb-4 px-4 -mx-1">
                            <div className="bg-[var(--bg)] rounded-xl p-4 mt-1">
                              <div className="text-[10px] font-bold tracking-[0.12em] capitalize text-[var(--tx3)]/60 mb-3">
                                Time Breakdown
                              </div>
                              {job.stages.length === 0 ? (
                                <p className="text-[12px] text-[var(--tx3)]">No stage data available.</p>
                              ) : (
                                <div className="space-y-2">
                                  {job.stages.map((stage, si) => {
                                    const stageColor = STAGE_COLORS[stage.status] || "#6B7280";
                                    const maxDur = Math.max(...job.stages.map((s) => s.duration || 0), 1);
                                    const barPct = stage.duration != null ? (stage.duration / maxDur) * 100 : 0;
                                    return (
                                      <div key={si} className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
                                        <div className="w-28 shrink-0">
                                          <p className="text-[11px] font-medium text-[var(--tx2)] truncate">{stage.label}</p>
                                          <p className="text-[9px] text-[var(--tx3)]">
                                            {fmtTime(stage.startedAt)}
                                            {stage.endedAt ? ` → ${fmtTime(stage.endedAt)}` : ""}
                                          </p>
                                        </div>
                                        <div className="flex-1 h-1.5 rounded-full bg-[var(--brd)] overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${barPct}%`, backgroundColor: stageColor }}
                                          />
                                        </div>
                                        <span className="w-12 text-right text-[11px] font-semibold text-[var(--tx)] tabular-nums shrink-0">
                                          {fmtDuration(stage.duration)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  <div className="flex items-center justify-between pt-2 border-t border-[var(--brd)]/30 mt-3">
                                    <span className="text-[11px] font-bold text-[var(--tx3)] capitalize tracking-wide">Total</span>
                                    <span className="text-[13px] font-bold text-[var(--tx)]">
                                      {fmtDuration(job.totalDuration)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Sign-off / tip info */}
                              {(job.hasSignOff || job.tip > 0) && (
                                <div className="flex gap-3 mt-4 pt-3 border-t border-[var(--brd)]/30">
                                  {job.hasSignOff && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--grn)] font-medium">
                                      <Check size={12} className="text-current" weight="bold" />
                                      Client signed off
                                    </div>
                                  )}
                                  {job.tip > 0 && (
                                    <div className="text-[11px] font-medium text-[var(--tx2)]">
                                      💵 ${job.tip} tip
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

function SummaryCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="py-3">
      <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-0.5">{label}</div>
      <div className={`text-[22px] sm:text-[26px] font-bold ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"} leading-tight truncate`}>
        {value}
        {sub && <span className="text-[11px] font-normal text-[var(--tx3)] ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4">
      <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-1">{label}</div>
      <div className="text-[22px] font-bold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
