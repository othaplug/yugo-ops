import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { extraItemApprovalEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";

/** PATCH: Approve or reject an extra item */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  const { id, itemId } = await params;
  const body = await req.json();
  const status = body.status === "rejected" ? "rejected" : "approved";
  const feeCents = typeof body.fee_cents === "number" && body.fee_cents >= 0 ? Math.round(body.fee_cents) : 0;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("extra_items")
    .update({
      status,
      fee_cents: status === "approved" ? feeCents : 0,
    })
    .eq("id", itemId)
    .eq("job_id", id)
    .select("id, status, description")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status === "approved" && process.env.RESEND_API_KEY) {
    const { data: move } = await admin
      .from("moves")
      .select("client_email, client_name")
      .eq("id", id)
      .single();
    if (move?.client_email) {
      try {
        const resend = getResend();
        const trackUrl = `${getEmailBaseUrl()}/track/move/${id}?token=${signTrackToken("move", id)}`;
        const html = extraItemApprovalEmail({
          client_name: move.client_name || "Client",
          description: (data as { description?: string }).description || "Extra item",
          portalUrl: trackUrl,
          feeCents,
        });
        await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: move.client_email,
          subject: "Your extra item has been approved",
          html,
        });
      } catch {
        // Don't fail the request if email fails
      }
    }
  }

  return NextResponse.json(data);
}
