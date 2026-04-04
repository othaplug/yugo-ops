"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle,
  Circle,
  Lightning,
  Car,
  Elevator,
  Dog,
  Vault,
  Users,
} from "@phosphor-icons/react";

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  iconName: string;
}

export const PRE_MOVE_CHECKLIST: ChecklistItem[] = [
  {
    id: "appliances",
    label: "Disconnect appliances",
    detail: "Unplug and defrost fridge at least 24 hours before the move",
    iconName: "lightning",
  },
  {
    id: "parking",
    label: "Parking arranged at both locations",
    detail: "Reserve elevator and loading dock if condo",
    iconName: "car",
  },
  {
    id: "elevator",
    label: "Elevator booked (if applicable)",
    detail: "Most condos require 48-hour notice for move bookings",
    iconName: "elevator",
  },
  {
    id: "pets_kids",
    label: "Kids and pets supervised or away",
    detail: "For everyone's safety during loading and unloading",
    iconName: "dog",
  },
  {
    id: "valuables",
    label: "Valuables secured separately",
    detail: "Jewelry, cash, medications, and important documents. Keep these with you.",
    iconName: "vault",
  },
  {
    id: "crew_info",
    label: "I know my crew and arrival time",
    detail: "",
    iconName: "users",
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  lightning: <Lightning size={15} />,
  car: <Car size={15} />,
  elevator: <Elevator size={15} />,
  dog: <Dog size={15} />,
  vault: <Vault size={15} />,
  users: <Users size={15} />,
};

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

export default function PreMoveChecklist({
  moveId,
  token,
  initialChecked,
  crewName,
  arrivalWindow,
  moveDateStr,
  copyVariant = "move",
}: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked || {});
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
    [checked, moveId, token]
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
          detail: "Most condos require 48-hour notice for delivery or move bookings",
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
            : "linear-gradient(135deg, rgba(201,169,98,0.08), rgba(201,169,98,0.04))",
        }}
      >
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--gold)] mb-1">
            {copyVariant === "delivery" ? "Delivery Day Prep" : "Move Day Prep"}
          </p>
          <h3 className="text-[15px] font-bold text-[var(--tx)]">
            {copyVariant === "delivery" ? "Get Ready for Your Delivery" : "Get Ready for Your Move"}
          </h3>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">
            Complete before {moveDate}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-[22px] font-bold"
            style={{ color: allDone ? "#22c55e" : "var(--gold)" }}
          >
            {completedCount}/{totalCount}
          </div>
          <div className="text-[9px] text-[var(--tx3)] uppercase tracking-wider">Complete</div>
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
              : "linear-gradient(90deg, #2C3E2D, #D4B56C)",
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
              onClick={() => toggle(item.id)}
              disabled={isSaving}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all hover:bg-[var(--brd)]/10"
            >
              <span
                className="shrink-0 mt-0.5 transition-colors"
                style={{ color: isChecked ? "#22c55e" : "var(--tx3)" }}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isChecked ? (
                  <CheckCircle size={18} weight="fill" />
                ) : (
                  <Circle size={18} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] font-semibold leading-tight ${
                    isChecked ? "line-through text-[var(--tx3)]" : "text-[var(--tx)]"
                  }`}
                >
                  {item.label}
                </p>
                {item.detail && (
                  <p className="text-[11px] text-[var(--tx3)] mt-0.5 leading-snug">{item.detail}</p>
                )}
              </div>
              <span className="shrink-0 text-[var(--tx3)] mt-0.5">
                {ICON_MAP[item.iconName]}
              </span>
            </button>
          );
        })}
      </div>

      {allDone && (
        <div className="px-4 py-3 bg-[#22c55e]/5 border-t border-[#22c55e]/20 flex items-center gap-2">
          <CheckCircle size={14} color="#22c55e" weight="fill" />
          <span className="text-[12px] font-semibold text-[#22c55e]">
            All set. Your crew has been notified you&apos;re ready!
          </span>
        </div>
      )}
    </div>
  );
}
