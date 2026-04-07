import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  estimateDistanceKmFromPostals,
  widgetEmbedMonthMultiplier,
  WIDGET_RESIDENTIAL_BASE_RATES,
} from "@/lib/pricing/widget-estimate";

/**
 * Public widget estimate API.
 * Returns a rough price range (low/high) based on move size, postal codes, and month.
 * Rate-limited to prevent abuse.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`widget-estimate:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { moveSize, fromPostal, toPostal, month } = body as {
    moveSize?: string;
    fromPostal?: string;
    toPostal?: string;
    month?: string;
  };

  if (!moveSize) {
    return NextResponse.json({ error: "moveSize required" }, { status: 400 });
  }

  const base = WIDGET_RESIDENTIAL_BASE_RATES[moveSize] || WIDGET_RESIDENTIAL_BASE_RATES["2br"]!;

  const monthNum = month ? parseInt(month, 10) : new Date().getMonth() + 1;
  const seasonMod = widgetEmbedMonthMultiplier(monthNum);

  // Neighbourhood modifier (rough by FSA prefix)
  const NEIGHBOURHOOD_MOD: Record<string, number> = {
    M2: 1.08, M3: 1.05, M4: 1.05, M5: 1.10, M6: 1.05,
    M7: 1.0, M8: 1.0, M9: 1.0, L6: 1.0, L7: 1.0,
  };
  const fromFsa = (fromPostal || "").slice(0, 2).toUpperCase();
  const neighMod = NEIGHBOURHOOD_MOD[fromFsa] ?? 1.0;

  const distEstKm = estimateDistanceKmFromPostals(fromPostal || "", toPostal || "");
  const distMod =
    distEstKm <= 5 ? 0.95 : distEstKm <= 20 ? 1.0 : distEstKm <= 40 ? 1.08 : distEstKm <= 60 ? 1.15 : 1.25;

  // Calculate range
  const midpoint = base * seasonMod * neighMod * distMod;
  const low = Math.round(midpoint * 0.80 / 50) * 50;
  const high = Math.round(midpoint * 1.35 / 50) * 50;

  // Log widget lead
  const supabase = createAdminClient();
  await supabase.from("widget_leads").insert({
    move_size: moveSize,
    from_postal: fromPostal || null,
    to_postal: toPostal || null,
    month: month || null,
    low_estimate: low,
    high_estimate: high,
    ip_address: ip,
  }).then(() => {});

  return NextResponse.json({ low, high, moveSize }, {
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
