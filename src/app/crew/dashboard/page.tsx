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
  crewMember: { name: string; role: string };
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

  return (
    <PageContent>
      <section>
        <h2 className="font-hero text-[14px] font-bold text-[var(--tx)] mb-3">
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
                          {completed ? "✓" : index + 1}
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
                      <div className="truncate">
                        {job.fromAddress} → {job.toAddress}
                      </div>
                      <div className="text-[10px] text-[var(--tx3)]">{job.jobTypeLabel}</div>
                    </div>

                    {completed ? (
                      <div className="mt-3 ml-8 text-[10px] text-[var(--grn)] font-medium">
                        ✓ Completed
                      </div>
                    ) : canStart ? (
                      <Link
                        href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                        className="mt-3 ml-8 flex items-center justify-center gap-2 w-[calc(100%-2rem)] py-2.5 rounded-lg font-semibold text-[12px] text-[#0D0D0D] bg-[var(--gold)] hover:bg-[var(--gold2)] transition-all"
                      >
                        START JOB →
                      </Link>
                    ) : (
                      <div className="mt-3 ml-8 text-[10px] text-[var(--tx3)] flex items-center gap-1">
                        🔒 Complete Job {index} first
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
          className="mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[13px] text-[#0D0D0D] bg-[var(--gold)] hover:bg-[#D4B56C] transition-colors"
        >
          End Day
        </Link>
        <a
          href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
          className="mt-3 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-[var(--brd)] text-[13px] font-medium text-[var(--tx)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
        >
          📞 Call Dispatch
        </a>
      </section>
    </PageContent>
  );
}
