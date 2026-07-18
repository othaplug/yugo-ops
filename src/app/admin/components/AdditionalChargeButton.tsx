"use client";

import { CaretRight, Plus, CheckCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import ModalOverlay from "./ModalOverlay";

const HST_RATE = 0.13;
// Mirror the server defaults (platform_config can override, but these match the
// seeded Square rate). Preview only — the charged total comes back authoritative.
const PROC_RATE = 0.029;
const PROC_FLAT = 0.3;

function grossUp(preTax: number): number {
  return Math.ceil((preTax + PROC_FLAT) / (1 - PROC_RATE));
}

/**
 * Owner/senior-admin action on the move Money tab: collect an ADDITIONAL charge
 * on the card on file (extra items, wait time, scope creep found after booking).
 * Adds HST + card-processing recovery, charges the card, and drops the receipt
 * into the client's portal — none of which "Adjust final price" does.
 */
export default function AdditionalChargeButton({
  moveId,
  hasCardOnFile,
  canCharge,
}: {
  moveId: string;
  hasCardOnFile: boolean;
  canCharge: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [recoverCc, setRecoverCc] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ inclusive: number; receiptUrl: string | null } | null>(null);
  const [idemKey, setIdemKey] = useState("");

  const preview = useMemo(() => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    const preTax = recoverCc ? grossUp(n) : Math.round(n * 100) / 100;
    const hst = Math.round(preTax * HST_RATE * 100) / 100;
    const inclusive = Math.round((preTax + hst) * 100) / 100;
    return { entered: Math.round(n * 100) / 100, preTax, hst, inclusive };
  }, [amount, recoverCc]);

  if (!canCharge || !hasCardOnFile) return null;

  const openModal = () => {
    setOpen(true);
    setAmount("");
    setReason("");
    setRecoverCc(true);
    setError(null);
    setDone(null);
    setIdemKey(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.random()).slice(2),
    );
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
    // A completed charge changed the ledger — refresh so the new transaction +
    // receipt render on the Money tab.
    if (done) window.location.reload();
  };

  const submit = async () => {
    setError(null);
    if (!preview) {
      setError("Enter a positive amount");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Add a short reason for the charge");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/moves/${encodeURIComponent(moveId)}/additional-charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: preview.entered,
          reason: reason.trim(),
          apply_cc_recovery: recoverCc,
          idempotency_key: idemKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "The charge could not be completed.");
        return;
      }
      setDone({ inclusive: Number(data.inclusive) || preview.inclusive, receiptUrl: data.receipt_url ?? null });
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const outlineBtn =
    "inline-flex items-center justify-center gap-1.5 rounded-md border-0 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx)] bg-transparent hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tx)]/25 transition-colors disabled:opacity-45 disabled:pointer-events-none";
  const ghostBtn =
    "inline-flex items-center justify-center rounded-md border border-[var(--brd)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] bg-transparent hover:bg-[var(--hover)] transition-colors disabled:opacity-45";
  const fieldClass =
    "w-full rounded-md border border-[var(--brd)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--tx)] placeholder:text-[var(--tx3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tx)]/20";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--brd)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx2)] hover:bg-[var(--hover)] hover:text-[var(--tx)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tx)]/25 transition-colors"
        title="Charge an additional amount to the card on file"
      >
        <Plus size={12} weight="bold" aria-hidden />
        Charge extra
      </button>

      <ModalOverlay open={open} onClose={close} title="Charge additional amount" maxWidth="md">
        <div className="p-5 space-y-4">
          {done ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--grn)]">
                <CheckCircle size={20} weight="fill" aria-hidden />
                <p className="text-sm font-semibold">
                  Charged ${done.inclusive.toFixed(2)} to the card on file.
                </p>
              </div>
              <p className="text-xs text-[var(--tx3)] leading-relaxed">
                A receipt has been added to the client&apos;s portal and this shows in Payment transactions below.
              </p>
              {done.receiptUrl ? (
                <a
                  href={done.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--wine,#5C1A33)] underline"
                >
                  View receipt
                </a>
              ) : null}
              <div>
                <button type="button" onClick={close} className={outlineBtn}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--tx3)] leading-relaxed">
                Collects an extra charge on the card on file — HST and card-processing recovery are added
                automatically, and a receipt is posted to the client&apos;s portal. This does not change the
                original contract total.
              </p>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-end">
                <div>
                  <label
                    htmlFor={`addl-amount-${moveId}`}
                    className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]"
                  >
                    Additional amount (pre-tax)
                  </label>
                  <input
                    id={`addl-amount-${moveId}`}
                    type="number"
                    step="0.01"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`${fieldClass} tabular-nums text-lg font-medium`}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--tx2)] sm:pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recoverCc}
                    onChange={(e) => setRecoverCc(e.target.checked)}
                    className="h-4 w-4 accent-[var(--wine,#5C1A33)]"
                  />
                  Recover card-processing fee
                </label>
              </div>

              <div>
                <label
                  htmlFor={`addl-reason-${moveId}`}
                  className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]"
                >
                  Reason (required)
                </label>
                <textarea
                  id={`addl-reason-${moveId}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Example: additional 1.5 hrs wait time + 3 extra items"
                  className={`${fieldClass} min-h-[70px] resize-y leading-relaxed`}
                  rows={3}
                />
              </div>

              {preview ? (
                <div className="rounded-md border border-[var(--brd)] bg-[var(--surface)]/60 px-3 py-2.5 text-xs text-[var(--tx2)] space-y-1 tabular-nums">
                  <div className="flex justify-between">
                    <span>Amount entered</span>
                    <span>${preview.entered.toFixed(2)}</span>
                  </div>
                  {recoverCc && preview.preTax !== preview.entered ? (
                    <div className="flex justify-between">
                      <span>+ card-processing recovery</span>
                      <span>${(preview.preTax - preview.entered).toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span>+ HST (13%)</span>
                    <span>${preview.hst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--brd)] pt-1 mt-1 font-semibold text-[var(--tx)]">
                    <span>Total charged to card</span>
                    <span>${preview.inclusive.toFixed(2)}</span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div
                  className="rounded-md border border-[var(--red)]/35 bg-[var(--rdim)] px-3 py-2 text-sm text-[var(--red)]"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving || !preview || reason.trim().length < 3}
                  className={outlineBtn}
                >
                  {saving ? "Charging" : preview ? `Charge $${preview.inclusive.toFixed(2)}` : "Charge card"}
                  {!saving ? <CaretRight size={16} weight="bold" aria-hidden /> : null}
                </button>
                <button type="button" onClick={close} disabled={saving} className={ghostBtn}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </ModalOverlay>
    </>
  );
}
