import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { inventoryChangeRequestClientEmail } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getEmailFrom } from "@/lib/email/send";
import { signTrackToken } from "@/lib/track-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";

type AddedRow = {
  item_name: string;
  item_slug?: string | null;
  weight_score?: number;
  quantity?: number;
  surcharge?: number;
  is_custom?: boolean;
  custom_weight_class?: string | null;
};

type RemovedRow = {
  move_inventory_id?: string;
  item_name?: string;
  item_slug?: string | null;
  weight_score?: number;
  quantity?: number;
  credit?: number;
};

async function applyInventoryToMove(
  admin: ReturnType<typeof createAdminClient>,
  moveId: string,
  itemsAdded: AddedRow[],
  itemsRemoved: RemovedRow[],
) {
  const { data: maxSort } = await admin
    .from("move_inventory")
    .select("sort_order")
    .eq("move_id", moveId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let sortOrder = (maxSort?.sort_order ?? 0) + 1;

  for (const a of itemsAdded) {
    const name = String(a.item_name || "").trim();
    if (!name) continue;
    const qty = Math.max(1, Math.floor(Number(a.quantity) || 1));
    const label = qty > 1 ? `${name} ×${qty}` : name;
    await admin.from("move_inventory").insert({
      move_id: moveId,
      room: "Other",
      item_name: label,
      sort_order: sortOrder++,
    });
  }

  for (const r of itemsRemoved) {
    const id = String(r.move_inventory_id || "").trim();
    if (!id) continue;
    await admin.from("move_inventory").delete().eq("id", id).eq("move_id", moveId);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action === "decline" ? "decline" : body.action === "approve" ? "approve" : null;
  if (!action) {
    return NextResponse.json({ error: 'action must be "approve" or "decline"' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin.from("inventory_change_requests").select("*").eq("id", id).single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message || "Not found" }, { status: 404 });
  }

  if (!["pending", "admin_reviewing"].includes(String(row.status))) {
    return NextResponse.json({ error: "Request is not pending review" }, { status: 400 });
  }

  const moveId = row.move_id as string;

  if (action === "decline") {
    const declineReason = String(body.decline_reason || "").trim();
    if (!declineReason) {
      return NextResponse.json({ error: "decline_reason is required" }, { status: 400 });
    }
    await admin
      .from("inventory_change_requests")
      .update({
        status: "declined",
        decline_reason: declineReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", id);

    await admin.from("moves").update({ pending_inventory_change_request_id: null }).eq("id", moveId);

    const { data: move } = await admin
      .from("moves")
      .select("client_email, client_name, client_phone, amount")
      .eq("id", moveId)
      .single();
    const trackUrl = `${getEmailBaseUrl()}/track/move/${moveId}?token=${signTrackToken("move", moveId)}`;

    if (move?.client_email && process.env.RESEND_API_KEY) {
      try {
        const resend = getResend();
        const html = inventoryChangeRequestClientEmail({
          clientName: move.client_name || "there",
          status: "declined",
          netDelta: 0,
          newTotal: Number(move.amount) || 0,
          portalUrl: trackUrl,
          declineReason,
        });
        const emailFrom = await getEmailFrom();
        await resend.emails.send({
          from: emailFrom,
          to: move.client_email,
          subject: "Update on your inventory change request",
          html,
        });
      } catch {
        /* non-fatal */
      }
    }

    if (move?.client_phone) {
      try {
        await sendSMS(
          normalizePhone(move.client_phone),
          [
            `Hi,`,
            `Yugo has an update about your inventory change request.`,
            `Open your move link for details:\n${trackUrl}`,
          ].join("\n\n"),
        );
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({ ok: true });
  }

  // approve
  const autoDelta = Number(row.auto_calculated_delta) || 0;
  let finalDelta = autoDelta;
  if (body.admin_adjusted_delta != null && body.admin_adjusted_delta !== "") {
    const adj = Number(body.admin_adjusted_delta);
    if (!Number.isFinite(adj)) {
      return NextResponse.json({ error: "admin_adjusted_delta must be a number" }, { status: 400 });
    }
    finalDelta = Math.round(adj * 100) / 100;
  }

  const adminNotes = body.admin_notes != null ? String(body.admin_notes).trim() : "";

  const { data: move } = await admin.from("moves").select("*").eq("id", moveId).single();
  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const curAmount = Number(move.amount) || 0;
  const newAmount = Math.max(0, curAmount + finalDelta);
  const curBalance = Number(move.balance_amount) || 0;
  const newBalance = Math.max(0, curBalance + finalDelta);
  const movePaid = !!(move.balance_paid_at || move.payment_marked_paid || String(move.status).toLowerCase() === "paid");

  const truck = row.truck_assessment as { new_score?: number } | null;
  const newInvScore = truck?.new_score != null ? truck.new_score : move.inventory_score;

  const itemsAdded = (Array.isArray(row.items_added) ? row.items_added : []) as AddedRow[];
  const itemsRemoved = (Array.isArray(row.items_removed) ? row.items_removed : []) as RemovedRow[];

  await applyInventoryToMove(admin, moveId, itemsAdded, itemsRemoved);

  const moveUpdate: Record<string, unknown> = {
    amount: newAmount,
    estimate: newAmount,
    balance_amount: newBalance,
    inventory_score: newInvScore,
    pending_inventory_change_request_id: null,
    updated_at: new Date().toISOString(),
  };
  // Keep cumulative payments unchanged until the client pays the new balance; freeze total_paid at pre-bump job total if unset
  if (movePaid && finalDelta > 0 && move.total_paid == null) {
    moveUpdate.total_paid = curAmount;
  }

  await admin.from("moves").update(moveUpdate).eq("id", moveId);

  const additionalDeposit = movePaid && finalDelta > 0 ? finalDelta : 0;

  const resolvedStatus =
    body.admin_adjusted_delta != null && body.admin_adjusted_delta !== "" && finalDelta !== autoDelta ? "adjusted" : "approved";

  await admin
    .from("inventory_change_requests")
    .update({
      status: resolvedStatus,
      admin_adjusted_delta: finalDelta !== autoDelta ? finalDelta : null,
      admin_notes: adminNotes || null,
      new_subtotal: newAmount,
      additional_deposit_required: additionalDeposit,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", id);

  const trackUrl = `${getEmailBaseUrl()}/track/move/${moveId}?token=${signTrackToken("move", moveId)}`;

  if (move.client_email && process.env.RESEND_API_KEY) {
    try {
      const resend = getResend();
      const html = inventoryChangeRequestClientEmail({
        clientName: move.client_name || "there",
        status: resolvedStatus,
        netDelta: finalDelta,
        newTotal: newAmount,
        portalUrl: trackUrl,
        adminNote: adminNotes || null,
        additionalDeposit: additionalDeposit > 0 ? additionalDeposit : undefined,
      });
      const emailFrom = await getEmailFrom();
      await resend.emails.send({
        from: emailFrom,
        to: move.client_email,
        subject: "Your inventory change request, approved",
        html,
      });
    } catch {
      /* non-fatal */
    }
  }

  if (move.client_phone) {
    try {
      await sendSMS(
        normalizePhone(move.client_phone),
        [
          `Hi,`,
          `Your inventory change is approved.`,
          `Your new total is about $${newAmount}.`,
          `View details:\n${trackUrl}`,
        ].join("\n\n"),
      );
    } catch {
      /* optional */
    }
  }

  return NextResponse.json({ ok: true, new_amount: newAmount, final_delta: finalDelta });
}
