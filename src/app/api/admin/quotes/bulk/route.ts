import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";

/** POST /api/admin/quotes/bulk — Bulk actions for quotes (resend, expire, delete) */
export async function POST(req: NextRequest) {
  const { admin: adminUser, error: authError } = await requireAdmin();
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

  const validActions = ["resend", "expire", "delete"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const isSuperAdmin = adminUser?.isSuperAdmin === true;

  if (action === "resend") {
    const { error } = await admin
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "expire") {
    const { data: expRows } = await admin.from("quotes").select("hubspot_deal_id").in("id", ids);
    const { error } = await admin
      .from("quotes")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of expRows ?? []) {
      const hid = (r as { hubspot_deal_id?: string | null }).hubspot_deal_id;
      if (hid) syncDealStage(hid, "expired").catch(() => {});
    }
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "delete") {
    const uniqueIds = [...new Set(ids.map(String))];
    const { data: rows, error: fetchErr } = await admin
      .from("quotes")
      .select("id, status")
      .in("id", uniqueIds);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const quoteRows = rows ?? [];
    const candidateIds = quoteRows.map((r) => r.id as string);
    const linkedMoveIds = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: moveRows } = await admin.from("moves").select("quote_id").in("quote_id", candidateIds);
      for (const m of moveRows ?? []) {
        const qid = m.quote_id as string | null;
        if (qid) linkedMoveIds.add(qid);
      }
    }

    const toDelete: string[] = [];
    for (const r of quoteRows) {
      const qid = r.id as string;
      const st = (r.status as string) || "";
      if (linkedMoveIds.has(qid)) continue;
      if (!quoteStatusAllowsHardDelete(st, isSuperAdmin)) continue;
      toDelete.push(qid);
    }

    if (toDelete.length === 0) {
      return NextResponse.json({
        ok: true,
        deleted: 0,
        skipped: uniqueIds.length,
        error:
          "No quotes were deleted. Drafts are deletable by all admins; sent/viewed/expired/declined require superadmin. Accepted quotes and quotes with a linked move are never deleted.",
      });
    }

    const { error: deleteErr } = await admin.from("quotes").delete().in("id", toDelete);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message || "Failed to delete quotes" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deleted: toDelete.length,
      skipped: uniqueIds.length - toDelete.length,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
