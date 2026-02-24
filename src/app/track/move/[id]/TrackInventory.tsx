"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/admin/components/Toast";
import { expandItemRow } from "@/lib/inventory-parse";

type InventoryItem = {
  id: string;
  room: string;
  item_name: string;
  box_number: string | null;
  sort_order: number;
  /** Set for extra items so item column shows name only and Qty column shows this */
  quantity?: number;
};

type ExtraItem = {
  id: string;
  description?: string | null;
  room?: string | null;
  quantity?: number;
  added_at?: string;
};

export default function TrackInventory({ moveId, token }: { moveId: string; token: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraRoom, setExtraRoom] = useState("");
  const [extraQty, setExtraQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/track/moves/${moveId}/inventory?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setExtraItems(data.extraItems ?? []);
      })
      .catch(() => { if (!cancelled) { setItems([]); setExtraItems([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moveId, token]);

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraDesc.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/track/moves/${moveId}/extra-item?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: extraDesc.trim(),
          room: extraRoom.trim() || null,
          quantity: extraQty,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to submit request");
      }
      setAddExtraOpen(false);
      setExtraDesc("");
      setExtraRoom("");
      setExtraQty(1);
      toast("Request submitted for approval", "check");
      fetch(`/api/track/moves/${moveId}/inventory?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((data) => {
          setItems(data.items ?? []);
          setExtraItems(data.extraItems ?? []);
        })
        .catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to submit request", "x");
    }
    setSubmitting(false);
  };

  const handleExport = () => {
    const rows = items.flatMap((i) => {
      const expanded = expandItemRow(i.item_name);
      return expanded.map((r) => ({ Room: i.room || "", Item: r.label, Qty: r.qty }));
    });
    const csv = ["Room,Item,Qty", ...rows.map((r) => `"${r.Room}","${r.Item}","${r.Qty}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${moveId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const byRoom = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const room = item.room || "Uncategorized";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});
  if (extraItems.length > 0) {
    const room = "Added on-site";
    if (!byRoom[room]) byRoom[room] = [];
    extraItems.forEach((e) => {
      byRoom[room].push({
        id: e.id,
        room,
        item_name: (e.description ?? "—").trim(),
        box_number: e.room || null,
        sort_order: 0,
        quantity: e.quantity ?? 1,
      });
    });
  }
  const rooms = Object.keys(byRoom).sort();

  const toggleRoom = (room: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };
  const isExpanded = (room: string) => !collapsedRooms.has(room);

  if (loading) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] mb-4">
          Inventory
        </h3>
        <p className="text-[12px] text-[#666]">Loading...</p>
      </div>
    );
  }

  if (items.length === 0 && extraItems.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] mb-4">
          Inventory
        </h3>
        <p className="text-[12px] text-[#666] mb-4">No inventory items logged yet. Your coordinator will add items as your move is prepared.</p>
        <button
          type="button"
          onClick={() => setAddExtraOpen(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#E7E5E4] text-[12px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
        >
          + Add Extra Item
        </button>
        {addExtraOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-5 max-w-[340px] w-full shadow-xl">
              <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-2">Add Extra Item</h3>
              <p className="text-[11px] text-[#666] mb-4">Your request will be sent to your coordinator for approval.</p>
              <form onSubmit={handleAddExtra} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[#666] mb-1">Description</label>
                  <input
                    value={extraDesc}
                    onChange={(e) => setExtraDesc(e.target.value)}
                    placeholder="e.g. Extra boxes from garage"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1A1A1A] text-[13px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#666] mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={extraQty}
                    onChange={(e) => setExtraQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1A1A1A] text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#666] mb-1">Room (optional)</label>
                  <input
                    value={extraRoom}
                    onChange={(e) => setExtraRoom(e.target.value)}
                    placeholder="e.g. Garage"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1A1A1A] text-[13px]"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setAddExtraOpen(false)} className="flex-1 py-2.5 rounded-lg border border-[#E7E5E4] text-[#1A1A1A] text-[13px]">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting || !extraDesc.trim()} className="flex-1 py-2.5 rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold disabled:opacity-50">
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#1A1A1A]">
          Inventory
        </h3>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#E7E5E4] text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
        >
          Export
        </button>
      </div>
      <div className="p-5 space-y-2">
        {rooms.map((room) => {
          const expanded = isExpanded(room);
          return (
            <div key={room} className="rounded-lg border border-[#E7E5E4] overflow-hidden transition-colors hover:border-[#D4D4D4]">
              <button
                type="button"
                onClick={() => toggleRoom(room)}
                className="w-full flex items-center justify-between gap-2 bg-[#FAFAF8] px-4 py-2.5 text-left hover:bg-[#F5F5F3] transition-colors cursor-pointer group border-b border-[#E7E5E4]"
              >
                <h4 className="text-[12px] font-bold text-[#C9A962] group-hover:text-[#B8983E] transition-colors">{room}</h4>
                <span className={`text-[10px] text-[#999] transition-transform duration-200 ease-out inline-block ${expanded ? "rotate-0" : "-rotate-90"}`} aria-hidden>▼</span>
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-[#F5F5F3]">
                        <th className="text-[10px] font-bold uppercase tracking-wider text-[#666] px-4 py-3 border-b-2 border-[#E7E5E4] w-[1%] whitespace-nowrap">Item</th>
                        <th className="text-[10px] font-bold uppercase tracking-wider text-[#666] px-4 py-3 border-b-2 border-[#E7E5E4] text-right w-16">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byRoom[room].flatMap((item) => {
                        const capitalize = (str: string) =>
                          str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;
                        const rows = expandItemRow(item.item_name);
                        return rows.map((r, ri) => {
                          const qty = rows.length === 1 && item.quantity != null ? item.quantity : r.qty;
                          return (
                            <tr key={`${item.id}-${ri}`} className="border-b border-[#E7E5E4] last:border-0 hover:bg-[#FAFAF8]/60 transition-colors">
                              <td className="px-4 py-3 text-[13px] font-medium text-[#1A1A1A] align-middle">{capitalize(r.label)}</td>
                              <td className="px-4 py-3 text-[13px] font-medium text-[#1A1A1A] text-right align-middle tabular-nums w-16">{qty}</td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-4 border-t border-[#E7E5E4]">
        <button
          type="button"
          onClick={() => setAddExtraOpen(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#E7E5E4] text-[12px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
        >
          + Add Extra Item
        </button>
      </div>
      {addExtraOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 max-w-[340px] w-full shadow-xl">
            <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-2">Add Extra Item</h3>
            <p className="text-[11px] text-[#666] mb-4">Your request will be sent to your coordinator for approval.</p>
            <form onSubmit={handleAddExtra} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#666] mb-1">Description</label>
                <input
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                  placeholder="e.g. Extra boxes from garage"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1A1A1A] text-[13px]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#666] mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={extraQty}
                  onChange={(e) => setExtraQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1A1A1A] text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#666] mb-1">Room (optional)</label>
                <input
                  value={extraRoom}
                  onChange={(e) => setExtraRoom(e.target.value)}
                  placeholder="e.g. Garage"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-[#1A1A1A] text-[13px]"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAddExtraOpen(false)} className="flex-1 py-2.5 rounded-lg border border-[#E7E5E4] text-[#1A1A1A] text-[13px]">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !extraDesc.trim()} className="flex-1 py-2.5 rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold disabled:opacity-50">
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

