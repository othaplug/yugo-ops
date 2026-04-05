"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Lock } from "@phosphor-icons/react";
import {
  buildEstateServiceChecklistItems,
  type EstateServiceChecklistItem,
} from "@/lib/estate-service-checklist";
import { deriveEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-automation";
import type { EstateDayPlan } from "@/lib/quotes/estate-schedule";
import YugoLogo from "@/components/YugoLogo";

/** Deep wine panel — Estate timeline (matches premium reference). */
const PANEL_BG =
  "linear-gradient(165deg, #3d1228 0%, #2a0a16 48%, #1f0812 100%)";
const INK = "rgba(249, 237, 228, 0.94)";
const INK_MUTED = "rgba(249, 237, 228, 0.58)";
const LINE = "rgba(249, 237, 228, 0.22)";
const NODE_RING = "rgba(249, 237, 228, 0.72)";
const NODE_FILL = "#1a070d";

function TimelineNode({
  complete,
  saving,
  locked,
}: {
  complete: boolean;
  saving: boolean;
  locked: boolean;
}) {
  if (saving) {
    return (
      <span
        className="relative z-[1] flex h-[18px] w-[18px] shrink-0 items-center justify-center"
        aria-hidden
      >
        <span
          className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin"
          style={{ color: INK_MUTED }}
        />
      </span>
    );
  }

  return (
    <span
      className="relative z-[1] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300"
      style={{
        borderColor: complete ? INK : NODE_RING,
        backgroundColor: NODE_FILL,
      }}
      aria-hidden
    >
      {complete ? (
        locked ? (
          <Lock className="h-2.5 w-2.5" weight="bold" style={{ color: INK }} />
        ) : (
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: INK }}
          />
        )
      ) : null}
    </span>
  );
}

export type EstateChecklistAutomationProps = {
  status?: string | null;
  stage?: string | null;
  scheduled_date?: string | null;
  move_size?: string | null;
  inventory_score?: number | null;
  tier_selected?: string | null;
  service_tier?: string | null;
};

interface Props {
  moveId: string;
  token: string;
  plan: EstateDayPlan;
  initialChecked: Record<string, boolean>;
  moveDateStr?: string;
  automationInputs: EstateChecklistAutomationProps;
}

export default function EstateServiceChecklist({
  moveId,
  token,
  plan,
  initialChecked,
  moveDateStr,
  automationInputs,
}: Props) {
  const items = useMemo(() => buildEstateServiceChecklistItems(plan), [plan]);

  const auto = useMemo(
    () => deriveEstateServiceChecklistAutomation(automationInputs),
    [automationInputs],
  );

  const [stored, setStored] = useState<Record<string, boolean>>(
    initialChecked || {},
  );

  useEffect(() => {
    setStored(initialChecked || {});
  }, [initialChecked]);

  const merged = useMemo(() => {
    const out: Record<string, boolean> = { ...stored };
    for (const [k, v] of Object.entries(auto)) {
      if (v) out[k] = true;
    }
    return out;
  }, [stored, auto]);

  const [saving, setSaving] = useState<string | null>(null);

  const toggle = useCallback(
    async (id: string) => {
      if (auto[id]) return;
      const newVal = !merged[id];
      setStored((prev) => ({ ...prev, [id]: newVal }));
      setSaving(id);
      try {
        const res = await fetch(
          `/api/track/moves/${moveId}/estate-service-checklist`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, item: id, checked: newVal }),
          },
        );
        if (!res.ok) {
          setStored((prev) => ({ ...prev, [id]: !newVal }));
        }
      } catch {
        setStored((prev) => ({ ...prev, [id]: !newVal }));
      } finally {
        setSaving(null);
      }
    },
    [auto, merged, moveId, token],
  );

  const completedCount = items.filter((i) => merged[i.id]).length;
  const totalCount = items.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const moveDate = moveDateStr
    ? new Date(moveDateStr + "T12:00:00").toLocaleDateString("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.28)]"
      style={{ background: PANEL_BG }}
    >
      <div className="relative px-5 pt-7 pb-2 sm:px-7 sm:pt-8">
        <p
          className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] leading-none mb-3 [font-family:var(--font-body)]"
          style={{ color: INK_MUTED }}
        >
          Before your move
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <h3
            className="font-serif text-[1.35rem] sm:text-[1.55rem] leading-[1.2] font-normal tracking-[0.01em] max-w-[20rem]"
            style={{ color: INK }}
          >
            What we handle in the days ahead
          </h3>
          <div
            className="shrink-0 text-[11px] font-semibold tabular-nums uppercase tracking-[0.12em] [font-family:var(--font-body)] pb-0.5"
            style={{ color: INK_MUTED }}
          >
            {completedCount} of {totalCount} milestones
          </div>
        </div>
        <p
          className="mt-4 text-[13px] sm:text-[14px] leading-relaxed max-w-xl [font-family:var(--font-body)]"
          style={{ color: INK_MUTED }}
        >
          In the days leading up to your move, here is what we handle — so you
          stay focused on life, not logistics.
        </p>
      </div>

      <div
        className="relative px-5 pb-24 sm:px-7 sm:pb-28"
        role="list"
        aria-label="Estate service milestones"
      >
        {items.map((item: EstateServiceChecklistItem, index) => {
          const isChecked = !!merged[item.id];
          const isSaving = saving === item.id;
          const locked = !!auto[item.id];
          const isLast = index === items.length - 1;

          return (
            <div key={item.id} className="flex gap-0" role="listitem">
              <div
                className={`relative flex w-9 shrink-0 flex-col items-center ${isLast ? "" : "pb-2"}`}
              >
                {index > 0 ? (
                  <div
                    className="h-5 w-px shrink-0"
                    style={{ backgroundColor: LINE }}
                    aria-hidden
                  />
                ) : (
                  <div className="h-1 shrink-0" aria-hidden />
                )}
                <TimelineNode
                  complete={isChecked}
                  saving={isSaving}
                  locked={locked && isChecked}
                />
                {!isLast ? (
                  <div
                    className="mt-3 w-px flex-1 min-h-[4.75rem] sm:min-h-[5.25rem]"
                    style={{ backgroundColor: LINE }}
                    aria-hidden
                  />
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => toggle(item.id)}
                disabled={isSaving || locked}
                className={`group min-w-0 flex-1 text-left pl-3 sm:pl-4 pr-1 rounded-lg -outline-offset-2 transition-opacity focus-visible:outline focus-visible:outline-2 ${
                  index < items.length - 1 ? "pb-10" : "pb-6"
                } ${locked ? "cursor-default opacity-95" : "cursor-pointer"} ${
                  !locked && !isSaving ? "hover:opacity-[0.92]" : ""
                }`}
                style={{ outlineColor: "rgba(249, 237, 228, 0.45)" }}
              >
                <span
                  className={`font-serif text-[1.05rem] sm:text-[1.15rem] leading-snug block transition-colors ${
                    isChecked ? "line-through decoration-white/35" : ""
                  }`}
                  style={{ color: INK }}
                >
                  {item.label}
                </span>
                <span
                  className="mt-2 block text-[12px] sm:text-[13px] leading-relaxed [font-family:var(--font-body)]"
                  style={{ color: INK_MUTED }}
                >
                  {item.detail}
                </span>
                {item.id === "estate_move" && moveDate ? (
                  <span
                    className="mt-2 block text-[12px] leading-relaxed [font-family:var(--font-body)]"
                    style={{ color: INK_MUTED }}
                  >
                    Calendar date for planning:{" "}
                    <span style={{ color: INK }}>{moveDate}</span>.
                  </span>
                ) : null}
                {locked ? (
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] leading-snug [font-family:var(--font-body)]"
                    style={{ color: INK_MUTED }}
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Confirmed from live move progress.
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {allDone ? (
        <div
          className="border-t border-white/10 px-5 py-4 sm:px-7"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <p
            className="text-[13px] sm:text-[14px] font-medium leading-snug [font-family:var(--font-body)]"
            style={{ color: "rgba(209, 250, 229, 0.92)" }}
          >
            All milestones are aligned — your coordinator and crew can see
            you&apos;re on the same page with the plan.
          </p>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-4 left-5 sm:left-7 opacity-80"
        aria-hidden
      >
        <YugoLogo size={22} variant="cream" hidePlus />
      </div>
    </div>
  );
}
