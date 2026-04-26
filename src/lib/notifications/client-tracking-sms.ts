import type { TrackingStatus } from "@/lib/tracking-status-types";
import { sendSMS } from "@/lib/sms/sendSMS";
import { createAdminClient } from "@/lib/supabase/admin";

function digitsOnly(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function trackingSmsFirstName(clientName: string | null | undefined): string {
  const s = (clientName || "").trim().split(/\s+/)[0];
  return s || "there";
}

function clientSmsBody(
  status: TrackingStatus,
  jobType: "move" | "delivery",
  clientName: string | null | undefined,
  trackUrl: string | undefined,
  estateMove: boolean,
): string {
  const hi = trackingSmsFirstName(clientName);
  const link = trackUrl ? `\n${trackUrl}` : "";
  if (jobType === "move") {
    if (estateMove) {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route":
          return `Hi ${hi}, your Estate crew is on the way. We will keep you posted.${link}`;
        case "arrived_at_pickup":
          return `Hi ${hi}, your crew has arrived and is ready to begin your Estate move.${link}`;
        case "inventory_check":
        case "loading":
        case "wrapping":
          return `Hi ${hi}, your crew is working on site. We will update you at the next step.${link}`;
        case "en_route_to_destination":
          return `Hi ${hi}, your load is on the way to your new home.${link}`;
        case "arrived_at_destination":
          return `Hi ${hi}, your crew has arrived and is ready to unload.${link}`;
        case "completed":
          return `Hi ${hi}, your Estate move is complete. Thank you for choosing Yugo.`;
        case "arrived":
          return `Hi ${hi}, your crew has arrived.${link}`;
        default:
          return `Hi ${hi}, here is a quick update on your Estate move.${link}`;
      }
    }
    switch (status) {
      case "en_route_to_pickup":
      case "en_route":
        return `Hi ${hi}, your moving team is on the way. We will keep you posted.${link}`;
      case "arrived_at_pickup":
        return `Hi ${hi}, your crew has arrived at pickup.${link}`;
      case "inventory_check":
      case "loading":
      case "wrapping":
        return `Hi ${hi}, your crew is working on site. We will update you at the next step.${link}`;
      case "en_route_to_destination":
        return `Hi ${hi}, your belongings are on the way to your new home.${link}`;
      case "arrived_at_destination":
        return `Hi ${hi}, your crew has arrived at your new home.${link}`;
      case "completed":
        return `Hi ${hi}, your move is complete. Thank you for choosing Yugo.`;
      case "arrived":
        return `Hi ${hi}, your crew has arrived.${link}`;
      default:
        return `Hi ${hi}, here is a quick update from Yugo.${link}`;
    }
  }
  switch (status) {
    case "en_route_to_pickup":
    case "en_route":
      return `Hi ${hi}, your delivery crew is on the way. We will keep you posted.${link}`;
    case "arrived_at_pickup":
      return `Hi ${hi}, your crew has arrived at pickup.${link}`;
    case "en_route_to_destination":
      return `Hi ${hi}, your delivery is on the way to you.${link}`;
    case "arrived_at_destination":
    case "arrived":
      return `Hi ${hi}, your crew has arrived with your delivery.${link}`;
    case "completed":
      return `Hi ${hi}, your delivery is complete. Thank you for choosing Yugo.`;
    default:
      return `Hi ${hi}, here is a quick delivery update from Yugo.${link}`;
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
}
