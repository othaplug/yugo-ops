"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";

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
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
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

  return (
    <div className="max-w-[960px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      {/* Top nav */}
      <div className="mb-4 flex items-center justify-between">
        <BackButton label="Back" />
        <Link href="/admin/crew" className="text-[12px] text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          Live Tracking
        </Link>
      </div>

      <h1 className="font-hero text-[24px] font-bold text-[var(--tx)] mb-1">Crew Performance</h1>
      <p className="text-[13px] text-[var(--tx3)] mb-5">
        Satisfaction, sign-off rate, and average job duration by crew.
      </p>

      {/* Date filter bar */}
      <div className="mb-6 relative">
        <div className="flex flex-wrap items-center gap-2 p-1 bg-[var(--bg)] border border-[var(--brd)] rounded-xl">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                currentPreset?.days === p.days
                  ? "bg-[var(--gold)] text-white shadow-sm"
                  : "text-[var(--tx3)] hover:bg-[var(--card)] hover:text-[var(--tx)]"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCalOpen(!calOpen)}
            className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-colors flex items-center gap-1.5 ${
              calOpen || !currentPreset
                ? "bg-[var(--gold)] text-white shadow-sm"
                : "text-[var(--tx3)] hover:bg-[var(--card)] hover:text-[var(--tx)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {!currentPreset ? `${fmtLabel(from)} — ${fmtLabel(to)}` : "Custom"}
          </button>
          {loading && (
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--tx3)]">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
              Loading…
            </div>
          )}
        </div>

        {/* Calendar dropdown */}
        {calOpen && (
          <div className="absolute left-0 top-full mt-2 z-40 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-xl p-4 w-[340px]">
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-1">Total Jobs</div>
          <div className="text-[26px] font-bold text-[var(--tx)] font-hero">{totalJobs}</div>
          <div className="text-[10px] text-[var(--tx3)] mt-0.5">{sorted.length} crew{sorted.length !== 1 ? "s" : ""} active</div>
        </div>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-1">Avg Satisfaction</div>
          <div className="text-[26px] font-bold text-[var(--tx)] font-hero">{avgSatAll}<span className="text-[14px] text-[var(--tx3)]">/5</span></div>
        </div>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-1">Avg Sign-off</div>
          <div className="text-[26px] font-bold text-[var(--tx)] font-hero">{avgSignOff}%</div>
        </div>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-1">Top Performer</div>
          <div className="text-[16px] font-bold text-[var(--gold)] font-hero truncate">{bestCrew?.name || "—"}</div>
          <div className="text-[10px] text-[var(--tx3)] mt-0.5">{bestCrew ? `${bestCrew.jobsCompleted} jobs` : ""}</div>
        </div>
      </div>

      {/* Crew cards */}
      <div className="space-y-3">
        {sorted.map((a, rank) => {
          const barW = maxJobs > 0 ? (a.jobsCompleted / maxJobs) * 100 : 0;
          const satColor = a.avgSatisfaction != null
            ? a.avgSatisfaction >= 4.5 ? "#2D9F5A" : a.avgSatisfaction >= 3.5 ? "#C9A962" : "#D14343"
            : "#888";

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedTeam(a)}
              className="w-full text-left rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 hover:border-[var(--gold)]/50 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--gold)]">
                    #{rank + 1}
                  </div>
                  <div>
                    <h2 className="font-hero text-[15px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{a.name}</h2>
                    {a.members.length > 0 && (
                      <p className="text-[11px] text-[var(--tx3)] mt-0.5">{a.members.join(", ")}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[var(--tx3)] group-hover:text-[var(--gold)] transition-colors">
                  <span className="text-[11px] font-medium">Details</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>

              {/* Job count bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-1">
                  <span>Jobs completed</span>
                  <span className="text-[var(--tx)]">{a.jobsCompleted}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--gold)] transition-all duration-500" style={{ width: `${barW}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-[12px]">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">Satisfaction</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: satColor }} />
                    <span className="text-[15px] font-bold text-[var(--tx)]">
                      {a.avgSatisfaction != null ? `${a.avgSatisfaction}` : "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">Sign-off</div>
                  <span className="text-[15px] font-bold text-[var(--tx)]">{a.signOffRate}%</span>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">Avg time</div>
                  <span className="text-[15px] font-bold text-[var(--tx)]">{a.avgDuration > 0 ? `${a.avgDuration}m` : "—"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {sorted.length === 0 && !loading && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg>
          </div>
          <p className="text-[14px] font-semibold text-[var(--tx)]">No crew activity</p>
          <p className="text-[12px] text-[var(--tx3)] mt-1">Try a different date range to see performance data.</p>
        </div>
      )}

      {/* Team detail modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedTeam(null)} role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between">
              <div>
                <h2 className="font-hero text-[18px] font-bold text-[var(--tx)]">{selectedTeam.name}</h2>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5">{fmtLabel(from)} — {fmtLabel(to)}</p>
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
                <StatCard label="Avg satisfaction" value={selectedTeam.avgSatisfaction != null ? `${selectedTeam.avgSatisfaction}/5` : "—"} accent={selectedTeam.avgSatisfaction != null && selectedTeam.avgSatisfaction >= 4} />
                <StatCard label="Avg job time" value={selectedTeam.avgDuration > 0 ? `${selectedTeam.avgDuration} min` : "—"} />
              </div>

              {/* Performance indicators */}
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-2">Performance</div>
                <div className="space-y-2">
                  <MetricBar label="Satisfaction" value={selectedTeam.avgSatisfaction != null ? (selectedTeam.avgSatisfaction / 5) * 100 : 0} color="#2D9F5A" />
                  <MetricBar label="Sign-offs" value={selectedTeam.signOffRate} color="#C9A962" />
                  <MetricBar label="Efficiency" value={selectedTeam.avgDuration > 0 ? Math.min(100, Math.max(0, 100 - (selectedTeam.avgDuration - 30))) : 50} color="#3B82F6" />
                </div>
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
      <span className="text-[11px] text-[var(--tx3)] w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--brd)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold text-[var(--tx)] w-10 text-right">{Math.round(value)}%</span>
    </div>
  );
}
