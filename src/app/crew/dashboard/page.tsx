"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normalizePhone } from "@/lib/phone";
import PageContent from "@/app/admin/components/PageContent";
import ReadinessCheck from "./components/ReadinessCheck";

interface Job {
  id: string;
  jobId: string;
  jobType: "move" | "delivery";
  clientName: string;
  fromAddress: string;
  toAddress: string;
  jobTypeLabel: string;
  itemCount?: number;
  scheduledTime: string;
  status: string;
  completedAt?: string | null;
}

interface DashboardData {
  crewMember: { name: string; role: string; teamName?: string; dateStr?: string };
  jobs: Job[];
  readinessCompleted?: boolean;
  readinessRequired?: boolean;
  isCrewLead?: boolean;
}

const DISPATCH_PHONE = "(647) 370-4525";

export default function CrewDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/crew/dashboard")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/crew/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
        else setError("Session expired");
      })
      .catch(() => setError("Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [router]);

  const completedStatuses = ["delivered", "completed", "done", "cancelled"];
  const isCompleted = (j: Job) => completedStatuses.includes((j.status || "").toLowerCase());

  const firstIncompleteIndex = data?.jobs.findIndex((j) => !isCompleted(j)) ?? -1;
  const canStartJob = (index: number) => index === firstIncompleteIndex;

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-[14px] text-[var(--tx3)]">Loading…</p>
        </div>
      </PageContent>
    );
  }

  if (error || !data) {
    return (
      <PageContent>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-[14px] text-[var(--red)] mb-4">{error || "Unable to load"}</p>
          <Link href="/crew/login" className="text-[13px] text-[var(--gold)] hover:underline">
            Back to login
          </Link>
        </div>
      </PageContent>
    );
  }

  const { jobs, readinessRequired, readinessCompleted, isCrewLead } = data;

  if (readinessRequired && !readinessCompleted) {
    if (isCrewLead) {
      return (
        <PageContent>
          <ReadinessCheck onComplete={() => window.location.reload()} />
        </PageContent>
      );
    }
    return (
      <PageContent>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-8 text-center max-w-[420px] mx-auto">
          <h2 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-2">Waiting for Crew Lead</h2>
          <p className="text-[13px] text-[var(--tx3)]">The crew lead must complete the pre-trip readiness check before jobs are available.</p>
        </div>
      </PageContent>
    );
  }

  const firstName = data.crewMember?.name?.split(/\s+/)[0] || "Crew";
  const initials = (data.crewMember?.name || "C")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <PageContent>
      <section>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-hero text-[22px] font-bold text-[var(--tx)]">Hello, {firstName}</h1>
            <p className="text-[13px] text-[var(--tx3)] mt-0.5">
              {data.crewMember?.dateStr || new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · {data.crewMember?.teamName || "Team"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold bg-[var(--gold)]/20 text-[var(--gold)] shrink-0">
            {initials}
          </div>
        </div>

        <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">
          Today&apos;s Jobs ({jobs.length})
        </h2>

        <div className="space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-xl border border-[var(--brd)] p-6 text-center text-[13px] text-[var(--tx3)] bg-[var(--card)]">
              No jobs scheduled for today
            </div>
          ) : (
            jobs.map((job, index) => {
              const completed = isCompleted(job);
              const canStart = canStartJob(index);
              return (
                <div
                  key={job.id}
                  className="rounded-xl border overflow-hidden bg-[var(--card)] border-[var(--brd)] hover:border-[var(--gold)]/50 transition-all"
                  style={{
                    borderColor: completed ? "rgba(45,159,90,0.35)" : undefined,
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[var(--gdim)] text-[var(--gold)]"
                          style={{
                            background: completed ? "rgba(45,159,90,0.2)" : "var(--gdim)",
                            color: completed ? "var(--grn)" : "var(--gold)",
                          }}
                        >
                          {completed ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : index + 1}
                        </span>
                        <span className="text-[14px] font-semibold text-[var(--tx)] truncate">
                          {job.clientName}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--tx3)] shrink-0">
                        {job.scheduledTime}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--tx2)] space-y-0.5 ml-8">
                      <div className="truncate"><span className="text-[var(--tx3)]">FROM</span> {job.fromAddress}</div>
                      <div className="truncate"><span className="text-[var(--tx3)]">TO</span> {job.toAddress}</div>
                      <div className="text-[10px] text-[var(--tx3)]">{job.jobTypeLabel}</div>
                    </div>

                    {completed ? (
                      <div className="mt-3 ml-8 text-[10px] text-[var(--grn)] font-medium flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        Completed
                      </div>
                    ) : canStart ? (
                      <div className="mt-3 ml-8 flex gap-2">
                        <Link
                          href={`/crew/expense?job=${job.id}`}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[11px] text-[var(--tx)] border border-[var(--brd)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                          Expense
                        </Link>
                        <a
                          href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[11px] text-[var(--tx)] border border-[var(--brd)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
                          Dispatch
                        </a>
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[12px] text-white bg-[var(--gold)] hover:bg-[var(--gold2)] transition-all"
                        >
                          START JOB →
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-3 ml-8 flex flex-col gap-2">
                        <div className="text-[10px] text-[var(--tx3)] flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                          Complete previous job first
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/crew/expense?job=${job.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[11px] text-[var(--tx)] border border-[var(--brd)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                            Expense
                          </Link>
                          <a
                            href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[11px] text-[var(--tx)] border border-[var(--brd)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
                            Dispatch
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Link
          href="/crew/end-of-day"
          className="mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[13px] text-white bg-[var(--gold)] hover:bg-[#D4B56C] transition-colors"
        >
          End Day
        </Link>
        <a
          href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
          className="mt-3 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-[var(--brd)] text-[13px] font-medium text-[var(--tx)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
          Call Dispatch
        </a>
      </section>
    </PageContent>
  );
}
