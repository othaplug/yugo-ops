import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { inviteUserEmail, inviteUserEmailText } from "@/lib/email-templates";

function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSuperAdmin = (user.email || "").toLowerCase() === "othaplug@gmail.com";
    if (!isSuperAdmin) return NextResponse.json({ error: "Superadmin only" }, { status: 403 });

    const { id } = await params;
    const admin = createAdminClient();
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app"}/login?welcome=1`;

    if (id.startsWith("inv-")) {
      const invId = id.replace("inv-", "");
      const { data: inv, error: invErr } = await admin.from("invitations").select("email, name, role, temp_password").eq("id", invId).single();
      if (invErr || !inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
      const tempPassword = inv.temp_password || generatePassword();
      if (!inv.temp_password) {
        await admin.from("invitations").update({ temp_password: tempPassword }).eq("id", invId);
      }
      const roleLabel = inv.role === "admin" ? "Admin" : inv.role === "manager" ? "Manager" : "Dispatcher";
      const resend = getResend();
      const { error: sendError } = await resend.emails.send({
        from: "OPS+ <notifications@opsplus.co>",
        to: inv.email,
        subject: "You're invited to OPS+ — Log in to continue setup",
        html: inviteUserEmail({ name: inv.name || "", email: inv.email, roleLabel, tempPassword, loginUrl }),
        text: inviteUserEmailText({ name: inv.name || "", email: inv.email, roleLabel, tempPassword, loginUrl }),
      });
      if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (id.startsWith("partner-")) {
      return NextResponse.json({ error: "Use Resend portal from Clients page for partners" }, { status: 400 });
    }

    let email: string;
    let name: string;
    let roleLabel: string;

    const { data: platformUser } = await admin.from("platform_users").select("email, name, role").eq("user_id", id).single();
    if (platformUser) {
      email = platformUser.email;
      name = platformUser.name || "";
      roleLabel = platformUser.role === "admin" ? "Admin" : platformUser.role === "manager" ? "Manager" : "Dispatcher";
    } else {
      const { data: { user: authUser }, error: authErr } = await admin.auth.admin.getUserById(id);
      if (authErr || !authUser?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
      email = authUser.email;
      name = (authUser.user_metadata?.full_name as string) || "";
      roleLabel = "User";
    }

    const tempPassword = generatePassword();
    const { error: updateErr } = await admin.auth.admin.updateUserById(id, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: email,
      subject: "You're invited to OPS+ — Log in to continue setup",
      html: inviteUserEmail({ name: name.trim() || "", email, roleLabel, tempPassword, loginUrl }),
      text: inviteUserEmailText({ name: name.trim() || "", email, roleLabel, tempPassword, loginUrl }),
    });
    if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
