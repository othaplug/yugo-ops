import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: moveId } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("client_sign_offs")
    .select("id, signed_by, signed_at, all_items_received, condition_accepted, satisfaction_rating, would_recommend, feedback_note, exceptions")
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || null);
}
