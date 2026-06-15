"use client";

import { useMemo, useState, useCallback } from "react";
import { Check } from "@phosphor-icons/react";
import {
  CLIENT_MOVE_CHECKLIST,
  filterChecklistItems,
  drawerItemText,
} from "@/lib/client-move-checklist";
import { InfoHint } from "@/components/ui/InfoHint";
import YugoLogo from "@/components/YugoLogo";

/* Premium client palette (explicit, never admin dark vars). */
const BG = "#FAF7F2";
const INK = "#241C16";
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const MUTED = "rgba(36,28,22,0.58)";
const CARD_BORDER = "rgba(92,26,51,0.14)";
const ROW_DIVIDER = "rgba(44,62,45,0.10)";

export default function ChecklistClient({
  token,
  clientName,
  initialChecked,
  hasElevatorHint,
  parkingLikely,
  tierLower,
}: {
  token: string;
  clientName: string;
  initialChecked: Record<string, boolean>;
  hasElevatorHint: boolean;
  parkingLikely: boolean;
  tierLower: string;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () =>
      filterChecklistItems(CLIENT_MOVE_CHECKLIST, {
        hasElevatorHint,
        parkingReminderLikely: parkingLikely,
        tierLower,
      }),
    [hasElevatorHint, parkingLikely, tierLower],
  );

  const toggle = useCallback(
    async (id: string, next: boolean) => {
      const updated = { ...checked, [id]: next };
      setChecked(updated);
      setSaving(true);
      try {
        await fetch(`/api/checklist/${encodeURIComponent(token)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked: { [id]: next } }),
        });
      } finally {
        setSaving(false);
      }
    },
    [checked, token],
  );

  const first = clientName.trim().split(/\s+/)[0] || "there";

  const allItems = categories.flatMap((c) => c.items);
  const total = allItems.length;
  const done = allItems.filter((it) => checked[it.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG, color: INK }}>
      <div className="max-w-lg mx-auto px-4 py-10 pb-20">
        <header className="mb-7 text-center">
          <div className="flex justify-center">
            <YugoLogo size={28} variant="black" />
          </div>
          <div
            className="w-10 h-px mx-auto my-4"
            style={{ backgroundColor: `${WINE}33` }}
          />
          <h1 className="font-hero text-[28px] leading-tight" style={{ color: INK }}>
            Move-day checklist
          </h1>
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: MUTED }}>
            Hi {first}, check items off as you go. We&apos;ll save your progress
            on this device.
          </p>
        </header>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: MUTED }}
            >
              {allDone ? "All set" : "Your progress"}
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: allDone ? FOREST : INK }}
            >
              {done} of {total} done
              {saving ? (
                <span style={{ color: MUTED }} aria-live="polite">
                  {" "}
                  · saving…
                </span>
              ) : null}
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(44,62,45,0.12)" }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%`, backgroundColor: FOREST }}
            />
          </div>
        </div>

        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat.category}>
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2.5"
                style={{ color: WINE }}
              >
                {cat.category}
              </h2>
              <ul
                className="rounded-2xl border bg-white overflow-hidden shadow-[0_2px_14px_rgba(92,26,51,0.05)]"
                style={{ borderColor: CARD_BORDER }}
              >
                {cat.items.map((it, i) => {
                  const label =
                    it.id === "drawers" ? drawerItemText(tierLower) : it.text;
                  const isOn = !!checked[it.id];
                  return (
                    <li
                      key={it.id}
                      style={
                        i > 0
                          ? { borderTop: `1px solid ${ROW_DIVIDER}` }
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggle(it.id, !isOn)}
                        className="w-full flex items-start gap-3.5 px-4 py-4 text-left transition-colors hover:bg-[#5C1A33]/[0.03]"
                      >
                        <span
                          className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors"
                          style={{
                            borderColor: isOn ? FOREST : "rgba(44,62,45,0.35)",
                            backgroundColor: isOn ? FOREST : "transparent",
                            color: "#fff",
                          }}
                          aria-hidden
                        >
                          {isOn ? <Check size={13} weight="bold" /> : null}
                        </span>
                        <span
                          className="text-[14px] leading-snug"
                          style={{
                            color: isOn ? MUTED : INK,
                            textDecoration: isOn ? "line-through" : "none",
                          }}
                        >
                          {label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-10 flex justify-center items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: MUTED }}
          >
            Need help?
          </span>
          <InfoHint
            variant="default"
            ariaLabel="How to reach your coordinator"
            align="center"
          >
            <p className="text-[11px] leading-relaxed">
              Questions? Open your move from the tracking link in your email or
              call your coordinator.
            </p>
          </InfoHint>
        </div>
      </div>
    </div>
  );
}
