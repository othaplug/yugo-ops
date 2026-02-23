import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** PATCH: Approve or reject an extra item */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  const { id, itemId } = await params;
  const body = await req.json();
  const status = body.status === "rejected" ? "rejected" : "approved";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("extra_items")
    .update({ status })
    .eq("id", itemId)
    .eq("job_id", id)
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
