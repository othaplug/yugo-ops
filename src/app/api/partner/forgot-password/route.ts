import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { partnerPasswordResetEmail, partnerPasswordResetEmailText } from "@/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";

/** Generate a random temporary password (alphanumeric, 12 chars). */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) s += chars[bytes[i]! % chars.length];
  return s;
}

/**
 * Partner portal self-serve forgot password.
 * Sends the OPS+ custom password reset email (same as admin-initiated reset) instead of Supabase's default.
 * Always returns 200 with a generic message to avoid revealing whether the email is registered.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`partner-forgot:${ip}`, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: true, message: "If that email is on file, we've sent a password reset." },
      { status: 200 }
    );
  }

  let email: string;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const admin = createAdminClient();

  try {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authUser = users?.find((u) => u.email?.toLowerCase() === email);
    if (!authUser) {
      return NextResponse.json(
        { ok: true, message: "If that email is on file, we've sent a password reset." },
        { status: 200 }
      );
    }

    const { data: link } = await admin
      .from("partner_users")
      .select("org_id")
      .eq("user_id", authUser.id)
      .limit(1)
      .maybeSingle();
    if (!link?.org_id) {
      return NextResponse.json(
        { ok: true, message: "If that email is on file, we've sent a password reset." },
        { status: 200 }
      );
    }

    const { data: org } = await admin.from("organizations").select("id, name").eq("id", link.org_id).single();
    if (!org) {
      return NextResponse.json(
        { ok: true, message: "If that email is on file, we've sent a password reset." },
        { status: 200 }
      );
    }

    const tempPassword = generateTempPassword();
    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
      password: tempPassword,
      user_metadata: { ...authUser.user_metadata, must_change_password: true },
    });
    if (updateError) {
      console.error("[partner/forgot-password] updateUserById:", updateError.message);
      return NextResponse.json(
        { ok: true, message: "If that email is on file, we've sent a password reset." },
        { status: 200 }
      );
    }

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/partner/login`;
    const name = (authUser.user_metadata?.full_name as string) || email.split("@")[0] || "";
    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "YUGO <notifications@opsplus.co>",
      to: email,
      subject: "Your YUGO Partner Portal password has been reset",
      html: partnerPasswordResetEmail({
        contactName: name,
        companyName: org.name,
        email,
        tempPassword,
        loginUrl,
      }),
      text: partnerPasswordResetEmailText({
        contactName: name,
        companyName: org.name,
        email,
        tempPassword,
        loginUrl,
      }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
    if (sendError) {
      console.error("[partner/forgot-password] send email:", sendError.message);
    }
  } catch (err) {
    console.error("[partner/forgot-password]", err);
  }

  return NextResponse.json(
    { ok: true, message: "If that email is on file, we've sent a password reset." },
    { status: 200 }
  );
}
