import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type;

    const supabase = await createClient();

    if (eventType === "invoice.payment_made" || eventType === "payment.completed") {
      const invoiceId = body.data?.object?.invoice?.id || body.data?.id;

      if (invoiceId) {
        // Find invoice by square_invoice_id
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*")
          .eq("square_invoice_id", invoiceId)
          .single();

        if (invoice) {
          // Mark as paid
          await supabase
            .from("invoices")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("id", invoice.id);

          // Log event
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
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}