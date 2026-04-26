"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InventoryInput, {
  type InventoryItemEntry,
} from "@/components/inventory/InventoryInput";
import { mapAISuggestionsToInventory } from "@/lib/ai/map-to-inventory";
import type { AIInventorySuggestion } from "@/lib/ai/photo-inventory";
import { formatTimeAgo } from "@/lib/format-time-ago";
import { PHOTO_ROOM_LABELS } from "@/lib/photo-survey/rooms";
import { residentialInventoryLineScore } from "@/lib/pricing/weight-tiers";
import { suggestMoveSizeFromInventory } from "@/lib/pricing/move-size-suggestion";
import { useToast } from "../../../components/Toast";
import { Sparkle, CaretRight } from "@phosphor-icons/react";

type ItemWeight = {
  slug: string;
  item_name: string;
  weight_score: number;
  category: string;
  room?: string;
  is_common: boolean;
  display_order?: number;
  active?: boolean;
};

export default function LeadPhotoReviewClient({
  leadId,
  lead,
  survey,
  photoUrls,
  itemWeights,
}: {
  leadId: string;
  lead: Record<string, unknown>;
  survey: Record<string, unknown> | null;
  photoUrls: Record<string, string[]>;
  itemWeights: ItemWeight[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>([]);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyText, setClarifyText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState<InventoryItemEntry[]>([]);
  const [aiRaw, setAiRaw] = useState<AIInventorySuggestion[] | null>(null);
  const [aiPick, setAiPick] = useState<Set<number>>(() => new Set());

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Lead";
  const specialNotes = survey && typeof survey.special_notes === "string" ? survey.special_notes : "";
  const totalPhotos = survey && survey.total_photos != null ? Number(survey.total_photos) : 0;
  const submittedAt = survey && survey.submitted_at != null ? String(survey.submitted_at) : "";

  const inventoryScore = useMemo(
    () => inventoryItems.reduce((s, i) => s + residentialInventoryLineScore(i), 0),
    [inventoryItems],
  );

  const suggestedMove = useMemo(() => {
    if (itemWeights.length === 0) return null;
    return suggestMoveSizeFromInventory(inventoryItems, 0, inventoryScore);
  }, [inventoryItems, itemWeights, inventoryScore]);

  const runAi = useCallback(async () => {
    if (!survey?.id) {
      toast("Survey is not ready for AI", "x");
      return;
    }
    setAiLoading(true);
    setAiOpen(false);
    try {
      const res = await fetch("/api/admin/ai/analyze-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survey_id: survey.id,
          photos: survey.photos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "AI failed");
      const sugg = (data.suggestions as AIInventorySuggestion[] | undefined) || [];
      setAiRaw(sugg);
      const mapped = mapAISuggestionsToInventory(sugg, itemWeights);
      setAiPreview(mapped);
      setAiPick(new Set(mapped.map((_, i) => i)));
      setAiOpen(mapped.length > 0);
      if (mapped.length === 0) {
        toast("No items detected. Add inventory manually or try again with clearer photos.", "x");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI failed", "x");
    } finally {
      setAiLoading(false);
    }
  }, [survey, itemWeights, toast]);

  const addAiSelected = useCallback(() => {
    if (aiRaw == null) return;
    const pick = Array.from(aiPick);
    if (pick.length < 1) {
      setAiOpen(false);
      return;
    }
    const toAdd = pick.map((i) => aiPreview[i]!).filter(Boolean);
    setInventoryItems((prev) => [...prev, ...toAdd]);
    setAiOpen(false);
    toast("Added to inventory", "check");
  }, [aiPreview, aiPick, aiRaw, toast]);

  const sendClarification = useCallback(async () => {
    if (!clarifyText.trim()) return;
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/intake-clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clarifyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setClarifyText("");
      setClarifyOpen(false);
      toast("Message sent to client", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  }, [clarifyText, leadId, toast]);

  const goToQuote = useCallback(async () => {
    if (inventoryItems.length < 1) {
      toast("Add at least one inventory line first", "x");
      return;
    }
    if (typeof window === "undefined") return;
    const ms = suggestedMove?.suggested;
    if (ms) {
      try {
        const res = await fetch(`/api/admin/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ move_size: ms }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error || "Could not update move size on lead");
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to set move size", "x");
        return;
      }
    }
    try {
      window.sessionStorage.setItem(
        `quote_inv_prefill_v1_${leadId}`,
        JSON.stringify(inventoryItems),
      );
    } catch {
      toast("Could not hand off inventory. Try again.", "x");
      return;
    }
    router.push(
      `/admin/quotes/new?lead_id=${encodeURIComponent(leadId)}&from_photo_review=1`,
    );
  }, [inventoryItems, leadId, router, suggestedMove, toast]);

  if (!survey) {
    return (
      <div className="p-6 text-sm text-[var(--tx2)]">No photo survey is linked to this lead.</div>
    );
  }

  return (
    <div className="w-full min-w-0 py-5 md:py-6">
      <div className="mb-4">
        <Link
          href={`/admin/leads/${leadId}`}
          className="text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)]"
        >
          Back to lead
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)]">Photo review</p>
          <h1 className="admin-page-hero text-[var(--tx)]">{name}</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-1">
            {totalPhotos} photos
            {submittedAt ? ` · Uploaded ${formatTimeAgo(submittedAt)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={goToQuote}
          disabled={inventoryItems.length < 1}
          className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-lg bg-[#2C3E2D] text-white text-[10px] font-bold tracking-[0.12em] uppercase disabled:opacity-30"
        >
          Generate quote
          <CaretRight size={16} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <h2 className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]">
            Photos by room
          </h2>
          {Object.keys(photoUrls).length < 1 ? (
            <p className="text-sm text-[var(--tx2)]">No images found for this survey.</p>
          ) : (
            Object.entries(photoUrls).map(([roomId, urls]) => (
              <div key={roomId}>
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-2">
                  {PHOTO_ROOM_LABELS[roomId] || roomId.replace(/_/g, " ")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                  {urls.map((u, i) => (
                    <a
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg overflow-hidden border border-[var(--brd)] bg-[var(--card)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="w-full h-36 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            ))
          )}

          {specialNotes ? (
            <div className="p-3 rounded-lg border border-amber-200/80 bg-amber-50/80">
              <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-amber-900/90 mb-1">
                Client note
              </p>
              <p className="text-sm text-amber-950/90 whitespace-pre-wrap">{specialNotes}</p>
            </div>
          ) : null}
        </div>

        <div>
          <div className="lg:sticky lg:top-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]">
                Inventory
                {inventoryItems.length > 0 ? (
                  <span className="ml-2 text-[#5C1A33] font-bold">
                    {inventoryItems.length} items · {inventoryScore.toFixed(1)} score
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => void runAi()}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.1em] uppercase px-2.5 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--hover)] disabled:opacity-40"
              >
                <Sparkle size={14} weight="duotone" aria-hidden />
                {aiLoading ? "Scanning…" : "AI suggest"}
              </button>
            </div>

            {aiOpen && aiPreview.length > 0 ? (
              <div className="p-3 rounded-lg border border-[#5C1A33]/20 bg-[#FFFBF7]">
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5C1A33] mb-2">
                  AI suggested lines
                </p>
                <ul className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {aiPreview.map((it, i) => {
                    const s = aiRaw?.[i];
                    const c = s?.confidence || "low";
                    const confClass =
                      c === "high"
                        ? "bg-[#F4FAF4] border-[#2C3E2D]/20"
                        : c === "medium"
                          ? "bg-amber-50/90 border-amber-200/60"
                          : "bg-red-50/50 border-red-200/50";
                    return (
                      <li
                        key={i}
                        className={`flex gap-2 items-start rounded-md border p-2 text-xs ${confClass}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={aiPick.has(i)}
                          onChange={() => {
                            setAiPick((prev) => {
                              const n = new Set(prev);
                              if (n.has(i)) n.delete(i);
                              else n.add(i);
                              return n;
                            });
                          }}
                          aria-label={`Select ${it.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[var(--tx)] font-medium">
                            {it.name}
                            {it.quantity > 1 ? (
                              <span className="text-[var(--tx3)]"> x{it.quantity}</span>
                            ) : null}
                          </p>
                          {s?.note ? (
                            <p className="text-[10px] text-[var(--tx3)] mt-0.5">{s.note}</p>
                          ) : null}
                        </div>
                        <span className="text-[9px] font-semibold text-[var(--tx3)] shrink-0">
                          {c}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={addAiSelected}
                    className="px-3 py-1.5 rounded-lg bg-[#2C3E2D] text-white text-[9px] font-bold tracking-[0.1em] uppercase"
                  >
                    Add selected
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInventoryItems((prev) => [...prev, ...aiPreview]);
                      setAiOpen(false);
                      toast("Added all lines", "check");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[9px] font-bold"
                  >
                    Add all
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiOpen(false)}
                    className="text-[9px] text-[var(--tx3)] px-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            {itemWeights.length > 0 ? (
              <InventoryInput
                itemWeights={itemWeights}
                value={inventoryItems}
                onChange={setInventoryItems}
                moveSize="partial"
                showLabourEstimate={!!inventoryItems.length}
                mode="residential"
              />
            ) : (
              <p className="text-sm text-[var(--tx2)]">Inventory catalog is not available.</p>
            )}

            <button
              type="button"
              onClick={() => setClarifyOpen((v) => !v)}
              className="text-[11px] font-semibold text-[#5C1A33]"
            >
              Ask the client a question
            </button>
            {clarifyOpen ? (
              <div className="p-3 rounded-lg border border-[var(--brd)] bg-[var(--card)]">
                <textarea
                  value={clarifyText}
                  onChange={(e) => setClarifyText(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-[var(--brd)] rounded-lg px-2 py-2 bg-[var(--bg)]"
                  placeholder="For example, confirm a material or access detail for accurate handling."
                />
                <button
                  type="button"
                  onClick={() => void sendClarification()}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-[#2C3E2D] text-white text-[9px] font-bold tracking-[0.1em] uppercase"
                >
                  Send to client
                </button>
                <p className="text-[9px] text-[var(--tx3)] mt-1">Sends email and SMS when contact info is on file.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
