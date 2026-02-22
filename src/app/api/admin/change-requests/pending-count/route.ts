import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** GET: Count of pending change requests (admin). */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();
  const { count, error: countErr } = await admin
    .from("move_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("submitted_by", "client");

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}
