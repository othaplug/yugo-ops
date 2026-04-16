import { isDeliveryId } from "@/lib/delivery-number";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";

/**
 * Shared B2B / partner revenue: Command Center, Finance → Revenue, reports.
 * Invoice linked to a delivery is source of truth; delivery row is fallback when no invoice exists.
 */

export type PartnerRevenueInvoice = {
  id: string;
  client_name?: string | null;
  organization_id?: string | null;
  delivery_id?: string | null;
  move_id?: string | null;
  amount?: number | null;
  status?: string | null;
  invoice_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
  deliveries?:
    | { delivery_number?: string | null }
    | { delivery_number?: string | null }[]
    | null;
};

export function embedDeliveryNumber(inv: PartnerRevenueInvoice): string | null {
  const d = inv.deliveries;
  const row = Array.isArray(d) ? d[0] : d;
  const n = row?.delivery_number;
  return n != null && String(n).trim() !== "" ? String(n).trim() : null;
}

export function invoiceExcludedFromRevenue(inv: PartnerRevenueInvoice): boolean {
  const s = (inv.status || "").toLowerCase().trim();
  return s === "cancelled" || s === "archived";
}

export function getInvoicePartnerType(
  inv: PartnerRevenueInvoice,
  orgIdToType: Record<string, string>,
  clientTypeMap: Record<string, string>,
): string {
  if (inv.organization_id && orgIdToType[inv.organization_id]) {
    return orgIdToType[inv.organization_id];
  }
  const name = inv.client_name;
  if (name && clientTypeMap[name]) return clientTypeMap[name];
  return "retail";
}

/** Maps organizations.type (and legacy values) to Finance → Revenue “By Service Type” buckets. */
export type PartnerBreakdownCategory =
  | "retail"
  | "designer"
  | "hospitality"
  | "gallery"
  | "realtor"
  | "b2c";

export function normalizePartnerCategoryForBreakdown(
  raw: string,
): PartnerBreakdownCategory {
  const t = (raw || "").toLowerCase().trim();
  if (t === "b2c") return "b2c";
  if (t === "designer" || t === "interior_designer") return "designer";
  if (t === "gallery" || t === "art_gallery") return "gallery";
  if (t === "hospitality") return "hospitality";
  if (
    t === "realtor" ||
    t === "property_manager" ||
    t === "developer" ||
    t === "developer_builder" ||
    t === "property_management_residential" ||
    t === "property_management_commercial"
  ) {
    return "realtor";
  }
  if (
    t === "retail" ||
    t === "furniture_retailer" ||
    t === "b2b" ||
    t === "cabinetry" ||
    t === "flooring" ||
    t === "antique_dealer" ||
    t === "medical_equipment" ||
    t === "av_technology" ||
    t === "appliances" ||
    t === "hvac"
  ) {
    return "retail";
  }
  return "retail";
}

export function isB2BInvoice(
  inv: PartnerRevenueInvoice,
  orgIdToType: Record<string, string>,
  clientTypeMap: Record<string, string>,
): boolean {
  return getInvoicePartnerType(inv, orgIdToType, clientTypeMap) !== "b2c";
}

/** Partner / B2B logistics invoice channel. */
export function isPartnerChannelInvoice(
  inv: PartnerRevenueInvoice,
  orgIdToType: Record<string, string>,
  clientTypeMap: Record<string, string>,
): boolean {
  if (inv.delivery_id) return true;
  if (embedDeliveryNumber(inv)) return true;
  const num = String(inv.invoice_number || "").trim();
  if (/^DLV-/i.test(num)) return true;
  if (isDeliveryId(num)) return true;
  return isB2BInvoice(inv, orgIdToType, clientTypeMap);
}

export function getInvoiceRevenueDate(inv: PartnerRevenueInvoice): Date {
  const ts = inv.paid_at || inv.created_at;
  return ts ? new Date(ts) : new Date(0);
}

/** Deliveries that have any non-cancelled invoice: use invoice amounts, not delivery row. */
export function deliveryIdsCoveredByAnyInvoice(
  invoices: PartnerRevenueInvoice[],
): Set<string> {
  const s = new Set<string>();
  for (const i of invoices) {
    if (invoiceExcludedFromRevenue(i)) continue;
    if (i.delivery_id) s.add(i.delivery_id);
  }
  return s;
}

export function sumPaidPartnerInvoicesInMonth(
  paidPartnerInvoices: PartnerRevenueInvoice[],
  year: number,
  month: number,
): number {
  let sum = 0;
  for (const inv of paidPartnerInvoices) {
    const d = getInvoiceRevenueDate(inv);
    if (d.getFullYear() === year && d.getMonth() === month) {
      sum += Number(inv.amount ?? 0);
    }
  }
  return sum;
}

type DeliveryRow = Parameters<typeof effectiveDeliveryPrice>[0] & {
  id: string;
  status?: string | null;
  scheduled_date?: string | null;
  created_at?: string | null;
};

const PAID_DLV_STATUSES = new Set(["delivered", "completed"]);

export function partnerDeliveryFallbackInMonth(
  paidDeliveries: DeliveryRow[],
  coveredDeliveryIds: Set<string>,
  year: number,
  month: number,
): number {
  let sum = 0;
  for (const d of paidDeliveries) {
    if (!PAID_DLV_STATUSES.has(String(d.status || "").toLowerCase())) continue;
    if (coveredDeliveryIds.has(d.id)) continue;
    const ts = String(d.scheduled_date || d.created_at || "");
    const dt = ts ? new Date(ts) : new Date(0);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      sum += effectiveDeliveryPrice(d);
    }
  }
  return sum;
}

export function partnerRevenueTotalForMonth(
  allInvoices: PartnerRevenueInvoice[],
  paidInvoices: PartnerRevenueInvoice[],
  paidDeliveries: DeliveryRow[],
  orgIdToType: Record<string, string>,
  clientTypeMap: Record<string, string>,
  year: number,
  month: number,
): number {
  const covered = deliveryIdsCoveredByAnyInvoice(allInvoices);
  const paidPartner = paidInvoices.filter((i) =>
    isPartnerChannelInvoice(i, orgIdToType, clientTypeMap),
  );
  const invPart = sumPaidPartnerInvoicesInMonth(paidPartner, year, month);
  const dlvPart = partnerDeliveryFallbackInMonth(
    paidDeliveries,
    covered,
    year,
    month,
  );
  return invPart + dlvPart;
}

/** All-time partner total: paid partner invoices + delivered jobs with no invoice row (pre-tax). */
export function partnerRevenueLifetime(
  allInvoices: PartnerRevenueInvoice[],
  paidInvoices: PartnerRevenueInvoice[],
  paidDeliveries: DeliveryRow[],
  orgIdToType: Record<string, string>,
  clientTypeMap: Record<string, string>,
): number {
  const covered = deliveryIdsCoveredByAnyInvoice(allInvoices);
  const paidPartner = paidInvoices.filter((i) =>
    isPartnerChannelInvoice(i, orgIdToType, clientTypeMap),
  );
  const invPart = paidPartner.reduce(
    (s, i) => s + Number(i.amount ?? 0),
    0,
  );
  let dlvPart = 0;
  for (const d of paidDeliveries) {
    if (!PAID_DLV_STATUSES.has(String(d.status || "").toLowerCase())) continue;
    if (covered.has(String(d.id))) continue;
    dlvPart += effectiveDeliveryPrice(d);
  }
  return invPart + dlvPart;
}
