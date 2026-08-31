/**
 * Inspect MV-30282 (Grant McAdam) — figure out why finance/client-revenue
 * shows $11,297 on the list and $5.2K outstanding on the detail.
 *
 * Usage:  npx tsx scripts/inspect-mv30282.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("*")
    .eq("move_code", "MV-30282")
    .maybeSingle();

  if (!move) {
    console.log("no move");
    return;
  }

  console.log("=== MOVE ===");
  console.log({
    id: move.id,
    move_code: move.move_code,
    client_name: move.client_name,
    client_email: move.client_email,
    status: move.status,
    organization_id: move.organization_id,
    is_pm_move: move.is_pm_move,
    payment_marked_paid: move.payment_marked_paid,
    payment_marked_paid_at: move.payment_marked_paid_at,
    deposit_amount: move.deposit_amount,
    balance_amount: move.balance_amount,
    total_price: move.total_price,
    final_amount: move.final_amount,
    estimate: move.estimate,
    amount: move.amount,
    invoice_id: move.invoice_id,
  });

  // Find every invoice row that could show up for Grant
  const { data: invoicesByMove } = await admin
    .from("invoices")
    .select("*")
    .eq("move_id", move.id);
  console.log("\n=== INVOICES ON move_id ===");
  console.log(invoicesByMove);

  const { data: invoicesByName } = await admin
    .from("invoices")
    .select("*")
    .ilike("client_name", move.client_name || "");
  console.log("\n=== INVOICES BY client_name ilike ===");
  console.log(invoicesByName);

  // Any organizations row for Grant?
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, type, email, created_at")
    .or(`name.ilike.${(move.client_name || "").split(" ")[0]}%,email.eq.${move.client_email || "none"}`);
  console.log("\n=== POTENTIAL ORG ROWS ===");
  console.log(orgs);

  // Payment ledger
  const { data: ledger } = await admin
    .from("payment_ledger")
    .select("id, amount_cents, kind, source, created_at, square_payment_id")
    .eq("move_id", move.id)
    .order("created_at", { ascending: true });
  console.log("\n=== PAYMENT LEDGER ===");
  console.log(ledger);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
