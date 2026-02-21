"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageContent from "@/app/admin/components/PageContent";

const CATEGORIES = [
  { id: "parking", label: "Parking" },
  { id: "supplies", label: "Supplies" },
  { id: "fuel", label: "Fuel" },
  { id: "tolls", label: "Tolls" },
  { id: "food", label: "Food" },
  { id: "other", label: "Other" },
];

export default function CrewExpensePage() {
  const [category, setCategory] = useState("parking");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<{ id: string; jobId: string; clientName: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    fetch("/api/crew/expenses?today=true")
      .then((r) => r.json())
      .then((d) => setTodayTotal(d.totalTodayCents || 0))
      .catch(() => {});
    fetch("/api/crew/dashboard")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (cents <= 0 || !description.trim()) {
      setError("Enter amount and description");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          category,
          description: description.trim(),
          jobId: jobId.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        setSubmitting(false);
        return;
      }
      setAmount("");
      setDescription("");
      setJobId("");
      setTodayTotal((t) => t + data.amount_cents);
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
      <h1 className="font-hero text-[20px] font-bold text-[var(--tx)] mt-2">Log Expense</h1>
      <p className="text-[12px] text-[var(--tx3)] mt-1">Today&apos;s expenses: ${(todayTotal / 100).toFixed(2)}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-2 uppercase">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                  category === c.id ? "bg-[var(--gold)] text-[#0D0D0D]" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-2 uppercase">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25.00"
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[16px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-2 uppercase">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Parking at 200 Bloor for move"
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-2 uppercase">Link to job (optional)</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]"
          >
            <option value="">— None —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.jobId} · {j.clientName}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-xl font-semibold text-[15px] text-[#0D0D0D] bg-[var(--gold)] hover:bg-[#D4B56C] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Expense"}
        </button>
      </form>
    </PageContent>
  );
}
