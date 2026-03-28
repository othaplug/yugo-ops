import type { SupabaseClient } from "@supabase/supabase-js";
import { detectZone } from "./pm-zone";

const LEGACY_MOVE_KIND_TO_REASON: Record<string, string> = {
  renovation_move_out: "reno_move_out",
  renovation_move_in: "reno_move_in",
  renovation_bundle: "reno_move_out",
  tenant_move_gta: "tenant_move_in",
  tenant_move_outside: "tenant_move_out",
};

export function normalizePmReasonCode(body: Record<string, unknown>): string {
  const rc = String(body.reason_code || "").trim();
  if (rc) return rc;
  const mk = String(body.move_kind || "").trim();
  return LEGACY_MOVE_KIND_TO_REASON[mk] || mk || "";
}

export function pairedReturnReason(primaryCode: string): string {
  if (primaryCode === "reno_move_out") return "reno_move_in";
  if (primaryCode === "staging") return "destaging";
  return primaryCode;
}

export async function loadPmReasonRow(
  admin: SupabaseClient,
  orgId: string,
  reasonCode: string
): Promise<Record<string, unknown> | null> {
  const { data: rows } = await admin
    .from("pm_move_reasons")
    .select("*")
    .eq("reason_code", reasonCode)
    .or(`partner_id.eq.${orgId},partner_id.is.null`);

  const list = rows ?? [];
  const custom = list.find((r) => r.partner_id === orgId);
  const global = list.find((r) => r.partner_id == null);
  return (custom ?? global) as Record<string, unknown> | null;
}

export async function partnerMayUseReason(
  admin: SupabaseClient,
  orgId: string,
  contractId: string,
  reasonCode: string
): Promise<boolean> {
  const { data: dis } = await admin
    .from("pm_partner_move_reason_disable")
    .select("reason_code")
    .eq("partner_id", orgId)
    .eq("reason_code", reasonCode)
    .maybeSingle();
  if (dis) return false;

  const { data: cr } = await admin
    .from("pm_contract_reason_codes")
    .select("reason_code")
    .eq("contract_id", contractId)
    .eq("active", true);
  if ((cr ?? []).length > 0) {
    const allow = new Set((cr ?? []).map((r) => r.reason_code as string));
    if (!allow.has(reasonCode)) return false;
  }

  const { count } = await admin
    .from("pm_rate_cards")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId)
    .eq("active", true);
  const hasMatrix = (count ?? 0) > 0;
  if (hasMatrix) {
    const { data: rated } = await admin
      .from("pm_rate_cards")
      .select("reason_code")
      .eq("contract_id", contractId)
      .eq("active", true);
    const codes = new Set((rated ?? []).map((r) => r.reason_code as string));
    if (codes.size > 0 && !codes.has(reasonCode)) return false;
  }

  return true;
}

export function isWeekendDate(isoDate: string): boolean {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function zoneForAddresses(
  fromAddress: string,
  toAddress: string,
  propertyServiceRegion: string | null | undefined
): ReturnType<typeof detectZone> {
  const hint = (propertyServiceRegion || "gta").toLowerCase();
  return detectZone(fromAddress, toAddress, hint);
}
