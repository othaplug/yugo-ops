import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const [invRes, extraRes, moveRes] = await Promise.all([
      admin.from("move_inventory").select("id, room, item_name, box_number, sort_order").eq("move_id", moveId).order("room").order("sort_order").order("item_name"),
      // P0 #1 (2026-06-24): drop the status="approved" filter so pending
      // items are visible to the client. Without this, items the admin
      // added (or that the client requested) wait silently in the DB until
      // approval — Chidera's complaint was she had no way to see what was
      // happening. Status + fee_cents now ride along so the UI can render
      // a "Pending review" pill and a projected fee.
      admin.from("extra_items").select("id, description, room, quantity, added_at, status, fee_cents, payment_charged").eq("job_id", moveId).order("added_at"),
      admin.from("moves").select("client_box_count, quote_id").eq("id", moveId).maybeSingle(),
    ]);
    const { data: items, error } = invRes;
    const { data: extraItems } = extraRes;
    const moveRow = moveRes.data;

    // Box count: move first, then quote fallback (mirrors the admin inventory
    // API). Boxes are part of the move list but were never returned here, so
    // the client track page showed furniture only.
    let boxCount =
      moveRow?.client_box_count != null && Number.isFinite(Number(moveRow.client_box_count))
        ? Math.max(0, Math.round(Number(moveRow.client_box_count)))
        : 0;
    if (boxCount <= 0 && moveRow?.quote_id && typeof moveRow.quote_id === "string") {
      const { data: qRow } = await admin
        .from("quotes")
        .select("client_box_count")
        .eq("id", moveRow.quote_id)
        .maybeSingle();
      const qb = qRow?.client_box_count;
      if (qb != null && Number.isFinite(Number(qb)) && Number(qb) > 0) {
        boxCount = Math.round(Number(qb));
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: items ?? [], extraItems: extraItems ?? [], boxCount });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}
