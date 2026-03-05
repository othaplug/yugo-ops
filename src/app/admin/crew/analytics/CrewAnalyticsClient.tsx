"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";

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

const RANGE_PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const [selectedTeam, setSelectedTeam] = useState<CrewAnalyticsItem | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(initialTo + "T00:00:00");
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

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

  const applyPreset = (days: number) => {
    const t = fmtDate(new Date());
    const f = fmtDate(new Date(Date.now() - days * 86400000));
    setFrom(f);
    setTo(t);
    setCalOpen(false);
    fetchData(f, t);
  };

  const applyCustomRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const f = rangeStart < rangeEnd ? rangeStart : rangeEnd;
    const t = rangeStart < rangeEnd ? rangeEnd : rangeStart;
    setFrom(f);
    setTo(t);
    setCalOpen(false);
    fetchData(f, t);
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
    return ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : "—";
  })();
  const avgSignOff = sorted.length > 0 ? Math.round(sorted.reduce((s, a) => s + a.signOffRate, 0) / sorted.length) : 0;
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

  const summaryParts = [
    `${totalJobs} jobs`,
    `${sorted.length} crew${sorted.length !== 1 ? "s" : ""}`,
    avgSatAll !== "—" ? `${avgSatAll}/5 avg satisfaction` : null,
    `${avgSignOff}% sign-off rate`,
  ].filter(Boolean);

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-heading text-[24px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight">Crew Performance</h1>
        <Link href="/admin/crew" className="text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          Live Tracking
        </Link>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mb-5 font-medium">{summaryParts.join(" \u00b7 ")}</p>

      {/* Date filter bar */}
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {!currentPreset ? `${fmtLabel(from)} \u2014 ${fmtLabel(to)}` : "Custom"}
          </button>
          {loading && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
            </div>
          )}
        </div>

        {/* Calendar dropdown */}
        {calOpen && (
          <div className="absolute left-0 top-full mt-2 z-40 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-xl p-4 w-[300px] sm:w-[340px]">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setCalMonth(new Date(calYear, calMo - 1, 1))} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-[13px] font-semibold text-[var(--tx)]">{calLabel}</span>
              <button type="button" onClick={() => setCalMonth(new Date(calYear, calMo + 1, 1))} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-[var(--tx3)] py-1">{d}</div>
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
                {rangeStart ? fmtLabel(rangeStart) : "Start"} \u2192 {rangeEnd ? fmtLabel(rangeEnd) : "End"}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCell label="Total Jobs" value={String(totalJobs)} sub={`${sorted.length} crew${sorted.length !== 1 ? "s" : ""}`} />
        <SummaryCell label="Satisfaction" value={avgSatAll} sub="/5 avg" accent />
        <SummaryCell label="Sign-off Rate" value={`${avgSignOff}%`} />
        <SummaryCell label="Top Performer" value={bestCrew?.name || "\u2014"} sub={bestCrew ? `${bestCrew.jobsCompleted} jobs` : ""} accent />
      </div>

      {/* Crew list */}
      {sorted.length === 0 && !loading ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No crew activity in this period</p>
          <p className="text-[11px] text-[var(--tx3)] mt-1">Try a different date range.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((a, rank) => {
            const barW = maxJobs > 0 ? (a.jobsCompleted / maxJobs) * 100 : 0;
            const satColor = a.avgSatisfaction != null
              ? a.avgSatisfaction >= 4.5 ? "var(--grn)" : a.avgSatisfaction >= 3.5 ? "var(--gold)" : "var(--red)"
              : "var(--tx3)";

            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedTeam(a)}
                className="group w-full text-left flex items-start gap-3 py-3.5 px-4 -mx-1 rounded-xl hover:bg-[var(--card)]/60 transition-all"
              >
                {/* Rank */}
                <div className="shrink-0 w-7 h-7 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[11px] font-bold text-[var(--gold)] mt-0.5">
                  #{rank + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{a.name}</span>
                    {a.members.length > 0 && (
                      <span className="text-[10px] text-[var(--tx3)] truncate hidden sm:inline">{a.members.join(", ")}</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--gold)] transition-all duration-500" style={{ width: `${barW}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums shrink-0">{a.jobsCompleted} jobs</span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: satColor }} />
                      <span className="text-[var(--tx2)]">{a.avgSatisfaction != null ? `${a.avgSatisfaction}/5` : "\u2014"}</span>
                    </span>
                    <span className="text-[var(--tx3)]">{a.signOffRate}% sign-off</span>
                    <span className="text-[var(--tx3)]">{a.avgDuration > 0 ? `${a.avgDuration}m avg` : "\u2014"}</span>
                  </div>
                </div>

                <svg className="shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity mt-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            );
          })}
        </div>
      )}

      {/* Team detail modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={() => setSelectedTeam(null)} role="dialog" aria-modal="true">
          <div
            className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle for mobile sheet */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--brd)]" />
            </div>

            <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between">
              <div>
                <h2 className="font-heading text-[18px] font-bold text-[var(--tx)]">{selectedTeam.name}</h2>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">{fmtLabel(from)} \u2014 {fmtLabel(to)}</p>
              </div>
              <button type="button" onClick={() => setSelectedTeam(null)} className="p-2 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)]" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {selectedTeam.members.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-2">Team Members</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTeam.members.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg)] text-[12px] font-medium text-[var(--tx)]">
                        <div className="w-5 h-5 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--gold)]">
                          {m.charAt(0).toUpperCase()}
                        </div>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Jobs completed" value={String(selectedTeam.jobsCompleted)} />
                <StatCard label="Sign-off rate" value={`${selectedTeam.signOffRate}%`} accent={selectedTeam.signOffRate >= 80} />
                <StatCard label="Avg satisfaction" value={selectedTeam.avgSatisfaction != null ? `${selectedTeam.avgSatisfaction}/5` : "\u2014"} accent={selectedTeam.avgSatisfaction != null && selectedTeam.avgSatisfaction >= 4} />
                <StatCard label="Avg job time" value={selectedTeam.avgDuration > 0 ? `${selectedTeam.avgDuration} min` : "\u2014"} />
              </div>

              {/* Performance bars */}
              <div className="space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)]">Performance</div>
                <MetricBar label="Satisfaction" value={selectedTeam.avgSatisfaction != null ? (selectedTeam.avgSatisfaction / 5) * 100 : 0} color="var(--grn)" />
                <MetricBar label="Sign-offs" value={selectedTeam.signOffRate} color="var(--gold)" />
                <MetricBar label="Efficiency" value={selectedTeam.avgDuration > 0 ? Math.min(100, Math.max(0, 100 - (selectedTeam.avgDuration - 30))) : 50} color="#3B82F6" />
              </div>

              <p className="text-[12px] text-[var(--tx3)]">
                {selectedTeam.signOffs} of {selectedTeam.jobsCompleted} job{selectedTeam.jobsCompleted !== 1 ? "s" : ""} received client sign-off.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="py-3">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">{label}</div>
      <div className={`text-[22px] sm:text-[26px] font-bold ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"} leading-tight truncate`}>
        {value}
        {sub && <span className="text-[11px] font-normal text-[var(--tx3)] ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">{label}</div>
      <div className={`text-[20px] font-bold ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"}`}>{value}</div>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-[var(--tx3)] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--brd)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold text-[var(--tx)] w-10 text-right tabular-nums">{Math.round(value)}%</span>
    </div>
  );
}
