"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";

export default function CrewEndOfDayPage() {
  const [crewNote, setCrewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/reports/end-of-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewNote: crewNote.trim() || null }),
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
      <p className="text-[12px] text-[var(--tx3)] mt-1">Submit your daily report. Data is auto-compiled from today&apos;s activity.</p>

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
          className="w-full py-4 rounded-xl font-semibold text-[15px] text-[#0D0D0D] bg-[var(--gold)] hover:bg-[#D4B56C] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit & End Day"}
        </button>
      </form>
    </PageContent>
  );
}
