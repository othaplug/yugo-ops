"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";
import WineFadeRule from "@/components/crew/WineFadeRule";
import { toTitleCase } from "@/lib/format-text";

/** Section label — breathing room before control; sections use form gap for stack rhythm. */
const CREW_EXPENSE_EYEBROW =
  "block text-[10px] font-bold uppercase tracking-[0.12em] leading-snug text-[var(--tx2)] mb-2.5 [font-family:var(--font-body)]";

const CREW_EXPENSE_META = "text-[13px] text-[var(--tx2)]";

/** Underline-only fields — single bottom rule, forest on focus. */
const fieldCrewExpense =
  "w-full bg-transparent border-0 border-b border-[var(--brd)]/40 px-0.5 py-3.5 text-[var(--tx)] placeholder:text-[var(--tx3)]/65 rounded-none shadow-none focus:outline-none focus:ring-0 focus:border-b-[#2C3E2D]/70 transition-[border-color] duration-200";

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

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

function expenseStatusLabel(status: string): string {
  const key = status.toLowerCase();
  return EXPENSE_STATUS_LABEL[key] ?? toTitleCase(status.replace(/_/g, " "));
}

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
      <section className="max-w-[520px] mx-auto">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] hover:text-[var(--tx)] transition-colors [font-family:var(--font-body)]"
        >
          <CaretLeft size={14} weight="bold" className="shrink-0 opacity-90" aria-hidden />
          Back
        </button>

        <header className="mt-1 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-1 [font-family:var(--font-body)]">
            Crew
          </p>
          <h1 className="font-hero text-[26px] sm:text-[28px] font-bold text-[var(--tx)] leading-[1.15] tracking-tight">
            Log expense
          </h1>
          <p className={`${CREW_EXPENSE_META} mt-3 tabular-nums`}>
            Today&apos;s expenses:{" "}
            <span className="font-semibold text-[var(--tx)]">${(todayTotal / 100).toFixed(2)}</span>
          </p>
        </header>

        <div className="mt-8 sm:mt-10 rounded-2xl border border-[var(--brd)]/50 bg-[var(--card)]/30 p-5 sm:p-7 shadow-[0_10px_40px_rgba(44,62,45,0.07)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-10 sm:gap-11">
            <div className="space-y-0">
              <label className={CREW_EXPENSE_EYEBROW}>Category</label>
              <div className="flex flex-wrap gap-3 pt-0.5">
                {CATEGORIES.map((c) => {
                  const selected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`px-4 py-2.5 min-h-[44px] rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] leading-none border transition-[background-color,color,border-color,transform,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E2D]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] [font-family:var(--font-body)] ${
                        selected
                          ? "border-[#2C3E2D] bg-[#2C3E2D] text-white shadow-[0_6px_22px_rgba(44,62,45,0.22)]"
                          : "border-[var(--brd)]/65 bg-[var(--card)]/50 text-[var(--tx2)] hover:border-[var(--brd)] hover:bg-[var(--card)]/70 hover:text-[var(--tx)] active:scale-[0.99]"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="crew-expense-amount" className={CREW_EXPENSE_EYEBROW}>
                Amount
              </label>
              <input
                id="crew-expense-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="25.00"
                className={`${fieldCrewExpense} text-[17px] tabular-nums`}
                inputMode="decimal"
              />
            </div>

            <div>
              <label htmlFor="crew-expense-desc" className={CREW_EXPENSE_EYEBROW}>
                Description
              </label>
              <input
                id="crew-expense-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Parking at 200 Bloor for move"
                className={`${fieldCrewExpense} text-[15px]`}
              />
            </div>

            <div>
              <label htmlFor="crew-expense-job" className={CREW_EXPENSE_EYEBROW}>
                Link to job (optional)
              </label>
              <div className="relative border-b border-[var(--brd)]/40 transition-[border-color] duration-200 focus-within:border-b-[#2C3E2D]/70">
                <select
                  id="crew-expense-job"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full cursor-pointer appearance-none border-0 bg-transparent py-3.5 pl-0.5 pr-10 text-[15px] text-[var(--tx)] shadow-none focus:outline-none focus:ring-0"
                >
                  <option value="">— None —</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobId} · {j.clientName}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={16}
                  weight="bold"
                  className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-[var(--tx3)]"
                  aria-hidden
                />
              </div>
            </div>

            <div>
              <span className={CREW_EXPENSE_EYEBROW}>Receipt photo (optional)</span>
              <div className="mt-1 flex flex-wrap items-center gap-4">
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
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg border border-[var(--brd)]/55 bg-[var(--card)]/45 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] hover:border-[var(--brd)] hover:bg-[var(--card)]/65 hover:text-[var(--tx)] disabled:opacity-45 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E2D]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] [font-family:var(--font-body)]"
                >
                  {uploadingReceipt ? "Uploading…" : receiptStoragePath ? "Change receipt" : "Add receipt"}
                  {!uploadingReceipt && (
                    <CaretRight size={14} weight="bold" className="shrink-0 opacity-80" aria-hidden />
                  )}
                </button>
                {receiptPreview && (
                  <a
                    href={receiptPreview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-[72px] h-[72px] overflow-hidden rounded-lg border border-[var(--brd)]/40 bg-[var(--card)]/40 shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:opacity-95 transition-opacity"
                  >
                    <img src={receiptPreview} alt="Receipt preview" className="w-full h-full object-cover" />
                  </a>
                )}
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              {error ? (
                <p className="text-[12px] font-medium text-[var(--red)] mb-4" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="crew-premium-cta w-full min-h-[52px] inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-white disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C1A33]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] [font-family:var(--font-body)]"
              >
                {submitting ? (
                  "Submitting…"
                ) : (
                  <>
                    Submit expense
                    <CaretRight size={16} weight="bold" className="shrink-0" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-16 sm:mt-20">
          <div className="mb-10">
            <WineFadeRule className="opacity-60" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-2 [font-family:var(--font-body)]">
              History
            </p>
            <h2 className="font-hero text-[20px] sm:text-[22px] font-bold text-[var(--tx)] tracking-tight">
              Expense history
            </h2>
            {expenses.length === 0 ? (
              <p className="mt-8 text-[14px] text-[var(--tx3)] leading-relaxed max-w-[32ch]">
                No expenses logged yet.
              </p>
            ) : (
              <ul className="mt-8 space-y-0">
                {expenses.map((e, i) => (
                  <li
                    key={e.id}
                    className={`flex items-start justify-between gap-5 py-7 first:pt-2 ${
                      i < expenses.length - 1 ? "border-b border-[var(--brd)]/20" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--tx)] tabular-nums tracking-tight">
                        ${(e.amount_cents / 100).toFixed(2)} · {toTitleCase(e.category)}
                      </p>
                      <p className="text-[13px] text-[var(--tx2)] mt-1.5 leading-relaxed">{e.description}</p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--tx3)] mt-3">
                        {new Date(e.submitted_at).toLocaleDateString()} · {expenseStatusLabel(e.status)}
                      </p>
                    </div>
                    {e.receipt_storage_path ? (
                      <a
                        href={`/api/crew/expenses/${e.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] hover:text-[var(--tx)] transition-colors pt-0.5 [font-family:var(--font-body)]"
                      >
                        Receipt
                        <CaretRight size={12} weight="bold" aria-hidden />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </PageContent>
  );
}
