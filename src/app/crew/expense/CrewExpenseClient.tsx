"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";

const CATEGORIES = [
  { id: "parking", label: "Parking" },
  { id: "supplies", label: "Supplies" },
  { id: "fuel", label: "Fuel" },
  { id: "tolls", label: "Tolls" },
  { id: "food", label: "Food" },
  { id: "other", label: "Other" },
];

type Expense = {
  id: string;
  job_id: string | null;
  amount_cents: number;
  category: string;
  description: string;
  receipt_storage_path: string | null;
  submitted_at: string;
  status: string;
};

export default function CrewExpenseClient() {
  const searchParams = useSearchParams();
  const jobFromUrl = searchParams.get("job") || "";
  const [category, setCategory] = useState("parking");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState(jobFromUrl);
  const [jobs, setJobs] = useState<{ id: string; jobId: string; clientName: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [todayTotal, setTodayTotal] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptStoragePath, setReceiptStoragePath] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadExpenses = () => {
    fetch("/api/crew/expenses")
      .then((r) => r.json())
      .then((d) => {
        setExpenses(d.expenses || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (jobFromUrl) setJobId(jobFromUrl);
  }, [jobFromUrl]);

  useEffect(() => {
    fetch("/api/crew/expenses?today=true")
      .then((r) => r.json())
      .then((d) => {
        setTodayTotal(d.totalTodayCents || 0);
      })
      .catch(() => {});
    loadExpenses();
    fetch("/api/crew/dashboard")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []))
      .catch(() => {});
  }, []);

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingReceipt(true);
    setReceiptPreview(null);
    setReceiptStoragePath(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/crew/expenses/receipt", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setReceiptStoragePath(data.storagePath);
      setReceiptPreview(URL.createObjectURL(file));
    } catch {
      setError("Receipt upload failed");
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  };

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
          receiptStoragePath: receiptStoragePath || undefined,
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
      setReceiptPreview(null);
      setReceiptStoragePath(null);
      setTodayTotal((t) => t + (data.amount_cents || 0));
      loadExpenses();
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
                  category === c.id ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]"
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
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-2 uppercase">Receipt photo (optional)</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptChange}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingReceipt}
              className="px-4 py-2.5 rounded-xl border border-[var(--brd)] text-[13px] font-medium text-[var(--tx)] hover:border-[var(--gold)] disabled:opacity-50"
            >
              {uploadingReceipt ? "Uploading…" : receiptStoragePath ? "Change receipt" : "Add receipt"}
            </button>
            {receiptPreview && (
              <a href={receiptPreview} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-[var(--brd)] shrink-0">
                <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
              </a>
            )}
          </div>
        </div>
        {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-xl font-semibold text-[15px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[#D4B56C] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Expense"}
        </button>
      </form>

      <div className="mt-8">
        <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Expense history</h2>
        {expenses.length === 0 ? (
          <p className="text-[13px] text-[var(--tx3)]">No expenses yet.</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[var(--bg)] border border-[var(--brd)]">
                <div>
                  <p className="text-[13px] font-medium text-[var(--tx)]">${(e.amount_cents / 100).toFixed(2)} · {e.category}</p>
                  <p className="text-[11px] text-[var(--tx3)]">{e.description}</p>
                  <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                    {new Date(e.submitted_at).toLocaleDateString()} · {e.status}
                  </p>
                </div>
                {e.receipt_storage_path && (
                  <a
                    href={`/api/crew/expenses/${e.id}/receipt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11px] text-[var(--gold)] hover:underline"
                  >
                    Receipt
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContent>
  );
}
