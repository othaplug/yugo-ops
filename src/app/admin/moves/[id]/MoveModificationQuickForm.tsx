"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown as ChevronDown, CaretRight as ChevronRight } from "@phosphor-icons/react";
import { useToast } from "../../components/Toast";

export default function MoveModificationQuickForm({
  moveId,
  disabled,
}: {
  moveId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = useState("date_change");
  const [newDate, setNewDate] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const changes: Record<string, string> = {};
      if (newDate.trim()) changes.new_date = newDate.trim();
      if (newFrom.trim()) changes.new_from_address = newFrom.trim();
      if (newTo.trim()) changes.new_to_address = newTo.trim();

      const payload: Record<string, unknown> = {
        type,
        changes,
        requested_by: "coordinator",
      };
      if (newPrice.trim()) {
        const n = parseFloat(newPrice);
        if (!Number.isNaN(n)) payload.new_price = n;
      }

      const res = await fetch(`/api/admin/moves/${moveId}/modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed");
      toast("Modification recorded", "check");
      setNewDate("");
      setNewFrom("");
      setNewTo("");
      setNewPrice("");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return null;

  return (
    <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg)]/50 transition-colors"
        aria-expanded={expanded}
        aria-controls="modify-booking-panel"
        id="modify-booking-heading"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--tx3)] shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--tx3)] shrink-0" aria-hidden />
        )}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
          Modify booking
        </h3>
      </button>
      {expanded && (
        <div
          id="modify-booking-panel"
          className="px-4 pb-4 pt-0 border-t border-[var(--brd)]/50"
          role="region"
          aria-labelledby="modify-booking-heading"
        >
      <p className="text-[10px] text-[var(--tx3)] mb-3 leading-relaxed pt-3">
        Record a date, address, or price adjustment. If the price increases, the client must approve
        the change from their track-your-move link before it applies.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] text-[var(--tx3)] sm:col-span-2">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-0.5 admin-premium-input w-full"
          >
            <option value="date_change">Date change</option>
            <option value="address_change">Address change</option>
            <option value="tier_change">Tier change</option>
            <option value="inventory_change">Inventory change</option>
          </select>
        </label>
        <label className="text-[10px] text-[var(--tx3)]">
          New move date
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="mt-0.5 admin-premium-input w-full"
          />
        </label>
        <label className="text-[10px] text-[var(--tx3)]">
          New total price (optional)
          <input
            type="number"
            step="0.01"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Leave blank to keep"
            className="mt-0.5 admin-premium-input w-full"
          />
        </label>
        <label className="text-[10px] text-[var(--tx3)] sm:col-span-2">
          New from address
          <input
            value={newFrom}
            onChange={(e) => setNewFrom(e.target.value)}
            className="mt-0.5 admin-premium-input w-full"
          />
        </label>
        <label className="text-[10px] text-[var(--tx3)] sm:col-span-2">
          New to address
          <input
            value={newTo}
            onChange={(e) => setNewTo(e.target.value)}
            className="mt-0.5 admin-premium-input w-full"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-3 w-full sm:w-auto px-4 py-2 rounded-lg border border-[#2C3E2D] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx)] hover:bg-[#2C3E2D]/6 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save modification"}
      </button>
        </div>
      )}
    </div>
  );
}
