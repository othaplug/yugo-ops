import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { changeRequestNotificationEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const status = body.status === "approved" || body.status === "rejected" ? body.status : null;

    if (!status) {
      return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: request, error: fetchErr } = await admin
      .from("move_change_requests")
      .select("id, move_id, type, description")
      .eq("id", id)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: fetchErr?.message || "Not found" }, { status: 400 });
    }

    const { error } = await admin
      .from("move_change_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: move } = await admin
      .from("moves")
      .select("client_email, client_name")
      .eq("id", request.move_id)
      .single();

    if (move?.client_email && process.env.RESEND_API_KEY) {
      try {
        const resend = getResend();
        const trackUrl = `${getEmailBaseUrl()}/track/move/${request.move_id}?token=${signTrackToken("move", request.move_id)}`;
        const html = changeRequestNotificationEmail({
          client_name: move.client_name || "Client",
          status,
          type: request.type,
          description: request.description,
          portalUrl: trackUrl,
        });
        await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: move.client_email,
          subject: `Your change request has been ${status === "approved" ? "approved" : "declined"}`,
          html,
        });
      } catch {
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
