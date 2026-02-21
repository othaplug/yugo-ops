import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const rateLimitKey = `reset-pw:${adminUser?.id ?? req.headers.get("x-forwarded-for") ?? "anon"}`;
  if (!checkRateLimit(rateLimitKey, 60_000, 10)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  try {
    const { id } = await params;
    if (id.startsWith("inv-") || id.startsWith("partner-")) {
      return NextResponse.json({ error: "Use Resend Invite for pending; manage partners from Clients" }, { status: 400 });
    }
    if (adminUser?.id && id === adminUser.id) {
      return NextResponse.json(
        { error: "Use Settings to change your own password." },
        { status: 403 }
      );
    }
    const body = await req.json();
    const password = typeof body.password === "string" ? body.password : "";

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: targetUser } = await admin.auth.admin.getUserById(id);
    const targetEmail = (targetUser?.user?.email ?? "").trim().toLowerCase();
    const adminEmail = (adminUser?.email ?? "").trim().toLowerCase();
    if (adminEmail && targetEmail && targetEmail === adminEmail) {
      return NextResponse.json(
        { error: "For security, you cannot reset password for an account with your own email." },
        { status: 403 }
      );
    }
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
