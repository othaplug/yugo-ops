import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelOrDeleteSquareInvoice } from "@/lib/square-invoice";
import { requireAdmin } from "@/lib/api-auth";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { signTrackToken } from "@/lib/track-token";
import { getMoveCode, formatJobId } from "@/lib/move-code";
import {
  depositPreTaxFromMove,
  finalizeBalancePaymentSettlement,
  recordAdminDepositForMove,
} from "@/lib/complete-balance-payment";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const markedBy = body.marked_by as string;

    const auditAfter = async (details?: Record<string, unknown>) => {
      await logAudit({
        userId: authUser?.id,
        userEmail: authUser?.email,
        action: "move_status_change",
        resourceType: "move",
        resourceId: id,
        details: { action, ...details },
      });
    };

    if (action === "mark_deposit_collected" || action === "mark_paid") {
      if (!markedBy?.trim()) {
        return NextResponse.json({ error: "marked_by is required" }, { status: 400 });
      }
      const admin = createAdminClient();
      const { data: row, error: fetchErr } = await admin.from("moves").select("*").eq("id", id).single();
      if (fetchErr || !row) return NextResponse.json({ error: "Move not found" }, { status: 404 });

      const depositPreTax = depositPreTaxFromMove(row);
      try {
        await recordAdminDepositForMove({
          admin,
          moveId: id,
          depositPreTax,
          paymentMarkedBy: markedBy.trim(),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to record deposit";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const { data: move, error: reloadErr } = await admin.from("moves").select("*").eq("id", id).single();
      if (reloadErr || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: "payment_received",
        description: `Deposit recorded by ${markedBy.trim()} (admin)`,
        icon: "dollar",
      });

      await auditAfter({ status: move.status, markedBy: markedBy.trim(), kind: "deposit" });
      return NextResponse.json(move);
    }

    if (action === "mark_full_payment_collected") {
      if (!markedBy?.trim()) {
        return NextResponse.json({ error: "marked_by is required" }, { status: 400 });
      }
      const admin = createAdminClient();
      const { data: moveBefore, error: fetchE } = await admin.from("moves").select("*").eq("id", id).single();
      if (fetchE || !moveBefore) return NextResponse.json({ error: "Move not found" }, { status: 404 });

      if (moveBefore.balance_paid_at) {
        const { data: m } = await admin.from("moves").select("*").eq("id", id).single();
        return NextResponse.json(m ?? moveBefore);
      }

      const [{ data: approvedChanges }, { data: approvedExtras }] = await Promise.all([
        admin.from("move_change_requests").select("fee_cents").eq("move_id", id).eq("status", "approved"),
        admin.from("extra_items").select("fee_cents").eq("job_id", id).eq("job_type", "move").eq("status", "approved"),
      ]);
      const additionalCents =
        (approvedChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0) +
        (approvedExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
      let bal = Number(moveBefore.balance_amount || 0) + additionalCents / 100;

      const depositPreTax = depositPreTaxFromMove(moveBefore);
      if (!moveBefore.deposit_paid_at && depositPreTax > 0) {
        try {
          await recordAdminDepositForMove({
            admin,
            moveId: id,
            depositPreTax,
            paymentMarkedBy: markedBy.trim(),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to record deposit";
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        const { data: afterDep } = await admin.from("moves").select("balance_amount").eq("id", id).single();
        bal = Number(afterDep?.balance_amount || 0) + additionalCents / 100;
      }

      const now = new Date().toISOString();
      if (bal <= 0.005) {
        const { data: fresh } = await admin.from("moves").select("*").eq("id", id).single();
        if (!fresh?.balance_paid_at) {
          await admin
            .from("moves")
            .update({
              balance_paid_at: now,
              balance_amount: 0,
              updated_at: now,
            })
            .eq("id", id);
        }
        const { data: move } = await admin.from("moves").select("*").eq("id", id).single();
        await admin.from("status_events").insert({
          entity_type: "move",
          entity_id: id,
          event_type: "payment_received",
          description: `Full payment recorded by ${markedBy.trim()} (admin, no balance line)`,
          icon: "dollar",
        });
        await auditAfter({ status: move?.status, markedBy: markedBy.trim(), kind: "full_payment" });
        return NextResponse.json(move);
      }

      try {
        await finalizeBalancePaymentSettlement({
          admin,
          moveId: id,
          balanceTaxInclusive: bal,
          squarePaymentId: null,
          squareReceiptUrl: null,
          settlementMethod: "admin",
          paymentMarkedBy: markedBy.trim(),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to record balance payment";
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      const { data: move } = await admin.from("moves").select("*").eq("id", id).single();
      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: "payment_received",
        description: `Balance settled in full by ${markedBy.trim()} (admin)`,
        icon: "dollar",
      });
      await auditAfter({ status: move?.status, markedBy: markedBy.trim(), kind: "full_payment" });
      return NextResponse.json(move);
    }

    if (action === "mark_as_paid_override") {
      const reason = (body.reason as string | undefined)?.trim();
      const VALID_REASONS = ["wire_transfer", "cheque_deposited", "other"];
      if (!reason || !VALID_REASONS.includes(reason)) {
        return NextResponse.json({ error: "A valid override reason is required (wire_transfer, cheque_deposited, or other)" }, { status: 400 });
      }
      const reasonNote = (body.reason_note as string | undefined)?.trim() || "";
      if (reason === "other" && !reasonNote) {
        return NextResponse.json({ error: "Please explain the reason when selecting 'Other'" }, { status: 400 });
      }

      const admin = createAdminClient();
      const { data: moveBefore, error: fetchE } = await admin.from("moves").select("*").eq("id", id).single();
      if (fetchE || !moveBefore) return NextResponse.json({ error: "Move not found" }, { status: 404 });

      if (moveBefore.balance_paid_at) {
        return NextResponse.json({ error: "Balance has already been recorded" }, { status: 400 });
      }

      const [{ data: approvedChanges }, { data: approvedExtras }] = await Promise.all([
        admin.from("move_change_requests").select("fee_cents").eq("move_id", id).eq("status", "approved"),
        admin.from("extra_items").select("fee_cents").eq("job_id", id).eq("job_type", "move").eq("status", "approved"),
      ]);
      const additionalCents =
        (approvedChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0) +
        (approvedExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);

      const bal = Number(moveBefore.balance_amount || 0) + additionalCents / 100;
      if (bal <= 0) {
        return NextResponse.json({ error: "No balance due" }, { status: 400 });
      }

      const REASON_LABELS: Record<string, string> = {
        wire_transfer: "Wire transfer received",
        cheque_deposited: "Cheque deposited",
        other: `Other, ${reasonNote}`,
      };
      const reasonLabel = REASON_LABELS[reason] ?? reason;

      try {
        await finalizeBalancePaymentSettlement({
          admin,
          moveId: id,
          balanceTaxInclusive: bal,
          squarePaymentId: null,
          squareReceiptUrl: null,
          settlementMethod: "admin",
          paymentMarkedBy: markedBy?.trim() || "admin",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to record payment";
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      const { data: move } = await admin.from("moves").select("*").eq("id", id).single();

      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: "payment_received",
        description: `Balance marked as paid (override), ${reasonLabel}, by ${markedBy?.trim() || "admin"}`,
        icon: "dollar",
      });

      await auditAfter({ status: "paid", method: "admin_override", reason, reasonNote });
      return NextResponse.json(move);
    }

    if (action === "charge_card_now") {
      const admin = createAdminClient();

      const { data: move, error: fetchErr } = await admin
        .from("moves")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchErr || !move) {
        return NextResponse.json({ error: "Move not found" }, { status: 404 });
      }

      // Resolve a Square source_id to charge.
      // 1) Prefer the explicit square_card_id stored on the move.
      // 2) Fall back to looking up the customer's saved cards via Square's
      //    cards.list — many moves (e.g. MV-30211) end up with only the
      //    square_customer_id when the deposit went through Square's hosted
      //    flow, never persisting the specific card id locally.
      //    Same pattern used by the tip endpoint at
      //    src/app/api/track/moves/[id]/tip/route.ts.
      let resolvedCardId: string | null = (move.square_card_id as string | null) ?? null;
      const customerId = (move.square_customer_id as string | null) ?? null;
      if (!resolvedCardId && customerId) {
        try {
          const listRes = await squareClient.cards.list({
            customerId,
            sortOrder: "ASC",
          });
          const cards = listRes.data ?? [];
          resolvedCardId = cards.length > 0 ? (cards[0].id ?? null) : null;
        } catch (e) {
          console.warn("[charge_card_now] cards.list failed:", e);
        }
      }
      if (!resolvedCardId) {
        return NextResponse.json(
          { error: "No card on file for this move" },
          { status: 400 },
        );
      }

      // Include approved change-request and extra-item fees, matching the client-side balanceDue calculation
      const [{ data: chargeChanges }, { data: chargeExtras }] = await Promise.all([
        admin.from("move_change_requests").select("fee_cents").eq("move_id", id).eq("status", "approved"),
        admin.from("extra_items").select("fee_cents").eq("job_id", id).eq("job_type", "move").eq("status", "approved"),
      ]);
      const chargeAdditionalCents =
        (chargeChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0) +
        (chargeExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
      const balanceAmount = Number(move.balance_amount || 0) + chargeAdditionalCents / 100;

      if (balanceAmount <= 0) {
        return NextResponse.json({ error: "No balance to charge" }, { status: 400 });
      }

      // Processing costs are baked into quoted prices — charge the raw balance.
      const ccBalance = balanceAmount;
      const amountCents = Math.round(ccBalance * 100);

      try {
        const { locationId } = await getSquarePaymentConfig();
        if (!locationId) {
          return NextResponse.json({ error: "Square location not configured" }, { status: 503 });
        }

        // Square caps idempotency_key at 45 characters. UUID id is already 36
        // chars, so `bal-manual-${id}` (47) was rejected with VALUE_TOO_LONG.
        // Use the same short prefix style as bal-card-/bal-pay- elsewhere.
        const paymentRes = await squareClient.payments.create({
          sourceId: resolvedCardId,
          amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
          customerId: move.square_customer_id || undefined,
          referenceId: move.move_code || id,
          note: `Balance payment, manual charge by admin`,
          idempotencyKey: `bal-m-${id}`,
          locationId,
        });

        const paymentId = paymentRes.payment?.id;
        if (!paymentId) {
          return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
        }

        // Backfill the card id on the move when we had to look it up. Saves
        // the round-trip on the next charge (tips, balance adjustments).
        if (!move.square_card_id && resolvedCardId) {
          await admin
            .from("moves")
            .update({ square_card_id: resolvedCardId })
            .eq("id", id);
        }

        const receiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;

        await finalizeBalancePaymentSettlement({
          admin,
          moveId: id,
          balanceTaxInclusive: balanceAmount,
          squarePaymentId: paymentId,
          squareReceiptUrl: receiptUrl,
          settlementMethod: "admin",
          paymentMarkedBy: markedBy?.trim() || "admin",
          updateMoveReceiptUrl: !!receiptUrl,
        });

        const { data: updated, error: reloadErr } = await admin.from("moves").select("*").eq("id", id).single();
        if (reloadErr || !updated) {
          return NextResponse.json({ error: reloadErr?.message || "Move not found" }, { status: 400 });
        }

        await admin.from("status_events").insert({
          entity_type: "move",
          entity_id: id,
          event_type: "payment_received",
          description: `Card charged manually, ${ccBalance.toFixed(2)} CAD by ${markedBy?.trim() || "admin"}`,
          icon: "dollar",
        });

        return NextResponse.json(updated);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment processing failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // ── action: send_payment_link ───────────────────────────────────────
    // Admin-initiated balance collection when the move has NO square_card_id.
    // Emails the client a tokenized link to /track/move/[id] where the existing
    // POST /api/track/moves/[id]/payment-link endpoint generates a Square
    // checkout URL. The client clicks "Pay balance" on that page and pays via
    // Square. No card-on-file required.
    if (action === "send_payment_link") {
      const admin = createAdminClient();
      const { data: move, error: fetchErr } = await admin
        .from("moves")
        .select("id, client_email, client_name, move_code, balance_amount, balance_auto_charged, balance_paid_at, estimate")
        .eq("id", id)
        .single();

      if (fetchErr || !move) {
        return NextResponse.json({ error: "Move not found" }, { status: 404 });
      }
      const clientEmail = (move.client_email as string | null)?.trim();
      if (!clientEmail) {
        return NextResponse.json({ error: "Move has no client_email on file" }, { status: 400 });
      }

      const balanceAmount = Number(move.balance_amount || 0);
      if (balanceAmount <= 0) {
        return NextResponse.json({ error: "No balance to collect" }, { status: 400 });
      }

      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
      if (!baseUrl) {
        return NextResponse.json(
          { error: "NEXT_PUBLIC_APP_URL not configured" },
          { status: 503 },
        );
      }
      const token = signTrackToken("move", id);
      const moveCode = getMoveCode(move) || formatJobId(id, "move");
      const trackUrl = `${baseUrl}/track/move/${id}?token=${encodeURIComponent(token)}&pay=1`;

      const clientFirst = ((move.client_name as string | null) || "").split(" ")[0] || "there";
      const balanceStr = balanceAmount.toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      });

      const html = `
        <p>Hi ${clientFirst},</p>
        <p>Your remaining balance for move <strong>${moveCode}</strong> is <strong>${balanceStr}</strong>.</p>
        <p>You can pay securely with a card via Square here:</p>
        <p><a href="${trackUrl}" style="background:#66143D;color:#F9EDE4;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Pay ${balanceStr}</a></p>
        <p style="font-size:12px;color:#777;">If the button doesn't work, paste this link into your browser:<br>${trackUrl}</p>
        <p>Thanks,<br>Yugo</p>
      `;

      try {
        await sendEmail({
          to: clientEmail,
          subject: `Balance payment for ${moveCode} — ${balanceStr}`,
          html,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to send email";
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: "payment_link_sent",
        description: `Payment link emailed to ${clientEmail} for balance ${balanceStr}`,
        icon: "dollar",
      });
      await logAudit({
        userId: authUser?.id,
        userEmail: authUser?.email,
        action: "edit_move",
        resourceType: "move",
        resourceId: id,
        details: { kind: "payment_link_sent", email: clientEmail, amount_cad: balanceAmount },
      });

      return NextResponse.json({ ok: true, email: clientEmail, amount: balanceAmount });
    }

    if (action === "update_details") {
      const admin = createAdminClient();
      const {
        from_address, to_address, delivery_address,
        from_lat, from_lng, to_lat, to_lng,
        from_access, to_access, access_notes,
        scheduled_date, arrival_window,
        est_hours, estimated_duration_minutes, margin_alert_minutes,
        crew_id, coordinator_name,
        complexity_indicators, internal_notes,
      } = body as Record<string, unknown>;

      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (from_address !== undefined) updatePayload.from_address = from_address;
      if (to_address !== undefined) {
        updatePayload.to_address = to_address;
        updatePayload.delivery_address = delivery_address ?? to_address;
      }
      if (from_lat !== undefined) updatePayload.from_lat = from_lat;
      if (from_lng !== undefined) updatePayload.from_lng = from_lng;
      if (to_lat !== undefined) updatePayload.to_lat = to_lat;
      if (to_lng !== undefined) updatePayload.to_lng = to_lng;
      if (from_access !== undefined) updatePayload.from_access = from_access;
      if (to_access !== undefined) updatePayload.to_access = to_access;
      if (access_notes !== undefined) updatePayload.access_notes = access_notes;
      if (scheduled_date !== undefined) updatePayload.scheduled_date = scheduled_date;
      if (arrival_window !== undefined) updatePayload.arrival_window = arrival_window;
      if (est_hours !== undefined) updatePayload.est_hours = est_hours;
      if (estimated_duration_minutes !== undefined) updatePayload.estimated_duration_minutes = estimated_duration_minutes;
      if (margin_alert_minutes !== undefined) updatePayload.margin_alert_minutes = margin_alert_minutes;
      if (crew_id !== undefined) updatePayload.crew_id = crew_id;
      if (coordinator_name !== undefined) updatePayload.coordinator_name = coordinator_name;
      if (complexity_indicators !== undefined) updatePayload.complexity_indicators = complexity_indicators;
      if (internal_notes !== undefined) updatePayload.internal_notes = internal_notes;

      const { data: updated, error: updateErr } = await admin
        .from("moves")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
      await logAudit({
        userId: authUser?.id,
        userEmail: authUser?.email,
        action: "edit_move",
        resourceType: "move",
        resourceId: id,
        details: { fields: Object.keys(updatePayload) },
      });
      return NextResponse.json(updated);
    }

    if (action === "update_status") {
      const admin = createAdminClient();
      const { status } = body as { status?: string };
      if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });
      const { error: updateErr } = await admin.from("moves").update({ status }).eq("id", id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: `status_changed_to_${status}`,
        description: `Status updated to ${status}`,
        icon: "move",
      });
      await logAudit({
        userId: authUser?.id,
        userEmail: authUser?.email,
        action: "move_status_change",
        resourceType: "move",
        resourceId: id,
        details: { status },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "log_status_change") {
      const admin = createAdminClient();
      const { new_status, previous_status } = body as { new_status?: string; previous_status?: string };
      if (!new_status) return NextResponse.json({ error: "new_status required" }, { status: 400 });
      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: `status_changed_to_${new_status}`,
        description: `Status changed: ${previous_status ?? "unknown"} → ${new_status}`,
        icon: "move",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update move" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const admin = createAdminClient();

    await admin.from("move_inventory").delete().eq("move_id", id);
    await admin.from("move_documents").delete().eq("move_id", id);
    await admin.from("move_photos").delete().eq("move_id", id);
    await admin.from("move_change_requests").delete().eq("move_id", id);
    await admin.from("proof_of_delivery").delete().eq("move_id", id);

    const { data: moveInvoices } = await admin
      .from("invoices")
      .select("id, square_invoice_id")
      .eq("move_id", id);
    for (const inv of moveInvoices || []) {
      await cancelOrDeleteSquareInvoice(inv.square_invoice_id);
    }
    await admin.from("invoices").delete().eq("move_id", id);
    const { error } = await admin.from("moves").delete().eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete move" },
      { status: 500 }
    );
  }
}
