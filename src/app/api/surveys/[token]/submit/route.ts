import { NextRequest, NextResponse } from "next/server";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAllAdmins } from "@/lib/notifications";
import { sendSMS } from "@/lib/sms/sendSMS";

export const dynamic = "force-dynamic";

type PhotosMap = Record<string, string[]>;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { photos?: PhotosMap; special_notes?: string; total_photos?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const photos = body.photos && typeof body.photos === "object" && !Array.isArray(body.photos)
    ? (body.photos as PhotosMap)
    : {};
  const special_notes =
    typeof body.special_notes === "string" ? body.special_notes.slice(0, 4000) : "";
  const total =
    typeof body.total_photos === "number" && body.total_photos > 0
      ? body.total_photos
      : Object.values(photos).reduce((a, u) => a + (Array.isArray(u) ? u.length : 0), 0);

  if (total < 1) {
    return NextResponse.json(
      { error: "Add at least one photo before submitting." },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const { data: survey, error: sErr } = await sb
    .from("photo_surveys")
    .select("id, lead_id, status, coordinator_name, coordinator_phone")
    .eq("token", token)
    .maybeSingle();
  if (sErr || !survey || survey.status !== "pending") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const leadId = survey.lead_id as string;
  const roomCount = Object.keys(photos).filter(
    (k) => Array.isArray(photos[k]) && (photos[k] as string[]).length > 0,
  ).length;
  const now = new Date().toISOString();

  const { error: u1 } = await sb
    .from("photo_surveys")
    .update({
      photos,
      special_notes: special_notes || null,
      total_photos: total,
      status: "submitted",
      submitted_at: now,
    })
    .eq("id", survey.id);
  if (u1) {
    return NextResponse.json({ error: u1.message }, { status: 500 });
  }

  const { data: lead } = await sb.from("leads").select("first_name, last_name, assigned_to").eq("id", leadId).single();
  const clientName =
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Client";

  const { error: u2 } = await sb
    .from("leads")
    .update({
      status: "photos_received",
      photos_uploaded_at: now,
      photo_count: total,
    })
    .eq("id", leadId);
  if (u2) {
    return NextResponse.json({ error: u2.message }, { status: 500 });
  }

  const base = getEmailBaseUrl();
  const reviewUrl = `${base}/admin/leads/${leadId}/photos`;

  await notifyAllAdmins({
    title: `Photos received from ${clientName}`,
    body: `${total} photos across ${roomCount} ${roomCount === 1 ? "room" : "rooms"}. Ready for inventory review.`,
    link: reviewUrl,
    sourceType: "lead",
    sourceId: leadId,
  });

  const assignee = (lead as { assigned_to?: string } | null)?.assigned_to;
  const coordPhone =
    (survey.coordinator_phone as string) ||
    (assignee
      ? (
          await sb
            .from("platform_users")
            .select("phone")
            .eq("user_id", assignee)
            .maybeSingle()
        ).data?.phone
      : null) ||
    "";

  if (coordPhone && String(coordPhone).replace(/\D/g, "").length >= 10) {
    const line = `${clientName} just uploaded ${total} move photos. Review and build inventory: ${reviewUrl}`;
    await sendSMS(String(coordPhone), line);
  }

  return NextResponse.json({ ok: true, leadId });
}
