import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * GET    → the snapshot for one draft (resume, incl. cross-device)
 * DELETE → remove one draft (on generate / explicit clear)
 *
 * Scoped to the requesting operator so one operator can't read/delete another's
 * in-progress draft. Best-effort: missing table degrades to 404 / ok.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const email = user!.email ?? "";
  const { id } = await params;

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("quote_drafts")
    .select("id, form_type, title, path, snapshot, updated_at")
    .eq("id", id)
    .eq("operator_email", email)
    .maybeSingle();

  if (dbErr || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: data.id,
    formType: data.form_type,
    title: data.title,
    path: data.path,
    snapshot: data.snapshot ?? {},
    updatedAt: data.updated_at,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const email = user!.email ?? "";
  const { id } = await params;

  const admin = createAdminClient();
  await admin
    .from("quote_drafts")
    .delete()
    .eq("id", id)
    .eq("operator_email", email);

  return NextResponse.json({ ok: true });
}
