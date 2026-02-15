import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { welcomeEmail } from "@/lib/email-templates";

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app";
    const portalUrl = `${baseUrl}/login`;

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your_api_key_here") {
      const resend = getResend();
      const html = welcomeEmail({
        name: (contact_name || name).trim(),
        email: email.trim(),
        portalUrl,
      });
      await resend.emails.send({
        from: "OPS+ <notifications@opsplus.co>",
        to: email.trim(),
        subject: `Welcome to OPS+ — ${name}`,
        html,
        headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
      });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create client" }, { status: 500 });
  }
}
