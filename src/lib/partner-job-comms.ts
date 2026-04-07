import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { issueDeliveryTrackingTokens } from "@/lib/delivery-tracking-tokens";

/** Aligns with `TrackingStatus` in tracking-notifications (avoid circular import). */
export type PartnerCheckpointStatus =
  | "en_route_to_pickup"
  | "arrived_at_pickup"
  | "loading"
  | "en_route_to_destination"
  | "arrived_at_destination"
  | "unloading"
  | "completed"
  | "en_route"
  | "arrived"
  | "delivering";

function digitsOnly(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/** B2B / partner portal delivery, or one-off business (no org yet). */
export function isPartnerClassDelivery(row: {
  category?: string | null;
  organization_id?: string | null;
  booking_type?: string | null;
}): boolean {
  const cat = String(row.category || "").toLowerCase();
  if (row.organization_id) return true;
  if (cat === "b2b") return true;
  if (row.booking_type === "one_off") return true;
  return false;
}

export function deliveryBusinessTrackUrl(d: {
  id: string;
  delivery_number: string;
  tracking_token?: string | null;
}): string {
  const base = getEmailBaseUrl().replace(/\/$/, "");
  if (d.tracking_token) {
    return `${base}/delivery/track/${encodeURIComponent(d.tracking_token)}`;
  }
  return `${base}/track/delivery/${encodeURIComponent(d.delivery_number)}?token=${signTrackToken("delivery", d.id)}`;
}

export function deliveryRecipientTrackUrl(d: {
  id: string;
  delivery_number: string;
  recipient_tracking_token?: string | null;
}): string {
  const base = getEmailBaseUrl().replace(/\/$/, "");
  if (d.recipient_tracking_token) {
    return `${base}/delivery/track/${encodeURIComponent(d.recipient_tracking_token)}`;
  }
  return `${base}/track/delivery/${encodeURIComponent(d.delivery_number)}?token=${signTrackToken("delivery", d.id)}`;
}

function checkpointSmsLine(
  status: PartnerCheckpointStatus,
  jobType: "move" | "delivery",
  teamName: string,
): string {
  const crew = (teamName || "Yugo crew").trim();
  if (jobType === "delivery") {
    switch (status) {
      case "en_route_to_pickup":
        return `${crew} has started your job. We will text you with updates at each step.`;
      case "arrived_at_pickup":
        return `${crew} arrived at pickup.`;
      case "en_route_to_destination":
      case "en_route":
        return `${crew} is on the way to the delivery address.`;
      case "arrived_at_destination":
      case "arrived":
        return `${crew} arrived with your delivery.`;
      case "completed":
        return `Your delivery is complete. Thanks for choosing Yugo.`;
      default:
        return `Delivery update from ${crew}.`;
    }
  }
  switch (status) {
    case "en_route_to_pickup":
      return `${crew} has started the move. We will text you with updates at each step.`;
    case "arrived_at_pickup":
      return `${crew} arrived at pickup.`;
    case "en_route_to_destination":
    case "en_route":
      return `${crew} is heading to the destination.`;
    case "arrived_at_destination":
    case "arrived":
      return `${crew} arrived at the destination.`;
    case "completed":
      return `Your move is complete. Thanks for choosing Yugo.`;
    default:
      return `Move update from ${crew}.`;
  }
}

export type PartnerDeliveryCheckpointRow = {
  id: string;
  delivery_number: string;
  tracking_token?: string | null;
  recipient_tracking_token?: string | null;
  organization_id?: string | null;
  booking_type?: string | null;
  category?: string | null;
  contact_phone?: string | null;
  customer_phone?: string | null;
  end_customer_phone?: string | null;
};

/**
 * SMS partner contact + end customer on crew checkpoints (alongside email).
 * Dedupes identical phone numbers.
 */
export async function sendPartnerDeliveryCheckpointSms(opts: {
  row: PartnerDeliveryCheckpointRow;
  status: PartnerCheckpointStatus;
  jobType: "delivery";
  teamName: string;
  notifyPartner: boolean;
  notifyClient: boolean;
}): Promise<void> {
  const { row, status, teamName, notifyPartner, notifyClient } = opts;
  if (!isPartnerClassDelivery(row)) return;
  if (!notifyPartner && !notifyClient) return;

  const admin = createAdminClient();
  let partnerPhone = (row.contact_phone || "").trim();

  if (row.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("phone")
      .eq("id", row.organization_id)
      .maybeSingle();
    const op = (org?.phone || "").trim();
    if (op) partnerPhone = op;
  }

  const endPhone = (row.end_customer_phone || row.customer_phone || "").trim();
  const bizUrl = deliveryBusinessTrackUrl(row);
  const recUrl = deliveryRecipientTrackUrl(row);
  const line = checkpointSmsLine(status, "delivery", teamName);

  const sent = new Set<string>();
  const sendIf = async (raw: string, url: string) => {
    const d = digitsOnly(raw);
    if (d.length < 10) return;
    if (sent.has(d)) return;
    sent.add(d);
    const body = `${line}\n\nTrack: ${url}\n\nQuestions? (647) 370-4525`;
    await sendSMS(raw, body).catch(() => {});
  };

  if (notifyPartner && partnerPhone) {
    await sendIf(partnerPhone, bizUrl);
  }
  if (notifyClient && endPhone) {
    await sendIf(endPhone, recUrl);
  }
}

export type PartnerMoveCheckpointRow = {
  id: string;
  organization_id?: string | null;
  client_phone?: string | null;
};

/**
 * Partner / org-linked move (non–b2c org): SMS org phone + move client phone on checkpoints.
 */
export async function sendPartnerMoveCheckpointSms(opts: {
  row: PartnerMoveCheckpointRow;
  status: PartnerCheckpointStatus;
  teamName: string;
  notifyPartner: boolean;
  notifyClient: boolean;
}): Promise<void> {
  const { row, status, teamName, notifyPartner, notifyClient } = opts;
  if (!row.organization_id) return;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("phone, type")
    .eq("id", row.organization_id)
    .maybeSingle();

  if (!org || org.type === "b2c") return;
  if (!notifyPartner && !notifyClient) return;

  const { data: m } = await admin
    .from("moves")
    .select("move_code")
    .eq("id", row.id)
    .maybeSingle();
  const { getTrackMoveSlug } = await import("@/lib/move-code");
  const slug = getTrackMoveSlug({ move_code: m?.move_code, id: row.id });

  const orgPhone = (org.phone || "").trim();
  const clientPhone = (row.client_phone || "").trim();
  const base = getEmailBaseUrl().replace(/\/$/, "");
  const trackUrl = `${base}/track/move/${slug}?token=${signTrackToken("move", row.id)}`;
  const line = checkpointSmsLine(status, "move", teamName);

  const sent = new Set<string>();
  const sendIf = async (raw: string) => {
    const d = digitsOnly(raw);
    if (d.length < 10) return;
    if (sent.has(d)) return;
    sent.add(d);
    const body = `${line}\n\nTrack: ${trackUrl}\n\nQuestions? (647) 370-4525`;
    await sendSMS(raw, body).catch(() => {});
  };

  if (notifyPartner && orgPhone) await sendIf(orgPhone);
  if (notifyClient && clientPhone) await sendIf(clientPhone);
}

/** After issue tokens, re-load is optional; we build URLs from row + sign fallback. */
export async function notifyPartnerDeliveryBooked(deliveryId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: d } = await admin.from("deliveries").select("*").eq("id", deliveryId).maybeSingle();
  if (!d) return;

  const st = String(d.status || "").toLowerCase();
  if (st === "draft" || st === "pending_approval" || st === "pending") return;
  if (!isPartnerClassDelivery(d)) return;

  try {
    await issueDeliveryTrackingTokens(deliveryId);
  } catch {
    /* non-fatal */
  }

  const { data: row } = await admin.from("deliveries").select("*").eq("id", deliveryId).maybeSingle();
  if (!row) return;

  const scheduledDate = (row.scheduled_date || "").trim();
  const win = (row.delivery_window || row.time_slot || "").trim();
  const when = [scheduledDate, win].filter(Boolean).join(" · ") || "Scheduled";
  const cust = (row.customer_name || row.end_customer_name || "Customer").trim();
  const trackUrl = deliveryBusinessTrackUrl({
    id: row.id,
    delivery_number: row.delivery_number,
    tracking_token: row.tracking_token,
  });

  let partnerEmail: string | null = null;
  let partnerLabel = "Partner";

  if (row.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name, email")
      .eq("id", row.organization_id)
      .maybeSingle();
    if (org) {
      partnerEmail = (org.email || "").trim() || null;
      partnerLabel = (org.name || "Partner").trim();
    }
  } else if (row.booking_type === "one_off") {
    partnerEmail = (row.contact_email || "").trim() || null;
    partnerLabel = (row.business_name || row.contact_name || "Partner").trim();
  }

  const subj = `Delivery scheduled — ${cust} (${when})`;
  const inner = `
<div class="email-outer-gutter" style="width:100%;max-width:600px;box-sizing:border-box;padding:40px 24px;font-family:system-ui,sans-serif;color:#1a1a1a;margin:0 auto;background:#FAF7F2">
  <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;margin:0 0 12px">Yugo · ${escapeHtml(partnerLabel)}</p>
  <h1 style="font-size:22px;margin:0 0 16px;color:#2C3E2D">Delivery is on the calendar</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 12px">Your delivery for <strong>${escapeHtml(cust)}</strong> is scheduled: <strong>${escapeHtml(when)}</strong>.</p>
  ${row.pickup_address ? `<p style="font-size:14px;line-height:1.5;margin:0 0 8px"><strong>Pickup</strong><br/>${escapeHtml(String(row.pickup_address))}</p>` : ""}
  ${row.delivery_address ? `<p style="font-size:14px;line-height:1.5;margin:0 0 16px"><strong>Delivery</strong><br/>${escapeHtml(String(row.delivery_address))}</p>` : ""}
  <a href="${trackUrl}" style="display:inline-block;border:2px solid #2C3E2D;color:#2C3E2D;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">Track delivery</a>
  <p style="font-size:13px;margin:28px 0 0;opacity:0.75">Questions? (647) 370-4525</p>
</div>`;

  if (partnerEmail) {
    await sendEmail({ to: partnerEmail, subject: subj, html: inner }).catch(() => {});
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyPartnerMoveBooked(opts: {
  moveId: string;
  organizationId: string;
  clientEmail: string | null;
}): Promise<void> {
  const { moveId, organizationId, clientEmail } = opts;
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, email, type")
    .eq("id", organizationId)
    .maybeSingle();

  if (!org || org.type === "b2c") return;
  const orgEmail = (org.email || "").trim();
  if (!orgEmail) return;
  if (clientEmail && orgEmail.toLowerCase() === clientEmail.trim().toLowerCase()) return;

  const { data: move } = await admin
    .from("moves")
    .select("client_name, scheduled_date, scheduled_time, arrival_window, from_address, to_address, move_code")
    .eq("id", moveId)
    .maybeSingle();

  if (!move) return;

  const { getTrackMoveSlug } = await import("@/lib/move-code");
  const base = getEmailBaseUrl().replace(/\/$/, "");
  const trackUrl = `${base}/track/move/${getTrackMoveSlug({ move_code: move.move_code, id: moveId })}?token=${signTrackToken("move", moveId)}`;

  const when = [move.scheduled_date, move.scheduled_time || move.arrival_window]
    .filter(Boolean)
    .join(" · ") || "Scheduled";
  const cn = (move.client_name || "Client").trim();
  const subj = `Move scheduled — ${cn} (${when})`;
  const inner = `
<div class="email-outer-gutter" style="width:100%;max-width:600px;box-sizing:border-box;padding:40px 24px;font-family:system-ui,sans-serif;color:#1a1a1a;margin:0 auto;background:#FAF7F2">
  <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;margin:0 0 12px">Yugo · ${escapeHtml((org.name || "Partner").trim())}</p>
  <h1 style="font-size:22px;margin:0 0 16px;color:#2C3E2D">Move is on the calendar</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 12px">The move for <strong>${escapeHtml(cn)}</strong> is scheduled: <strong>${escapeHtml(String(when))}</strong>.</p>
  ${move.from_address ? `<p style="font-size:14px;line-height:1.5;margin:0 0 8px"><strong>From</strong><br/>${escapeHtml(String(move.from_address))}</p>` : ""}
  ${move.to_address ? `<p style="font-size:14px;line-height:1.5;margin:0 0 16px"><strong>To</strong><br/>${escapeHtml(String(move.to_address))}</p>` : ""}
  <a href="${trackUrl}" style="display:inline-block;border:2px solid #2C3E2D;color:#2C3E2D;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">Track move</a>
  <p style="font-size:13px;margin:28px 0 0;opacity:0.75">Questions? (647) 370-4525</p>
</div>`;

  await sendEmail({ to: orgEmail, subject: subj, html: inner }).catch(() => {});
}
