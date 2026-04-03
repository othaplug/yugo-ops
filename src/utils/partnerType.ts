/**
 * Partner category + UI labels (Move vs Delivery vs Referral).
 * Use for any admin/partner-facing copy tied to service type.
 */

import {
  isPropertyManagementDeliveryVertical,
  isReferralHubOrgVertical,
  resolveVertical,
} from "@/lib/partner-type";

export type PartnerCategory = "delivery" | "property_management" | "referral";

/** Minimal shape — works with organizations rows, list DTOs, or invoice joins */
export type PartnerLike = {
  vertical?: string | null;
  type?: string | null;
  partner_type?: string | null;
};

export function getPartnerCategory(partner: PartnerLike): PartnerCategory {
  const v = resolveVertical(String(partner.vertical || partner.type || ""));
  if (isPropertyManagementDeliveryVertical(v)) return "property_management";
  if (partner.partner_type === "referral") return "referral";
  if (isReferralHubOrgVertical(v)) return "referral";
  return "delivery";
}

export type PartnerLabels = {
  serviceUnit: string;
  serviceUnitPlural: string;
  avgMetric: string;
  totalMetric: string;
  recentLabel: string;
  emptyState: string;
  portalDescription: string;
  scheduleAction: string;
  historyLabel: string;
  analyticsTitle: string;
  invoiceType: string;
  /** Lowercase slug for analytics API / charts */
  volumeSeriesName: string;
};

export function getPartnerLabels(category: PartnerCategory): PartnerLabels {
  if (category === "property_management") {
    return {
      serviceUnit: "Move",
      serviceUnitPlural: "Moves",
      avgMetric: "Avg Move Value",
      totalMetric: "Total Moves",
      recentLabel: "Recent Moves",
      emptyState: "No moves yet",
      portalDescription: "view buildings, moves, and schedule tenant relocations",
      scheduleAction: "Schedule Move",
      historyLabel: "Move History",
      analyticsTitle: "Move Analytics",
      invoiceType: "Move",
      volumeSeriesName: "Moves",
    };
  }
  if (category === "referral") {
    return {
      serviceUnit: "Referral",
      serviceUnitPlural: "Referrals",
      avgMetric: "Avg Referral Value",
      totalMetric: "Total Referrals",
      recentLabel: "Recent Referrals",
      emptyState: "No referrals yet",
      portalDescription: "submit referrals, track commissions, and access materials",
      scheduleAction: "Submit Referral",
      historyLabel: "Referral History",
      analyticsTitle: "Referral Analytics",
      invoiceType: "Referral",
      volumeSeriesName: "Referrals",
    };
  }
  return {
    serviceUnit: "Delivery",
    serviceUnitPlural: "Deliveries",
    avgMetric: "Avg Delivery Value",
    totalMetric: "Total Deliveries",
    recentLabel: "Recent Deliveries",
    emptyState: "No deliveries yet",
    portalDescription: "view deliveries and schedule requests",
    scheduleAction: "Schedule Delivery",
    historyLabel: "Delivery History",
    analyticsTitle: "Delivery Analytics",
    invoiceType: "Delivery",
    volumeSeriesName: "Deliveries",
  };
}

export function getPartnerLabelsForPartner(partner: PartnerLike): PartnerLabels {
  return getPartnerLabels(getPartnerCategory(partner));
}

/** Admin invoice row badge: Move vs Delivery vs Referral from org + job link */
export function getInvoiceServiceTypeLabel(inv: {
  move_id?: string | null;
  delivery_id?: string | null;
  organization?: { vertical?: string | null; type?: string | null } | null;
}): string {
  const org = inv.organization;
  const hasOrg = !!(org?.vertical || org?.type);
  if (!hasOrg) {
    if (inv.delivery_id) return getPartnerLabels("delivery").invoiceType;
    if (inv.move_id) return getPartnerLabels("property_management").invoiceType;
    return getPartnerLabels("delivery").invoiceType;
  }
  const cat = getPartnerCategory({
    vertical: org!.vertical ?? org!.type,
    type: org!.type ?? org!.vertical,
  });
  if (cat === "property_management") return getPartnerLabels("property_management").invoiceType;
  if (inv.delivery_id) return getPartnerLabels("delivery").invoiceType;
  if (inv.move_id) return getPartnerLabels("property_management").invoiceType;
  return getPartnerLabels(cat === "referral" ? "referral" : "delivery").invoiceType;
}
