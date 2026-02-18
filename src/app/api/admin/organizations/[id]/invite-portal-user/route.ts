import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const { id: orgId } = await params;
    const { email, name, password } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const adminEmail = (adminUser?.email ?? "").trim().toLowerCase();
    if (adminEmail && emailTrimmed === adminEmail) {
      return NextResponse.json(
        { error: "For security, you cannot invite your own email as a partner." },
        { status: 403 }
      );
    }
    const nameTrimmed = (name || "").trim();
    const admin = createAdminClient();

    const { data: org } = await admin.from("organizations").select("id, name, type").eq("id", orgId).single();
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (org.type === "b2c") return NextResponse.json({ error: "Cannot add portal users to move clients" }, { status: 400 });

    const typeLabels: Record<string, string> = { retail: "Retail", designer: "Designer", hospitality: "Hospitality", gallery: "Gallery", realtor: "Realtor" };
    const typeLabel = typeLabels[org.type] || org.type;

    const { data: { users } } = await admin.auth.admin.listUsers();
    const existing = users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
    if (existing) return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true,
      user_metadata: { full_name: nameTrimmed, must_change_password: true },
    });
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    await admin.from("partner_users").insert({ user_id: newUser.user.id, org_id: orgId });

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/login?welcome=1`;
    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: emailTrimmed,
      subject: "You're invited to OPS+ Partner Portal",
      html: invitePartnerEmail({
        contactName: nameTrimmed,
        companyName: org.name,
        email: emailTrimmed,
        typeLabel,
        tempPassword: password,
        loginUrl,
      }),
      text: invitePartnerEmailText({
        contactName: nameTrimmed,
        companyName: org.name,
        email: emailTrimmed,
        typeLabel,
        tempPassword: password,
        loginUrl,
      }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
    if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to invite" },
      { status: 500 }
    );
  }
}
