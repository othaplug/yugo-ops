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
    clientMessage: "",
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

  const html = `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;padding:8px 20px;border-radius:9999px;background:#0F0F0F;border:1px solid rgba(201,169,98,0.35);font-family:'Instrument Serif',Georgia,serif;font-size:14px;font-weight:600;letter-spacing:1.5px;color:#C9A962">OPS+</div>
      </div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${cfg.clientMessage || "Status update"}</h1>
      <p style="font-size:14px;color:#B0ADA8;margin-bottom:24px">${status === "completed" ? "Thank you for choosing Yugo. We hope your move went smoothly." : "Your crew has updated the status of your job."}</p>
      ${trackUrl ? `<a href="${trackUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none">Track your job →</a>` : ""}
    </div>
  `;

  const toSend: string[] = [];
  if (cfg.notifyClient && clientEmail) toSend.push(clientEmail);
  if (cfg.notifyPartner && partnerEmail && !toSend.includes(partnerEmail)) toSend.push(partnerEmail);
  if (toSend.length === 0) return;

  for (const to of toSend) {
    try {
      await resend.emails.send({
        from: "OPS+ <notifications@opsplus.co>",
        to,
        subject,
        html,
        headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
      });
    } catch {}
  }
}
