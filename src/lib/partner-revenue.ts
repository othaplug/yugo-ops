import { isDeliveryId } from "@/lib/delivery-number";
import {
  deliveryPreTaxForAdminList,
  invoicePreTaxForDisplay,
  type DeliveryPriceFields,
} from "@/lib/delivery-pricing";

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
    | (DeliveryPriceFields & { delivery_number?: string | null; scheduled_date?: string | null })
    | (DeliveryPriceFields & { delivery_number?: string | null; scheduled_date?: string | null })[]
    | null;
};

/**
 * Month key ("YYYY-MM") for a date-only or ISO string, taken by substring so a
 * date-only value like "2026-09-01" is never re-parsed through the server's
 * local timezone (which would slide a 1st-of-month job into the previous month
 * on any server behind UTC). Returns "" for empty/invalid input.
 */
export function ymOf(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.length >= 7 ? s.slice(0, 7) : "";
}

/** "YYYY-MM" for a (year, 0-based month) pair, matching ymOf's format. */
export function ymForMonth(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

/**
 * The date an invoice's revenue is recognized ON: the linked delivery's service
 * date when embedded, else when the invoice was raised (created_at). Never
 * paid_at — bucketing by settlement date made revenue jump months the instant a
 * background payment cron flipped an invoice to paid, the same churn the moves
 * total was deliberately moved off of.
 */
function invoiceServiceDateRaw(inv: PartnerRevenueInvoice): string {
  const dRow = Array.isArray(inv.deliveries) ? inv.deliveries[0] : inv.deliveries;
  const svc = (dRow as { scheduled_date?: string | null } | null)?.scheduled_date;
  return String(svc || inv.created_at || "");
}

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
  // Recognize by service date (or when raised) — never paid_at, see
  // invoiceServiceDateRaw. Callers that read .getMonth() on this keep whatever
  // timezone they already used; the monthly aggregates below compare on ymOf
  // instead, which is timezone-stable.
  const ts = invoiceServiceDateRaw(inv);
  return ts ? new Date(ts) : new Date(0);
}

/** Deliveries that have any non-cancelled invoice: use invoice line (delivery-priced when embedded), not delivery row fallback. */
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

/**
 * Deliveries whose revenue is already captured by a PAID invoice. Only these
 * should suppress the delivery-row fallback: a delivered job carrying an unpaid
 * or draft invoice was previously "covered" here yet contributed $0 through the
 * paid-only invoice branch, so its revenue silently disappeared until the
 * invoice settled (and reappeared after) — a load-to-load swing in the total.
 * Covering only on paid invoices keeps every delivered job counted exactly once.
 */
export function deliveryIdsCoveredByPaidInvoice(
  invoices: PartnerRevenueInvoice[],
): Set<string> {
  const s = new Set<string>();
  for (const i of invoices) {
    if ((i.status || "").toLowerCase().trim() !== "paid") continue;
    if (i.delivery_id) s.add(i.delivery_id);
  }
  return s;
}

export function sumPaidPartnerInvoicesInMonth(
  paidPartnerInvoices: PartnerRevenueInvoice[],
  year: number,
  month: number,
): number {
  const targetYm = ymForMonth(year, month);
  let sum = 0;
  for (const inv of paidPartnerInvoices) {
    if (ymOf(invoiceServiceDateRaw(inv)) === targetYm) {
      sum += invoicePreTaxForDisplay(inv);
    }
  }
  return sum;
}

type DeliveryRow = DeliveryPriceFields & {
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
  const targetYm = ymForMonth(year, month);
  let sum = 0;
  for (const d of paidDeliveries) {
    if (!PAID_DLV_STATUSES.has(String(d.status || "").toLowerCase())) continue;
    if (coveredDeliveryIds.has(d.id)) continue;
    if (ymOf(d.scheduled_date || d.created_at) === targetYm) {
      sum += deliveryPreTaxForAdminList(d);
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
  // Suppress the delivery fallback only for deliveries a PAID invoice already
  // counts (see deliveryIdsCoveredByPaidInvoice) — a delivered job with an
  // unpaid/draft invoice still counts via its delivery row, never $0.
  const covered = deliveryIdsCoveredByPaidInvoice(allInvoices);
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
    (s, i) => s + invoicePreTaxForDisplay(i),
    0,
  );
  let dlvPart = 0;
  for (const d of paidDeliveries) {
    if (!PAID_DLV_STATUSES.has(String(d.status || "").toLowerCase())) continue;
    if (covered.has(String(d.id))) continue;
    dlvPart += deliveryPreTaxForAdminList(d);
  }
  return invPart + dlvPart;
}
