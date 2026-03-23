import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { claimStatusUpdateEmailHtml } from "@/lib/email-templates";
import { requireRole } from "@/lib/auth/check-role";

const ALLOWED_STATUSES = new Set([
  "submitted",
  "under_review",
  "approved",
  "partially_approved",
  "denied",
  "settled",
  "closed",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr, user } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const status = typeof body.status === "string" ? body.status.trim() : "";
    const resolution_notes =
      body.resolution_notes === undefined || body.resolution_notes === null
        ? undefined
        : String(body.resolution_notes).trim() || null;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: claim, error: fetchErr } = await supabase.from("claims").select("*").eq("id", id).single();

    if (fetchErr || !claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const prevStatus = claim.status as string;
    const updatePayload: Record<string, unknown> = { status };
    if (resolution_notes !== undefined) {
      updatePayload.resolution_notes = resolution_notes;
    }

    const { error: updErr } = await supabase.from("claims").update(updatePayload).eq("id", id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const fromLabel = prevStatus.replace(/_/g, " ");
    const toLabel = status.replace(/_/g, " ");
    const notesForEmail = resolution_notes !== undefined ? resolution_notes : (claim.resolution_notes as string | null);

    await supabase.from("claim_timeline").insert({
      claim_id: id,
      event_type: "status_changed",
      event_description: `Status changed from ${fromLabel} to ${toLabel}.${resolution_notes !== undefined && resolution_notes ? ` Notes: ${resolution_notes}` : ""}`,
      user_id: user?.id ?? null,
    });

    const clientEmail = (claim.client_email as string)?.trim();
    if (clientEmail) {
      sendEmail({
        to: clientEmail,
        subject: `Claim ${claim.claim_number} Status Update`,
        html: claimStatusUpdateEmailHtml(
          claim.claim_number as string,
          claim.client_name as string,
          fromLabel,
          toLabel,
          notesForEmail,
        ),
      }).catch(() => {});
    }

    const { data: updated } = await supabase.from("claims").select("*").eq("id", id).single();
    return NextResponse.json({ claim: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
