import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Record bin pickup counts / condition (admin). Crew can use same endpoint when authorized as staff.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const body = (await req.json()) as {
    bins_returned?: number;
    bins_missing?: number;
    wardrobe_boxes_returned?: number | null;
    pickup_condition?: string | null;
    mark_collected?: boolean;
  };

  const sb = createAdminClient();
  const { data: row, error: fetchErr } = await sb.from("bin_orders").select("id, bin_count, wardrobe_boxes_provided").eq("id", id.trim()).maybeSingle();
  if (fetchErr || !row) {
    return NextResponse.json({ error: "Bin order not found" }, { status: 404 });
  }

  const binCount = Math.max(1, Number(row.bin_count) || 1);
  const returned = Math.max(0, Math.min(binCount, Math.floor(Number(body.bins_returned ?? binCount))));
  const missing = Math.max(0, Math.min(binCount, Math.floor(Number(body.bins_missing ?? binCount - returned))));
  const wProvided = row.wardrobe_boxes_provided != null ? Math.max(0, Number(row.wardrobe_boxes_provided)) : null;
  const wRet =
    body.wardrobe_boxes_returned != null && wProvided != null
      ? Math.max(0, Math.min(wProvided, Math.floor(Number(body.wardrobe_boxes_returned))))
      : null;

  const { data: feeRows } = await sb.from("platform_config").select("key, value").in("key", ["bin_missing_bin_fee", "bin_rental_missing_bin_fee"]);
  const feeMap = Object.fromEntries((feeRows ?? []).map((r) => [r.key, r.value]));
  const missingBinFee = Number(feeMap.bin_missing_bin_fee ?? feeMap.bin_rental_missing_bin_fee ?? "12") || 12;
  const missingCharge = missing * missingBinFee;

  const patch: Record<string, unknown> = {
    bins_returned: returned,
    bins_missing: missing,
    missing_bin_charge: missingCharge,
    pickup_condition: body.pickup_condition?.trim() || null,
  };
  if (wRet != null) patch.wardrobe_boxes_returned = wRet;

  if (body.mark_collected) {
    patch.status = "bins_collected";
    patch.pickup_completed_at = new Date().toISOString();
  }

  const { error: upErr } = await sb.from("bin_orders").update(patch).eq("id", id.trim());
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
