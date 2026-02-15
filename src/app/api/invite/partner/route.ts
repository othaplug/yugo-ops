import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { type, name, contact_name, email, phone } = await req.json();

    if (!email || typeof email !== "string" || !name || typeof name !== "string") {
      return NextResponse.json({ error: "Company name and email are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from("organizations").insert({
      name,
      type: type || "retail",
      contact_name: contact_name || "",
      email,
      phone: phone || "",
      health: "good",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const typeLabel = { retail: "Retail", designer: "Designer", hospitality: "Hospitality", gallery: "Gallery", realtor: "Realtor" }[type] || type;
    const subject = `Welcome to Yugo OPS+ — ${name}`;
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #E8E5E0;">Welcome to Yugo OPS+</h2>
        <p style="color: #999;">${contact_name ? `Hi ${contact_name},` : "Hi,"}</p>
        <p style="color: #999;">${name} has been invited as a <strong>${typeLabel}</strong> partner on Yugo OPS+.</p>
        <p style="color: #999;">Click below to set up your partner portal and start managing your deliveries.</p>
        <p style="margin: 24px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app"}/login" 
             style="display: inline-block; padding: 12px 24px; background: #C9A962; color: #0D0D0D; text-decoration: none; font-weight: 600; border-radius: 8px;">
            Access Partner Portal
          </a>
        </p>
        <p style="color: #666; font-size: 12px;">If you have questions, reply to this email.</p>
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

    return NextResponse.json({ ok: true, message: "Partner added and invitation sent" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send invitation" }, { status: 500 });
  }
}
