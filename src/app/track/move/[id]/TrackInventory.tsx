"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/admin/components/Toast";
import { expandItemRow } from "@/lib/inventory-parse";
import {
  CaretDown,
  CaretRight,
  X,
  Plus,
  DownloadSimple,
} from "@phosphor-icons/react";
import {
  WINE,
  FOREST,
  TEXT_MUTED_ON_LIGHT,
} from "@/lib/client-theme";
import { QUOTE_EYEBROW_CLASS } from "@/app/quote/[quoteId]/quote-shared";

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

function SkeletonRow() {
  return (
    <tr
      className="border-b last:border-0"
      style={{ borderColor: `${FOREST}08` }}
    >
      <td className="px-5 py-3.5">
        <div className="h-3 bg-[#E7E5E4] animate-pulse w-2/5" />
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="h-3 bg-[#E7E5E4] animate-pulse w-6 ml-auto" />
      </td>
    </tr>
  );
}

function SkeletonRoom({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden border"
      style={{ borderColor: `${FOREST}14` }}
    >
      <div
        className="px-5 py-3.5 flex items-center justify-between border-b"
        style={{
          backgroundColor: `${FOREST}05`,
          borderColor: `${FOREST}10`,
        }}
      >
        <div className="h-3 bg-[#E7E5E4] animate-pulse w-28" />
        <div className="h-3 bg-[#E7E5E4] animate-pulse w-8" />
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
        </tbody>
      </table>
    </div>
  );
}

export default function TrackInventory({
  moveId,
  token,
  moveComplete = false,
  className = "",
  /** Estate tier, 3+ BR: no itemized list; walkthrough scope copy only */
  estateWalkthroughScopeOnly = false,
}: {
  moveId: string;
  token: string;
  moveComplete?: boolean;
  /** e.g. `mb-6` for tab content spacing — avoids a parent wrapper div */
  className?: string;
  estateWalkthroughScopeOnly?: boolean;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(() => !estateWalkthroughScopeOnly);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraRoom, setExtraRoom] = useState("");
  const [extraQty, setExtraQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (estateWalkthroughScopeOnly) return;
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
  }, [moveId, token, estateWalkthroughScopeOnly]);

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

  const uppercase = (str: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;

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
        item_name: (e.description ?? "-").trim(),
        box_number: e.room || null,
        sort_order: 0,
        quantity: e.quantity ?? 1,
      });
    });
  }
  const rooms = Object.keys(byRoom).sort();

  const totalItemCount = items.reduce((sum, item) => {
    const rows = expandItemRow(item.item_name);
    return sum + rows.reduce((s, r) => s + r.qty, 0);
  }, 0) + extraItems.reduce((sum, e) => sum + (e.quantity ?? 1), 0);

  const roomItemCount = (room: string) =>
    byRoom[room]?.reduce((sum, item) => {
      const rows = expandItemRow(item.item_name);
      return sum + rows.reduce((s, r) => {
        const qty = rows.length === 1 && item.quantity != null ? item.quantity : r.qty;
        return s + qty;
      }, 0);
    }, 0) ?? 0;

  const toggleRoom = (room: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };
  const isExpanded = (room: string) => !collapsedRooms.has(room);

  const AddExtraModal = () => (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      style={{ minHeight: "100dvh" }}
      onClick={(e) => { if (e.target === e.currentTarget) setAddExtraOpen(false); }}
    >
      <div className="bg-white w-full max-w-[400px] shadow-2xl overflow-hidden my-auto">
        <div className="px-5 pt-5 pb-4 border-b border-[#E7E5E4]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Request change</h3>
              <p className="text-[12px] text-[#4F4B47] mt-0.5">Sent to your coordinator for approval</p>
            </div>
            <button
              type="button"
              onClick={() => setAddExtraOpen(false)}
              className="w-7 h-7 bg-[#F5F5F3] flex items-center justify-center text-[#454545] hover:bg-[#EEECEA] transition-colors"
            >
              <X size={10} weight="regular" className="text-current" />
            </button>
          </div>
        </div>
        <form onSubmit={handleAddExtra} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4F4B47] mb-1.5">Description *</label>
            <input
              value={extraDesc}
              onChange={(e) => setExtraDesc(e.target.value)}
              placeholder="e.g. Extra boxes from garage"
              className="w-full px-3.5 py-2.5 border border-[#E7E5E4] bg-[#FAFAF8] text-[#1A1A1A] text-[14px] placeholder:text-[#BBB] focus:outline-none focus:border-[#2C3E2D] focus:bg-white transition-colors"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4F4B47] mb-1.5">Quantity</label>
              <input
                type="number"
                min={1}
                value={extraQty}
                onChange={(e) => setExtraQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2.5 border border-[#E7E5E4] bg-[#FAFAF8] text-[#1A1A1A] text-[14px] focus:outline-none focus:border-[#2C3E2D] focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#4F4B47] mb-1.5">Room</label>
              <input
                value={extraRoom}
                onChange={(e) => setExtraRoom(e.target.value)}
                placeholder="e.g. Garage"
                className="w-full px-3.5 py-2.5 border border-[#E7E5E4] bg-[#FAFAF8] text-[#1A1A1A] text-[14px] placeholder:text-[#BBB] focus:outline-none focus:border-[#2C3E2D] focus:bg-white transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setAddExtraOpen(false)}
              className="flex-1 py-2.5 border border-[#E7E5E4] text-[#555] text-[13px] font-semibold hover:bg-[#F5F5F3] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !extraDesc.trim()}
              className="flex-1 py-2.5 text-[13px] font-bold disabled:opacity-40 transition-all active:scale-[0.98]"
              style={{ backgroundColor: FOREST, color: "#F9EDE4" }}
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div
        className={`bg-white overflow-hidden border ${className}`.trim()}
        style={{ borderColor: `${FOREST}14` }}
      >
          <div
            className="px-5 py-4 flex items-center justify-between border-b"
            style={{ borderColor: `${FOREST}10` }}
          >
            <div className="h-4 bg-[#E7E5E4] animate-pulse w-20" />
            <div className="h-7 bg-[#E7E5E4] animate-pulse w-16" />
          </div>
          <div className="px-5 py-3 border-b" style={{ borderColor: `${FOREST}10` }}>
            <div className="h-3 bg-[#E7E5E4] animate-pulse w-40" />
          </div>
        <div className="p-4 space-y-2.5">
          <SkeletonRoom rows={4} />
          <SkeletonRoom rows={3} />
          <SkeletonRoom rows={2} />
        </div>
      </div>
    );
  }

  if (estateWalkthroughScopeOnly) {
    return (
      <div className={`text-center pt-6 sm:pt-8 ${className}`.trim()}>
        <p
          className="text-[12px]"
          style={{ color: TEXT_MUTED_ON_LIGHT }}
        >
          Based on your virtual walkthrough
        </p>
        <p
          className="text-[13px] leading-relaxed max-w-[320px] mx-auto mt-5"
          style={{ color: FOREST }}
        >
          In your virtual walkthrough, we shape your move list with you—what we align on there is
          what we pack and transport with the same care through every stage of your relocation.
          Pieces we have not yet reviewed together are not part of your move until your
          coordinator updates your plan.
        </p>
        <p
          className="text-[12px] mt-4 max-w-[300px] mx-auto leading-relaxed"
          style={{ color: TEXT_MUTED_ON_LIGHT }}
        >
          If something should be on the list, your coordinator can refine your scope, or you can
          request a change below.
        </p>
        {!moveComplete && (
          <button
            type="button"
            onClick={() => setAddExtraOpen(true)}
            className="mt-6 inline-flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] leading-none transition-opacity hover:opacity-80"
            style={{
              color: FOREST,
              backgroundColor: "transparent",
            }}
          >
            <Plus size={12} weight="bold" className="shrink-0" aria-hidden />
            Request change
            <CaretRight size={12} weight="bold" className="shrink-0" aria-hidden />
          </button>
        )}
        {addExtraOpen && <AddExtraModal />}
      </div>
    );
  }

  if (items.length === 0 && extraItems.length === 0) {
    return (
      <>
        <div className={`text-center pt-8 sm:pt-10 ${className}`.trim()}>
          <p
            className="text-[12px] max-w-[280px] mx-auto leading-relaxed"
            style={{ color: TEXT_MUTED_ON_LIGHT }}
          >
            Your coordinator will add items as your move is being prepared.
          </p>
          {!moveComplete && (
            <button
              type="button"
              onClick={() => setAddExtraOpen(true)}
              className="mt-6 inline-flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] leading-none transition-opacity hover:opacity-80"
              style={{
                color: FOREST,
                backgroundColor: "transparent",
              }}
            >
              <Plus size={12} weight="bold" className="shrink-0" aria-hidden />
              Request change
              <CaretRight size={12} weight="bold" className="shrink-0" aria-hidden />
            </button>
          )}
        </div>
        {addExtraOpen && <AddExtraModal />}
      </>
    );
  }

  return (
    <div
      className={`bg-white overflow-hidden border ${className}`.trim()}
      style={{ borderColor: `${FOREST}14` }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between gap-3 border-b"
        style={{ borderColor: `${FOREST}10` }}
      >
        <div className="min-w-0">
          <p
            className={`${QUOTE_EYEBROW_CLASS} mb-1`}
            style={{ color: `${FOREST}50` }}
          >
            Move list
          </p>
          <h3 className="font-hero text-[18px] font-semibold leading-tight" style={{ color: WINE }}>
            Inventory
          </h3>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: TEXT_MUTED_ON_LIGHT }}
          >
            {totalItemCount} {totalItemCount === 1 ? "item" : "items"} across{" "}
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] border border-solid transition-colors hover:opacity-90"
          style={{
            borderColor: `${FOREST}22`,
            color: FOREST,
            backgroundColor: "transparent",
          }}
        >
          <DownloadSimple size={12} className="text-current shrink-0" />
          Export
        </button>
      </div>

      {/* Room list */}
      <div className="p-4 space-y-2">
        {rooms.map((room) => {
          const expanded = isExpanded(room);
          const count = roomItemCount(room);
          const isOnSite = room === "Added on-site";
          return (
            <div
              key={room}
              className="border overflow-hidden transition-all duration-150"
              style={{ borderColor: expanded ? "#E0DDD8" : "#E7E5E4" }}
            >
              {/* Room header */}
              <button
                type="button"
                onClick={() => toggleRoom(room)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#FAFAF8] border-b"
                style={{
                  backgroundColor: expanded ? "#F8F7F4" : "#FAFAF8",
                  borderBottomColor: expanded ? "#E7E5E4" : "transparent",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isOnSite && (
                    <span
                      className="shrink-0 w-4 h-4 flex items-center justify-center"
                      style={{ backgroundColor: `${FOREST}18` }}
                    >
                      <Plus size={8} color={FOREST} />
                    </span>
                  )}
                  <h4
                    className="text-[13px] font-bold truncate"
                    style={{ color: isOnSite ? FOREST : "#2C3E2D" }}
                  >
                    {room}
                  </h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5"
                    style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
                  >
                    {count}
                  </span>
                  <CaretDown
                    size={9}
                    weight="regular"
                    color="#6B6B6B"
                    className="transition-transform duration-200"
                    style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                    aria-hidden
                  />
                </div>
              </button>

              {/* Collapsible table */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-x-auto max-w-full min-w-0 -mx-1 px-1">
                  <table className="w-full min-w-0 max-w-full text-left border-collapse table-fixed">
                    <colgroup>
                      <col className="min-w-0" />
                      <col className="w-14 shrink-0" />
                    </colgroup>
                    <thead>
                      <tr style={{ backgroundColor: "#F5F5F3" }}>
                        <th className="text-[10px] font-bold uppercase tracking-widest text-[#5C5853] px-4 py-2.5 border-b border-[#EEEBE5] min-w-0">Item</th>
                        <th className="text-[10px] font-bold uppercase tracking-widest text-[#5C5853] px-4 py-2.5 border-b border-[#EEEBE5] text-right w-14">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byRoom[room].flatMap((item) => {
                        const rows = expandItemRow(item.item_name);
                        return rows.map((r, ri) => {
                          const qty = rows.length === 1 && item.quantity != null ? item.quantity : r.qty;
                          return (
                            <tr
                              key={`${item.id}-${ri}`}
                              className="border-b border-[#F0EDE8] last:border-0 transition-colors"
                              style={{ backgroundColor: "transparent" }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAF8")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <td className="px-4 py-3 text-[14px] font-medium text-[#2A2A2A] align-middle min-w-0 break-words">{uppercase(r.label)}</td>
                              <td className="px-4 py-3 align-middle w-14">
                                <span className="flex items-center justify-end">
                                  <span className="text-[14px] font-semibold tabular-nums text-[#555]">{qty}</span>
                                </span>
                              </td>
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

      {/* Request change CTA */}
      {!moveComplete && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => setAddExtraOpen(true)}
            className="w-full py-3 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] leading-none transition-opacity hover:opacity-80"
            style={{
              color: FOREST,
              backgroundColor: `${FOREST}06`,
            }}
          >
            <Plus size={12} weight="bold" className="shrink-0" aria-hidden />
            Request change
            <CaretRight size={12} weight="bold" className="shrink-0" aria-hidden />
          </button>
        </div>
      )}

      {addExtraOpen && <AddExtraModal />}
    </div>
  );
}
