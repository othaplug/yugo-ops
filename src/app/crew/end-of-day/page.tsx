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

  return (
    <PageContent>
      <Link href="/crew/dashboard" className="inline-flex gap-1.5 py-2 text-[12px] text-[var(--tx3)] hover:text-[var(--gold)]">
        ← Back to Dashboard
      </Link>
      <h1 className="font-hero text-[20px] font-bold text-[var(--tx)] mt-2">End of Day Report</h1>
      <p className="text-[12px] text-[var(--tx3)] mt-1">
        {preview?.alreadySubmitted
          ? "You already submitted a report for today. Submit again to update it with any new jobs or expenses."
          : "Submit your daily report. Data is auto-compiled from today's activity."}
      </p>

      {preview?.summary && (
        <div className="mt-4 p-4 rounded-xl bg-[var(--bg)] border border-[var(--brd)]">
          <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Today&apos;s summary</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div><span className="text-[var(--tx3)]">Jobs completed:</span> {preview.summary.jobsCompleted ?? 0}</div>
            <div><span className="text-[var(--tx3)]">Total job time:</span> {Math.floor((preview.summary.totalJobTime ?? 0) / 60)}h {((preview.summary.totalJobTime ?? 0) % 60)}m</div>
            <div><span className="text-[var(--tx3)]">Photos:</span> {preview.summary.photosCount ?? 0}</div>
            <div><span className="text-[var(--tx3)]">Expenses:</span> ${((preview.summary.expensesTotal ?? 0) / 100).toFixed(2)}</div>
            <div><span className="text-[var(--tx3)]">Client sign-offs:</span> {preview.summary.clientSignOffs ?? 0}</div>
            <div><span className="text-[var(--tx3)]">Avg satisfaction:</span> {preview.summary.averageSatisfaction ?? "—"}</div>
          </div>
          {preview.jobs && preview.jobs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--brd)]">
              <p className="text-[10px] font-semibold text-[var(--tx3)] mb-2">Jobs</p>
              {preview.jobs.map((j, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-[11px] text-[var(--tx2)] font-medium">{j.displayId ?? j.jobId} · {j.duration}m</p>
                  <textarea
                    value={jobNotes[j.jobId] ?? ""}
                    onChange={(e) => setJobNotes((prev) => ({ ...prev, [j.jobId]: e.target.value }))}
                    placeholder="Note for this job (optional)"
                    className="mt-1 w-full px-3 py-2 rounded-lg text-[11px] bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] min-h-[60px]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-2 uppercase">Anything else to note? (optional)</label>
          <textarea
            value={crewNote}
            onChange={(e) => setCrewNote(e.target.value)}
            placeholder="e.g. Good day. Patels had more items than expected but we managed."
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] min-h-[100px]"
          />
        </div>
        {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-xl font-semibold text-[15px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[#D4B56C] disabled:opacity-50"
        >
          {submitting ? (preview?.alreadySubmitted ? "Updating…" : "Submitting…") : preview?.alreadySubmitted ? "Update report" : "Submit & End Day"}
        </button>
      </form>
    </PageContent>
  );
}
