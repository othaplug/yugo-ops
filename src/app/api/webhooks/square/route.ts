import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WebhooksHelper } from "square";
import { squareClient } from "@/lib/square";

const NOTIFICATION_URL = (() => {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return base
    ? `${base.replace(/\/$/, "")}/api/webhooks/square`
    : "https://opsplus.co/api/webhooks/square";
})();

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const signatureKey = (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();

    const rawBody = await req.text();
    const isProduction = process.env.NODE_ENV === "production";
    if (signatureKey) {
      if (!signature) {
        console.warn("[webhooks/square] Missing x-square-hmacsha256-signature header");
        return NextResponse.json({ error: "Missing signature" }, { status: 403 });
      }
      const isValid = WebhooksHelper.verifySignature({
        requestBody: rawBody,
        signatureHeader: signature,
        signatureKey,
        notificationUrl: NOTIFICATION_URL,
      });
      if (!isValid) {
        console.warn("[webhooks/square] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else if (isProduction) {
      return NextResponse.json({ error: "Webhook signing not configured" }, { status: 503 });
    } else {
      console.warn("[webhooks/square] SQUARE_WEBHOOK_SIGNATURE_KEY not set — webhook not verified");
    }

    const body = JSON.parse(rawBody || "{}") as {
      type?: string;
      data?: { object?: { invoice?: { id?: string } }; id?: string };
    };
    const eventType = body.type ?? "unknown";

    const supabase = await createClient();
    const admin = createAdminClient();

    let logStatus: "processed" | "ignored" = "ignored";

    // payment.completed: update move.square_receipt_url when payment has reference_id (move_code or moveId)
    if (eventType === "payment.completed") {
      const paymentId = (body.data?.object as { payment?: { id?: string } })?.payment?.id ?? body.data?.id;
      if (paymentId && typeof paymentId === "string") {
        try {
          const payRes = await squareClient.payments.get({ paymentId });
          const payment = (payRes as { payment?: { receiptUrl?: string; referenceId?: string } }).payment;
          const receiptUrl = payment?.receiptUrl;
          const referenceId = payment?.referenceId;
          if (receiptUrl && referenceId) {
            const ref = String(referenceId).trim();
            const { data: moveByCode } = await admin
              .from("moves")
              .select("id")
              .ilike("move_code", ref.replace(/^#/, "").toUpperCase())
              .maybeSingle();
            const { data: moveById } = ref.length >= 30
              ? await admin.from("moves").select("id").eq("id", ref).maybeSingle()
              : { data: null };
            const moveId = moveByCode?.id ?? moveById?.id ?? null;
            if (moveId) {
              await admin
                .from("moves")
                .update({ square_receipt_url: receiptUrl, updated_at: new Date().toISOString() })
                .eq("id", moveId);
              logStatus = "processed";
            }
          }
        } catch (e) {
          console.warn("[webhooks/square] payment.completed receipt update failed:", e);
        }
      }
    }

    if (eventType === "invoice.payment_made") {
      const invoiceId = body.data?.object?.invoice?.id ?? body.data?.id;

      if (invoiceId && typeof invoiceId === "string") {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*")
          .eq("square_invoice_id", invoiceId)
          .single();

        if (invoice) {
          let receiptUrl: string | null = null;

          // Fetch Square receipt URL when invoice is paid via Square-hosted page
          try {
            const invRes = await squareClient.invoices.get({ invoiceId });
            const sqInvoice = (invRes as { invoice?: { orderId?: string; locationId?: string } }).invoice;
            const orderId = sqInvoice?.orderId;
            const locationId = sqInvoice?.locationId;
            if (orderId && locationId) {
              const end = new Date();
              const begin = new Date(end.getTime() - 15 * 60 * 1000);
              const listRes = await squareClient.payments.list({
                beginTime: begin.toISOString(),
                endTime: end.toISOString(),
                locationId,
                limit: 50,
              });
              const payments: { orderId?: string; receiptUrl?: string }[] = [];
              for await (const p of listRes) {
                payments.push(p as { orderId?: string; receiptUrl?: string });
                if (payments.length >= 50) break;
              }
              const match = payments.find((p) => p.orderId === orderId);
              if (match?.receiptUrl) receiptUrl = match.receiptUrl;
            }
          } catch (e) {
            console.warn("[webhooks/square] Could not fetch receipt_url:", e);
          }

          await supabase
            .from("invoices")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
              ...(receiptUrl && { square_receipt_url: receiptUrl }),
            })
            .eq("id", invoice.id);

          // Update move.square_receipt_url when invoice is linked to a move
          if (receiptUrl && invoice.move_id) {
            await admin
              .from("moves")
              .update({ square_receipt_url: receiptUrl, updated_at: new Date().toISOString() })
              .eq("id", invoice.move_id);
          }

          await supabase.from("status_events").insert({
            entity_type: "invoice",
            entity_id: invoice.invoice_number,
            event_type: "payment",
            description: `${invoice.invoice_number} paid by ${invoice.client_name} ($${invoice.amount})`,
            icon: "check",
          });
          logStatus = "processed";

          // ── Update client referral if quote/move has one ──────────────────
          try {
            // Try to find the move linked to this invoice
            let moveId = invoice.move_id || null;
            if (!moveId && invoice.quote_id) {
              const { data: quote } = await admin
                .from("quotes")
                .select("referral_id, move_id")
                .eq("id", invoice.quote_id)
                .single();
              if (quote?.referral_id) {
                await admin
                  .from("client_referrals")
                  .update({ status: "used", used_at: new Date().toISOString(), referred_move_id: quote.move_id || null })
                  .eq("id", quote.referral_id)
                  .eq("status", "active");
              }
            }
            if (moveId) {
              const { data: move } = await admin
                .from("moves")
                .select("quote_id")
                .eq("id", moveId)
                .single();
              if (move?.quote_id) {
                const { data: quote } = await admin
                  .from("quotes")
                  .select("referral_id")
                  .eq("id", move.quote_id)
                  .single();
                if (quote?.referral_id) {
                  await admin
                    .from("client_referrals")
                    .update({ status: "used", used_at: new Date().toISOString(), referred_move_id: moveId })
                    .eq("id", quote.referral_id)
                    .eq("status", "active");
                }
              }
            }
          } catch {
            // Non-critical — don't fail the webhook
          }
        }
      }
    }

    try {
      await admin.from("webhook_logs").insert({
        source: "square",
        event_type: eventType,
        payload: { type: body.type, id: body.data?.id },
        status: logStatus,
        error: null,
      });
    } catch (e) {
      console.error("[webhooks/square] webhook_log insert failed:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/square] Error:", err);
    try {
      await createAdminClient().from("webhook_logs").insert({
        source: "square",
        event_type: "error",
        payload: null,
        status: "error",
        error: message.slice(0, 500),
      });
    } catch (_) {}
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
