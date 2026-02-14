import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, amount, items, dueDate } = body;

    const supabase = await createClient();
    const invoiceNumber = `INV-${Math.floor(Math.random() * 9000) + 1000}`;

    // Save to Supabase
    const { data, error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      client_name: clientName,
      amount,
      status: "sent",
      due_date: dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      line_items: JSON.stringify(items || [{ d: "Delivery service", q: 1, r: amount }]),
    }).select().single();

    if (error) throw error;

    // Log event
    await supabase.from("status_events").insert({
      entity_type: "invoice",
      entity_id: invoiceNumber,
      event_type: "created",
      description: `Invoice ${invoiceNumber} created for ${clientName} ($${amount})`,
      icon: "💰",
    });

    return NextResponse.json({ ok: true, invoice: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}