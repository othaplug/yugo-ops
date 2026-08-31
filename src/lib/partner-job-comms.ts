import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import {
  buildPublicDeliveryTrackUrl,
  buildPublicMoveTrackUrl,
  buildSmsTrackUrl,
} from "@/lib/notifications/public-track-url";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { issueDeliveryTrackingTokens } from "@/lib/delivery-tracking-tokens";
import {
  finalizeStageNotification,
  reserveStageNotification,
} from "@/lib/notifications/stage-notification";

/** Aligns with `TrackingStatus` in tracking-notifications and crew checkpoints. */
export type PartnerCheckpointStatus =
  | "not_started"
  | "en_route_to_pickup"
  | "arrived_at_pickup"
  | "inventory_check"
  | "loading"
  | "wrapping"
  | "en_route_to_destination"
  | "en_route_venue"
  | "arrived_at_destination"
  | "arrived_venue"
  | "unloading"
  | "unloading_setup"
  | "event_active"
  | "teardown"
  | "loading_return"
  | "en_route_return"
  | "unloading_return"
  | "unwrapping_placement"
  | "walkthrough_photos"
  | "working"
  | "delivering_bins"
  | "collecting_bins"
  | "completed"
  | "en_route"
  | "arrived"
  | "delivering"
  // Office-specific stages (mirrors TrackingStatus)
  | "initial_walkthrough"
  | "it_documentation"
  | "packing_started"
  | "packing_complete"
  | "setup";

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
  return buildPublicDeliveryTrackUrl(d);
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
  return buildPublicDeliveryTrackUrl(d);
}

/**
 * External SMS copy for checkpoint status updates.
 *
 * IMPORTANT: NEVER interpolate the internal crew name (Alpha, Team B,
 * Bravo, etc.) into anything that leaves our system. This applies to
 * BOTH client SMS and partner SMS — partners are external to us too,
 * and operator preference is firm on this. The only place crew names
 * may appear externally is the admin dashboard / dispatch UI, which
 * does not call into this helper.
 *
 * The function used to take a `clientFacing` flag that gated this
 * decision. Removed — partner SMS was the only false-path caller and
 * it was wrong.
 */
function checkpointSmsLine(
  status: PartnerCheckpointStatus,
  jobType: "move" | "delivery",
): string {
  if (jobType === "delivery") {
    switch (status) {
      case "en_route_to_pickup":
        return `Your Yugo crew is on the way to pick up your delivery. We will text again once we are on the road to you.`;
      case "arrived_at_pickup":
        return `Your Yugo crew has reached the pickup location and is loading your order.`;
      case "en_route_to_destination":
      case "en_route":
        return `Your delivery is on the way to you.`;
      case "arrived_at_destination":
      case "arrived":
        return `Your Yugo crew has arrived with your delivery.`;
      case "completed":
        return `Your delivery is complete. Thanks for choosing Yugo.`;
      default:
        return `A quick update on your delivery from Yugo.`;
    }
  }
  switch (status) {
    case "en_route_to_pickup":
      return `Your Yugo crew is on the way. We will text you at each stage.`;
    case "arrived_at_pickup":
      return `Your Yugo crew has arrived and is ready to begin.`;
    case "inventory_check":
    case "loading":
    case "wrapping":
      return `Your crew is on site and taking care of your belongings.`;
    case "en_route_to_destination":
    case "en_route":
      return `Your belongings are on the way to the destination.`;
    case "arrived_at_destination":
    case "arrived":
      return `Your crew has arrived at the destination and is ready to unload.`;
    case "completed":
      return `Your move is complete. Thanks for choosing Yugo.`;
    default:
      return `A quick update on your move from Yugo.`;
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
  /** Site / recipient on B2B multi-stop */
  end_client_phone?: string | null;
};

/**
 * SMS partner contact + end customer on crew checkpoints (alongside email).
 * Dedupes identical phone numbers.
 */
export async function sendPartnerDeliveryCheckpointSms(opts: {
  row: PartnerDeliveryCheckpointRow;
  status: PartnerCheckpointStatus;
  jobType: "delivery";
  /** Retained for call-site compatibility; intentionally unused — SMS
   *  copy is neutral and never carries the internal crew name. */
  teamName?: string;
  notifyPartner: boolean;
  notifyClient: boolean;
}): Promise<void> {
  const { row, status, notifyPartner, notifyClient } = opts;
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

  const endPhone = (
    row.end_client_phone ||
    row.end_customer_phone ||
    row.customer_phone ||
    ""
  ).trim();
  // SMS uses the short /t/[code] URL. The long tokenised URL still fires
  // from email templates that render on wider screens; SMS gets the tidy
  // one so partners and recipients do not see a spam-looking wall of hex.
  const shortUrl =
    row.delivery_number ? buildSmsTrackUrl(row.delivery_number) : deliveryBusinessTrackUrl(row);
  const linePartner = checkpointSmsLine(status, "delivery");
  const lineClient = linePartner;

  // Attach the tracking URL only on the FIRST outgoing checkpoint SMS
  // for this delivery (the "job started" ping). Later checkpoints stay
  // brief — the customer already has the link saved from message #1.
  const isFirstCheckpoint =
    status === "en_route_to_pickup" || status === "en_route";
  const sent = new Set<string>();
  const sendGuarded = async (raw: string, line: string) => {
    const d = digitsOnly(raw);
    if (d.length < 10) return;
    if (sent.has(d)) return;
    sent.add(d);
    const body = isFirstCheckpoint
      ? `${line}\n\nTrack: ${shortUrl}\n\nQuestions? (647) 370-4525`
      : line;
    // Cross-pipeline dedup: same key shape as client-tracking-sms so a
    // second sender for the same {job, stage, phone} tuple no-ops.
    // This is what stops "Chris got two crew-dispatched texts" when the
    // partner contact IS also the customer_phone on the delivery.
    const outcome = await reserveStageNotification(admin, {
      jobType: "delivery",
      jobUuid: row.id,
      status: String(status),
      phone: raw,
      event: `partner_tracking_${status}`,
      message: body,
    });
    if (!outcome.reserved) return;
    const result = await sendSMS(raw, body).catch(() => ({ success: false, error: "send_threw" as const }));
    await finalizeStageNotification(
      admin,
      outcome.id,
      Boolean((result as { success?: boolean }).success),
      (result as { error?: string | null }).error ?? null,
    );
  };

  if (notifyPartner && partnerPhone) {
    await sendGuarded(partnerPhone, linePartner);
  }
  if (notifyClient && endPhone) {
    await sendGuarded(endPhone, lineClient);
  }
}

export type PartnerMoveCheckpointRow = {
  id: string;
  organization_id?: string | null;
  client_phone?: string | null;
  /** Portfolio PM moves — skip SMS entirely; PM partners use the admin
   *  portal for status. When undefined we re-read it from the DB. */
  is_pm_move?: boolean | null;
};

/**
 * Partner / org-linked move (non–b2c org): SMS org phone + move client phone on checkpoints.
 */
export async function sendPartnerMoveCheckpointSms(opts: {
  row: PartnerMoveCheckpointRow;
  status: PartnerCheckpointStatus;
  /** Retained for call-site compatibility; intentionally unused — SMS
   *  copy is neutral and never carries the internal crew name. */
  teamName?: string;
  notifyPartner: boolean;
  notifyClient: boolean;
}): Promise<void> {
  const { row, status, notifyPartner, notifyClient } = opts;
  if (!row.organization_id) return;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("phone, type")
    .eq("id", row.organization_id)
    .maybeSingle();

  if (!org || org.type === "b2c") return;
  if (!notifyPartner && !notifyClient) return;

  // Pull move_code + is_pm_move in one query — also lets us catch PM
  // moves whose row was created before the caller started passing
  // is_pm_move down through PartnerMoveCheckpointRow.
  const { data: m } = await admin
    .from("moves")
    .select("move_code, is_pm_move")
    .eq("id", row.id)
    .maybeSingle();

  // PM portfolio moves: skip SMS to BOTH partner and tenant. The PM org
  // contact phone tends to be wired in as `client_phone` for the move
  // (set in /api/admin/moves/pm-batch), so without this guard the same
  // partner contact gets every checkpoint twice — once via org.phone
  // and once via the move's "client" phone. PM partners use the admin
  // portal for live status; SMS noise is what they're trying to avoid.
  const isPmMove =
    !!(row.is_pm_move ?? (m?.is_pm_move as boolean | null | undefined));
  if (isPmMove) return;

  const orgPhone = (org.phone || "").trim();
  const clientPhone = (row.client_phone || "").trim();
  const shortUrl = m?.move_code
    ? buildSmsTrackUrl(m.move_code)
    : buildPublicMoveTrackUrl({ id: row.id, move_code: m?.move_code ?? null });
  const linePartner = checkpointSmsLine(status, "move");
  const lineClient = linePartner;

  const isFirstCheckpoint =
    status === "en_route_to_pickup" || status === "en_route";
  const sent = new Set<string>();
  const sendGuarded = async (raw: string, line: string) => {
    const d = digitsOnly(raw);
    if (d.length < 10) return;
    if (sent.has(d)) return;
    sent.add(d);
    const body = isFirstCheckpoint
      ? `${line}\n\nTrack: ${shortUrl}\n\nQuestions? (647) 370-4525`
      : line;
    const outcome = await reserveStageNotification(admin, {
      jobType: "move",
      jobUuid: row.id,
      status: String(status),
      phone: raw,
      event: `partner_tracking_${status}`,
      message: body,
    });
    if (!outcome.reserved) return;
    const result = await sendSMS(raw, body).catch(() => ({ success: false, error: "send_threw" as const }));
    await finalizeStageNotification(
      admin,
      outcome.id,
      Boolean((result as { success?: boolean }).success),
      (result as { error?: string | null }).error ?? null,
    );
  };

  if (notifyPartner && orgPhone) await sendGuarded(orgPhone, linePartner);
  if (notifyClient && clientPhone) await sendGuarded(clientPhone, lineClient);
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

  const trackUrl = buildPublicMoveTrackUrl({
    id: moveId,
    move_code: move.move_code ?? null,
  });

  const when = [move.scheduled_date, move.scheduled_time || move.arrival_window]
    .filter(Boolean)
    .join(" · ") || "Scheduled";
  const cn = (move.client_name || "Client").trim();
  // Property manager orgs get a PM-scoped booking email — no live
  // tracking URL (PMs are building admins, not the customer), one
  // clear "here's what's scheduled at your property" message.
  if (org.type === "property_manager") {
    const { partnerPropertyManagerBookingEmail } = await import(
      "@/lib/email-templates"
    );
    const html = partnerPropertyManagerBookingEmail({
      customerName: cn,
      whenLabel: String(when),
      buildingAddress: move.from_address || move.to_address || null,
      moveCode: move.move_code || moveId,
    });
    await sendEmail({
      to: orgEmail,
      subject: "A Yugo move is booked at your property",
      html,
    }).catch(() => {});
    return;
  }

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
