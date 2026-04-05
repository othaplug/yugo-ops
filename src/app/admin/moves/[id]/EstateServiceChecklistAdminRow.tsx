"use client";

import { useMemo, useState, useCallback } from "react";
import { buildEstateServiceChecklistItems } from "@/lib/estate-service-checklist";
import { deriveEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-automation";
import { calculateEstateDays } from "@/lib/quotes/estate-schedule";

type MoveSlice = {
  id: string;
  tier_selected?: string | null;
  service_tier?: string | null;
  status?: string | null;
  stage?: string | null;
  scheduled_date?: string | null;
  move_size?: string | null;
  inventory_score?: number | null;
  estate_service_checklist?: Record<string, boolean> | null;
};

export default function EstateServiceChecklistAdminRow({
  move,
  setMove,
}: {
  move: MoveSlice;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMove: React.Dispatch<React.SetStateAction<any>>;
}) {
  const plan = useMemo(
    () =>
      calculateEstateDays(
        move.move_size ?? null,
        Number(move.inventory_score) || 0,
      ),
    [move.move_size, move.inventory_score],
  );
  const items = useMemo(() => buildEstateServiceChecklistItems(plan), [plan]);

  const auto = useMemo(
    () =>
      deriveEstateServiceChecklistAutomation({
        tier_selected: move.tier_selected,
        service_tier: move.service_tier,
        status: move.status,
        stage: move.stage,
        scheduled_date: move.scheduled_date,
        move_size: move.move_size,
        inventory_score: move.inventory_score,
      }),
    [
      move.tier_selected,
      move.service_tier,
      move.status,
      move.stage,
      move.scheduled_date,
      move.move_size,
      move.inventory_score,
    ],
  );

  const stored = (move.estate_service_checklist as Record<string, boolean>) || {};
  const merged = useMemo(() => {
    const out = { ...stored };
    for (const [k, v] of Object.entries(auto)) {
      if (v) out[k] = true;
    }
    return out;
  }, [stored, auto]);

  const [saving, setSaving] = useState<string | null>(null);

  const setItem = useCallback(
    async (itemId: string, checked: boolean) => {
      setSaving(itemId);
      try {
        const res = await fetch(
          `/api/admin/moves/${move.id}/estate-service-checklist`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item: itemId, checked }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (data.checklist) {
          setMove((prev: MoveSlice) => ({
            ...prev,
            estate_service_checklist: data.checklist,
          }));
        }
      } finally {
        setSaving(null);
      }
    },
    [move.id, setMove],
  );

  const done = items.filter((i) => merged[i.id]).length;

  return (
    <div className="mt-3 sm:mt-4 flex flex-col gap-2 rounded-xl border border-[var(--brd)]/40 bg-[var(--gdim)]/15 px-3 py-2.5 sm:px-4">
      <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/80 shrink-0">
        Estate service checklist
      </span>
      <p className="text-[11px] text-[var(--tx3)] leading-snug">
        Same milestones as the client track. Walkthrough and packing can be set
        here. Move and unpacking follow live crew progress (locked while active).
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => {
          const checked = !!merged[item.id];
          const locked = !!auto[item.id];
          const busy = saving === item.id;
          return (
            <label
              key={item.id}
              className={`inline-flex items-center gap-2 text-[12px] text-[var(--tx)] select-none ${
                locked ? "cursor-not-allowed opacity-90" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-[var(--brd)]"
                checked={checked}
                disabled={busy || locked}
                onChange={(e) => setItem(item.id, e.target.checked)}
              />
              <span className={checked ? "text-[var(--tx2)]" : ""}>
                {item.label}
              </span>
            </label>
          );
        })}
      </div>
      <div className="text-[11px] text-[var(--tx3)]">
        {done}/{items.length} visible to client
      </div>
    </div>
  );
}
