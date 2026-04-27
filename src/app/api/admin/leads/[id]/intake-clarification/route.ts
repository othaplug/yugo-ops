import { NextRequest, NextResponse } from "next/server";
import { buildIntakeClarificationEmail } from "@/lib/email/intake-clarification-client";
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

  if (email) {
    const { subject, html } = buildIntakeClarificationEmail({
      firstName: first,
      coordinatorName: coordName,
      coordinatorPhone: coordPhone || null,
      message,
    });
    await sendEmail({ to: email, subject, html });
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
