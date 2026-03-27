import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { verifyTrackToken } from "@/lib/track-token";

function opaqueToken(): string {
  return randomBytes(24).toString("base64url");
}

/** HMAC token (legacy) or opaque `tracking_token` / `recipient_tracking_token`. */
export async function verifyDeliveryTrackAccess(
  deliveryId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  if (verifyTrackToken("delivery", deliveryId, token)) return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("deliveries")
    .select("tracking_token, recipient_tracking_token")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!data) return false;
  return data.tracking_token === token || data.recipient_tracking_token === token;
}

export type DeliveryTrackAudience = "business" | "recipient";

/**
 * Issue unique tracking tokens for a B2B one-off delivery (idempotent).
 * Returns existing tokens if already set.
 */
export async function issueDeliveryTrackingTokens(deliveryId: string): Promise<{
  trackingToken: string;
  recipientToken: string | null;
}> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("deliveries")
    .select(
      "id, tracking_token, recipient_tracking_token, business_name, contact_email, contact_phone, customer_name, customer_email, customer_phone, delivery_address, booking_type, organization_id"
    )
    .eq("id", deliveryId)
    .single();

  if (error || !row) throw new Error(error?.message || "Delivery not found");

  const isB2BOneOff =
    row.booking_type === "one_off" && !row.organization_id;
  if (!isB2BOneOff) {
    return {
      trackingToken: row.tracking_token || "",
      recipientToken: row.recipient_tracking_token || null,
    };
  }

  let trackingToken = row.tracking_token as string | null;
  let recipientToken = row.recipient_tracking_token as string | null;

  if (!trackingToken) trackingToken = opaqueToken();
  const endEmail = (row.customer_email || "").trim().toLowerCase();
  const bizEmail = (row.contact_email || "").trim().toLowerCase();
  const hasDistinctRecipient =
    !!endEmail && endEmail !== bizEmail && !!(row.customer_name || "").trim();
  if (hasDistinctRecipient && !recipientToken) {
    recipientToken = opaqueToken();
  }

  const { error: upErr } = await admin
    .from("deliveries")
    .update({
      tracking_token: trackingToken,
      recipient_tracking_token: recipientToken,
    })
    .eq("id", deliveryId);
  if (upErr) throw new Error(upErr.message);

  return { trackingToken, recipientToken: recipientToken || null };
}

export async function sendB2BTrackingNotifications(
  deliveryId: string,
  opts: { audiences?: DeliveryTrackAudience[] } = {},
): Promise<void> {
  const audiences = opts.audiences ?? ["business", "recipient"];
  const admin = createAdminClient();
  const { data: d } = await admin
    .from("deliveries")
    .select(
      "tracking_token, recipient_tracking_token, business_name, contact_email, contact_phone, customer_email, customer_phone, customer_name"
    )
    .eq("id", deliveryId)
    .single();

  if (!d?.tracking_token) return;

  const base = getEmailBaseUrl().replace(/\/$/, "");
  const bizUrl = `${base}/delivery/track/${encodeURIComponent(d.tracking_token)}`;
  const brand = (d.business_name || "Your business").trim();

  if (audiences.includes("business")) {
    const subj = "Your Yugo delivery is confirmed";
    const inner = `
<div style="padding:40px 24px;font-family:system-ui,sans-serif;color:#FAF7F2;max-width:560px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:0.2em;text-transform:capitalize;opacity:0.7;margin:0 0 12px">Yugo</p>
  <h1 style="font-size:22px;margin:0 0 16px">Delivery confirmed</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Your Yugo delivery is confirmed. Track progress anytime.</p>
  <a href="${bizUrl}" style="display:inline-block;background:#5C1A33;color:#FAF7F2;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:14px">Track delivery</a>
  <p style="font-size:13px;margin:28px 0 0;opacity:0.75">Questions? (647) 370-4525</p>
</div>`;
    if (d.contact_email) {
      await sendEmail({
        to: d.contact_email,
        subject: subj,
        html: inner,
      }).catch(() => {});
    }
    if (d.contact_phone) {
      await sendSMS(
        d.contact_phone,
        [`Hi,`, `Your Yugo delivery is confirmed.`, `Track anytime:\n${bizUrl}`].join("\n\n"),
      ).catch(() => {});
    }
  }

  if (
    audiences.includes("recipient") &&
    d.recipient_tracking_token &&
    d.customer_phone
  ) {
    const recUrl = `${base}/delivery/track/${encodeURIComponent(d.recipient_tracking_token)}`;
    const subj = `Your ${brand} delivery by Yugo`;
    const inner = `
<div style="padding:40px 24px;font-family:system-ui,sans-serif;color:#FAF7F2;max-width:560px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:0.2em;text-transform:capitalize;opacity:0.7;margin:0 0 12px">${brand} · Yugo</p>
  <h1 style="font-size:22px;margin:0 0 16px">Track your delivery</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Your order from <strong>${brand}</strong> is on the way with Yugo.</p>
  <a href="${recUrl}" style="display:inline-block;background:#5C1A33;color:#FAF7F2;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:14px">Track delivery</a>
  <p style="font-size:13px;margin:28px 0 0;opacity:0.75">Questions? (647) 370-4525</p>
</div>`;
    if (d.customer_email) {
      await sendEmail({
        to: d.customer_email,
        subject: subj,
        html: inner,
      }).catch(() => {});
    }
    await sendSMS(
      d.customer_phone,
      [`Hi,`, `Your order from ${brand} is on the way with Yugo.`, `Track your delivery:\n${recUrl}`].join("\n\n"),
    ).catch(() => {});
  }
}
