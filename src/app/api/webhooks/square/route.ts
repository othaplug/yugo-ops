import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { isSquareInvoicePaidStatus, markLocalInvoicePaidFromSquare } from "@/lib/square-invoice-paid";
import crypto from "crypto";

/**
 * POST /api/webhooks/square
 *
 * Handles Square webhook events:
 *  - card.expiring         — card on file about to expire (sent ~30 days out)
 *  - payment.updated       — COMPLETED invoice card payments: resolve invoice via order id and mark Ops paid (backup if invoice.updated was missed)
 *  - invoice.updated       — when an invoice is paid, sync DB + B2B one-off delivery prepay flow; when Square no longer has the invoice (removed), delete the local row
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
  if (!signature?.trim()) return false;
  const hmac = crypto.createHmac("sha256", sigKey);
  hmac.update(url + body);
  const expected = hmac.digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Square signs with the exact notification URL from the Developer Console; host/proto must match the inbound request. */
function collectSquareWebhookNotificationUrlCandidates(req: NextRequest): string[] {
  const path = "/api/webhooks/square";
  const set = new Set<string>();

  const explicit = (process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || "").trim();
  if (explicit) set.add(explicit.replace(/\/$/, ""));

  const bases = [
    getEmailBaseUrl(),
    (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, ""),
    (process.env.NEXT_PUBLIC_EMAIL_APP_URL || "").trim().replace(/\/$/, ""),
  ];
  for (const b of bases) {
    if (b) set.add(`${b}${path}`);
  }

  const vercel = (process.env.VERCEL_URL || "").trim();
  if (vercel) set.add(`https://${vercel.replace(/\/$/, "")}${path}`);

  const hostRaw = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (hostRaw) {
    const host = hostRaw.split(",")[0].trim();
    let proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
    if (!proto) {
      proto =
        req.headers.get("x-forwarded-ssl") === "on" ||
        (process.env.VERCEL === "1" && !host.includes("localhost"))
          ? "https"
          : "http";
    }
    set.add(`${proto}://${host}${path}`);
  }

  return [...set].filter(Boolean);
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

  // Verify signature: must use the same notification URL Square has in the app (often differs from NEXT_PUBLIC_APP_URL).
  if (sigKey) {
    const signature = req.headers.get("x-square-hmacsha256-signature") || "";
    const candidates = collectSquareWebhookNotificationUrlCandidates(req);
    const ok = candidates.some((url) => verifySquareSignature(rawBody, signature, url, sigKey));
    if (!ok) {
      console.error("[square webhook] signature mismatch; check SQUARE_WEBHOOK_NOTIFICATION_URL or webhook URL in Square dashboard", {
        triedHosts: candidates.slice(0, 6),
      });
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

function squareInvoiceFetchIndicatesMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    statusCode?: number;
    status?: number;
    errors?: Array<{ code?: string; category?: string }>;
    message?: string;
  };
  if (e.statusCode === 404 || e.status === 404) return true;
  const code = e.errors?.[0]?.code;
  if (code === "NOT_FOUND") return true;
  const msg = String(e.message || "").toLowerCase();
  if (msg.includes("not found") || msg.includes("404")) return true;
  return false;
}

function extractSquareInvoiceIdFromWebhook(event: SquareWebhookEvent): string | null {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const dataType = data.type != null ? String(data.type).toLowerCase() : "";
  if (typeof data.id === "string" && (!dataType || dataType === "invoice")) {
    return data.id;
  }
  const obj = data.object as Record<string, unknown> | undefined;
  if (obj && typeof obj === "object") {
    const inv = obj.invoice as Record<string, unknown> | undefined;
    if (inv && typeof inv.id === "string") return inv.id;
    const o = obj as { id?: unknown; order_id?: unknown; status?: unknown };
    if (typeof o.id === "string" && (o.order_id != null || typeof o.status === "string")) {
      return o.id;
    }
    if (typeof obj.id === "string") return obj.id;
  }
  if (typeof data.id === "string") return data.id;
  return null;
}

function extractSquareInvoiceStatusFromWebhook(event: SquareWebhookEvent): string | undefined {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return undefined;
  const obj = data.object as Record<string, unknown> | undefined;
  if (obj && typeof obj === "object") {
    const inv = obj.invoice as Record<string, unknown> | undefined;
    if (inv && typeof inv.status === "string") return inv.status;
    if (typeof obj.status === "string") return obj.status;
  }
  return undefined;
}

/** List invoices at location and find the Square invoice id for the given order id (used when payment.updated fires without a reliable invoice.updated). */
async function findSquareInvoiceIdByOrderId(orderId: string): Promise<string | null> {
  const { locationId } = await getSquarePaymentConfig();
  if (!locationId || !orderId) return null;

  const page = await squareClient.invoices.list({ locationId, limit: 100 });
  let scanned = 0;
  const maxScan = 2000;
  for await (const inv of page) {
    scanned++;
    if (scanned > maxScan) break;
    const row = inv as { id?: string; orderId?: string };
    if (row.orderId === orderId && row.id) return row.id;
  }
  return null;
}

async function handleInvoiceUpdated(
  event: SquareWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const invoiceId = extractSquareInvoiceIdFromWebhook(event);
  if (!invoiceId) {
    console.error("[square webhook] invoice.updated: could not parse Square invoice id from payload");
    return;
  }
  if (!(process.env.SQUARE_ACCESS_TOKEN || "").trim()) return;

  const webhookStatus = extractSquareInvoiceStatusFromWebhook(event);

  let apiStatus: string | undefined;
  let publicUrl: string | null = null;
  try {
    const res = await squareClient.invoices.get({ invoiceId });
    apiStatus = res.invoice?.status as string | undefined;
    publicUrl = res.invoice?.publicUrl ?? null;
  } catch (e) {
    console.error("[square webhook] invoices.get failed:", e);
    if (squareInvoiceFetchIndicatesMissing(e)) {
      const { error: delErr } = await supabase.from("invoices").delete().eq("square_invoice_id", invoiceId);
      if (delErr) {
        console.error("[square webhook] failed to delete local invoice after Square removal:", delErr.message);
      } else {
        await supabase.from("webhook_logs").insert({
          source: "square",
          event_type: "invoice.updated.local_deleted",
          payload: { invoice_id: invoiceId, reason: "square_invoice_missing" },
          status: "processed",
        });
      }
    }
    if (!squareInvoiceFetchIndicatesMissing(e)) {
      // Transient API failure: still mark paid if the webhook payload says PAID
      const fromWebhook = isSquareInvoicePaidStatus(webhookStatus);
      if (!fromWebhook) return;
    } else {
      return;
    }
  }

  const status = apiStatus ?? webhookStatus;
  if (!isSquareInvoicePaidStatus(status)) return;

  await markLocalInvoicePaidFromSquare({
    supabase,
    squareInvoiceId: invoiceId,
    squareInvoiceUrl: publicUrl,
    squareReceiptUrl: null,
    logContext: "invoice.updated",
  });
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

  if (!(process.env.SQUARE_ACCESS_TOKEN || "").trim()) return;

  try {
    const payRes = await squareClient.payments.get({ paymentId });
    const payment = payRes.payment as
      | { status?: string; orderId?: string; receiptUrl?: string }
      | undefined;
    if (!payment) return;
    const payStatus = String(payment.status || "").toUpperCase();
    if (payStatus !== "COMPLETED") return;

    const orderId = payment.orderId;
    if (!orderId) return;

    const squareInvoiceId = await findSquareInvoiceIdByOrderId(orderId);
    if (!squareInvoiceId) return;

    const invRes = await squareClient.invoices.get({ invoiceId: squareInvoiceId });
    const inv = invRes.invoice;
    if (!isSquareInvoicePaidStatus(inv?.status as string | undefined)) return;

    await markLocalInvoicePaidFromSquare({
      supabase,
      squareInvoiceId,
      squareInvoiceUrl: inv?.publicUrl ?? null,
      squareReceiptUrl: payment.receiptUrl ?? null,
      logContext: "payment.updated",
    });
  } catch (e) {
    console.error("[square webhook] payment.updated sync failed:", e);
  }
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
