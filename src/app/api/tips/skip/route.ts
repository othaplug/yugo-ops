import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isFeatureEnabled } from "@/lib/platform-settings";

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("tipping_enabled"))) {
    return NextResponse.json({ error: "Tipping is currently disabled" }, { status: 403 });
  }
  let body: { moveId?: string; token?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { moveId, token, action } = body;
  if (!moveId || !token) {
    return NextResponse.json({ error: "Missing moveId or token" }, { status: 400 });
  }

  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === "prompt_shown") {
    await admin.from("moves").update({ tip_prompt_shown_at: now }).eq("id", moveId);
  } else {
    await admin.from("moves").update({ tip_skipped_at: now }).eq("id", moveId);
  }

  return NextResponse.json({ ok: true });
}
