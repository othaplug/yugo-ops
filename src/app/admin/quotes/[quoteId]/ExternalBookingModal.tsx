"use client";

import { useState } from "react";
import { X, CaretLeft } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";

type TierKey = "essential" | "signature" | "estate";
type DepositMethod = "etransfer" | "credit_card" | "cash" | "cheque" | "other";
type BookedVia = "hubspot" | "email" | "phone" | "in_person" | "other";

interface TierData {
  price: number;
  deposit: number;
  tax: number;
  total: number;
}

interface ExternalBookingModalProps {
  quoteId: string; // UUID
  quoteHumanId: string; // e.g. YG-30211
  tiers: Record<string, TierData>;
  serviceType: string;
  onClose: () => void;
  onSuccess: (moveCode: string) => void;
}

const TIER_LABELS: Record<TierKey, string> = {
  essential: "Essential",
  signature: "Signature",
  estate: "Estate",
};

const TIER_ORDER: TierKey[] = ["essential", "signature", "estate"];

const BOOKED_VIA_OPTIONS: { value: BookedVia; label: string }[] = [
  { value: "hubspot", label: "HubSpot (old CRM)" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

const DEPOSIT_METHOD_OPTIONS: { value: DepositMethod; label: string }[] = [
  { value: "etransfer", label: "E-Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const FIELD_CLASS =
  "w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] focus:border-[var(--brd)] focus:ring-1 focus:ring-[var(--brd)]/30 outline-none";

const LABEL_CLASS =
  "block text-[11px] font-semibold text-[var(--tx2)] mb-1.5";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function suggestedDeposit(tier: TierKey, total: number): number {
  switch (tier) {
    case "essential": return Math.max(170, Math.round(total * 0.1));
    case "signature": return Math.max(283, Math.round(total * 0.15));
    case "estate":    return Math.max(565, Math.round(total * 0.25));
  }
}

export default function ExternalBookingModal({
  quoteId,
  quoteHumanId,
  tiers,
  onClose,
  onSuccess,
}: ExternalBookingModalProps) {
  const [step, setStep] = useState<"tier_select" | "deposit_confirm">("tier_select");
  const [tierSelected, setTierSelected] = useState<TierKey | null>(null);
  const [confirmedPrice, setConfirmedPrice] = useState<number | null>(null);

  // deposit_confirm state
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("etransfer");
  const [depositDate, setDepositDate] = useState(todayIso());
  const [bookedVia, setBookedVia] = useState<BookedVia>("hubspot");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available tiers (only those in the data)
  const availableTiers = TIER_ORDER.filter((k) => tiers[k]?.price > 0);

  function handleTierSelect(tier: TierKey) {
    const tierData = tiers[tier];
    setTierSelected(tier);
    setConfirmedPrice(tierData.price);
    // Pre-fill suggested deposit
    const total = tierData.total ?? Math.round(tierData.price * 1.13);
    setDepositAmount(suggestedDeposit(tier, total));
  }

  function totalWithTax(preTax: number) {
    return Math.round(preTax * 1.13);
  }

  async function handleConfirm() {
    if (!tierSelected || !confirmedPrice || !depositAmount || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/book-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_selected: tierSelected,
          deposit_amount: depositAmount,
          deposit_method: depositMethod,
          deposit_date: depositDate,
          booked_via: bookedVia,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        move_code?: string;
        already_booked?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "Booking failed");
      onSuccess(data.move_code ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const total = confirmedPrice ? totalWithTax(confirmedPrice) : 0;

  return (
    <div
      className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center p-4 sm:p-5 modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--brd)] bg-[var(--card)] shadow-2xl animate-slide-up sm:animate-none overflow-y-auto"
        style={{ maxHeight: "min(90dvh, 90vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--tx3)] hover:text-[var(--tx)] transition-colors z-10"
          aria-label="Close"
        >
          <X size={18} weight="regular" />
        </button>

        <div className="p-6">
          {/* ── STEP 1: Tier selection ── */}
          {step === "tier_select" && (
            <>
              <div className="mb-5">
                <p className="text-[9px] font-bold tracking-widest uppercase text-amber-600 mb-1">
                  Confirm booking details
                </p>
                <h2 className="text-[16px] font-bold text-[var(--tx)]">
                  Which tier did the client book?
                </h2>
                <p className="text-[12px] text-[var(--tx3)] mt-1">
                  {quoteHumanId} · This quote has a price range. Select the tier the client confirmed.
                </p>
              </div>

              <div className="space-y-2 mb-5">
                {availableTiers.map((key) => {
                  const td = tiers[key];
                  const tierTotal = td.total ?? Math.round(td.price * 1.13);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTierSelect(key)}
                      className={`w-full px-4 py-3 rounded-lg border text-left transition-all ${
                        tierSelected === key
                          ? "border-[var(--yugo-primary-text)] bg-[color-mix(in_srgb,var(--yugo-primary-text)_7%,transparent)]"
                          : "border-[var(--brd)] hover:border-[var(--brd)]/80 bg-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--tx)]">
                            {TIER_LABELS[key]}
                          </p>
                        </div>
                        <p className="text-[13px] font-semibold text-[var(--tx)] tabular-nums shrink-0">
                          {formatCurrency(tierTotal)} incl. tax
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Price override */}
              {tierSelected && (
                <div className="mb-5">
                  <label className={LABEL_CLASS}>
                    Confirmed price (pre-tax)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] text-[13px]">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={confirmedPrice ?? ""}
                      onChange={(e) => setConfirmedPrice(parseFloat(e.target.value) || null)}
                      className={`${FIELD_CLASS} pl-7`}
                    />
                  </div>
                  {confirmedPrice && confirmedPrice > 0 && (
                    <p className="text-[11px] text-[var(--tx3)] mt-1">
                      With HST (13%): {formatCurrency(totalWithTax(confirmedPrice))}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--brd)]/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!tierSelected || !confirmedPrice}
                  onClick={() => setStep("deposit_confirm")}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] text-[12px] font-bold uppercase tracking-[0.1em] disabled:opacity-30 transition-opacity"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Deposit details ── */}
          {step === "deposit_confirm" && tierSelected && (
            <>
              <button
                type="button"
                onClick={() => { setStep("tier_select"); setError(null); }}
                className="flex items-center gap-1 text-[11px] text-[var(--tx3)] hover:text-[var(--tx)] mb-4 transition-colors"
              >
                <CaretLeft size={12} /> Back
              </button>

              <div className="mb-5">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)] mb-1">
                  Record deposit
                </p>
                <h2 className="text-[16px] font-bold text-[var(--tx)]">
                  {TIER_LABELS[tierSelected]} · {formatCurrency(total)} total
                </h2>
                {confirmedPrice && (
                  <p className="text-[12px] text-[var(--tx3)] mt-0.5">
                    {formatCurrency(confirmedPrice)} + HST
                  </p>
                )}
              </div>

              <div className="space-y-4 mb-5">
                {/* Deposit amount */}
                <div>
                  <label className={LABEL_CLASS}>
                    Deposit received (incl. tax) <span className="text-[var(--red)]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] text-[13px]">
                      $
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={depositAmount ?? ""}
                      onChange={(e) => setDepositAmount(parseFloat(e.target.value) || null)}
                      className={`${FIELD_CLASS} pl-7`}
                    />
                  </div>
                  {depositAmount && total > 0 && (
                    <p className="text-[11px] text-[var(--tx3)] mt-1">
                      Balance owing: {formatCurrency(Math.max(0, total - depositAmount))}
                    </p>
                  )}
                </div>

                {/* Payment method */}
                <div>
                  <label className={LABEL_CLASS}>Payment method</label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}
                    className={FIELD_CLASS}
                  >
                    {DEPOSIT_METHOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Date paid */}
                <div>
                  <label className={LABEL_CLASS}>Date paid</label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>

                {/* Booked via */}
                <div>
                  <label className={LABEL_CLASS}>Booked via</label>
                  <select
                    value={bookedVia}
                    onChange={(e) => setBookedVia(e.target.value as BookedVia)}
                    className={FIELD_CLASS}
                  >
                    {BOOKED_VIA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className={LABEL_CLASS}>Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Samantha confirmed Signature via email May 6"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              {error && (
                <p className="text-[12px] text-[var(--red)] mb-4 leading-snug">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--brd)]/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!depositAmount || depositAmount <= 0 || loading}
                  onClick={() => void handleConfirm()}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] text-[12px] font-bold uppercase tracking-[0.1em] disabled:opacity-30 transition-opacity"
                >
                  {loading ? "Creating move…" : "Confirm and create move"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
