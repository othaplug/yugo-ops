import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { welcomeEmail } from "@/lib/email-templates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = (user.email || "").toLowerCase() === "othaplug@gmail.com";
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const isAdmin = isSuperAdmin || platformUser?.role === "admin" || platformUser?.role === "manager";

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app";
    const portalUrl = `${baseUrl}/login`;

    const resend = getResend();
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
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send portal email" },
      { status: 500 }
    );
  }
}
