import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";
import { isMoveStatusCompleted } from "@/lib/move-status";

/** Avoid exposing raw PostgREST or Postgres strings for known deployment gaps */
function publicDbErrorMessage(message: string | undefined): string {
  const m = (message || "").trim();
  if (
    /schema cache|Could not find the table|PGRST205/i.test(m) ||
    (/relation/i.test(m) && /does not exist/i.test(m)) ||
    (/job_final_price_edits/i.test(m) && /(exist|find|cache)/i.test(m))
  ) {
    return "Price history could not be saved because the database is not fully updated. Apply pending Supabase migrations for this project, then try again.";
  }
  return m || "Save failed";
}

function isDeliveryDone(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "delivered" || s === "completed";
}

export async function POST(req: NextRequest) {
  const { user, admin, error } = await requireAdmin();
  if (error) return error;
  if (!user || !canEditFinalJobPrice(admin?.role ?? null, user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    jobType?: "move" | "delivery";
    jobId?: string;
    newPrice?: number;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const jobType = body.jobType;
  const jobId = (body.jobId || "").trim();
  const newPrice = Number(body.newPrice);
  const reason = (body.reason || "").trim();

  if (jobType !== "move" && jobType !== "delivery") {
    return NextResponse.json({ error: "jobType must be move or delivery" }, { status: 400 });
  }
  if (!jobId || !Number.isFinite(newPrice) || newPrice < 0) {
    return NextResponse.json({ error: "Invalid job or price" }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const db = createAdminClient();
  const editorName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Admin";

  if (jobType === "delivery") {
    const { data: delivery, error: dErr } = await db
      .from("deliveries")
      .select(
        "id, status, total_price, admin_adjusted_price, quoted_price, delivery_number",
      )
      .eq("id", jobId)
      .single();

    if (dErr || !delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }
    if (!isDeliveryDone(delivery.status)) {
      return NextResponse.json(
        { error: "Price can only be adjusted after the job is complete" },
        { status: 400 },
      );
    }

    const original = Number(
      delivery.admin_adjusted_price ??
        delivery.total_price ??
        delivery.quoted_price ??
        0,
    );

    const { data: inv } = await db
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("delivery_id", jobId)
      .maybeSingle();

    const { error: insErr } = await db.from("job_final_price_edits").insert({
      job_id: jobId,
      job_type: "delivery",
      edited_by: user.id,
      edited_by_name: editorName,
      original_price: original,
      new_price: newPrice,
      difference: newPrice - original,
      reason,
      invoice_may_need_reissue: !!inv && String(inv.status || "").toLowerCase() !== "draft",
    });

    if (insErr) {
      console.error("[job-final-price] audit insert", insErr);
      return NextResponse.json(
        { error: publicDbErrorMessage(insErr.message) },
        { status: 500 },
      );
    }

    const { error: upErr } = await db
      .from("deliveries")
      .update({
        total_price: newPrice,
        admin_adjusted_price: newPrice,
      })
      .eq("id", jobId);

    if (upErr) {
      return NextResponse.json(
        { error: publicDbErrorMessage(upErr.message) },
        { status: 500 },
      );
    }

    if (inv) {
      await db.from("status_events").insert({
        entity_type: "delivery",
        entity_id: delivery.delivery_number || jobId,
        event_type: "admin",
        description: `Final price updated to $${newPrice.toFixed(2)} (was $${original.toFixed(2)}). Invoice ${inv.invoice_number || ""} may need a credit or reissue.`,
        icon: "dollar",
      });
    }

    return NextResponse.json({ ok: true });
  }

  const { data: move, error: mErr } = await db
    .from("moves")
    .select(
      "id, status, amount, total_price, final_amount, estimate, move_code",
    )
    .eq("id", jobId)
    .single();

  if (mErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }
  if (!isMoveStatusCompleted(move.status)) {
    return NextResponse.json(
      { error: "Price can only be adjusted after the move is complete" },
      { status: 400 },
    );
  }

  const original = Number(
    move.final_amount ??
      move.total_price ??
      move.estimate ??
      move.amount ??
      0,
  );

  const { data: moveInv } = await db
    .from("invoices")
    .select("id, invoice_number, status")
    .eq("move_id", jobId)
    .maybeSingle();

  const { error: insErr } = await db.from("job_final_price_edits").insert({
    job_id: jobId,
    job_type: "move",
    edited_by: user.id,
    edited_by_name: editorName,
    original_price: original,
    new_price: newPrice,
    difference: newPrice - original,
    reason,
    invoice_may_need_reissue:
      !!moveInv && String(moveInv.status || "").toLowerCase() !== "draft",
  });

  if (insErr) {
    console.error("[job-final-price] audit insert", insErr);
    return NextResponse.json(
      { error: publicDbErrorMessage(insErr.message) },
      { status: 500 },
    );
  }

  const { error: upErr } = await db
    .from("moves")
    .update({
      final_amount: newPrice,
      total_price: newPrice,
      amount: newPrice,
    })
    .eq("id", jobId);

  if (upErr) {
    return NextResponse.json(
      { error: publicDbErrorMessage(upErr.message) },
      { status: 500 },
    );
  }

  if (moveInv) {
    await db.from("status_events").insert({
      entity_type: "move",
      entity_id: move.move_code || jobId,
      event_type: "admin",
      description: `Final price updated to $${newPrice.toFixed(2)} (was $${original.toFixed(2)}). Invoice ${moveInv.invoice_number || ""} may need a credit or reissue.`,
      icon: "dollar",
    });
  }

  return NextResponse.json({ ok: true });
}
