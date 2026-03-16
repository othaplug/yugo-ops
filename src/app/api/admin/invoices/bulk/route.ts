import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** POST /api/admin/invoices/bulk — Archive, cancel, or delete selected invoices */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  let body: { action: string; ids: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, ids } = body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "action and ids[] required" }, { status: 400 });
  }

  const validActions = ["archive", "cancel", "delete", "mark_paid"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "action must be archive, cancel, delete, or mark_paid" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "delete") {
    const { error } = await admin.from("invoices").delete().in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "archive") {
    const { error } = await admin
      .from("invoices")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "cancel") {
    const { error } = await admin
      .from("invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "mark_paid") {
    const { error } = await admin
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
