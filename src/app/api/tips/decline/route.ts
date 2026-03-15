import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isFeatureEnabled } from "@/lib/platform-settings";
import { isMoveIdUuid } from "@/lib/move-code";

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("tipping_enabled"))) {
    return NextResponse.json({ ok: true });
  }

  let body: { moveId?: string; slug?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { moveId, slug: urlSlug, token } = body;
  if ((!moveId && !urlSlug) || !token) {
    return NextResponse.json({ error: "Missing moveId or token" }, { status: 400 });
  }

  const admin = createAdminClient();
  let resolvedMoveId: string | null = null;

  if (moveId?.trim() && isMoveIdUuid(moveId.trim())) {
    const { data } = await admin.from("moves").select("id").eq("id", moveId.trim()).maybeSingle();
    if (data) resolvedMoveId = data.id;
  }
  if (!resolvedMoveId && (moveId?.trim() || urlSlug?.trim())) {
    const code = String(moveId || urlSlug || "").replace(/^#/, "").trim().toUpperCase();
    if (code && !isMoveIdUuid(code)) {
      const { data } = await admin.from("moves").select("id").ilike("move_code", code).maybeSingle();
      if (data) resolvedMoveId = data.id;
    }
  }

  if (!resolvedMoveId) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }
  if (!verifyTrackToken("move", resolvedMoveId, token)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  await admin
    .from("moves")
    .update({ tip_skipped_at: new Date().toISOString() })
    .eq("id", resolvedMoveId);

  return NextResponse.json({ ok: true });
}
