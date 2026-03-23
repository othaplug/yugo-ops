import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** POST /api/admin/quotes/bulk — Bulk actions for quotes (resend, expire) */
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

  const validActions = ["resend", "expire"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "resend") {
    const { error } = await admin
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "expire") {
    const { error } = await admin
      .from("quotes")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
