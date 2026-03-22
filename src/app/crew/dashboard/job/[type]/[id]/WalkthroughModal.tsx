"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  X,
  Plus,
  MagnifyingGlass,
  Warning,
  Check,
  CircleNotch,
  CaretRight,
} from "@phosphor-icons/react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  item_name: string;
  quantity?: number;
  room?: string;
}

interface InventoryRoom {
  room: string;
  items: string[];
  itemsWithId?: { id: string; item_name: string; quantity?: number }[];
}

export interface WalkthroughItem {
  id: string;
  item_name: string;
  quantity: number;
  room: string;
  status: "unchecked" | "here" | "missing";
}

export interface ExtraItemEntry {
  item_name: string;
  item_slug?: string | null;
  weight_score: number;
  quantity: number;
  is_custom: boolean;
  custom_weight_class?: string | null;
  surcharge: number;
}

export interface MissingItemEntry {
  move_inventory_id: string;
  item_name: string;
  item_slug?: string | null;
  weight_score: number;
  quantity: number;
  credit: number;
}

interface ItemWeightRow {
  id: string;
  item_name: string;
  slug: string;
  weight_score: number;
  category: string;
}

interface WalkthroughModalProps {
  jobId: string;
  inventory: InventoryRoom[];
  perScoreRate?: number;
  onComplete: (result: {
    itemsMatched: number;
    itemsMissing: number;
    itemsExtra: number;
    extraItems: ExtraItemEntry[];
    missingItems: MissingItemEntry[];
    netDelta: number;
    changeRequestId: string | null;
    noChanges: boolean;
  }) => void;
  onSkip: (reason: string) => void;
  onClose: () => void;
}

const WEIGHT_CLASS_LABELS: Record<string, string> = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  extra_heavy: "Extra Heavy",
};
const WEIGHT_CLASS_SCORES: Record<string, number> = {
  light: 0.5,
  medium: 1.0,
  heavy: 2.0,
  extra_heavy: 3.0,
};

const SKIP_REASONS = [
  { value: "client_refused", label: "Client refused walkthrough" },
  { value: "small_move", label: "Small move / partial (< 5 items)" },
  { value: "not_applicable", label: "Walkthrough not applicable (labour only)" },
];

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export default function WalkthroughModal({
  jobId,
  inventory,
  perScoreRate = 35,
  onComplete,
  onSkip,
  onClose,
}: WalkthroughModalProps) {
  const [step, setStep] = useState<"intro" | "checklist" | "extras" | "summary" | "skip">("intro");

  // Flatten all inventory items from the quote
  const [items, setItems] = useState<WalkthroughItem[]>(() => {
    const flat: WalkthroughItem[] = [];
    for (const room of inventory) {
      const roomItems = room.itemsWithId ?? room.items.map((name, i) => ({ id: `noid-${room.room}-${i}`, item_name: name, quantity: 1 }));
      for (const it of roomItems) {
        flat.push({
          id: it.id,
          item_name: it.item_name,
          quantity: it.quantity ?? 1,
          room: room.room,
          status: "unchecked",
        });
      }
    }
    return flat;
  });

  // Extra items found
  const [extraItems, setExtraItems] = useState<ExtraItemEntry[]>([]);

  // Extra item search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ItemWeightRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemWeightRow | null>(null);
  const [customItemName, setCustomItemName] = useState("");
  const [customWeightClass, setCustomWeightClass] = useState("medium");
  const [extraQty, setExtraQty] = useState(1);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Skip state
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0].value);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Search item_weights
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/crew/item-weights?q=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        const data = await res.json();
        setSearchResults(Array.isArray(data.items) ? data.items : []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
  }, [searchQuery]);

  // ── Derived counts
  const matched = items.filter((i) => i.status === "here").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const unchecked = items.filter((i) => i.status === "unchecked").length;

  const netDelta =
    extraItems.reduce((sum, e) => sum + e.surcharge, 0) -
    missingItems().reduce((sum, m) => sum + m.credit, 0);

  function missingItems(): MissingItemEntry[] {
    return items
      .filter((i) => i.status === "missing" && !i.id.startsWith("noid-"))
      .map((i) => ({
        move_inventory_id: i.id,
        item_name: i.item_name,
        item_slug: null,
        weight_score: 1,
        quantity: i.quantity,
        credit: Math.round(1 * i.quantity * perScoreRate),
      }));
  }

  // ── Handlers
  function setItemStatus(id: string, status: "here" | "missing") {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, status } : it));
  }

  function addExtraItem() {
    if (selectedItem) {
      const surcharge = Math.round(selectedItem.weight_score * extraQty * perScoreRate);
      setExtraItems((prev) => [
        ...prev,
        {
          item_name: selectedItem.item_name,
          item_slug: selectedItem.slug,
          weight_score: selectedItem.weight_score,
          quantity: extraQty,
          is_custom: false,
          surcharge,
        },
      ]);
    } else if (customItemName.trim()) {
      const ws = WEIGHT_CLASS_SCORES[customWeightClass] ?? 1;
      const surcharge = Math.round(ws * extraQty * perScoreRate);
      setExtraItems((prev) => [
        ...prev,
        {
          item_name: customItemName.trim(),
          item_slug: null,
          weight_score: ws,
          quantity: extraQty,
          is_custom: true,
          custom_weight_class: customWeightClass,
          surcharge,
        },
      ]);
    }
    setAddExtraOpen(false);
    setSelectedItem(null);
    setCustomItemName("");
    setSearchQuery("");
    setExtraQty(1);
  }

  function removeExtra(idx: number) {
    setExtraItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitChangeRequest() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const missing = missingItems();
      const res = await fetch(`/api/crew/walkthrough/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items_added: extraItems.map((e) => ({
            item_name: e.item_name,
            item_slug: e.item_slug ?? null,
            weight_score: e.weight_score,
            quantity: e.quantity,
            is_custom: e.is_custom,
            custom_weight_class: e.custom_weight_class ?? null,
          })),
          items_removed: missing.map((m) => ({
            move_inventory_id: m.move_inventory_id,
            item_name: m.item_name,
            item_slug: m.item_slug ?? null,
            weight_score: m.weight_score,
            quantity: m.quantity,
          })),
          items_matched: matched,
          items_missing: missing.length,
          items_extra: extraItems.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onComplete({
        itemsMatched: matched,
        itemsMissing: missing.length,
        itemsExtra: extraItems.length,
        extraItems,
        missingItems: missing,
        netDelta,
        changeRequestId: data.id ?? null,
        noChanges: false,
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function submitNoChanges() {
    onComplete({
      itemsMatched: matched,
      itemsMissing: 0,
      itemsExtra: 0,
      extraItems: [],
      missingItems: [],
      netDelta: 0,
      changeRequestId: null,
      noChanges: true,
    });
  }

  const hst = Math.round(netDelta * 0.13 * 100) / 100;
  const total = Math.round((netDelta + hst) * 100) / 100;

  // Group items by room for the checklist view
  const roomGroups = inventory.map((room) => ({
    room: room.room,
    items: items.filter((it) => it.room === room.room),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 bg-black/80 flex min-h-0 items-center justify-center z-[99995] animate-fade-in p-4 sm:p-5">
      <div
        className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl w-full max-w-[520px] shadow-2xl flex flex-col"
        style={{ maxHeight: "min(92dvh, 92vh)" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 z-10 flex items-center justify-between">
          <div>
            <h3 className="font-hero text-[22px] font-bold text-[var(--tx)]">Inventory Walkthrough</h3>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              {step === "intro" && "Walk through with the client and verify the inventory."}
              {step === "checklist" && `${items.length} items to verify`}
              {step === "extras" && "Add any extra items found"}
              {step === "summary" && "Review changes before submitting"}
              {step === "skip" && "Select a reason for skipping"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── INTRO ── */}
          {step === "intro" && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto">
                <CheckCircle size={32} color="var(--gold)" weight="duotone" />
              </div>
              <div>
                <h4 className="font-hero text-[18px] font-bold text-[var(--tx)] mb-2">Step 1: Inventory Walkthrough</h4>
                <p className="text-[13px] text-[var(--tx2)] leading-relaxed">
                  Walk through with the client and verify that the inventory on their quote
                  matches what's actually here. Flag missing items and add anything extra.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-4 py-3 text-left">
                <p className="text-[11px] font-bold text-[var(--gold)] uppercase tracking-wider mb-1">Remember</p>
                <p className="text-[12px] text-[var(--tx2)]">
                  You cannot set or change prices. Just identify what's here and what's missing —
                  your coordinator will handle any price adjustments.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => setStep("checklist")}
                  className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-base)] text-white"
                  style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                >
                  Start Inventory Check
                </button>
                <button
                  onClick={() => setStep("skip")}
                  className="w-full py-2.5 rounded-xl text-[12px] font-medium text-[var(--tx3)] hover:text-[var(--tx2)] transition-colors"
                >
                  Skip (with reason)
                </button>
              </div>
            </div>
          )}

          {/* ── SKIP ── */}
          {step === "skip" && (
            <div className="space-y-4">
              <p className="text-[12px] text-[var(--tx3)]">Why is the walkthrough being skipped?</p>
              {SKIP_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    skipReason === r.value
                      ? "border-[var(--gold)] bg-[var(--gold)]/8"
                      : "border-[var(--brd)] hover:border-[var(--brd)]/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="skip_reason"
                    value={r.value}
                    checked={skipReason === r.value}
                    onChange={() => setSkipReason(r.value)}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[13px] text-[var(--tx)]">{r.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* ── CHECKLIST ── */}
          {step === "checklist" && (
            <div className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[var(--tx3)]">
                  No inventory items on this quote.
                </div>
              ) : (
                roomGroups.map((group) => (
                  <div key={group.room} className="rounded-xl border border-[var(--brd)]/60 overflow-hidden">
                    <div className="px-3 py-2 bg-[var(--bg)]/80 border-b border-[var(--brd)]/40">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--gold)]">
                        {group.room}
                      </span>
                    </div>
                    <div className="divide-y divide-[var(--brd)]/30">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="shrink-0">
                            {item.status === "here" ? (
                              <div className="w-5 h-5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/50 flex items-center justify-center">
                                <Check size={10} color="#22C55E" weight="bold" />
                              </div>
                            ) : item.status === "missing" ? (
                              <div className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/50 flex items-center justify-center">
                                <X size={9} color="#EF4444" weight="bold" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-[var(--brd)] bg-[var(--bg)]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] text-[var(--tx)]">{item.item_name}</span>
                            {(item.quantity ?? 1) > 1 && (
                              <span className="ml-1.5 text-[10px] text-[var(--tx3)]">×{item.quantity}</span>
                            )}
                          </div>
                          {item.status !== "here" && (
                            <button
                              onClick={() => setItemStatus(item.id, "here")}
                              className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors active:scale-95"
                            >
                              Here
                            </button>
                          )}
                          {item.status !== "missing" && (
                            <button
                              onClick={() => setItemStatus(item.id, "missing")}
                              className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors active:scale-95"
                            >
                              Missing
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {unchecked > 0 && (
                <p className="text-center text-[11px] text-[var(--tx3)]">
                  {unchecked} item{unchecked !== 1 ? "s" : ""} not yet checked
                </p>
              )}
            </div>
          )}

          {/* ── EXTRAS ── */}
          {step === "extras" && (
            <div className="space-y-3">
              <p className="text-[12px] text-[var(--tx3)]">
                Add any items found that were <strong className="text-[var(--tx)]">not on the original quote</strong>.
              </p>

              {extraItems.length > 0 && (
                <div className="space-y-2">
                  {extraItems.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--tx)] font-medium">
                          {e.item_name} {e.quantity > 1 && `×${e.quantity}`}
                        </p>
                        <p className="text-[11px] text-[var(--tx3)]">
                          {e.is_custom ? WEIGHT_CLASS_LABELS[e.custom_weight_class ?? "medium"] : `Score ${e.weight_score}`}
                        </p>
                      </div>
                      <span className="text-[13px] font-semibold text-[#22C55E]">+${e.surcharge}</span>
                      <button
                        onClick={() => removeExtra(i)}
                        className="p-1 rounded-lg text-[var(--tx3)] hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add extra item form */}
              {addExtraOpen ? (
                <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4 space-y-3">
                  {/* Search */}
                  {!selectedItem && (
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">
                        Search item
                      </label>
                      <div className="relative">
                        <MagnifyingGlass
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]"
                        />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="e.g. dining table, boxes…"
                          className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] text-[13px] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)]/60"
                        />
                        {searching && (
                          <CircleNotch size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] animate-spin" />
                        )}
                      </div>
                      {searchResults.length > 0 && (
                        <div className="mt-1.5 rounded-lg border border-[var(--brd)] bg-[var(--card)] shadow-lg overflow-hidden">
                          {searchResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => { setSelectedItem(r); setSearchQuery(""); setSearchResults([]); }}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--bg)] border-b border-[var(--brd)]/50 last:border-0 transition-colors"
                            >
                              <span className="text-[13px] text-[var(--tx)]">{r.item_name}</span>
                              <span className="text-[11px] text-[var(--tx3)]">+${Math.round(r.weight_score * perScoreRate)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery && !searching && searchResults.length === 0 && (
                        <p className="mt-1.5 text-[11px] text-[var(--tx3)]">
                          Not found —{" "}
                          <button
                            onClick={() => { setCustomItemName(searchQuery); setSearchQuery(""); }}
                            className="text-[var(--gold)] font-medium"
                          >
                            add custom item
                          </button>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Selected item */}
                  {selectedItem && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--gold)]/8 border border-[var(--gold)]/20">
                      <span className="flex-1 text-[13px] font-medium text-[var(--tx)]">{selectedItem.item_name}</span>
                      <span className="text-[11px] text-[var(--tx3)]">+${Math.round(selectedItem.weight_score * perScoreRate)}/unit</span>
                      <button onClick={() => setSelectedItem(null)} className="text-[var(--tx3)] hover:text-red-400">
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Custom item */}
                  {!selectedItem && customItemName && (
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">
                        Item name
                      </label>
                      <input
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] text-[13px] outline-none"
                      />
                      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mt-3 mb-1">
                        Weight
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(WEIGHT_CLASS_LABELS).map(([k, label]) => (
                          <button
                            key={k}
                            onClick={() => setCustomWeightClass(k)}
                            className={`px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors ${
                              customWeightClass === k
                                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                                : "border-[var(--brd)] text-[var(--tx2)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  {(selectedItem || customItemName) && (
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">
                        Quantity
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExtraQty((q) => Math.max(1, q - 1))}
                          className="w-9 h-9 rounded-lg border border-[var(--brd)] flex items-center justify-center text-[var(--tx)] hover:bg-[var(--bg)] text-lg font-medium"
                        >
                          −
                        </button>
                        <span className="text-[16px] font-bold text-[var(--tx)] w-8 text-center">{extraQty}</span>
                        <button
                          onClick={() => setExtraQty((q) => q + 1)}
                          className="w-9 h-9 rounded-lg border border-[var(--brd)] flex items-center justify-center text-[var(--tx)] hover:bg-[var(--bg)] text-lg font-medium"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setAddExtraOpen(false); setSelectedItem(null); setCustomItemName(""); setSearchQuery(""); setExtraQty(1); }}
                      className="flex-1 py-2.5 rounded-xl border border-[var(--brd)] text-[var(--tx2)] text-[13px] font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addExtraItem}
                      disabled={!selectedItem && !customItemName.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold text-[13px] disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddExtraOpen(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[var(--gold)]/50 text-[13px] font-medium text-[var(--gold)] hover:bg-[var(--gold)]/5 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={14} /> Add Extra Item
                </button>
              )}
            </div>
          )}

          {/* ── SUMMARY ── */}
          {step === "summary" && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/5 px-3 py-3 text-center">
                  <p className="text-[20px] font-bold text-[#22C55E]">{matched}</p>
                  <p className="text-[10px] text-[#22C55E]/70 uppercase tracking-wider mt-0.5">Matched</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3 text-center">
                  <p className="text-[20px] font-bold text-red-400">{missing}</p>
                  <p className="text-[10px] text-red-400/70 uppercase tracking-wider mt-0.5">Missing</p>
                </div>
                <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-3 py-3 text-center">
                  <p className="text-[20px] font-bold text-[var(--gold)]">{extraItems.length}</p>
                  <p className="text-[10px] text-[var(--gold)]/70 uppercase tracking-wider mt-0.5">Extra</p>
                </div>
              </div>

              {/* Extra items */}
              {extraItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Extra Items</p>
                  <div className="space-y-1.5">
                    {extraItems.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--brd)]/50">
                        <span className="text-[13px] text-[var(--tx)]">
                          {e.item_name} {e.quantity > 1 && `×${e.quantity}`}
                        </span>
                        <span className="text-[13px] font-semibold text-[#22C55E]">+${e.surcharge}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing items */}
              {missingItems().length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Missing Items (credit)</p>
                  <div className="space-y-1.5">
                    {missingItems().map((m, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--brd)]/50">
                        <span className="text-[13px] text-[var(--tx)]">
                          {m.item_name} {m.quantity > 1 && `×${m.quantity}`}
                        </span>
                        <span className="text-[13px] font-semibold text-red-400">-${m.credit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Net change */}
              {(extraItems.length > 0 || missingItems().length > 0) && (
                <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--tx3)]">Subtotal change</span>
                    <span className={`font-semibold ${netDelta >= 0 ? "text-[var(--tx)]" : "text-[#22C55E]"}`}>
                      {netDelta >= 0 ? "+" : ""}{netDelta >= 0 ? `$${netDelta}` : `-$${Math.abs(netDelta)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-[var(--tx3)]">
                    <span>HST (13%)</span>
                    <span>{hst >= 0 ? "+" : ""}{hst >= 0 ? `$${hst.toFixed(2)}` : `-$${Math.abs(hst).toFixed(2)}`}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-base)] font-bold border-t border-[var(--brd)] pt-1.5 mt-1.5">
                    <span className="text-[var(--tx)]">Net change</span>
                    <span className={total >= 0 ? "text-[var(--tx)]" : "text-[#22C55E]"}>
                      {total >= 0 ? `+$${total.toFixed(2)}` : `-$${Math.abs(total).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* No-change hint */}
              {extraItems.length === 0 && missingItems().length === 0 && (
                <div className="rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/5 px-4 py-3 text-center">
                  <p className="text-[13px] text-[#22C55E] font-medium">Everything matches — no changes needed.</p>
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <Warning size={14} color="#EF4444" />
                  <p className="text-[12px] text-red-400">{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--brd)] px-5 py-4 space-y-2">

          {step === "skip" && (
            <>
              <button
                onClick={() => onSkip(skipReason)}
                className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-base)] text-white"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                Skip Walkthrough
              </button>
              <button
                onClick={() => setStep("intro")}
                className="w-full py-2.5 rounded-xl text-[12px] font-medium text-[var(--tx3)]"
              >
                Go back
              </button>
            </>
          )}

          {step === "checklist" && (
            <>
              <button
                onClick={() => setStep("extras")}
                className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-base)] text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                Continue <CaretRight size={14} />
              </button>
              <p className="text-center text-[11px] text-[var(--tx3)]">
                {matched} here · {missing} missing · {unchecked} unchecked
              </p>
            </>
          )}

          {step === "extras" && (
            <>
              <button
                onClick={() => setStep("summary")}
                className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-base)] text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                Review Summary <CaretRight size={14} />
              </button>
              <button
                onClick={() => setStep("checklist")}
                className="w-full py-2.5 rounded-xl text-[12px] font-medium text-[var(--tx3)]"
              >
                Back to checklist
              </button>
            </>
          )}

          {step === "summary" && (
            <>
              {(extraItems.length > 0 || missingItems().length > 0) ? (
                <>
                  <button
                    onClick={submitChangeRequest}
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-base)] text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                  >
                    {submitting ? <><CircleNotch size={14} className="animate-spin" /> Submitting…</> : "Submit Change Request"}
                  </button>
                  <button
                    onClick={() => setStep("extras")}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl text-[12px] font-medium text-[var(--tx3)] disabled:opacity-40"
                  >
                    Edit items
                  </button>
                </>
              ) : (
                <button
                  onClick={submitNoChanges}
                  className="w-full py-3.5 rounded-2xl font-bold text-[var(--text-base)] text-white"
                  style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                >
                  No Changes — Inventory Matches
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
