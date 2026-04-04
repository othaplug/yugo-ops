"use client";

import { useState } from "react";
import { X, CalendarBlank, Check, Warning } from "@phosphor-icons/react";

const WINDOW_OPTIONS = [
  { value: "morning", label: "Morning", sub: "8 AM – 12 PM" },
  { value: "afternoon", label: "Afternoon", sub: "12 PM – 5 PM" },
  { value: "evening", label: "Evening", sub: "5 PM – 8 PM" },
  { value: "flexible", label: "Flexible", sub: "Best available" },
];

interface Alternative {
  date: string;
  window: string;
}

interface Props {
  deliveryId: string;
  deliveryNumber: string;
  currentDate: string | null;
  currentWindow: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function RescheduleDeliveryModal({
  deliveryId,
  deliveryNumber,
  currentDate,
  currentWindow,
  onClose,
  onSuccess,
}: Props) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 14);

  const [newDate, setNewDate] = useState(tomorrowStr);
  const [newWindow, setNewWindow] = useState(currentWindow || "morning");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleReschedule(date = newDate, window = newWindow) {
    setLoading(true);
    setError(null);
    setAlternatives(null);
    try {
      const res = await fetch(`/api/partner/deliveries/${deliveryId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate: date, newWindow: window }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => { onSuccess(); onClose(); }, 1500);
      } else if (res.status === 409 && data.alternatives) {
        setError(data.error);
        setAlternatives(data.alternatives);
      } else {
        setError(data.error || "Failed to reschedule");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-[var(--bg)] border border-[var(--brd)]/40 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brd)]/30">
          <div>
            <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--gold)]">
              Reschedule Delivery
            </p>
            <h2 className="admin-section-h2">
              DLV-{deliveryNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--brd)]/20 transition-colors text-[var(--tx3)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-5">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                <Check size={22} color="#22c55e" weight="bold" />
              </div>
              <p className="text-[14px] font-semibold text-[var(--tx)]">Rescheduled successfully</p>
              <p className="text-[12px] text-[var(--tx3)]">
                Your coordinator has been notified.
              </p>
            </div>
          ) : (
            <>
              {currentDate && (
                <div className="text-[12px] text-[var(--tx3)] flex items-center gap-2">
                  <CalendarBlank size={13} />
                  Currently: <span className="font-semibold text-[var(--tx)]">{formatDate(currentDate)}</span>
                  {currentWindow && (
                    <span className="uppercase">{currentWindow}</span>
                  )}
                </div>
              )}

              {/* Date picker */}
              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-[var(--tx3)] mb-2">
                  New Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  min={tomorrowStr}
                  max={maxDate.toISOString().slice(0, 10)}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3.5 py-3 bg-[var(--bg)] border border-[var(--brd)]/70 rounded-xl text-[13px] text-[var(--tx)] focus:border-[var(--gold)]/60 outline-none"
                />
              </div>

              {/* Window picker */}
              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-[var(--tx3)] mb-2">
                  Delivery Window
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WINDOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewWindow(opt.value)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                        newWindow === opt.value
                          ? "border-[var(--gold)]/50 bg-[var(--gold)]/8"
                          : "border-[var(--brd)]/60 hover:border-[var(--brd)]"
                      }`}
                    >
                      <p className="text-[12px] font-semibold text-[var(--tx)]">{opt.label}</p>
                      <p className="text-[10px] text-[var(--tx3)]">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--red)]/8 border border-[var(--red)]/20">
                  <Warning size={14} color="var(--red)" className="shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[var(--red)]">{error}</p>
                </div>
              )}

              {/* Alternatives */}
              {alternatives && alternatives.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[var(--tx3)] mb-2">Available alternatives:</p>
                  <div className="space-y-2">
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleReschedule(alt.date, alt.window)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--brd)]/60 hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/4 transition-all text-left"
                      >
                        <span className="text-[12px] font-semibold text-[var(--tx)]">
                          {formatDate(alt.date)}
                        </span>
                        <span className="text-[11px] text-[var(--tx3)] uppercase">{alt.window}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleReschedule()}
                disabled={loading || !newDate || !newWindow}
                className="w-full py-3 rounded-xl font-bold text-[13px] text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #2C3E2D, #8B7332)" }}
              >
                {loading ? "Checking availability…" : "Confirm Reschedule"}
              </button>

              <p className="text-[10px] text-[var(--tx3)] text-center">
                Reschedule requires 24-hour notice. Your coordinator will be notified automatically.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
