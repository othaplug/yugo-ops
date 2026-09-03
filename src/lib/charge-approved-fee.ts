import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { squareIdem } from "@/lib/square-idempotency";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { splitOntarioTaxInclusive } from "@/lib/format-currency";
import { readSquareReceiptUrl } from "@/lib/square/payment-response";
import {
  squarePaymentErrorsToMessage,
  squareThrownErrorMessage,
} from "@/lib/square-payment-errors";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ChargeApprovedFeeResult =
  | {
      charged: true;
      squarePaymentId: string;
      receiptUrl: string | null;
      /**
       * True when this exact payment was ALREADY recorded on a prior attempt
       * (Square deduped the card charge via the idempotency key, and a ledger
       * row for this square_payment_id already exists). Callers MUST NOT re-run
       * money-affecting side effects (bumping move totals, marking items paid)
       * when this is true, or a lost-response retry double-counts the books.
       */
      alreadyRecorded: boolean;
    }
  | { charged: false; reason: string };

/**
 * Charge an approved additional-item / change-request fee to the move's card on
 * file. The fee is treated as TAX-INCLUSIVE (the amount the client owes), and
 * recorded as an `adjustment` ledger row so it shows in the payment-transaction
 * list without inflating the contract "collected" bar (the fee is outside the
 * contract). Returns `{ charged: false }` instead of throwing when there is no
 * card on file or the charge declines, so the caller can still approve the item
 * and surface the reason.
 */
export async function chargeApprovedFeeOnCard(opts: {
  admin: AdminClient;
  moveId: string;
  /** Tax-inclusive fee in dollars (e.g. 50.00). */
  feeInclusive: number;
  /** Ledger label, e.g. "Extra items — Chairs ×2". */
  label: string;
  /** Stable per-row discriminator for idempotency (e.g. the extra-item id). */
  idemSuffix: string;
}): Promise<ChargeApprovedFeeResult> {
  const { admin, moveId, label, idemSuffix } = opts;
  const inclusive = Math.round(opts.feeInclusive * 100) / 100;
  if (inclusive <= 0) return { charged: false, reason: "Fee amount is zero" };

  const { data: move } = await admin
    .from("moves")
    .select("id, move_code, square_customer_id, square_card_id")
    .eq("id", moveId)
    .single();
  if (!move) return { charged: false, reason: "Move not found" };

  let cardId: string | null = move.square_card_id ?? null;
  const customerId: string | null = move.square_customer_id ?? null;
  if (!cardId && customerId) {
    try {
      const listRes = await squareClient.cards.list({ customerId, sortOrder: "ASC" });
      cardId = listRes.data?.[0]?.id ?? null;
    } catch {
      /* fall through to no-card */
    }
  }
  if (!cardId) return { charged: false, reason: "No card on file" };

  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) return { charged: false, reason: "Payment is not configured" };

  const amountCents = Math.round(inclusive * 100);
  let paymentId: string | undefined;
  let receiptUrl: string | null = null;
  try {
    const res = await squareClient.payments.create({
      sourceId: cardId,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      customerId: customerId ?? undefined,
      referenceId: move.move_code || moveId,
      note: label.slice(0, 200),
      idempotencyKey: squareIdem("fee", moveId, idemSuffix),
      locationId,
    });
    if (res.errors && res.errors.length > 0) {
      return { charged: false, reason: squarePaymentErrorsToMessage(res.errors) };
    }
    paymentId = res.payment?.id;
    receiptUrl = readSquareReceiptUrl(res.payment);
  } catch (e) {
    return { charged: false, reason: squareThrownErrorMessage(e) };
  }
  if (!paymentId) return { charged: false, reason: "Payment was not completed" };

  // Idempotency: Square deduped the card charge (same idempotencyKey → same
  // paymentId), but on a lost-response retry we'd otherwise insert a SECOND
  // ledger row for the same payment and the caller would bump totals again.
  // If a ledger row for this square_payment_id already exists, this is a retry
  // of an already-recorded charge — skip the insert and tell the caller not to
  // re-apply side effects.
  const { data: existingLedger } = await admin
    .from("move_payment_ledger")
    .select("id")
    .eq("square_payment_id", paymentId)
    .limit(1)
    .maybeSingle();
  if (existingLedger) {
    return { charged: true, squarePaymentId: paymentId, receiptUrl, alreadyRecorded: true };
  }

  // 'adjustment' = outside the contract; shows in transactions, excluded from
  // the contract collected bar (see MoveDetailClient ledger filter).
  const { preTax, hst } = splitOntarioTaxInclusive(inclusive);
  const { error: ledgerErr } = await admin.from("move_payment_ledger").insert({
    move_id: moveId,
    entry_type: "adjustment",
    label: label.slice(0, 200),
    pre_tax_amount: preTax,
    hst_amount: hst,
    square_payment_id: paymentId,
    square_receipt_url: receiptUrl,
    settlement_method: "card",
    paid_at: new Date().toISOString(),
  });

  // A concurrent attempt (two truly-simultaneous submits that both passed the
  // existence check above) races to insert the same square_payment_id. The
  // partial unique index on move_payment_ledger(square_payment_id) makes the
  // loser fail with 23505 — treat that as "already recorded" so the caller
  // skips its side effects, exactly like the sequential-retry path.
  if (ledgerErr) {
    if (ledgerErr.code === "23505") {
      return { charged: true, squarePaymentId: paymentId, receiptUrl, alreadyRecorded: true };
    }
    // Any other insert failure: the money was captured but not recorded. Surface
    // it so it can be reconciled rather than silently double-charging later.
    console.error("[charge-approved-fee] ledger insert failed:", ledgerErr.message, paymentId);
    return { charged: false, reason: "Charge captured but not recorded — check Square/ledger." };
  }

  return { charged: true, squarePaymentId: paymentId, receiptUrl, alreadyRecorded: false };
}
