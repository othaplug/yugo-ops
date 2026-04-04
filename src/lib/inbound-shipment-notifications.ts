import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { createAdminClient } from "@/lib/supabase/admin";
import { INBOUND_SHIPMENT_STATUS_LABELS } from "@/lib/inbound-shipment-labels";

export type InboundShipmentNotifyRow = {
  id: string;
  shipment_number: string;
  organization_id: string | null;
  partner_name: string | null;
  partner_contact_email: string | null;
  business_email: string | null;
  business_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  carrier_name: string | null;
  carrier_tracking_number: string | null;
  carrier_eta: string | null;
  items: unknown;
  status: string;
  inspection_notes: string | null;
  delivery_scheduled_date: string | null;
  delivery_window: string | null;
};

function partnerInbox(row: InboundShipmentNotifyRow): string | null {
  const e = row.partner_contact_email?.trim() || row.business_email?.trim();
  return e || null;
}

function itemSummary(row: InboundShipmentNotifyRow): string {
  try {
    const items = Array.isArray(row.items) ? row.items : JSON.parse(JSON.stringify(row.items || []));
    if (!Array.isArray(items) || items.length === 0) return "your shipment";
    const first = items[0] as { name?: string };
    return first?.name?.trim() || "your shipment";
  } catch {
    return "your shipment";
  }
}

function wrapHtml(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body class="email-outer-gutter" style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:24px;">
  <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
  ${inner}
  <p style="margin-top:24px;font-size:12px;color:#666;">Yugo — White glove logistics</p>
</body></html>`;
}

async function hqAddress(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_config").select("value").eq("key", "yugo_base_address").maybeSingle();
    return (data?.value as string)?.trim() || "507 King Street East, Toronto, ON";
  } catch {
    return "507 King Street East, Toronto, ON";
  }
}

/** Fire-and-forget partner + optional customer notifications on status transitions. */
export async function notifyInboundShipmentStakeholders(
  row: InboundShipmentNotifyRow,
  kind:
    | "created"
    | "in_transit"
    | "stored_good"
    | "inspection_damage"
    | "customer_contacted"
    | "delivery_scheduled"
    | "out_for_delivery"
    | "delivered"
    | "completed",
): Promise<void> {
  const base = getEmailBaseUrl();
  const token = signTrackToken("inbound_shipment", row.id);
  const trackUrl = `${base}/shipment/${row.id}/track?token=${encodeURIComponent(token)}`;
  const customerUrl = `${base}/shipment/${row.id}/customer?token=${encodeURIComponent(token)}`;
  const customerDeliveryUrl = `${base}/track/rissd/${row.id}?token=${encodeURIComponent(token)}`;
  const toPartner = partnerInbox(row);
  const label = INBOUND_SHIPMENT_STATUS_LABELS[row.status] || row.status;
  const summary = itemSummary(row);

  const sendPartner = async (subject: string, html: string) => {
    if (!toPartner) return;
    try {
      await sendEmail({ to: toPartner, subject, html });
    } catch {
      /* non-fatal */
    }
  };

  switch (kind) {
    case "created": {
      const shipTo = await hqAddress();
      await sendPartner(
        `Shipment confirmed — ${row.shipment_number}`,
        wrapHtml(
          "Your inbound shipment is confirmed",
          `<p>Reference <strong>${row.shipment_number}</strong>. Please ship to:</p>
           <p style="background:#f5f5f5;padding:12px;border-radius:8px;">${shipTo}</p>
           <p>We will email you when the freight is received at our facility.</p>
           <p><a href="${trackUrl}" style="color:#b8860b;">View status</a></p>`,
        ),
      );
      break;
    }
    case "in_transit": {
      await sendPartner(
        `${row.shipment_number} is in transit`,
        wrapHtml(
          "Shipment in transit",
          `<p><strong>${row.shipment_number}</strong> — ${label}</p>
           ${row.carrier_name ? `<p>Carrier: ${row.carrier_name}</p>` : ""}
           ${row.carrier_tracking_number ? `<p>Tracking: ${row.carrier_tracking_number}</p>` : ""}
           ${row.carrier_eta ? `<p>Expected arrival: ${row.carrier_eta}</p>` : ""}
           <p><a href="${trackUrl}" style="color:#b8860b;">View status</a></p>`,
        ),
      );
      break;
    }
    case "stored_good": {
      await sendPartner(
        `${row.shipment_number} received and inspected`,
        wrapHtml(
          "Received and inspected",
          `<p><strong>${row.shipment_number}</strong> — ${summary} arrived in good condition after inspection.</p>
           <p>Please provide your customer&apos;s delivery details so we can schedule white glove delivery.</p>
           <p><a href="${customerUrl}" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#1f5f3f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Provide customer details</a></p>
           <p style="font-size:13px;margin-top:12px;"><a href="${trackUrl}" style="color:#b8860b;">View timeline</a></p>`,
        ),
      );
      break;
    }
    case "inspection_damage": {
      await sendPartner(
        `Urgent: issue on ${row.shipment_number}`,
        wrapHtml(
          "Inspection issue",
          `<p><strong>${row.shipment_number}</strong> — we noted a condition issue during inspection.</p>
           ${row.inspection_notes ? `<p style="background:#fff8f0;padding:12px;border-radius:8px;">${row.inspection_notes}</p>` : ""}
           <p>Please review photos on the status page and reply with instructions.</p>
           <p><a href="${trackUrl}" style="color:#b8860b;">Open shipment</a> · <a href="${customerUrl}" style="color:#b8860b;">Send notes</a></p>`,
        ),
      );
      break;
    }
    case "customer_contacted": {
      if (row.customer_email?.trim()) {
        try {
          await sendEmail({
            to: row.customer_email.trim(),
            subject: `Your ${summary} is ready to schedule`,
            html: wrapHtml(
              "Delivery scheduling",
              `<p>Hi ${row.customer_name || "there"},</p>
               <p>Your order from <strong>${row.partner_name || row.business_name || "your retailer"}</strong> is at our facility and ready for white glove delivery.</p>
               <p>We will follow up shortly with available dates and service details.</p>
               <p style="font-size:13px;color:#666;">Questions? Reply to this email or call your coordinator.</p>`,
            ),
          });
        } catch {
          /* */
        }
      }
      if (row.customer_phone?.trim()) {
        const partnerName = row.partner_name || row.business_name || "your retailer";
        const cn = row.customer_name?.split(" ")[0] || "there";
        const msg = [
          `Hi ${cn},`,
          `Your ${summary} from ${partnerName} is at Yugo and ready to deliver.`,
          `We'll reach out to schedule.`,
          `Questions: (647) 370-4525`,
        ].join("\n\n");
        try {
          await sendSMS(row.customer_phone.trim(), msg);
        } catch {
          /* */
        }
      }
      break;
    }
    case "delivery_scheduled": {
      await sendPartner(
        `${row.shipment_number} — delivery scheduled`,
        wrapHtml(
          "Delivery scheduled",
          `<p><strong>${row.shipment_number}</strong> is scheduled${
            row.delivery_scheduled_date ? ` for <strong>${row.delivery_scheduled_date}</strong>` : ""
          }${row.delivery_window ? ` (${row.delivery_window})` : ""}.</p>
           <p><a href="${trackUrl}" style="color:#b8860b;">View status</a></p>`,
        ),
      );
      if (row.customer_email?.trim()) {
        try {
          await sendEmail({
            to: row.customer_email.trim(),
            subject: `Your delivery is scheduled — ${row.shipment_number}`,
            html: wrapHtml(
              "Delivery scheduled",
              `<p>Hi ${row.customer_name || "there"},</p>
               <p>Your white glove delivery from <strong>${row.partner_name || row.business_name || "your retailer"}</strong> is confirmed${
                 row.delivery_scheduled_date ? ` for <strong>${row.delivery_scheduled_date}</strong>` : ""
               }${row.delivery_window ? `, window <strong>${row.delivery_window}</strong>` : ""}.</p>
               <p><a href="${customerDeliveryUrl}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#1f5f3f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View your delivery</a></p>
               <p style="font-size:12px;color:#666;margin-top:16px;">Live tracking may appear on the day of delivery.</p>`,
            ),
          });
        } catch {
          /* */
        }
      }
      break;
    }
    case "out_for_delivery": {
      await sendPartner(
        `${row.shipment_number} is out for delivery`,
        wrapHtml(
          "Out for delivery",
          `<p><strong>${row.shipment_number}</strong> is en route${
            row.customer_name ? ` to ${row.customer_name}` : ""
          }.</p>
           <p><a href="${trackUrl}" style="color:#b8860b;">View status</a></p>`,
        ),
      );
      break;
    }
    case "delivered": {
      await sendPartner(
        `${row.shipment_number} — delivered`,
        wrapHtml(
          "Delivery complete",
          `<p><strong>${row.shipment_number}</strong> has been delivered and proof of delivery captured.</p>
           <p><a href="${trackUrl}" style="color:#b8860b;">View details</a></p>`,
        ),
      );
      break;
    }
    case "completed": {
      await sendPartner(
        `${row.shipment_number} — closed`,
        wrapHtml(
          "Shipment completed",
          `<p><strong>${row.shipment_number}</strong> is fully closed on our side. Thank you for shipping with Yugo.</p>`,
        ),
      );
      break;
    }
    default:
      break;
  }
}
