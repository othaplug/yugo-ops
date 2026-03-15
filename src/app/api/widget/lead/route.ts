import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { getEmailLogoUrl } from "@/lib/email-templates";
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

const EMAIL_BG = "#0F0F0F";
const EMAIL_GOLD = "#B8962E";
const EMAIL_WINE = "#5C1A33";
const EMAIL_TX = "#F5F5F3";
const EMAIL_TX2 = "#B0ADA8";
const EMAIL_BRD = "#2A2A2A";

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
  const logoUrl = getEmailLogoUrl();
  const learnMoreUrl = `${getEmailBaseUrl()}/about`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_BG};font-family:'DM Sans',sans-serif;">
  <tr>
    <td align="center" style="padding:32px 24px 24px;">
      <img src="${logoUrl}" alt="YUGO" width="140" height="38" style="display:block;border:0;max-width:140px;height:auto;" />
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 24px 32px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:100%;">
        <tr>
          <td style="font-size:24px;font-weight:700;color:${EMAIL_TX};padding-bottom:8px;">Thanks, ${data.name}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:${EMAIL_TX2};line-height:1.5;padding-bottom:24px;">Your YUGO+ quote is being prepared. We&apos;ll send your exact guaranteed price within 2 hours.</td>
        </tr>
        <tr>
          <td style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;margin-bottom:24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="font-size:9px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:1.5px;text-transform:uppercase;padding-bottom:8px;">Your Estimated Price</td></tr>
              <tr><td style="font-size:28px;font-weight:700;color:${EMAIL_GOLD};padding-bottom:8px;">$${data.selectedPrice.toLocaleString()}</td></tr>
              <tr><td style="font-size:13px;color:${EMAIL_TX2};">${typeLabel} &middot; ${sizeLabel} &middot; ${data.fromPostal.toUpperCase()} &rarr; ${data.toPostal.toUpperCase()}</td></tr>
              ${data.moveDate ? `<tr><td style="font-size:12px;color:#666;padding-top:4px;">${dateStr}${timeStr ? ` &middot; ${timeStr}` : ""}</td></tr>` : ""}
            </table>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;color:${EMAIL_TX2};line-height:1.5;">A YUGO+ coordinator will review your details and send a detailed, guaranteed quote shortly. No surprises &mdash; that&apos;s the YUGO+ promise.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:16px 24px 32px;font-size:10px;color:#666;border-top:1px solid ${EMAIL_BRD};">
      <a href="${learnMoreUrl}" style="color:${EMAIL_WINE};text-decoration:none;">Learn more</a>
      <span style="color:${EMAIL_BRD};margin:0 8px;">&middot;</span>
      Powered by YUGO+
    </td>
  </tr>
</table>`;
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
