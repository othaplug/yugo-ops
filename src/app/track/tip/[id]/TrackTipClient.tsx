"use client";

import { useState } from "react";
import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";
import { FOREST, GOLD } from "@/lib/client-theme";

type Props = {
  deliveryId: string;
  token: string;
  initialAmount?: number;
  backUrl: string;
  deliverySlug: string;
};

export default function TrackTipClient({
  deliveryId,
  token,
  initialAmount,
  backUrl,
  deliverySlug,
}: Props) {
  const [amount, setAmount] = useState<number | null>(initialAmount ?? null);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount =
    amount != null ? amount : (parseFloat(customAmount) || 0);
  const canSubmit = effectiveAmount >= 1 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/track/delivery/${deliveryId}/tip?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: effectiveAmount }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-4">
        <div className="text-center max-w-md">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ backgroundColor: `${FOREST}20` }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={FOREST}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1
            className="font-heading text-2xl font-bold mb-2"
            style={{ color: FOREST }}
          >
            Thank you!
          </h1>
          <p className="text-[#B0ADA8] text-[13px] mb-6">
            Your tip has been sent to the crew. We appreciate your kindness.
          </p>
          <Link
            href={backUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all"
            style={{
              backgroundColor: GOLD,
              color: "#0D0D0D",
            }}
          >
            ← Back to delivery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0F0F0F]">
      <header className="shrink-0 flex items-center justify-between px-4 py-4 border-b border-[#2A2A2A]">
        <Link
          href={backUrl}
          className="text-[13px] font-medium hover:opacity-80 transition-opacity"
          style={{ color: GOLD }}
        >
          ← Back to delivery
        </Link>
        <YugoLogo size={20} variant="gold" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <h1
            className="font-heading text-xl font-bold mb-1"
            style={{ color: "#E8E5E0" }}
          >
            Tip your crew
          </h1>
          <p className="text-[#B0ADA8] text-[13px] mb-6">
            100% goes to your crew.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setAmount(amt);
                    setCustomAmount("");
                  }}
                  className="px-4 py-2.5 rounded-full text-[13px] font-semibold border transition-colors"
                  style={{
                    borderColor: amount === amt ? GOLD : `${GOLD}40`,
                    color: GOLD,
                    backgroundColor: amount === amt ? `${GOLD}15` : "transparent",
                  }}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <div>
              <label
                htmlFor="custom-tip"
                className="block text-[12px] font-medium text-[#B0ADA8] mb-1"
              >
                Custom amount ($)
              </label>
              <input
                id="custom-tip"
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 25"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setAmount(null);
                }}
                className="w-full px-4 py-3 rounded-xl border bg-[#1A1A1A] text-[#E8E5E0] text-[14px] outline-none"
                style={{ borderColor: "#2A2A2A" }}
              />
            </div>
            {error && (
              <p className="text-[13px] text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white disabled:opacity-40 transition-all"
              style={{ backgroundColor: FOREST }}
            >
              {submitting ? "Processing…" : `Tip $${effectiveAmount.toFixed(2)}`}
            </button>
          </form>

          <p className="text-center mt-6">
            <Link
              href={`/track/delivery/${deliverySlug}?token=${encodeURIComponent(token)}`}
              className="text-[12px] font-medium hover:opacity-80"
              style={{ color: GOLD }}
            >
              Track another delivery
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
