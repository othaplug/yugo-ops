"use client";

import { useState, useCallback } from "react";
import { QUOTE_EYEBROW_CLASS } from "@/app/quote/[quoteId]/quote-shared";
import {
  PRE_MOVE_CHECKLIST,
  type ChecklistItem,
} from "@/lib/pre-move-checklist";

export type { ChecklistItem };
export { PRE_MOVE_CHECKLIST };

interface Props {
  moveId: string;
  token: string;
  initialChecked: Record<string, boolean>;
  crewName?: string;
  arrivalWindow?: string;
  moveDateStr?: string;
  /** Delivery / logistics jobs: swap “move” wording for prep copy. */
  copyVariant?: "move" | "delivery";
}

function CheckboxGlyph({
  checked,
  saving,
}: {
  checked: boolean;
  saving: boolean;
}) {
  if (saving) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center"
        aria-hidden
      >
        <span className="h-4 w-4 border-2 border-[var(--tx3)] border-t-transparent rounded-full animate-spin" />
      </span>
    );
  }
  return (
    <span
      className={`flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded border-2 transition-colors ${
        checked
          ? "border-[#22c55e] bg-[#22c55e]"
          : "border-[var(--tx3)] bg-transparent"
      }`}
      aria-hidden
    >
      {checked ? (
        <span
          className="mb-0.5 block h-2 w-1 border-b-2 border-r-2 border-white rotate-45"
          style={{ marginLeft: "1px" }}
        />
      ) : null}
    </span>
  );
}

export default function PreMoveChecklist({
  moveId,
  token,
  initialChecked,
  crewName,
  arrivalWindow,
  moveDateStr,
  copyVariant = "move",
}: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    initialChecked || {},
  );
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = useCallback(
    async (id: string) => {
      const newVal = !checked[id];
      setChecked((prev) => ({ ...prev, [id]: newVal }));
      setSaving(id);
      try {
        await fetch(`/api/track/moves/${moveId}/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, item: id, checked: newVal }),
        });
      } catch {
        // Optimistic — revert on failure
        setChecked((prev) => ({ ...prev, [id]: !newVal }));
      } finally {
        setSaving(null);
      }
    },
    [checked, moveId, token],
  );

  const items = PRE_MOVE_CHECKLIST.map((item) => {
    let out = item;
    if (copyVariant === "delivery") {
      if (item.id === "appliances") {
        out = {
          ...item,
          detail: "Unplug and defrost fridge at least 24 hours before delivery",
        };
      } else if (item.id === "elevator") {
        out = {
          ...item,
          detail:
            "Most condos require 48-hour notice for delivery or move bookings",
        };
      }
    }
    if (out.id === "crew_info" && (crewName || arrivalWindow)) {
      return {
        ...out,
        detail: [crewName, arrivalWindow].filter(Boolean).join(" · "),
      };
    }
    return out;
  });

  const completedCount = items.filter((i) => checked[i.id]).length;
  const totalCount = items.length;
  const allDone = completedCount === totalCount;

  const moveDate = moveDateStr
    ? new Date(moveDateStr + "T12:00:00").toLocaleDateString("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : copyVariant === "delivery"
      ? "delivery day"
      : "move day";

  return (
    <div className="rounded-2xl border border-[var(--brd)]/40 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-4 flex items-start justify-between gap-3"
        style={{
          background: allDone
            ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))"
            : "linear-gradient(135deg, rgba(44,62,45,0.06), rgba(44,62,45,0.03))",
        }}
      >
        <div>
          <p
            className={`${QUOTE_EYEBROW_CLASS} mb-1`}
            style={{ color: "#2C3E2D" }}
          >
            {copyVariant === "delivery" ? "Delivery Day Prep" : "Move Day Prep"}
          </p>
          <h3 className="text-[17px] font-bold text-[var(--tx)]">
            {copyVariant === "delivery"
              ? "Get Ready for Your Delivery"
              : "Get Ready for Your Move"}
          </h3>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">
            Complete before {moveDate}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-[22px] font-bold"
            style={{ color: allDone ? "#22c55e" : "#2C3E2D" }}
          >
            {completedCount}/{totalCount}
          </div>
          <div className={`${QUOTE_EYEBROW_CLASS} text-[var(--tx3)]`}>
            Complete
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--brd)]/30">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${(completedCount / totalCount) * 100}%`,
            background: allDone
              ? "linear-gradient(90deg, #22C55E, #16A34A)"
              : "linear-gradient(90deg, #2C3E2D, #1C3A2B)",
          }}
        />
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-[var(--brd)]/20">
        {items.map((item) => {
          const isChecked = !!checked[item.id];
          const isSaving = saving === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              disabled={isSaving}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all hover:bg-[var(--brd)]/10"
            >
              <CheckboxGlyph checked={isChecked} saving={isSaving} />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[14px] font-semibold leading-tight ${
                    isChecked ? "text-[var(--tx3)]" : "text-[var(--tx)]"
                  }`}
                  style={
                    isChecked ? { textDecoration: "line-through" } : undefined
                  }
                >
                  {item.label}
                </p>
                {item.detail && (
                  <p className="text-[12px] text-[var(--tx3)] mt-0.5 leading-snug">
                    {item.detail}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {allDone && (
        <div className="px-4 py-3 bg-[#22c55e]/5 border-t border-[#22c55e]/20 border-l-4 border-l-[#22c55e]">
          <span className="text-[13px] font-semibold text-[#22c55e] leading-snug">
            Prep checklist complete — we&apos;ll notify your coordinator and
            ops so your crew can see you&apos;re ready for move day.
          </span>
        </div>
      )}
    </div>
  );
}
