import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 2FA trust cookie: survives tab closes / new tabs for this many hours
const TRUST_HOURS = 8;
export const TWO_FA_TRUST_COOKIE = "yugo-2fa-trust";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const codeStr = typeof code === "string" ? code.trim() : "";
    if (!codeStr) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("email_verification_codes")
      .select("id, code")
      .eq("user_id", user.id)
      .eq("purpose", "2fa")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.code) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    const expected = row.code;
    if (expected.length !== codeStr.length) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    try {
      if (!timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(codeStr, "utf8"))) {
        return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await admin.from("email_verification_codes").delete().eq("id", row.id);

    // Set a secure trust cookie so the admin doesn't re-verify on every new tab/refresh
    const res = NextResponse.json({ ok: true });
    res.cookies.set(TWO_FA_TRUST_COOKIE, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TRUST_HOURS * 3600,
      path: "/",
    });
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify" },
      { status: 500 }
    );
  }
}
