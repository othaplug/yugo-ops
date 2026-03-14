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
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${FOREST}15` }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-4" style={{ backgroundColor: `${GOLD}06` }}>
        <h3
          className="font-hero text-[18px] font-semibold mb-1"
          style={{ color: WINE }}
        >
          Show your appreciation
        </h3>
        <p className="text-[12px] leading-snug" style={{ color: FOREST, opacity: 0.7 }}>
          Your crew delivered with care.{" "}
          <span className="font-medium">Tips go directly to your movers.</span>
        </p>
      </div>

      <div className="px-4 pt-4 pb-5 space-y-3.5">
        {/* Preset cards */}
        <div className="grid grid-cols-3 gap-2">
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
                className="rounded-xl border-2 py-3.5 text-center transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: isSelected ? GOLD : `${FOREST}18`,
                  backgroundColor: isSelected ? `${GOLD}12` : "white",
                  boxShadow: isSelected ? `0 2px 12px ${GOLD}25` : "none",
                }}
              >
                <div
                  className="text-[20px] font-bold leading-tight"
                  style={{ color: isSelected ? WINE : FOREST }}
                >
                  ${perMover}
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: FOREST, opacity: 0.5 }}
                >
                  per mover
                </div>
                <div
                  className="text-[11px] font-semibold mt-1"
                  style={{ color: isSelected ? GOLD : FOREST, opacity: isSelected ? 1 : 0.55 }}
                >
                  ${total} total
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div>
          <label
            className="block text-[11px] font-semibold mb-1.5"
            style={{ color: FOREST, opacity: 0.55 }}
          >
            Custom amount
          </label>
          <div
            className="flex items-center rounded-xl border-2 px-3 py-2.5 transition-all"
            style={{
              borderColor: selectedTotal === null ? GOLD : `${FOREST}18`,
              backgroundColor: "white",
            }}
          >
            <span
              className="text-[14px] font-semibold mr-1.5"
              style={{ color: FOREST, opacity: 0.4 }}
            >
              $
            </span>
            <input
              type="number"
              min={5}
              step={1}
              placeholder="Enter total tip amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/[^0-9.]/g, ""));
                setSelectedTotal(null);
              }}
              className="flex-1 bg-transparent text-[14px] font-medium outline-none min-w-0 placeholder:opacity-40"
              style={{ color: FOREST }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700 text-center">
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || currentAmount < 5}
          className="w-full rounded-full py-3.5 text-[13px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
          style={{
            backgroundColor: GOLD,
            color: "#1A1A1A",
            boxShadow: `0 3px 16px ${GOLD}35`,
          }}
        >
          {submitting
            ? "Processing…"
            : currentAmount >= 5
            ? `Send ${formatCurrency(currentAmount)} Tip`
            : "Select an amount"}
        </button>

        {/* Skip */}
        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-[12px] py-1 transition-opacity hover:opacity-80"
          style={{ color: FOREST, opacity: 0.4 }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
