import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { getTrackMoveSlug } from "@/lib/move-code";
import { shareTrackingPremiumEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  try {
    const { delivery_id, move_id, method, recipient } = await req.json();

    if (!delivery_id && !move_id) {
      return NextResponse.json({ error: "Missing delivery_id or move_id" }, { status: 400 });
    }
    if (method === "email" && !recipient) {
      return NextResponse.json({ error: "Missing recipient email" }, { status: 400 });
    }

    const supabase = await createClient();

    let trackUrl: string;
    let emailSubject: string;
    let emailEyebrow: string;
    let emailTitle: string;
    let emailBodyLine: string;
    let shareKind: "move" | "delivery";

    if (move_id) {
      const { data: move } = await supabase
        .from("moves")
        .select("id, move_code, client_name, to_address, from_address, organization_id")
        .eq("id", move_id)
        .single();

      if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
      if (!move.organization_id || !orgIds.includes(move.organization_id)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const token = signTrackToken("move", move.id);
      const slug = getTrackMoveSlug({ move_code: move.move_code, id: move.id });
      trackUrl = `${getEmailBaseUrl()}/track/move/${encodeURIComponent(slug)}?token=${token}`;
      emailSubject = "Your move is scheduled";
      emailEyebrow = "Live tracking";
      emailTitle = "Your move is ready to track";
      emailBodyLine = `${move.client_name || "Resident"}. ${move.to_address || move.from_address || ""}`.trim();
      shareKind = "move";
    } else {
      const { data: delivery } = await supabase
        .from("deliveries")
        .select("id, delivery_number, customer_name, delivery_address, organization_id")
        .eq("id", delivery_id)
        .single();

      if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
      if (!delivery.organization_id || !orgIds.includes(delivery.organization_id)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const token = signTrackToken("delivery", delivery.id);
      trackUrl = `${getEmailBaseUrl()}/track/delivery/${encodeURIComponent(delivery.delivery_number)}?token=${token}`;
      emailSubject = "Track your delivery";
      emailEyebrow = "Live tracking";
      emailTitle = "Your delivery is ready to track";
      emailBodyLine = `${delivery.customer_name || "Customer"}. ${delivery.delivery_address || ""}`.trim();
      shareKind = "delivery";
    }

    if (method === "email") {
      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_your_api_key_here") {
        return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
      }

      const resend = getResend();
      const emailFrom = await getEmailFrom();
      const html = shareTrackingPremiumEmail({
        eyebrow: emailEyebrow,
        headline: emailTitle,
        summaryLine: emailBodyLine,
        trackUrl,
        kind: shareKind,
      });
      const { error: sendError } = await resend.emails.send({
        from: emailFrom,
        to: recipient,
        subject: emailSubject,
        html,
        headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
      });

      if (sendError) {
        const msg = typeof sendError === "object" && sendError !== null && "message" in sendError
          ? String((sendError as { message?: string }).message)
          : String(sendError);
        return NextResponse.json({ error: msg || "Failed to send email" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, trackUrl });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to share tracking link" },
      { status: 500 }
    );
  }
}
