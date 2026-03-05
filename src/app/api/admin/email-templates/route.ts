import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET() {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("email_templates")
    .select("*")
    .order("template_slug");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const { id, subject, body_html, is_active } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user!.id };
  if (subject !== undefined) updates.subject = subject;
  if (body_html !== undefined) updates.body_html = body_html;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await sb
    .from("email_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
