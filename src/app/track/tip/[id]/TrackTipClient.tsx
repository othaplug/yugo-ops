"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Script from "next/script";
import YugoLogo from "@/components/YugoLogo";
import { FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { Check, CreditCard, Lock, X } from "@phosphor-icons/react";

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
};
type SquarePayments = { card: (opts?: object) => Promise<SquareCard> };

// Match payments config: use sandbox SDK when SQUARE_USE_SANDBOX or NEXT_PUBLIC_SQUARE_USE_SANDBOX is true
const useSandbox =
  process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true" ||
  process.env.SQUARE_USE_SANDBOX === "true" ||
  process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "sandbox";
const SQUARE_SDK_URL = useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;

type Props = {
  deliveryId: string;
  token: string;
  initialAmount?: number;
  backUrl: string;
  deliverySlug: string;
  /** When true, renders as a modal overlay instead of full page */
  asModal?: boolean;
  open?: boolean;
  onClose?: () => void;
};

export default function TrackTipClient({
  deliveryId,
  token,
  initialAmount,
  backUrl,
  deliverySlug,
  asModal,
  open = true,
  onClose,
}: Props) {
  const [amount, setAmount] = useState<number | null>(initialAmount ?? null);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Square SDK state
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);
  const initRef = useRef(false);

  const effectiveAmount = amount != null ? amount : parseFloat(customAmount) || 0;
  const canSubmit = effectiveAmount >= 1 && cardReady && !submitting;

  const initCard = useCallback(async (appId: string, locationId: string) => {
    if (initRef.current || !window.Square) return;
    initRef.current = true;
    try {
      const payments = window.Square.payments(appId, locationId);
      const card = await payments.card({
        style: {
          ".message-text": { color: FOREST },
          "input": { color: FOREST },
          "input::placeholder": { color: `${FOREST}60` },
        },
      });
      const el = document.getElementById("sq-tip-card");
      if (!el) {
        setError("Payment form container not found. Please refresh the page.");
        initRef.current = false;
        return;
      }
      // Wait for layout so Square can measure the container
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await card.attach("#sq-tip-card");
      cardRef.current = card;
      setCardReady(true);
    } catch (e) {
      console.error("Square card init failed:", e);
      initRef.current = false;
      setError("Unable to load payment form. Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    if (!sdkReady || initRef.current) return;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();

    if (appId && locationId) {
      initCard(appId, locationId);
      return;
    }

    fetch("/api/payments/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.appId && d.locationId) initCard(d.appId, d.locationId);
        else setError("Payment is not configured. Please contact support.");
      })
      .catch(() => setError("Payment is not configured. Please contact support."));
  }, [sdkReady, initCard]);

  useEffect(() => () => { cardRef.current?.destroy(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !cardRef.current) return;
    setError(null);
    setSubmitting(true);

    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setError(tokenResult.errors?.[0]?.message ?? "Card verification failed. Please try again.");
        setSubmitting(false);
        return;
      }

      const res = await fetch(
        `/api/track/delivery/${deliveryId}/tip?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: tokenResult.token, amount: effectiveAmount }),
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

  if (asModal && !open) return null;

  const successContent = (
    <div className="text-center max-w-md">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
        style={{ backgroundColor: `${FOREST}20` }}
      >
        <Check size={28} color={FOREST} weight="bold" />
      </div>
      <h1 className="font-hero text-2xl font-bold mb-2" style={{ color: FOREST }}>
        Thank you!
      </h1>
      <p className="text-[13px] mb-6" style={{ color: `${FOREST}80` }}>
        Your tip has been sent to the crew. We appreciate your kindness.
      </p>
      {asModal ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all"
          style={{ backgroundColor: GOLD, color: "#0D0D0D" }}
        >
          Close
        </button>
      ) : (
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold transition-all"
          style={{ backgroundColor: GOLD, color: "#0D0D0D" }}
        >
          ← Back to delivery
        </Link>
      )}
    </div>
  );

  if (success) {
    if (asModal) {
      return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="rounded-2xl bg-white shadow-2xl border p-6 max-w-sm w-full" style={{ borderColor: `${FOREST}15` }}>
            {successContent}
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: CREAM }}>
        {successContent}
      </div>
    );
  }

  const formContent = (
    <>
      <h1 className="font-hero text-xl font-bold mb-1" style={{ color: FOREST }}>
        Tip your crew
      </h1>
      <p className="text-[13px] mb-6" style={{ color: `${FOREST}70` }}>100% goes to your crew.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount picker */}
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setAmount(amt); setCustomAmount(""); setShowCustom(false); }}
                    className="px-4 py-3 rounded-xl text-[13px] font-semibold border transition-colors touch-manipulation"
                    style={{
                      borderColor: amount === amt ? GOLD : `${FOREST}25`,
                      color: GOLD,
                      backgroundColor: amount === amt ? `${GOLD}18` : "transparent",
                    }}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {!showCustom ? (
                <button
                  type="button"
                  onClick={() => { setShowCustom(true); setAmount(null); setCustomAmount(""); }}
                  className="text-[13px] font-bold hover:opacity-80 transition-opacity"
                  style={{ color: GOLD }}
                >
                  Add custom tip
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: GOLD }}>$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setAmount(null); }}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border bg-white text-[13px] outline-none"
                      style={{ borderColor: `${FOREST}20`, color: FOREST }}
                    />
                  </div>
                </div>
              )}

              {/* Square card form */}
              <div>
                <div className="text-[11px] mb-2" style={{ color: `${FOREST}60` }}>Card details</div>
                <div id="sq-tip-card" style={{ minHeight: 90 }} />
                {!cardReady && !error && (
                  <p className="text-[11px] mt-1" style={{ color: `${FOREST}50` }}>Loading payment form…</p>
                )}
              </div>

              {error && <p className="text-[11px] text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-full text-[13px] font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{ backgroundColor: FOREST }}
              >
                {submitting
                  ? "Processing…"
                  : effectiveAmount >= 1
                    ? `Send $${effectiveAmount.toFixed(2)} Tip`
                    : "Select an amount"}
              </button>

              {/* Square secure payment badge */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <CreditCard size={18} color="#006AFF" />
                <Lock size={14} color={GOLD} />
                <span className="text-[10px] font-medium" style={{ color: GOLD }}>
                  Secured by Square · 256-bit encryption
                </span>
              </div>
            </form>
    </>
  );

  if (asModal) {
    return (
      <>
        <Script
          src={SQUARE_SDK_URL}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setError("Failed to load payment SDK. Please refresh.")}
        />
        <div
          className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center p-4 sm:p-5 bg-black/50 backdrop-blur-md"
          onClick={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border p-6 pt-10 w-full sm:max-w-sm relative"
            style={{ borderColor: `${FOREST}15`, paddingBottom: `calc(1.5rem + env(safe-area-inset-bottom, 0px))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
              style={{ color: `${FOREST}60` }}
              aria-label="Close"
            >
              <X size={18} weight="regular" className="text-current" />
            </button>
            {formContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Script
        src={SQUARE_SDK_URL}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setError("Failed to load payment SDK. Please refresh.")}
      />
      <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: CREAM, color: FOREST }} data-theme="light">
        <header className="shrink-0 flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: `${FOREST}15` }}>
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
            {formContent}
          </div>
        </main>
      </div>
    </>
  );
}
