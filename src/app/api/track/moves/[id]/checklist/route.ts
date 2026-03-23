import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { token, item, checked } = await req.json();

  if (!token || !item) {
    return NextResponse.json({ error: "Missing token or item" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify token
  const { data: move } = await supabase
    .from("moves")
    .select("id, pre_move_checklist")
    .eq("id", id)
    .single();

  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!verifyTrackToken("move", move.id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = (move.pre_move_checklist as Record<string, boolean>) || {};
  const updated = { ...current, [item]: Boolean(checked) };

  await supabase
    .from("moves")
    .update({ pre_move_checklist: updated })
    .eq("id", id);

  return NextResponse.json({ ok: true, checklist: updated });
}
