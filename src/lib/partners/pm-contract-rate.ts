import type { SupabaseClient } from "@supabase/supabase-js";
import { getContractPrice, type ContractRateCard } from "./contract-pricing";

export type PmRateCardRow = {
  base_rate: number;
  weekend_surcharge: number;
  after_hours_premium: number;
  holiday_surcharge: number;
  zone: string;
};

/** Maps universal reason_code to legacy JSON section key on partner_contracts.rate_card */
const REASON_TO_LEGACY_KEY: Record<string, string> = {
  reno_move_out: "renovation_move_out",
  reno_move_in: "renovation_move_in",
  unit_turnover: "renovation_move_out",
  tenant_move_in: "tenant_move_gta",
  tenant_move_out: "tenant_move_gta",
  incentive_move: "tenant_move_gta",
  suite_transfer: "tenant_move_gta",
  building_transfer: "tenant_move_outside",
  storage_move: "renovation_move_out",
  office_suite_setup: "tenant_move_gta",
  office_suite_clearout: "tenant_move_gta",
  staging: "renovation_move_in",
  destaging: "renovation_move_out",
  emergency_relocation: "tenant_move_outside",
  common_area: "tenant_move_gta",
  other: "tenant_move_gta",
};

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

export async function fetchRateMatrixRow(
  admin: SupabaseClient,
  contractId: string,
  reasonCode: string,
  unitSize: string,
  zone: string
): Promise<PmRateCardRow | null> {
  const { data: exact } = await admin
    .from("pm_rate_cards")
    .select("base_rate, weekend_surcharge, after_hours_premium, holiday_surcharge, zone")
    .eq("contract_id", contractId)
    .eq("reason_code", reasonCode)
    .eq("unit_size", unitSize)
    .eq("zone", zone)
    .eq("active", true)
    .maybeSingle();

  if (exact != null && exact.base_rate != null && String(exact.base_rate).trim() !== "") {
    return {
      base_rate: num(exact.base_rate),
      weekend_surcharge: num(exact.weekend_surcharge),
      after_hours_premium: num(exact.after_hours_premium),
      holiday_surcharge: num(exact.holiday_surcharge),
      zone: String(exact.zone || zone),
    };
  }

  if (zone !== "local") {
    const { data: fallback } = await admin
      .from("pm_rate_cards")
      .select("base_rate, weekend_surcharge, after_hours_premium, holiday_surcharge, zone")
      .eq("contract_id", contractId)
      .eq("reason_code", reasonCode)
      .eq("unit_size", unitSize)
      .eq("zone", "local")
      .eq("active", true)
      .maybeSingle();

    if (fallback != null && fallback.base_rate != null && String(fallback.base_rate).trim() !== "") {
      return {
        base_rate: num(fallback.base_rate),
        weekend_surcharge: num(fallback.weekend_surcharge),
        after_hours_premium: num(fallback.after_hours_premium),
        holiday_surcharge: num(fallback.holiday_surcharge),
        zone: "local",
      };
    }
  }

  return null;
}

export async function contractHasRateMatrix(admin: SupabaseClient, contractId: string): Promise<boolean> {
  const { count } = await admin
    .from("pm_rate_cards")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId)
    .eq("active", true);
  return (count ?? 0) > 0;
}

/**
 * Resolve base subtotal from pm_rate_cards or legacy partner_contracts.rate_card JSON.
 */
export async function resolvePmMoveBasePrice(
  admin: SupabaseClient,
  contractId: string,
  reasonCode: string,
  unitSize: string,
  zone: string,
  legacyRateCard: unknown
): Promise<{ subtotal: number; source: "matrix" | "legacy"; row?: PmRateCardRow }> {
  const matrix = await fetchRateMatrixRow(admin, contractId, reasonCode, unitSize, zone);
  if (matrix) {
    return { subtotal: matrix.base_rate, source: "matrix", row: matrix };
  }

  const legacyKey = REASON_TO_LEGACY_KEY[reasonCode] || "tenant_move_gta";
  const subtotal = getContractPrice(legacyRateCard as ContractRateCard, legacyKey, unitSize, {
    weekend: false,
    afterHours: false,
    holiday: false,
  });
  return { subtotal, source: "legacy" };
}

export function applyPmSurchargesAndUrgency(
  base: number,
  row: PmRateCardRow | null,
  legacyCard: unknown,
  opts: { weekend: boolean; afterHours: boolean; holiday: boolean; urgency: "standard" | "priority" | "emergency" }
): number {
  const card = legacyCard && typeof legacyCard === "object" ? (legacyCard as ContractRateCard) : {};
  const weekend = row?.weekend_surcharge ?? (num(card.weekend_surcharge) || 150);
  const afterPrem = row?.after_hours_premium ?? (num(card.after_hours_premium) || 0.2);
  const holidaySur = row?.holiday_surcharge ?? (num(card.holiday_surcharge) || 200);

  let total = base;
  if (opts.weekend) total += weekend;
  if (opts.holiday) total += holidaySur;
  if (opts.afterHours) total = Math.round(total * (1 + afterPrem));

  if (opts.urgency === "priority") total = Math.round(total * 1.15);
  if (opts.urgency === "emergency") total = Math.round(total * 1.3);

  return total;
}
