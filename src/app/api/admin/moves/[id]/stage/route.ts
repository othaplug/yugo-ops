import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** GET move stage/status for live polling. Staff only. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error: fetchErr } = await admin
    .from("moves")
    .select("stage, status, updated_at")
    .eq("id", id)
    .single();

  if (fetchErr || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
