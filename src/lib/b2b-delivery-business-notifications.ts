import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { sendEmail } from "@/lib/email/send";
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
  const subj = `Your delivery to ${cust} is out for delivery`;
  const inner = `
<div style="padding:40px 24px;font-family:system-ui,sans-serif;color:#F9EDE4;max-width:560px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:0.04em;text-transform:none;opacity:0.7;margin:0 0 12px">Yugo</p>
  <h1 style="font-size:22px;margin:0 0 16px">Out for delivery</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Your delivery to <strong>${cust}</strong> is on the way${d.delivery_address ? ` (${String(d.delivery_address).slice(0, 80)}${String(d.delivery_address).length > 80 ? "…" : ""})` : ""}.</p>
  <a href="${trackUrl}" style="display:inline-block;background:#2C3E2D;color:#F9EDE4;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:14px">Track delivery</a>
  <p style="font-size:13px;margin:28px 0 0;opacity:0.75">Questions? (647) 370-4525</p>
</div>`;

  if (email) await sendEmail({ to: email, subject: subj, html: inner }).catch(() => {});
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
  const subj = `Delivered: ${cust} — POD available`;
  const inner = `
<div style="padding:40px 24px;font-family:system-ui,sans-serif;color:#F9EDE4;max-width:560px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:0.04em;text-transform:none;opacity:0.7;margin:0 0 12px">Yugo</p>
  <h1 style="font-size:22px;margin:0 0 16px">Delivered</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 20px">The delivery to <strong>${cust}</strong> is complete. Proof of delivery and photos are available on the tracking page.</p>
  <a href="${trackUrl}" style="display:inline-block;background:#2C3E2D;color:#F9EDE4;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:14px">View details</a>
  <p style="font-size:13px;margin:28px 0 0;opacity:0.75">Questions? (647) 370-4525</p>
</div>`;

  if (email) await sendEmail({ to: email, subject: subj, html: inner }).catch(() => {});
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
