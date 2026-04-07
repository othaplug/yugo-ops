"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, CheckCircle } from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";

const SECTION_EYEBROW =
  "block pl-0.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] mb-2 [font-family:var(--font-body)]";

const FIELD_TEXTAREA =
  "w-full min-h-[120px] px-4 py-3.5 rounded-xl text-[14px] leading-relaxed bg-white text-[var(--tx)] placeholder:text-[var(--tx3)]/65 shadow-[inset_0_0_0_1px_rgba(44,62,45,0.1)] focus:shadow-[inset_0_0_0_2px_rgba(44,62,45,0.22)] focus:outline-none resize-y transition-shadow";

const JOB_NOTE_TEXTAREA =
  "mt-2 w-full min-h-[88px] px-3.5 py-3 rounded-lg text-[13px] leading-relaxed bg-white text-[var(--tx)] placeholder:text-[var(--tx3)]/65 shadow-[inset_0_0_0_1px_rgba(44,62,45,0.1)] focus:shadow-[inset_0_0_0_2px_rgba(44,62,45,0.22)] focus:outline-none resize-y transition-shadow";

export default function CrewEndOfDayPage() {
  const [crewNote, setCrewNote] = useState("");
  const [jobNotes, setJobNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    summary?: {
      jobsCompleted?: number;
      totalJobTime?: number;
      photosCount?: number;
      expensesTotal?: number;
      clientSignOffs?: number;
      averageSatisfaction?: number;
    };
    jobs?: { jobId: string; displayId?: string; type: string; duration: number }[];
    expenses?: { category: string; amount: number; description: string }[];
    alreadySubmitted?: boolean;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      fetch("/api/crew/reports/end-of-day")
        .then((r) => r.json())
        .then((d) => setPreview(d))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/reports/end-of-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewNote: crewNote.trim() || null,
          jobNotes: Object.keys(jobNotes).length > 0 ? jobNotes : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        setSubmitting(false);
        return;
      }
      router.push("/crew/dashboard");
      router.refresh();
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  };

  const totalMin = preview?.summary?.totalJobTime ?? 0;
  const summaryStats: { label: string; value: string }[] = preview?.summary
    ? [
        { label: "Jobs completed", value: String(preview.summary.jobsCompleted ?? 0) },
        {
          label: "Total job time",
          value: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
        },
        { label: "Photos", value: String(preview.summary.photosCount ?? 0) },
        { label: "Expenses", value: `$${((preview.summary.expensesTotal ?? 0) / 100).toFixed(2)}` },
        { label: "Client sign-offs", value: String(preview.summary.clientSignOffs ?? 0) },
        {
          label: "Avg satisfaction",
          value:
            preview.summary.averageSatisfaction != null
              ? String(preview.summary.averageSatisfaction)
              : "—",
        },
      ]
    : [];

  return (
    <PageContent className="pb-28 md:pb-6">
      <section className="max-w-[520px] mx-auto">
        <Link
          href="/crew/dashboard"
          className="inline-flex items-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] hover:text-[var(--tx)] transition-colors [font-family:var(--font-body)]"
        >
          <CaretLeft size={14} weight="bold" className="shrink-0 opacity-90" aria-hidden />
          Back to dashboard
        </Link>

        <header className="mt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-1 [font-family:var(--font-body)]">
            Crew
          </p>
          <h1 className="font-hero text-[26px] sm:text-[28px] font-bold text-[var(--tx)] leading-[1.15] tracking-tight">
            End of day report
          </h1>
        </header>

        {preview?.alreadySubmitted ? (
          <div className="mt-6 flex items-start gap-3.5 rounded-2xl bg-[#2C3E2D]/[0.06] px-4 py-4">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#2C3E2D] text-white shrink-0 mt-0.5">
              <CheckCircle size={18} weight="bold" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] font-semibold text-[#1e2a1f]">End of day submitted</p>
              <p className="text-[13px] text-[var(--tx2)] mt-1.5 leading-relaxed">
                Need to add something? You can update your report below.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-[var(--tx2)] mt-4 leading-relaxed max-w-[40ch]">
            Submit your daily report. Data is auto-compiled from today&apos;s activity. Before you wrap up, open each
            completed job on the dashboard and finish the truck equipment check if it&apos;s still showing there.
          </p>
        )}

        {preview?.summary ? (
          <div className="mt-10">
            <p className={SECTION_EYEBROW}>Today</p>
            <h2 className="font-hero text-[20px] sm:text-[22px] font-bold text-[var(--tx)] tracking-tight mb-6">
              Summary
            </h2>
            <div className="rounded-2xl bg-[#FAF7F2] px-5 py-1 shadow-[0_2px_28px_rgba(44,62,45,0.06)]">
              <dl className="divide-y divide-[var(--brd)]/35">
                {summaryStats.map(({ label, value }) => (
                  <div key={label} className="flex items-baseline justify-between gap-6 py-3.5 first:pt-4 last:pb-4">
                    <dt className="text-[12px] font-medium text-[var(--tx2)] leading-snug">{label}</dt>
                    <dd className="text-[14px] font-semibold text-[var(--tx)] tabular-nums text-right shrink-0">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {preview.jobs && preview.jobs.length > 0 ? (
                <div className="border-t border-[var(--brd)]/30 px-0 pt-6 pb-4 mt-1">
                  <p className="pl-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] mb-4 [font-family:var(--font-body)]">
                    Per-job notes
                  </p>
                  <div className="space-y-6">
                    {preview.jobs.map((j, i) => (
                      <div key={`${j.jobId}-${i}`}>
                        <p className="text-[13px] font-semibold text-[var(--tx)] pl-0.5">
                          {j.displayId ?? j.jobId}
                          <span className="text-[var(--tx3)] font-normal"> · {j.duration} min</span>
                        </p>
                        <textarea
                          value={jobNotes[j.jobId] ?? ""}
                          onChange={(e) => setJobNotes((prev) => ({ ...prev, [j.jobId]: e.target.value }))}
                          placeholder="Note for this job (optional)"
                          className={JOB_NOTE_TEXTAREA}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-8 sm:gap-9">
          <div>
            <label htmlFor="crew-eod-note" className={`${SECTION_EYEBROW} mb-3`}>
              Anything else
              <span className="font-normal text-[var(--tx3)] normal-case tracking-normal text-[11px]">
                {" "}
                (optional)
              </span>
            </label>
            <textarea
              id="crew-eod-note"
              value={crewNote}
              onChange={(e) => setCrewNote(e.target.value)}
              placeholder="e.g. Good day. Patels had more items than expected but we managed."
              className={FIELD_TEXTAREA}
            />
          </div>
          {error ? (
            <p className="text-[13px] font-medium text-[var(--red)] -mt-2" role="alert">
              {error}
            </p>
          ) : null}
          {preview?.alreadySubmitted ? (
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[52px] inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] leading-none border-2 border-[#2C3E2D] text-[var(--tx)] bg-transparent hover:bg-[#2C3E2D]/[0.05] disabled:opacity-45 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C1A33]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] [font-family:var(--font-body)]"
            >
              {submitting ? (
                "Updating…"
              ) : (
                <>
                  Update report
                  <CaretRight size={16} weight="bold" className="shrink-0" aria-hidden />
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="crew-premium-cta w-full min-h-[52px] inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-white disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C1A33]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] [font-family:var(--font-body)]"
            >
              {submitting ? (
                "Submitting…"
              ) : (
                <>
                  Submit & end day
                  <CaretRight size={16} weight="bold" className="shrink-0" aria-hidden />
                </>
              )}
            </button>
          )}
        </form>
      </section>
    </PageContent>
  );
}
