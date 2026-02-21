import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";
import { requireAuth } from "@/lib/api-auth";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const body = await req.json();
    const persona = body.persona === "partner" ? "partner" : "client";

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/login?welcome=1`;

    if (persona === "partner") {
      // Partner: create org + auth user + partner_users; optionally send invite
      const { name, type, contact_name, email, phone, address, send_portal_access } = body;
      if (!name || typeof name !== "string" || !email || typeof email !== "string") {
        return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
      }

      const admin = createAdminClient();
      const emailTrimmed = email.trim().toLowerCase();
      const nameTrimmed = name.trim();
      const contactNameTrimmed = (contact_name || "").trim();
      const phoneTrimmed = (phone || "").trim();
      const addressTrimmed = (address || "").trim();
      const typeVal = type || "retail";
      const typeLabels: Record<string, string> = {
        retail: "Retail",
        designer: "Designer",
        hospitality: "Hospitality",
        gallery: "Gallery",
        realtor: "Realtor",
      };
      const typeLabel = typeLabels[String(typeVal)] || typeVal;
      const tempPassword = generateTempPassword();

      const { data: existingOrg } = await admin
        .from("organizations")
        .select("id, user_id")
        .eq("email", emailTrimmed)
        .limit(1)
        .maybeSingle();

      let orgId: string;
      let userId: string;

      if (existingOrg?.user_id) {
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
        if (!existing) {
          return NextResponse.json({ error: "Organization exists but auth user not found" }, { status: 400 });
        }
        await admin.auth.admin.updateUserById(existing.id, {
          password: tempPassword,
          user_metadata: { ...existing.user_metadata, must_change_password: true },
        });
        userId = existing.id;
        orgId = existingOrg.id;
        await admin
          .from("organizations")
          .update({
            name: nameTrimmed,
            type: typeVal,
            contact_name: contactNameTrimmed,
            email: emailTrimmed,
            phone: phoneTrimmed,
            address: addressTrimmed,
          })
          .eq("id", orgId);
      } else if (existingOrg) {
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
        if (existing) {
          await admin.auth.admin.updateUserById(existing.id, {
            password: tempPassword,
            user_metadata: { ...existing.user_metadata, must_change_password: true },
          });
          userId = existing.id;
        } else {
          const { data: newUser, error: createError } = await admin.auth.admin.createUser({
            email: emailTrimmed,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: contactNameTrimmed || nameTrimmed, must_change_password: true },
          });
          if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });
          userId = newUser!.user.id;
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
            address: addressTrimmed,
          })
          .eq("id", orgId);
        await admin.from("partner_users").upsert({ user_id: userId, org_id: orgId }, { onConflict: "user_id" });
      } else {
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
        if (existing) {
          await admin.auth.admin.updateUserById(existing.id, {
            password: tempPassword,
            user_metadata: { ...existing.user_metadata, must_change_password: true },
          });
          userId = existing.id;
        } else {
          const { data: newUser, error: createError } = await admin.auth.admin.createUser({
            email: emailTrimmed,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: contactNameTrimmed || nameTrimmed, must_change_password: true },
          });
          if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });
          userId = newUser!.user.id;
        }
        const { data: newOrg, error: orgError } = await admin
          .from("organizations")
          .insert({
            name: nameTrimmed,
            type: typeVal,
            contact_name: contactNameTrimmed,
            email: emailTrimmed,
            phone: phoneTrimmed,
            address: addressTrimmed,
            health: "good",
            user_id: userId,
          })
          .select("id")
          .single();
        if (orgError) return NextResponse.json({ error: orgError.message }, { status: 400 });
        orgId = newOrg!.id;
        await admin.from("partner_users").insert({ user_id: userId, org_id: orgId });
      }

      if (send_portal_access !== false) {
        const resend = getResend();
        const inviteParams = {
          contactName: contactNameTrimmed,
          companyName: nameTrimmed,
          email: emailTrimmed,
          typeLabel,
          tempPassword,
          loginUrl,
        };
        await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: emailTrimmed,
          subject: `You're invited to OPS+ — ${nameTrimmed}`,
          html: invitePartnerEmail(inviteParams),
          text: invitePartnerEmailText(inviteParams),
          headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
        });
      }

      return NextResponse.json({ ok: true, id: orgId });
    }

    // Client: create org only (no auth user). Clients access moves via tracking link when added to a move.
    const { name, email, phone, address } = body;
    if (!name || typeof name !== "string" || !email || typeof email !== "string") {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: name.trim(),
        type: "b2c",
        contact_name: name.trim(),
        email: email.trim(),
        phone: (phone || "").trim(),
        address: (address || "").trim(),
        health: "good",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: org?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create client" },
      { status: 500 }
    );
  }
}
