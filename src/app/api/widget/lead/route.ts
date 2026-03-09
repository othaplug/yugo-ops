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
  small: "Small Office",
  medium: "Medium Office",
  large: "Large Office",
};

const MOVE_TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  office: "Office / Commercial",
  special_event: "Special Event",
};

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secret}&response=${token}`,
    });
    const data = await res.json();
    return data.success && (data.score ?? 1) >= 0.3;
  } catch {
    return true;
  }
}

function confirmationEmailHtml(data: {
  name: string;
  moveType: string;
  moveSize: string;
  fromPostal: string;
  toPostal: string;
  selectedPrice: number;
  moveDate: string | null;
  preferredTime: string | null;
}): string {
  const sizeLabel = SIZE_LABELS[data.moveSize] || data.moveSize;
  const typeLabel = MOVE_TYPE_LABELS[data.moveType] || data.moveType;
  const dateStr = data.moveDate
    ? new Date(data.moveDate + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })
    : "Flexible";
  const timeStr = data.preferredTime ? data.preferredTime.toUpperCase() : "";
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
      <p style="font-size:13px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Your Estimated Price</p>
      <p style="font-size:32px;font-weight:700;color:#722F37;margin:0 0 8px;">
        $${data.selectedPrice.toLocaleString()}
      </p>
      <p style="font-size:14px;color:#555;margin:0;">
        ${typeLabel} · ${sizeLabel} · ${data.fromPostal.toUpperCase()} → ${data.toPostal.toUpperCase()}
      </p>
      ${data.moveDate ? `<p style="font-size:13px;color:#888;margin:4px 0 0;">${dateStr}${timeStr ? ` · ${timeStr}` : ""}</p>` : ""}
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
    const {
      name, email, phone,
      moveType, moveSize, officeSize,
      fromPostal, toPostal,
      buildingTypeFrom, buildingTypeTo,
      accessFrom, accessTo,
      moveDate, preferredTime, flexibleDate,
      estimateLow, estimateHigh, selectedPrice,
      factors, inventoryItems, estimatedBoxes,
      comments, recaptchaToken,
    } = body;

    if (!name || !email || !fromPostal || !toPostal) {
      return NextResponse.json({ error: "name, email, fromPostal, and toPostal are required" }, { status: 400 });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim();
    const trimmedPhone = phone ? String(phone).trim() : null;

    if (trimmedName.length === 0 || trimmedName.length > 200) {
      return NextResponse.json({ error: "name must be between 1 and 200 characters" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (trimmedPhone && trimmedPhone.length > 30) {
      return NextResponse.json({ error: "Phone must be 30 characters or fewer" }, { status: 400 });
    }

    if (recaptchaToken) {
      const valid = await verifyRecaptcha(recaptchaToken);
      if (!valid) {
        return NextResponse.json({ error: "reCAPTCHA verification failed" }, { status: 403 });
      }
    }

    const supabase = createAdminClient();

    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", trimmedEmail.toLowerCase())
      .maybeSingle();

    let contactId = existingContact?.id;
    if (!contactId) {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          name: trimmedName,
          email: trimmedEmail.toLowerCase(),
          phone: trimmedPhone || null,
          lead_source: "widget",
          postal_code: fromPostal,
        })
        .select("id")
        .single();
      contactId = newContact?.id;
    }

    const effectiveSize = moveType === "office" ? officeSize : moveSize;

    const { data: lead, error } = await supabase
      .from("quote_requests")
      .insert({
        lead_number: "",
        name: trimmedName,
        email: trimmedEmail.toLowerCase(),
        phone: trimmedPhone || null,
        source: "widget",
        move_size: effectiveSize || null,
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

    const sizeLabel = SIZE_LABELS[effectiveSize] || effectiveSize || "Custom";
    const typeLabel = MOVE_TYPE_LABELS[moveType] || moveType || "Move";
    const itemCount = Array.isArray(inventoryItems) ? inventoryItems.reduce((s: number, i: { qty?: number }) => s + (i.qty || 0), 0) : 0;

    sendEmail({
      to: trimmedEmail.toLowerCase(),
      subject: "Your YUGO+ Quote Is Being Prepared",
      html: confirmationEmailHtml({
        name: trimmedName,
        moveType: moveType || "residential",
        moveSize: effectiveSize || "custom",
        fromPostal,
        toPostal,
        selectedPrice: selectedPrice || 0,
        moveDate: moveDate || null,
        preferredTime: preferredTime || null,
      }),
    }).catch(() => {});

    const priceStr = selectedPrice ? `$${selectedPrice.toLocaleString()}` : "N/A";
    const extras = [
      buildingTypeFrom && `From: ${buildingTypeFrom}/${accessFrom}`,
      buildingTypeTo && `To: ${buildingTypeTo}/${accessTo}`,
      itemCount > 0 && `${itemCount} furniture items`,
      estimatedBoxes && `~${estimatedBoxes} boxes`,
      preferredTime && `Preferred: ${preferredTime.toUpperCase()}`,
      comments && `Note: ${comments.slice(0, 100)}`,
    ].filter(Boolean).join(" | ");

    notifyAdmins("quote_requested", {
      subject: `New Widget Lead: ${trimmedName}`,
      body: `${typeLabel} · ${sizeLabel} · ${priceStr} · ${fromPostal.toUpperCase()} → ${toPostal.toUpperCase()}${extras ? `\n${extras}` : ""}`,
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
