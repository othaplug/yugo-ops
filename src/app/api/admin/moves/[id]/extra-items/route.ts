import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** GET: List extra items for a move (including pending) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("extra_items")
    .select("id, description, room, quantity, added_at, status, requested_by")
    .eq("job_id", id)
    .eq("job_type", "move")
    .order("added_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
