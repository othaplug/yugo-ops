import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { getResend } from "@/lib/resend";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { send_emails = true, dry_run = false } = await req.json().catch(() => ({}));
    const admin = createAdminClient();

    // Get all non-b2c orgs that have an email
    const { data: orgs, error: orgsError } = await admin
      .from("organizations")
      .select("id, name, type, email, contact_name")
      .neq("type", "b2c")
      .not("email", "is", null)
      .neq("email", "");

    if (orgsError) return NextResponse.json({ error: orgsError.message }, { status: 500 });

    // Get all existing partner_users org_ids
    const { data: existingLinks } = await admin
      .from("partner_users")
      .select("org_id");

    const linkedOrgIds = new Set((existingLinks ?? []).map((r) => r.org_id));

    // Find orgs with no portal access
    const unprovisioned = (orgs ?? []).filter((o) => !linkedOrgIds.has(o.id));

    if (dry_run) {
      return NextResponse.json({
        dry_run: true,
        total_partners: orgs?.length ?? 0,
        already_provisioned: (orgs?.length ?? 0) - unprovisioned.length,
        to_provision: unprovisioned.length,
        partners: unprovisioned.map((o) => ({ id: o.id, name: o.name, email: o.email, contact_name: o.contact_name })),
      });
    }

    const { data: { users: authUsers } } = await admin.auth.admin.listUsers();
    const authByEmail = new Map((authUsers ?? []).map((u) => [u.email?.toLowerCase() ?? "", u]));

    const resend = send_emails ? getResend() : null;
    const emailFrom = send_emails ? await getEmailFrom() : null;
    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/partner/login?welcome=1`;

    const results: { name: string; email: string; status: string; error?: string }[] = [];

    for (const org of unprovisioned) {
      const emailTrimmed = (org.email as string).trim().toLowerCase();
      const contactName = (org.contact_name || org.name || "").trim();
      const tempPassword = generateTempPassword();

      try {
        let userId: string;
        const existing = authByEmail.get(emailTrimmed);

        if (existing) {
          // Auth user already exists — just link them (don't change their password)
          userId = existing.id;
          // Update full_name in metadata if missing
          if (!existing.user_metadata?.full_name && contactName) {
            await admin.auth.admin.updateUserById(userId, {
              user_metadata: { ...existing.user_metadata, full_name: contactName },
            });
          }
        } else {
          // Create new auth user
          const { data: newUser, error: createError } = await admin.auth.admin.createUser({
            email: emailTrimmed,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: contactName, must_change_password: true },
          });
          if (createError) {
            results.push({ name: org.name, email: emailTrimmed, status: "error", error: createError.message });
            continue;
          }
          userId = newUser.user.id;
        }

        // Link to org
        await admin.from("partner_users").upsert(
          { user_id: userId, org_id: org.id },
          { onConflict: "user_id,org_id" }
        );

        // Also ensure organizations.user_id is set
        await admin.from("organizations").update({ user_id: userId }).eq("id", org.id);

        // Send invite email (only for newly created auth users)
        if (send_emails && resend && emailFrom && !existing) {
          await resend.emails.send({
            from: emailFrom,
            to: emailTrimmed,
            subject: `You're invited to Yugo — ${org.name}`,
            html: invitePartnerEmail({ contactName, companyName: org.name, email: emailTrimmed, typeLabel: org.type, tempPassword, loginUrl }),
            text: invitePartnerEmailText({ contactName, companyName: org.name, email: emailTrimmed, typeLabel: org.type, tempPassword, loginUrl }),
            headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
          });
        }

        results.push({ name: org.name, email: emailTrimmed, status: existing ? "linked_existing" : "created_and_invited" });
      } catch (err) {
        results.push({ name: org.name, email: emailTrimmed, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    const provisioned = results.filter((r) => r.status !== "error").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ ok: true, provisioned, errors, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to provision" },
      { status: 500 }
    );
  }
}
