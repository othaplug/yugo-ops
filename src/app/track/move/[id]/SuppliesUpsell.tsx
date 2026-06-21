"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Script from "next/script";
import {
  Package,
  Plus,
  Minus,
  Check,
  CircleNotch,
  Truck,
} from "@phosphor-icons/react";
import {
  FOREST,
  GOLD,
  TRACK_EYEBROW_CLASS,
  TRACK_CARD_TITLE_CLASS,
} from "@/lib/client-theme";

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
type SquareSdk = {
  payments: (
    appId: string,
    locationId: string,
  ) => { card: () => Promise<SquareCard> };
};

function getSquare(): SquareSdk | undefined {
  return (window as unknown as { Square?: SquareSdk }).Square;
}

export type SupplyCatalogItem = {
  slug: string;
  name: string;
  description: string | null;
  price: number;
  price_type: string;
  unit_label: string | null;
};

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default function SuppliesUpsell({
  moveId,
  token,
  catalog,
  hasCardOnFile,
  useSandbox,
}: {
  moveId: string;
  token: string;
  catalog: SupplyCatalogItem[];
  hasCardOnFile: boolean;
  useSandbox: boolean;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderNumber: string; total: number } | null>(
    null,
  );

  // Card-form fallback (only when there is no card on file)
  const [showCardForm, setShowCardForm] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const sqCardRef = useRef<SquareCard | null>(null);
  const sqInitRef = useRef(false);

  const setItemQty = (slug: string, next: number) =>
    setQty((q) => ({ ...q, [slug]: Math.max(0, Math.min(50, next)) }));

  const isPerUnit = (it: SupplyCatalogItem) => it.price_type === "per_unit";

  const selected = catalog
    .map((it) => {
      const q = qty[it.slug] ?? 0;
      if (q <= 0) return null;
      const effQty = isPerUnit(it) ? q : 1;
      return { it, quantity: effQty, lineTotal: it.price * effQty };
    })
    .filter(Boolean) as { it: SupplyCatalogItem; quantity: number; lineTotal: number }[];

  const subtotal = selected.reduce((s, l) => s + l.lineTotal, 0);
  const hst = Math.round(subtotal * 0.13 * 100) / 100;
  const total = Math.round((subtotal + hst) * 100) / 100;
  const hasSelection = selected.length > 0;

  // ── Lazy-init the Square card form when the fallback opens ──
  const initCard = useCallback(async () => {
    const square = getSquare();
    if (sqInitRef.current || !square) return;
    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
    let locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
    let resolvedAppId = appId;
    if (!resolvedAppId || !locationId) {
      try {
        const cfg = await fetch("/api/payments/config").then((r) => r.json());
        resolvedAppId = resolvedAppId || cfg.appId?.trim();
        locationId = locationId || cfg.locationId?.trim();
      } catch {
        /* handled below */
      }
    }
    if (!resolvedAppId || !locationId) {
      setError("Payment is not configured. Please contact support.");
      return;
    }
    sqInitRef.current = true;
    try {
      const payments = square.payments(resolvedAppId, locationId);
      const card = await payments.card();
      await card.attach("#sq-supplies-card");
      sqCardRef.current = card;
      setCardReady(true);
    } catch {
      sqInitRef.current = false;
      setError("Unable to load the payment form. Please refresh.");
    }
  }, []);

  useEffect(() => {
    if (showCardForm && sdkReady && !sqInitRef.current) initCard();
  }, [showCardForm, sdkReady, initCard]);

  useEffect(() => {
    return () => {
      sqCardRef.current?.destroy();
    };
  }, []);

  const submit = async (sourceId?: string) => {
    if (!hasSelection || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/supplies?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: selected.map((l) => ({ slug: l.it.slug, quantity: l.quantity })),
            ...(sourceId ? { sourceId } : {}),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone({ orderNumber: data.orderNumber, total: data.total });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (hasCardOnFile) {
      submit();
      return;
    }
    if (!showCardForm) {
      setShowCardForm(true);
      return;
    }
    if (!sqCardRef.current) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await sqCardRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        setError(result.errors?.[0]?.message ?? "Card verification failed.");
        setSubmitting(false);
        return;
      }
      await submit(result.token);
    } catch {
      setError("Card verification failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (catalog.length === 0) return null;

  // ── Confirmation state ──
  if (done) {
    return (
      <div
        className="rounded-2xl p-5 mb-4"
        style={{
          background: `linear-gradient(155deg, #f5f1ea 0%, #ede8de 100%)`,
          border: `1px solid ${FOREST}1F`,
          boxShadow: "0 4px 20px rgba(44, 62, 45, 0.08)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${FOREST}16`, border: `1.5px solid ${FOREST}` }}
          >
            <Check size={18} color={FOREST} weight="bold" />
          </div>
          <div className="min-w-0">
            <div className={TRACK_CARD_TITLE_CLASS} style={{ color: FOREST }}>
              Your supplies are confirmed
            </div>
            <p
              className="text-[13px] mt-1 leading-relaxed"
              style={{ color: `${FOREST}B0` }}
            >
              Order {done.orderNumber}. Your crew will bring everything with them
              on move day, so there is nothing to wait in for.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setQty({});
            setShowCardForm(false);
          }}
          className="mt-3 text-[12px] font-semibold underline underline-offset-2"
          style={{ color: GOLD }}
        >
          Add more supplies
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{
        background: `linear-gradient(155deg, #f7f4ee 0%, #efe9dd 100%)`,
        border: `1px solid ${FOREST}1F`,
        boxShadow: "0 4px 20px rgba(44, 62, 45, 0.08), 0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${FOREST} 100%)` }}
      />

      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Package size={18} color={FOREST} weight="duotone" />
          <span className={TRACK_EYEBROW_CLASS} style={{ color: GOLD }}>
            Pack like a pro
          </span>
        </div>
        <div className={TRACK_CARD_TITLE_CLASS} style={{ color: FOREST }}>
          Add moving supplies
        </div>
        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: `${FOREST}AA` }}>
          Get everything you need to pack ahead of time. We bring it all with the
          crew on move day.
        </p>

        {/* Items */}
        <div className="mt-4 space-y-2.5">
          {catalog.map((it) => {
            const q = qty[it.slug] ?? 0;
            const perUnit = isPerUnit(it);
            const active = q > 0;
            return (
              <div
                key={it.slug}
                className="rounded-xl px-3.5 py-3 flex items-center gap-3 transition-colors"
                style={{
                  background: active ? `${FOREST}0C` : "rgba(255,255,255,0.5)",
                  border: `1px solid ${active ? `${FOREST}33` : `${FOREST}16`}`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] font-semibold leading-tight"
                    style={{ color: FOREST }}
                  >
                    {it.name}
                  </div>
                  {it.description && (
                    <div
                      className="text-[12px] mt-0.5 leading-snug"
                      style={{ color: `${FOREST}99` }}
                    >
                      {it.description}
                    </div>
                  )}
                  <div className="text-[12px] mt-1 font-semibold" style={{ color: GOLD }}>
                    {money(it.price)}
                    {perUnit && it.unit_label ? ` ${it.unit_label}` : ""}
                  </div>
                </div>

                {perUnit ? (
                  <div
                    className="flex items-center gap-2 rounded-full px-1.5 py-1 shrink-0"
                    style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${FOREST}22` }}
                  >
                    <button
                      type="button"
                      aria-label={`Remove one ${it.name}`}
                      onClick={() => setItemQty(it.slug, q - 1)}
                      disabled={q <= 0}
                      className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30"
                      style={{ color: FOREST }}
                    >
                      <Minus size={14} weight="bold" />
                    </button>
                    <span
                      className="w-5 text-center text-[14px] font-bold tabular-nums"
                      style={{ color: FOREST }}
                    >
                      {q}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add one ${it.name}`}
                      onClick={() => setItemQty(it.slug, q + 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: FOREST, color: "#fff" }}
                    >
                      <Plus size={14} weight="bold" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setItemQty(it.slug, active ? 0 : 1)}
                    className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      background: active ? FOREST : "transparent",
                      color: active ? "#fff" : FOREST,
                      border: `1.5px solid ${FOREST}`,
                    }}
                  >
                    {active ? (
                      <span className="flex items-center gap-1.5">
                        <Check size={14} weight="bold" /> Added
                      </span>
                    ) : (
                      "Add"
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Totals + checkout */}
        {hasSelection && (
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${FOREST}1A` }}>
            <div className="flex items-center justify-between text-[13px]" style={{ color: `${FOREST}AA` }}>
              <span>Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] mt-1" style={{ color: `${FOREST}AA` }}>
              <span>HST (13%)</span>
              <span className="tabular-nums">${hst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[14px] font-bold" style={{ color: FOREST }}>
                Total
              </span>
              <span className="text-[18px] font-bold tabular-nums" style={{ color: FOREST }}>
                ${total.toFixed(2)}
              </span>
            </div>

            {/* Card-form fallback */}
            {showCardForm && !hasCardOnFile && (
              <div className="mt-4">
                <Script
                  src={useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION}
                  strategy="afterInteractive"
                  onLoad={() => setSdkReady(true)}
                />
                <div
                  id="sq-supplies-card"
                  className="rounded-xl px-3 py-2"
                  style={{ background: "#fff", border: `1px solid ${FOREST}22`, minHeight: 52 }}
                />
                {!cardReady && !error && (
                  <p className="text-[12px] mt-2" style={{ color: `${FOREST}88` }}>
                    Loading secure payment…
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-[12px] mt-3" style={{ color: "#B91C1C" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleCheckout}
              disabled={submitting || (showCardForm && !hasCardOnFile && !cardReady)}
              className="mt-4 w-full rounded-xl py-3.5 text-[15px] font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ background: FOREST, color: "#fff" }}
            >
              {submitting ? (
                <>
                  <CircleNotch size={18} className="animate-spin" weight="bold" />
                  Processing…
                </>
              ) : showCardForm && !hasCardOnFile ? (
                <>Pay ${total.toFixed(2)}</>
              ) : hasCardOnFile ? (
                <>
                  <Truck size={17} weight="bold" />
                  Add to my move · ${total.toFixed(2)}
                </>
              ) : (
                <>Continue to payment</>
              )}
            </button>

            <p className="text-[11px] mt-2.5 text-center leading-snug" style={{ color: `${FOREST}88` }}>
              {hasCardOnFile
                ? "Charged to the card on file. Arrives with your crew on move day."
                : "Secure payment. Arrives with your crew on move day."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
