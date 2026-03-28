import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { contractHasRateMatrix } from "@/lib/partners/pm-contract-rate";

/** Configured move reasons available for booking (global + partner custom, minus disables & contract filter). */
export async function GET(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const contractId = req.nextUrl.searchParams.get("contract_id")?.trim();
  if (!contractId) {
    return NextResponse.json({ error: "contract_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: contract } = await admin
    .from("partner_contracts")
    .select("id, partner_id, rate_card")
    .eq("id", contractId)
    .single();
  if (!contract || contract.partner_id !== orgId) {
    return NextResponse.json({ error: "Invalid contract" }, { status: 403 });
  }

  const [{ data: globals }, { data: customs }, { data: disables }, { data: crRows }, hasMatrix] = await Promise.all([
    admin.from("pm_move_reasons").select("*").is("partner_id", null).eq("active", true).order("sort_order", { ascending: true }),
    admin.from("pm_move_reasons").select("*").eq("partner_id", orgId).eq("active", true).order("sort_order", { ascending: true }),
    admin.from("pm_partner_move_reason_disable").select("reason_code").eq("partner_id", orgId),
    admin.from("pm_contract_reason_codes").select("reason_code, active").eq("contract_id", contractId).eq("active", true),
    contractHasRateMatrix(admin, contractId),
  ]);

  const disabled = new Set((disables ?? []).map((d) => d.reason_code as string));
  let merged = [...(globals ?? []), ...(customs ?? [])].filter((r) => !disabled.has(r.reason_code as string));

  if ((crRows ?? []).length > 0) {
    const allow = new Set((crRows ?? []).map((r) => r.reason_code as string));
    merged = merged.filter((r) => allow.has(r.reason_code as string));
  }

  if (hasMatrix) {
    const { data: rated } = await admin.from("pm_rate_cards").select("reason_code").eq("contract_id", contractId).eq("active", true);
    const codes = new Set((rated ?? []).map((r) => r.reason_code as string));
    if (codes.size > 0) merged = merged.filter((r) => codes.has(r.reason_code as string));
  }

  return NextResponse.json({
    reasons: merged,
    uses_rate_matrix: hasMatrix,
    has_legacy_rate_card: !!(contract.rate_card && typeof contract.rate_card === "object"),
  });
}
