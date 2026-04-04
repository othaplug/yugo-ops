"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import { Lock } from "@phosphor-icons/react";
import {
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  QUOTE_EYEBROW_CLASS,
  QUOTE_SECTION_H2_CLASS,
} from "@/app/quote/[quoteId]/quote-shared";

// Square’s current Web Payments SDK (use CDN; legacy web.squareup.com can hang or fail)
const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

interface PaymentResult {
  success: boolean;
  payment_id: string;
  move_id?: string | null;
  delivery_id?: string | null;
  tracking_url?: string | null;
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
  /** Label above the amount (e.g. DEPOSIT AMOUNT vs TOTAL DUE NOW) */
  amountHeading?: string;
}

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
};

type SquarePayments = {
  card: (opts?: object) => Promise<SquareCard>;
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
  amountHeading = "DEPOSIT AMOUNT",
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

      {/* Amount display — receipt-style row */}
      <div className="flex items-baseline justify-between gap-4 py-2">
        <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>
          {amountHeading}
        </span>
        <span className={`${QUOTE_SECTION_H2_CLASS} font-bold tabular-nums text-right`} style={{ color: WINE }}>
          {fmtPrice(amount)}
        </span>
      </div>

      <hr className="border-0 h-px w-full mb-4" style={{ backgroundColor: `${FOREST}10` }} />

      {/* Card form container */}
      <div
        className="rounded-none border p-4 transition-colors"
        style={{
          borderColor: cardReady && !disabled ? `${FOREST}22` : "#E2DDD5",
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
              style={{ borderColor: `${FOREST}30`, borderTopColor: FOREST }}
            />
            <span className="ml-2 text-[12px]" style={{ color: FOREST_BODY }}>
              Loading payment form…
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="px-4 py-3 rounded-none text-[12px] font-medium border"
          style={{ backgroundColor: "#FEF2F2", color: "#991B1B", borderColor: "#FECACA" }}
        >
          {error}
        </div>
      )}

      {/* Pay button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={disabled || !cardReady || processing}
        className="w-full py-3.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95"
        style={{ backgroundColor: !disabled && cardReady ? FOREST : `${FOREST}55` }}
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
        <Lock size={14} color={FOREST_MUTED} aria-hidden />
        <span className="text-[11px] leading-snug" style={{ color: FOREST_MUTED }}>
          Secured by Square &middot; 256-bit encryption
        </span>
      </div>
    </div>
  );
}
