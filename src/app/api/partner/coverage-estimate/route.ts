import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { runCoverageDimensionalEstimate } from "@/lib/maps/coverage-estimate";
import type { B2BQuoteLineItem } from "@/lib/pricing/b2b-dimensional";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) {
    return NextResponse.json({ error: "No organization linked" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verticalCode = String(body.vertical_code || "").trim();
  const zoneId = String(body.zone_id || "").trim();
  const handlingType = String(body.handling_type || "threshold").trim();

  const rawItems = body.items;
  const items: B2BQuoteLineItem[] = Array.isArray(rawItems)
    ? rawItems
        .filter((x): x is Record<string, unknown> => x && typeof x === "object")
        .map((x) => ({
          description: String(x.description || "").trim() || "Item",
          quantity: Math.max(1, Number(x.quantity) || 1),
        }))
    : [];

  if (!verticalCode || !zoneId) {
    return NextResponse.json(
      { error: "vertical_code and zone_id are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const result = await runCoverageDimensionalEstimate(admin, {
    partnerOrganizationId: primaryOrgId,
    verticalCode,
    zoneId,
    items,
    uiHandlingType: handlingType,
  });

  if (!result) {
    return NextResponse.json(
      { error: "Pricing unavailable for this zone or vertical" },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
