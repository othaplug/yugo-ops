"use client";

import { useMemo, useState, useCallback } from "react";
import { Check } from "@phosphor-icons/react";
import {
  CLIENT_MOVE_CHECKLIST,
  filterChecklistItems,
  drawerItemText,
} from "@/lib/client-move-checklist";

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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)]">
      <div className="max-w-lg mx-auto px-4 py-8 pb-16">
        <header className="mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-2">
            Yugo
          </p>
          <h1 className="font-hero text-2xl font-bold text-[#5C1A33] mb-2">
            Move-day checklist
          </h1>
          <p className="text-[13px] text-[var(--tx2)] leading-relaxed">
            Hi {first} — check items off as you go. We will save your progress on this
            device.
          </p>
          {saving && (
            <p className="text-[10px] text-[var(--tx3)] mt-2" aria-live="polite">
              Saving…
            </p>
          )}
        </header>

        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat.category}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C3E2D] mb-3">
                {cat.category}
              </h2>
              <ul className="rounded-xl border border-[var(--brd)] bg-[var(--card)] divide-y divide-[var(--brd)]/60">
                {cat.items.map((it) => {
                  const label =
                    it.id === "drawers" ? drawerItemText(tierLower) : it.text;
                  const isOn = !!checked[it.id];
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => toggle(it.id, !isOn)}
                        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg)]/80 transition-colors"
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
                            isOn
                              ? "border-[#2C3E2D] bg-[#2C3E2D] text-white"
                              : "border-[var(--brd)] bg-transparent"
                          }`}
                          aria-hidden
                        >
                          {isOn ? <Check size={14} weight="bold" /> : null}
                        </span>
                        <span
                          className={`text-[13px] leading-snug ${
                            isOn ? "text-[var(--tx3)] line-through" : "text-[var(--tx)]"
                          }`}
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

        <p className="text-[11px] text-[var(--tx3)] text-center mt-10 leading-relaxed">
          Questions? Open your move from the tracking link in your email or call your
          coordinator.
        </p>
      </div>
    </div>
  );
}
