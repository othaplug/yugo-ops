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

/**
 * @param clientFacing When true, never use internal crew team names (e.g. Alpha); use neutral client copy only.
 */
function checkpointSmsLine(
  status: PartnerCheckpointStatus,
  jobType: "move" | "delivery",
  teamName: string,
  clientFacing = false,
): string {
  const crew = clientFacing
    ? jobType === "move"
      ? "Your moving team"
      : "Your crew"
    : (teamName || "Yugo crew").trim();
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
        return clientFacing
          ? `You have a new delivery update from Yugo.`
          : `Delivery update from ${crew}.`;
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
      return clientFacing
        ? `You have a new move update from Yugo.`
        : `Move update from ${crew}.`;
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
  const linePartner = checkpointSmsLine(status, "delivery", teamName, false);
  const lineClient = checkpointSmsLine(status, "delivery", teamName, true);

  const sent = new Set<string>();
  const sendIf = async (raw: string, url: string, line: string) => {
    const d = digitsOnly(raw);
    if (d.length < 10) return;
    if (sent.has(d)) return;
    sent.add(d);
    const body = `${line}\n\nTrack: ${url}\n\nQuestions? (647) 370-4525`;
    await sendSMS(raw, body).catch(() => {});
  };

  if (notifyPartner && partnerPhone) {
    await sendIf(partnerPhone, bizUrl, linePartner);
  }
  if (notifyClient && endPhone) {
    await sendIf(endPhone, recUrl, lineClient);
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
  const linePartner = checkpointSmsLine(status, "move", teamName, false);
  const lineClient = checkpointSmsLine(status, "move", teamName, true);

  const sent = new Set<string>();
  const sendIf = async (raw: string, line: string) => {
    const d = digitsOnly(raw);
    if (d.length < 10) return;
    if (sent.has(d)) return;
    sent.add(d);
    const body = `${line}\n\nTrack: ${trackUrl}\n\nQuestions? (647) 370-4525`;
    await sendSMS(raw, body).catch(() => {});
  };

  if (notifyPartner && orgPhone) await sendIf(orgPhone, linePartner);
  if (notifyClient && clientPhone) await sendIf(clientPhone, lineClient);
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

  if (row.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name, email")
      .eq("id", row.organization_id)
      .maybeSingle();
    if (org) {
      partnerEmail = (org.email || "").trim() || null;
    }
  } else if (row.booking_type === "one_off") {
    partnerEmail = (row.contact_email || "").trim() || null;
  }

  const subj = "Your delivery is scheduled";
  const { partnerBookingScheduledEmail } = await import("@/lib/email-templates");
  const html = partnerBookingScheduledEmail({
    kind: "delivery",
    customerName: cust,
    whenLabel: when,
    fromAddress: row.pickup_address,
    toAddress: row.delivery_address,
    trackUrl,
  });

  if (partnerEmail) {
    await sendEmail({ to: partnerEmail, subject: subj, html }).catch(() => {});
  }
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
  const subj = "Your move is scheduled";
  const { partnerBookingScheduledEmail } = await import("@/lib/email-templates");
  const html = partnerBookingScheduledEmail({
    kind: "move",
    customerName: cn,
    whenLabel: String(when),
    fromAddress: move.from_address,
    toAddress: move.to_address,
    trackUrl,
  });

  await sendEmail({ to: orgEmail, subject: subj, html }).catch(() => {});
}
