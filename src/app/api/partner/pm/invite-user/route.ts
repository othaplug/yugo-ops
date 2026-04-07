import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import {
  invitePartnerEmail,
  invitePartnerEmailText,
  addedToPartnerEmail,
  addedToPartnerEmailText,
} from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

function tempPassword(): string {
  const base = randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  return `${base.slice(0, 10)}Aa1`;
}

/** PM partner self-service: invite a teammate to the same org portal (same flow as admin invite). */
export async function POST(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;

  let body: { email?: string; name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nameTrimmed = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "property_manager";

  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!nameTrimmed) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("id, name, type").eq("id", orgId).single();
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const typeLabels: Record<string, string> = {
    retail: "Retail",
    designer: "Designer",
    hospitality: "Hospitality",
    gallery: "Gallery",
    realtor: "Realtor",
    property_management: "Property management",
  };
  const typeLabel = typeLabels[String(org.type)] || String(org.type || "Partner");

  const { data: { users } } = await admin.auth.admin.listUsers();
  const existing = users?.find((u) => u.email?.toLowerCase() === emailRaw);

  const loginUrl = `${getEmailBaseUrl()}/partner/login?welcome=1`;
  const resend = getResend();
  const emailFrom = await getEmailFrom();

  const roleMeta = { partner_portal_role: role };

  if (existing) {
    const { data: existingLink } = await admin
      .from("partner_users")
      .select("user_id")
      .eq("user_id", existing.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (existingLink) {
      return NextResponse.json({ error: "This user already has portal access for your organization." }, { status: 400 });
    }
    await admin.from("partner_users").upsert({ user_id: existing.id, org_id: orgId }, { onConflict: "user_id,org_id" });
    await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...(existing.user_metadata as object), ...roleMeta },
    });

    const { error: sendError } = await resend.emails.send({
      from: emailFrom,
      to: emailRaw,
      subject: `You've been added to ${org.name} on Yugo Partner Portal`,
      html: addedToPartnerEmail({ contactName: nameTrimmed, companyName: org.name, loginUrl }),
      text: addedToPartnerEmailText({ contactName: nameTrimmed, companyName: org.name, loginUrl }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
    if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const password = tempPassword();
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: emailRaw,
    password,
    email_confirm: true,
    user_metadata: { full_name: nameTrimmed, must_change_password: true, ...roleMeta },
  });
  if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

  await admin.from("partner_users").upsert({ user_id: newUser.user.id, org_id: orgId }, { onConflict: "user_id,org_id" });

  const { error: sendError } = await resend.emails.send({
    from: emailFrom,
    to: emailRaw,
    subject: "You're invited to Yugo Partner Portal",
    html: invitePartnerEmail({
      contactName: nameTrimmed,
      companyName: org.name,
      email: emailRaw,
      typeLabel,
      tempPassword: password,
      loginUrl,
    }),
    text: invitePartnerEmailText({
      contactName: nameTrimmed,
      companyName: org.name,
      email: emailRaw,
      typeLabel,
      tempPassword: password,
      loginUrl,
    }),
    headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
  });
  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
