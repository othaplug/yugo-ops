import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PM_RATE_CARD } from "./pm-rate-card-defaults";

const UNIT_KEYS = ["studio", "1br", "2br", "3br", "4br_plus"] as const;

function section(card: Record<string, unknown>, key: string): Record<string, number> | null {
  const s = card[key];
  if (!s || typeof s !== "object") return null;
  const out: Record<string, number> = {};
  for (const u of UNIT_KEYS) {
    const v = (s as Record<string, unknown>)[u];
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (!Number.isNaN(n)) out[u] = n;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Inserts pm_rate_cards rows (local zone) from DEFAULT_PM_RATE_CARD.
 */
export async function seedPmRateMatrixFromDefaults(admin: SupabaseClient, contractId: string): Promise<void> {
  const card = DEFAULT_PM_RATE_CARD as Record<string, unknown>;
  const inserts: {
    contract_id: string;
    reason_code: string;
    unit_size: string;
    zone: string;
    base_rate: number;
    weekend_surcharge?: number;
  }[] = [];

  const addReason = (reasonCode: string, legacyKey: string, zone: string = "local") => {
    const sec = section(card, legacyKey);
    if (!sec) return;
    for (const u of UNIT_KEYS) {
      const br = sec[u];
      if (br == null) continue;
      inserts.push({
        contract_id: contractId,
        reason_code: reasonCode,
        unit_size: u,
        zone,
        base_rate: br,
        ...(reasonCode === "reno_bundle" ? { weekend_surcharge: 200 } : {}),
      });
    }
  };

  addReason("tenant_move_out", "tenant_move_out");
  addReason("tenant_move_in", "tenant_move_in");
  addReason("reno_move_out", "reno_move_out");
  addReason("reno_move_in", "reno_move_in");
  addReason("reno_bundle", "reno_bundle");
  addReason("suite_transfer", "suite_transfer");
  addReason("emergency_relocation", "emergency_relocation");
  addReason("staging", "staging");
  addReason("unit_turnover", "unit_turnover");

  addReason("destaging", "staging");
  addReason("incentive_move", "tenant_move_in");
  addReason("office_suite_setup", "tenant_move_in");
  addReason("office_suite_clearout", "tenant_move_in");
  addReason("common_area", "tenant_move_in");
  addReason("storage_move", "reno_move_out");
  addReason("building_transfer", "tenant_move_outside", "outside_gta");
  addReason("other", "tenant_move_in");

  if (inserts.length === 0) return;

  const { error } = await admin.from("pm_rate_cards").insert(inserts);
  if (error) console.error("[seedPmRateMatrixFromDefaults]", error.message);
}
