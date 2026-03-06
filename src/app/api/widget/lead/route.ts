import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";

const SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br": "4 Bedroom",
  "5br_plus": "5+ Bedroom",
};

function confirmationEmailHtml(data: {
  name: string;
  moveSize: string;
  fromPostal: string;
  toPostal: string;
  low: number;
  high: number;
}): string {
  const sizeLabel = SIZE_LABELS[data.moveSize] || data.moveSize;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-size:20px;font-weight:700;color:#722F37;letter-spacing:1px;">YUGO+</span>
  </div>
  <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 8px;">Thanks, ${data.name}!</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
      Your YUGO+ quote is being prepared. We'll send your exact guaranteed price within 2 hours.
    </p>
    <div style="background:#FAF7F2;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Your Ballpark Estimate</p>
      <p style="font-size:28px;font-weight:700;color:#722F37;margin:0 0 8px;">
        $${data.low.toLocaleString()} – $${data.high.toLocaleString()}
      </p>
      <p style="font-size:14px;color:#555;margin:0;">
        ${sizeLabel} · ${data.fromPostal.toUpperCase()} → ${data.toPostal.toUpperCase()}
      </p>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.5;margin:0;">
      A YUGO+ coordinator will review your details and send a detailed, guaranteed quote shortly.
      No surprises — that's the YUGO+ promise.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#aaa;margin-top:24px;">
    © ${new Date().getFullYear()} Yugo Moving · Toronto, ON
  </p>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, moveSize, fromPostal, toPostal, moveDate, flexibleDate, estimateLow, estimateHigh, factors } = body;

    if (!name || !email || !moveSize || !fromPostal || !toPostal) {
      return NextResponse.json({ error: "name, email, moveSize, fromPostal, and toPostal are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    let contactId = existingContact?.id;
    if (!contactId) {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          name,
          email: email.toLowerCase(),
          phone: phone || null,
          lead_source: "widget",
          postal_code: fromPostal,
        })
        .select("id")
        .single();
      contactId = newContact?.id;
    }

    const { data: lead, error } = await supabase
      .from("quote_requests")
      .insert({
        lead_number: "",
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        source: "widget",
        move_size: moveSize,
        from_postal: fromPostal,
        to_postal: toPostal,
        move_date: moveDate || null,
        flexible_date: flexibleDate || false,
        widget_estimate_low: estimateLow || null,
        widget_estimate_high: estimateHigh || null,
        estimate_factors: factors || [],
        contact_id: contactId || null,
      })
      .select("id, lead_number")
      .single();

    if (error) {
      console.error("Failed to create quote request:", error);
      return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
    }

    const sizeLabel = SIZE_LABELS[moveSize] || moveSize;

    sendEmail({
      to: email.toLowerCase(),
      subject: "Your YUGO+ Quote Is Being Prepared",
      html: confirmationEmailHtml({
        name,
        moveSize,
        fromPostal,
        toPostal,
        low: estimateLow || 0,
        high: estimateHigh || 0,
      }),
    }).catch(() => {});

    notifyAdmins("quote_requested", {
      subject: `New Widget Lead: ${name}`,
      body: `New widget lead: ${name}, ${sizeLabel}, $${estimateLow?.toLocaleString() || "?"}-$${estimateHigh?.toLocaleString() || "?"} range. ${fromPostal.toUpperCase()} → ${toPostal.toUpperCase()}`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      leadNumber: lead.lead_number,
      leadId: lead.id,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
