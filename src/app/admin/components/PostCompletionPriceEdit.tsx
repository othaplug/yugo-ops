"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

type PriceEditRow = {
  id: string;
  original_price: number;
  new_price: number;
  difference: number;
  reason: string;
  edited_by_name: string;
  created_at: string;
  invoice_may_need_reissue?: boolean | null;
};

const sanitizeShownError = (raw: string): string => {
  if (
    /schema cache|Could not find the table|job_final_price_edits|PGRST205/i.test(raw)
  ) {
    return "Price history could not be saved because the database is not fully updated. Apply pending Supabase migrations, then try again.";
  }
  return raw;
};

export default function PostCompletionPriceEdit({
  jobType,
  jobId,
  currentPrice,
  canEdit,
  previousEdits,
  completed,
}: {
  jobType: "move" | "delivery";
  jobId: string;
  currentPrice: number;
  canEdit: boolean;
  previousEdits: PriceEditRow[];
  completed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newPrice, setNewPrice] = useState(String(currentPrice));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceDiff = useMemo(() => {
    const n = parseFloat(newPrice);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n - currentPrice) * 100) / 100;
  }, [newPrice, currentPrice]);

  if (!completed || !canEdit) return null;

  const handleSave = async () => {
    setError(null);
    const n = parseFloat(newPrice);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError("Add a short reason for the change");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/job-final-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType,
          jobId,
          newPrice: n,
          reason: reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string" ? data.error : "Save failed";
        setError(sanitizeShownError(msg));
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setNewPrice(String(currentPrice));
    setReason("");
    setError(null);
  };

  const outlineBtn =
    "inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-[var(--tx)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx)] bg-transparent hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tx)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] transition-colors disabled:opacity-45 disabled:pointer-events-none";

  const ghostBtn =
    "inline-flex items-center justify-center rounded-md border border-[var(--brd)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] bg-transparent hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tx)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] transition-colors";

  const fieldClass =
    "w-full rounded-md border border-[var(--brd)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--tx)] placeholder:text-[var(--tx3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tx)]/20 focus-visible:border-[var(--brd)]";

  return (
    <div className="mt-6 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 md:p-5 shadow-sm shadow-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx3)]">
            Billing
          </p>
          <h3 className="m-0 pb-0 font-heading text-[15px] font-semibold leading-snug tracking-[0.01em] text-[var(--tx)] md:text-base">
            Adjust final price
          </h3>
          <p className="text-xs text-[var(--tx3)] leading-relaxed max-w-prose">
            Owner or senior admin only. Each change is stored with your reason.
          </p>
        </div>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${ghostBtn} shrink-0`}
          >
            Edit price
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label
                htmlFor={`current-price-${jobId}`}
                className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx3)]"
              >
                Current price
              </label>
              <p
                id={`current-price-${jobId}`}
                className="text-xl font-semibold tabular-nums text-[var(--tx)] md:text-2xl"
              >
                ${currentPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <label
                htmlFor={`new-price-${jobId}`}
                className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx3)]"
              >
                New price
              </label>
              <input
                id={`new-price-${jobId}`}
                type="number"
                step="0.01"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={`${fieldClass} max-w-[11rem] tabular-nums text-base font-medium md:text-lg`}
                aria-describedby={`price-delta-${jobId}`}
              />
            </div>
            <div className="sm:pb-1">
              <p
                id={`price-delta-${jobId}`}
                className={`text-sm font-semibold tabular-nums ${
                  priceDiff > 0
                    ? "text-[var(--red)]"
                    : priceDiff < 0
                      ? "text-[var(--grn)]"
                      : "text-[var(--tx3)]"
                }`}
              >
                {priceDiff === 0
                  ? "No change"
                  : `${priceDiff > 0 ? "+" : ""}$${priceDiff.toFixed(2)}`}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor={`price-reason-${jobId}`}
              className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx3)]"
            >
              Reason (required)
            </label>
            <textarea
              id={`price-reason-${jobId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Example: extra items on site, agreed adjustment after delivery"
              className={`${fieldClass} min-h-[80px] resize-y leading-relaxed`}
              rows={3}
            />
          </div>

          {error ? (
            <div
              className="rounded-md border border-[var(--red)]/35 bg-[var(--rdim)] px-3 py-2 text-sm text-[var(--red)]"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={outlineBtn}
            >
              {saving ? "Saving" : "Save price change"}
              {!saving ? <CaretRight size={16} weight="bold" aria-hidden /> : null}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className={`${ghostBtn} disabled:opacity-45`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {previousEdits.length > 0 ? (
        <div className="mt-5 border-t border-[var(--brd)] pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx3)]">
            Previous changes
          </p>
          <ul className="space-y-3 text-xs leading-relaxed text-[var(--tx2)]">
            {previousEdits.map((edit) => (
              <li
                key={edit.id}
                className="rounded-lg border border-[var(--brd)]/80 bg-[var(--surface)]/60 px-3 py-2.5"
              >
                <span className="text-[var(--tx3)]">
                  {new Date(edit.created_at).toLocaleString("en-CA")}
                </span>{" "}
                <span className="font-semibold text-[var(--tx)]">
                  {edit.edited_by_name}
                </span>
                {": "}
                ${Number(edit.original_price).toFixed(2)} to $
                {Number(edit.new_price).toFixed(2)}
                {edit.invoice_may_need_reissue ? (
                  <span className="text-[var(--org)]">
                    {" "}
                    (invoice may need reissue)
                  </span>
                ) : null}
                . {edit.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
