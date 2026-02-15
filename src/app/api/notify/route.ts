import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    await supabase.from("status_events").insert({
      entity_type: "delivery",
      entity_id: body.deliveryNumber,
      event_type: "notification",
      description: `Notification sent to ${body.customerName}: Status is ${body.status}`,
      icon: "📧",
    });

    if (process.env.RESEND_API_KEY && body.to) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Yugo Ops <notifications@opsplus.co>",
          to: body.to,
          subject: `Delivery Update: ${body.deliveryNumber}`,
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2>Yugo Delivery Update</h2><p>Hi ${body.customerName},</p><p>Your delivery <strong>${body.deliveryNumber}</strong> status: <strong>${body.status}</strong></p><p>Delivery to: ${body.deliveryAddress}</p><hr/><p style="color:#999;font-size:12px;">Yugo Luxury Transport & Logistics</p></div>`,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}