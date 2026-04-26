"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";

const METHODS = [
  { value: "none", label: "No tip" },
  { value: "cash", label: "Cash" },
  { value: "interac", label: "Interac e-Transfer" },
] as const;

export default function CrewTipReportPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";
  const router = useRouter();
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("none");
  const [amount, setAmount] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const amountDollars =
      method === "none" ? 0 : Number.parseFloat(amount.replace(/,/g, "")) || 0;
    if (method !== "none" && amountDollars <= 0) {
      setError("Enter the tip amount");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/tips/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          jobType,
          method,
          amountDollars,
          neighbourhood: neighbourhood.trim() || undefined,
          reportNote: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        setSubmitting(false);
        return;
      }
      router.push(`/crew/dashboard/job/${jobType}/${id}`);
      router.refresh();
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  };

  return (
    <PageContent className="crew-job-premium w-full min-w-0 max-w-[520px] mx-auto">
      <div className="mb-6">
        <Link
          href={`/crew/dashboard/job/${jobType}/${id}`}
          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-[var(--yu3-r-md)] text-[12px] font-medium text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-wine)] hover:bg-[var(--yu3-wine-tint)] transition-colors [font-family:var(--font-body)]"
        >
          <CaretLeft size={15} weight="regular" />
          Back to job
        </Link>
      </div>

      <h1 className="font-hero text-[24px] font-semibold text-[var(--yu3-wine)] mb-2 tracking-tight">
        Tip report
      </h1>
      <p className="text-[12px] text-[var(--yu3-ink-muted)] mb-6 leading-relaxed [font-family:var(--font-body)]">
        Record tips received outside the app, or confirm there was no tip. Card tips
        from the client quote flow are logged automatically.
      </p>

      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] mb-2 block">
            Method
          </legend>
          <div className="flex flex-col gap-2">
            {METHODS.map((m) => (
              <label
                key={m.value}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-3 py-2.5 cursor-pointer"
              >
                <input
                  type="radio"
                  name="tip-method"
                  checked={method === m.value}
                  onChange={() => setMethod(m.value)}
                  className="h-4 w-4 accent-[var(--yu3-wine)]"
                />
                <span className="text-[13px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                  {m.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {method !== "none" && (
          <div>
            <label
              htmlFor="tip-amount"
              className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] block mb-1.5"
            >
              Amount (CAD)
            </label>
            <input
              id="tip-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] text-[var(--yu3-ink)] text-[15px] outline-none focus:ring-2 focus:ring-[var(--yu3-wine)]/25 [font-family:var(--font-body)]"
              autoComplete="off"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="tip-neighbourhood"
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] block mb-1.5"
          >
            Neighbourhood (optional)
          </label>
          <input
            id="tip-neighbourhood"
            type="text"
            value={neighbourhood}
            onChange={(e) => setNeighbourhood(e.target.value)}
            placeholder="e.g. Leslieville"
            className="w-full px-3.5 py-2.5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] text-[var(--yu3-ink)] text-[15px] outline-none focus:ring-2 focus:ring-[var(--yu3-wine)]/25 [font-family:var(--font-body)]"
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="tip-note"
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] block mb-1.5"
          >
            Note (optional)
          </label>
          <textarea
            id="tip-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] text-[var(--yu3-ink)] text-[13px] outline-none focus:ring-2 focus:ring-[var(--yu3-wine)]/25 [font-family:var(--font-body)] resize-none"
          />
        </div>

        {error && (
          <p className="text-[12px] text-red-700 [font-family:var(--font-body)]">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="crew-premium-cta w-full inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.12em] text-[#fffbf7] disabled:opacity-50 [font-family:var(--font-body)] leading-none active:scale-[0.99]"
        >
          {submitting ? (
            "Saving…"
          ) : (
            <>
              Submit report
              <CaretRight size={18} weight="bold" className="shrink-0 opacity-95" aria-hidden />
            </>
          )}
        </button>
      </div>
    </PageContent>
  );
}
