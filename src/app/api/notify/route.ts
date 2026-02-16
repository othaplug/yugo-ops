import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deliveryNotificationEmail, moveNotificationEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const type = body.type || (body.moveId ? "move" : "delivery");

    const toEmail = (body.to || "").trim() || (body.fallbackTo || "").trim();
    if (!toEmail) {
      return NextResponse.json({ error: "No recipient email. Add customer email on the delivery or client." }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)." }, { status: 503 });
    }

    const resend = getResend();
    let html: string;
    let subject: string;

    if (type === "move") {
      const estimate = Number(body.estimate || 0);
      const depositPaid = Math.round(estimate * 0.25);
      const moveCode = (body.moveCode || body.deliveryNumber || "").trim().slice(0, 6) || `MOVE-${(body.moveId || "").slice(0, 4)}`;
      html = moveNotificationEmail({
        move_id: body.moveId || "",
        move_number: moveCode,
        client_name: body.customerName || "",
        move_type: body.moveType || "residential",
        status: body.status || "",
        stage: body.stage || null,
        next_action: body.nextAction || null,
        from_address: body.fromAddress || "",
        to_address: body.deliveryAddress || body.toAddress || "",
        scheduled_date: body.scheduledDate || "",
        estimate,
        deposit_paid: depositPaid,
        balance_due: estimate - depositPaid,
        trackUrl: body.moveId ? `${baseUrl}/track/move/${body.moveId}` : undefined,
      });
      subject = `Your Move Detail - Yugo #${moveCode}`;
      await supabase.from("status_events").insert({
        entity_type: "move",
        entity_id: body.moveId || body.deliveryNumber,
        event_type: "notification",
        description: `Notification sent to ${body.customerName}: Status is ${body.status}`,
        icon: "mail",
      });
    } else {
      html = deliveryNotificationEmail({
        delivery_number: body.deliveryNumber || "",
        customer_name: body.customerName || "",
        client_name: body.clientName || undefined,
        delivery_address: body.deliveryAddress || "",
        pickup_address: body.pickupAddress || undefined,
        scheduled_date: body.scheduledDate || "",
        delivery_window: body.deliveryWindow || "",
        status: body.status || "",
        items_count: body.itemsCount ?? (Array.isArray(body.items) ? body.items.length : undefined),
        trackUrl: body.deliveryId ? `${baseUrl}/track/delivery/${body.deliveryId}` : undefined,
      });
      subject = `Project Update: ${body.deliveryNumber} — ${body.customerName}`;
      await supabase.from("status_events").insert({
        entity_type: "delivery",
        entity_id: body.deliveryNumber,
        event_type: "notification",
        description: `Notification sent to ${body.customerName}: Status is ${body.status}`,
        icon: "mail",
      });
    }

    const { error: sendError } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: toEmail,
      subject,
      html,
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
    if (sendError) {
      return NextResponse.json({ error: sendError.message || "Failed to send email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
