import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";
import { requireAdmin } from "@/lib/api-auth";
import { VERTICAL_LABELS } from "@/lib/partner-type";
import { getEmailFrom } from "@/lib/email/send";

async function resolveTemplateId(admin: ReturnType<typeof createAdminClient>, templateSlug: string | null): Promise<string | null> {
  if (!templateSlug) return null;
  const { data } = await admin
    .from("rate_card_templates")
    .select("id")
    .eq("template_slug", templateSlug)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const { type, name, contact_name, email, phone, password, template_slug } = await req.json();

    if (!email || typeof email !== "string" || !name || typeof name !== "string") {
      return NextResponse.json({ error: "Company name and email are required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const nameTrimmed = (name || "").trim();
    const contactNameTrimmed = (contact_name || "").trim();
    const phoneTrimmed = (phone || "").trim();
    const typeVal = type || "furniture_retailer";
    const typeLabel = VERTICAL_LABELS[String(typeVal)] || typeVal;

    const admin = createAdminClient();

    const templateId = await resolveTemplateId(admin, template_slug || null);

    // If email is already linked to a user, do not add again — return error
    const { data: existingAuthUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingAuthUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    // Check if org with this email already exists (invited partner)
    const { data: existingOrg } = await admin
      .from("organizations")
      .select("id, user_id")
      .eq("email", emailTrimmed)
      .limit(1)
      .maybeSingle();

    let orgId: string;
    let userId: string;

    const orgFields = {
      name: nameTrimmed,
      type: typeVal,
      contact_name: contactNameTrimmed,
      email: emailTrimmed,
      phone: phoneTrimmed,
      ...(templateId ? { template_id: templateId } : {}),
    };

    if (existingOrg?.user_id) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    } else if (existingOrg) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: emailTrimmed,
        password,
        email_confirm: true,
        user_metadata: { full_name: contactNameTrimmed || nameTrimmed, must_change_password: true },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      userId = newUser.user.id;
      orgId = existingOrg.id;
      await admin
        .from("organizations")
        .update({ user_id: userId, ...orgFields })
        .eq("id", orgId);

      await admin.from("partner_users").upsert(
        { user_id: userId, org_id: orgId },
        { onConflict: "user_id" }
      );
    } else {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: emailTrimmed,
        password,
        email_confirm: true,
        user_metadata: { full_name: contactNameTrimmed || nameTrimmed, must_change_password: true },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      userId = newUser.user.id;

      const { data: newOrg, error: orgError } = await admin
        .from("organizations")
        .insert({
          ...orgFields,
          health: "good",
          user_id: userId,
        })
        .select("id")
        .single();

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 400 });
      }
      orgId = newOrg!.id;

      await admin.from("partner_users").insert({ user_id: userId, org_id: orgId });
    }

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/partner/login?welcome=1`;

    const inviteParams = { contactName: contactNameTrimmed, companyName: nameTrimmed, email: emailTrimmed, typeLabel, tempPassword: password, loginUrl };
    const resend = getResend();
    const emailFrom = await getEmailFrom();
    const { error: sendError } = await resend.emails.send({
      from: emailFrom,
      to: emailTrimmed,
      replyTo: emailFrom,
      subject: "You're invited to YUGO+ — Log in to continue setup",
      html: invitePartnerEmail(inviteParams),
      text: invitePartnerEmailText(inviteParams),
      headers: {
        "Precedence": "auto",
        "X-Auto-Response-Suppress": "All",
      },
    });

    if (sendError) {
      return NextResponse.json({ error: sendError.message || "Failed to send invitation email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Partner added and invitation sent" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send invitation" },
      { status: 500 }
    );
  }
}
