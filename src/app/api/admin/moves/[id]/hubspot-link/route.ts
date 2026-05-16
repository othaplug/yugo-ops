import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { isMoveIdUuid } from "@/lib/move-code";
import { buildAllDealProperties } from "@/lib/hubspot/deal-properties-builder";

/**
 * POST /api/admin/moves/[id]/hubspot-link
 * Links an existing HubSpot deal to this move (instead of creating a new one).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const rawSlug = (await params).id?.trim() || "";
  const body = (await req.json()) as { deal_id?: string };
  const dealId = String(body.deal_id ?? "").trim();
  if (!dealId) {
    return NextResponse.json({ error: "deal_id required" }, { status: 400 });
  }

  const sb = createAdminClient();
  const byUuid = isMoveIdUuid(rawSlug);
  const { data: move, error: fetchErr } = await (byUuid
    ? sb.from("moves").select("id, hubspot_deal_id, scheduled_date, client_name, from_address, to_address, estimate").eq("id", rawSlug).single()
    : sb.from("moves").select("id, hubspot_deal_id, scheduled_date, client_name, from_address, to_address, estimate").ilike("move_code", rawSlug.replace(/^#/, "").toUpperCase()).single());

  if (fetchErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const { error: updateErr } = await sb
    .from("moves")
    .update({
      hubspot_deal_id: dealId,
      hubspot_duplicate_detected: false,
    })
    .eq("id", move.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Non-blocking: sync deal properties to HubSpot
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (token) {
    const moveRow = move as {
      scheduled_date?: string | null;
      client_name?: string | null;
      from_address?: string | null;
      to_address?: string | null;
      estimate?: number | null;
    };
    const props = buildAllDealProperties({
      moveDate: moveRow.scheduled_date,
      fromAddress: String(moveRow.from_address ?? ""),
      toAddress: String(moveRow.to_address ?? ""),
      totalPrice: moveRow.estimate ? Number(moveRow.estimate) : undefined,
    });
    fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: props }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
