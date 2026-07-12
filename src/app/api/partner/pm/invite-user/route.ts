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

// Roles a partner may assign to a teammate they invite. The field is stored on
// the invitee's user_metadata; keeping it to an allowlist stops a partner from
// writing an arbitrary/elevated role string into an auth account.
const ALLOWED_PARTNER_ROLES = new Set([
  "property_manager",
  "manager",
  "viewer",
  "billing",
]);

// Look an auth user up by email across all pages. listUsers() only returns the
// first page (default 50), so a naive check silently misses existing accounts
// past the first page — then createUser fails and, worse, an existing user in
// another org could be handled inconsistently. Cap the scan defensively.
async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) break;
  }
  return null;
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
  const roleRaw = typeof body.role === "string" ? body.role.trim() : "";
  const role = ALLOWED_PARTNER_ROLES.has(roleRaw) ? roleRaw : "property_manager";

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

  let existing;
  try {
    existing = await findAuthUserByEmail(admin, emailRaw);
  } catch (err) {
    console.error("[pm invite] user lookup failed", err);
    return NextResponse.json({ error: "Could not verify the email. Try again." }, { status: 500 });
  }

  const loginUrl = `${getEmailBaseUrl()}/partner/login?welcome=1`;
  const resend = getResend();
  const emailFrom = await getEmailFrom();

  const roleMeta = { partner_portal_role: role };

  if (existing) {
    // Never let a partner graft a Yugo staff/operator account into their org or
    // touch its metadata. Any platform_users row means this is an internal
    // account — refuse without leaking whether the address exists.
    const { data: staffRow } = await admin
      .from("platform_users")
      .select("user_id")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (staffRow) {
      return NextResponse.json(
        { error: "That email can't be added here. Contact your Yugo representative." },
        { status: 400 },
      );
    }

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
    // Only stamp the portal role if the account doesn't already have one, so we
    // never silently change an existing partner user's role. Preserve the rest
    // of their metadata.
    const existingMeta = (existing.user_metadata ?? {}) as Record<string, unknown>;
    if (!existingMeta.partner_portal_role) {
      await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...existingMeta, ...roleMeta },
      });
    }

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
