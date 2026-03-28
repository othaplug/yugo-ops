import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function GET(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const contractId = req.nextUrl.searchParams.get("contract_id")?.trim();
  if (!contractId) return NextResponse.json({ error: "contract_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: contract } = await admin.from("partner_contracts").select("partner_id").eq("id", contractId).single();
  if (!contract || contract.partner_id !== orgId) {
    return NextResponse.json({ error: "Invalid contract" }, { status: 403 });
  }

  const { data } = await admin
    .from("pm_contract_addons")
    .select("id, addon_code, label, price, price_type")
    .eq("contract_id", contractId)
    .eq("active", true)
    .order("label", { ascending: true });

  return NextResponse.json({ addons: data ?? [] });
}
