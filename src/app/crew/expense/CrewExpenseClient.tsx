"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";
import WineFadeRule from "@/components/crew/WineFadeRule";
import { toTitleCase } from "@/lib/format-text";

const fieldSurface =
  "w-full px-4 py-3.5 rounded-xl bg-white/[0.06] text-[var(--tx)] placeholder:text-[var(--tx3)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/35 focus:bg-white/[0.09] transition-colors";

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
  const router = useRouter();
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
      <button type="button" onClick={() => router.back()} className="inline-flex gap-1.5 py-2 text-[12px] text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
        ← Back
      </button>
      <div className="mt-2">
        <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/60 mb-0.5">Crew</p>
        <h1 className="font-hero text-[26px] font-bold text-[var(--tx)]">Log Expense</h1>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mt-1">Today&apos;s expenses: ${(todayTotal / 100).toFixed(2)}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        <div>
          <label className="block text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-2 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/40 ${
                  category === c.id
                    ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm"
                    : "bg-white/[0.06] text-[var(--tx2)] hover:bg-white/[0.1] active:bg-white/[0.12]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25.00"
            className={`${fieldSurface} text-[16px]`}
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Parking at 200 Bloor for move"
            className={fieldSurface}
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Link to job (optional)</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className={`${fieldSurface} cursor-pointer appearance-none bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-11`}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 256 256'%3E%3Cpath d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 53.66 90.34L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E")`,
            }}
          >
            <option value="">- None -</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.jobId} · {j.clientName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Receipt photo (optional)</label>
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
              className="px-3 py-2 text-[13px] font-medium text-[var(--tx)] bg-white/[0.06] hover:bg-[var(--gold)]/12 hover:text-[var(--gold)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/35"
            >
              {uploadingReceipt ? "Uploading…" : receiptStoragePath ? "Change receipt" : "Add receipt"}
            </button>
            {receiptPreview && (
              <a
                href={receiptPreview}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-16 h-16 rounded-xl overflow-hidden bg-white/[0.06] shrink-0 opacity-95 hover:opacity-100 transition-opacity"
              >
                <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
              </a>
            )}
          </div>
        </div>
        <div>
          {error && <p className="text-[12px] text-[var(--red)] mb-3">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 font-semibold text-[15px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[#D4B56C] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            {submitting ? "Submitting…" : "Submit expense"}
          </button>
        </div>
      </form>

      <div className="mt-10 space-y-5">
        <WineFadeRule />
        <div>
          <h2 className="admin-section-h2 mb-4">Expense history</h2>
          {expenses.length === 0 ? (
            <p className="text-[13px] text-[var(--tx3)]">No expenses yet.</p>
          ) : (
            <ul className="space-y-6">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--tx)]">
                      ${(e.amount_cents / 100).toFixed(2)} · {toTitleCase(e.category)}
                    </p>
                    <p className="text-[11px] text-[var(--tx3)]">{e.description}</p>
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                      {new Date(e.submitted_at).toLocaleDateString()} · {toTitleCase(e.status)}
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
      </div>
    </PageContent>
  );
}
