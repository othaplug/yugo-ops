import { randomBytes } from "crypto";
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

  const { name: coordinatorName, phone: coordinatorPhone } =
    await getCoordinatorDisplay(sb, {
      assignedTo: (lead.assigned_to as string) ?? null,
      fallbackUserId: user.id,
    });

  const token = randomBytes(12).toString("hex");
  const base = getEmailBaseUrl();
  const surveyUrl = `${base}/survey/${token}`;

  await sb
    .from("photo_surveys")
    .delete()
    .eq("lead_id", leadId)
    .eq("status", "pending");

  const first = String(lead.first_name || "").trim();
  const last = String(lead.last_name || "").trim();
  const clientName = [first, last].filter(Boolean).join(" ") || "Client";

  const { error: insErr } = await sb.from("photo_surveys").insert({
    lead_id: leadId,
    token,
    client_name: clientName,
    client_email: lead.email,
    client_phone: lead.phone,
    from_address: lead.from_address,
    move_size: lead.move_size,
    status: "pending",
    coordinator_name: coordinatorName,
    coordinator_phone: coordinatorPhone,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from("leads")
    .update({
      status: "photos_requested",
      photos_requested_at: now,
      photo_survey_token: token,
    })
    .eq("id", leadId);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  await sb.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "status_changed",
    notes: `→ photos_requested (room photo link sent)`,
    performed_by: user.id,
  });

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
      `To prepare your personalized move quote, we would love to see your space. ` +
      `Quick room photos help us plan accurately: ${surveyUrl} ` +
      `Takes about five minutes. ` +
      (coordinatorPhone
        ? `Questions? Call me: ${coordinatorPhone}`
        : "We are here to help with any questions.");
    await sendSMS(phoneTo, line);
  }

  const { data: fresh } = await sb.from("leads").select("*").eq("id", leadId).single();

  return NextResponse.json({ ok: true, surveyUrl, lead: fresh });
}
