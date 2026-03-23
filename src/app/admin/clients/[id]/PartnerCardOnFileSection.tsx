"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "../../components/Toast";
import { Icon } from "@/components/AppIcons";

const CARD_BRAND_LABELS: Record<string, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  AMERICAN_EXPRESS: "Amex",
  DISCOVER: "Discover",
  INTERAC: "Interac",
  JCB: "JCB",
  UNION_PAY: "UnionPay",
};

interface PartnerCardOnFileSectionProps {
  orgId: string;
  squareCardId?: string | null;
  cardLastFour?: string | null;
  cardBrand?: string | null;
  cardOnFile?: boolean;
  squareAppId: string;
  squareLocationId: string;
  onSaved?: () => void;
}

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
};

type SquareWindow = typeof window & {
  Square?: {
    payments: (appId: string, locationId: string) => Promise<{
      card: () => Promise<SquareCard>;
    }>;
  };
};

export default function PartnerCardOnFileSection({
  orgId,
  squareCardId,
  cardLastFour,
  cardBrand,
  cardOnFile,
  squareAppId,
  squareLocationId,
  onSaved,
}: PartnerCardOnFileSectionProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);

  const brandLabel = cardBrand ? (CARD_BRAND_LABELS[cardBrand] ?? cardBrand) : "";

  // Load Square Web Payments SDK on demand
  useEffect(() => {
    if (!showForm) return;
    if ((window as SquareWindow).Square) { setSdkReady(true); return; }

    const script = document.createElement("script");
    script.src = "https://web.squarecdn.com/v1/square.js";
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);
  }, [showForm]);

  // Mount Square card form when SDK is ready
  useEffect(() => {
    const sq = (window as SquareWindow).Square;
    if (!sdkReady || !showForm || !sq) return;

    let mounted = true;
    void (async () => {
      try {
        const payments = await sq.payments(squareAppId, squareLocationId);
        const card = await payments.card();
        if (!mounted) return;
        await card.attach("#partner-card-container");
        cardRef.current = card;
      } catch (e) {
        console.error("[Square] card mount failed:", e);
      }
    })();

    return () => {
      mounted = false;
      try { cardRef.current?.destroy(); } catch { /* best-effort cleanup */ }
      cardRef.current = null;
    };
  }, [sdkReady, showForm, squareAppId, squareLocationId]);

  const handleSaveCard = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        const msg = result.errors?.map((e) => e.message).join(", ") || "Card tokenisation failed";
        toast(msg, "alertTriangle");
        return;
      }

      const res = await fetch(`/api/admin/partners/${orgId}/card-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: result.token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save card");

      toast("Card saved successfully", "check");
      setShowForm(false);
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save card", "alertTriangle");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!window.confirm("Remove the card on file for this partner? They will receive a manual invoice for the next statement.")) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/partners/${orgId}/card-capture`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove card");
      toast("Card removed", "check");
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to remove card", "alertTriangle");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--brd)]/60 bg-[var(--card)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="creditCard" className="w-4 h-4 text-[var(--gold)]" />
          <h3 className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">Payment Method</h3>
        </div>
      </div>

      {cardOnFile && cardLastFour ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon name="check" className="w-4 h-4 text-[var(--grn)]" />
            <span className="text-[13px] font-medium text-[var(--tx)]">
              {brandLabel} ending in {cardLastFour}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--bg2)] text-[var(--tx3)] border border-[var(--brd)] hover:text-[var(--tx)] hover:border-[var(--brd)]/80 transition-colors"
            >
              Update Card
            </button>
            <button
              type="button"
              onClick={handleRemoveCard}
              disabled={removing}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30 hover:bg-[var(--red)]/20 transition-colors disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon name="alertTriangle" className="w-4 h-4 text-[var(--tx3)]" />
            <span className="text-[12px] text-[var(--tx3)]">No card on file — statements will be sent as invoices</span>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/40 hover:bg-[var(--gold)]/25 transition-colors"
            >
              Add Credit Card
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 pt-3 border-t border-[var(--brd)]/50">
          <p className="text-[11px] text-[var(--tx3)]">
            Card details are processed securely by Square. OPS+ never stores raw card data.
          </p>
          {!sdkReady ? (
            <div className="flex items-center gap-2 text-[11px] text-[var(--tx3)]">
              <Icon name="loading" className="w-4 h-4 animate-spin" />
              Loading payment form…
            </div>
          ) : (
            <div
              id="partner-card-container"
              className="min-h-[100px] rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveCard}
              disabled={saving || !sdkReady}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/40 hover:bg-[var(--gold)]/25 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Card"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); try { cardRef.current?.destroy(); } catch { /* noop */ } cardRef.current = null; }}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[var(--bg2)] text-[var(--tx3)] border border-[var(--brd)] hover:text-[var(--tx)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
