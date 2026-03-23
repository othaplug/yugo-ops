import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cfgNum, cfgJson } from "@/lib/pricing/engine";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public widget estimate API.
 * Returns a rough price range (low/high) based on move size, postal codes, and month.
 * Rate-limited to prevent abuse.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limited = rateLimit(`widget-estimate:${ip}`, 20, 60_000);
  if (limited) {
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

  // Base rates by move size (min hours × essential tier labour rate)
  const BASE_RATES: Record<string, number> = {
    studio: 480,
    "1br": 720,
    "2br": 1080,
    "3br": 1620,
    "4br": 2160,
    "5br_plus": 2700,
    partial: 540,
  };

  const base = BASE_RATES[moveSize] || BASE_RATES["2br"]!;

  // Seasonal modifier
  const SEASON_MODS: Record<number, number> = {
    1: 0.88, 2: 0.88, 3: 0.92, 4: 0.95, 5: 1.0, 6: 1.1,
    7: 1.15, 8: 1.15, 9: 1.05, 10: 0.95, 11: 0.9, 12: 0.88,
  };
  const monthNum = month ? parseInt(month, 10) : new Date().getMonth() + 1;
  const seasonMod = SEASON_MODS[monthNum] ?? 1.0;

  // Neighbourhood modifier (rough by FSA prefix)
  const NEIGHBOURHOOD_MOD: Record<string, number> = {
    M2: 1.08, M3: 1.05, M4: 1.05, M5: 1.10, M6: 1.05,
    M7: 1.0, M8: 1.0, M9: 1.0, L6: 1.0, L7: 1.0,
  };
  const fromFsa = (fromPostal || "").slice(0, 2).toUpperCase();
  const neighMod = NEIGHBOURHOOD_MOD[fromFsa] ?? 1.0;

  // Distance estimate from postal codes (rough heuristic)
  const distEstKm = estimateDistance(fromPostal || "", toPostal || "");
  const distMod = distEstKm <= 15 ? 1.0 : distEstKm <= 30 ? 1.08 : distEstKm <= 50 ? 1.15 : 1.22;

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

function estimateDistance(from: string, to: string): number {
  const fsaNumbers: Record<string, number> = {
    M1: 1, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6, M7: 7, M8: 8, M9: 9,
    L4: 10, L5: 11, L6: 12, L7: 13,
  };
  const fromNum = fsaNumbers[(from || "").slice(0, 2).toUpperCase()] ?? 5;
  const toNum = fsaNumbers[(to || "").slice(0, 2).toUpperCase()] ?? 5;
  const diff = Math.abs(fromNum - toNum);
  return Math.max(5, diff * 6);
}
