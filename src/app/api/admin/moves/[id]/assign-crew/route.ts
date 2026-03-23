import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;
  const body = (await req.json()) as { crew_id: string };

  if (!body.crew_id) {
    return NextResponse.json({ error: "crew_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("moves")
    .update({ crew_id: body.crew_id, status: "scheduled" })
    .eq("id", moveId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
