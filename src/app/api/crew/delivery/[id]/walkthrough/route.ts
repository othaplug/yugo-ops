import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { normalizeCrewJobId, selectDeliveryByJobId } from "@/lib/resolve-delivery-by-job-id";

/**
 * POST /api/crew/delivery/[id]/walkthrough
 * Records pickup inventory walkthrough discrepancies for a delivery (crew portal).
 * Move jobs use /api/crew/walkthrough/[jobId] instead.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const jobId = normalizeCrewJobId(rawId);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: d } = await selectDeliveryByJobId(admin, jobId, "id, crew_id, notes, delivery_number");

  if (!d || d.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const deliveryId = String(d.id);
  const prevNotes = typeof d.notes === "string" ? d.notes.trim() : "";
  const stamp = new Date().toISOString();

  const itemsMatched = typeof body.items_matched === "number" ? body.items_matched : 0;
  const itemsExtra = typeof body.items_extra === "number" ? body.items_extra : 0;
  const itemsMissingCount = typeof body.items_missing_count === "number" ? body.items_missing_count : 0;

  const addedRaw = Array.isArray(body.items_added) ? body.items_added : [];
  const missingRaw = Array.isArray(body.items_missing) ? body.items_missing : [];

  const extraLines = addedRaw
    .map((row: unknown) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const name = typeof o.item_name === "string" ? o.item_name : "?";
      const qty = typeof o.quantity === "number" ? o.quantity : 1;
      return `  + ${name} ×${qty}`;
    })
    .filter(Boolean);

  const missingLines = missingRaw
    .map((row: unknown) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const name = typeof o.item_name === "string" ? o.item_name : "?";
      const qty = typeof o.quantity === "number" ? o.quantity : 1;
      return `  − ${name} ×${qty} (reported missing)`;
    })
    .filter(Boolean);

  const block = [
    `[${stamp}] Crew inventory walkthrough (pickup)`,
    `Matched: ${itemsMatched}, missing: ${itemsMissingCount}, extras: ${itemsExtra}`,
    ...(extraLines.length ? ["Extras:", ...extraLines] : []),
    ...(missingLines.length ? ["Missing:", ...missingLines] : []),
  ].join("\n");

  const nextNotes = prevNotes ? `${prevNotes}\n\n${block}` : block;

  const { error } = await admin.from("deliveries").update({ notes: nextNotes, updated_at: stamp }).eq("id", deliveryId);

  if (error) {
    console.error("[crew/delivery/walkthrough]", error);
    return NextResponse.json({ error: "Failed to save walkthrough" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: null });
}
