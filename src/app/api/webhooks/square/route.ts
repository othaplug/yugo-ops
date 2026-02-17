import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WebhooksHelper } from "square";

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
    } else {
      console.warn("[webhooks/square] SQUARE_WEBHOOK_SIGNATURE_KEY not set — webhook not verified");
    }

    const body = JSON.parse(rawBody || "{}") as {
      type?: string;
      data?: { object?: { invoice?: { id?: string } }; id?: string };
    };
    const eventType = body.type;

    const supabase = await createClient();

    if (eventType === "invoice.payment_made" || eventType === "payment.completed") {
      const invoiceId = body.data?.object?.invoice?.id || body.data?.id;

      if (invoiceId) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*")
          .eq("square_invoice_id", invoiceId)
          .single();

        if (invoice) {
          await supabase
            .from("invoices")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("id", invoice.id);

          await supabase.from("status_events").insert({
            entity_type: "invoice",
            entity_id: invoice.invoice_number,
            event_type: "payment",
            description: `${invoice.invoice_number} paid by ${invoice.client_name} ($${invoice.amount})`,
            icon: "check",
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[webhooks/square] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
