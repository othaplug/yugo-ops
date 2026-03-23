import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import crypto from "crypto";

/**
 * POST /api/webhooks/square
 *
 * Handles Square webhook events:
 *  - card.expiring         — card on file about to expire (sent ~30 days out)
 *  - payment.updated       — payment status changes (for reconciliation)
 *  - customer.updated      — customer record changes
 *
 * Square signs each webhook with HMAC-SHA256 using the webhook signature key.
 * https://developer.squareup.com/docs/webhooks/validate-webhook-signature
 */

function verifySquareSignature(
  body: string,
  signature: string,
  url: string,
  sigKey: string,
): boolean {
  const hmac = crypto.createHmac("sha256", sigKey);
  hmac.update(url + body);
  const expected = hmac.digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const rawBody = await req.text();

  // Verify signature in production
  if (sigKey) {
    const signature = req.headers.get("x-square-hmacsha256-signature") || "";
    const webhookUrl = `${getEmailBaseUrl()}/api/webhooks/square`;
    if (!verifySquareSignature(rawBody, signature, webhookUrl, sigKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: {
    type: string;
    data?: {
      object?: {
        customer_id?: string;
        card?: { id?: string; exp_month?: number; exp_year?: number; card_brand?: string; last_4?: string };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log to webhook_logs for visibility
  const supabase = createAdminClient();
  await supabase.from("webhook_logs").insert({
    source: "square",
    event_type: event.type,
    payload: event,
    status: "received",
  }).then(() => {});

  if (event.type === "card.expiring") {
    await handleCardExpiring(event, supabase);
  }

  return NextResponse.json({ ok: true });
}

async function handleCardExpiring(
  event: {
    data?: { object?: { customer_id?: string; card?: { id?: string } } };
  },
  supabase: ReturnType<typeof createAdminClient>,
) {
  const customerId = event.data?.object?.customer_id;
  if (!customerId) return;

  const baseUrl = getEmailBaseUrl();

  // ── Check if this customer is a partner ─────────────────────────────────
  const { data: partner } = await supabase
    .from("organizations")
    .select("id, name, email, billing_email, card_last_four, card_brand")
    .eq("square_customer_id", customerId)
    .eq("card_on_file", true)
    .maybeSingle();

  if (partner) {
    const partnerEmail = partner.billing_email || partner.email;
    if (partnerEmail) {
      await sendEmail({
        to: partnerEmail,
        subject: "Your payment card on file is expiring soon",
        template: "partner-card-expiring",
        data: {
          partnerName: partner.name,
          cardBrand: partner.card_brand || "Card",
          cardLastFour: partner.card_last_four || "••••",
          updateCardUrl: `${baseUrl}/partner/settings/billing`,
        },
      }).catch(() => {});
    }

    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `Card expiring — ${partner.name}`,
        template: "admin-card-expiring-notice",
        data: {
          entityType: "partner",
          entityName: partner.name,
          cardLastFour: partner.card_last_four || "••••",
          updateCardUrl: `${baseUrl}/admin/clients/${partner.id}?tab=portal`,
        },
      }).catch(() => {});
    }
    return;
  }

  // ── Check if this customer is a client (move with upcoming date) ────────
  const { data: move } = await supabase
    .from("moves")
    .select("id, move_code, client_name, client_email, client_phone, scheduled_date")
    .eq("square_customer_id", customerId)
    .gte("scheduled_date", new Date().toISOString().split("T")[0])
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!move) return;

  const firstName = move.client_name?.split(" ")[0] || "there";

  // Send SMS to client
  if (move.client_phone) {
    const phone = normalizePhone(move.client_phone);
    if (phone) {
      const trackToken = signTrackToken("move", move.id);
      const trackUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;
      await sendSMS(
        phone,
        `Hi ${firstName}, the card on file for your upcoming Yugo move expires soon. Please update it here: ${trackUrl}`,
      ).catch(() => {});
    }
  }

  // Send email to client
  if (move.client_email) {
    const trackToken = signTrackToken("move", move.id);
    const trackUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;
    await sendEmail({
      to: move.client_email,
      subject: "Your payment card expires soon — action needed",
      template: "client-card-expiring",
      data: {
        clientName: move.client_name || "there",
        moveCode: move.move_code,
        moveDate: move.scheduled_date,
        updateCardUrl: trackUrl,
      },
    }).catch(() => {});
  }
}
