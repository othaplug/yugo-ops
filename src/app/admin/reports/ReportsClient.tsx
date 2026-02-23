"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateEODReportPDF } from "@/lib/pdf";

function formatDateShort(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m || "1", 10) - 1]} ${parseInt(day || "1", 10)}`;
}

interface JobEnriched {
  jobId: string;
  type: string;
  sessionId?: string | null;
  duration: number;
  status?: string;
  signOff?: boolean;
  rating?: number | null;
  displayId: string;
  clientName: string;
  hasDamage?: boolean;
}

interface Report {
  id: string;
  team_id: string;
  report_date: string;
  summary?: Record<string, unknown>;
  jobs?: JobEnriched[];
  crew_note?: string | null;
  readiness?: { passed?: boolean; flaggedItems?: string[] } | null;
  expenses?: { category: string; amount: number; description?: string }[];
  generated_at?: string;
  crews?: { name: string } | null;
}

interface JobDetail {
  job: {
    displayId: string;
    clientName: string;
    fromAddress?: string;
    toAddress?: string;
    type: string;
    scheduledDate?: string;
    arrivalWindow?: string;
    crewName?: string;
    notFound?: boolean;
  };
  signOff: { rating: number | null; signedBy: string; signedAt?: string } | null;
  session: { startedAt: string | null; completedAt: string | null } | null;
  timeBreakdown: { stage: string; label: string; minutes: number; from: string; to: string }[];
  summary: { totalMinutes: number; driveMinutes: number; loadingMinutes: number; unloadingMinutes: number };
  checkpoints: { status: string; timestamp: string; note?: string | null }[];
  photosCount?: number;
  incidents?: { id: string; issue_type: string; description?: string | null; created_at: string }[];
  kmTravelled?: number | null;
  stopsMade?: number | null;
  error?: string;
}

export default function ReportsClient({
  initialReports,
  initialDate,
  initialFrom,
  initialTo,
}: {
  initialReports: Report[];
  initialDate: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [from, setFrom] = useState(initialFrom ?? initialDate);
  const [to, setTo] = useState(initialTo ?? initialDate);
  const [reports, setReports] = useState(initialReports);
  const [filterJobType, setFilterJobType] = useState<string>("all");
  const [filterTeamId, setFilterTeamId] = useState<string>("all");
  const [detailModal, setDetailModal] = useState<{ report: Report; job: JobEnriched } | null>(null);
  const [detailData, setDetailData] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDate(initialDate);
    setFrom(initialFrom ?? initialDate);
    setTo(initialTo ?? initialDate);
    setReports(initialReports);
  }, [initialDate, initialFrom, initialTo, initialReports]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    if (filterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  const filteredReports = useMemo(() => {
    let list = reports;
    if (filterTeamId !== "all") list = list.filter((r) => r.team_id === filterTeamId);
    if (filterJobType !== "all") {
      list = list.map((r) => ({
        ...r,
        jobs: (r.jobs || []).filter((j) => j.type === filterJobType),
      })).filter((r) => (r.jobs?.length ?? 0) > 0);
    }
    return list;
  }, [reports, filterJobType, filterTeamId]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value;
    setDate(d);
    router.push(`/admin/reports?date=${d}`);
  };

  const handleDateRangeApply = () => {
    if (from && to && from <= to) {
      router.push(`/admin/reports?from=${from}&to=${to}`);
    } else {
      router.push(`/admin/reports?date=${date}`);
    }
  };

  const exportFilename = from === to ? `eod-reports-${from}` : `eod-reports-${from}-${to}`;

  const exportCSV = () => {
    const headers = ["Date", "Team", "Job ID", "Client", "Type", "Duration (min)", "Sign-off", "Damage", "Generated"];
    const rows: string[][] = [headers];
    filteredReports.forEach((r) => {
      const crewName = (r.crews as { name?: string })?.name || "Team";
      (r.jobs || []).forEach((j) => {
        rows.push([
          r.report_date,
          crewName,
          j.displayId ?? j.jobId?.slice(0, 8) ?? "—",
          j.clientName ?? "—",
          j.type,
          String(j.duration ?? 0),
          j.signOff ? "Yes" : "No",
          j.hasDamage ? "Yes" : "No",
          r.generated_at ? new Date(r.generated_at).toLocaleString() : "—",
        ]);
      });
    });
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = generateEODReportPDF(filteredReports);
    doc.save(`${exportFilename}.pdf`);
  };

  const openDetail = (report: Report, job: JobEnriched) => {
    setDetailModal({ report, job });
    setDetailData(null);
    setDetailLoading(true);
    const params = new URLSearchParams({ jobId: job.jobId, jobType: job.type });
    if (job.sessionId) params.set("sessionId", job.sessionId);
    else {
      params.set("teamId", report.team_id);
      params.set("reportDate", report.report_date);
    }
    const crewNameFromReport = (report.crews as { name?: string })?.name ?? undefined;
    const fallbackJob = {
      displayId: job?.displayId ?? job?.jobId?.slice(0, 8) ?? "—",
      clientName: job?.clientName ?? "—",
      type: job?.type ?? "move",
      notFound: true as const,
      crewName: crewNameFromReport,
    };
    fetch(`/api/admin/reports/job-detail?${params}`, { credentials: "include" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data?.job) {
          setDetailData({
            job: fallbackJob,
            signOff: null,
            session: null,
            timeBreakdown: [],
            summary: { totalMinutes: 0, driveMinutes: 0, loadingMinutes: 0, unloadingMinutes: 0 },
            checkpoints: [],
            error: data?.error || "Could not load details",
          });
        } else {
          setDetailData(data);
        }
      })
      .catch(() => {
        setDetailData({
          job: fallbackJob,
          signOff: null,
          session: null,
          timeBreakdown: [],
          summary: { totalMinutes: 0, driveMinutes: 0, loadingMinutes: 0, unloadingMinutes: 0 },
          checkpoints: [],
          error: "Network error",
        });
      })
      .finally(() => { setDetailLoading(false); });
  };

  const teamNames = useMemo(() => {
    const map = new Map<string, string>();
    reports.forEach((r) => {
      const name = (r.crews as { name?: string })?.name || "Team";
      map.set(r.team_id, name);
    });
    return map;
  }, [reports]);

  const dateLabel = from === to ? formatDateShort(date) : `${formatDateShort(from)} – ${formatDateShort(to)}`;
  const hasActiveFilters = filterJobType !== "all" || filterTeamId !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[24px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight">End-of-Day Reports</h1>
        <div className="flex items-center gap-2" ref={filterRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[12px] font-medium text-[var(--tx)] hover:border-[var(--gold)]/50 hover:bg-[var(--gdim)]/30 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>{dateLabel}</span>
              {hasActiveFilters && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-[var(--gold)]/20 text-[var(--gold)] text-[10px] font-bold flex items-center justify-center">
                  {[filterJobType !== "all", filterTeamId !== "all"].filter(Boolean).length}
                </span>
              )}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${filterOpen ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {filterOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-[280px] rounded-xl border border-[var(--brd)] bg-[var(--card)] shadow-xl z-50 overflow-hidden">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">Date & filters</span>
                    <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[11px] font-semibold hover:underline">Done</button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Single date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => { const d = e.target.value; setDate(d); setFrom(d); setTo(d); router.push(`/admin/reports?date=${d}`); }}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Date range</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={from}
                          onChange={(e) => setFrom(e.target.value)}
                          className="flex-1 px-2 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)]"
                        />
                        <span className="text-[10px] text-[var(--tx3)]">–</span>
                        <input
                          type="date"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          className="flex-1 px-2 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { handleDateRangeApply(); setFilterOpen(false); }}
                        className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold text-[11px] hover:opacity-90"
                      >
                        Apply range
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Job type</label>
                      <select
                        value={filterJobType}
                        onChange={(e) => setFilterJobType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)]"
                      >
                        <option value="all">All</option>
                        <option value="move">Moves</option>
                        <option value="delivery">Deliveries</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Crew</label>
                      <select
                        value={filterTeamId}
                        onChange={(e) => setFilterTeamId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)]"
                      >
                        <option value="all">All crews</option>
                        {reports.map((r) => (
                          <option key={r.team_id} value={r.team_id}>{teamNames.get(r.team_id) || r.team_id.slice(0, 8)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={exportCSV}
            disabled={filteredReports.length === 0}
            className="px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[var(--tx)] font-semibold text-[12px] hover:border-[var(--gold)]/50 hover:bg-[var(--gdim)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={exportPDF}
            disabled={filteredReports.length === 0}
            className="px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold text-[12px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            PDF
          </button>
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-12 text-center">
          <p className="text-[14px] text-[var(--tx3)]">
            No end-of-day reports{from !== to ? ` for ${from} to ${to}` : ` for ${date}`}{filterJobType !== "all" || filterTeamId !== "all" ? " with current filters" : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden shadow-sm"
            >
              <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-[17px] font-semibold text-[var(--tx)]">
                  {(r.crews as { name?: string })?.name || "Team"}
                </h2>
                <span className="text-[12px] text-[var(--tx3)]">
                  {r.generated_at ? new Date(r.generated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}
                </span>
              </div>
              <div className="p-5 space-y-5">
                {r.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]/50">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider">Jobs</div>
                      <div className="text-[16px] font-bold font-heading text-[var(--tx)]">{String(r.summary.jobsCompleted ?? 0)}</div>
                    </div>
                    <div className={`px-4 py-3 rounded-lg border ${(r.jobs?.filter((j) => j.hasDamage).length ?? 0) > 0 ? "bg-[var(--ordim)]/30 border-[var(--org)]/50" : "bg-[var(--bg)] border-[var(--brd)]/50"}`}>
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider">Damage</div>
                      <div className="text-[16px] font-bold font-heading text-[var(--tx)]">{r.jobs?.filter((j) => j.hasDamage).length ?? 0}</div>
                    </div>
                    <div className="px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]/50">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider">Total time</div>
                      <div className="text-[16px] font-bold font-heading text-[var(--tx)]">
                        {Math.floor((Number(r.summary.totalJobTime) || 0) / 60)}h {(Number(r.summary.totalJobTime) || 0) % 60}m
                      </div>
                    </div>
                    <div className="px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]/50">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider">Sign-offs</div>
                      <div className="text-[16px] font-bold font-heading text-[var(--tx)]">{String(r.summary.clientSignOffs ?? 0)}</div>
                    </div>
                    <div className="px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]/50">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider">Expenses</div>
                      <div className="text-[16px] font-bold font-heading text-[var(--tx)]">${((Number(r.summary.expensesTotal) || 0) / 100).toFixed(2)}</div>
                    </div>
                    <div className="px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)]/50">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider">Avg rating</div>
                      <div className="text-[16px] font-bold font-heading text-[var(--tx)]">{typeof r.summary.averageSatisfaction === "number" || typeof r.summary.averageSatisfaction === "string" ? r.summary.averageSatisfaction : "—"}</div>
                    </div>
                  </div>
                )}
                {r.jobs && r.jobs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Jobs</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {r.jobs.map((j, i) => (
                        <button
                          key={`${j.jobId}-${i}`}
                          type="button"
                          onClick={() => openDetail(r, j)}
                          className="text-left px-4 py-3 rounded-xl border border-[var(--brd)] bg-[var(--bg)] hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-colors group"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <div className="font-heading font-semibold text-[var(--tx)] text-[13px] truncate">{j.displayId ?? j.jobId?.slice(0, 8) ?? "—"}</div>
                              <div className="text-[12px] text-[var(--tx2)] truncate mt-0.5">{j.clientName}</div>
                              <div className="text-[11px] text-[var(--tx3)] mt-1 capitalize">{j.type}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span className="text-[13px] font-heading font-semibold text-[var(--tx)] tabular-nums">{j.duration}m</span>
                              {j.hasDamage && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ordim)] text-[var(--org)]">Damage</span>}
                              {j.signOff && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gdim)] text-[var(--g)]">Signed</span>}
                              <span className="text-[var(--tx3)] group-hover:text-[var(--gold)] transition-colors">View details →</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {r.crew_note && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">Crew note</div>
                    <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap font-heading">{r.crew_note}</p>
                  </div>
                )}
                {r.readiness && !r.readiness.passed && r.readiness.flaggedItems?.length ? (
                  <div className="px-4 py-3 rounded-lg bg-[var(--ordim)] border border-[var(--org)]/30">
                    <div className="text-[10px] font-bold uppercase text-[var(--org)] mb-1">Readiness flagged</div>
                    <p className="text-[12px] text-[var(--tx2)]">{r.readiness.flaggedItems.join(", ")}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setDetailModal(null)}>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--brd)] shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 flex items-center justify-between">
              <h3 className="font-heading text-[18px] font-bold text-[var(--tx)]">Job details</h3>
              <button type="button" onClick={() => setDetailModal(null)} className="p-2 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)] font-semibold text-[16px] leading-none" aria-label="Close">×</button>
            </div>
            <div className="p-5 space-y-5">
              {detailLoading ? (
                <p className="text-[13px] text-[var(--tx3)]">Loading…</p>
              ) : detailData?.job ? (
                <>
                  {detailData.error && (
                    <div className="rounded-lg bg-[var(--ordim)] border border-[var(--org)]/40 px-3 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-[var(--org)]">{detailData.error}</span>
                      {detailModal && (
                        <button type="button" onClick={() => openDetail(detailModal.report, detailModal.job)} className="shrink-0 text-[11px] font-semibold text-[var(--gold)] hover:underline">Retry</button>
                      )}
                    </div>
                  )}
                  <div>
                    <div className="font-heading font-semibold text-[var(--tx)] text-[17px]">{detailData.job?.displayId ?? "—"}</div>
                    <div className="text-[14px] text-[var(--tx2)] mt-0.5 font-heading">{detailData.job?.clientName ?? "—"}</div>
                    <p className="text-[11px] text-[var(--tx3)] mt-1">Crew: {detailData.job?.crewName || "—"}</p>
                    <p className="text-[11px] text-[var(--tx3)] mt-1">
                      {detailData.job?.scheduledDate ? new Date(detailData.job.scheduledDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—"}
                      {detailData.job?.arrivalWindow ? ` · ${detailData.job.arrivalWindow}` : ""}
                    </p>
                    <p className="text-[11px] text-[var(--tx3)] mt-2">From: {detailData.job?.fromAddress || "—"}</p>
                    <p className="text-[11px] text-[var(--tx3)]">To: {detailData.job?.toAddress || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Trip</div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div><span className="text-[var(--tx3)]">KM travelled</span> <span className="font-heading font-semibold text-[var(--tx)]">{detailData.kmTravelled != null ? `${detailData.kmTravelled.toFixed(1)} km` : "—"}</span></div>
                      <div><span className="text-[var(--tx3)]">Stops</span> <span className="font-heading font-semibold text-[var(--tx)]">{detailData.stopsMade ?? "—"}</span></div>
                    </div>
                  </div>
                  <div className={`rounded-xl border p-4 ${(detailData.incidents?.filter((i) => i.issue_type === "damage").length ?? 0) > 0 ? "border-[var(--org)]/60 bg-[var(--ordim)]/30" : "border-[var(--brd)] bg-[var(--bg)]"}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Damage</div>
                    {detailData.incidents?.filter((i) => i.issue_type === "damage").length ? (
                      <ul className="space-y-2">
                        {detailData.incidents.filter((i) => i.issue_type === "damage").map((inc) => (
                          <li key={inc.id} className="text-[12px] text-[var(--tx2)]">
                            <span className="font-semibold text-[var(--org)]">Damage reported</span>
                            {inc.description && <span className="block text-[11px] text-[var(--tx3)] mt-0.5">{inc.description}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-[var(--tx3)]">No damage reported.</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Session</div>
                    {detailData.session?.startedAt || detailData.session?.completedAt ? (
                      <p className="text-[12px] text-[var(--tx2)]">
                        {detailData.session.startedAt && <span>Started: {new Date(detailData.session.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
                        {detailData.session.completedAt && <span className="ml-3">Completed: {new Date(detailData.session.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[var(--tx3)]">—</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Time breakdown</div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div><span className="text-[var(--tx3)]">Total</span> <span className="font-heading font-semibold text-[var(--tx)]">{detailData.summary?.totalMinutes ?? 0} min</span></div>
                      <div><span className="text-[var(--tx3)]">Drive</span> <span className="font-heading font-semibold text-[var(--tx)]">{detailData.summary?.driveMinutes ?? 0} min</span></div>
                      <div><span className="text-[var(--tx3)]">Loading</span> <span className="font-heading font-semibold text-[var(--tx)]">{detailData.summary?.loadingMinutes ?? 0} min</span></div>
                      <div><span className="text-[var(--tx3)]">Unloading</span> <span className="font-heading font-semibold text-[var(--tx)]">{detailData.summary?.unloadingMinutes ?? 0} min</span></div>
                    </div>
                    {detailData.timeBreakdown && detailData.timeBreakdown.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-[var(--brd)]">
                        <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase mb-2">By stage</div>
                        <ul className="space-y-1 text-[11px] text-[var(--tx2)]">
                          {detailData.timeBreakdown.map((t, i) => (
                            <li key={i} className="flex justify-between"><span>{t.label}</span><span className="tabular-nums">{t.minutes}m</span></li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--tx3)] mt-2">No stage data recorded.</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Client sign-off</div>
                    {detailData.signOff ? (
                      <>
                        <p className="text-[13px] text-[var(--tx)]">Signed by {detailData.signOff.signedBy}</p>
                        {detailData.signOff.rating != null && <p className="text-[13px] text-[var(--tx2)] mt-1">Rating: {detailData.signOff.rating}/5</p>}
                        {detailData.signOff.signedAt && <p className="text-[11px] text-[var(--tx3)] mt-0.5">{new Date(detailData.signOff.signedAt).toLocaleString("en-US")}</p>}
                      </>
                    ) : (
                      <p className="text-[12px] text-[var(--tx3)]">No sign-off recorded.</p>
                    )}
                  </div>
                  {(detailData.photosCount != null && detailData.photosCount > 0) && (
                    <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Photos</div>
                      <p className="text-[12px] text-[var(--tx2)]">{detailData.photosCount} photo{detailData.photosCount !== 1 ? "s" : ""} captured</p>
                    </div>
                  )}
                  {detailData.incidents && detailData.incidents.length > 0 && (
                    <div className="rounded-xl border border-[var(--org)]/40 bg-[var(--ordim)]/30 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--org)] mb-2">Incidents</div>
                      <ul className="space-y-2">
                        {detailData.incidents.map((inc) => (
                          <li key={inc.id} className="text-[12px] text-[var(--tx2)]">
                            <span className="font-semibold capitalize">{inc.issue_type?.replace(/_/g, " ")}</span>
                            {inc.description && <span className="block text-[11px] text-[var(--tx3)] mt-0.5">{inc.description}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detailModal && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link
                        href={(detailData.job?.type === "move"
                          ? `/admin/moves/${detailData.job?.notFound ? detailModal?.job?.jobId : (detailData.job?.displayId ?? "").replace(/^#/, "")}`
                          : `/admin/deliveries/${detailData.job?.notFound ? detailModal?.job?.jobId : encodeURIComponent((detailData.job?.displayId ?? "").replace(/^#/, ""))}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold text-[12px] py-2.5 px-4 hover:opacity-90 transition-opacity"
                      >
                        Open {detailData.job?.type === "move" ? "move" : "delivery"} →
                      </Link>
                      <button type="button" onClick={() => setDetailModal(null)} className="inline-flex items-center rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[var(--tx)] font-semibold text-[12px] py-2.5 px-4 hover:bg-[var(--brd)]/30 transition-colors">
                        Close
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-[var(--tx3)]">Could not load details.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}