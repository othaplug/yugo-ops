import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  repairJobCompletionFromEvidence,
  runDeliveryCompletionFollowUp,
  runMoveCompletionFollowUp,
} from "@/lib/moves/complete-move-job";

/**
 * Repairs moves/deliveries that have PoD or client sign-off but a non-terminal job row.
 * Runs often so dispatch and dashboards converge without waiting for user actions.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: podRows, error: podErr } = await admin
    .from("proof_of_delivery")
    .select("move_id, delivery_id")
    .order("created_at", { ascending: false })
    .limit(800);

  if (podErr) {
    return NextResponse.json({ error: podErr.message }, { status: 500 });
  }

  const { data: signRows, error: signErr } = await admin
    .from("client_sign_offs")
    .select("job_id, job_type")
    .order("signed_at", { ascending: false })
    .limit(250);

  if (signErr) {
    return NextResponse.json({ error: signErr.message }, { status: 500 });
  }

  const { data: skipRows, error: skipErr } = await admin
    .from("signoff_skips")
    .select("job_id, job_type")
    .order("created_at", { ascending: false })
    .limit(200);

  if (skipErr) {
    return NextResponse.json({ error: skipErr.message }, { status: 500 });
  }

  const moveIds = new Set<string>();
  const deliveryIds = new Set<string>();
  for (const r of podRows || []) {
    if (r.move_id) moveIds.add(r.move_id as string);
    if (r.delivery_id) deliveryIds.add(r.delivery_id as string);
  }
  for (const r of signRows || []) {
    if (r.job_type === "move" && r.job_id) moveIds.add(r.job_id as string);
    if (r.job_type === "delivery" && r.job_id) deliveryIds.add(r.job_id as string);
  }
  for (const r of skipRows || []) {
    if (r.job_type === "move" && r.job_id) moveIds.add(String(r.job_id));
    if (r.job_type === "delivery" && r.job_id) deliveryIds.add(String(r.job_id));
  }

  const results = {
    movesChecked: 0,
    movesRepaired: 0,
    deliveriesChecked: 0,
    deliveriesRepaired: 0,
    errors: [] as string[],
  };

  for (const moveId of moveIds) {
    results.movesChecked++;
    const r = await repairJobCompletionFromEvidence(admin, moveId, "move");
    if (!r.ok) results.errors.push(`move ${moveId}: ${r.error || "fail"}`);
    else if (r.transitioned) {
      results.movesRepaired++;
      await runMoveCompletionFollowUp(admin, moveId, { source: "repair_cron" });
    }
  }

  for (const deliveryId of deliveryIds) {
    results.deliveriesChecked++;
    const r = await repairJobCompletionFromEvidence(admin, deliveryId, "delivery");
    if (!r.ok) results.errors.push(`delivery ${deliveryId}: ${r.error || "fail"}`);
    else if (r.transitioned) {
      results.deliveriesRepaired++;
      await runDeliveryCompletionFollowUp(admin, deliveryId);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
