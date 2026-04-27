import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyPmSurchargesAndUrgency,
  resolvePmMoveBasePrice,
} from "@/lib/partners/pm-contract-rate";
import {
  isWeekendDate,
  zoneForAddresses,
} from "@/lib/partners/pm-book-helpers";

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

export function packingFlatFromContractRateCard(rateCard: unknown): number {
  const c =
    rateCard && typeof rateCard === "object"
      ? (rateCard as Record<string, unknown>)
      : {};
  const p = num(c.packing_per_room);
  return p > 0 ? p : 150;
}

export type PmBatchLineInput = {
  partner_property_id: string;
  unit_number: string;
  unit_type: string;
  reason_code: string;
  tenant_name: string;
  tenant_phone?: string;
  tenant_email?: string;
  scheduled_date: string;
  holding_unit?: string;
  packing_required?: boolean;
  after_hours?: boolean;
  holiday?: boolean;
  tenant_present?: boolean;
  linked_batch_index?: number | null;
};

export async function pricePmBatchLine(
  admin: SupabaseClient,
  contractId: string,
  legacyRateCard: unknown,
  line: PmBatchLineInput,
  property: { address: string; service_region: string | null },
): Promise<{ subtotal: number; zone: string }> {
  const unit = String(line.unit_number || "").trim();
  const fromAddress = `${String(property.address || "").trim()} · Unit ${unit}`;
  const hold = String(line.holding_unit || "").trim();
  const toAddress = hold
    ? `${hold} (holding)`
    : String(property.address || "").trim();

  const zone = zoneForAddresses(fromAddress, toAddress, property.service_region);
  const weekend = isWeekendDate(line.scheduled_date);

  const resolved = await resolvePmMoveBasePrice(
    admin,
    contractId,
    line.reason_code,
    line.unit_type,
    zone,
    legacyRateCard,
  );
  let subtotal = applyPmSurchargesAndUrgency(
    resolved.subtotal,
    resolved.row ?? null,
    legacyRateCard,
    {
      weekend,
      afterHours: !!line.after_hours,
      holiday: !!line.holiday,
      urgency: "standard",
    },
  );
  if (line.packing_required) {
    subtotal += packingFlatFromContractRateCard(legacyRateCard);
  }
  return { subtotal: Math.round(subtotal), zone };
}
