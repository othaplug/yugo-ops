import type { TrackingStatus } from "@/lib/tracking-status-types";
import { sendSMS } from "@/lib/sms/sendSMS";
import { formatJobId } from "@/lib/move-code";
import { createAdminClient } from "@/lib/supabase/admin";

function digitsOnly(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function clientSmsBody(
  status: TrackingStatus,
  jobType: "move" | "delivery",
  jobCode: string,
  trackUrl: string | undefined,
  estateMove: boolean,
): string {
  const id = formatJobId(jobCode, jobType);
  const tail = trackUrl ? ` ${trackUrl}` : "";
  if (jobType === "move") {
    if (estateMove) {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route":
          return `Your Estate crew is on the way | ${id}${tail}`;
        case "arrived_at_pickup":
          return `Your crew has arrived and is ready to begin your Estate move | ${id}${tail}`;
        case "en_route_to_destination":
          return `Your load is on the way to your new home | ${id}${tail}`;
        case "arrived_at_destination":
          return `Your crew has arrived and is ready to unload | ${id}${tail}`;
        case "completed":
          return `Your Estate move is complete. Thank you for choosing Yugo | ${id}`;
        case "arrived":
          return `Your crew has arrived | ${id}${tail}`;
        default:
          return `Estate move update | ${id}${tail}`;
      }
    }
    switch (status) {
      case "en_route_to_pickup":
      case "en_route":
        return `Your moving team is on the way | ${id}${tail}`;
      case "arrived_at_pickup":
        return `Your crew has arrived at pickup | ${id}${tail}`;
      case "en_route_to_destination":
        return `Your belongings are on the way to your new home | ${id}${tail}`;
      case "arrived_at_destination":
        return `Your crew has arrived at your new home | ${id}${tail}`;
      case "completed":
        return `Your move is complete. Thank you for choosing Yugo | ${id}`;
      case "arrived":
        return `Your crew has arrived | ${id}${tail}`;
      default:
        return `Move update from Yugo | ${id}${tail}`;
    }
  }
  switch (status) {
    case "en_route_to_pickup":
    case "en_route":
      return `Your delivery crew is on the way | ${id}${tail}`;
    case "arrived_at_pickup":
      return `Your crew has arrived at pickup | ${id}${tail}`;
    case "en_route_to_destination":
      return `Your delivery is on the way to you | ${id}${tail}`;
    case "arrived_at_destination":
    case "arrived":
      return `Your crew has arrived with your delivery | ${id}${tail}`;
    case "completed":
      return `Your delivery is complete. Thank you for choosing Yugo | ${id}`;
    default:
      return `Delivery update from Yugo | ${id}${tail}`;
  }
}

/** Sends a transactional SMS to the end client when email also goes out. Fire-and-forget logging. */
export async function sendClientTrackingCheckpointSms(opts: {
  status: TrackingStatus;
  jobType: "move" | "delivery";
  phone: string | null | undefined;
  jobCode: string;
  trackUrl: string | undefined;
  estateMove: boolean;
  jobUuid: string;
}): Promise<void> {
  const raw = (opts.phone || "").trim();
  if (digitsOnly(raw).length < 10) return;

  const body = clientSmsBody(
    opts.status,
    opts.jobType,
    opts.jobCode,
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
