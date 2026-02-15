import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { email, name, role } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const roleLabel = role === "admin" ? "Administrator" : "Dispatcher";
    const subject = "You're invited to Yugo OPS+";
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #E8E5E0;">You're invited to Yugo OPS+</h2>
        <p style="color: #999;">${name ? `Hi ${name},` : "Hi,"}</p>
        <p style="color: #999;">You've been invited to join Yugo OPS+ as a <strong>${roleLabel}</strong>.</p>
        <p style="color: #999;">Click the link below to set up your account and get started.</p>
        <p style="margin: 24px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app"}/auth/signup?email=${encodeURIComponent(email)}" 
             style="display: inline-block; padding: 12px 24px; background: #C9A962; color: #0D0D0D; text-decoration: none; font-weight: 600; border-radius: 8px;">
            Accept Invitation
          </a>
        </p>
        <p style="color: #666; font-size: 12px;">If you didn't expect this invitation, you can ignore this email.</p>
      </div>
    `;

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your_api_key_here") {
      await resend.emails.send({
        from: "Yugo OPS+ <notifications@yugo.ca>",
        to: email,
        subject,
        html,
      });
    }

    return NextResponse.json({ ok: true, message: "Invitation sent" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send invitation" }, { status: 500 });
  }
}
