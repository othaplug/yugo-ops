import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { readSquareReceiptUrl } from "@/lib/square/payment-response";
import {
  squarePaymentErrorsToMessage,
  squareThrownErrorMessage,
} from "@/lib/square-payment-errors";
import { squareIdem } from "@/lib/square-idempotency";

export type ExternalSquareResult =
  | { ok: true; paymentId: string; receiptUrl: string | null }
  | { ok: false; error: string };

/**
 * Square's `external_details.type` enum accepts a fixed set of values. We map
 * our human deposit-method labels onto the three that always validate and
 * default everything else to OTHER so the call can't fail on a bad enum.
 */
function externalTypeForMethod(method?: string | null): string {
  const m = String(method || "").toLowerCase();
  if (m.includes("cheque") || m.includes("check")) return "CHECK";
  if (
    m.includes("etransfer") ||
    m.includes("e-transfer") ||
    m.includes("transfer") ||
    m.includes("wire") ||
    m.includes("bank")
  ) {
    return "BANK_TRANSFER";
  }
  return "OTHER";
}

/**
 * Record a payment that was collected OUTSIDE Square (cash, cheque, wire,
 * e-transfer) as a real EXTERNAL payment in the Square seller account.
 *
 * Why: manually-recorded deposits/full payments previously used a fake
 * `offline-*` id with no Square record and no receipt, so nothing showed in
 * Square and the client's track-portal Files tab was empty. An EXTERNAL
 * payment does not move money — it tells Square "this much was received off
 * platform" — and Square returns a real payment id + receiptUrl that flows
 * through the ledger into the Files tab, exactly like a card payment.
 *
 * Best-effort: never throws. On any Square error it returns { ok: false } so
 * the caller can still record the payment locally (with no receipt) rather
 * than block the operator from booking a real, already-received payment.
 */
export async function recordExternalSquarePayment(opts: {
  /** Tax-inclusive amount received, in dollars. */
  amountInclusive: number;
  /** Short reference shown in Square (move code or quote id), <= 40 chars. */
  referenceId: string;
  /** Human note on the payment (<= 500 chars). */
  note: string;
  /** Deposit method label (cash / cheque / etransfer / wire / other). */
  method?: string | null;
  /** Buyer email so Square can attach the receipt to the customer. */
  buyerEmail?: string | null;
  /** Stable idempotency suffix (e.g. quote id + kind) so retries don't double-record. */
  idempotencySuffix: string;
}): Promise<ExternalSquareResult> {
  const amountCents = Math.round((Number(opts.amountInclusive) || 0) * 100);
  if (amountCents <= 0) return { ok: false, error: "Amount must be greater than zero" };

  let locationId: string | null = null;
  try {
    ({ locationId } = await getSquarePaymentConfig());
  } catch (e) {
    return { ok: false, error: squareThrownErrorMessage(e) };
  }
  if (!locationId) return { ok: false, error: "Square is not configured" };

  try {
    const res = await squareClient.payments.create({
      sourceId: "EXTERNAL",
      externalDetails: {
        type: externalTypeForMethod(opts.method),
        source: opts.note.slice(0, 250),
      },
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      referenceId: opts.referenceId.slice(0, 40),
      note: opts.note.slice(0, 500),
      buyerEmailAddress: opts.buyerEmail ? opts.buyerEmail.slice(0, 255) : undefined,
      idempotencyKey: squareIdem("ext", opts.idempotencySuffix),
      locationId,
    });
    if (res.errors && res.errors.length > 0) {
      return { ok: false, error: squarePaymentErrorsToMessage(res.errors) };
    }
    const paymentId = res.payment?.id;
    if (!paymentId) return { ok: false, error: "Square did not return a payment" };
    return { ok: true, paymentId, receiptUrl: readSquareReceiptUrl(res.payment) };
  } catch (e) {
    return { ok: false, error: squareThrownErrorMessage(e) };
  }
}
