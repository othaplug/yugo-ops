import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/track/moves/[id]/crew-change-request/[requestId]/decline?token=...
// Client declines the extra items. Crew proceeds with original list only.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`crew-cr-decline:${ip}`, 5, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: moveId, requestId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the change request
  const { data: cr, error: crErr } = await admin
    .from("inventory_change_requests")
    .select("*")
    .eq("id", requestId)
    .eq("move_id", moveId)
    .eq("source", "crew")
    .in("status", ["pending", "admin_reviewing"])
    .maybeSingle();

  if (crErr || !cr) {
    return NextResponse.json({ error: "Change request not found or already resolved" }, { status: 404 });
  }

  if (cr.client_response) {
    return NextResponse.json({ error: "Already responded to this request" }, { status: 400 });
  }

  // Build note about declined items
  const itemsAdded = Array.isArray(cr.items_added) ? cr.items_added as Array<{ item_name?: string; quantity?: number }> : [];
  const declinedNote = itemsAdded
    .filter((i) => i?.item_name)
    .map((i) => `${i.item_name}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ""}`)
    .join(", ");

  await admin
    .from("inventory_change_requests")
    .update({
      client_response: "declined",
      client_responded_at: new Date().toISOString(),
      extras_declined_note: declinedNote ? `Client declined extras: ${declinedNote}` : "Client declined extras",
      status: "declined",
      decline_reason: "Client declined on tracking page",
    })
    .eq("id", requestId);

  // Clear pending link on move
  await admin
    .from("moves")
    .update({ pending_inventory_change_request_id: null })
    .eq("id", moveId);

  // Audit trail
  try {
    const { data: move } = await admin.from("moves").select("move_code, crew_id").eq("id", moveId).single();
    await admin.from("status_events").insert({
      entity_type: "move",
      entity_id: String(move?.move_code || moveId),
      event_type: "change_request",
      description: `Client declined extra items: ${declinedNote || "(none specified)"}. Crew proceeds with original list.`,
      icon: "x",
    });

    // SMS crew
    if (move?.crew_id) {
      const { data: crew } = await admin
        .from("crews")
        .select("phone")
        .eq("id", move.crew_id)
        .maybeSingle();
      if (crew?.phone) {
        await sendSMS(
          normalizePhone(crew.phone),
          `Yugo: Client declined extras. Do NOT load: ${declinedNote || "extra items"}. Proceed with original list.`,
        );
      }
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
