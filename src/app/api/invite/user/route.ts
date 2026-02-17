import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUserEmail, inviteUserEmailText } from "@/lib/email-templates";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
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
    const admin = createAdminClient();

    // Clients use magic-link tracking only — do not create accounts for move client emails
    const { data: moveClient } = await admin.from("moves").select("id").ilike("client_email", emailTrimmed).limit(1).maybeSingle();
    if (moveClient) {
      return NextResponse.json({
        error: "This email belongs to a move client. Use 'Resend tracking link' on the move to send them access. Clients do not need accounts.",
      }, { status: 400 });
    }

    const roleVal = ["admin", "manager", "dispatcher", "coordinator", "viewer"].includes(role) ? role : "dispatcher";
    const roleLabels: Record<string, string> = { admin: "Admin", manager: "Manager", dispatcher: "Dispatcher", coordinator: "Coordinator", viewer: "Viewer" };
    const roleLabel = roleLabels[roleVal] || "Dispatcher";

    // If email is already linked to a user, do not add again — return error
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    let userId: string;
    {
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

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/login?welcome=1`;

    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: emailTrimmed,
      replyTo: "OPS+ <notifications@opsplus.co>",
      subject: "You're invited to OPS+ — Log in to continue setup",
      html: inviteUserEmail({ name: nameTrimmed, email: emailTrimmed, roleLabel, tempPassword: password, loginUrl }),
      text: inviteUserEmailText({ name: nameTrimmed, email: emailTrimmed, roleLabel, tempPassword: password, loginUrl }),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
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
