"use client";

import { useState, useEffect } from "react";

interface InventoryRoom {
  room: string;
  items: string[];
  itemsWithId?: { id: string; item_name: string }[];
}

interface ExtraItem {
  id: string;
  description?: string;
  room?: string | null;
  quantity?: number;
  added_at?: string;
}

interface JobInventoryProps {
  jobId: string;
  jobType: "move" | "delivery";
  inventory: InventoryRoom[];
  extraItems: ExtraItem[];
  currentStatus: string;
  onRefresh?: () => void;
}

export default function JobInventory({
  jobId,
  jobType,
  inventory,
  extraItems,
  currentStatus,
  onRefresh,
}: JobInventoryProps) {
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraRoom, setExtraRoom] = useState("");
  const [extraQty, setExtraQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const isUnloading = ["unloading", "arrived_at_destination", "delivering", "completed"].includes(currentStatus);

  useEffect(() => {
    if (jobType !== "move") return;
    fetch(`/api/crew/inventory/${jobId}/verifications?stage=${isUnloading ? "unloading" : "loading"}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.verifiedIds) setVerifiedIds(new Set(d.verifiedIds));
      })
      .catch(() => {});
  }, [jobId, jobType, isUnloading]);

  const toggleVerify = async (moveInventoryId: string) => {
    const isVerified = verifiedIds.has(moveInventoryId);
    if (isVerified) return;
    try {
      const res = await fetch(`/api/crew/inventory/${jobId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveInventoryId, stage: isUnloading ? "unloading" : "loading" }),
      });
      if (!res.ok) throw new Error("Failed");
      setVerifiedIds((prev) => new Set([...prev, moveInventoryId]));
    } catch {}
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraDesc.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/crew/inventory/${jobId}/extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: extraDesc.trim(),
          room: extraRoom.trim() || null,
          quantity: extraQty,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setAddExtraOpen(false);
      setExtraDesc("");
      setExtraRoom("");
      setExtraQty(1);
      onRefresh?.();
    } catch {}
    setSubmitting(false);
  };

  if (jobType === "delivery" && inventory.length === 0 && extraItems.length === 0) return null;
  if (jobType === "move" && inventory.length === 0 && extraItems.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">
        {isUnloading ? "Unloading Verification" : "Inventory"}
      </h2>
      {inventory.map((r) => (
        <div key={r.room} className="mb-3">
          <div className="text-[12px] font-semibold text-[var(--tx)] mb-1.5">{r.room}</div>
          <div className="space-y-1.5">
            {(r.itemsWithId || r.items.map((name, i) => ({ id: `noid-${i}`, item_name: name }))).map((item, i) => {
              const id = "id" in item ? item.id : `noid-${i}`;
              const name = "item_name" in item ? item.item_name : String(item);
              const hasId = typeof id === "string" && !id.startsWith("noid-");
              const verified = hasId ? verifiedIds.has(id) : false;
              return (
                <label
                  key={id}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-lg border transition-colors ${
                    verified ? "bg-[var(--grn)]/10 border-[var(--grn)]/30" : "bg-[var(--bg)] border-[var(--brd)]"
                  } ${hasId ? "cursor-pointer hover:border-[var(--gold)]/40" : ""}`}
                >
                  {hasId ? (
                    <input
                      type="checkbox"
                      checked={verified}
                      onChange={() => toggleVerify(id)}
                      className="rounded border-[var(--brd)]"
                    />
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className="text-[13px] text-[var(--tx)]">{name}</span>
                  {verified && <span className="text-[10px] text-[var(--grn)] ml-auto">✓</span>}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {extraItems.length > 0 && (
        <div className="mb-3">
          <div className="text-[12px] font-semibold text-[var(--gold)] mb-1.5">Added on-site</div>
          {extraItems.map((e) => (
            <div key={e.id} className="py-1.5 px-3 rounded-lg bg-[var(--gdim)]/30 border border-[var(--gold)]/20 text-[12px]">
              {e.description ?? "—"} {(e.quantity ?? 1) > 1 && `×${e.quantity}`} {e.room && `(${e.room})`}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setAddExtraOpen(true)}
        className="w-full py-2.5 rounded-lg border border-dashed border-[var(--brd)] text-[12px] font-medium text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
      >
        + Add Extra Item
      </button>
      {addExtraOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 max-w-[340px] w-full">
            <h3 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-4">Add Extra Item</h3>
            <form onSubmit={handleAddExtra} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Description</label>
                <input
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                  placeholder="e.g. Extra boxes from garage"
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={extraQty}
                  onChange={(e) => setExtraQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Room (optional)</label>
                <input
                  value={extraRoom}
                  onChange={(e) => setExtraRoom(e.target.value)}
                  placeholder="e.g. Garage"
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAddExtraOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx)] text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !extraDesc.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-[#0D0D0D] font-semibold disabled:opacity-50"
                >
                  {submitting ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
