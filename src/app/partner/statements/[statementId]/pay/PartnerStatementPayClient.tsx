"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import {
  Invoice,
  CheckCircle,
  Lock,
  ArrowLeft,
  Buildings,
  CalendarBlank,
  Warning,
  Truck,
} from "@phosphor-icons/react";

const FOREST = "#2C3E2D";
const GOLD = "#B8962E";
const WINE = "#5C1A33";

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{
    status: string;
    token?: string;
    errors?: { message: string }[];
  }>;
  destroy: () => void;
};
type SquarePayments = { card: (opts?: object) => Promise<SquareCard> };
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments };
  }
}

interface StatementDelivery {
  id: string;
  number: string;
  date: string;
  price: number;
  description: string;
}

export interface StatementForPayment {
  id: string;
  statement_number: string;
  period_start: string;
  period_end: string;
  deliveries: StatementDelivery[] | unknown;
  delivery_count: number;
  subtotal: number;
  hst: number;
  total: number;
  due_date: string;
  payment_terms: string;
  status: string;
  paid_amount: number;
  paid_at: string | null;
  organizations: {
    id: string;
    name: string;
    email: string;
    billing_email?: string | null;
  } | null;
}

function fmt(n: number) {
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtShortDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtLongDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PartnerStatementPayClient({
  statement,
}: {
  statement: StatementForPayment;
}) {
  const org = statement.organizations;
  const balanceOwing = Math.max(
    0,
    Number(statement.total) - Number(statement.paid_amount || 0),
  );
  const alreadyPaid = statement.status === "paid" || balanceOwing < 0.01;

  const periodLabel = `${fmtShortDate(statement.period_start)} – ${fmtShortDate(statement.period_end)}`;
  const deliveries: StatementDelivery[] = Array.isArray(statement.deliveries)
    ? (statement.deliveries as StatementDelivery[])
    : [];

  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const initRef = useRef(false);

  const initializeCard = useCallback(
    async (appId: string, locationId: string) => {
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
    },
    [],
  );

  useEffect(() => {
    if (!sdkReady || initRef.current || alreadyPaid) return;

    const appIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
    const locationIdFromEnv = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
    if (appIdFromEnv && locationIdFromEnv) {
      initializeCard(appIdFromEnv, locationIdFromEnv);
      return;
    }

    fetch("/api/payments/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.appId && d.locationId) {
          initializeCard(d.appId, d.locationId);
        } else {
          setError("Payment is not configured. Please contact your coordinator.");
        }
      })
      .catch(() =>
        setError("Payment is not configured. Please contact your coordinator."),
      );
  }, [sdkReady, initializeCard, alreadyPaid]);

  useEffect(() => {
    return () => {
      cardRef.current?.destroy();
    };
  }, []);

  const handlePay = async () => {
    if (!cardRef.current || processing) return;
    setProcessing(true);
    setError(null);

    try {
      const tokenResult = await cardRef.current.tokenize();

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setError(
          tokenResult.errors?.[0]?.message ??
            "Card verification failed. Please try again.",
        );
        setProcessing(false);
        return;
      }

      const res = await fetch(`/api/partner/statements/${statement.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: tokenResult.token, amount: balanceOwing }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Payment failed. Please try again.");
        setProcessing(false);
        return;
      }

      setSuccess(true);
      setReceiptUrl(data.receipt_url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setProcessing(false);
    }
  };

  const useSandbox = process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";
  const squareScriptUrl = useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;

  /* ── Success state ── */
  if (success) {
    return (
      <div className="max-w-[520px] mx-auto px-5 py-20 text-center">
        <CheckCircle size={60} weight="fill" style={{ color: "#22c55e" }} className="mx-auto mb-5" />
        <h1 className="text-[28px] font-bold mb-2" style={{ color: FOREST }}>
          Payment received
        </h1>
        <p className="text-[14px] mb-8" style={{ color: `${FOREST}60` }}>
          Statement {statement.statement_number} has been paid. Thank you,{" "}
          {org?.name ?? "Partner"}.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
            >
              <Invoice size={14} />
              View Receipt
            </a>
          )}
          <Link
            href="/partner"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold border"
            style={{ borderColor: `${FOREST}20`, color: `${FOREST}80` }}
          >
            <ArrowLeft size={14} />
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto px-5 py-8">
      {/* Back */}
      <Link
        href="/partner"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold mb-6"
        style={{ color: `${FOREST}55` }}
      >
        <ArrowLeft size={13} />
        Back to portal
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Invoice size={14} color={GOLD} />
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: GOLD }}
            >
              Statement Payment
            </span>
          </div>
          <h1 className="text-[24px] font-bold" style={{ color: FOREST }}>
            {statement.statement_number}
          </h1>
          {org && (
            <p
              className="text-[13px] flex items-center gap-1.5 mt-0.5"
              style={{ color: `${FOREST}55` }}
            >
              <Buildings size={12} />
              {org.name}
            </p>
          )}
        </div>
        {!alreadyPaid && (
          <div className="text-right shrink-0">
            <div
              className="text-[10px] font-bold tracking-wider uppercase mb-0.5"
              style={{ color: `${FOREST}40` }}
            >
              Balance owing
            </div>
            <div className="text-[30px] font-bold" style={{ color: WINE }}>
              {fmt(balanceOwing)}
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* ── Left: statement breakdown ── */}
        <div className="space-y-4">
          {/* Key dates */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: `${FOREST}10`, background: "white" }}
          >
            {[
              {
                icon: <CalendarBlank size={13} />,
                label: "Period",
                value: periodLabel,
              },
              {
                icon: <Warning size={13} />,
                label: "Due Date",
                value: fmtLongDate(statement.due_date),
              },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                style={{ borderColor: `${FOREST}06` }}
              >
                <span
                  className="text-[12px] flex items-center gap-2"
                  style={{ color: `${FOREST}50` }}
                >
                  {icon}
                  {label}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: FOREST }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Totals card */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: `${FOREST}10`, background: "white" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: `${FOREST}06` }}
            >
              <span className="text-[12px]" style={{ color: `${FOREST}50` }}>
                Subtotal ({deliveries.length || statement.delivery_count} deliveries)
              </span>
              <span className="text-[13px]" style={{ color: FOREST }}>
                {fmt(Number(statement.subtotal))}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: `${FOREST}06` }}
            >
              <span className="text-[12px]" style={{ color: `${FOREST}50` }}>
                HST (13%)
              </span>
              <span className="text-[13px]" style={{ color: FOREST }}>
                {fmt(Number(statement.hst))}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: `${FOREST}06` }}
            >
              <span className="text-[12px] font-semibold" style={{ color: FOREST }}>
                Total
              </span>
              <span className="text-[14px] font-bold" style={{ color: FOREST }}>
                {fmt(Number(statement.total))}
              </span>
            </div>
            {Number(statement.paid_amount) > 0 && (
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: `${FOREST}06` }}
              >
                <span className="text-[12px]" style={{ color: "#22c55e" }}>
                  Previously paid
                </span>
                <span className="text-[13px]" style={{ color: "#22c55e" }}>
                  &minus;{fmt(Number(statement.paid_amount))}
                </span>
              </div>
            )}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: `${WINE}05` }}
            >
              <span className="text-[13px] font-bold" style={{ color: FOREST }}>
                Balance owing
              </span>
              <span className="text-[15px] font-bold" style={{ color: alreadyPaid ? "#22c55e" : WINE }}>
                {alreadyPaid ? "Paid in full" : fmt(balanceOwing)}
              </span>
            </div>
          </div>

          {/* Deliveries breakdown */}
          {deliveries.length > 0 && (
            <div>
              <h3
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: `${FOREST}40` }}
              >
                Deliveries ({deliveries.length})
              </h3>
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: `${FOREST}10`, background: "white" }}
              >
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: `${FOREST}07` }}>
                      {["#", "Date", "Description", "Price"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider ${i === 3 ? "text-right" : "text-left"}`}
                          style={{ color: `${FOREST}40` }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d, i) => (
                      <tr
                        key={d.id || i}
                        className="border-b last:border-0"
                        style={{ borderColor: `${FOREST}05` }}
                      >
                        <td
                          className="px-4 py-2.5 text-[11px] font-mono"
                          style={{ color: GOLD }}
                        >
                          {d.number || "—"}
                        </td>
                        <td
                          className="px-4 py-2.5 text-[11px]"
                          style={{ color: `${FOREST}50` }}
                        >
                          {d.date
                            ? new Date(d.date).toLocaleDateString("en-CA", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td
                          className="px-4 py-2.5 text-[11px] max-w-[140px] truncate"
                          style={{ color: `${FOREST}70` }}
                        >
                          {d.description || "—"}
                        </td>
                        <td
                          className="px-4 py-2.5 text-[12px] font-semibold text-right"
                          style={{ color: FOREST }}
                        >
                          {fmt(Number(d.price || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: payment form ── */}
        <div className="md:sticky md:top-6">
          {alreadyPaid ? (
            <div
              className="rounded-2xl border p-6 text-center"
              style={{ borderColor: `${FOREST}10`, background: "white" }}
            >
              <CheckCircle
                size={36}
                weight="fill"
                style={{ color: "#22c55e" }}
                className="mx-auto mb-3"
              />
              <p className="text-[15px] font-bold mb-1" style={{ color: FOREST }}>
                Paid in full
              </p>
              <p className="text-[12px]" style={{ color: `${FOREST}50` }}>
                This statement has been settled.
              </p>
              <Link
                href="/partner"
                className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold"
                style={{ color: `${FOREST}60` }}
              >
                <Truck size={13} />
                Back to portal
              </Link>
            </div>
          ) : (
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: `${FOREST}10`, background: "white" }}
            >
              <Script
                src={squareScriptUrl}
                strategy="afterInteractive"
                onLoad={() => setSdkReady(true)}
                onError={() => {
                  setSdkError(true);
                  setError("Payment script failed to load. Please refresh.");
                }}
              />

              <div className="text-center mb-5">
                <p
                  className="text-[10px] font-bold tracking-wider uppercase mb-1"
                  style={{ color: `${FOREST}40` }}
                >
                  Amount due
                </p>
                <p className="text-[32px] font-bold" style={{ color: WINE }}>
                  {fmt(balanceOwing)}
                </p>
              </div>

              <div
                className="rounded-xl border-2 p-4 mb-4 transition-colors"
                style={{
                  borderColor: cardReady ? GOLD : `${FOREST}14`,
                  backgroundColor: "white",
                  opacity: sdkError ? 0.4 : 1,
                }}
              >
                <div id="sq-card-container" style={{ minHeight: 90 }} />
                {!sdkReady && !error && !sdkError && (
                  <div className="flex items-center justify-center py-6">
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: `${GOLD}30`, borderTopColor: GOLD }}
                    />
                    <span
                      className="ml-2 text-[12px]"
                      style={{ color: `${FOREST}50` }}
                    >
                      Loading payment form…
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div
                  className="px-4 py-3 rounded-xl mb-4 text-[12px] font-medium"
                  style={{
                    backgroundColor: "#FEF2F2",
                    color: "#991B1B",
                    border: "1px solid #FECACA",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={!cardReady || processing}
                className="w-full py-4 rounded-xl text-[13px] font-bold tracking-wide text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: cardReady && !processing ? WINE : `${WINE}60`,
                }}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                      }}
                    />
                    Processing…
                  </span>
                ) : (
                  `Pay ${fmt(balanceOwing)}`
                )}
              </button>

              <div className="flex items-center justify-center gap-2 mt-3">
                <Lock size={12} style={{ color: `${FOREST}35` }} aria-hidden />
                <span className="text-[10px]" style={{ color: `${FOREST}35` }}>
                  Secured by Square &middot; 256-bit encryption
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
