import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PM_RATE_CARD } from "./pm-rate-card-defaults";
import { seedPmRateMatrixFromDefaults } from "./seed-pm-rate-matrix";

export type PmPropertyInput = {
  building_name: string;
  address: string;
  postal_code?: string;
  total_units?: number;
  unit_types?: string[];
  has_loading_dock?: boolean;
  has_move_elevator?: boolean;
  elevator_type?: string;
  move_hours?: string;
  parking_type?: string;
  building_contact_name?: string;
  building_contact_phone?: string;
  notes?: string;
};

export type PmOnboardingInput = {
  properties: PmPropertyInput[];
  contract_type: "per_move" | "fixed_rate" | "day_rate_retainer";
  start_date: string;
  end_date: string;
  auto_renew?: boolean;
  tenant_comms_by?: "partner" | "yugo";
  rate_card?: Record<string, unknown> | null;
  days_per_week?: number | null;
  day_rate?: number | null;
};

function contractNumber(): string {
  const y = new Date().getFullYear();
  const r = Math.floor(1000 + Math.random() * 9000);
  return `PM-${y}-${r}`;
}

/** Insert partner_properties + partner_contracts after organization is created. */
export async function provisionPmPartnerPortfolio(
  admin: SupabaseClient,
  orgId: string,
  input: PmOnboardingInput,
  contractStatus: "draft" | "active"
): Promise<{ contractId: string | null }> {
  const props = (input.properties || []).filter((p) => p.building_name?.trim() && p.address?.trim());
  if (props.length === 0) return { contractId: null };

  for (const p of props) {
    const { error } = await admin.from("partner_properties").insert({
      partner_id: orgId,
      building_name: p.building_name.trim(),
      address: p.address.trim(),
      postal_code: p.postal_code?.trim() || null,
      total_units: typeof p.total_units === "number" ? p.total_units : null,
      unit_types: Array.isArray(p.unit_types) && p.unit_types.length ? p.unit_types : null,
      has_loading_dock: !!p.has_loading_dock,
      has_move_elevator: !!p.has_move_elevator,
      elevator_type: p.elevator_type?.trim() || null,
      move_hours: p.move_hours?.trim() || null,
      parking_type: p.parking_type?.trim() || null,
      building_contact_name: p.building_contact_name?.trim() || null,
      building_contact_phone: p.building_contact_phone?.trim() || null,
      notes: p.notes?.trim() || null,
    });
    if (error) console.error("[provisionPmPartnerPortfolio] property insert:", error.message);
  }

  const num = contractNumber();
  const rateCard =
    input.contract_type === "fixed_rate"
      ? (input.rate_card && typeof input.rate_card === "object" ? input.rate_card : DEFAULT_PM_RATE_CARD)
      : input.rate_card ?? null;

  const { data: contractRow, error: cErr } = await admin
    .from("partner_contracts")
    .insert({
      partner_id: orgId,
      contract_number: num,
      contract_type: input.contract_type,
      start_date: input.start_date,
      end_date: input.end_date,
      auto_renew: !!input.auto_renew,
      rate_card: rateCard,
      days_per_week: input.days_per_week ?? null,
      day_rate: input.day_rate ?? null,
      tenant_comms_by: input.tenant_comms_by === "yugo" ? "yugo" : "partner",
      status: contractStatus,
      payment_terms: "net_30",
      cancellation_notice_days: 30,
      rate_lock_months: 12,
    })
    .select("id")
    .single();

  if (cErr) {
    console.error("[provisionPmPartnerPortfolio] contract insert:", cErr.message);
    return { contractId: null };
  }

  const contractId = (contractRow as { id: string })?.id ?? null;
  if (contractId && input.contract_type === "fixed_rate" && rateCard) {
    const { count } = await admin
      .from("pm_rate_cards")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", contractId);
    if ((count ?? 0) === 0) await seedPmRateMatrixFromDefaults(admin, contractId);
  }

  return { contractId };
}
