"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";

const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const GOLD = "#B8962E";

// Square’s current Web Payments SDK (use CDN; legacy web.squareup.com can hang or fail)
const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

interface PaymentResult {
  success: boolean;
  payment_id: string;
  move_id: string;
  tracking_url?: string;
}

interface SquarePaymentFormProps {
  amount: number;
  quoteId: string;
  clientName: string;
  clientEmail: string;
  selectedTier: string | null;
  selectedAddons?: unknown[];
  onSuccess: (result: PaymentResult) => void;
  onError: (error: string) => void;
  disabled: boolean;
  /** Optional custom label for the submit button, e.g. "Pay $150 & Book My Move" */
  submitLabel?: string;
}

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
};

type SquarePayments = {
  card: () => Promise<SquareCard>;
};

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => SquarePayments;
    };
  }
}

function fmtPrice(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SquarePaymentForm({
  amount,
  quoteId,
  clientName,
  clientEmail,
  selectedTier,
  selectedAddons,
  onSuccess,
  onError,
  disabled,
  submitLabel,
}: SquarePaymentFormProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);
  const initRef = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initializeCard = useCallback(async (appId: string, locationId: string) => {
    if (initRef.current || !window.Square) return;
    initRef.current = true;

    try {
      const payments = window.Square.payments(appId, locationId);
      const card = await payments.card();
      await card.attach("#sq-card-container");
      cardRef.current = card;
      setCardReady(true);
    } catch (e) {
      console.error("Square card init failed:", e);
      setError("Unable to load payment form. Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    if (!sdkReady || initRef.current) return;

    const appIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
    const locationIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();

    if (appIdFromEnv && locationIdFromEnv) {
      initializeCard(appIdFromEnv, locationIdFromEnv);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 3;

    const fetchConfig = () => {
      attempts++;
      fetch("/api/payments/config")
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || initRef.current) return;
          const appId = data.appId?.trim();
          const locationId = data.locationId?.trim();
          if (appId && locationId) {
            initializeCard(appId, locationId);
          } else if (attempts < maxAttempts) {
            setTimeout(fetchConfig, 1500 * attempts);
          } else {
            setError(
              process.env.NODE_ENV === "development"
                ? "Payment not configured. Add NEXT_PUBLIC_SQUARE_APP_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID (or SQUARE_APP_ID and SQUARE_LOCATION_ID) to .env.local, then restart the dev server."
                : "Payment is not configured. Please contact support.",
            );
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (attempts < maxAttempts) {
            setTimeout(fetchConfig, 1500 * attempts);
          } else {
            setError("Payment not configured. Please contact support.");
          }
        });
    };

    fetchConfig();
    return () => { cancelled = true; };
  }, [sdkReady, initializeCard]);

  useEffect(() => {
    return () => {
      cardRef.current?.destroy();
    };
  }, []);

  const handlePay = async () => {
    if (!cardRef.current || processing || disabled) return;

    setProcessing(true);
    setError(null);

    try {
      const tokenResult = await cardRef.current.tokenize();

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        const msg =
          tokenResult.errors?.[0]?.message ?? "Card verification failed. Please try again.";
        setError(msg);
        setProcessing(false);
        return;
      }

      const res = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          amount,
          quoteId,
          clientName,
          clientEmail,
          selectedTier,
          selectedAddons,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Payment failed. Please try again.");
        setProcessing(false);
        return;
      }

      onSuccess(data as PaymentResult);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
      setError(msg);
      onError(msg);
      setProcessing(false);
    }
  };

  const useSandbox =
    typeof process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX !== "undefined" &&
    process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";
  const squareScriptUrl = useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;

  return (
    <div className="space-y-4">
      <Script
        src={squareScriptUrl}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => {
          setScriptError(true);
          setError("Payment script failed to load. Please refresh the page.");
        }}
      />

      {/* Amount display */}
      <div className="text-center py-3">
        <p className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: FOREST }}>
          Deposit Amount
        </p>
        <p className="font-hero text-[36px] mt-1" style={{ color: WINE }}>
          {fmtPrice(amount)}
        </p>
      </div>

      {/* Card form container */}
      <div
        className="rounded-xl border-2 p-4 transition-colors"
        style={{
          borderColor: cardReady && !disabled ? GOLD : "#E2DDD5",
          backgroundColor: disabled ? "#F5F3EF" : "#FFFFFF",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div
          id="sq-card-container"
          style={{ minHeight: 90 }}
        />
        {!sdkReady && !error && (
          <div className="flex items-center justify-center py-6">
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: `${GOLD}30`, borderTopColor: GOLD }}
            />
            <span className="ml-2 text-[12px]" style={{ color: `${FOREST}60` }}>
              Loading payment form…
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ backgroundColor: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
        >
          {error}
        </div>
      )}

      {/* Pay button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || !cardReady || processing}
        className="w-full py-4 rounded-xl text-[14px] font-bold tracking-wide text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: !disabled && cardReady ? WINE : `${WINE}60` }}
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <span
              className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
            />
            Processing&hellip;
          </span>
        ) : (
          submitLabel ?? `Pay ${fmtPrice(amount)} Deposit`
        )}
      </button>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={`${FOREST}50`} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span className="text-[10px]" style={{ color: `${FOREST}50` }}>
          Secured by Square &middot; 256-bit encryption
        </span>
      </div>
    </div>
  );
}
