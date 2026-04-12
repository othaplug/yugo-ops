import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { parseItemNameAndQty } from "@/lib/inventory-parse";
import { normalizeDeliveryItem } from "@/lib/delivery-items";
import { buildFuelConfigMap, resolveNavigationFuelPriceCadPerLitre, NAV_FUEL_KEYS } from "@/lib/routing/fuel-config";
import { normalizeCrewTruckType } from "@/lib/routing/truck-profile";
import { CREW_JOB_UUID_RE, normalizeCrewJobId, selectDeliveryByJobId } from "@/lib/resolve-delivery-by-job-id";
import {
  isPreMoveChecklistComplete,
  preMoveChecklistCounts,
} from "@/lib/pre-move-checklist";

const COMPLEXITY_BADGE_LABELS: Record<string, string> = {
  specialty_transport: "Specialty transport",
  heavy_equipment_possible: "Heavy equipment",
  long_carry: "Long carry",
  stairs_heavy: "Stair carry",
};

function complexityBadgeLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string" || !x.trim()) continue;
    const label = COMPLEXITY_BADGE_LABELS[x] ?? null;
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

async function geocodeAddressServer(
  address: string | null | undefined
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address?.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data?.features?.[0]?.center;
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      return { lng: c[0], lat: c[1] };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** GET job detail for crew portal. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const jobType = type === "delivery" ? "delivery" : "move";
  const jobId = id;

  const admin = createAdminClient();
  const { data: fuelCfgRows } = await admin.from("platform_config").select("key, value").in("key", [...NAV_FUEL_KEYS]);
  const fuelPriceCadPerLitre = resolveNavigationFuelPriceCadPerLitre(buildFuelConfigMap(fuelCfgRows));

  const normalizedJobId = normalizeCrewJobId(jobId);
  const isUuid = CREW_JOB_UUID_RE.test(normalizedJobId);

  if (jobType === "delivery") {
    const { data: raw } = await selectDeliveryByJobId(admin, normalizedJobId, "*");

    if (!raw) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const d = raw as any;
    if (d.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const rawItems = Array.isArray(d.items) ? d.items : [];
    const items = rawItems.map((raw: unknown, i: number) => {
      const { name, qty } = normalizeDeliveryItem(raw);
      return { id: `noid-${i}`, item_name: name, quantity: qty };
    });
    const { data: extra } = await admin.from("extra_items").select("id, description, room, quantity, added_at").eq("job_id", d.id).eq("status", "approved").order("added_at");
    const { data: crewRow } = await admin.from("crews").select("id, name, members").eq("id", d.crew_id).single();
    const snapMembers = Array.isArray((d as { assigned_members?: unknown }).assigned_members)
      ? ((d as { assigned_members: string[] }).assigned_members || []).filter((n) => typeof n === "string" && n.trim())
      : [];
    const membersFromCrew = (crewRow?.members as string[] | null) || [];
    const members = snapMembers.length > 0 ? snapMembers : membersFromCrew;
    const crewWithRoles = members.map((name: string, i: number) => ({ name, role: i === 0 ? "Lead" : "Specialist" }));
    const fromAccess = (d as any).pickup_access || (d as any).from_access || null;
    const toAccess = (d as any).delivery_access || (d as any).to_access || null;
    const accessParts = [fromAccess, toAccess].filter(Boolean);
    const access = accessParts.length ? accessParts.join(" -> ") : null;

    // Fetch project context if linked
    let projectContext: { projectName: string; projectNumber: string; phaseName: string | null } | null = null;
    if ((d as any).project_id) {
      const { data: proj } = await admin.from("projects").select("project_number, project_name").eq("id", (d as any).project_id).maybeSingle();
      let phaseName: string | null = null;
      if ((d as any).phase_id) {
        const { data: ph } = await admin.from("project_phases").select("phase_name").eq("id", (d as any).phase_id).maybeSingle();
        phaseName = ph?.phase_name ?? null;
      }
      if (proj) projectContext = { projectNumber: proj.project_number, projectName: proj.project_name, phaseName };
    }

    // Fetch delivery stops for day_rate bookings
    const bookingType = (d as any).booking_type as string | null;
    const { data: stops } = await admin
      .from("delivery_stops")
      .select("id, stop_number, address, customer_name, customer_phone, client_phone, items_description, special_instructions, notes, status, stop_status, stop_type, arrived_at, completed_at")
      .eq("delivery_id", d.id)
      .order("stop_number");

    let fromLat = d.pickup_lat != null ? Number(d.pickup_lat) : null;
    let fromLng = d.pickup_lng != null ? Number(d.pickup_lng) : null;
    let toLat = d.delivery_lat != null ? Number(d.delivery_lat) : null;
    let toLng = d.delivery_lng != null ? Number(d.delivery_lng) : null;
    if ((fromLat == null || fromLng == null) && d.pickup_address?.trim()) {
      const g = await geocodeAddressServer(d.pickup_address);
      if (g) {
        fromLat = g.lat;
        fromLng = g.lng;
      }
    }
    if ((toLat == null || toLng == null) && d.delivery_address?.trim()) {
      const g = await geocodeAddressServer(d.delivery_address);
      if (g) {
        toLat = g.lat;
        toLng = g.lng;
      }
    }

    let serviceType: string | null = null;
    const sourceQuoteId = (d as { source_quote_id?: string | null }).source_quote_id;
    if (sourceQuoteId) {
      const { data: quoteRow } = await admin
        .from("quotes")
        .select("service_type")
        .eq("id", sourceQuoteId)
        .maybeSingle();
      serviceType = (quoteRow?.service_type as string | null) ?? null;
    }

    let partnerVertical: string | null = null;
    const orgId = (d as { organization_id?: string | null }).organization_id;
    if (orgId) {
      const { data: org } = await admin.from("organizations").select("type").eq("id", orgId).maybeSingle();
      partnerVertical = (org?.type as string | null) ?? null;
    }

    return NextResponse.json({
      viewerCrewMemberId: payload.crewMemberId,
      viewerCrewMemberName: payload.name,
      id: d.id,
      jobId: d.delivery_number || d.id,
      jobType: "delivery",
      bookingType,
      status: d.status || "scheduled",
      stopsCompleted: (d as any).stops_completed || 0,
      clientName: `${d.customer_name || ""}${d.client_name ? ` (${d.client_name})` : ""}`.trim() || "-",
      fromAddress: d.pickup_address || "Warehouse",
      toAddress: d.delivery_address || "-",
      fromAccess,
      toAccess,
      accessNotes: (d as any).access_notes || (d as any).instructions || null,
      arrivalWindow: (d as any).delivery_window || (d as any).time_slot || null,
      scheduledDate: (d as any).scheduled_date || null,
      access,
      crewMembers: crewWithRoles,
      jobTypeLabel: bookingType === "day_rate" ? `Day Rate · ${(stops || []).length} stops` : `Delivery · ${rawItems.length} items`,
      itemCount: rawItems.length,
      stops: (stops || []).map((s) => ({
        ...s,
        stop_status: s.stop_status || s.status || "pending",
        stop_type: s.stop_type || "delivery",
      })),
      inventory: [{ room: "Items", items: rawItems, itemsWithId: items }],
      extraItems: extra || [],
      internalNotes: d.instructions || d.next_action || null,
      scheduledTime: d.time_slot || null,
      crewId: d.crew_id,
      projectContext,
      fromLat,
      fromLng,
      toLat,
      toLng,
      truckType: normalizeCrewTruckType((d as { vehicle_type?: string | null }).vehicle_type),
      fuelPriceCadPerLitre,
      serviceType,
      partnerVertical,
    });
  }

  const { data: m } = isUuid
    ? await admin.from("moves").select("*").eq("id", normalizedJobId).single()
    : await admin.from("moves").select("*").ilike("move_code", normalizedJobId.replace(/^#/, "").toUpperCase()).single();

  if (!m || m.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const accessParts = [m.from_access, m.to_access].filter(Boolean);
  const access = accessParts.length ? accessParts.join(" -> ") : null;

  const { data: crewRow } = await admin.from("crews").select("id, name, members").eq("id", m.crew_id).single();
  const members = (crewRow?.members as string[] | null) || [];
  const assignedRaw = Array.isArray(m.assigned_members) ? m.assigned_members : [];
  const assigned =
    assignedRaw.length > 0
      ? assignedRaw.filter((name: unknown): name is string => typeof name === "string" && name.trim().length > 0)
      : members;
  const crewWithRoles = assigned.map((name: string, i: number) => ({ name, role: i === 0 ? "Lead" : "Specialist" }));

  const { data: inv } = await admin.from("move_inventory").select("id, room, item_name").eq("move_id", m.id).order("room");
  const byRoom: Record<string, { id: string; item_name: string; quantity: number }[]> = {};
  for (const row of inv || []) {
    const room = row.room || "Other";
    if (!byRoom[room]) byRoom[room] = [];
    const { baseName, qty } = parseItemNameAndQty(row.item_name || "");
    byRoom[room].push({ id: row.id, item_name: baseName || row.item_name || "", quantity: qty });
  }
  const inventory = Object.entries(byRoom).map(([room, items]) => ({
    room,
    items: items.map((i) => i.item_name),
    itemsWithId: items,
  }));

  const { data: extra } = await admin.from("extra_items").select("id, description, room, quantity, added_at").eq("job_id", m.id).eq("status", "approved").order("added_at");

  let fromLat = m.from_lat != null ? Number(m.from_lat) : null;
  let fromLng = m.from_lng != null ? Number(m.from_lng) : null;
  let toLat = m.to_lat != null ? Number(m.to_lat) : null;
  let toLng = m.to_lng != null ? Number(m.to_lng) : null;
  if ((fromLat == null || fromLng == null) && m.from_address?.trim()) {
    const g = await geocodeAddressServer(m.from_address);
    if (g) {
      fromLat = g.lat;
      fromLng = g.lng;
    }
  }
  if ((toLat == null || toLng == null) && m.to_address?.trim()) {
    const g = await geocodeAddressServer(m.to_address);
    if (g) {
      toLat = g.lat;
      toLng = g.lng;
    }
  }

  const checklistRaw = (m.pre_move_checklist as Record<string, boolean> | null) || {};
  const { done: preMoveChecklistDone, total: preMoveChecklistTotal } =
    preMoveChecklistCounts(checklistRaw);
  const preMoveChecklistAllComplete = isPreMoveChecklistComplete(checklistRaw);

  return NextResponse.json({
    viewerCrewMemberId: payload.crewMemberId,
    viewerCrewMemberName: payload.name,
    id: m.id,
    jobId: m.move_code || m.id,
    jobType: "move",
    moveType: m.move_type || "residential",
    status: m.status || "scheduled",
    clientName: m.client_name || "-",
    fromAddress: m.from_address || "-",
    toAddress: m.to_address || "-",
    fromAccess: m.from_access || null,
    toAccess: m.to_access || null,
    accessNotes: (m as any).access_notes || null,
    arrivalWindow: (m as any).arrival_window || null,
    scheduledDate: (m as any).scheduled_date || null,
    access,
    crewMembers: crewWithRoles,
    jobTypeLabel: m.move_type === "office" ? "Office · Commercial" : "Residential",
    inventory,
    extraItems: extra || [],
    internalNotes: m.internal_notes || m.next_action || null,
    scheduledTime: m.scheduled_time || null,
    crewId: m.crew_id,
    fromLat,
    fromLng,
    toLat,
    toLng,
    truckType: normalizeCrewTruckType(m.truck_primary as string | null),
    fuelPriceCadPerLitre,
    estCrewSize: m.est_crew_size != null ? Number(m.est_crew_size) : null,
    serviceType: (m.service_type as string | null) || (m.move_type as string | null) || null,
    complexityBadges: complexityBadgeLabels(m.complexity_indicators),
    preMoveChecklistDone,
    preMoveChecklistTotal,
    preMoveChecklistAllComplete,
    preMoveChecklistNotifiedAt:
      (m as { pre_move_checklist_notified_at?: string | null }).pre_move_checklist_notified_at ??
      null,
  });
}
