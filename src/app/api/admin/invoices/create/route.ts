import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

function generateInvoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const contentType = req.headers.get("content-type") ?? "";

    let organizationId: string | null = null;
    let clientName = "";
    let amount = 0;
    let dueDate = "";
    let moveId: string | null = null;
    let file: File | null = null;

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      organizationId = (formData.get("organization_id") as string)?.trim() || null;
      clientName = (formData.get("client_name") as string)?.trim() || "";
      amount = Number(formData.get("amount")) || 0;
      dueDate = (formData.get("due_date") as string)?.trim() || "";
      moveId = (formData.get("move_id") as string)?.trim() || null;
      file = formData.get("file") as File | null;
    } else {
      const body = await req.json();
      organizationId = body.organization_id?.trim() || null;
      clientName = (body.client_name || "").trim();
      amount = Number(body.amount) || 0;
      dueDate = (body.due_date || "").trim();
      moveId = body.move_id?.trim() || null;
    }

    if (!clientName) return NextResponse.json({ error: "Client/partner name is required" }, { status: 400 });
    if (amount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

    const invoiceNumber = generateInvoiceNumber();
    const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const finalDueDate = dueDate || defaultDue;

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_name: clientName,
        amount,
        status: "sent",
        due_date: finalDueDate,
        organization_id: organizationId || null,
        move_id: moveId || null,
        line_items: JSON.stringify([{ d: "Invoice", q: 1, r: amount }]),
      })
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    let filePath: string | null = null;
    if (file?.size && file.type === "application/pdf") {
      const ext = "pdf";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      filePath = `${invoice.id}/${safeName}`;
      const buf = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("invoice-files")
        .upload(filePath, buf, { contentType: "application/pdf", upsert: false });
      if (!uploadError) {
        await supabase.from("invoices").update({ file_path: filePath }).eq("id", invoice.id);
      }
    }

    await supabase.from("status_events").insert({
      entity_type: "invoice",
      entity_id: invoiceNumber,
      event_type: "created",
      description: `Invoice ${invoiceNumber} created for ${clientName} ($${amount})`,
      icon: "dollar",
    });

    return NextResponse.json({ ok: true, invoice: { ...invoice, file_path: filePath || invoice.file_path } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create invoice" },
      { status: 500 }
    );
  }
}
