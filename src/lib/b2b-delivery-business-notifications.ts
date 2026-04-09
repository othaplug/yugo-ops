import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { sendEmail } from "@/lib/email/send";
import { b2bOneOffDeliveredEmail, b2bOneOffEnRouteEmail } from "@/lib/email-templates";
import { sendSMS } from "@/lib/sms/sendSMS";

function isB2BOneOffRow(row: {
  booking_type?: string | null;
  organization_id?: string | null;
  contact_email?: string | null;
}): boolean {
  return row.booking_type === "one_off" && !row.organization_id && !!(row.contact_email || "").trim();
}

/** When crew heads to destination — notify business contact once. */
export async function maybeNotifyB2BOneOffOutForDelivery(
  deliveryId: string,
  checkpointStatus: string,
): Promise<void> {
  if (checkpointStatus !== "en_route_to_destination" && checkpointStatus !== "en_route") return;

  const admin = createAdminClient();
  const { data: d } = await admin
    .from("deliveries")
    .select(
      "id, booking_type, organization_id, contact_email, contact_phone, business_name, customer_name, delivery_address, tracking_token, b2b_business_notify_en_route_sent_at"
    )
    .eq("id", deliveryId)
    .maybeSingle();

  if (!d || !isB2BOneOffRow(d) || d.b2b_business_notify_en_route_sent_at) return;
  if (!d.tracking_token) return;
  const email = (d.contact_email || "").trim();
  const phone = (d.contact_phone || "").trim();
  if (!email && !phone) return;

  const base = getEmailBaseUrl().replace(/\/$/, "");
  const trackUrl = `${base}/delivery/track/${encodeURIComponent(d.tracking_token)}`;
  const cust = (d.customer_name || "your customer").trim();
  const subj = "Your delivery is on the way";
  const addr = d.delivery_address ? String(d.delivery_address) : null;
  const html = b2bOneOffEnRouteEmail({
    customerName: cust,
    trackUrl,
    addressSnippet: addr,
  });

  if (email) await sendEmail({ to: email, subject: subj, html }).catch(() => {});
  if (phone) {
    await sendSMS(
      phone,
      [`Your delivery to ${cust} is out for delivery with Yugo.`, `Track: ${trackUrl}`, `Questions? (647) 370-4525`].join("\n"),
    ).catch(() => {});
  }
  await admin
    .from("deliveries")
    .update({ b2b_business_notify_en_route_sent_at: new Date().toISOString() })
    .eq("id", deliveryId);
}

/** After delivery completed — POD / delivered email to business contact once. */
export async function maybeNotifyB2BOneOffDelivered(deliveryId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: d } = await admin
    .from("deliveries")
    .select(
      "id, booking_type, organization_id, contact_email, contact_phone, business_name, customer_name, tracking_token, b2b_business_notify_delivered_sent_at"
    )
    .eq("id", deliveryId)
    .maybeSingle();

  if (!d || !isB2BOneOffRow(d) || d.b2b_business_notify_delivered_sent_at) return;
  if (!d.tracking_token) return;
  const email = (d.contact_email || "").trim();
  const phone = (d.contact_phone || "").trim();
  if (!email && !phone) return;

  const base = getEmailBaseUrl().replace(/\/$/, "");
  const trackUrl = `${base}/delivery/track/${encodeURIComponent(d.tracking_token)}`;
  const cust = (d.customer_name || "your customer").trim();
  const subj = "Delivered. Proof of delivery is ready";
  const html = b2bOneOffDeliveredEmail({ customerName: cust, trackUrl });

  if (email) await sendEmail({ to: email, subject: subj, html }).catch(() => {});
  if (phone) {
    await sendSMS(
      phone,
      [`Delivered: your delivery to ${cust} is complete (Yugo).`, `POD & photos: ${trackUrl}`, `Questions? (647) 370-4525`].join("\n"),
    ).catch(() => {});
  }
  await admin
    .from("deliveries")
    .update({ b2b_business_notify_delivered_sent_at: new Date().toISOString() })
    .eq("id", deliveryId);
}
