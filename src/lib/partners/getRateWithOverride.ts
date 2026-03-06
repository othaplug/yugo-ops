import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Override hierarchy:
 *   1. Check partner_rate_overrides for an explicit per-field override
 *   2. If no override, use template rate × (1 − global_discount_pct / 100)
 *   3. If no template assigned, fall back to the partner's own rate card
 */

export interface RateOverrideResult {
  value: number;
  templateValue: number;
  source: "override" | "template_discounted" | "template" | "rate_card";
  isLocked: boolean;
  overrideId?: string;
}

export async function getRateWithOverride(
  partnerId: string,
  rateTable: string,
  rateRecordId: string,
  field: string,
  templateValue: number
): Promise<RateOverrideResult> {
  const db = createAdminClient();

  // 1. Get partner settings
  const { data: partner } = await db
    .from("organizations")
    .select("template_id, global_discount_pct, pricing_tier")
    .eq("id", partnerId)
    .single();

  if (!partner) {
    return { value: templateValue, templateValue, source: "template", isLocked: false };
  }

  // 2. Check for partner-specific override
  const { data: override } = await db
    .from("partner_rate_overrides")
    .select("id, override_value, is_locked")
    .eq("partner_id", partnerId)
    .eq("rate_table", rateTable)
    .eq("rate_record_id", rateRecordId)
    .eq("override_field", field)
    .maybeSingle();

  if (override) {
    return {
      value: override.override_value,
      templateValue,
      source: "override",
      isLocked: override.is_locked ?? false,
      overrideId: override.id,
    };
  }

  // 3. Apply global discount to template rate
  const discount = partner.global_discount_pct ?? 0;
  if (discount > 0) {
    const discounted = Math.round(templateValue * (1 - discount / 100));
    return { value: discounted, templateValue, source: "template_discounted", isLocked: false };
  }

  return { value: templateValue, templateValue, source: "template", isLocked: false };
}

/**
 * Get all effective rates for a partner, resolving overrides + discounts.
 * Returns a map: { [rateRecordId + '.' + field]: RateOverrideResult }
 */
export async function getAllEffectiveRates(
  partnerId: string,
  templateId: string,
  pricingTier: "standard" | "partner",
  globalDiscount: number
): Promise<{
  dayRates: any[];
  deliveryRates: any[];
  services: any[];
  overages: any[];
  zones: any[];
  volumeBonuses: any[];
  overrides: Record<string, RateOverrideResult>;
}> {
  const db = createAdminClient();

  // Fetch all template rate tables in parallel
  const [dayRatesRes, deliveryRatesRes, servicesRes, overagesRes, zonesRes, volumeRes, overridesRes] =
    await Promise.all([
      db.from("rate_card_day_rates").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
      db.from("rate_card_delivery_rates").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
      db.from("rate_card_services").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
      db.from("rate_card_overages").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
      db.from("rate_card_zones").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
      db.from("rate_card_volume_bonuses").select("*").eq("template_id", templateId),
      db.from("partner_rate_overrides").select("*").eq("partner_id", partnerId),
    ]);

  const overrideMap: Record<string, RateOverrideResult> = {};

  const overridesArr = overridesRes.data || [];
  // Build a quick-lookup by "table:recordId:field"
  const overridesByKey: Record<string, (typeof overridesArr)[0]> = {};
  for (const o of overridesArr) {
    overridesByKey[`${o.rate_table}:${o.rate_record_id}:${o.override_field}`] = o;
  }

  function resolve(table: string, recordId: string, field: string, templateVal: number): RateOverrideResult {
    const key = `${table}:${recordId}:${field}`;
    const o = overridesByKey[key];
    if (o) {
      return { value: o.override_value, templateValue: templateVal, source: "override", isLocked: o.is_locked ?? false, overrideId: o.id };
    }
    if (globalDiscount > 0) {
      return { value: Math.round(templateVal * (1 - globalDiscount / 100)), templateValue: templateVal, source: "template_discounted", isLocked: false };
    }
    return { value: templateVal, templateValue: templateVal, source: "template", isLocked: false };
  }

  // Resolve overrides for numeric fields
  for (const r of dayRatesRes.data || []) {
    overrideMap[`day_rates:${r.id}:full_day_price`] = resolve("day_rates", r.id, "full_day_price", r.full_day_price);
    overrideMap[`day_rates:${r.id}:half_day_price`] = resolve("day_rates", r.id, "half_day_price", r.half_day_price);
  }
  for (const r of deliveryRatesRes.data || []) {
    overrideMap[`delivery_rates:${r.id}:price_min`] = resolve("delivery_rates", r.id, "price_min", r.price_min);
    if (r.price_max != null) overrideMap[`delivery_rates:${r.id}:price_max`] = resolve("delivery_rates", r.id, "price_max", r.price_max);
  }
  for (const r of servicesRes.data || []) {
    overrideMap[`services:${r.id}:price_min`] = resolve("services", r.id, "price_min", r.price_min);
    if (r.price_max != null) overrideMap[`services:${r.id}:price_max`] = resolve("services", r.id, "price_max", r.price_max);
  }
  for (const r of overagesRes.data || []) {
    overrideMap[`overages:${r.id}:price_per_stop`] = resolve("overages", r.id, "price_per_stop", r.price_per_stop);
  }
  for (const r of zonesRes.data || []) {
    if (r.surcharge > 0) overrideMap[`zones:${r.id}:surcharge`] = resolve("zones", r.id, "surcharge", r.surcharge);
  }

  return {
    dayRates: dayRatesRes.data || [],
    deliveryRates: deliveryRatesRes.data || [],
    services: servicesRes.data || [],
    overages: overagesRes.data || [],
    zones: zonesRes.data || [],
    volumeBonuses: volumeRes.data || [],
    overrides: overrideMap,
  };
}
