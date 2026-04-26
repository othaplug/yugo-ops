import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { requireStaff } from "@/lib/api-auth";
import { getCoordinatorDisplay } from "@/lib/photo-survey/intake-helpers.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms/sendSMS";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireStaff();
  if (error) return error;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: leadId } = await ctx.params;
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = (body.message || "").trim().slice(0, 2000);
  if (message.length < 4) {
    return NextResponse.json({ error: "Message too short" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: lead, error: lErr } = await sb
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (lErr || !lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name: coordName, phone: coordPhone } = await getCoordinatorDisplay(sb, {
    assignedTo: (lead.assigned_to as string) ?? null,
    fallbackUserId: user.id,
  });
  const first = String(lead.first_name || "").trim() || "there";
  const email = (lead.email && String(lead.email).trim()) || "";
  const phone = (lead.phone && String(lead.phone).trim()) || "";
  const safeMsg = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (email) {
    const html = `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;font-family:system-ui,Segoe UI,sans-serif;">
      <tr><td style="padding:24px 0 8px;font-size:20px;color:#2B0416;">Hi ${first},</td></tr>
      <tr><td style="padding:0 0 12px;font-size:15px;color:#3A3532;line-height:1.6;">Quick question from your move coordinator ${coordName}:</td></tr>
      <tr><td style="padding:12px 16px;background:#FFFBF7;border:1px solid #E2DDD5;border-radius:8px;font-size:14px;color:#2A2523;line-height:1.5;">${safeMsg}</td></tr>
      <tr><td style="padding:16px 0 0;font-size:12px;color:#6B635C;">Reply to this email and we will take it from there.</td></tr>
    </table>`;
    await sendEmail({ to: email, subject: "A quick question about your move", html });
  }
  if (phone) {
    const line = `${first}, this is ${coordName} from Yugo. ${message} Reply here or call ${coordPhone || "us"}.`;
    await sendSMS(phone, line);
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "Lead has no email or phone" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
