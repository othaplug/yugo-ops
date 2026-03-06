import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatJobId } from "@/lib/move-code";

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

const CONFIG: Record<string, { notifyClient: boolean; notifyAdmin: boolean; notifyPartner: boolean; clientMessage: string }> = {
  en_route_to_pickup: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
    clientMessage: "Your Yugo crew is on the way!",
  },
  arrived_at_pickup: {
    notifyClient: false,
    notifyAdmin: true,
    notifyPartner: false,
    clientMessage: "Your crew has arrived at the pickup location.",
  },
  loading: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
    clientMessage: "",
  },
  en_route_to_destination: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
    clientMessage: "Your items are on the way to your new home!",
  },
  arrived_at_destination: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
    clientMessage: "Your crew has arrived!",
  },
  unloading: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
    clientMessage: "",
  },
  completed: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
    clientMessage: "Your move is complete. Thank you for choosing Yugo!",
  },
  en_route: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
    clientMessage: "Your delivery is on the way!",
  },
  arrived: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
    clientMessage: "Your crew has arrived!",
  },
  delivering: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
    clientMessage: "",
  },
};

export async function notifyOnCheckpoint(
  status: TrackingStatus,
  jobId: string,
  jobType: "move" | "delivery",
  teamName: string,
  jobName: string,
  fromAddress?: string,
  toAddress?: string
): Promise<void> {
  const cfg = CONFIG[status] || { notifyClient: false, notifyAdmin: false, notifyPartner: false, clientMessage: "" };
  const admin = createAdminClient();

  const adminMessage = status === "completed"
    ? `${teamName} completed ${jobName}`
    : status === "en_route_to_pickup" || status === "en_route"
      ? `${teamName} started — en route to pickup for ${jobName}`
      : status === "arrived_at_pickup"
        ? `${teamName} arrived at pickup — ${fromAddress || "—"}`
        : status === "en_route_to_destination"
          ? `${teamName} en route to destination — ${toAddress || "—"}`
          : status === "arrived_at_destination" || status === "arrived"
            ? `${teamName} arrived at ${toAddress || "—"}`
            : `${teamName} — ${status}`;

  if (cfg.notifyAdmin) {
    try {
      const entityId = jobType === "move"
        ? (await admin.from("moves").select("move_code").eq("id", jobId).single()).data?.move_code || jobId
        : (await admin.from("deliveries").select("delivery_number").eq("id", jobId).single()).data?.delivery_number || jobId;
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

  if (jobType === "move") {
    const { data: move } = await admin.from("moves").select("id, client_email, move_code").eq("id", jobId).single();
    if (move) {
      clientEmail = move.client_email || null;
      trackUrl = `${getEmailBaseUrl()}/track/move/${move.move_code || move.id}?token=${signTrackToken("move", move.id)}`;
      moveCode = move.move_code || move.id;
    }
  } else {
    const { data: delivery } = await admin.from("deliveries").select("id, delivery_number, client_name, customer_email").eq("id", jobId).single();
    if (delivery) {
      const custEmail = (delivery.customer_email || "").trim() || null;
      if (delivery.client_name) {
        const { data: org } = await admin.from("organizations").select("email").eq("name", delivery.client_name).limit(1).maybeSingle();
        partnerEmail = org?.email || custEmail;
      } else {
        partnerEmail = custEmail;
      }
      trackUrl = `${getEmailBaseUrl()}/track/delivery/${delivery.delivery_number}?token=${signTrackToken("delivery", delivery.id)}`;
      moveCode = delivery.delivery_number;
    }
  }

  const subject = status === "completed"
    ? `Your move is complete — ${formatJobId(moveCode || jobId, jobType)}`
    : `Your crew is on the way — ${formatJobId(moveCode || jobId, jobType)}`;

  const isComplete = status === "completed";
  const subtext = isComplete
    ? "Thank you for choosing Yugo. We hope your move went smoothly."
    : "Your crew has updated the status of your job.";
  const ctaLabel = isComplete ? "View summary →" : "Track your job →";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5F3EF;-webkit-font-smoothing:antialiased">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <!-- Header with logo -->
  <div style="text-align:center;margin-bottom:32px">
    <div style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;letter-spacing:2px;color:#2C3E2D">YUGO</div>
    <div style="width:40px;height:2px;background:#C9A962;margin:12px auto 0"></div>
  </div>

  <!-- Card -->
  <div style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <!-- Gold accent bar -->
    <div style="height:3px;background:linear-gradient(90deg,#C9A962,#E8D5A3,#C9A962)"></div>

    <div style="padding:36px 32px 32px">
      <!-- Hero text -->
      <h1 style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;line-height:1.3;margin:0 0 12px;color:#2C3E2D;text-align:center">${cfg.clientMessage || "Status update"}</h1>
      <p style="font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.6;color:#6B7C6B;margin:0 0 28px;text-align:center">${subtext}</p>

      <!-- CTA button -->
      ${trackUrl ? `
      <div style="text-align:center">
        <a href="${trackUrl}" style="display:inline-block;font-family:'DM Sans',sans-serif;background:#C9A962;color:#1A1A1A;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px">${ctaLabel}</a>
      </div>` : ""}
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;margin-top:28px">
    <p style="font-family:'DM Sans',sans-serif;font-size:11px;color:#A0A0A0;margin:0">Yugo Moving & Logistics · Toronto, Canada</p>
  </div>
</div>
</body>
</html>
  `.trim();

  const toSend: string[] = [];
  if (cfg.notifyClient && clientEmail) toSend.push(clientEmail);
  if (cfg.notifyPartner && partnerEmail && !toSend.includes(partnerEmail)) toSend.push(partnerEmail);
  if (toSend.length === 0) return;

  for (const to of toSend) {
    try {
      await resend.emails.send({
        from: "YUGO <notifications@opsplus.co>",
        to,
        subject,
        html,
        headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
      });
    } catch {}
  }
}
