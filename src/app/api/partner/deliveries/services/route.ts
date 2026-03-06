import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/partner-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveRateCardLookup, applyRateFilter } from "@/lib/partners/calculateDeliveryPrice";

export async function GET(_req: NextRequest) {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ services: [] });

  const db = createAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("pricing_tier")
    .eq("id", primaryOrgId)
    .single();

  const pricingTier = org?.pricing_tier === "partner" ? "partner" : "standard";
  const lookup = await getActiveRateCardLookup(primaryOrgId);

  if (!lookup.rateCardId && !lookup.templateId) return NextResponse.json({ services: [] });

  let svcQuery = db
    .from("rate_card_services")
    .select("service_slug, service_name, price_min, price_max, price_unit")
    .eq("pricing_tier", pricingTier)
    .order("service_slug");
  svcQuery = applyRateFilter(svcQuery, lookup);
  const { data: services } = await svcQuery;

  return NextResponse.json({
    services: (services || []).map((s) => ({
      slug: s.service_slug,
      service_name: s.service_name,
      price_min: s.price_min,
      price_max: s.price_max,
      price_unit: s.price_unit,
    })),
  });
}
