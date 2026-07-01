import type { TrackingStatus } from "@/lib/tracking-status-types";
import { sendSMS } from "@/lib/sms/sendSMS";
import { createAdminClient } from "@/lib/supabase/admin";

// Note: SMS-provider failure alerting moved into sendSMS itself so EVERY
// caller is covered (partner/crew/bin/lead/quote-photo/supplies/etc.), not
// just client tracking. See @/lib/sms/sendSMS.

function digitsOnly(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function firstName(clientName: string | null | undefined): string {
  const s = (clientName || "").trim().split(/\s+/)[0];
  return s || "there";
}

function clientSmsBody(
  status: TrackingStatus,
  jobType: "move" | "delivery",
  clientName: string | null | undefined,
  trackUrl: string | undefined,
  estateMove: boolean,
  eventMove = false,
  eventPhase: string | null = null,
): string {
  const name = firstName(clientName);
  // Put the tracking link in its own paragraph with a clear label, never a bare
  // URL crammed under the message.
  const linkNoun = eventMove ? "event" : jobType;
  const link = trackUrl ? `\n\nTrack your ${linkNoun} here:\n${trackUrl}` : "";

  if (jobType === "move" && eventMove) {
    const phase = String(eventPhase || "").toLowerCase().trim();
    if (phase === "return") {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route_venue":
        case "en_route":
          return `Hi ${name},\n\nYour crew is heading back to the venue to collect your items.${link}`;
        case "arrived_at_pickup":
        case "arrived_venue":
        case "arrived":
          return `Hi ${name},\n\nYour crew has arrived at the venue to pack up.`;
        case "teardown":
          return `Hi ${name},\n\nTeardown is underway at the venue.${link}`;
        case "en_route_return":
        case "en_route_to_destination":
          return `Hi ${name},\n\nYour items are on the way back.${link}`;
        case "completed":
          return `Hi ${name},\n\nEverything is back and your event service is complete. Thank you for trusting Yugo.\n\nWarm regards, Yugo`;
        default:
          return `Hi ${name},\n\nA quick update on your event from Yugo.${link}`;
      }
    }
    switch (status) {
      case "en_route_to_pickup":
      case "en_route":
        return `Hi ${name},\n\nYour crew is on the way to collect your items for the event.${link}`;
      case "arrived_at_pickup":
        return `Hi ${name},\n\nYour crew has arrived to load your items.`;
      case "en_route_venue":
      case "en_route_to_destination":
        return `Hi ${name},\n\nYour items are on the way to the venue.${link}`;
      case "arrived_venue":
      case "arrived_at_destination":
        return `Hi ${name},\n\nYour crew has arrived at the venue and is setting up.`;
      case "completed":
        return `Hi ${name},\n\nYour delivery to the venue is complete. We will return to collect everything after your event.${link}`;
      default:
        return `Hi ${name},\n\nA quick update on your event from Yugo.${link}`;
    }
  }

  if (jobType === "move") {
    if (estateMove) {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route":
          return `Hi ${name},\n\nYour Estate crew is on the way. We will keep you updated every step of the journey.${link}`;
        case "arrived_at_pickup":
          return `Hi ${name},\n\nYour crew has arrived and is ready to begin your Estate move. Everything is in good hands.`;
        case "inventory_check":
        case "loading":
        case "wrapping":
          return `Hi ${name},\n\nYour crew is on site and taking exceptional care of your belongings. We will update you at the next milestone.${link}`;
        case "en_route_to_destination":
          return `Hi ${name},\n\nYour belongings are on the way to your new home. Your crew is handling every item with the utmost care.${link}`;
        case "arrived_at_destination":
          return `Hi ${name},\n\nYour crew has arrived at your new home and is ready to begin unloading. Almost there.`;
        case "completed":
          return `Hi ${name},\n\nYour Estate move is complete. It was a true privilege taking care of you today.\n\nWarm regards, Yugo`;
        case "arrived":
          return `Hi ${name},\n\nYour crew has arrived.${link}`;
        default:
          return `Hi ${name},\n\nA quick update on your Estate move.${link}`;
      }
    }

    switch (status) {
      case "en_route_to_pickup":
      case "en_route":
        return `Hi ${name},\n\nYour moving crew is on the way. We will keep you updated as things progress.${link}`;
      case "arrived_at_pickup":
        return `Hi ${name},\n\nYour crew has arrived and is ready to begin. You are in great hands.`;
      case "inventory_check":
      case "loading":
      case "wrapping":
        return `Hi ${name},\n\nYour crew is on site and taking good care of your belongings. We will check in again at the next step.${link}`;
      case "en_route_to_destination":
        return `Hi ${name},\n\nYour belongings are on the way to your new home.${link}`;
      case "arrived_at_destination":
        return `Hi ${name},\n\nYour crew has arrived at your new home and is ready to unload.`;
      case "completed":
        return `Hi ${name},\n\nYour move is complete. It was a pleasure taking care of you today.\n\nWarm regards, Yugo`;
      case "arrived":
        return `Hi ${name},\n\nYour crew has arrived.${link}`;
      default:
        return `Hi ${name},\n\nA quick update from Yugo.${link}`;
    }
  }

  switch (status) {
    case "en_route_to_pickup":
    case "en_route":
      return `Hi ${name},\n\nYour delivery crew is on the way. We will keep you posted.${link}`;
    case "arrived_at_pickup":
      return `Hi ${name},\n\nYour crew has arrived at the pickup location and is preparing your delivery.`;
    case "en_route_to_destination":
      return `Hi ${name},\n\nYour delivery is on the way to you.${link}`;
    case "arrived_at_destination":
    case "arrived":
      return `Hi ${name},\n\nYour crew has arrived with your delivery. We hope everything is perfect.`;
    case "completed":
      return `Hi ${name},\n\nYour delivery is complete. Thank you for trusting Yugo.\n\nWarm regards, Yugo`;
    default:
      return `Hi ${name},\n\nA quick update on your delivery from Yugo.${link}`;
  }
}

/** Sends a transactional SMS to the end client when email also goes out. Fire-and-forget logging. */
export async function sendClientTrackingCheckpointSms(opts: {
  status: TrackingStatus;
  jobType: "move" | "delivery";
  phone: string | null | undefined;
  clientName: string | null | undefined;
  trackUrl: string | undefined;
  estateMove: boolean;
  eventMove?: boolean;
  eventPhase?: string | null;
  jobUuid: string;
}): Promise<void> {
  const raw = (opts.phone || "").trim();
  if (digitsOnly(raw).length < 10) return;

  const body = clientSmsBody(
    opts.status,
    opts.jobType,
    opts.clientName,
    opts.trackUrl,
    opts.estateMove,
    opts.eventMove ?? false,
    opts.eventPhase ?? null,
  ).slice(0, 1500);

  const result = await sendSMS(raw, body);
  try {
    const admin = createAdminClient();
    await admin.from("notification_log").insert({
      channel: "sms",
      event: `tracking_${opts.status}`,
      recipient_phone: raw,
      message: body,
      status: result.success ? "sent" : "failed",
      error: result.success ? null : result.error ?? "send failed",
      job_id: opts.jobUuid,
      job_type: opts.jobType,
    });
  } catch {
    /* logging is best-effort */
  }
  // Systemic-failure alerting now lives in sendSMS so this caller (and every
  // other one) automatically benefits without duplicate calls.
}
