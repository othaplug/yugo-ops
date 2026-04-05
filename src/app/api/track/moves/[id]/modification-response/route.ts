import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { movePatchFromModificationChanges } from "@/lib/moves/move-modification-apply";

/** Client approves or declines a pending booking change (price increase) from the track link. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move id required" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    token?: string;
    modificationId?: string;
    action?: string;
  } | null;
  const token = String(body?.token || "").trim();
  const modificationId = String(body?.modificationId || "").trim();
  const actionRaw = String(body?.action || "").trim().toLowerCase();
  const action = actionRaw === "decline" || actionRaw === "approve" ? actionRaw : null;

  if (!token || !modificationId || !action) {
    return NextResponse.json({ error: "token, modificationId, and action required" }, { status: 400 });
  }
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: mod, error } = await sb
    .from("move_modifications")
    .select("id, move_id, status, changes, new_price, original_price")
    .eq("id", modificationId)
    .eq("move_id", moveId)
    .eq("status", "pending_approval")
    .maybeSingle();

  if (error || !mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "decline") {
    const { error: uErr } = await sb
      .from("move_modifications")
      .update({ status: "declined" })
      .eq("id", modificationId);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const originalPrice = Number(mod.original_price) || 0;
  const newPrice =
    mod.new_price != null && Number.isFinite(Number(mod.new_price))
      ? Number(mod.new_price)
      : originalPrice;
  const changes = (mod.changes && typeof mod.changes === "object"
    ? (mod.changes as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const patch = movePatchFromModificationChanges(changes, newPrice, originalPrice);
  if (Object.keys(patch).length > 0) {
    const { error: pErr } = await sb.from("moves").update(patch).eq("id", moveId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: finErr } = await sb
    .from("move_modifications")
    .update({ applied_at: now, approved_at: now })
    .eq("id", modificationId);
  if (finErr) return NextResponse.json({ error: finErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
