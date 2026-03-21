import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { logAudit } from "@/lib/audit";

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

    if (action === "mark_paid") {
      if (!markedBy?.trim()) {
        return NextResponse.json({ error: "marked_by is required" }, { status: 400 });
      }
      const admin = createAdminClient();
      const now = new Date().toISOString();

      const { data: move, error: updateErr } = await admin
        .from("moves")
        .update({
          status: "paid",
          payment_marked_paid: true,
          payment_marked_paid_at: now,
          payment_marked_paid_by: markedBy.trim(),
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
      if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: "status_change",
        description: `Move marked as paid by ${markedBy.trim()}`,
        icon: "dollar",
      });

      await auditAfter({ status: "paid", markedBy: markedBy.trim() });
      return NextResponse.json(move);
    }

    if (action === "mark_etransfer_received") {
      const admin = createAdminClient();
      const now = new Date().toISOString();

      const { data: move, error: updateErr } = await admin
        .from("moves")
        .update({
          balance_paid_at: now,
          balance_method: "etransfer",
          status: "paid",
          payment_marked_paid: true,
          payment_marked_paid_at: now,
          payment_marked_paid_by: markedBy?.trim() || "admin",
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
      if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: id,
        event_type: "payment_received",
        description: `E-transfer received — balance marked as paid by ${markedBy?.trim() || "admin"}`,
        icon: "dollar",
      });

      await auditAfter({ status: "paid", method: "etransfer" });
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
      if (move.balance_paid_at) {
        return NextResponse.json({ error: "Balance already paid" }, { status: 409 });
      }
      if (!move.square_card_id) {
        return NextResponse.json({ error: "No card on file for this move" }, { status: 400 });
      }

      const balanceAmount = Number(move.balance_amount || 0);
      if (balanceAmount <= 0) {
        return NextResponse.json({ error: "No balance to charge" }, { status: 400 });
      }

      const ccBalance = balanceAmount * 1.033 + 0.15;
      const amountCents = Math.round(ccBalance * 100);

      try {
        const { locationId } = await getSquarePaymentConfig();
        if (!locationId) {
          return NextResponse.json({ error: "Square location not configured" }, { status: 503 });
        }

        const paymentRes = await squareClient.payments.create({
          sourceId: move.square_card_id,
          amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
          customerId: move.square_customer_id || undefined,
          referenceId: move.move_code || id,
          note: `Balance + processing fee — manual charge by admin`,
          idempotencyKey: `bal-manual-${id}-${Date.now()}`,
          locationId,
        });

        const paymentId = paymentRes.payment?.id;
        if (!paymentId) {
          return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
        }

        const now = new Date().toISOString();
        const { data: updated, error: updateErr } = await admin
          .from("moves")
          .update({
            balance_paid_at: now,
            balance_method: "card",
            balance_auto_charged: false,
            status: "paid",
            payment_marked_paid: true,
            payment_marked_paid_at: now,
            payment_marked_paid_by: markedBy?.trim() || "admin",
            updated_at: now,
          })
          .eq("id", id)
          .select()
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 400 });
        }

        await admin.from("status_events").insert({
          entity_type: "move",
          entity_id: id,
          event_type: "payment_received",
          description: `Card charged manually — ${(ccBalance).toFixed(2)} CAD by ${markedBy?.trim() || "admin"}`,
          icon: "dollar",
        });

        return NextResponse.json(updated);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment processing failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
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
    await admin.from("invoices").update({ move_id: null }).eq("move_id", id);
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
