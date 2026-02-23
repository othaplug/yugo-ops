"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/app/admin/components/Toast";

interface InventoryRoom {
  room: string;
  items: string[];
  itemsWithId?: { id: string; item_name: string; quantity?: number }[];
}

interface ExtraItem {
  id: string;
  description?: string;
  room?: string | null;
  quantity?: number;
  added_at?: string;
}

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Office", "Garage", "Basement", "Other"];

interface JobInventoryProps {
  jobId: string;
  jobType: "move" | "delivery";
  moveType?: string;
  inventory: InventoryRoom[];
  extraItems: ExtraItem[];
  currentStatus: string;
  onRefresh?: () => void;
  onCountChange?: (verified: number, total: number) => void;
  readOnly?: boolean;
}

export default function JobInventory({
  jobId,
  jobType,
  moveType,
  inventory,
  extraItems,
  currentStatus,
  onRefresh,
  onCountChange,
  readOnly = false,
}: JobInventoryProps) {
  const { toast } = useToast();
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [verifiedRooms, setVerifiedRooms] = useState<Set<string>>(new Set());
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraRoom, setExtraRoom] = useState("");
  const [extraQty, setExtraQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());

  const isUnloading = ["unloading", "arrived_at_destination", "delivering", "completed"].includes(currentStatus);

  useEffect(() => {
    if (jobType !== "move") return;
    fetch(`/api/crew/inventory/${jobId}/verifications?stage=${isUnloading ? "unloading" : "loading"}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.verifiedIds) setVerifiedIds(new Set(d.verifiedIds));
        if (d.verifiedRooms) setVerifiedRooms(new Set(d.verifiedRooms));
      })
      .catch(() => {});
  }, [jobId, jobType, isUnloading]);

  const isPremierNoInventory = jobType === "move" && moveType === "residential" && inventory.length === 0;
  const roomsToConfirm = [...DEFAULT_ROOMS, ...customRooms];
  const allItemsWithId = inventory.flatMap((r) => r.itemsWithId || r.items.map((name, i) => ({ id: `noid-${r.room}-${i}`, item_name: name })));
  const verifiableCount = allItemsWithId.filter((item) => {
    const id = "id" in item ? item.id : "";
    return typeof id === "string" && !id.startsWith("noid-");
  }).length;
  const verifiedCount = allItemsWithId.filter((item) => {
    const id = "id" in item ? item.id : "";
    return typeof id === "string" && !id.startsWith("noid-") && verifiedIds.has(id);
  }).length;
  const totalCount = isPremierNoInventory ? roomsToConfirm.length : Math.max(verifiableCount, allItemsWithId.length + extraItems.length);

  useEffect(() => {
    if (isPremierNoInventory) {
      onCountChange?.(verifiedRooms.size, roomsToConfirm.length);
    } else if (verifiableCount > 0) {
      onCountChange?.(verifiedCount, verifiableCount);
    } else {
      onCountChange?.(0, totalCount);
    }
  }, [isPremierNoInventory, verifiedRooms.size, roomsToConfirm.length, verifiedCount, verifiableCount, totalCount, onCountChange]);

  const toggleRoomVerify = async (room: string) => {
    if (verifiedRooms.has(room)) return;
    try {
      const res = await fetch(`/api/crew/inventory/${jobId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, itemName: room, stage: isUnloading ? "unloading" : "loading" }),
      });
      if (!res.ok) throw new Error("Failed");
      setVerifiedRooms((prev) => new Set([...prev, room]));
    } catch {}
  };

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
        credentials: "include",
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
      onRefresh?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to submit request", "x");
    }
    setSubmitting(false);
  };

  if (jobType === "delivery" && inventory.length === 0 && extraItems.length === 0) return null;
  if (jobType === "move" && inventory.length === 0 && extraItems.length === 0 && !isPremierNoInventory) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)]">
          {isPremierNoInventory ? "Room Confirmation" : isUnloading ? "Unloading Verification" : "Inventory"}
        </h2>
        {isPremierNoInventory ? (
          <span className="text-[11px] text-[var(--tx3)]">{verifiedRooms.size} of {roomsToConfirm.length} rooms</span>
        ) : verifiableCount > 0 ? (
          <span className="text-[11px] text-[var(--tx3)]">{verifiedCount} of {verifiableCount} verified</span>
        ) : null}
      </div>
      {isPremierNoInventory ? (
        <div className="space-y-1.5 mb-3">
          {roomsToConfirm.map((room) => {
            const verified = verifiedRooms.has(room);
            return (
              <label
                key={room}
                className={`flex items-center gap-2 py-1.5 px-3 rounded-lg border transition-colors ${!readOnly ? "cursor-pointer hover:border-[var(--gold)]/40" : ""} ${
                  verified ? "bg-[var(--grn)]/10 border-[var(--grn)]/30" : "bg-[var(--bg)] border-[var(--brd)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={() => !readOnly && toggleRoomVerify(room)}
                  disabled={readOnly}
                  className="rounded border-[var(--brd)]"
                />
                <span className="text-[13px] text-[var(--tx)]">{room}</span>
                {verified && <span className="ml-auto text-[var(--grn)]">&#10003;</span>}
              </label>
            );
          })}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                const r = window.prompt("Add room name");
                if (r?.trim() && !customRooms.includes(r.trim())) setCustomRooms((prev) => [...prev, r.trim()]);
              }}
              className="w-full py-2 rounded-lg border border-dashed border-[var(--brd)] text-[12px] text-[var(--tx3)] hover:border-[var(--gold)]"
            >
              + Add room
            </button>
          )}
        </div>
      ) : (
        <>
      {inventory.map((r) => {
        const expanded = !collapsedRooms.has(r.room);
        const items = r.itemsWithId || r.items.map((name, i) => ({ id: `noid-${i}`, item_name: name, quantity: 1 }));
        return (
        <div key={r.room} className="mb-3 rounded-lg overflow-hidden border border-[var(--brd)]/40 transition-colors hover:border-[var(--brd)]/60">
          <button
            type="button"
            onClick={() => setCollapsedRooms((prev) => {
              const next = new Set(prev);
              if (next.has(r.room)) next.delete(r.room);
              else next.add(r.room);
              return next;
            })}
            className="w-full flex items-center justify-between gap-2 bg-[var(--bg)]/80 px-3 py-2.5 text-left hover:bg-[var(--bg)] transition-colors cursor-pointer group"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)] group-hover:text-[var(--gold2)] transition-colors">{r.room}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-[var(--tx3)]">{items.length} item{items.length !== 1 ? "s" : ""}</span>
              <ChevronDown className={`w-[14px] h-[14px] text-[var(--tx3)] transition-transform duration-200 ease-out ${expanded ? "rotate-0" : "-rotate-90"}`} />
            </span>
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="space-y-1.5 px-3 pb-3 pt-0.5">
                {items.map((item, i) => {
                  const id = "id" in item ? item.id : `noid-${i}`;
                  const rawName = "item_name" in item ? item.item_name : String(item);
                  const qty = "quantity" in item ? (item.quantity ?? 1) : 1;
                  // Strip trailing " xN" from name to avoid "Table x2 x2" when bulk-add stores qty in both name and quantity
                  const baseName = rawName.replace(/\s*x\d+$/i, "").trim() || rawName;
                  const display = qty > 1 ? `${baseName} x${qty}` : baseName;
                  const hasId = typeof id === "string" && !id.startsWith("noid-");
                  const verified = hasId ? verifiedIds.has(id) : false;
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-2 py-1.5 px-3 rounded-lg border transition-colors ${
                        verified ? "bg-[var(--grn)]/10 border-[var(--grn)]/30" : "bg-[var(--bg)] border-[var(--brd)]"
                      } ${hasId && !readOnly ? "cursor-pointer hover:border-[var(--gold)]/40" : ""}`}
                    >
                      {hasId ? (
                        <input
                          type="checkbox"
                          checked={verified}
                          onChange={() => !readOnly && toggleVerify(id)}
                          disabled={readOnly}
                          className="rounded border-[var(--brd)]"
                        />
                      ) : (
                        <span className="w-4" />
                      )}
                      <span className="text-[13px] text-[var(--tx)]">{display}</span>
                      {verified && <span className="ml-auto text-[var(--grn)]">&#10003;</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        );
      })}
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
      {!isPremierNoInventory && !readOnly && (
      <button
        onClick={() => setAddExtraOpen(true)}
        className="w-full py-2.5 rounded-lg border border-dashed border-[var(--gold)]/50 text-[12px] font-medium text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
      >
        + Add Extra Item
      </button>
      )}
        </>
      )}
      {addExtraOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 max-w-[340px] w-full shadow-xl animate-fade-in">
            <h3 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-4">Add Extra Item</h3>
            <p className="text-[11px] text-[var(--tx3)] mb-4">Submitted items require admin approval before they appear in the list.</p>
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
                  className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit for approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
