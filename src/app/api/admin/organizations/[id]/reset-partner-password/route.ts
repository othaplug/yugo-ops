import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { partnerPasswordResetEmail, partnerPasswordResetEmailText } from "@/lib/email-templates";

/**
 * Set a new temporary password for a partner portal user and email it to them.
 * Use when a partner forgets their password; admin sets a new temp password and the partner receives it by email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const { id: orgId } = await params;
    const { user_id, new_password } = await req.json();

    if (!user_id || typeof user_id !== "string") {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }
    if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
      return NextResponse.json({ error: "new_password must be at least 8 characters" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: link } = await admin
      .from("partner_users")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", user_id)
      .single();
    if (!link) {
      return NextResponse.json({ error: "User is not a portal user for this organization" }, { status: 404 });
    }

    const { data: org } = await admin.from("organizations").select("id, name").eq("id", orgId).single();
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const { data: authUser, error: getUserError } = await admin.auth.admin.getUserById(user_id);
    if (getUserError || !authUser?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const email = authUser.user.email ?? "";

    const adminEmail = (adminUser?.email ?? "").trim().toLowerCase();
    if (adminEmail && email.trim().toLowerCase() === adminEmail) {
      return NextResponse.json(
        { error: "For security, password reset cannot be sent to the same email as the requesting admin." },
        { status: 403 }
      );
    }
    const name = (authUser.user.user_metadata?.full_name as string) || email.split("@")[0] || "";

    const { error: updateError } = await admin.auth.admin.updateUserById(user_id, {
      password: new_password,
      user_metadata: { ...authUser.user.user_metadata, must_change_password: true },
    });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/login`;
    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: email,
      subject: "Your OPS+ Partner Portal password has been reset",
      html: partnerPasswordResetEmail({
        contactName: name,
        companyName: org.name,
        email,
        tempPassword: new_password,
        loginUrl,
      }),
      text: partnerPasswordResetEmailText({
        contactName: name,
        companyName: org.name,
        email,
        tempPassword: new_password,
        loginUrl,
      }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
    if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reset password" },
      { status: 500 }
    );
  }
}
