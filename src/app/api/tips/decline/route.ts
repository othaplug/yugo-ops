import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isFeatureEnabled } from "@/lib/platform-settings";

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("tipping_enabled"))) {
    return NextResponse.json({ ok: true });
  }

  let body: { moveId?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { moveId, token } = body;
  if (!moveId || !token) {
    return NextResponse.json({ error: "Missing moveId or token" }, { status: 400 });
  }

  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin
    .from("moves")
    .update({ tip_skipped_at: new Date().toISOString() })
    .eq("id", moveId);

  return NextResponse.json({ ok: true });
}
