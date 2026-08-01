/**
 * Backfill a Square receipt for a move whose deposit/full payment was recorded
 * OFFLINE before the external-payment fix (fake `offline-*` id, no Square
 * record, no ledger entry). Creates a real Square EXTERNAL payment for the
 * already-received amount and writes the deposit ledger row so the receipt
 * appears in the client's track-portal Files tab.
 *
 * Usage:
 *   npx tsx scripts/backfill-offline-receipt.ts MV-30369          # inspect only
 *   npx tsx scripts/backfill-offline-receipt.ts MV-30369 --apply  # create receipt
 *
 * Requires .env.local: Supabase admin vars + SQUARE_ACCESS_TOKEN.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const code = (process.argv[2] || "").trim().toUpperCase();
  const apply = process.argv.includes("--apply");
  if (!code) {
    console.error("Pass a move code, e.g. MV-30369");
    process.exit(1);
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: move, error } = await admin
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, service_type, deposit_amount, deposit_method, balance_amount, square_payment_id, square_receipt_url",
    )
    .eq("move_code", code)
    .maybeSingle();

  if (error || !move) {
    console.error("Move not found:", code, error?.message);
    process.exit(1);
  }

  const { data: ledger } = await admin
    .from("move_payment_ledger")
    .select("id, entry_type, label, pre_tax_amount, hst_amount, square_receipt_url, square_payment_id")
    .eq("move_id", move.id)
    .order("paid_at", { ascending: true });

  console.log("\n── Move", move.move_code, "──");
  console.log("  service_type      :", move.service_type);
  console.log("  client            :", move.client_name, `<${move.client_email}>`);
  console.log("  deposit_amount    :", move.deposit_amount);
  console.log("  balance_amount    :", move.balance_amount);
  console.log("  square_payment_id :", move.square_payment_id);
  console.log("  square_receipt_url:", move.square_receipt_url);
  console.log("  ledger rows       :", (ledger ?? []).length);
  for (const r of ledger ?? []) {
    console.log(
      `    - ${r.entry_type} "${r.label}" $${(Number(r.pre_tax_amount) + Number(r.hst_amount)).toFixed(2)} receipt=${r.square_receipt_url ? "yes" : "NO"} pay=${r.square_payment_id}`,
    );
  }

  const depositIncl = Number(move.deposit_amount || 0);
  const depositLedger = (ledger ?? []).find((r) => r.entry_type === "deposit");
  const paymentIsReal =
    !!move.square_payment_id && !String(move.square_payment_id).startsWith("offline-");

  if (depositLedger?.square_receipt_url) {
    console.log("\n✓ Deposit ledger row already has a receipt. Nothing to do.");
    return;
  }
  if (depositIncl <= 0) {
    console.log("\n! No positive deposit_amount to backfill.");
    return;
  }

  const { recordMovePaymentLedgerEntry } = await import(
    "@/lib/payments/record-move-payment"
  );

  // CASE A: the move already carries a real Square payment + receipt (e.g. a
  // prior backfill created it) but the ledger row is missing. Just write the
  // ledger row from what's on the move — no new Square charge.
  if (paymentIsReal && move.square_receipt_url && !depositLedger) {
    if (!apply) {
      console.log(
        "\nDRY RUN — move has a real Square receipt but no ledger row; would write the deposit ledger row (no new charge).\nRe-run with --apply.",
      );
      return;
    }
    await recordMovePaymentLedgerEntry(admin, {
      moveId: move.id,
      entryType: "deposit",
      label: "Contract deposit",
      amountInclusive: depositIncl,
      squarePaymentId: move.square_payment_id,
      squareReceiptUrl: move.square_receipt_url,
      settlementMethod: "admin",
      dedupeByEntryType: true,
    });
    console.log("\n✓ Wrote the deposit ledger row from the existing Square receipt.");
    return;
  }

  if (paymentIsReal) {
    console.log("\n✓ Move already has a real Square payment. Nothing to backfill.");
    return;
  }

  // CASE B: fully offline (fake id, no receipt). Create the Square EXTERNAL
  // payment, write the ledger row, and stamp the move.
  if (!apply) {
    console.log(
      `\nDRY RUN — would create a Square EXTERNAL payment for $${depositIncl.toFixed(2)} and write the deposit ledger row.\nRe-run with --apply to do it.`,
    );
    return;
  }

  const { recordExternalSquarePayment } = await import(
    "@/lib/payments/record-external-square-payment"
  );

  console.log("\nCreating Square EXTERNAL payment…");
  const ext = await recordExternalSquarePayment({
    amountInclusive: depositIncl,
    referenceId: move.move_code || move.id,
    note: `Deposit for ${move.move_code} — recorded by Yugo (offline, backfill)`,
    method: (move.deposit_method as string | null) ?? "other",
    buyerEmail: move.client_email,
    idempotencySuffix: `backfill-${move.id}`,
  });

  if (!ext.ok) {
    console.error("✗ Square external payment failed:", ext.error);
    process.exit(1);
  }
  console.log("  payment id :", ext.paymentId);
  console.log("  receipt url:", ext.receiptUrl ?? "(none returned)");

  await recordMovePaymentLedgerEntry(admin, {
    moveId: move.id,
    entryType: "deposit",
    label: "Contract deposit",
    amountInclusive: depositIncl,
    squarePaymentId: ext.paymentId,
    squareReceiptUrl: ext.receiptUrl,
    settlementMethod: "admin",
    dedupeByEntryType: true,
  });

  // Stamp the move so the Files fallback + admin surfaces also resolve it.
  await admin
    .from("moves")
    .update({
      square_payment_id: ext.paymentId,
      square_receipt_url: ext.receiptUrl ?? move.square_receipt_url ?? null,
    })
    .eq("id", move.id);

  console.log("\n✓ Backfilled. The deposit receipt will now show in the Files tab.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
