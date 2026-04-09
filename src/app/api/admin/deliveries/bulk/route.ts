import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { syncDealStageByDeliveryId } from "@/lib/hubspot/sync-deal-stage";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";

/** POST /api/admin/deliveries/bulk — Bulk status updates for deliveries */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  let body: { action: string; ids: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, ids } = body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "action and ids[] required" }, { status: 400 });
  }

  const validActions = ["deliver", "cancel", "delete"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === "deliver") {
    const { error } = await admin
      .from("deliveries")
      .update({ status: "delivered", completed_at: now, updated_at: now })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const id of ids) {
      syncDealStageByDeliveryId(id, "delivered").catch(() => {});
      notifyJobCompletedForCrewProfiles(admin, { jobType: "delivery", jobId: id }).catch((e) =>
        console.error("[crew-profile] admin bulk deliver:", e),
      );
    }
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "cancel") {
    const { error } = await admin
      .from("deliveries")
      .update({ status: "cancelled", updated_at: now })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const id of ids) {
      syncDealStageByDeliveryId(id, "cancelled").catch(() => {});
    }
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "delete") {
    const { data: rows } = await admin.from("deliveries").select("id, status").in("id", ids);
    const byId = new Map((rows || []).map((r) => [r.id as string, r]));
    const allowedIds = ids.filter((id) => {
      const row = byId.get(id);
      if (!row) return false;
      const s = ((row.status as string) || "").toLowerCase();
      return s !== "delivered" && s !== "completed";
    });
    if (allowedIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "No deliveries can be deleted. Completed deliveries cannot be removed, or the selected rows were not found.",
        },
        { status: 400 },
      );
    }
    await admin.from("proof_of_delivery").delete().in("delivery_id", allowedIds);
    await admin.from("invoices").update({ delivery_id: null }).in("delivery_id", allowedIds);
    const { error: delErr } = await admin.from("deliveries").delete().in("id", allowedIds);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      deleted: allowedIds.length,
      skipped: ids.length - allowedIds.length,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
