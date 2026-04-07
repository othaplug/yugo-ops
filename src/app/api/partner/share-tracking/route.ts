import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { getTrackMoveSlug } from "@/lib/move-code";

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
    let emailTitle: string;
    let emailBodyLine: string;
    let emailCta: string;
    let footerRef: string;

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
      emailSubject = `Track your move ${move.move_code || ""}`.trim();
      emailTitle = "Your move is on the calendar";
      emailBodyLine = `${move.client_name || "Resident"} — ${move.to_address || move.from_address || ""}`;
      emailCta = "Track move";
      footerRef = `Move ${move.move_code || move.id}`;
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
      emailSubject = `Track your delivery ${delivery.delivery_number}`;
      emailTitle = "Your delivery is on its way";
      emailBodyLine = `${delivery.customer_name || "Customer"} ${delivery.delivery_address || ""}`;
      emailCta = "Track delivery";
      footerRef = `Delivery ${delivery.delivery_number}`;
    }

    if (method === "email") {
      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_your_api_key_here") {
        return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
      }

      const resend = getResend();
      const emailFrom = await getEmailFrom();
      const { error: sendError } = await resend.emails.send({
        from: emailFrom,
        to: recipient,
        subject: emailSubject,
        html: `
          <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:32px;border-radius:14px;background:#FAFAFA">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-family:'Instrument Serif',serif;font-size:18px;letter-spacing:2px;color:#1A1A1A">Yugo</span>
            </div>
            <h1 style="font-size:20px;font-weight:700;color:#1A1A1A;margin:0 0 12px">${emailTitle}</h1>
            <p style="font-size:14px;color:#666;margin:0 0 8px">${emailBodyLine}</p>
            <p style="font-size:14px;color:#666;margin:0 0 24px">Use the link below to follow crew location and status in real time.</p>
            <a href="${trackUrl}" style="display:inline-block;padding:12px 28px;background:#2C3E2D;color:#fff;font-weight:700;text-decoration:none;border-radius:8px;font-size:14px">${emailCta}</a>
            <p style="font-size:12px;color:#aaa;margin-top:24px">${footerRef} · Powered by Yugo · Questions? (647) 370-4525</p>
          </div>
        `,
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
