import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** GET: Count of pending change requests (admin). Shows dot for client-submitted requests. */
export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const admin = createAdminClient();

    // Prefer: only client-submitted (submitted_by column added in migration 20250253000000)
    let result = await admin
      .from("move_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("submitted_by", "client");

    // Fallback: if submitted_by column doesn't exist yet, count all pending
    if (result.error) {
      result = await admin
        .from("move_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
    }

    if (result.error) {
      console.error("[pending-count] Supabase error:", result.error.message, result.error);
      return NextResponse.json({ count: 0 });
    }
    return NextResponse.json({ count: result.count ?? 0 });
  } catch (err) {
    console.error("[pending-count] Unexpected error:", err);
    return NextResponse.json({ count: 0 });
  }
}
