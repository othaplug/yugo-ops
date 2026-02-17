import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { welcomeEmail } from "@/lib/email-templates";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, contact_name, email")
      .eq("id", id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const toEmail = (org.email || "").trim();
    if (!toEmail) {
      return NextResponse.json({ error: "Client has no email" }, { status: 400 });
    }

    let resend;
    try {
      resend = getResend();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Resend not configured";
      return NextResponse.json(
        { error: msg.includes("RESEND") ? "Email not configured. Add RESEND_API_KEY in environment (e.g. Vercel)." : msg },
        { status: 503 }
      );
    }

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const portalUrl = `${getEmailBaseUrl()}/login`;

    const html = welcomeEmail({
      name: (org.contact_name || org.name || "").trim() || "Partner",
      email: toEmail,
      portalUrl,
    });

    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: toEmail,
      subject: `Welcome to OPS+ — ${org.name}`,
      html,
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });

    if (sendError) {
      const message = (sendError as { message?: string }).message ?? String(sendError);
      return NextResponse.json(
        { error: message.includes("domain") || message.includes("verified") ? `Email failed: ${message}. Verify the sending domain (opsplus.co) in Resend.` : message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send portal email" },
      { status: 500 }
    );
  }
}
