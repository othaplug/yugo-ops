import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { userId, error } = await requirePartner();
  if (error) return error;

  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ notifications: notifications ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { userId, error } = await requirePartner();
  if (error) return error;

  const body = await req.json();
  const db = createAdminClient();

  if (body.all) {
    const { error: updateErr } = await db
      .from("in_app_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId!)
      .eq("is_read", false);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const { error: updateErr } = await db
      .from("in_app_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("user_id", userId!);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });
}
