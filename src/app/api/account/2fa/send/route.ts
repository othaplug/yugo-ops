import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { verificationCodeEmail } from "@/lib/email-templates";

function generateCode(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => (n % 10).toString()).join("");
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("user_id, two_factor_enabled")
      .eq("user_id", user.id)
      .single();
    if (!platformUser) return NextResponse.json({ error: "Platform users only" }, { status: 403 });

    const code = generateCode();
    const admin = createAdminClient();
    await admin.from("email_verification_codes").insert({
      user_id: user.id,
      code,
      purpose: "2fa",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    const resend = getResend();
    await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: user.email,
      subject: "Your OPS+ login code",
      html: verificationCodeEmail({ code, purpose: "2fa" }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });

    return NextResponse.json({ ok: true, message: "Code sent to your email" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send code" },
      { status: 500 }
    );
  }
}
