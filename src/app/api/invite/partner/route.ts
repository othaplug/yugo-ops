import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const { type, name, contact_name, email, phone, password } = await req.json();

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
    const typeVal = type || "retail";
    const typeLabels: Record<string, string> = { retail: "Retail", designer: "Designer", hospitality: "Hospitality", gallery: "Gallery", realtor: "Realtor" };
    const typeLabel = typeLabels[String(typeVal)] || typeVal;

    const admin = createAdminClient();

    // Check if org with this email already exists (invited partner)
    const { data: existingOrg } = await admin
      .from("organizations")
      .select("id, user_id")
      .eq("email", emailTrimmed)
      .limit(1)
      .maybeSingle();

    let orgId: string;
    let userId: string;

    if (existingOrg?.user_id) {
      // Partner already has auth user — update password and resend invite
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
      if (existing) {
        const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { ...existing.user_metadata, must_change_password: true },
        });
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }
        userId = existing.id;
      } else {
        return NextResponse.json({ error: "Organization exists but auth user not found" }, { status: 400 });
      }
      orgId = existingOrg.id;

      // Update org contact details
      await admin
        .from("organizations")
        .update({
          name: nameTrimmed,
          type: typeVal,
          contact_name: contactNameTrimmed,
          email: emailTrimmed,
          phone: phoneTrimmed,
        })
        .eq("id", orgId);
    } else if (existingOrg) {
      // Org exists but no user — create auth user and link
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);

      if (existing) {
        const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { ...existing.user_metadata, must_change_password: true },
        });
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }
        userId = existing.id;
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
      }

      orgId = existingOrg.id;
      await admin
        .from("organizations")
        .update({
          user_id: userId,
          name: nameTrimmed,
          type: typeVal,
          contact_name: contactNameTrimmed,
          email: emailTrimmed,
          phone: phoneTrimmed,
        })
        .eq("id", orgId);

      // Upsert partner_users
      await admin.from("partner_users").upsert(
        { user_id: userId, org_id: orgId },
        { onConflict: "user_id" }
      );
    } else {
      // New partner — create auth user and org
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);

      if (existing) {
        const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { ...existing.user_metadata, must_change_password: true },
        });
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }
        userId = existing.id;
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
      }

      const { data: newOrg, error: orgError } = await admin
        .from("organizations")
        .insert({
          name: nameTrimmed,
          type: typeVal,
          contact_name: contactNameTrimmed,
          email: emailTrimmed,
          phone: phoneTrimmed,
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

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app"}/login?welcome=1`;

    const inviteParams = { contactName: contactNameTrimmed, companyName: nameTrimmed, email: emailTrimmed, typeLabel, tempPassword: password, loginUrl };
    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: emailTrimmed,
      replyTo: "OPS+ <notifications@opsplus.co>",
      subject: "You're invited to OPS+ — Log in to continue setup",
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
