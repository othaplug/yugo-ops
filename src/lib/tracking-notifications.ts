import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { getEmailFrom, sendEmail } from "@/lib/email/send";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatJobId } from "@/lib/move-code";
import {
  PREMIUM_TRACK_CTA_LABEL,
  PREMIUM_TRACK_DELIVERY_CTA_LABEL,
  statusUpdateEmailHtml,
} from "@/lib/email-templates";

export type TrackingStatus =
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

const CONFIG: Record<
  string,
  { notifyClient: boolean; notifyAdmin: boolean; notifyPartner: boolean }
> = {
  en_route_to_pickup: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  arrived_at_pickup: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  loading: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  en_route_to_destination: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  arrived_at_destination: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  unloading: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  completed: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  en_route: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  arrived: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  delivering: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
};

/** Email headline: move copy never references delivery; delivery copy never references a move. */
function headlineForTrackingCheckpoint(
  status: TrackingStatus,
  jobType: "move" | "delivery",
): string {
  if (jobType === "move") {
    switch (status) {
      case "en_route_to_pickup":
        return "Your crew is on the way. We will keep you updated as your move day unfolds.";
      case "arrived_at_pickup":
        return "Your crew has arrived and is ready to begin. You are in good hands.";
      case "en_route_to_destination":
        return "Everything is loaded and your crew is now heading to your new home.";
      case "arrived_at_destination":
        return "Your crew has arrived and is ready to unload. You are almost there.";
      case "completed":
        return "Your move is complete. It was a privilege to take care of you today.";
      case "en_route":
        return "Your crew is on the way. We will notify you when they arrive.";
      case "arrived":
        return "Your crew has arrived at your address.";
      default:
        return "A status update on your move";
    }
  }
  switch (status) {
    case "en_route_to_pickup":
      return "Your crew is on the way to collect your delivery.";
    case "en_route":
      return "Your delivery is underway. We will notify you when your crew arrives.";
    case "arrived_at_pickup":
      return "Your crew has arrived and is ready to load your items for delivery.";
    case "en_route_to_destination":
      return "Your delivery is on its way to you.";
    case "arrived_at_destination":
      return "Your crew has arrived. Your delivery will be placed shortly.";
    case "completed":
      return "Your delivery is complete. Thank you for choosing Yugo.";
    case "arrived":
      return "Your crew has arrived with your delivery.";
    default:
      return "A status update on your delivery";
  }
}

export async function notifyOnCheckpoint(
  status: TrackingStatus,
  jobId: string,
  jobType: "move" | "delivery",
  teamName: string,
  jobName: string,
  fromAddress?: string,
  toAddress?: string,
): Promise<void> {
  let cfg = CONFIG[status] || {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  };
  if (
    jobType === "delivery" &&
    (status === "en_route_to_pickup" || status === "en_route")
  ) {
    cfg = { ...cfg, notifyClient: false };
  }
  const admin = createAdminClient();

  const adminMessage =
    status === "completed"
      ? `${teamName} completed ${jobName}`
      : status === "en_route_to_pickup" || status === "en_route"
        ? `${teamName} started en route to pickup for ${jobName}`
        : status === "arrived_at_pickup"
          ? `${teamName} arrived at pickup ${fromAddress || "-"}`
          : status === "en_route_to_destination"
            ? `${teamName} en route to destination ${toAddress || "-"}`
            : status === "arrived_at_destination" || status === "arrived"
              ? `${teamName} arrived at ${toAddress || "-"}`
              : `${teamName} ${status}`;

  if (cfg.notifyAdmin) {
    try {
      const entityId =
        jobType === "move"
          ? (
              await admin
                .from("moves")
                .select("move_code")
                .eq("id", jobId)
                .single()
            ).data?.move_code || jobId
          : (
              await admin
                .from("deliveries")
                .select("delivery_number")
                .eq("id", jobId)
                .single()
            ).data?.delivery_number || jobId;
      await admin.from("status_events").insert({
        entity_type: jobType,
        entity_id: entityId,
        event_type: "tracking",
        description: adminMessage,
        icon: "truck",
      });
    } catch {}
  }

  if (!cfg.notifyClient && !cfg.notifyPartner) return;
  if (!process.env.RESEND_API_KEY) return;

  const resend = getResend();
  let clientEmail: string | null = null;
  let partnerEmail: string | null = null;
  let trackUrl: string | undefined;
  let moveCode: string | undefined;
  let moveFromAddress: string | undefined;
  let moveToAddress: string | undefined;
  let moveClientName: string | undefined;

  if (jobType === "move") {
    const { data: move } = await admin
      .from("moves")
      .select(
        "id, client_email, move_code, from_address, to_address, client_name",
      )
      .eq("id", jobId)
      .single();
    if (move) {
      clientEmail = move.client_email || null;
      trackUrl = `${getEmailBaseUrl()}/track/move/${move.move_code || move.id}?token=${signTrackToken("move", move.id)}`;
      moveCode = move.move_code || move.id;
      moveFromAddress = move.from_address || undefined;
      moveToAddress = move.to_address || undefined;
      moveClientName = move.client_name || undefined;
    }
  } else {
    const { data: delivery } = await admin
      .from("deliveries")
      .select("id, delivery_number, client_name, customer_email")
      .eq("id", jobId)
      .single();
    if (delivery) {
      const custEmail = (delivery.customer_email || "").trim() || null;
      if (delivery.client_name) {
        const { data: org } = await admin
          .from("organizations")
          .select("email")
          .eq("name", delivery.client_name)
          .limit(1)
          .maybeSingle();
        partnerEmail = org?.email || custEmail;
      } else {
        partnerEmail = custEmail;
      }
      trackUrl = `${getEmailBaseUrl()}/track/delivery/${delivery.delivery_number}?token=${signTrackToken("delivery", delivery.id)}`;
      moveCode = delivery.delivery_number;
    }
  }

  const subject =
    status === "completed"
      ? jobType === "delivery"
        ? `Your delivery is complete - ${formatJobId(moveCode || jobId, jobType)}`
        : `Your move is complete - ${formatJobId(moveCode || jobId, jobType)}`
      : `Your crew update - ${formatJobId(moveCode || jobId, jobType)}`;

  const headline = headlineForTrackingCheckpoint(status, jobType);
  const body =
    status === "completed"
      ? jobType === "delivery"
        ? "It was a pleasure taking care of you today. Thank you for choosing Yugo."
        : "It was a pleasure taking care of you today. Your documents and receipt are available in your portal."
      : jobType === "delivery"
        ? "Your crew has provided a live update. Track your delivery in real time using the link below."
        : "Your crew has provided a live update. Track your move in real time using the link below.";
  const html = statusUpdateEmailHtml({
    headline,
    body,
    ctaUrl: trackUrl,
    ctaLabel: trackUrl
      ? jobType === "delivery"
        ? PREMIUM_TRACK_DELIVERY_CTA_LABEL
        : PREMIUM_TRACK_CTA_LABEL
      : undefined,
    includeFooter: false,
    eyebrow: status === "completed" ? "Complete" : "Live update",
  });

  const toSend: string[] = [];
  if (cfg.notifyClient && clientEmail) toSend.push(clientEmail);
  if (cfg.notifyPartner && partnerEmail && !toSend.includes(partnerEmail))
    toSend.push(partnerEmail);
  if (toSend.length === 0) return;

  // For move completion, send full "move complete" email (with portal/documents link) to client
  if (status === "completed" && jobType === "move" && clientEmail && trackUrl) {
    try {
      await sendEmail({
        to: clientEmail,
        subject: `Your move is complete ${formatJobId(moveCode || jobId, jobType)}`,
        template: "move-complete",
        data: {
          clientName: moveClientName ?? "",
          moveCode: moveCode || jobId,
          fromAddress: moveFromAddress ?? "",
          toAddress: moveToAddress ?? "",
          completedDate: new Date().toISOString(),
          trackingUrl: trackUrl,
        },
      });
    } catch {}
  }

  // Generic status email: for moves we already sent move-complete to client, so only send to partner if any
  const toSendGeneric =
    status === "completed" && jobType === "move" && clientEmail
      ? toSend.filter((e) => e !== clientEmail)
      : toSend;

  const emailFrom = await getEmailFrom();
  for (const to of toSendGeneric) {
    try {
      await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        html,
        headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
      });
    } catch {}
  }
}
