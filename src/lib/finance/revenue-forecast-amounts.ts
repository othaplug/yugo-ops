/**
 * Amount helpers for `/api/admin/finance/revenue-forecast`.
 * Aligns with move detail revenue (`final_amount`), `effectiveDeliveryPrice`, and tier rows that use `price` or `total`.
 */

import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
}

export function moveForecastRevenue(m: {
  final_amount?: unknown;
  total_price?: unknown;
  estimate?: unknown;
  amount?: unknown;
  deposit_amount?: unknown;
  balance_amount?: unknown;
}): number {
  if (n(m.final_amount)) return n(m.final_amount);
  if (n(m.total_price)) return n(m.total_price);
  if (n(m.estimate)) return n(m.estimate);
  if (n(m.amount)) return n(m.amount);
  const dep = n(m.deposit_amount);
  const bal = n(m.balance_amount);
  if (dep + bal > 0) return dep + bal;
  return 0;
}

export function deliveryForecastRevenue(d: Parameters<typeof effectiveDeliveryPrice>[0]): number {
  return effectiveDeliveryPrice(d);
}

/**
 * Listed value for an open quote (same spirit as lead-score `extractValue` + coordinator overrides).
 */
export function quotePipelineListedValue(q: {
  custom_price?: unknown;
  override_price?: unknown;
  system_price?: unknown;
  tiers?: unknown;
  essential_price?: unknown;
}): number {
  if (n(q.custom_price)) return n(q.custom_price);
  if (n(q.override_price)) return n(q.override_price);
  if (n(q.system_price)) return n(q.system_price);

  if (q.tiers) {
    try {
      const tiers: Record<string, unknown> =
        typeof q.tiers === "string" ? JSON.parse(q.tiers as string) : (q.tiers as Record<string, unknown>);
      if (tiers && typeof tiers === "object") {
        const tierTotals: number[] = [];
        for (const t of Object.values(tiers)) {
          if (!t || typeof t !== "object") continue;
          const row = t as Record<string, unknown>;
          const v = n(row.total) || n(row.price) || n(row.subtotal);
          if (v > 0) tierTotals.push(v);
        }
        if (tierTotals.length) return Math.max(...tierTotals);
      }
    } catch {
      /* invalid tiers JSON */
    }
  }

  return n(q.essential_price);
}
