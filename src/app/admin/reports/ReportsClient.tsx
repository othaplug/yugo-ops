"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Report {
  id: string;
  team_id: string;
  report_date: string;
  summary?: Record<string, unknown>;
  jobs?: { jobId: string; type: string; duration: number }[];
  crew_note?: string | null;
  readiness?: { passed?: boolean; flaggedItems?: string[] } | null;
  expenses?: { category: string; amount: number; description?: string }[];
  generated_at?: string;
  crews?: { name: string } | null;
}

export default function ReportsClient({
  initialReports,
  initialDate,
}: {
  initialReports: Report[];
  initialDate: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [reports, setReports] = useState(initialReports);

  useEffect(() => {
    setDate(initialDate);
    setReports(initialReports);
  }, [initialDate, initialReports]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value;
    setDate(d);
    router.push(`/admin/reports?date=${d}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-hero text-[22px] font-bold text-[var(--tx)]">End-of-Day Reports</h1>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-[var(--tx3)]">Date</label>
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)]"
          />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-12 text-center">
          <p className="text-[14px] text-[var(--tx3)]">No end-of-day reports for this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
                <h2 className="font-hero text-[15px] font-semibold text-[var(--tx)]">
                  {(r.crews as { name?: string })?.name || "Team"}
                </h2>
                <span className="text-[11px] text-[var(--tx3)]">
                  {r.generated_at ? new Date(r.generated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}
                </span>
              </div>
              <div className="p-5 space-y-4">
                {r.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="px-3 py-2 rounded-lg bg-[var(--bg)]">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase">Jobs</div>
                      <div className="text-[14px] font-bold text-[var(--tx)]">{String(r.summary.jobsCompleted ?? 0)}</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[var(--bg)]">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase">Total time</div>
                      <div className="text-[14px] font-bold text-[var(--tx)]">
                        {Math.floor((Number(r.summary.totalJobTime) || 0) / 60)}h {(Number(r.summary.totalJobTime) || 0) % 60}m
                      </div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[var(--bg)]">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase">Sign-offs</div>
                      <div className="text-[14px] font-bold text-[var(--tx)]">{String(r.summary.clientSignOffs ?? 0)}</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[var(--bg)]">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase">Expenses</div>
                      <div className="text-[14px] font-bold text-[var(--tx)]">${((Number(r.summary.expensesTotal) || 0) / 100).toFixed(2)}</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[var(--bg)]">
                      <div className="text-[10px] font-semibold text-[var(--tx3)] uppercase">Avg rating</div>
                      <div className="text-[14px] font-bold text-[var(--tx)]">{typeof r.summary.averageSatisfaction === "number" || typeof r.summary.averageSatisfaction === "string" ? r.summary.averageSatisfaction : "—"}</div>
                    </div>
                  </div>
                )}
                {r.jobs && r.jobs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Jobs</div>
                    <div className="space-y-1">
                      {r.jobs.map((j, i) => (
                        <div key={i} className="text-[12px] text-[var(--tx2)] flex justify-between">
                          <span>{j.jobId}</span>
                          <span>{j.duration}m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.crew_note && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Crew note</div>
                    <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap">{r.crew_note}</p>
                  </div>
                )}
                {r.readiness && !r.readiness.passed && r.readiness.flaggedItems?.length ? (
                  <div className="px-3 py-2 rounded-lg bg-[var(--ordim)] border border-[var(--org)]/30">
                    <div className="text-[10px] font-bold uppercase text-[var(--org)] mb-1">Readiness flagged</div>
                    <p className="text-[12px] text-[var(--tx2)]">{r.readiness.flaggedItems.join(", ")}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
