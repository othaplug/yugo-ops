"use client";

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
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 p-4 border border-amber-200/80 bg-amber-50/90 rounded-lg">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-amber-900">
            Adjust final price
          </h3>
          <p className="text-xs text-amber-800/90 mt-0.5">
            Owner or senior admin only. Changes are logged with a reason.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-amber-900 border border-amber-300 px-3 py-1.5 rounded-md hover:bg-amber-100/80 transition-colors"
          >
            Edit price
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-amber-800 block mb-1">
                Current price
              </label>
              <p className="text-lg font-medium text-amber-950 tabular-nums">
                ${currentPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-xs text-amber-800 block mb-1">
                New price
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-36 px-2 py-1.5 border border-amber-300 rounded-md text-lg tabular-nums bg-white text-[var(--tx)]"
              />
            </div>
            <p
              className={`text-sm font-medium pb-1 ${
                priceDiff > 0
                  ? "text-red-600"
                  : priceDiff < 0
                    ? "text-emerald-700"
                    : "text-[var(--tx3)]"
              }`}
            >
              {priceDiff === 0
                ? "No change"
                : `${priceDiff > 0 ? "+" : ""}$${priceDiff.toFixed(2)}`}
            </p>
          </div>

          <div>
            <label className="text-xs text-amber-800 block mb-1">
              Reason (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Example: extra items on site, agreed adjustment after delivery"
              className="w-full px-2 py-1.5 border border-amber-300 rounded-md text-sm bg-white text-[var(--tx)] min-h-[64px]"
              rows={2}
            />
          </div>

          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-700 text-white rounded-md text-sm font-medium disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save price change"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNewPrice(String(currentPrice));
                setReason("");
                setError(null);
              }}
              className="px-4 py-2 border border-amber-300 rounded-md text-sm text-amber-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {previousEdits.length > 0 && (
        <div className="mt-4 border-t border-amber-200 pt-3">
          <p className="text-xs text-amber-800 mb-2">Previous changes</p>
          <ul className="space-y-2 text-xs text-amber-900/90">
            {previousEdits.map((edit) => (
              <li key={edit.id}>
                {new Date(edit.created_at).toLocaleString("en-CA")}{" "}
                <span className="font-medium">{edit.edited_by_name}</span>: $
                {Number(edit.original_price).toFixed(2)} to $
                {Number(edit.new_price).toFixed(2)}
                {edit.invoice_may_need_reissue ? " (invoice may need reissue)" : ""}
                . {edit.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
