import type { SupabaseClient } from "@supabase/supabase-js";
import { tryGetContractPrice, type ContractRateCard } from "./contract-pricing";

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
  reno_bundle: "tenant_move_gta",
};

/**
 * Ordered legacy JSON keys on partner_contracts.rate_card to attempt.
 * Modern seeded cards use canonical reason_codes (reno_move_out, …); older cards used renovation_*.
 */
function legacyRateSectionKeys(reasonCode: string): string[] {
  const keys: string[] = [];
  const add = (k: string | undefined | null) => {
    const t = String(k || "").trim();
    if (!t || keys.includes(t)) return;
    keys.push(t);
  };

  add(reasonCode);
  add(REASON_TO_LEGACY_KEY[reasonCode]);

  const renoDisplacementOut = ["reno_move_out", "unit_turnover", "storage_move", "destaging"];
  if (renoDisplacementOut.includes(reasonCode)) {
    add("reno_move_out");
    add("renovation_move_out");
  }

  const renoDisplacementIn = ["reno_move_in", "staging"];
  if (renoDisplacementIn.includes(reasonCode)) {
    add("reno_move_in");
    add("renovation_move_in");
  }

  if (reasonCode === "reno_bundle") {
    add("reno_bundle");
  }

  if (reasonCode === "building_transfer" || reasonCode === "emergency_relocation") {
    add("tenant_move_outside");
    add("tenant_move_gta");
  }

  add("tenant_move_gta");
  add("tenant_move_outside");
  add("tenant_move_in");
  add("tenant_move_out");
  return keys;
}

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

  const card = legacyRateCard as ContractRateCard;
  const extras = { weekend: false, afterHours: false, holiday: false } as const;
  const triedKeys: string[] = [];
  for (const legacyKey of legacyRateSectionKeys(reasonCode)) {
    triedKeys.push(legacyKey);
    const subtotal = tryGetContractPrice(card, legacyKey, unitSize, extras);
    if (subtotal != null) {
      return { subtotal, source: "legacy" };
    }
  }

  throw new Error(
    `No rate for PM move (${reasonCode} / ${unitSize}). Tried rate card sections: ${triedKeys.join(", ")}. Add rows to pm_rate_cards for this contract or add one of those sections to the legacy rate card JSON.`,
  );
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
