import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { normalizePhone } from "@/lib/phone";
import { generateNextQuoteId } from "@/lib/quotes/quote-id";
import {
  buildSpecialtyCostLines,
  hstOnPrice,
  mergeSpecialtyNonProcessingOverrides,
  SPECIALTY_COST_LINE_OVERRIDE_KEYS,
  weightSurchargeDollars,
  ZONE_FEES,
  ZONE_LABELS,
  VEHICLE_BASE,
  type VehicleType,
  type ZoneTier,
} from "@/lib/specialty-quote/cost-model";

export const dynamic = "force-dynamic";

const VEHICLES = new Set<VehicleType>(["sprinter", "16ft", "26ft"]);
const ZONES = new Set<ZoneTier>(["gta_core", "zone_2", "zone_3", "outside"]);

function cfgNum(rows: { key: string; value: string }[] | null, key: string, fb: number): number {
  const v = rows?.find((r) => r.key === key)?.value;
  return v !== undefined ? Number(v) : fb;
}

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientEmail = String(body.client_email || "").trim().toLowerCase();
  const clientName = String(body.client_name || "").trim();
  const clientPhone = String(body.client_phone || "").trim();
  const fromAddress = String(body.from_address || "").trim();
  const toAddress = String(body.to_address || "").trim();
  const notes = String(body.special_handling_notes || "").trim();
  const itemDescription = String(body.item_description || "").trim();

  if (!clientEmail) {
    return NextResponse.json({ error: "Client email is required" }, { status: 400 });
  }
  if (!clientName) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }
  if (!fromAddress || !toAddress) {
    return NextResponse.json({ error: "Pickup and delivery addresses are required" }, { status: 400 });
  }
  if (notes.length < 4) {
    return NextResponse.json({ error: "Special handling notes are required" }, { status: 400 });
  }
  if (!itemDescription) {
    return NextResponse.json({ error: "Item description is required" }, { status: 400 });
  }

  const weightLbs = Number(body.weight_lbs);
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) {
    return NextResponse.json({ error: "Valid weight (lbs) is required" }, { status: 400 });
  }

  const vehicleType = String(body.vehicle_type || "sprinter") as VehicleType;
  if (!VEHICLES.has(vehicleType)) {
    return NextResponse.json({ error: "Invalid vehicle type" }, { status: 400 });
  }

  const zoneTier = String(body.zone_tier || "gta_core") as ZoneTier;
  if (!ZONES.has(zoneTier)) {
    return NextResponse.json({ error: "Invalid zone" }, { status: 400 });
  }

  const crewCount = Math.max(1, Math.min(8, Number(body.crew_count) || 2));
  const jobHours = Math.max(0.5, Math.min(24, Number(body.job_hours) || 2));
  const totalKm = Math.max(0, Number(body.total_km) || 0);
  const stairFlights = Math.max(0, Math.min(50, Number(body.stair_flights) || 0));
  const wrapLarge = Math.max(0, Number(body.wrap_large_count) || 0);
  const wrapSmall = Math.max(0, Number(body.wrap_small_count) || 0);
  const equipmentKeys = Array.isArray(body.equipment_keys)
    ? (body.equipment_keys as unknown[]).map((x) => String(x))
    : [];

  const zoneFeeOverride =
    body.zone_fee_override != null && body.zone_fee_override !== ""
      ? Number(body.zone_fee_override)
      : null;

  const costInput = {
    crewCount,
    jobHours,
    vehicleType,
    weightLbs,
    totalKm,
    equipmentKeys,
    wrapLargeCount: wrapLarge,
    wrapSmallCount: wrapSmall,
    zoneTier,
    zoneFeeOverride: Number.isFinite(zoneFeeOverride) ? zoneFeeOverride : null,
    stairFlights,
  };

  const built = buildSpecialtyCostLines(costInput);

  let costLineOverrides: Record<string, number> | undefined;
  if (body.cost_line_overrides != null && typeof body.cost_line_overrides === "object" && !Array.isArray(body.cost_line_overrides)) {
    const raw = body.cost_line_overrides as Record<string, unknown>;
    costLineOverrides = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!SPECIALTY_COST_LINE_OVERRIDE_KEYS.has(k)) {
        return NextResponse.json({ error: `Invalid cost line key: ${k}` }, { status: 400 });
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `Invalid amount for ${k}` }, { status: 400 });
      }
      costLineOverrides[k] = n;
    }
    if (Object.keys(costLineOverrides).length === 0) costLineOverrides = undefined;
  }

  const costMerged = mergeSpecialtyNonProcessingOverrides(built, costLineOverrides);
  const effectiveSubtotal = costMerged.subtotal;

  const marginPct = Math.min(50, Math.max(25, Number(body.margin_percent) ?? 40));
  const marginFrac = marginPct / 100;
  const calculatedPrice = effectiveSubtotal / (1 - marginFrac);
  const clientPricePreTax = Math.max(0, Number(body.client_price_pre_tax));
  if (!Number.isFinite(clientPricePreTax) || clientPricePreTax <= 0) {
    return NextResponse.json({ error: "Client price (pre-tax) is required" }, { status: 400 });
  }

  const priceOverride = body.price_override === true;
  const overrideReason = priceOverride ? String(body.override_reason || "").trim() : "";

  if (priceOverride && overrideReason.length < 3) {
    return NextResponse.json({ error: "Override reason is required when overriding price" }, { status: 400 });
  }

  if (clientPricePreTax + 1e-6 < effectiveSubtotal && !priceOverride) {
    return NextResponse.json(
      { error: "Price is below calculated cost — enable override and add a reason, or raise the price" },
      { status: 400 },
    );
  }

  const distanceKm = body.distance_km != null ? Number(body.distance_km) : null;
  const driveTimeMin = body.drive_time_min != null ? Number(body.drive_time_min) : null;
  const moveDate = body.move_date != null && String(body.move_date).trim() ? String(body.move_date).trim() : null;
  const dimensionsText = String(body.dimensions_text || "").trim();

  const sb = createAdminClient();
  const { data: configRows } = await sb.from("platform_config").select("key, value");
  const expiryDays = cfgNum(configRows ?? [], "quote_expiry_days", 7);
  const quoteId = await generateNextQuoteId(sb);

  let contactId: string | null = null;
  const { data: existingC } = await sb
    .from("contacts")
    .select("id")
    .eq("email", clientEmail)
    .limit(1)
    .maybeSingle();
  if (existingC?.id) {
    contactId = existingC.id;
    const p = normalizePhone(clientPhone);
    if (p.length >= 10) {
      await sb.from("contacts").update({ phone: p }).eq("id", existingC.id);
    }
  } else {
    const { data: created } = await sb
      .from("contacts")
      .insert({
        name: clientName,
        email: clientEmail,
        phone: clientPhone || null,
      })
      .select("id")
      .single();
    if (created) contactId = created.id;
  }

  const wSur = weightSurchargeDollars(weightLbs);
  const vBase = VEHICLE_BASE[vehicleType];
  const truckBreakdownLine = `${vehicleType === "sprinter" ? "Sprinter" : vehicleType === "16ft" ? "16 ft" : "26 ft"} $${vBase} + weight $${wSur}`;

  const tax = hstOnPrice(clientPricePreTax);
  const grandTotal = Math.round((clientPricePreTax + tax) * 100) / 100;

  const includes = [
    `Crew of ${crewCount} (specialty transport)`,
    "Protective handling and equipment as specified",
    "Coordinator-confirmed scope and access plan",
  ];

  const factorsApplied: Record<string, unknown> = {
    specialty_b2b_transport: true,
    b2b_full_payment_upfront: true,
    item_description: itemDescription,
    item_category: "specialty_transport",
    specialty_handling_notes: notes,
    specialty_crew_size: crewCount,
    est_job_hours: jobHours,
    specialty_equipment_keys: equipmentKeys,
    specialty_cost_breakdown: costMerged.lines,
    specialty_subtotal: effectiveSubtotal,
    specialty_subtotal_model: costMerged.subtotal_model,
    specialty_cost_line_overrides: costLineOverrides ?? null,
    specialty_margin_percent: marginPct,
    specialty_calculated_price: Math.round(calculatedPrice * 100) / 100,
    specialty_price_override: priceOverride,
    specialty_override_reason: priceOverride ? overrideReason : null,
    specialty_weight_lbs: weightLbs,
    specialty_dimensions_text: dimensionsText || null,
    specialty_zone_tier: zoneTier,
    specialty_zone_label: ZONE_LABELS[zoneTier],
    specialty_zone_fee_applied:
      zoneFeeOverride != null && Number.isFinite(zoneFeeOverride)
        ? zoneFeeOverride
        : ZONE_FEES[zoneTier],
    includes,
    weight_surcharge: wSur,
    truck_breakdown_line: truckBreakdownLine,
    b2b_dimensional: false,
  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const { data: quoteRow, error: insErr } = await sb
    .from("quotes")
    .insert({
      quote_id: quoteId,
      hubspot_deal_id: null,
      contact_id: contactId,
      service_type: "b2b_delivery",
      status: "draft",
      from_address: fromAddress,
      from_access: String(body.from_access || "").trim() || null,
      from_postal: null,
      from_parking: "dedicated",
      to_parking: "dedicated",
      from_long_carry: false,
      to_long_carry: false,
      to_address: toAddress,
      to_access: String(body.to_access || "").trim() || null,
      move_date: moveDate,
      move_size: null,
      distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
      drive_time_min: Number.isFinite(driveTimeMin) ? driveTimeMin : null,
      truck_primary: vehicleType,
      est_crew_size: crewCount,
      est_hours: jobHours,
      custom_price: clientPricePreTax,
      deposit_amount: grandTotal,
      tiers: null,
      factors_applied: factorsApplied,
      specialty_items: [],
      selected_addons: [],
      expires_at: expiresAt.toISOString(),
    })
    .select("id, quote_id")
    .single();

  if (insErr || !quoteRow) {
    return NextResponse.json({ error: insErr?.message || "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    quote_id: quoteRow.quote_id,
    quote_uuid: quoteRow.id,
    grand_total: grandTotal,
    subtotal: effectiveSubtotal,
  });
}
