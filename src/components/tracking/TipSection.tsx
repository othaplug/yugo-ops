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

const TIP_PRESETS = [40, 80, 120];

export default function TipSection({
  crewSize = 2,
  moveId,
  token,
  onTipped,
  onSkipped,
}: TipSectionProps) {
  const [selectedTotal, setSelectedTotal] = useState<number | null>(80);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustomAmount, setShowCustomAmount] = useState(false);
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
      className="rounded-xl border overflow-hidden max-w-[280px] mx-auto w-full"
      style={{ borderColor: `${FOREST}12`, backgroundColor: "white", boxShadow: "0px 4px 12px 0px rgba(0, 0, 0, 0.15)" }}
    >
      <div className="px-3.5 pt-3.5 pb-3 space-y-3 max-w-[240px] mx-auto">
        {/* Compact header */}
        <div>
          <h3
            className="font-hero text-[18px] font-semibold leading-tight"
            style={{ color: WINE }}
          >
            Tip your crew
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: FOREST, opacity: 0.6 }}>
            100% of tips go to your movers
          </p>
        </div>

        {/* Preset cards, $40, $80, $120 total */}
        <div className="grid grid-cols-3 gap-1.5 max-w-[180px] mx-auto">
          {TIP_PRESETS.map((total) => {
            const isSelected = selectedTotal === total;
            return (
              <button
                key={total}
                type="button"
                onClick={() => {
                  setSelectedTotal(total);
                  setCustomAmount("");
                }}
                className="rounded-lg border text-center py-1.5 px-1 transition-all duration-150 active:scale-[0.98]"
                style={{
                  borderColor: isSelected ? GOLD : `${FOREST}15`,
                  borderWidth: 1,
                  backgroundColor: isSelected ? `${GOLD}08` : "transparent",
                }}
              >
                <div
                  className="text-[13px] font-normal leading-tight"
                  style={{ color: isSelected ? WINE : FOREST }}
                >
                  ${total}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom amount, toggled by "Add custom tip" */}
        {!showCustomAmount ? (
          <div className="max-w-[180px] mx-auto text-center">
            <button
              type="button"
              onClick={() => setShowCustomAmount(true)}
              className="text-[10px] transition-opacity hover:opacity-80 active:opacity-70"
              style={{ color: FOREST, opacity: 0.55 }}
            >
              Add custom tip
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 max-w-[180px] mx-auto">
            <span
              className="text-[10px] shrink-0"
              style={{ color: FOREST, opacity: 0.55 }}
            >
              Custom amount
            </span>
            <div
              className="flex-1 flex items-center rounded-lg border px-2 py-1 min-h-[26px] transition-colors min-w-0"
              style={{
                borderColor: selectedTotal === null ? `${GOLD}50` : `${FOREST}15`,
                backgroundColor: "transparent",
              }}
            >
              <span className="text-[11px] font-normal mr-0.5" style={{ color: FOREST, opacity: 0.5 }}>$</span>
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
                className="flex-1 bg-transparent text-[12px] font-normal outline-none min-w-0 placeholder:opacity-40"
                style={{ color: FOREST }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-[11px] text-red-600 text-center">{error}</p>
        )}

        {/* CTA, smaller */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || currentAmount < 5}
          className="w-full max-w-[150px] mx-auto rounded-lg py-2.5 text-[12px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 block"
          style={{
            backgroundColor: GOLD,
            color: "#fafafa",
          }}
        >
          {submitting
            ? "Processing…"
            : currentAmount >= 5
            ? "Done"
            : "Select an amount"}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-center text-[11px] py-0.5 transition-opacity hover:opacity-80"
          style={{ color: "#6B7280" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
