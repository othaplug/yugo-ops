"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";

export default function CrewEndOfDayPage() {
  const [crewNote, setCrewNote] = useState("");
  const [jobNotes, setJobNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ summary?: { jobsCompleted?: number; totalJobTime?: number; photosCount?: number; expensesTotal?: number; clientSignOffs?: number; averageSatisfaction?: number }; jobs?: { jobId: string; displayId?: string; type: string; duration: number }[]; expenses?: { category: string; amount: number; description: string }[]; alreadySubmitted?: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/crew/reports/end-of-day")
      .then((r) => r.json())
      .then((d) => setPreview(d))
      .catch(() => {});
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
      <Link
        href="/crew/dashboard"
        className="inline-flex gap-1.5 py-2 text-[13px] text-[var(--tx3)] hover:text-[var(--gold)]"
      >
        ← Back to Dashboard
      </Link>
      <div className="mt-1">
        <p className="text-[10px] font-bold tracking-[0.18em] capitalize text-[var(--tx3)]/60 mb-1">Crew</p>
        <h1 className="font-heading text-[22px] sm:text-[26px] font-bold text-[var(--tx)] tracking-tight leading-none">
          End of day report
        </h1>
      </div>
      {preview?.alreadySubmitted ? (
        <div className="mt-4 flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--grn)]/10 border border-[var(--grn)]/30">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--grn)] text-white text-[13px] shrink-0">
            ✓
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--grn)]">End of day submitted</p>
            <p className="text-[13px] text-[var(--tx3)] mt-1 leading-snug">
              Need to add something? You can update your report below.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--tx3)] mt-2 leading-relaxed max-w-prose">
          Submit your daily report. Data is auto-compiled from today&apos;s activity.
        </p>
      )}

      {preview?.summary && (
        <div className="mt-5 p-4 sm:p-5 rounded-xl bg-[var(--bg)] border border-[var(--brd)]/40">
          <h2 className="admin-section-h2 text-[var(--tx2)] mb-4">Today&apos;s summary</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-[13px] leading-snug">
            {summaryStats.map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between gap-4 min-w-0">
                <dt className="text-[var(--tx3)] shrink-0">{label}</dt>
                <dd className="font-semibold text-[var(--tx)] tabular-nums text-right min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
          {preview.jobs && preview.jobs.length > 0 && (
            <div className="mt-5 pt-5 border-t border-[var(--brd)]">
              <h3 className="text-[15px] sm:text-[16px] font-semibold font-heading text-[var(--tx2)] tracking-tight mb-3">
                Jobs
              </h3>
              {preview.jobs.map((j, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <p className="text-[13px] font-medium text-[var(--tx)]">
                    {j.displayId ?? j.jobId}
                    <span className="text-[var(--tx3)] font-normal"> · {j.duration} min</span>
                  </p>
                  <textarea
                    value={jobNotes[j.jobId] ?? ""}
                    onChange={(e) => setJobNotes((prev) => ({ ...prev, [j.jobId]: e.target.value }))}
                    placeholder="Note for this job (optional)"
                    className="mt-2 w-full px-3 py-2.5 rounded-xl text-[13px] leading-relaxed bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]/75 min-h-[88px] resize-y"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="crew-eod-note" className="block text-[13px] font-semibold text-[var(--tx2)] mb-2">
            Anything else to note?{" "}
            <span className="font-normal text-[var(--tx3)]">(optional)</span>
          </label>
          <textarea
            id="crew-eod-note"
            value={crewNote}
            onChange={(e) => setCrewNote(e.target.value)}
            placeholder="e.g. Good day. Patels had more items than expected but we managed."
            className="w-full px-3 py-2.5 rounded-xl text-[13px] leading-relaxed bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]/75 min-h-[120px] resize-y"
          />
        </div>
        {error && <p className="text-[13px] text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-2 font-semibold text-[14px] sm:text-[15px] disabled:opacity-50 ${
            preview?.alreadySubmitted
              ? "bg-transparent border-2 border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
              : "bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[#D4B56C]"
          }`}
        >
          {submitting ? (preview?.alreadySubmitted ? "Updating…" : "Submitting…") : preview?.alreadySubmitted ? "Update report" : "Submit & End Day"}
        </button>
      </form>
    </PageContent>
  );
}
