import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWalkthroughToken } from "@/lib/track-token";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";

// ─────────────────────────────────────────────────────────────
// GET /api/walkthrough/[token]
// Public — returns walkthrough data for the client page.
// Token is moveId.sig (HMAC-signed).
// ─────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const moveId = verifyWalkthroughToken(token);
  if (!moveId) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });

  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("id, move_code, client_name, status")
    .eq("id", moveId)
    .maybeSingle();

  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // walkthrough_remote_confirmed / walkthrough_notes / move_inventory.quantity
  // were never migrated. Until they are, expose stable defaults so the
  // walkthrough page renders.
  const { data: items } = await admin
    .from("move_inventory")
    .select("id, room, item_name")
    .eq("move_id", moveId)
    .order("room")
    .order("item_name");

  const base = getEmailBaseUrl();
  const trackUrl = `${base}/track/move/${move.move_code || moveId}?token=${signTrackToken("move", moveId)}`;

  return NextResponse.json({
    moveId,
    clientName: move.client_name,
    status: move.status,
    alreadyConfirmed: false,
    crewNotes: null,
    items: (items ?? []).map((it: Record<string, unknown>) => ({
      id: it.id,
      room: it.room ?? null,
      itemName: it.item_name,
      quantity: 1,
    })),
    trackUrl,
  });
}
