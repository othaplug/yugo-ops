"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import { formatCurrency } from "@/lib/format-currency";
import { Warning } from "@phosphor-icons/react";

type TruckA = {
  current_score?: number;
  new_score?: number;
  current_truck?: string;
  truck_capacity?: number;
  fits?: boolean;
  recommendation?: string | null;
};

export default function InventoryChangeRequestPanel({
  request,
}: {
  request: {
    id: string;
    status: string;
    submitted_at: string;
    items_added: unknown;
    items_removed: unknown;
    auto_calculated_delta: number;
    admin_adjusted_delta: number | null;
    truck_assessment: TruckA | null;
    admin_notes: string | null;
    decline_reason: string | null;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState(String(request.auto_calculated_delta));
  const [adjustNote, setAdjustNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | "adjust" | null>(null);

  const added = Array.isArray(request.items_added) ? request.items_added : [];
  const removed = Array.isArray(request.items_removed) ? request.items_removed : [];
  const truck = request.truck_assessment;
  const timeImpact = Math.min(6, (added.length + removed.length) * 0.5);

  const run = async (body: Record<string, unknown>) => {
    setBusy(body.action === "decline" ? "decline" : adjustOpen ? "adjust" : "approve");
    try {
      const res = await fetch(`/api/admin/inventory-change-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed");
      toast(body.action === "decline" ? "Request declined, client notified." : "Request approved, move and client updated.", "check");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-4 mb-6">
      <div className="flex items-start gap-2 mb-3">
        <Warning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" weight="regular" />
        <div>
          <h3 className="text-[12px] font-bold text-[var(--tx)]">Pending inventory change request</h3>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5">
            Submitted {new Date(request.submitted_at).toLocaleString()}
          </p>
        </div>
      </div>

      {added.length > 0 && (
        <div className="mb-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">Adding</div>
          <ul className="text-[11px] text-[var(--tx2)] space-y-0.5">
            {(added as Record<string, unknown>[]).map((row, i) => {
              const pending =
                row.pending_coordinator_pricing === true ||
                row.surcharge === null ||
                row.surcharge === undefined;
              return (
              <li key={`a-${i}`}>
                {(row.item_name as string) || "Item"} ×{Number(row.quantity) || 1}{" "}
                <span className="text-[var(--gold)]">
                  {pending ? (
                    <span className="text-[var(--tx3)] normal-case">(pending coordinator pricing)</span>
                  ) : (
                    <>+{formatCurrency(Number(row.surcharge) || 0)}</>
                  )}
                </span>
              </li>
            );
            })}
          </ul>
        </div>
      )}

      {removed.length > 0 && (
        <div className="mb-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">Removing</div>
          <ul className="text-[11px] text-[var(--tx2)] space-y-0.5">
            {(removed as Record<string, unknown>[]).map((row, i) => (
              <li key={`r-${i}`}>
                {(row.item_name as string) || "Item"} ×{Number(row.quantity) || 1}{" "}
                <span className="text-emerald-600/90">
                  {formatCurrency(Number(row.credit) || 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[11px] text-[var(--tx)] mb-2">
        Auto-calculated net:{" "}
        <strong className={request.auto_calculated_delta >= 0 ? "text-[var(--gold)]" : "text-emerald-600"}>
          {request.auto_calculated_delta >= 0 ? "+" : ""}
          {formatCurrency(request.auto_calculated_delta)}
        </strong>
      </div>

      {truck && (
        <div className="text-[10px] text-[var(--tx3)] mb-3 space-y-0.5">
          <div>
            Truck: {truck.current_truck}, score {truck.current_score ?? "-"} / cap {truck.truck_capacity ?? "-"}
          </div>
          <div>
            After change: {truck.new_score ?? "-"} / {truck.truck_capacity ?? "-"}{" "}
            {truck.fits ? <span className="text-emerald-600 font-semibold">Fits</span> : <span className="text-amber-600 font-semibold">Over capacity</span>}
          </div>
          {truck.recommendation && <div className="text-amber-600/90">{truck.recommendation}</div>}
        </div>
      )}

      <div className="text-[10px] text-[var(--tx3)] mb-3">Est. time impact: +{timeImpact}h (guideline)</div>

      {!adjustOpen ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run({ action: "approve" })}
            className="px-3 py-2 rounded-lg text-[11px] font-bold bg-[var(--grn)]/90 text-white disabled:opacity-50"
          >
            {busy === "approve" ? "…" : `Accept (${request.auto_calculated_delta >= 0 ? "+" : ""}${formatCurrency(request.auto_calculated_delta)})`}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setAdjustDelta(String(request.auto_calculated_delta));
              setAdjustOpen(true);
            }}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] disabled:opacity-50"
          >
            Adjust price
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run({ action: "decline", decline_reason: declineReason || "Unable to accommodate this change." })}
            className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Adjusted net ($)</label>
          <input
            type="number"
            value={adjustDelta}
            onChange={(e) => setAdjustDelta(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px] text-[var(--tx)]"
          />
          <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Note to client</label>
          <textarea
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)]"
            placeholder="Why the price differs from auto-calc…"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setAdjustOpen(false)}
              className="flex-1 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run({
                  action: "approve",
                  admin_adjusted_delta: parseFloat(adjustDelta),
                  admin_notes: adjustNote.trim(),
                })
              }
              className="flex-1 py-2 rounded-lg bg-[var(--admin-primary-fill)] text-[11px] font-bold text-[var(--btn-text-on-accent)] disabled:opacity-50"
            >
              {busy === "adjust" ? "…" : "Apply adjusted price"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--brd)]/40">
        <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Decline reason (optional if using Decline)</label>
        <textarea
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)]"
          placeholder="Shown to the client if you decline…"
        />
      </div>
    </div>
  );
}
