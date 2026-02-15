import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUserEmail, inviteUserEmailText } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, password, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }


    const emailTrimmed = email.trim().toLowerCase();
    const nameTrimmed = (name || "").trim();
    const roleVal = role === "admin" ? "admin" : "dispatcher";
    const roleLabel = roleVal === "admin" ? "Administrator" : "Dispatcher";

    const admin = createAdminClient();

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);

    let userId: string;

    if (existing) {
      // Update password for existing user
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { ...existing.user_metadata, must_change_password: true },
      });
      if (updateError) {
        console.error("[invite/user] updateUserById:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
      userId = existing.id;

      // Upsert platform_users
      await admin.from("platform_users").upsert(
        { user_id: userId, email: emailTrimmed, name: nameTrimmed || null, role: roleVal, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    } else {
      // Create new user
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: emailTrimmed,
        password,
        email_confirm: true,
        user_metadata: { full_name: nameTrimmed, must_change_password: true },
      });

      if (createError) {
        console.error("[invite/user] createUser:", createError);
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      userId = newUser.user.id;

      // Create platform_users
      await admin.from("platform_users").insert({
        user_id: userId,
        email: emailTrimmed,
        name: nameTrimmed || null,
        role: roleVal,
      });
    }

    // Insert or update invitation record (use admin for DB writes)
    const { data: existingInv } = await admin.from("invitations").select("id").eq("email", emailTrimmed).limit(1).single();
    if (existingInv) {
      await admin.from("invitations").update({
        name: nameTrimmed || null,
        role: roleVal,
        status: "accepted",
        temp_password: password,
        must_change_password: true,
        invited_user_id: userId,
      }).eq("email", emailTrimmed);
    } else {
      await admin.from("invitations").insert({
        email: emailTrimmed,
        name: nameTrimmed || null,
        role: roleVal,
        status: "accepted",
        temp_password: password,
        must_change_password: true,
        invited_user_id: userId,
      });
    }

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app"}/login?welcome=1`;

    const inviteParams = { name: nameTrimmed, email: emailTrimmed, roleLabel, tempPassword: password, loginUrl };
    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: emailTrimmed,
      replyTo: "OPS+ <notifications@opsplus.co>",
      subject: "You're invited to OPS+ — Log in to continue setup",
      html: inviteUserEmail(inviteParams),
      text: inviteUserEmailText(inviteParams),
      headers: {
        "Precedence": "auto",
        "X-Auto-Response-Suppress": "All",
      },
    });

    if (sendError) {
      return NextResponse.json({ error: sendError.message || "Failed to send invitation email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Invitation sent" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send invitation";
    console.error("[invite/user] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
