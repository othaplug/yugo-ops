"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import { Check } from "@phosphor-icons/react";

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

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

interface Move {
  id: string;
  move_code: string | null;
  client_name: string | null;
  scheduled_date: string | null;
  from_address: string | null;
  to_address: string | null;
  square_customer_id: string | null;
  square_card_id: string | null;
}

interface BalancePaymentClientProps {
  move: Move;
  balanceAmount: number;
  alreadyPaid: boolean;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtPrice(n: number): string {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function BalancePaymentClient({
  move,
  balanceAmount,
  alreadyPaid,
}: BalancePaymentClientProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(alreadyPaid);
  const cardRef = useRef<SquareCard | null>(null);
  const initRef = useRef(false);

  const processingFee = balanceAmount * 0.033;
  const transactionFee = 0.15;
  const ccTotal = balanceAmount + processingFee + transactionFee;

  const initializeCard = useCallback(async (appId: string, locationId: string) => {
    if (initRef.current || !window.Square) return;
    initRef.current = true;

    try {
      const payments = window.Square.payments(appId, locationId);
      const card = await payments.card();
      await card.attach("#sq-balance-card");
      cardRef.current = card;
      setCardReady(true);
    } catch {
      setError("Unable to load payment form. Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    if (!sdkReady || initRef.current || success) return;

    const appIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
    const locationIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();

    if (appIdFromEnv && locationIdFromEnv) {
      initializeCard(appIdFromEnv, locationIdFromEnv);
      return;
    }

    let cancelled = false;
    fetch("/api/payments/config")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || initRef.current) return;
        const appId = data.appId?.trim();
        const locationId = data.locationId?.trim();
        if (appId && locationId) {
          initializeCard(appId, locationId);
        } else {
          setError("Payment is not configured. Please contact support.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Payment not configured. Please contact support.");
      });
    return () => { cancelled = true; };
  }, [sdkReady, initializeCard, success]);

  useEffect(() => {
    return () => { cardRef.current?.destroy(); };
  }, []);

  const handlePay = async () => {
    if (!cardRef.current || processing) return;
    setProcessing(true);
    setError(null);

    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setError(tokenResult.errors?.[0]?.message ?? "Card verification failed.");
        setProcessing(false);
        return;
      }

      const res = await fetch("/api/payments/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: tokenResult.token, moveId: move.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Payment failed. Please try again.");
        setProcessing(false);
        return;
      }

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setProcessing(false);
    }
  };

  const useSandbox =
    typeof process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX !== "undefined" &&
    process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";
  const squareScriptUrl = useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;

  if (success) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="font-hero text-[28px] font-bold tracking-wider text-[var(--tx)]">Yugo</div>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2C3E2D]/15 flex items-center justify-center">
              <Check size={32} color="#2C3E2D" weight="bold" />
            </div>
            <h1 className="text-[22px] font-bold text-[#F5F5F3] mb-2">Payment Received</h1>
            <p className="text-[var(--text-base)] text-[#B8B5B0] leading-relaxed mb-4">
              Your balance has been paid in full. A receipt has been sent to your email.
            </p>
            <div className="bg-[#0F0F0F] rounded-xl p-4 border border-[#2A2A2A]">
              <div className="text-[11px] text-[var(--tx)] font-bold uppercase tracking-wider mb-2">
                {move.move_code || "Move Details"}
              </div>
              <div className="text-[24px] font-bold text-[var(--tx)]">{fmtPrice(ccTotal)}</div>
              <div className="text-[11px] text-[#454545] mt-1">Charged to your card</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-4">
      <Script
        src={squareScriptUrl}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setError("Payment script failed to load. Please refresh.")}
      />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-hero text-[28px] font-bold tracking-wider text-[var(--tx)]">Yugo</div>
          <div className="text-[11px] text-[#454545] mt-1 uppercase tracking-widest">Balance Payment</div>
        </div>

        {/* Move Summary */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 mb-4">
          <div className="text-[9px] font-bold text-[var(--tx)] uppercase tracking-widest mb-3">Move Summary</div>
          <div className="space-y-2 text-[12px]">
            {move.move_code && (
              <div className="flex justify-between">
                <span className="text-[#454545]">Reference</span>
                <span className="text-[var(--tx)] font-semibold">{move.move_code}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#454545]">Date</span>
              <span className="text-[#E8E5E0]">{fmtDate(move.scheduled_date)}</span>
            </div>
            {move.from_address && (
              <div className="flex justify-between gap-4">
                <span className="text-[#454545] shrink-0">From</span>
                <span className="text-[#E8E5E0] text-right">{move.from_address}</span>
              </div>
            )}
            {move.to_address && (
              <div className="flex justify-between gap-4">
                <span className="text-[#454545] shrink-0">To</span>
                <span className="text-[#E8E5E0] text-right">{move.to_address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Balance Breakdown */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 mb-4">
          <div className="text-[9px] font-bold text-[var(--tx)] uppercase tracking-widest mb-3">Payment Breakdown</div>
          <div className="space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#454545]">Move balance (incl. HST)</span>
              <span className="text-[#E8E5E0]">{fmtPrice(balanceAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#454545]">Credit card processing fee (3.3%)</span>
              <span className="text-[#E8E5E0]">{fmtPrice(processingFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#454545]">Transaction fee</span>
              <span className="text-[#E8E5E0]">{fmtPrice(transactionFee)}</span>
            </div>
            <div className="border-t border-[#2A2A2A] pt-2 mt-2 flex justify-between">
              <span className="text-[var(--tx)] font-bold">Total to charge</span>
              <span className="text-[var(--tx)] font-bold text-[15px]">{fmtPrice(ccTotal)}</span>
            </div>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 mb-4">
          <div className="text-[9px] font-bold text-[var(--tx)] uppercase tracking-widest mb-3">Card Details</div>
          <div
            className="rounded-xl border-2 p-4 transition-colors"
            style={{
              borderColor: cardReady ? "#2C3E2D" : "#2A2A2A",
              backgroundColor: "#0F0F0F",
            }}
          >
            <div id="sq-balance-card" style={{ minHeight: 90 }} />
            {!sdkReady && !error && (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#2C3E2D30", borderTopColor: "#2C3E2D" }} />
                <span className="ml-2 text-[12px] text-[#454545]">Loading payment form…</span>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl text-[12px] font-medium mb-4" style={{ backgroundColor: "rgba(209,67,67,0.1)", color: "#D14343", border: "1px solid rgba(209,67,67,0.3)" }}>
            {error}
          </div>
        )}

        {/* Pay Button */}
        <button
          type="button"
          onClick={handlePay}
          disabled={!cardReady || processing}
          className="w-full py-4 rounded-xl text-[var(--text-base)] font-bold tracking-wide text-[#0D0D0D] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: cardReady && !processing ? "#2C3E2D" : "#2C3E2D60" }}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(0,0,0,0.2)", borderTopColor: "#0D0D0D" }} />
              Processing…
            </span>
          ) : (
            `Pay ${fmtPrice(ccTotal)}`
          )}
        </button>

      </div>
    </div>
  );
}
