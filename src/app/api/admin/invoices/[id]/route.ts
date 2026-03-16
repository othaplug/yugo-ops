import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        client_name,
        amount,
        move_id,
        delivery_id,
        due_date,
        status,
        file_path,
        organization_id,
        square_invoice_id,
        square_invoice_url,
        line_items,
        created_at,
        updated_at
      `)
      .eq("id", id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: error?.message || "Invoice not found" }, { status: 404 });
    }

    let delivery: Record<string, unknown> | null = null;
    if (invoice.delivery_id) {
      const { data: d } = await supabase
        .from("deliveries")
        .select("id, delivery_number, customer_name, client_name, delivery_address, pickup_address, scheduled_date, time_slot, status, total_price, admin_adjusted_price, items")
        .eq("id", invoice.delivery_id)
        .single();
      delivery = d as Record<string, unknown> | null;
    }

    let organization: Record<string, unknown> | null = null;
    if (invoice.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name, email, contact_name, billing_address")
        .eq("id", invoice.organization_id)
        .single();
      organization = org as Record<string, unknown> | null;
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        delivery,
        organization,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const contentType = req.headers.get("content-type") ?? "";
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      const moveIdVal = formData.get("move_id");
      if (moveIdVal !== undefined) updates.move_id = moveIdVal === null || moveIdVal === "" ? null : moveIdVal;
      const amountVal = formData.get("amount");
      if (amountVal !== undefined && amountVal !== null) updates.amount = Number(amountVal) || 0;
      const dueDateVal = formData.get("due_date");
      if (dueDateVal !== undefined && dueDateVal !== null) updates.due_date = String(dueDateVal).trim();
      const statusVal = formData.get("status");
      if (statusVal !== undefined && statusVal !== null) updates.status = String(statusVal).trim();

      const file = formData.get("file") as File | null;
      if (file?.size && file.type === "application/pdf") {
        const ext = "pdf";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = `${id}/${safeName}`;
        const buf = await file.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from("invoice-files")
          .upload(filePath, buf, { contentType: "application/pdf", upsert: true });
        if (!uploadError) updates.file_path = filePath;
      }
    } else {
      const body = await req.json();
      if (body.move_id !== undefined) updates.move_id = body.move_id === null || body.move_id === "" ? null : body.move_id;
      if (body.amount !== undefined) updates.amount = Number(body.amount) || 0;
      if (body.due_date !== undefined) updates.due_date = String(body.due_date).trim();
      if (body.status !== undefined) updates.status = String(body.status).trim();
    }

    const { error } = await supabase.from("invoices").update(updates).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 }
    );
  }
}
