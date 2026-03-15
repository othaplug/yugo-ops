"use client";

import { useState, useCallback } from "react";
import { WINE, FOREST, GOLD } from "@/lib/client-theme";
import { formatCurrency } from "@/lib/format-currency";

interface TipSectionProps {
  crewSize?: number;
  moveId: string;
  token: string;
  onTipped: (amount: number) => void;
  onSkipped: () => void;
}

const PER_MOVER_PRESETS = [20, 40, 60];

export default function TipSection({
  crewSize = 2,
  moveId,
  token,
  onTipped,
  onSkipped,
}: TipSectionProps) {
  const defaultTotal = 40 * crewSize;
  const [selectedTotal, setSelectedTotal] = useState<number | null>(defaultTotal);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAmount =
    selectedTotal !== null ? selectedTotal : parseFloat(customAmount) || 0;

  const handleSubmit = useCallback(async () => {
    if (currentAmount < 5) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tips/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId, amount: currentAmount, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "Could not process tip. Please try again.");
        return;
      }
      onTipped(currentAmount);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [currentAmount, moveId, token, onTipped]);

  const handleSkip = useCallback(async () => {
    onSkipped();
    fetch("/api/tips/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveId, token }),
    }).catch(() => {});
  }, [moveId, token, onSkipped]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: `${FOREST}12`, backgroundColor: "white" }}
    >
      <div className="px-3.5 pt-3.5 pb-3 space-y-3">
        {/* Compact header */}
        <div>
          <h3
            className="font-hero text-[14px] font-semibold leading-tight"
            style={{ color: WINE }}
          >
            Tip your crew
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: FOREST, opacity: 0.6 }}>
            Tips go directly to your movers.
          </p>
        </div>

        {/* Preset cards — compact, sleek */}
        <div className="grid grid-cols-3 gap-1.5">
          {PER_MOVER_PRESETS.map((perMover) => {
            const total = perMover * crewSize;
            const isSelected = selectedTotal === total;
            return (
              <button
                key={perMover}
                type="button"
                onClick={() => {
                  setSelectedTotal(total);
                  setCustomAmount("");
                }}
                className="rounded-lg border text-center py-2 px-1 transition-all duration-150 active:scale-[0.98]"
                style={{
                  borderColor: isSelected ? GOLD : `${FOREST}15`,
                  borderWidth: isSelected ? 2 : 1,
                  backgroundColor: isSelected ? `${GOLD}08` : "transparent",
                }}
              >
                <div
                  className="text-[15px] font-bold leading-tight"
                  style={{ color: isSelected ? WINE : FOREST }}
                >
                  ${perMover}
                </div>
                <div
                  className="text-[9px] mt-0.5"
                  style={{ color: FOREST, opacity: 0.5 }}
                >
                  per mover
                </div>
                <div
                  className="text-[9px] font-medium mt-0.5"
                  style={{ color: isSelected ? GOLD : FOREST, opacity: isSelected ? 1 : 0.55 }}
                >
                  ${total} total
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom amount — single line */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] shrink-0"
            style={{ color: FOREST, opacity: 0.55 }}
          >
            Custom amount
          </span>
          <div
            className="flex-1 flex items-center rounded-lg border px-2.5 py-1.5 min-h-[32px] transition-colors"
            style={{
              borderColor: selectedTotal === null ? `${GOLD}50` : `${FOREST}15`,
              backgroundColor: "transparent",
            }}
          >
            <span className="text-[12px] font-medium mr-1" style={{ color: FOREST, opacity: 0.5 }}>$</span>
            <input
              type="number"
              min={5}
              step={1}
              placeholder="0"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/[^0-9.]/g, ""));
                setSelectedTotal(null);
              }}
              className="flex-1 bg-transparent text-[13px] font-medium outline-none min-w-0 placeholder:opacity-40"
              style={{ color: FOREST }}
            />
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-red-600 text-center">{error}</p>
        )}

        {/* CTA — smaller */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || currentAmount < 5}
          className="w-full rounded-full py-2.5 text-[12px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          style={{
            backgroundColor: GOLD,
            color: "#1A1A1A",
          }}
        >
          {submitting
            ? "Processing…"
            : currentAmount >= 5
            ? `Send ${formatCurrency(currentAmount)} tip`
            : "Select an amount"}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-[11px] py-0.5 transition-opacity hover:opacity-80"
          style={{ color: FOREST, opacity: 0.4 }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
