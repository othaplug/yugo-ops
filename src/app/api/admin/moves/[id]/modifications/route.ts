import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { movePatchFromModificationChanges } from "@/lib/moves/move-modification-apply";
import { isGCalConfigured } from "@/lib/google-calendar/client";
import { syncJobToGCal } from "@/lib/google-calendar/sync-job";

/**
 * POST — record a booking modification (coordinator). Price increase defaults to pending client approval.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move id required" }, { status: 400 });

  const body = (await req.json()) as {
    type?: string;
    changes?: Record<string, unknown>;
    new_price?: number | null;
    requested_by?: string;
    /** When false, skip client approval even if price increases (super-coordinator override). */
    require_client_approval?: boolean;
  };

  const type = String(body.type || "").trim();
  const changes = body.changes && typeof body.changes === "object" ? body.changes : {};
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });

  const sb = createAdminClient();
  const { data: move, error: mErr } = await sb
    .from("moves")
    .select("id, amount")
    .eq("id", moveId)
    .single();

  if (mErr || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const originalPrice = Number(move.amount) || 0;
  const newPrice =
    body.new_price != null && Number.isFinite(Number(body.new_price))
      ? Number(body.new_price)
      : originalPrice;
  const priceDifference = newPrice - originalPrice;

  const requireClient =
    body.require_client_approval !== false && priceDifference > 0;
  const status = requireClient ? "pending_approval" : "auto_approved";
  const clientToken =
    requireClient ? randomBytes(20).toString("hex") : null;

  const { data: row, error: insErr } = await sb
    .from("move_modifications")
    .insert({
      move_id: moveId,
      type,
      changes,
      original_price: originalPrice,
      new_price: newPrice,
      price_difference: priceDifference,
      requested_by: body.requested_by === "client" ? "client" : "coordinator",
      status,
      client_approval_token: clientToken,
    })
    .select("id, status, client_approval_token, price_difference")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  if (status === "auto_approved") {
    const patch = movePatchFromModificationChanges(
      changes as Record<string, unknown>,
      newPrice,
      originalPrice,
    );

    if (Object.keys(patch).length > 0) {
      await sb.from("moves").update(patch).eq("id", moveId);
    }

    await sb
      .from("move_modifications")
      .update({
        applied_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // GCal sync when date or addresses change
    if (isGCalConfigured() && (patch.scheduled_date || patch.from_address || patch.to_address)) {
      const { data: updatedMove } = await sb
        .from("moves")
        .select("id, move_code, client_name, service_type, move_type, status, scheduled_date, scheduled_start, estimated_duration_minutes, from_address, to_address, notes, gcal_event_id")
        .eq("id", moveId)
        .single();
      if (updatedMove) {
        syncJobToGCal({
          jobType: "move",
          jobId: moveId,
          jobCode: String(updatedMove.move_code || moveId),
          clientName: String(updatedMove.client_name || ""),
          serviceType: String(updatedMove.service_type || updatedMove.move_type || "residential"),
          status: String(updatedMove.status || "confirmed"),
          scheduledDate: updatedMove.scheduled_date ? String(updatedMove.scheduled_date).slice(0, 10) : null,
          startTime: updatedMove.scheduled_start ? String(updatedMove.scheduled_start).slice(0, 5) : null,
          estimatedDurationMinutes: updatedMove.estimated_duration_minutes != null ? Number(updatedMove.estimated_duration_minutes) : null,
          fromAddress: updatedMove.from_address ? String(updatedMove.from_address) : null,
          toAddress: updatedMove.to_address ? String(updatedMove.to_address) : null,
          crewName: null,
          notes: updatedMove.notes ? String(updatedMove.notes) : null,
          existingEventId: (updatedMove as { gcal_event_id?: string | null }).gcal_event_id ?? null,
        }).then(async (result) => {
          if (result.eventId !== undefined) {
            await sb.from("moves").update({ gcal_event_id: result.eventId }).eq("id", moveId);
          }
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true, modification: row });
}
