/**
 * Cancel every "ghost" invoice created by the retired
 * post-move-documents invoice insert.
 *
 * A ghost invoice is one that:
 *   - has move_id NOT NULL AND square_invoice_id IS NULL
 *   - AND EITHER
 *       (a) the linked move is payment_marked_paid = true (the client
 *           already paid the whole thing via Stripe/Square), OR
 *       (b) the move's organization is type = 'b2c' (retail client;
 *           there is no partner to invoice — this row should never
 *           have existed).
 *
 * Setting status='cancelled' rather than deleting so the audit trail
 * survives. Every outstanding calculation across the app skips
 * cancelled invoices (invoice-admin-status.ts + partner-revenue.ts).
 *
 * Usage:
 *   npx tsx scripts/backfill-cancel-ghost-invoices.ts          # inspect
 *   npx tsx scripts/backfill-cancel-ghost-invoices.ts --apply  # cancel
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const apply = process.argv.includes("--apply");

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: invoices, error } = await admin
    .from("invoices")
    .select("id, invoice_number, client_name, amount, status, move_id, square_invoice_id, created_at")
    .not("move_id", "is", null)
    .is("square_invoice_id", null)
    .not("status", "in", "(paid,cancelled,archived)");

  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  console.log(`candidate invoices (move-linked, non-Square, non-terminal): ${invoices?.length ?? 0}`);

  const moveIds = Array.from(new Set((invoices || []).map((i) => i.move_id).filter(Boolean)));
  if (moveIds.length === 0) {
    console.log("nothing to check");
    return;
  }

  const { data: moves } = await admin
    .from("moves")
    .select("id, move_code, client_name, organization_id, payment_marked_paid, is_pm_move")
    .in("id", moveIds);

  const moveById = new Map((moves || []).map((m) => [m.id, m]));

  const orgIds = Array.from(
    new Set((moves || []).map((m) => m.organization_id).filter(Boolean) as string[]),
  );
  const { data: orgs } = orgIds.length
    ? await admin.from("organizations").select("id, type").in("id", orgIds)
    : { data: [] as { id: string; type: string | null }[] };
  const orgTypeById = new Map((orgs || []).map((o) => [o.id, (o.type || "").toLowerCase()]));

  const toCancel: { id: string; reason: string; invoice_number: string; amount: number }[] = [];
  for (const inv of invoices || []) {
    const m = moveById.get(inv.move_id!);
    if (!m) continue;
    const orgType = m.organization_id ? orgTypeById.get(m.organization_id) : null;
    const isRetail = orgType === "b2c" || !m.organization_id;
    const isPaid = !!m.payment_marked_paid;
    if (m.is_pm_move) continue;
    if (!isRetail && !isPaid) continue;
    const reason = isPaid && isRetail
      ? "retail_paid"
      : isPaid
        ? "already_paid"
        : "retail_ghost";
    toCancel.push({
      id: inv.id,
      invoice_number: inv.invoice_number || inv.id,
      amount: Number(inv.amount || 0),
      reason,
    });
  }

  console.log(`to cancel: ${toCancel.length}`);
  toCancel.slice(0, 20).forEach((r) =>
    console.log(`  ${r.invoice_number}  $${r.amount}  ${r.reason}`),
  );
  if (toCancel.length > 20) console.log(`  ... and ${toCancel.length - 20} more`);
  const totalDollars = toCancel.reduce((s, r) => s + r.amount, 0);
  console.log(`total dollars removed from Outstanding: $${totalDollars.toLocaleString()}`);

  if (!apply) {
    console.log("\nDRY RUN. pass --apply to write.");
    return;
  }

  const ids = toCancel.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error: upErr } = await admin
      .from("invoices")
      .update({ status: "cancelled" })
      .in("id", chunk);
    if (upErr) {
      console.error("update chunk failed:", upErr.message);
      process.exit(1);
    }
    console.log(`cancelled ${Math.min(i + chunk.length, ids.length)}/${ids.length}`);
  }
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
