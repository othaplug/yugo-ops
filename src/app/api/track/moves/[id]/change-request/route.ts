import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { notifyAllAdmins } from "@/lib/notifications";
import { getAdminNotificationEmail } from "@/lib/config";
import { getEmailFrom, sendEmail } from "@/lib/email/send";
import { internalAdminAlertEmail } from "@/lib/email-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const CHANGE_TYPES = [
  "Change move date",
  "Change move time",
  "Remove items from inventory",
  "Change destination address",
  "Add special instructions",
  "Upgrade service tier",
  "Other",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const type = (body.type || "Other") as string;
    const description = String(body.description ?? "").trim();
    const urgency = body.urgency === "urgent" ? "urgent" : "normal";

    if (!description) {
      return NextResponse.json({ error: "Please describe the change" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: move } = await admin
      .from("moves")
      .select("id, move_code, client_name, scheduled_date")
      .eq("id", moveId)
      .single();
    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const resolvedType = CHANGE_TYPES.includes(type) ? type : "Other";
    const { data: cr, error } = await admin
      .from("move_change_requests")
      .insert({
        move_id: moveId,
        type: resolvedType,
        description,
        urgency,
        submitted_by: "client",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message || "Failed to save request" }, { status: 400 });

    // Alert admins in-app + by email. Previously this insert was silent, so a
    // client-submitted change could sit unseen. The user asked for both channels
    // on any client change to their move.
    const moveCode = (move.move_code as string) || moveId;
    const clientName = (move.client_name as string) || "Client";
    const isUrgent = urgency === "urgent";
    try {
      await notifyAllAdmins({
        title: `${isUrgent ? "URGENT " : ""}Change request: ${clientName}`,
        body: `${moveCode}, ${resolvedType}: ${description.slice(0, 180)}`,
        icon: "edit",
        link: `/admin/moves/${moveId}`,
        eventSlug: "client_change_request",
        sourceType: "move",
        sourceId: moveId,
      });
    } catch (e) {
      console.error("[change-request] in-app notify failed", e);
    }
    try {
      const adminEmail = await getAdminNotificationEmail();
      if (adminEmail) {
        const html = internalAdminAlertEmail({
          kicker: "Client change request",
          title: `${clientName} requested a change`,
          summary: `${moveCode}${isUrgent ? " (marked URGENT)" : ""}`,
          keyValues: [
            { label: "Type", value: resolvedType },
            { label: "Urgency", value: isUrgent ? "Urgent" : "Normal", accent: isUrgent ? "wine" : "muted" },
            { label: "Details", value: description },
          ],
          primaryCta: { label: "Open move", url: `${getEmailBaseUrl().replace(/\/$/, "")}/admin/moves/${moveId}` },
          tone: "action",
        });
        await sendEmail({
          to: adminEmail,
          from: await getEmailFrom(),
          subject: `${isUrgent ? "[URGENT] " : ""}Change request: ${clientName} ${moveCode}`,
          html,
        });
      }
    } catch (e) {
      console.error("[change-request] admin email failed", e);
    }

    return NextResponse.json({ ok: true, id: cr?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit" },
      { status: 500 }
    );
  }
}
