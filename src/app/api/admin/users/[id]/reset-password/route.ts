import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    if (id.startsWith("inv-") || id.startsWith("partner-")) {
      return NextResponse.json({ error: "Use Resend Invite for pending; manage partners from Clients" }, { status: 400 });
    }
    const body = await req.json();
    const password = typeof body.password === "string" ? body.password : "";

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, {
      password,
      user_metadata: { must_change_password: true },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
