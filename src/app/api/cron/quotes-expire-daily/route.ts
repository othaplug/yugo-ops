import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Marks quotes as expired when past expires_at (idempotent updates).
 * Vercel Cron — schedule after quote follow-ups if needed.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("quotes")
    .select("id, quote_id")
    .in("status", ["sent", "viewed", "reactivated"])
    .lt("expires_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (rows || []).map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const { error: upErr } = await admin
    .from("quotes")
    .update({ status: "expired", updated_at: now })
    .in("id", ids);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ updated: ids.length });
}
