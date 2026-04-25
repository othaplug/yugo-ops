"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
import {
  calculateExtraItemPrice,
  fragileItemNameHint,
  weightTierFromLegacyScore,
  type ExtraItemWeightTier,
} from "@/lib/pricing/extra-item-surcharges";
import { creditForRemovedLine } from "@/lib/inventory-change-requests";
import { Yu3PortaledTokenRoot } from "@/hooks/useAdminShellTheme";

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
  /** Priced line amount; null when coordinator must set price (custom description). */
  surcharge: number | null;
  pendingCoordinatorPricing?: boolean;
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

const B2B_QUICK_PICKS: { label: string; tier: ExtraItemWeightTier }[] = [
  { label: "Flooring boxes", tier: "light" },
  { label: "Tile boxes", tier: "light" },
  { label: "Trim / moulding", tier: "light" },
  { label: "Cabinet (upper)", tier: "standard" },
  { label: "Cabinet (lower)", tier: "standard" },
  { label: "Countertop slab", tier: "heavy" },
  { label: "Furniture piece", tier: "standard" },
  { label: "Display fixture", tier: "standard" },
  { label: "Equipment unit", tier: "heavy" },
  { label: "Appliance", tier: "heavy" },
  { label: "Box (light)", tier: "light" },
  { label: "Box (heavy)", tier: "standard" },
  { label: "Signage", tier: "standard" },
  { label: "Rug (rolled)", tier: "standard" },
  { label: "Art / frame", tier: "standard" },
];

interface WalkthroughModalProps {
  jobId: string;
  /** Moves use move walkthrough API; deliveries use /api/crew/delivery/[id]/walkthrough */
  jobType?: "move" | "delivery";
  /** Residential move vs delivery / B2B logistics wording */
  copyVariant?: "residential_move" | "logistics";
  /** Partner-linked delivery — show B2B-oriented quick-add labels. */
  b2bExtraItemHints?: boolean;
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

const RESIDENTIAL_SKIP_REASONS = [
  { value: "client_refused", label: "Client refused walkthrough" },
  { value: "small_move", label: "Small move / partial (< 5 items)" },
  {
    value: "not_applicable",
    label: "Walkthrough not applicable (labour only)",
  },
];

const LOGISTICS_SKIP_REASONS = [
  { value: "client_refused", label: "Site contact refused verification" },
  { value: "small_move", label: "Small shipment / partial (< 5 items)" },
  {
    value: "not_applicable",
    label: "Not applicable (labour only)",
  },
];

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export default function WalkthroughModal({
  jobId,
  jobType = "move",
  copyVariant = "residential_move",
  b2bExtraItemHints = false,
  inventory,
  perScoreRate: _perScoreRate = 35,
  onComplete,
  onSkip,
  onClose,
}: WalkthroughModalProps) {
  const logistics = copyVariant === "logistics";
  const skipReasons = logistics
    ? LOGISTICS_SKIP_REASONS
    : RESIDENTIAL_SKIP_REASONS;
  const modalTitle = logistics
    ? "Job list verification"
    : "Inventory walkthrough";
  const [step, setStep] = useState<
    "intro" | "checklist" | "extras" | "summary" | "skip"
  >("intro");

  // Flatten all inventory items from the quote
  const [items, setItems] = useState<WalkthroughItem[]>(() => {
    const flat: WalkthroughItem[] = [];
    for (const room of inventory) {
      const roomItems =
        room.itemsWithId ??
        room.items.map((name, i) => ({
          id: `noid-${room.room}-${i}`,
          item_name: name,
          quantity: 1,
        }));
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
  const [skipReason, setSkipReason] = useState(
    RESIDENTIAL_SKIP_REASONS[0].value,
  );

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
        const res = await fetch(
          `/api/crew/item-weights?q=${encodeURIComponent(searchQuery.trim())}&limit=8`,
        );
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
    extraItems.reduce((sum, e) => sum + (e.surcharge ?? 0), 0) -
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
        credit: creditForRemovedLine({
          move_inventory_id: i.id,
          item_name: i.item_name,
          item_slug: null,
          weight_score: 1,
          quantity: i.quantity,
        }),
      }));
  }

  /** Delivery rows use synthetic `noid-*` ids — still count as discrepancies for summary / API. */
  function deliveryMissingPayload(): { item_name: string; quantity: number }[] {
    return items
      .filter((i) => i.status === "missing")
      .map((i) => ({ item_name: i.item_name, quantity: i.quantity ?? 1 }));
  }

  const hasDiscrepancyForSubmit =
    extraItems.length > 0 ||
    missingItems().length > 0 ||
    (jobType === "delivery" && missing > 0);

  // ── Handlers
  function setItemStatus(id: string, status: "here" | "missing") {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status } : it)),
    );
  }

  function addExtraItem() {
    if (selectedItem) {
      const tier = weightTierFromLegacyScore(selectedItem.weight_score);
      const surcharge = calculateExtraItemPrice(
        selectedItem.item_name,
        tier,
        extraQty,
        fragileItemNameHint(selectedItem.item_name),
      );
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
      setExtraItems((prev) => [
        ...prev,
        {
          item_name: customItemName.trim(),
          item_slug: null,
          weight_score: ws,
          quantity: extraQty,
          is_custom: true,
          custom_weight_class: customWeightClass,
          surcharge: null,
          pendingCoordinatorPricing: true,
        },
      ]);
    }
    setAddExtraOpen(false);
    setSelectedItem(null);
    setCustomItemName("");
    setSearchQuery("");
    setExtraQty(1);
  }

  function addB2BQuickPick(label: string, tier: ExtraItemWeightTier) {
    const ws =
      tier === "light"
        ? 0.5
        : tier === "standard"
          ? 1
          : tier === "heavy"
            ? 2
            : 3;
    const surcharge = calculateExtraItemPrice(label, tier, 1, false);
    setExtraItems((prev) => [
      ...prev,
      {
        item_name: label,
        item_slug: null,
        weight_score: ws,
        quantity: 1,
        is_custom: false,
        surcharge,
      },
    ]);
  }

  function removeExtra(idx: number) {
    setExtraItems((prev) => prev.filter((_, i) => i !== idx));
  }

  /** Persist pickup-stage inventory checks so the Items tab reflects walkthrough completion. */
  async function verifyPickupFromWalkthrough(
    mode: "here_only" | "all_present",
  ) {
    const list =
      mode === "here_only"
        ? items.filter((i) => i.status === "here")
        : items.filter((i) => i.status !== "missing");
    await Promise.all(
      list.map(async (i) => {
        if (!i.id.startsWith("noid-")) {
          await fetch(
            `/api/crew/inventory/${encodeURIComponent(jobId)}/verify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ moveInventoryId: i.id, stage: "loading" }),
            },
          );
        } else {
          await fetch(
            `/api/crew/inventory/${encodeURIComponent(jobId)}/verify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                room: i.room,
                itemName: i.item_name,
                stage: "loading",
              }),
            },
          );
        }
      }),
    );
  }

  async function submitChangeRequest() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const missing = missingItems();
      const deliveryMissing =
        jobType === "delivery" ? deliveryMissingPayload() : [];

      if (jobType === "delivery") {
        const res = await fetch(
          `/api/crew/delivery/${encodeURIComponent(jobId)}/walkthrough`,
          {
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
              items_missing: deliveryMissing,
              items_matched: matched,
              items_missing_count: deliveryMissing.length,
              items_extra: extraItems.length,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit");
        await verifyPickupFromWalkthrough("here_only");
        onComplete({
          itemsMatched: matched,
          itemsMissing: deliveryMissing.length,
          itemsExtra: extraItems.length,
          extraItems,
          missingItems: missing,
          netDelta,
          changeRequestId: data.id ?? null,
          noChanges: false,
        });
        return;
      }

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
      await verifyPickupFromWalkthrough("here_only");
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

  async function submitNoChanges() {
    setSubmitting(true);
    setSubmitError("");
    try {
      await verifyPickupFromWalkthrough("all_present");
      const present = items.filter((i) => i.status !== "missing").length;
      onComplete({
        itemsMatched: present,
        itemsMissing: 0,
        itemsExtra: 0,
        extraItems: [],
        missingItems: [],
        netDelta: 0,
        changeRequestId: null,
        noChanges: true,
      });
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to save verification",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const hst = Math.round(netDelta * 0.13 * 100) / 100;
  const total = Math.round((netDelta + hst) * 100) / 100;

  // Group items by room for the checklist view
  const roomGroups = inventory
    .map((room) => ({
      room: room.room,
      items: items.filter((it) => it.room === room.room),
    }))
    .filter((g) => g.items.length > 0);

  const modal = (
    <div
      className="premium-field-host fixed inset-0 z-[99995] flex min-h-0 items-center justify-center p-4 sm:p-5"
      data-modal-root
      data-crew-portal
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="fixed inset-0 z-0 modal-overlay" aria-hidden />
      <Yu3PortaledTokenRoot
        data-crew-job-premium
        className="relative z-10 flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[var(--yu3-r-xl)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] shadow-[var(--yu3-shadow-lg)] sm:rounded-[var(--yu3-r-xl)] modal-card"
        style={{ maxHeight: "min(92dvh, 92vh)" }}
      >
        <div className="sticky top-0 bg-[#FFFBF7]/80 backdrop-blur-md border-b border-[#2C3E2D]/10 px-5 py-4 z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-hero text-[22px] font-semibold text-[#2b1810] tracking-[-0.02em] leading-tight">
              {modalTitle}
            </h3>
            <p className="text-[11px] text-[#5C1A33]/50 mt-1.5 leading-snug [font-family:var(--font-body)]">
              {step === "intro" &&
                (logistics
                  ? "Verify the manifest with the site contact or receiver."
                  : "Walk through with the client and verify the inventory.")}
              {step === "checklist" && `${items.length} items to verify`}
              {step === "extras" && "Add any extra items found"}
              {step === "summary" && "Review changes before submitting"}
              {step === "skip" &&
                (logistics
                  ? "Select a reason for skipping verification"
                  : "Select a reason for skipping")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="crew-job-action-chip shrink-0 p-2 text-[#5C1A33]/45 hover:text-[#5C1A33] hover:bg-[#5C1A33]/[0.06] transition-colors rounded-lg"
            aria-label="Close"
          >
            <X size={18} weight="regular" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── INTRO ── */}
          {step === "intro" && (
            <div className="text-center py-5 sm:py-6 space-y-6">
              <div className="w-[76px] h-[76px] rounded-2xl border border-[#5C1A33]/12 bg-gradient-to-br from-[#FAF3F5] via-[#F7EEF1] to-[#F2E6EA] flex items-center justify-center mx-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <div className="w-[52px] h-[52px] rounded-full bg-[#5C1A33] flex items-center justify-center shadow-[0_4px_14px_rgba(92,26,51,0.35)]">
                  <CheckCircle
                    size={30}
                    color="#FFFBF7"
                    weight="fill"
                    aria-hidden
                  />
                </div>
              </div>
              <div className="px-1">
                <h4 className="font-hero text-[24px] sm:text-[26px] font-semibold text-[#2b1810] mb-2 tracking-[-0.02em] leading-tight">
                  {logistics
                    ? "Step 1: Verify the job list"
                    : "Step 1: Inventory walkthrough"}
                </h4>
                <p className="text-[13px] sm:text-[14px] text-[#3d2a26]/90 leading-relaxed [font-family:var(--font-body)]">
                  {logistics ? (
                    <>
                      With the site contact or receiver, confirm the job list
                      matches what&apos;s on site. Flag missing lines and add
                      anything extra.
                    </>
                  ) : (
                    <>
                      Walk through with the client and verify that the inventory
                      on their quote matches what&apos;s actually here. Flag
                      missing items and add anything extra.
                    </>
                  )}
                </p>
                <p className="text-[12px] sm:text-[13px] font-semibold text-[#5C1A33]/85 mt-3 leading-snug [font-family:var(--font-body)]">
                  {logistics
                    ? "The line-by-line checklist opens on the next screen. Tap Start inventory check."
                    : "The room-by-room checklist opens on the next screen. Tap Start inventory check."}
                </p>
              </div>
              <div className="rounded-xl border border-[#5C1A33]/12 bg-gradient-to-br from-[#FAF3F5] via-[#F7EEF1] to-[#F2E6EA] px-4 py-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
                <p className="text-[10px] font-bold text-[#5C1A33]/65 uppercase tracking-[0.12em] mb-1.5 [font-family:var(--font-body)] leading-none">
                  Remember
                </p>
                <p className="text-[12px] text-[#3d2a26] leading-relaxed [font-family:var(--font-body)]">
                  You cannot set or change prices. Just identify what&apos;s
                  here and what&apos;s missing — your coordinator will handle
                  any price adjustments.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("checklist")}
                  className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.1em] [font-family:var(--font-body)] leading-none active:scale-[0.99] transition-transform"
                >
                  Start inventory check
                  <CaretRight
                    size={18}
                    weight="bold"
                    className="shrink-0 opacity-95"
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setStep("skip")}
                  className="w-full py-2.5 text-[12px] font-medium text-[#5C1A33]/55 hover:text-[#5C1A33] underline-offset-[3px] hover:underline transition-colors [font-family:var(--font-body)]"
                >
                  Skip (with reason)
                </button>
              </div>
            </div>
          )}

          {/* ── SKIP ── */}
          {step === "skip" && (
            <div className="space-y-4">
              <p className="text-[12px] text-[var(--tx3)]">
                {logistics
                  ? "Why skip verification?"
                  : "Why is the walkthrough being skipped?"}
              </p>
              {skipReasons.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    skipReason === r.value
                      ? "border-[#5C1A33] bg-[#5C1A33]/8"
                      : "border-[var(--brd)] hover:border-[var(--brd)]/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="skip_reason"
                    value={r.value}
                    checked={skipReason === r.value}
                    onChange={() => setSkipReason(r.value)}
                    className="accent-[#5C1A33]"
                  />
                  <span className="text-[13px] text-[var(--tx)]">
                    {r.label}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* ── CHECKLIST ── */}
          {step === "checklist" && (
            <div className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-[13px] text-[var(--tx3)]">
                  {logistics
                    ? "No items on this job list."
                    : "No inventory items on this quote."}
                </div>
              ) : (
                roomGroups.map((group) => (
                  <div
                    key={group.room}
                    className="rounded-xl border border-[var(--brd)]/60 overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-[var(--bg)]/80 border-b border-[var(--brd)]/40">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C1A33]">
                        {group.room}
                      </span>
                    </div>
                    <div className="divide-y divide-[var(--brd)]/30">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <div className="shrink-0">
                            {item.status === "here" ? (
                              <div className="w-5 h-5 rounded-full bg-[#5C1A33]/12 border border-[#5C1A33]/45 flex items-center justify-center">
                                <Check
                                  size={10}
                                  color="#5C1A33"
                                  weight="bold"
                                  aria-hidden
                                />
                              </div>
                            ) : item.status === "missing" ? (
                              <div className="w-5 h-5 rounded-full bg-red-50 border border-red-300/80 flex items-center justify-center">
                                <X
                                  size={9}
                                  color="#B91C1C"
                                  weight="bold"
                                  aria-hidden
                                />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-[#5C1A33]/18 bg-[#FFFBF7]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] text-[var(--tx)]">
                              {item.item_name}
                            </span>
                            {(item.quantity ?? 1) > 1 && (
                              <span className="ml-1.5 text-[10px] text-[var(--tx3)]">
                                ×{item.quantity}
                              </span>
                            )}
                          </div>
                          {item.status !== "here" && (
                            <button
                              type="button"
                              onClick={() => setItemStatus(item.id, "here")}
                              className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#5C1A33]/10 text-[#5C1A33] hover:bg-[#5C1A33]/18 border border-[#5C1A33]/20 transition-colors active:scale-[0.98] [font-family:var(--font-body)]"
                            >
                              Here
                            </button>
                          )}
                          {item.status !== "missing" && (
                            <button
                              type="button"
                              onClick={() => setItemStatus(item.id, "missing")}
                              className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 text-red-800 hover:bg-red-100 border border-red-200/90 transition-colors active:scale-[0.98] [font-family:var(--font-body)]"
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
                Add any items found that were{" "}
                <strong className="text-[var(--tx)]">
                  {logistics
                    ? "not on the original job list"
                    : "not on the original quote"}
                </strong>
                .
              </p>

              {extraItems.length > 0 && (
                <div className="space-y-2">
                  {extraItems.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#5C1A33]/25 bg-[#5C1A33]/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--tx)] font-medium">
                          {e.item_name} {e.quantity > 1 && `×${e.quantity}`}
                        </p>
                        <p className="text-[11px] text-[var(--tx3)]">
                          {e.pendingCoordinatorPricing
                            ? "Coordinator will set price"
                            : e.is_custom
                              ? WEIGHT_CLASS_LABELS[
                                  e.custom_weight_class ?? "medium"
                                ]
                              : `Score ${e.weight_score}`}
                        </p>
                      </div>
                      <span className="text-[13px] font-semibold text-[#5C1A33]">
                        {e.surcharge != null ? `+$${e.surcharge}` : "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeExtra(i)}
                        className="p-1 rounded-lg text-[#5C1A33]/40 hover:text-red-600 transition-colors"
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
                      <label className="admin-premium-label admin-premium-label--tight">
                        Search item
                      </label>
                      <div className="relative">
                        <MagnifyingGlass
                          size={14}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx2)]"
                          aria-hidden
                        />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="e.g. dining table, boxes…"
                          className="admin-premium-input w-full pl-10 pr-3 py-2 text-[13px] text-[var(--tx)]"
                        />
                        {searching && (
                          <CircleNotch
                            size={13}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] animate-spin"
                          />
                        )}
                      </div>
                      {searchResults.length > 0 && (
                        <div className="mt-1.5 rounded-lg border border-[var(--brd)] bg-[var(--card)] shadow-lg overflow-hidden">
                          {searchResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => {
                                setSelectedItem(r);
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--bg)] border-b border-[var(--brd)]/50 last:border-0 transition-colors"
                            >
                              <span className="text-[13px] text-[var(--tx)]">
                                {r.item_name}
                              </span>
                              <span className="text-[11px] text-[var(--tx3)]">
                                +
                                {calculateExtraItemPrice(
                                  r.item_name,
                                  weightTierFromLegacyScore(r.weight_score),
                                  1,
                                  fragileItemNameHint(r.item_name),
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery &&
                        !searching &&
                        searchResults.length === 0 && (
                          <p className="mt-1.5 text-[11px] text-[var(--tx3)]">
                            Not found -{" "}
                            <button
                              onClick={() => {
                                setCustomItemName(searchQuery);
                                setSearchQuery("");
                              }}
                              className="text-[#5C1A33] font-medium"
                            >
                              add custom item
                            </button>
                          </p>
                        )}
                    </div>
                  )}

                  {/* Selected item */}
                  {selectedItem && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#5C1A33]/8 border border-[#5C1A33]/20">
                      <span className="flex-1 text-[13px] font-medium text-[var(--tx)]">
                        {selectedItem.item_name}
                      </span>
                      <span className="text-[11px] text-[var(--tx3)]">
                        +
                        {calculateExtraItemPrice(
                          selectedItem.item_name,
                          weightTierFromLegacyScore(selectedItem.weight_score),
                          1,
                          fragileItemNameHint(selectedItem.item_name),
                        )}
                        /unit
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        className="text-[#5C1A33]/40 hover:text-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Custom item */}
                  {!selectedItem && customItemName && (
                    <div>
                      <label className="admin-premium-label admin-premium-label--tight">
                        Item name
                      </label>
                      <input
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="admin-premium-input w-full text-[var(--tx)] text-[13px]"
                      />
                      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mt-3 mb-1">
                        Weight
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(WEIGHT_CLASS_LABELS).map(
                          ([k, label]) => (
                            <button
                              key={k}
                              onClick={() => setCustomWeightClass(k)}
                              className={`px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors ${
                                customWeightClass === k
                                  ? "border-[#5C1A33] bg-[#5C1A33]/10 text-[#5C1A33]"
                                  : "border-[var(--brd)] text-[var(--tx2)]"
                              }`}
                            >
                              {label}
                            </button>
                          ),
                        )}
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
                          className="w-8 h-8 border border-[var(--brd)] flex items-center justify-center text-[var(--tx)] hover:bg-[var(--bg)] text-lg font-medium"
                        >
                          −
                        </button>
                        <span className="text-[16px] font-bold text-[var(--tx)] w-8 text-center">
                          {extraQty}
                        </span>
                        <button
                          onClick={() => setExtraQty((q) => q + 1)}
                          className="w-8 h-8 border border-[var(--brd)] flex items-center justify-center text-[var(--tx)] hover:bg-[var(--bg)] text-lg font-medium"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAddExtraOpen(false);
                        setSelectedItem(null);
                        setCustomItemName("");
                        setSearchQuery("");
                        setExtraQty(1);
                      }}
                      className="flex-1 py-2.5 rounded-lg border border-[#5C1A33]/20 text-[#3d2a26] text-[13px] font-medium hover:bg-[#5C1A33]/[0.05] transition-colors [font-family:var(--font-body)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addExtraItem}
                      disabled={!selectedItem && !customItemName.trim()}
                      className="crew-premium-cta flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-[0.08em] disabled:opacity-40 [font-family:var(--font-body)] leading-none"
                    >
                      Add
                      <CaretRight
                        size={16}
                        weight="bold"
                        className="shrink-0 opacity-95"
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddExtraOpen(true)}
                  className="w-full py-2.5 rounded-xl border border-[#5C1A33]/30 bg-[#5C1A33]/6 text-[13px] font-medium text-[#5C1A33] hover:bg-[#5C1A33]/12 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={14} /> Add Extra Item
                </button>
              )}
              {b2bExtraItemHints && !addExtraOpen && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-[var(--tx3)] uppercase tracking-wider">
                    Common B2B items
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {B2B_QUICK_PICKS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => addB2BQuickPick(p.label, p.tier)}
                        className="px-2 py-1 rounded-lg border border-[var(--brd)] text-[10px] leading-tight text-[var(--tx2)] hover:bg-[var(--bg)] text-left"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SUMMARY ── */}
          {step === "summary" && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[20px] font-bold text-[#5C1A33]">
                    {matched}
                  </p>
                  <p className="text-[10px] text-[#5C1A33]/60 uppercase tracking-[0.1em] mt-0.5 [font-family:var(--font-body)]">
                    Matched
                  </p>
                </div>
                <div>
                  <p className="text-[20px] font-bold text-red-700">
                    {missing}
                  </p>
                  <p className="text-[10px] text-red-600/80 uppercase tracking-[0.1em] mt-0.5 [font-family:var(--font-body)]">
                    Missing
                  </p>
                </div>
                <div>
                  <p className="text-[20px] font-bold text-[#5C1A33]">
                    {extraItems.length}
                  </p>
                  <p className="text-[10px] text-[#5C1A33]/60 uppercase tracking-[0.1em] mt-0.5 [font-family:var(--font-body)]">
                    Extra
                  </p>
                </div>
              </div>

              {/* Extra items */}
              {extraItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">
                    Extra Items
                  </p>
                  <div className="space-y-1.5">
                    {extraItems.map((e, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--brd)]/50"
                      >
                        <span className="text-[13px] text-[var(--tx)]">
                          {e.item_name} {e.quantity > 1 && `×${e.quantity}`}
                        </span>
                        <span className="text-[13px] font-semibold text-[#5C1A33]">
                          {e.surcharge != null ? `+$${e.surcharge}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing items (all flagged missing; move rows may show estimated credit) */}
              {items.filter((i) => i.status === "missing").length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">
                    {jobType === "move"
                      ? "Missing Items (credit)"
                      : "Missing Items"}
                  </p>
                  <div className="space-y-1.5">
                    {items
                      .filter((i) => i.status === "missing")
                      .map((m) => {
                        const credit =
                          jobType === "move" && !m.id.startsWith("noid-")
                            ? creditForRemovedLine({
                                move_inventory_id: m.id,
                                item_name: m.item_name,
                                item_slug: null,
                                weight_score: 1,
                                quantity: m.quantity ?? 1,
                              })
                            : null;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--brd)]/50"
                          >
                            <span className="text-[13px] text-[var(--tx)]">
                              {m.item_name}{" "}
                              {(m.quantity ?? 1) > 1 && `×${m.quantity}`}
                            </span>
                            {credit != null ? (
                              <span className="text-[13px] font-semibold text-red-700">
                                -${credit}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[var(--tx3)]">
                                Flagged
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Net change */}
              {hasDiscrepancyForSubmit && (
                <div className="rounded-xl border border-[#5C1A33]/12 bg-gradient-to-br from-[#FAF3F5]/80 to-[#F7EEF1]/50 px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#5C1A33]/55 [font-family:var(--font-body)]">
                      Subtotal change
                    </span>
                    <span
                      className={`font-semibold [font-family:var(--font-body)] ${netDelta >= 0 ? "text-[#3d2a26]" : "text-[#5C1A33]"}`}
                    >
                      {netDelta >= 0 ? "+" : ""}
                      {netDelta >= 0
                        ? `$${netDelta}`
                        : `-$${Math.abs(netDelta)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-[#5C1A33]/45 [font-family:var(--font-body)]">
                    <span>HST (13%)</span>
                    <span>
                      {hst >= 0 ? "+" : ""}
                      {hst >= 0
                        ? `$${hst.toFixed(2)}`
                        : `-$${Math.abs(hst).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[14px] font-bold border-t border-[#5C1A33]/10 pt-1.5 mt-1.5 [font-family:var(--font-body)]">
                    <span className="text-[#2b1810]">Net change</span>
                    <span
                      className={
                        total >= 0 ? "text-[#2b1810]" : "text-[#5C1A33]"
                      }
                    >
                      {total >= 0
                        ? `+$${total.toFixed(2)}`
                        : `-$${Math.abs(total).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* No-change hint */}
              {!hasDiscrepancyForSubmit && (
                <p className="text-center text-[13px] text-[#5C1A33]/80 font-medium [font-family:var(--font-body)] leading-relaxed">
                  Everything matches, no changes needed.
                </p>
              )}

              {submitError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200/90">
                  <Warning
                    size={16}
                    className="text-red-600 shrink-0 mt-0.5"
                    weight="regular"
                    aria-hidden
                  />
                  <p className="text-[12px] text-red-800 leading-snug [font-family:var(--font-body)]">
                    {submitError}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[#FFFBF7] border-t border-[#2C3E2D]/10 px-5 py-4 space-y-2">
          {step === "skip" && (
            <>
              <button
                type="button"
                onClick={() => onSkip(skipReason)}
                className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.1em] [font-family:var(--font-body)] leading-none"
              >
                {logistics ? "Skip verification" : "Skip walkthrough"}
                <CaretRight
                  size={18}
                  weight="bold"
                  className="shrink-0 opacity-95"
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => setStep("intro")}
                className="w-full py-2.5 text-[12px] font-medium text-[#5C1A33]/55 hover:text-[#5C1A33] transition-colors [font-family:var(--font-body)]"
              >
                Go back
              </button>
            </>
          )}

          {step === "checklist" && (
            <>
              <button
                type="button"
                onClick={() => setStep("extras")}
                className="crew-premium-cta w-full inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.1em] [font-family:var(--font-body)] leading-none"
              >
                Continue
                <CaretRight
                  size={18}
                  weight="bold"
                  className="shrink-0 opacity-95"
                  aria-hidden
                />
              </button>
              <p className="text-center text-[11px] text-[#5C1A33]/45 [font-family:var(--font-body)]">
                {matched} here · {missing} missing · {unchecked} unchecked
              </p>
            </>
          )}

          {step === "extras" && (
            <>
              <button
                type="button"
                onClick={() => setStep("summary")}
                className="crew-premium-cta w-full inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.1em] [font-family:var(--font-body)] leading-none"
              >
                Review summary
                <CaretRight
                  size={18}
                  weight="bold"
                  className="shrink-0 opacity-95"
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => setStep("checklist")}
                className="w-full py-2.5 text-[12px] font-medium text-[#5C1A33]/55 hover:text-[#5C1A33] transition-colors [font-family:var(--font-body)]"
              >
                Back to checklist
              </button>
            </>
          )}

          {step === "summary" && (
            <>
              {hasDiscrepancyForSubmit ? (
                <>
                  <button
                    type="button"
                    onClick={submitChangeRequest}
                    disabled={submitting}
                    className="crew-premium-cta w-full inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.08em] disabled:opacity-60 [font-family:var(--font-body)] leading-none"
                  >
                    {submitting ? (
                      <>
                        <CircleNotch
                          size={18}
                          className="animate-spin shrink-0"
                          aria-hidden
                        />
                        Submitting…
                      </>
                    ) : logistics ? (
                      <>
                        Submit walkthrough notes
                        <CaretRight
                          size={18}
                          weight="bold"
                          className="shrink-0 opacity-95"
                          aria-hidden
                        />
                      </>
                    ) : (
                      <>
                        Submit change request
                        <CaretRight
                          size={18}
                          weight="bold"
                          className="shrink-0 opacity-95"
                          aria-hidden
                        />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("extras")}
                    disabled={submitting}
                    className="w-full py-2.5 text-[12px] font-medium text-[#5C1A33]/55 hover:text-[#5C1A33] disabled:opacity-40 transition-colors [font-family:var(--font-body)]"
                  >
                    Edit items
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitNoChanges()}
                  disabled={submitting}
                  className="crew-premium-cta w-full inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.08em] disabled:opacity-60 [font-family:var(--font-body)] leading-none"
                >
                  {submitting ? (
                    "Saving…"
                  ) : (
                    <>
                      No changes, inventory matches
                      <CaretRight
                        size={18}
                        weight="bold"
                        className="shrink-0 opacity-95"
                        aria-hidden
                      />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </Yu3PortaledTokenRoot>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
