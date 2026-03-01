import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getResend } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  try {
    const { delivery_id, method, recipient } = await req.json();

    if (!delivery_id || !recipient) {
      return NextResponse.json({ error: "Missing delivery_id or recipient" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: delivery } = await supabase
      .from("deliveries")
      .select("id, delivery_number, customer_name, delivery_address, organization_id")
      .eq("id", delivery_id)
      .single();

    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (delivery.organization_id !== orgId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const token = signTrackToken("delivery", delivery.id);
    const trackUrl = `${getEmailBaseUrl()}/track/delivery/${encodeURIComponent(delivery.delivery_number)}?token=${token}`;

    if (method === "email") {
      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_your_api_key_here") {
        return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
      }

      const resend = getResend();
      const { error: sendError } = await resend.emails.send({
        from: "OPS+ <notifications@opsplus.co>",
        to: recipient,
        subject: `Track your delivery — ${delivery.delivery_number}`,
        html: `
          <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:32px;border-radius:14px;background:#FAFAFA">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-family:'Instrument Serif',Georgia,serif;font-size:18px;letter-spacing:2px;color:#1A1A1A">YUGO</span>
            </div>
            <h1 style="font-size:20px;font-weight:700;color:#1A1A1A;margin:0 0 12px">Your delivery is on its way</h1>
            <p style="font-size:14px;color:#666;margin:0 0 8px">${delivery.customer_name || "Customer"} — ${delivery.delivery_address || ""}</p>
            <p style="font-size:14px;color:#666;margin:0 0 24px">Track your delivery in real-time using the link below.</p>
            <a href="${trackUrl}" style="display:inline-block;padding:12px 28px;background:#C9A962;color:#fff;font-weight:700;text-decoration:none;border-radius:8px;font-size:14px">Track Delivery</a>
            <p style="font-size:12px;color:#aaa;margin-top:24px">Delivery ${delivery.delivery_number} — Powered by Yugo OPS+</p>
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
