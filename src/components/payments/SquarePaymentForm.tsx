"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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

/** Square WebSdkEmbedError: SDK only runs in a secure context (HTTPS or browser-trusted localhost). */
const INSECURE_CONTEXT_DEV =
  "Card payments need a secure browser context. Open this app as http://127.0.0.1 or http://localhost (not a LAN IP or custom hostname on plain HTTP), or run the dev server with HTTPS (e.g. next dev --experimental-https).";
const INSECURE_CONTEXT_PROD =
  "Payments require a secure connection. Please use https:// to open this page, or try another network or device.";

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

/** True when every Square Web Payments script on the page matches this URL (absolute). */
function onlyThisSquareSdkUrlLoaded(expectedUrl: string): boolean {
  const sdkSrcs: string[] = [];
  for (const el of document.querySelectorAll("script")) {
    const s = el as HTMLScriptElement;
    if (!s.src) continue;
    if (!s.src.includes("squarecdn.com")) continue;
    sdkSrcs.push(s.src);
  }
  if (sdkSrcs.length === 0) return false;
  return sdkSrcs.every((src) => src === expectedUrl);
}

/** Client-side env-only credentials (same build as NEXT_PUBLIC script choice). */
function squareSdkFromPublicEnv(): {
  scriptUrl: string;
  appId: string;
  locationId: string;
} | null {
  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
  if (!appId || !locationId) return null;
  const useSandbox = process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";
  return {
    appId,
    locationId,
    scriptUrl: useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION,
  };
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
  const [paymentSdk, setPaymentSdk] = useState<
    { scriptUrl: string; appId: string; locationId: string } | null
  >(() => squareSdkFromPublicEnv());
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** null until client checks window.isSecureContext; false blocks SDK load (avoids WebSdkEmbedError). */
  const [embedAllowed, setEmbedAllowed] = useState<boolean | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    const ok = window.isSecureContext;
    setEmbedAllowed(ok);
    if (!ok) {
      setError(
        process.env.NODE_ENV === "development"
          ? INSECURE_CONTEXT_DEV
          : INSECURE_CONTEXT_PROD,
      );
    }
  }, []);

  const initializeCard = useCallback(async (appId: string, locationId: string) => {
    if (initRef.current || !window.Square) return;
    if (!window.isSecureContext) {
      setError(
        process.env.NODE_ENV === "development"
          ? INSECURE_CONTEXT_DEV
          : INSECURE_CONTEXT_PROD,
      );
      return;
    }
    initRef.current = true;

    try {
      const payments = window.Square.payments(appId, locationId);
      const card = await payments.card();
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      await card.attach("#sq-card-container");
      cardRef.current = card;
      setCardReady(true);
    } catch (e) {
      console.error("Square card init failed:", e);
      initRef.current = false;
      setError("Unable to load payment form. Please refresh the page.");
    }
  }, []);

  /** When credentials come from the server, load the SDK URL that matches sandbox vs production. */
  useEffect(() => {
    if (paymentSdk !== null) return;
    if (!window.isSecureContext) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 3;

    const fetchConfig = () => {
      attempts++;
      fetch("/api/payments/config")
        .then(async (res) => {
          const data = (await res.json()) as {
            appId?: string;
            locationId?: string;
            useSandbox?: boolean;
          };
          if (cancelled) return;
          const appId = data.appId?.trim();
          const locationId = data.locationId?.trim();
          if (appId && locationId) {
            const scriptUrl =
              data.useSandbox === true ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;
            setPaymentSdk({ appId, locationId, scriptUrl });
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
    return () => {
      cancelled = true;
    };
  }, [paymentSdk]);

  useEffect(() => {
    if (!sdkReady || !paymentSdk || initRef.current) return;
    void initializeCard(paymentSdk.appId, paymentSdk.locationId);
  }, [sdkReady, paymentSdk, initializeCard]);

  /**
   * Load Square Web Payments SDK imperatively. next/script onLoad is unreliable when the tag
   * mounts after navigation or when the script is already cached — sdkReady would stay false forever.
   * Do not trust window.Square unless every squarecdn script on the page matches this form’s URL,
   * otherwise SPA nav can leave sandbox vs production globals mismatched (WebSdkEmbedError).
   */
  useEffect(() => {
    if (!paymentSdk || embedAllowed !== true) return;

    const url = paymentSdk.scriptUrl;

    let removedConflictingSdk = false;
    for (const el of [...document.querySelectorAll("script")]) {
      const s = el as HTMLScriptElement;
      if (!s.src.includes("squarecdn.com")) continue;
      if (s.src !== url) {
        el.remove();
        removedConflictingSdk = true;
      }
    }

    const markSdkReady = () => setSdkReady(true);

    // Removing a tag does not reset window.Square — must load this URL again if we dropped another build.
    if (removedConflictingSdk) {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = () => markSdkReady();
      s.onerror = () => {
        setError("Payment script failed to load. Please refresh the page.");
      };
      document.body.appendChild(s);
      return;
    }

    if (window.Square && onlyThisSquareSdkUrlLoaded(url)) {
      markSdkReady();
      return;
    }

    let existing: HTMLScriptElement | null = null;
    for (const el of document.querySelectorAll("script")) {
      const s = el as HTMLScriptElement;
      if (s.src === url || s.getAttribute("src") === url) {
        existing = s;
        break;
      }
    }

    if (existing) {
      queueMicrotask(() => {
        if (window.Square && onlyThisSquareSdkUrlLoaded(url)) markSdkReady();
      });
      existing.addEventListener("load", () => markSdkReady(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          setError("Payment script failed to load. Please refresh the page.");
        },
        { once: true },
      );
      return;
    }

    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => markSdkReady();
    s.onerror = () => {
      setError("Payment script failed to load. Please refresh the page.");
    };
    document.body.appendChild(s);
  }, [paymentSdk, embedAllowed]);

  useEffect(() => {
    return () => {
      cardRef.current?.destroy();
      cardRef.current = null;
      initRef.current = false;
      setCardReady(false);
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

  return (
    <div className="space-y-4">
      {/* Square SDK is injected in useEffect (imperative); next/script onLoad was flaky here. */}

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
        {embedAllowed !== false && (!paymentSdk || !sdkReady) && !error && (
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
