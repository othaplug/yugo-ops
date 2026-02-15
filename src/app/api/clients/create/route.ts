import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resend } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { name, type, contact_name, email, phone, address } = await req.json();

    if (!name || typeof name !== "string" || !email || typeof email !== "string") {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name: name.trim(),
        type: type || "retail",
        contact_name: (contact_name || "").trim(),
        email: email.trim(),
        phone: (phone || "").trim(),
        address: (address || "").trim(),
        health: "good",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send welcome email
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #E8E5E0;">Welcome to Yugo OPS+</h2>
        <p style="color: #999;">${contact_name ? `Hi ${contact_name},` : "Hi,"}</p>
        <p style="color: #999;"><strong>${name}</strong> is now set up on Yugo OPS+. Your partner portal is ready.</p>
        <p style="color: #999;">Track deliveries, view invoices, and communicate with our team — all in one place.</p>
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
        to: email.trim(),
        subject: `Welcome to Yugo OPS+ — ${name}`,
        html,
      });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create client" }, { status: 500 });
  }
}
