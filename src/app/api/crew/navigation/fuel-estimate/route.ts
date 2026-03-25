import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { buildFuelConfigMap, resolveNavigationFuelPriceCadPerLitre, NAV_FUEL_KEYS } from "@/lib/routing/fuel-config";
import { fuelLitresForDistanceKm, normalizeCrewTruckType } from "@/lib/routing/truck-profile";

/**
 * POST: persist navigation-based distance and fuel estimates on the move when crew completes a leg.
 * Body: { jobId: uuid, distanceKm: number, truckType?: string }
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { jobId?: string; distanceKm?: number; truckType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const distanceKm = typeof body.distanceKm === "number" && Number.isFinite(body.distanceKm) ? body.distanceKm : NaN;
  if (!jobId || distanceKm <= 0 || distanceKm > 5000) {
    return NextResponse.json({ error: "jobId and valid distanceKm required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: fuelRows } = await admin.from("platform_config").select("key, value").in("key", [...NAV_FUEL_KEYS]);
  const pricePerL = resolveNavigationFuelPriceCadPerLitre(buildFuelConfigMap(fuelRows));

  const { data: move, error } = await admin.from("moves").select("id, crew_id, truck_primary").eq("id", jobId).maybeSingle();
  if (error || !move) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (move.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const truckType = normalizeCrewTruckType(body.truckType ?? (move.truck_primary as string | null));
  const litres = fuelLitresForDistanceKm(truckType, distanceKm);
  const fuelCost = litres * pricePerL;

  const { error: upErr } = await admin
    .from("moves")
    .update({
      actual_distance_km: Math.round(distanceKm * 1000) / 1000,
      estimated_fuel_litres: Math.round(litres * 100) / 100,
      estimated_fuel_cost: Math.round(fuelCost * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (upErr) {
    console.error("[crew/navigation/fuel-estimate]", upErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
