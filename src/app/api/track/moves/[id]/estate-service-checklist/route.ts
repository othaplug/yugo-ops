import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedEstateServiceChecklistItem,
} from "@/lib/estate-service-checklist";
import { deriveEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-automation";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { token, item, checked } = await req.json();

  if (!token || !item) {
    return NextResponse.json(
      { error: "Missing token or item" },
      { status: 400 },
    );
  }

  if (!isAllowedEstateServiceChecklistItem(String(item))) {
    return NextResponse.json({ error: "Invalid checklist item" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: move, error: fetchErr } = await supabase
    .from("moves")
    .select(
      "id, estate_service_checklist, tier_selected, service_tier, status, stage, scheduled_date, move_size, inventory_score",
    )
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

  const current =
    (move.estate_service_checklist as Record<string, boolean>) || {};
  let updated = { ...current, [String(item)]: Boolean(checked) };

  const auto = deriveEstateServiceChecklistAutomation(move);
  for (const [k, v] of Object.entries(auto)) {
    if (v) updated[k] = true;
  }

  const { error: updErr } = await supabase
    .from("moves")
    .update({ estate_service_checklist: updated })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json(
      { error: updErr.message || "Update failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, checklist: updated });
}
