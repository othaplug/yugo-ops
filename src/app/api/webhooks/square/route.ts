import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { runB2BOneOffPaymentRecordedFlow } from "@/lib/b2b-delivery-payment";
import crypto from "crypto";

/**
 * POST /api/webhooks/square
 *
 * Handles Square webhook events:
 *  - card.expiring         — card on file about to expire (sent ~30 days out)
 *  - payment.updated       — payment status changes (for reconciliation)
 *  - invoice.updated       — when an invoice is paid, sync DB + B2B one-off delivery prepay flow
 *  - customer.updated      — customer record changes
 *
 * Subscribe `invoice.updated` in Square Developer Dashboard for the same webhook URL.
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

type SquareWebhookEvent = {
  type?: string;
  merchant_id?: string;
  event_id?: string;
  data?: { type?: string; id?: string; object?: Record<string, unknown> };
};

function stableSquareEventId(rawBody: string, event: SquareWebhookEvent): string {
  if (event.event_id && typeof event.event_id === "string") return event.event_id;
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

type IdempotencyOutcome = "new" | "duplicate" | "error";

async function consumeSquareEventOnce(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<IdempotencyOutcome> {
  const { error } = await supabase.from("webhook_idempotency_keys").insert({
    source: "square",
    event_id: eventId,
  });
  if (!error) return "new";
  if (error.code === "23505") return "duplicate";
  console.error("[square webhook] idempotency insert:", error.message);
  return "error";
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

  let event: SquareWebhookEvent;

  try {
    event = JSON.parse(rawBody) as SquareWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const eventId = stableSquareEventId(rawBody, event);
  const idem = await consumeSquareEventOnce(supabase, eventId);
  if (idem === "error") {
    return NextResponse.json({ error: "Failed to record webhook idempotency" }, { status: 500 });
  }
  if (idem === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await supabase.from("webhook_logs").insert({
    source: "square",
    event_type: event.type ?? "unknown",
    payload: event,
    status: "received",
  });

  if (event.type === "card.expiring") {
    await handleCardExpiring(event, supabase);
  }

  if (event.type === "payment.updated") {
    await handlePaymentUpdated(event, supabase);
  }

  if (event.type === "invoice.updated") {
    await handleInvoiceUpdated(event, supabase);
  }

  return NextResponse.json({ ok: true });
}

function extractSquareInvoiceIdFromWebhook(event: SquareWebhookEvent): string | null {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return null;
  if (typeof data.id === "string" && data.type === "invoice") return data.id;
  const obj = data.object as Record<string, unknown> | undefined;
  if (obj && typeof obj === "object") {
    const inv = obj.invoice as Record<string, unknown> | undefined;
    if (inv && typeof inv.id === "string") return inv.id;
    if (typeof obj.id === "string") return obj.id;
  }
  if (typeof data.id === "string") return data.id;
  return null;
}

async function handleInvoiceUpdated(
  event: SquareWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const invoiceId = extractSquareInvoiceIdFromWebhook(event);
  if (!invoiceId) return;
  if (!(process.env.SQUARE_ACCESS_TOKEN || "").trim()) return;

  let status: string | undefined;
  let publicUrl: string | null = null;
  try {
    const res = await squareClient.invoices.get({ invoiceId });
    status = res.invoice?.status as string | undefined;
    publicUrl = res.invoice?.publicUrl ?? null;
  } catch (e) {
    console.error("[square webhook] invoices.get failed:", e);
    return;
  }

  if (status !== "PAID") return;

  const { data: invRow } = await supabase
    .from("invoices")
    .select("id, delivery_id, status, square_invoice_url")
    .eq("square_invoice_id", invoiceId)
    .maybeSingle();

  if (!invRow?.id) return;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "paid",
    updated_at: now,
  };
  if (publicUrl) patch.square_invoice_url = publicUrl;

  await supabase.from("invoices").update(patch).eq("id", invRow.id);

  await supabase.from("webhook_logs").insert({
    source: "square",
    event_type: "invoice.updated.paid",
    payload: { invoice_id: invoiceId, delivery_id: invRow.delivery_id },
    status: "processed",
  });

  const deliveryId = invRow.delivery_id;
  if (!deliveryId) return;

  const { data: del } = await supabase
    .from("deliveries")
    .select("booking_type, organization_id")
    .eq("id", deliveryId)
    .maybeSingle();

  if (del?.booking_type !== "one_off" || del.organization_id) return;

  try {
    await runB2BOneOffPaymentRecordedFlow(deliveryId, { notifyMode: "only_if_newly_paid" });
  } catch (e) {
    console.error("[square webhook] B2B one-off payment flow:", e);
  }
}

async function handlePaymentUpdated(
  event: SquareWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const raw = event.data?.object as Record<string, unknown> | undefined;
  const nested =
    raw && typeof raw.payment === "object" && raw.payment !== null
      ? (raw.payment as Record<string, unknown>)
      : raw;
  const paymentId =
    (typeof nested?.id === "string" ? nested.id : null) ||
    (typeof event.data?.id === "string" ? event.data.id : null);
  if (!paymentId) return;

  await supabase
    .from("webhook_logs")
    .insert({
      source: "square",
      event_type: "payment.updated.detail",
      payload: {
        payment_id: paymentId,
        status: nested?.status,
        reference_id: nested?.reference_id,
      },
      status: "processed",
    })
    .then(() => {});
}

async function handleCardExpiring(
  event: SquareWebhookEvent,
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
        subject: `Card expiring, ${partner.name}`,
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
        [
          `Hi ${firstName},`,
          `The card on file for your upcoming Yugo move expires soon.`,
          `Please update it here:\n${trackUrl}`,
        ].join("\n\n"),
      ).catch(() => {});
    }
  }

  // Send email to client
  if (move.client_email) {
    const trackToken = signTrackToken("move", move.id);
    const trackUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;
    await sendEmail({
      to: move.client_email,
      subject: "Your payment card expires soon, action needed",
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
