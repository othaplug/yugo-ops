import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

function isEstateMoveRow(move: {
  tier_selected?: string | null;
  service_tier?: string | null;
}): boolean {
  const t = String(move.tier_selected || move.service_tier || "")
    .toLowerCase()
    .trim();
  return t === "estate";
}

/**
 * Estate service milestones are staff-controlled only. Clients see live progress on
 * track; coordinators update checkboxes in admin (same `estate_service_checklist` row).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { token } = await req.json().catch(() => ({}));

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: move, error: fetchErr } = await supabase
    .from("moves")
    .select("id, tier_selected, service_tier")
    .eq("id", id)
    .single();

  if (fetchErr || !move) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!verifyTrackToken("move", move.id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEstateMoveRow(move)) {
    return NextResponse.json(
      { error: "Estate checklist is only for Estate moves" },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error:
        "Estate milestones can only be updated by your coordinator in our system. Refresh this page to see the latest status.",
    },
    { status: 403 },
  );
}
