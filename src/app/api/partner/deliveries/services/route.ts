import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/partner-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveRateCard } from "@/lib/partners/calculateDeliveryPrice";

export async function GET(_req: NextRequest) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("pricing_tier")
    .eq("id", orgId!)
    .single();

  const pricingTier = org?.pricing_tier === "partner" ? "partner" : "standard";
  const rateCardId = await getActiveRateCard(orgId!);

  if (!rateCardId) return NextResponse.json({ services: [] });

  const { data: services } = await db
    .from("rate_card_services")
    .select("service_slug, service_name, price_min, price_max, price_unit")
    .eq("rate_card_id", rateCardId)
    .eq("pricing_tier", pricingTier)
    .order("service_slug");

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
