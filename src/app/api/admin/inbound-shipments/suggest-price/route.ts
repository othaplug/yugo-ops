import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestRissdPricing } from "@/lib/rissd-pricing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const {
      delivery_address,
      delivery_access,
      receiving_inspection_tier,
      assembly_complexity,
      estimated_storage_days,
      b2b_weight_category,
      max_item_weight_lbs,
    } = body;

    if (!delivery_address || typeof delivery_address !== "string") {
      return NextResponse.json({ error: "delivery_address required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const breakdown = await suggestRissdPricing(admin, {
      deliveryAddress: delivery_address.trim(),
      deliveryAccess: delivery_access || null,
      receivingInspectionTier: receiving_inspection_tier === "standard" ? "standard" : "detailed",
      assemblyComplexity: assembly_complexity || null,
      estimatedStorageDays: estimated_storage_days ?? 0,
      b2bWeightCategory: b2b_weight_category || null,
      maxItemWeightLbs: max_item_weight_lbs ?? null,
    });

    return NextResponse.json(breakdown);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pricing failed" },
      { status: 500 },
    );
  }
}
