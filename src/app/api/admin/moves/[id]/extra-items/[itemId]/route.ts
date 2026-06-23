import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { extraItemAwaitingClientEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";
import { buildPublicMoveTrackUrl } from "@/lib/notifications/public-track-url";
import { getEmailFrom } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";

/**
 * PATCH: Admin "approves" or rejects an extra item.
 *
 * Important policy change (2026-06-24 per Oche): an admin approval no longer
 * auto-charges the client. Instead it STAGES the fee on the row by setting
 * `status='awaiting_client'` and `fee_cents=N`, and emails + texts the client
 * with two CTAs — Accept (which charges the card on file via
 * /api/track/moves/[id]/extra-items/[itemId]/respond?action=accept) or
 * Decline. The card is only touched when the client actively accepts.
 *
 * Driven by the Chidera Allison (MV-30228) call review: she paid for items
 * she didn't agree to before they appeared on her statement. The new flow
 * keeps the client in control of every charge.
 *
 * Rejection (`status='rejected'`) stays admin-side terminal — admins can
 * decline a request outright (e.g., crew flagged it as a duplicate / can't
 * be done). No client notification on admin rejection; the activity feed
 * surfaces "Item removed" via the existing synthesizer.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id, itemId } = await params;
  const body = await req.json();
  // Admin "approve" now means "stage and ask the client to accept".
  const isReject = body.status === "rejected";
  const nextStatus: "awaiting_client" | "rejected" = isReject
    ? "rejected"
    : "awaiting_client";
  const feeCents =
    typeof body.fee_cents === "number" && body.fee_cents >= 0
      ? Math.round(body.fee_cents)
      : 0;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("extra_items")
    .update({
      status: nextStatus,
      fee_cents: nextStatus === "awaiting_client" ? feeCents : 0,
    })
    .eq("id", itemId)
    .eq("job_id", id)
    .select("id, status, description, payment_charged, quantity")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Notify the client when we've staged a fee and need their decision.
  if (nextStatus === "awaiting_client") {
    const { data: move } = await admin
      .from("moves")
      .select("id, client_email, client_name, client_phone, move_code")
      .eq("id", id)
      .single();

    if (move) {
      // Public action URLs use the standard track token + the itemId in the
      // path. Re-using the existing token system avoids a per-action secret;
      // the itemId is unique and the route refuses to act unless the item is
      // still in `awaiting_client`, so a stale or shared link is harmless.
      const trackTokenForLinks = signTrackToken("move", move.id);
      const baseUrl = getEmailBaseUrl();
      const acceptUrl = `${baseUrl}/api/track/moves/${move.id}/extra-items/${itemId}/respond?action=accept&token=${trackTokenForLinks}`;
      const declineUrl = `${baseUrl}/api/track/moves/${move.id}/extra-items/${itemId}/respond?action=decline&token=${trackTokenForLinks}`;
      const portalUrl = buildPublicMoveTrackUrl({
        id: move.id,
        move_code: move.move_code,
      });
      const desc = (data as { description?: string }).description || "Extra item";
      const qty = Number((data as { quantity?: number }).quantity ?? 1);
      const descLine = qty > 1 ? `${qty}× ${desc}` : desc;

      if (move.client_email && process.env.RESEND_API_KEY) {
        try {
          const resend = getResend();
          const html = extraItemAwaitingClientEmail({
            clientName: move.client_name || "there",
            description: descLine,
            feeCents,
            acceptUrl,
            declineUrl,
            portalUrl,
          });
          const emailFrom = await getEmailFrom();
          await resend.emails.send({
            from: emailFrom,
            to: move.client_email,
            subject: `Approve an added charge for your move (${move.move_code})`,
            html,
          });
        } catch (e) {
          console.error("[extra-items PATCH] notify email failed:", e);
        }
      }

      // SMS the client too — most read texts within minutes. Keep the body
      // short; the link goes to the portal where they can review and tap
      // Accept or Decline.
      if (move.client_phone) {
        try {
          const dollars = (feeCents / 100).toFixed(2);
          const firstName =
            (move.client_name || "").split(/\s+/)[0] || "there";
          const smsBody = [
            `Hi ${firstName},`,
            `Yugo is requesting your approval for an added charge: ${descLine} ($${dollars}).`,
            `Review and respond:\n${portalUrl}`,
            `Your card will only be charged if you tap Accept.`,
          ].join("\n\n");
          await sendSMS(normalizePhone(move.client_phone), smsBody);
        } catch (e) {
          console.error("[extra-items PATCH] notify SMS failed:", e);
        }
      }
    }
  }

  return NextResponse.json({ ...data, staged: nextStatus === "awaiting_client" });
}
