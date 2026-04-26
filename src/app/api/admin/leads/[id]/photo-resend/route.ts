import { NextRequest, NextResponse } from "next/server";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { buildPhotoRequestEmail } from "@/lib/email/photo-request";
import { sendEmail } from "@/lib/email/send";
import { getCoordinatorDisplay } from "@/lib/photo-survey/intake-helpers.server";
import { requireStaff } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms/sendSMS";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireStaff();
  if (error) return error;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await ctx.params;
  const sb = createAdminClient();
  const { data: lead, error: lErr } = await sb
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (lErr || !lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = (lead.photo_survey_token as string) || "";
  if (!token) {
    return NextResponse.json(
      { error: "No active photo request for this lead" },
      { status: 400 },
    );
  }

  const { name: coordinatorName, phone: coordinatorPhone } =
    await getCoordinatorDisplay(sb, {
      assignedTo: (lead.assigned_to as string) ?? null,
      fallbackUserId: user.id,
    });

  const base = getEmailBaseUrl();
  const surveyUrl = `${base}/survey/${token}`;

  await sb
    .from("leads")
    .update({ photos_requested_at: new Date().toISOString() })
    .eq("id", leadId);

  const first = String(lead.first_name || "").trim();
  const last = String(lead.last_name || "").trim();
  const clientName = [first, last].filter(Boolean).join(" ") || "Client";
  const emailTo = (lead.email && String(lead.email).trim()) || "";
  if (emailTo) {
    const { subject, html } = buildPhotoRequestEmail({
      firstName: first || clientName,
      coordinatorName,
      coordinatorPhone,
      surveyUrl,
      moveDate: lead.preferred_date ? String(lead.preferred_date) : null,
      fromAddress: lead.from_address ? String(lead.from_address) : null,
    });
    await sendEmail({ to: emailTo, subject, html });
  }

  const phoneTo = (lead.phone && String(lead.phone).trim()) || "";
  if (phoneTo) {
    const firstName = first || "there";
    const line =
      `Hi ${firstName}, this is ${coordinatorName} from Yugo. ` +
      `Here is your photo link again: ${surveyUrl} ` +
      (coordinatorPhone
        ? `Call me with questions: ${coordinatorPhone}`
        : "Reply if you need help.");
    await sendSMS(phoneTo, line);
  }

  const { data: fresh } = await sb.from("leads").select("*").eq("id", leadId).single();
  return NextResponse.json({ ok: true, lead: fresh });
}
