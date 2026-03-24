import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { equinoxPromoLayout, equinoxPromoCta, equinoxPromoFinePrint } from "@/lib/email-templates";
import { widgetLeadAdminEmailHtml } from "@/lib/email/admin-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";

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
    : null;
  const timeStr = data.preferredTime ? data.preferredTime.toUpperCase() : "";
  const learnMoreUrl = `${getEmailBaseUrl()}/about`;
  const namePart = data.name ? data.name.split(" ")[0] : "";
  const routeLine = `${data.fromPostal.toUpperCase()} &rarr; ${data.toPostal.toUpperCase()}`;
  const detailLine = [typeLabel, sizeLabel, routeLine, dateStr ? `${dateStr}${timeStr ? ` &middot; ${timeStr}` : ""}` : null].filter(Boolean).join(" &middot; ");

  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${namePart ? `${namePart}, we` : "We"}&apos;re on it.</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0 0 28px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your quote is being prepared. We&apos;ll send your guaranteed flat-rate price within 2 hours.</p>
    <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:24px;margin-bottom:8px;">
      <div style="font-size:32px;font-weight:700;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:-0.02em;margin-bottom:8px;">$${data.selectedPrice.toLocaleString()}</div>
      <div style="font-size:12px;color:#595959;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:0.04em;">${detailLine}</div>
    </div>
    ${equinoxPromoCta(learnMoreUrl, "About Yugo")}
    ${equinoxPromoFinePrint("Flat-rate pricing. No hourly charges. No surprises.")}
  `);
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
      otherItems, specialHandling,
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

    const otherItemsPayload = Array.isArray(otherItems)
      ? otherItems.filter((i: { name?: string }) => i?.name && String(i.name).trim()).map((i: { name: string; qty?: number }) => ({ name: String(i.name).trim(), qty: Math.max(1, Number(i.qty) || 1) }))
      : [];
    const specialHandlingStr = specialHandling && String(specialHandling).trim() ? String(specialHandling).trim() : null;

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
        ...(otherItemsPayload.length > 0 && { other_items: otherItemsPayload }),
        ...(specialHandlingStr && { special_handling: specialHandlingStr }),
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
      subject: "Your Yugo Quote Is Being Prepared",
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
    const otherItemsLabel = otherItemsPayload.length > 0
      ? `Other items: ${otherItemsPayload.map((i: { name: string; qty: number }) => `${i.name}${i.qty > 1 ? ` (×${i.qty})` : ""}`).join(", ")}`
      : "";
    const specialHandlingLabel = specialHandlingStr ? `Special handling: ${specialHandlingStr.slice(0, 80)}${specialHandlingStr.length > 80 ? "…" : ""}` : "";
    const extras = [
      buildingTypeFrom && `From: ${buildingTypeFrom}/${accessFrom}`,
      buildingTypeTo && `To: ${buildingTypeTo}/${accessTo}`,
      itemCount > 0 && `${itemCount} furniture items`,
      estimatedBoxes && `~${estimatedBoxes} boxes`,
      preferredTime && `Preferred: ${preferredTime.toUpperCase()}`,
      otherItemsLabel,
      specialHandlingLabel,
      comments && `Note: ${comments.slice(0, 100)}`,
    ].filter(Boolean).join(" | ");

    notifyAdmins("quote_requested", {
      subject: `New Widget Lead: ${trimmedName}`,
      body: `${typeLabel} · ${sizeLabel} · ${priceStr} · ${fromPostal.toUpperCase()} → ${toPostal.toUpperCase()}${extras ? `\n${extras}` : ""}`,
      html: widgetLeadAdminEmailHtml({
        name: trimmedName,
        typeLabel,
        sizeLabel,
        priceStr,
        fromPostal,
        toPostal,
        extras: extras || undefined,
      }),
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
