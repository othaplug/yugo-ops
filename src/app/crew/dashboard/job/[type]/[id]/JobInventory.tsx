"use client";

import { useState, useEffect } from "react";
import {
  CaretDown as ChevronDown,
  Check as PhCheck,
  Minus as PhMinus,
} from "@phosphor-icons/react";
import { useToast } from "@/app/admin/components/Toast";
import { cn } from "@/lib/utils";

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

const DEFAULT_ROOMS = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Office",
  "Garage",
  "Basement",
  "Other",
];

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
  /** Increment after walkthrough (or similar) to refetch server verifications. */
  verificationRefreshEpoch?: number;
  boxEstimate?: number | null;
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
  verificationRefreshEpoch = 0,
  boxEstimate,
}: JobInventoryProps) {
  const { toast } = useToast();
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [verifiedRooms, setVerifiedRooms] = useState<Set<string>>(new Set());
  const [verifiedIdsLoading, setVerifiedIdsLoading] = useState<Set<string>>(
    new Set(),
  );
  const [verifiedIdsUnloading, setVerifiedIdsUnloading] = useState<Set<string>>(
    new Set(),
  );
  const [verifiedRoomsLoading, setVerifiedRoomsLoading] = useState<Set<string>>(
    new Set(),
  );
  const [verifiedRoomsUnloading, setVerifiedRoomsUnloading] = useState<
    Set<string>
  >(new Set());
  const [verifiedKeys, setVerifiedKeys] = useState<Set<string>>(new Set());
  const [verifiedKeysLoading, setVerifiedKeysLoading] = useState<Set<string>>(
    new Set(),
  );
  const [verifiedKeysUnloading, setVerifiedKeysUnloading] = useState<
    Set<string>
  >(new Set());
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraDesc, setExtraDesc] = useState("");
  const [extraRoom, setExtraRoom] = useState("");
  const [extraQty, setExtraQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [actualBoxCount, setActualBoxCount] = useState<string>("");
  const [boxSaving, setBoxSaving] = useState(false);

  const isUnloading = [
    "unloading",
    "arrived_at_destination",
    "delivering",
    "completed",
  ].includes(currentStatus);
  const isCompleted = currentStatus === "completed";
  /** Job completion implies delivery/unloading — avoid stale UI when crew finished without a separate unload verify row. */
  const deliveryVerified = (unloadingRecorded: boolean) =>
    unloadingRecorded || isCompleted;

  useEffect(() => {
    if (isCompleted) {
      fetch(
        `/api/crew/inventory/${encodeURIComponent(jobId)}/verifications?stage=all`,
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.verifiedIdsLoading)
            setVerifiedIdsLoading(new Set(d.verifiedIdsLoading));
          if (d.verifiedIdsUnloading)
            setVerifiedIdsUnloading(new Set(d.verifiedIdsUnloading));
          if (d.verifiedRoomsLoading)
            setVerifiedRoomsLoading(new Set(d.verifiedRoomsLoading));
          if (d.verifiedRoomsUnloading)
            setVerifiedRoomsUnloading(new Set(d.verifiedRoomsUnloading));
          if (Array.isArray(d.verifiedKeysLoading))
            setVerifiedKeysLoading(new Set(d.verifiedKeysLoading));
          if (Array.isArray(d.verifiedKeysUnloading))
            setVerifiedKeysUnloading(new Set(d.verifiedKeysUnloading));
        })
        .catch(() => {});
    } else {
      fetch(
        `/api/crew/inventory/${encodeURIComponent(jobId)}/verifications?stage=${isUnloading ? "unloading" : "loading"}`,
      )
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.verifiedIds))
            setVerifiedIds(new Set(d.verifiedIds));
          if (Array.isArray(d.verifiedRooms))
            setVerifiedRooms(new Set(d.verifiedRooms));
          if (Array.isArray(d.verifiedKeys))
            setVerifiedKeys(new Set(d.verifiedKeys));
        })
        .catch(() => {});
    }
  }, [jobId, isUnloading, isCompleted, verificationRefreshEpoch]);

  const isRoomBasedVerification =
    jobType === "move" && moveType === "residential" && inventory.length === 0;
  const roomsToConfirm = [...DEFAULT_ROOMS, ...customRooms];
  const allItemsWithId = inventory.flatMap((r) => {
    const rowItems =
      r.itemsWithId ||
      r.items.map((name, i) => ({
        id: `noid-${r.room}-${i}`,
        item_name: name,
        quantity: 1 as const,
      }));
    return rowItems.map((item) => ({ ...item, room: r.room }));
  });
  const verifiableCount = allItemsWithId.filter((item) => {
    const id = "id" in item ? item.id : "";
    return typeof id === "string" && !id.startsWith("noid-");
  }).length;
  const lineItemKey = (room: string, itemName: string) =>
    `${room}::${itemName}`;
  const verifiedCount = allItemsWithId.filter((item) => {
    const id = "id" in item ? item.id : "";
    const room = item.room;
    const name = "item_name" in item ? item.item_name : "";
    if (typeof id !== "string" || typeof name !== "string") return false;
    if (!id.startsWith("noid-")) {
      if (isCompleted)
        return (
          verifiedIdsLoading.has(id) &&
          deliveryVerified(verifiedIdsUnloading.has(id))
        );
      return verifiedIds.has(id);
    }
    const k = lineItemKey(room, name);
    if (isCompleted)
      return (
        verifiedKeysLoading.has(k) &&
        deliveryVerified(verifiedKeysUnloading.has(k))
      );
    return verifiedKeys.has(k);
  }).length;
  const totalCount = isRoomBasedVerification
    ? roomsToConfirm.length
    : Math.max(verifiableCount, allItemsWithId.length + extraItems.length);

  const completedFullyVerifiedCount =
    isCompleted && verifiableCount > 0
      ? allItemsWithId.filter((item) => {
          const id = "id" in item ? item.id : "";
          return (
            typeof id === "string" &&
            !id.startsWith("noid-") &&
            verifiedIdsLoading.has(id) &&
            deliveryVerified(verifiedIdsUnloading.has(id))
          );
        }).length
      : 0;

  useEffect(() => {
    if (isCompleted && isRoomBasedVerification) {
      const both = roomsToConfirm.filter(
        (room) =>
          verifiedRoomsLoading.has(room) &&
          deliveryVerified(verifiedRoomsUnloading.has(room)),
      ).length;
      onCountChange?.(both, roomsToConfirm.length);
    } else if (isCompleted && verifiableCount > 0) {
      onCountChange?.(completedFullyVerifiedCount, verifiableCount);
    } else if (isRoomBasedVerification) {
      onCountChange?.(verifiedRooms.size, roomsToConfirm.length);
    } else if (verifiableCount > 0 || allItemsWithId.length > 0) {
      onCountChange?.(
        verifiedCount,
        Math.max(verifiableCount, allItemsWithId.length),
      );
    } else {
      onCountChange?.(0, totalCount);
    }
  }, [
    isRoomBasedVerification,
    verifiedRooms.size,
    roomsToConfirm.length,
    verifiedCount,
    verifiableCount,
    totalCount,
    onCountChange,
    isCompleted,
    completedFullyVerifiedCount,
    verifiedRoomsLoading,
    verifiedRoomsUnloading,
  ]);

  const toggleRoomVerify = async (room: string) => {
    if (verifiedRooms.has(room)) return;
    try {
      const res = await fetch(`/api/crew/inventory/${jobId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room,
          itemName: room,
          stage: isUnloading ? "unloading" : "loading",
        }),
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
        body: JSON.stringify({
          moveInventoryId,
          stage: isUnloading ? "unloading" : "loading",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setVerifiedIds((prev) => new Set([...prev, moveInventoryId]));
    } catch {}
  };

  const toggleLineItemVerify = async (room: string, itemName: string) => {
    if (readOnly || isCompleted) return;
    const k = lineItemKey(room, itemName);
    if (verifiedKeys.has(k)) return;
    try {
      const res = await fetch(
        `/api/crew/inventory/${encodeURIComponent(jobId)}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            room,
            itemName,
            stage: isUnloading ? "unloading" : "loading",
          }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      setVerifiedKeys((prev) => new Set([...prev, k]));
    } catch {
      toast("Could not verify item", "x");
    }
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
        throw new Error(
          (data as { error?: string }).error || "Failed to submit request",
        );
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

  const handleSaveBoxCount = async () => {
    const n = parseInt(actualBoxCount, 10);
    if (Number.isNaN(n) || n < 0) return;
    setBoxSaving(true);
    try {
      await fetch(`/api/crew/inventory/${encodeURIComponent(jobId)}/boxes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actual_box_count: n }),
      });
    } catch {}
    setBoxSaving(false);
  };

  if (
    jobType === "delivery" &&
    inventory.length === 0 &&
    extraItems.length === 0
  )
    return null;
  if (
    jobType === "move" &&
    inventory.length === 0 &&
    extraItems.length === 0 &&
    !isRoomBasedVerification
  )
    return null;

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="inline-flex flex-wrap items-center gap-x-1.5 pr-2 font-hero text-[20px] font-normal leading-tight tracking-tight text-[var(--yu3-wine)] sm:text-[22px]">
          {isCompleted ? (
            <>
              <span>Inventory Verified</span>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase leading-none tracking-[-0.02em] [font-family:var(--font-body)]">
                PICKUP & DELIVERY
              </span>
            </>
          ) : isRoomBasedVerification
              ? "Room confirmation"
              : isUnloading
                ? "Unloading verification"
                : "Inventory"}
        </h2>
        {isCompleted && verifiableCount > 0 ? (
          <span className="max-w-[140px] shrink-0 text-right text-[11px] font-medium leading-snug text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            {completedFullyVerifiedCount} of {verifiableCount} verified at both
          </span>
        ) : isCompleted && isRoomBasedVerification ? (
          <span className="shrink-0 text-right text-[11px] font-medium text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            {
              roomsToConfirm.filter(
                (r) =>
                  verifiedRoomsLoading.has(r) &&
                  deliveryVerified(verifiedRoomsUnloading.has(r)),
              ).length
            }{" "}
            of {roomsToConfirm.length} rooms
          </span>
        ) : isRoomBasedVerification ? (
          <span className="shrink-0 text-right text-[11px] font-medium text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            {verifiedRooms.size} of {roomsToConfirm.length} rooms
          </span>
        ) : allItemsWithId.length > 0 ? (
          <span className="shrink-0 text-right text-[11px] font-medium text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            {verifiedCount} of{" "}
            {Math.max(verifiableCount, allItemsWithId.length)} verified
          </span>
        ) : null}
      </div>
      {isRoomBasedVerification ? (
        <div className="space-y-1.5 mb-3">
          {roomsToConfirm.map((room) => {
            const verified = verifiedRooms.has(room);
            const verifiedAtPickup = verifiedRoomsLoading.has(room);
            const verifiedAtDelivery = verifiedRoomsUnloading.has(room);
            const deliveryDone = deliveryVerified(verifiedAtDelivery);
            const bothVerified = verifiedAtPickup && deliveryDone;
            return (
              <label
                key={room}
                className={`flex items-center gap-2.5 py-1.5 ${!readOnly && !isCompleted ? "cursor-pointer" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isCompleted ? bothVerified : verified}
                  onChange={() =>
                    !readOnly && !isCompleted && toggleRoomVerify(room)
                  }
                  disabled={readOnly}
                  className="rounded-sm border-[var(--yu3-wine)]/30 accent-[var(--yu3-wine)] focus:ring-[var(--yu3-wine)]/40"
                />
                <span className="flex-1 text-[13px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                  {room}
                </span>
                {isCompleted && (
                  <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide [font-family:var(--font-body)]">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        verifiedAtPickup
                          ? "text-[var(--yu3-wine)]"
                          : "text-[var(--yu3-ink-muted)]",
                      )}
                    >
                      Pickup
                      {verifiedAtPickup ? (
                        <PhCheck size={12} weight="bold" aria-hidden />
                      ) : (
                        <PhMinus size={12} weight="bold" aria-hidden />
                      )}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        deliveryDone
                          ? "text-[var(--yu3-wine)]"
                          : "text-[var(--yu3-ink-muted)]",
                      )}
                    >
                      Delivery
                      {deliveryDone ? (
                        <PhCheck size={12} weight="bold" aria-hidden />
                      ) : (
                        <PhMinus size={12} weight="bold" aria-hidden />
                      )}
                    </span>
                  </span>
                )}
              </label>
            );
          })}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                const r = window.prompt("Add room name");
                if (r?.trim() && !customRooms.includes(r.trim()))
                  setCustomRooms((prev) => [...prev, r.trim()]);
              }}
              className="w-full border border-dashed border-[var(--yu3-wine)]/25 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--yu3-ink-muted)] transition-colors [font-family:var(--font-body)] hover:border-[var(--yu3-wine)]/40"
            >
              + Add room
            </button>
          )}
        </div>
      ) : (
        <>
          {inventory.map((r) => {
            const expanded = !collapsedRooms.has(r.room);
            const items =
              r.itemsWithId ||
              r.items.map((name, i) => ({
                id: `noid-${r.room}-${i}`,
                item_name: name,
                quantity: 1,
              }));
            return (
              <div
                key={r.room}
                className="mb-3 overflow-hidden rounded-[12px] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedRooms((prev) => {
                      const next = new Set(prev);
                      if (next.has(r.room)) next.delete(r.room);
                      else next.add(r.room);
                      return next;
                    })
                  }
                  className="crew-job-flat group flex w-full cursor-pointer items-center justify-between gap-2 border-b border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/60 px-3 py-2.5 text-left transition-colors"
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--yu3-wine)] transition-colors group-hover:opacity-90 [font-family:var(--font-body)] leading-none">
                    {r.room}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </span>
                    <ChevronDown
                      className={`h-[14px] w-[14px] shrink-0 text-[var(--yu3-ink-muted)] transition-transform duration-200 ease-out ${expanded ? "rotate-0" : "-rotate-90"}`}
                      aria-hidden
                    />
                  </span>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1.5 px-3 pb-3 pt-0.5">
                      {items.map((item, i) => {
                        const id =
                          "id" in item ? item.id : `noid-${r.room}-${i}`;
                        const rawName =
                          "item_name" in item ? item.item_name : String(item);
                        const qty =
                          "quantity" in item ? (item.quantity ?? 1) : 1;
                        const hasId =
                          typeof id === "string" && !id.startsWith("noid-");
                        const lineKey = lineItemKey(r.room, rawName);
                        const verified = hasId
                          ? verifiedIds.has(id)
                          : verifiedKeys.has(lineKey);
                        const verifiedAtPickup = hasId
                          ? verifiedIdsLoading.has(id)
                          : verifiedKeysLoading.has(lineKey);
                        const verifiedAtDelivery = hasId
                          ? verifiedIdsUnloading.has(id)
                          : verifiedKeysUnloading.has(lineKey);
                        const deliveryDone =
                          deliveryVerified(verifiedAtDelivery);
                        const bothVerified = verifiedAtPickup && deliveryDone;
                        const canToggle = !readOnly && !isCompleted;
                        const checked = isCompleted ? bothVerified : verified;
                        return (
                          <label
                            key={`${r.room}-${i}-${rawName}`}
                            className={`flex items-center gap-2.5 py-1.5 ${canToggle ? "cursor-pointer" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (!canToggle) return;
                                hasId
                                  ? toggleVerify(id)
                                  : void toggleLineItemVerify(r.room, rawName);
                              }}
                              disabled={readOnly}
                              className="rounded-sm border-[var(--yu3-wine)]/30 accent-[var(--yu3-wine)] focus:ring-[var(--yu3-wine)]/40"
                            />
                            <span className="flex-1 text-[13px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                              {rawName}
                            </span>
                            <span className="text-[11px] tabular-nums text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                              {qty}
                            </span>
                            {isCompleted && (
                              <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide [font-family:var(--font-body)]">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    verifiedAtPickup
                                      ? "text-[var(--yu3-wine)]"
                                      : "text-[var(--yu3-ink-muted)]",
                                  )}
                                >
                                  Pickup
                                  {verifiedAtPickup ? (
                                    <PhCheck
                                      size={12}
                                      weight="bold"
                                      aria-hidden
                                    />
                                  ) : (
                                    <PhMinus
                                      size={12}
                                      weight="bold"
                                      aria-hidden
                                    />
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    deliveryDone
                                      ? "text-[var(--yu3-wine)]"
                                      : "text-[var(--yu3-ink-muted)]",
                                  )}
                                >
                                  Delivery
                                  {deliveryDone ? (
                                    <PhCheck
                                      size={12}
                                      weight="bold"
                                      aria-hidden
                                    />
                                  ) : (
                                    <PhMinus
                                      size={12}
                                      weight="bold"
                                      aria-hidden
                                    />
                                  )}
                                </span>
                              </span>
                            )}
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
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] leading-none text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                Added on-site
              </div>
              {extraItems.map((e) => (
                <div
                  key={e.id}
                  className="bg-[var(--yu3-bg-surface-sunken)]/80 px-3 py-2 text-[12px] text-[var(--yu3-ink)] [font-family:var(--font-body)]"
                >
                  {e.description ?? "-"}{" "}
                  {(e.quantity ?? 1) > 1 && `×${e.quantity}`}{" "}
                  {e.room && `(${e.room})`}
                </div>
              ))}
            </div>
          )}
          {!isRoomBasedVerification && !readOnly && (
            <button
              type="button"
              onClick={() => setAddExtraOpen(true)}
              className="min-h-[48px] w-full border border-[var(--yu3-wine)]/30 bg-[var(--yu3-bg-surface)] py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-wine)] transition-colors [font-family:var(--font-body)] leading-none hover:bg-[var(--yu3-wine-tint)]/50 active:scale-[0.99]"
            >
              + Add extra item
            </button>
          )}
        </>
      )}
      {(boxEstimate != null && boxEstimate > 0) && (
        <div className="mt-3 rounded-[12px] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/60 px-3 py-2.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--yu3-wine)] leading-none [font-family:var(--font-body)]">
              Boxes
            </span>
          </div>
          <div className="px-3 py-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">Estimated</span>
              <span className="text-[13px] font-semibold text-[var(--yu3-ink)] tabular-nums [font-family:var(--font-body)]">{boxEstimate}</span>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-[var(--yu3-ink-muted)] shrink-0 [font-family:var(--font-body)]">Actual count</label>
                <input
                  type="number"
                  min={0}
                  value={actualBoxCount}
                  onChange={(e) => setActualBoxCount(e.target.value)}
                  placeholder={String(boxEstimate)}
                  className="flex-1 border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] px-2.5 py-1.5 text-[13px] text-[var(--yu3-ink)] outline-none [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/50 tabular-nums"
                />
                <button
                  type="button"
                  onClick={handleSaveBoxCount}
                  disabled={boxSaving || actualBoxCount === ""}
                  className="shrink-0 border border-[var(--yu3-wine)]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-wine)] [font-family:var(--font-body)] leading-none disabled:opacity-40 transition-colors hover:bg-[var(--yu3-wine-tint)]/40"
                >
                  {boxSaving ? "…" : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {addExtraOpen && (
        <div className="modal-overlay fixed inset-0 z-[99999] flex animate-fade-in items-center justify-center p-4">
          <div className="max-h-[90dvh] w-full max-w-[340px] animate-fade-in overflow-y-auto border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-5 shadow-[var(--yu3-shadow-lg)]">
            <h3 className="font-hero mb-2 text-[22px] font-normal tracking-tight text-[var(--yu3-wine)]">
              Add extra item
            </h3>
            <p className="mb-4 text-[12px] leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
              Submitted items require admin approval before they appear in the
              list.
            </p>
            <form onSubmit={handleAddExtra} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                  Description
                </label>
                <input
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                  placeholder="e.g. Extra boxes from garage"
                  className="w-full border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] px-3 py-2.5 text-[13px] text-[var(--yu3-ink)] outline-none [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/50"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={extraQty}
                  onChange={(e) =>
                    setExtraQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-full border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] px-3 py-2.5 text-[13px] text-[var(--yu3-ink)] outline-none [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                  Room (optional)
                </label>
                <input
                  value={extraRoom}
                  onChange={(e) => setExtraRoom(e.target.value)}
                  placeholder="e.g. Garage"
                  className="w-full border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] px-3 py-2.5 text-[13px] text-[var(--yu3-ink)] outline-none [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/50"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddExtraOpen(false)}
                  className="flex-1 border border-[var(--yu3-wine)]/30 bg-[var(--yu3-bg-surface)] py-2.5 text-[11px] font-semibold text-[var(--yu3-wine)] transition-colors [font-family:var(--font-body)] hover:bg-[var(--yu3-wine-tint)]/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !extraDesc.trim()}
                  className="crew-premium-cta flex-1 border border-[#3d1426] py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FFFBF7] transition-colors [font-family:var(--font-body)] leading-none disabled:opacity-50"
                >
                  {submitting ? "Submitting" : "Submit for approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
