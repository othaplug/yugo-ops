import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deliveryNotificationEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    await supabase.from("status_events").insert({
      entity_type: "delivery",
      entity_id: body.deliveryNumber,
      event_type: "notification",
      description: `Notification sent to ${body.customerName}: Status is ${body.status}`,
      icon: "mail",
    });

    if (process.env.RESEND_API_KEY && body.to) {
      const resend = getResend();
      const html = deliveryNotificationEmail({
        delivery_number: body.deliveryNumber,
        customer_name: body.customerName,
        delivery_address: body.deliveryAddress || "",
        scheduled_date: body.scheduledDate || "",
        delivery_window: body.deliveryWindow || "",
        status: body.status,
      });
      await resend.emails.send({
        from: "OPS+ <notifications@opsplus.co>",
        to: body.to,
        subject: `Delivery Update: ${body.deliveryNumber}`,
        html,
        headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}