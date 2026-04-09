import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { sendEmail } from "@/lib/email/send";
import {
  b2bDeliveryConfirmedBusinessEmail,
  b2bDeliveryRecipientEmail,
} from "@/lib/email-templates";
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
  /** Use * so older DBs without newer columns (e.g. vertical_code) do not fail the whole request. */
  const { data: row, error } = await admin.from("deliveries").select("*").eq("id", deliveryId).single();

  if (error || !row) throw new Error(error?.message || "Delivery not found");

  const cat = String(row.category ?? "").toLowerCase();
  const vertical = String(row.vertical_code ?? "").trim();
  const isB2BDeliveryJob =
    (row.booking_type === "one_off" && !row.organization_id) ||
    cat === "b2b" ||
    vertical.length > 0;
  if (!isB2BDeliveryJob) {
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
  const { data: d } = await admin.from("deliveries").select("*").eq("id", deliveryId).single();

  if (!d?.tracking_token) return;

  const base = getEmailBaseUrl().replace(/\/$/, "");
  const bizUrl = `${base}/delivery/track/${encodeURIComponent(d.tracking_token)}`;
  const brand = (d.business_name || "Your business").trim();

  if (audiences.includes("business")) {
    const subj = "Your delivery is confirmed";
    const html = b2bDeliveryConfirmedBusinessEmail(bizUrl);
    if (d.contact_email) {
      await sendEmail({
        to: d.contact_email,
        subject: subj,
        html,
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
    const subj = `Your ${brand} delivery with Yugo`;
    const html = b2bDeliveryRecipientEmail(brand, recUrl);
    if (d.customer_email) {
      await sendEmail({
        to: d.customer_email,
        subject: subj,
        html,
      }).catch(() => {});
    }
    await sendSMS(
      d.customer_phone,
      [`Hi,`, `Your order from ${brand} is on the way with Yugo.`, `Track your delivery:\n${recUrl}`].join("\n\n"),
    ).catch(() => {});
  }
}
