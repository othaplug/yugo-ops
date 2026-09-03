import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMoveQuoteToken } from "@/lib/authz/move-quote-token";
import { requireStaff } from "@/lib/api-auth";

/**
 * GET /api/client/scheduling-status?moveId=...
 *
 * Returns the auto-scheduling outcome for a move:
 *   - { status: "available" }     → already auto-scheduled, nothing to show
 *   - { status: "partial", alternatives: [...] } → show slot picker
 *   - { status: "unavailable" }   → show coordinator-will-call message
 */
export async function GET(req: NextRequest) {
  const moveId = req.nextUrl.searchParams.get("moveId");
  if (!moveId) {
    return NextResponse.json({ status: "none" });
  }

  const admin = createAdminClient();

  // Authorize: staff (the admin scheduling widget) OR the client presenting the
  // booking's public_action_token. Without this, anyone with the move UUID could
  // read its scheduling options.
  const token = req.nextUrl.searchParams.get("token");
  const staff = await requireStaff();
  if (staff.error && !(await verifyMoveQuoteToken(admin, moveId, token))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: move } = await admin
    .from("moves")
    .select("status")
    .eq("id", moveId)
    .single();

  if (!move) return NextResponse.json({ status: "none" });

  const moveStatus = (move.status as string) ?? "";

  if (moveStatus === "confirmed_pending_schedule") {
    const { data: alts } = await admin
      .from("scheduling_alternatives")
      .select("id, alt_date, alt_window, team_name")
      .eq("move_id", moveId)
      .eq("is_selected", false)
      .order("alt_date", { ascending: true });

    return NextResponse.json({ status: "partial", alternatives: alts ?? [] });
  }

  if (moveStatus === "confirmed_unassigned") {
    return NextResponse.json({ status: "unavailable" });
  }

  return NextResponse.json({ status: "available" });
}
