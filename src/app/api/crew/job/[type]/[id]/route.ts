import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { parseItemNameAndQty } from "@/lib/inventory-parse";
import { normalizeDeliveryItem } from "@/lib/delivery-items";
import {
  buildFuelConfigMap,
  resolveNavigationFuelPriceCadPerLitre,
  NAV_FUEL_KEYS,
} from "@/lib/routing/fuel-config";
import { normalizeCrewTruckType } from "@/lib/routing/truck-profile";
import {
  CREW_JOB_UUID_RE,
  normalizeCrewJobId,
  selectDeliveryByJobId,
} from "@/lib/resolve-delivery-by-job-id";
import {
  isPreMoveChecklistComplete,
  preMoveChecklistCounts,
} from "@/lib/pre-move-checklist";
import {
  capMarginAlertMinutes,
  estimateDurationFromMoveRow,
} from "@/lib/jobs/duration-estimate";
import { computeOperationalJobAlerts } from "@/lib/jobs/operational-alerts";
import { maybeNotifyOperationalInJobAlerts } from "@/lib/jobs/operational-alert-notifications";
import {
  computeCrewTipReportNeeded,
  type TipReportTipRow,
} from "@/lib/crew/tip-report-eligibility";
import { parseFromToLinesFromAccessNotes } from "@/lib/crew-move-access";

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
  address: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address?.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`;
    const res = await fetch(url);
    const data = await res.json();
    const c = data?.features?.[0]?.center;
    if (
      Array.isArray(c) &&
      typeof c[0] === "number" &&
      typeof c[1] === "number"
    ) {
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
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const jobType = type === "delivery" ? "delivery" : "move";
  const jobId = id;

  const admin = createAdminClient();
  const { data: fuelCfgRows } = await admin
    .from("platform_config")
    .select("key, value")
    .in("key", [...NAV_FUEL_KEYS]);
  const fuelPriceCadPerLitre = resolveNavigationFuelPriceCadPerLitre(
    buildFuelConfigMap(fuelCfgRows),
  );

  const normalizedJobId = normalizeCrewJobId(jobId);
  const isUuid = CREW_JOB_UUID_RE.test(normalizedJobId);

  if (jobType === "delivery") {
    const { data: raw } = await selectDeliveryByJobId(
      admin,
      normalizedJobId,
      "*",
    );

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
    const { data: extra } = await admin
      .from("extra_items")
      .select("id, description, room, quantity, added_at")
      .eq("job_id", d.id)
      .eq("status", "approved")
      .order("added_at");
    const { data: crewRow } = await admin
      .from("crews")
      .select("id, name, members")
      .eq("id", d.crew_id)
      .single();
    const snapMembers = Array.isArray(
      (d as { assigned_members?: unknown }).assigned_members,
    )
      ? ((d as { assigned_members: string[] }).assigned_members || []).filter(
          (n) => typeof n === "string" && n.trim(),
        )
      : [];
    const membersFromCrew = (crewRow?.members as string[] | null) || [];
    const members = snapMembers.length > 0 ? snapMembers : membersFromCrew;
    const crewWithRoles = members.map((name: string, i: number) => ({
      name,
      role: i === 0 ? "Lead" : "Specialist",
    }));
    const fromAccess =
      (d as any).pickup_access || (d as any).from_access || null;
    const toAccess = (d as any).delivery_access || (d as any).to_access || null;
    const accessParts = [fromAccess, toAccess].filter(Boolean);
    const access = accessParts.length ? accessParts.join(" -> ") : null;

    // Fetch project context if linked
    let projectContext: {
      projectName: string;
      projectNumber: string;
      phaseName: string | null;
    } | null = null;
    if ((d as any).project_id) {
      const { data: proj } = await admin
        .from("projects")
        .select("project_number, project_name")
        .eq("id", (d as any).project_id)
        .maybeSingle();
      let phaseName: string | null = null;
      if ((d as any).phase_id) {
        const { data: ph } = await admin
          .from("project_phases")
          .select("phase_name")
          .eq("id", (d as any).phase_id)
          .maybeSingle();
        phaseName = ph?.phase_name ?? null;
      }
      if (proj)
        projectContext = {
          projectNumber: proj.project_number,
          projectName: proj.project_name,
          phaseName,
        };
    }

    // Fetch delivery stops for day_rate bookings
    const bookingType = (d as any).booking_type as string | null;
    const { data: stops } = await admin
      .from("delivery_stops")
      .select(
        "id, stop_number, address, customer_name, customer_phone, client_phone, items_description, special_instructions, notes, status, stop_status, stop_type, arrived_at, completed_at",
      )
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
    const sourceQuoteId = (d as { source_quote_id?: string | null })
      .source_quote_id;
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
    let partnerName: string | null = null;
    let partnerPhone: string | null = null;
    let coordinatorNameOut = "Yugo Operations";
    let coordinatorPhoneOut =
      (process.env.NEXT_PUBLIC_YUGO_PHONE || "").trim() || null;
    if (orgId) {
      const { data: org } = await admin
        .from("organizations")
        .select(
          "type, name, phone, partner_coordinator_name, partner_coordinator_phone",
        )
        .eq("id", orgId)
        .maybeSingle();
      partnerVertical = (org?.type as string | null) ?? null;
      partnerName = (org as { name?: string | null })?.name?.trim() || null;
      partnerPhone = (org as { phone?: string | null })?.phone?.trim() || null;
      const pcName = (
        org as { partner_coordinator_name?: string | null }
      ).partner_coordinator_name?.trim();
      const pcPhone = (
        org as { partner_coordinator_phone?: string | null }
      ).partner_coordinator_phone?.trim();
      if (pcName) coordinatorNameOut = pcName;
      if (pcPhone) coordinatorPhoneOut = pcPhone;
    }

    const estDurD = (d as { estimated_duration_minutes?: number | null })
      .estimated_duration_minutes;
    const marginD = (d as { margin_alert_minutes?: number | null })
      .margin_alert_minutes;

    let deliveryEstMin =
      estDurD != null && Number.isFinite(Number(estDurD)) && Number(estDurD) > 0
        ? Number(estDurD)
        : null;
    let deliveryMarginMin =
      marginD != null && Number.isFinite(Number(marginD)) && Number(marginD) > 0
        ? Number(marginD)
        : null;
    if (deliveryEstMin == null || deliveryEstMin <= 0) {
      const n = rawItems.length;
      deliveryEstMin = Math.max(45, Math.min(600, 30 + n * 20));
      deliveryMarginMin = Math.round(deliveryEstMin * 1.12);
    } else if (deliveryMarginMin == null || deliveryMarginMin <= 0) {
      deliveryMarginMin = deliveryEstMin;
    }
    if (
      deliveryEstMin != null &&
      deliveryEstMin > 0 &&
      deliveryMarginMin != null
    ) {
      deliveryMarginMin = capMarginAlertMinutes(
        deliveryEstMin,
        deliveryMarginMin,
      );
    }

    const { data: delTrack } = await admin
      .from("tracking_sessions")
      .select("status, started_at")
      .eq("job_id", d.id)
      .eq("job_type", "delivery")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let delElapsedMin: number | null = null;
    if (delTrack?.started_at) {
      delElapsedMin =
        (Date.now() - new Date(String(delTrack.started_at)).getTime()) / 60000;
    }
    const delGross = Number(
      (d as { total_price?: number; quoted_price?: number }).total_price ??
        (d as { quoted_price?: number }).quoted_price ??
        0,
    );
    const delIntCost = (d as { estimated_internal_cost?: number | null })
      .estimated_internal_cost;
    const delCost =
      delIntCost != null && Number.isFinite(Number(delIntCost))
        ? Number(delIntCost)
        : null;

    const deliveryOperationalAlerts = computeOperationalJobAlerts({
      jobType: "delivery",
      grossRevenue: delGross,
      estimatedInternalCost: delCost,
      allocatedMinutes: deliveryEstMin,
      elapsedMinutes: delElapsedMin,
      trackingStatus: delTrack?.status ? String(delTrack.status) : null,
    });

    const deliveryClientLabel =
      `${d.customer_name || ""}${d.client_name ? ` (${d.client_name})` : ""}`.trim() ||
      "Customer";
    void maybeNotifyOperationalInJobAlerts({
      jobType: "delivery",
      jobId: d.id,
      clientLabel: deliveryClientLabel,
      alerts: deliveryOperationalAlerts,
    });

    let tipReportNeeded = false;
    const dst = String(d.status || "").toLowerCase();
    if (["delivered", "completed", "done"].includes(dst)) {
      const { data: tipRow } = await admin
        .from("tips")
        .select("square_payment_id, amount, method, reported_by")
        .eq("delivery_id", d.id)
        .maybeSingle();
      tipReportNeeded = computeCrewTipReportNeeded(
        tipRow as TipReportTipRow | null,
      );
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
      clientName:
        `${d.customer_name || ""}${d.client_name ? ` (${d.client_name})` : ""}`.trim() ||
        "-",
      fromAddress: d.pickup_address || "Warehouse",
      toAddress: d.delivery_address || "-",
      fromAccess,
      toAccess,
      accessNotes: (d as any).access_notes || (d as any).instructions || null,
      arrivalWindow: (d as any).delivery_window || (d as any).time_slot || null,
      scheduledDate: (d as any).scheduled_date || null,
      access,
      crewMembers: crewWithRoles,
      jobTypeLabel:
        bookingType === "day_rate"
          ? `Day Rate · ${(stops || []).length} stops`
          : `Delivery · ${rawItems.length} items`,
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
      truckType: normalizeCrewTruckType(
        (d as { vehicle_type?: string | null }).vehicle_type,
      ),
      fuelPriceCadPerLitre,
      serviceType,
      partnerVertical,
      partnerName,
      partnerPhone,
      clientPhone: d.customer_phone || d.contact_phone || null,
      clientEmail: d.customer_email || d.contact_email || null,
      coordinatorName: coordinatorNameOut,
      coordinatorPhone: coordinatorPhoneOut,
      estimatedDurationMinutes: deliveryEstMin,
      marginAlertMinutes: deliveryMarginMin,
      operationalAlerts: deliveryOperationalAlerts,
      tipReportNeeded,
    });
  }

  const { data: m } = isUuid
    ? await admin.from("moves").select("*").eq("id", normalizedJobId).single()
    : await admin
        .from("moves")
        .select("*")
        .ilike("move_code", normalizedJobId.replace(/^#/, "").toUpperCase())
        .single();

  if (!m || m.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const notesParsed = parseFromToLinesFromAccessNotes(
    (m as { access_notes?: string | null }).access_notes,
  );
  let fromAccessOut =
    (m.from_access as string | null | undefined)?.trim() || null;
  let toAccessOut = (m.to_access as string | null | undefined)?.trim() || null;
  if (!fromAccessOut) fromAccessOut = notesParsed.from;
  if (!toAccessOut) toAccessOut = notesParsed.to;
  if ((!fromAccessOut || !toAccessOut) && (m as { quote_id?: string | null }).quote_id) {
    const { data: q } = await admin
      .from("quotes")
      .select("from_access, to_access")
      .eq("id", (m as { quote_id: string }).quote_id)
      .maybeSingle();
    if (q) {
      if (!fromAccessOut) fromAccessOut = (q as { from_access?: string | null }).from_access?.trim() || null;
      if (!toAccessOut) toAccessOut = (q as { to_access?: string | null }).to_access?.trim() || null;
    }
  }
  const accessParts = [fromAccessOut, toAccessOut].filter(Boolean);
  const access = accessParts.length ? accessParts.join(" -> ") : null;

  const { data: crewRow } = await admin
    .from("crews")
    .select("id, name, members")
    .eq("id", m.crew_id)
    .single();
  const members = (crewRow?.members as string[] | null) || [];
  const assignedRaw = Array.isArray(m.assigned_members)
    ? m.assigned_members
    : [];
  const assigned =
    assignedRaw.length > 0
      ? assignedRaw.filter(
          (name: unknown): name is string =>
            typeof name === "string" && name.trim().length > 0,
        )
      : members;
  const crewWithRoles = assigned.map((name: string, i: number) => ({
    name,
    role: i === 0 ? "Lead" : "Specialist",
  }));

  const { data: inv } = await admin
    .from("move_inventory")
    .select("id, room, item_name")
    .eq("move_id", m.id)
    .order("room");
  const byRoom: Record<
    string,
    { id: string; item_name: string; quantity: number }[]
  > = {};
  for (const row of inv || []) {
    const room = row.room || "Other";
    if (!byRoom[room]) byRoom[room] = [];
    const { baseName, qty } = parseItemNameAndQty(row.item_name || "");
    byRoom[room].push({
      id: row.id,
      item_name: baseName || row.item_name || "",
      quantity: qty,
    });
  }
  const inventory = Object.entries(byRoom).map(([room, items]) => ({
    room,
    items: items.map((i) => i.item_name),
    itemsWithId: items,
  }));

  const { data: extra } = await admin
    .from("extra_items")
    .select("id, description, room, quantity, added_at")
    .eq("job_id", m.id)
    .eq("status", "approved")
    .order("added_at");

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

  const checklistRaw =
    (m.pre_move_checklist as Record<string, boolean> | null) || {};
  const { done: preMoveChecklistDone, total: preMoveChecklistTotal } =
    preMoveChecklistCounts(checklistRaw);
  const preMoveChecklistAllComplete = isPreMoveChecklistComplete(checklistRaw);

  const estDurM = (m as { estimated_duration_minutes?: number | null })
    .estimated_duration_minutes;
  const marginM = (m as { margin_alert_minutes?: number | null })
    .margin_alert_minutes;

  let moveEstMin =
    estDurM != null && Number.isFinite(Number(estDurM)) && Number(estDurM) > 0
      ? Number(estDurM)
      : null;
  let moveMarginMin =
    marginM != null && Number.isFinite(Number(marginM)) && Number(marginM) > 0
      ? Number(marginM)
      : null;
  if (moveEstMin == null || moveEstMin <= 0) {
    const eh = (m as { est_hours?: number | null }).est_hours;
    const ehN = typeof eh === "string" ? Number.parseFloat(eh) : Number(eh);
    if (Number.isFinite(ehN) && ehN > 0) {
      moveEstMin = Math.round(ehN * 60);
    }
  }
  if (
    moveEstMin != null &&
    moveEstMin > 0 &&
    (moveMarginMin == null || moveMarginMin <= 0)
  ) {
    moveMarginMin = moveEstMin;
  }
  if (moveEstMin != null && moveEstMin > 0 && moveMarginMin != null) {
    moveMarginMin = capMarginAlertMinutes(moveEstMin, moveMarginMin);
  }

  const { data: moveTrack } = await admin
    .from("tracking_sessions")
    .select("status, started_at")
    .eq("job_id", m.id)
    .eq("job_type", "move")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let moveElapsedMin: number | null = null;
  if (moveTrack?.started_at) {
    moveElapsedMin =
      (Date.now() - new Date(String(moveTrack.started_at)).getTime()) / 60000;
  }
  const moveGross = Number(
    (m as { estimate?: number; amount?: number }).estimate ??
      (m as { amount?: number }).amount ??
      0,
  );
  const moveIntRaw = (m as { estimated_internal_cost?: number | null })
    .estimated_internal_cost;
  let moveIntCost =
    moveIntRaw != null && Number.isFinite(Number(moveIntRaw))
      ? Number(moveIntRaw)
      : null;
  if (moveIntCost == null) {
    const dFallback = estimateDurationFromMoveRow(m as Record<string, unknown>);
    if (dFallback) moveIntCost = dFallback.estimatedCost;
  }

  const operationalAlerts = computeOperationalJobAlerts({
    jobType: "move",
    grossRevenue: moveGross,
    estimatedInternalCost: moveIntCost,
    allocatedMinutes: moveEstMin,
    elapsedMinutes: moveElapsedMin,
    trackingStatus: moveTrack?.status ? String(moveTrack.status) : null,
  });

  void maybeNotifyOperationalInJobAlerts({
    jobType: "move",
    jobId: m.id,
    clientLabel: (m.client_name || "").trim() || "Customer",
    alerts: operationalAlerts,
  });

  let tipReportNeeded = false;
  const mst = String(m.status || "").toLowerCase();
  if (["completed", "done"].includes(mst)) {
    const { data: tipRow } = await admin
      .from("tips")
      .select("square_payment_id, amount, method, reported_by")
      .eq("move_id", m.id)
      .maybeSingle();
    tipReportNeeded = computeCrewTipReportNeeded(
      tipRow as TipReportTipRow | null,
    );
  }

  const orgIdMove =
    (m as { organization_id?: string | null }).organization_id ?? null;
  let partnerName: string | null = null;
  let partnerPhone: string | null = null;
  if (orgIdMove) {
    const { data: orgM } = await admin
      .from("organizations")
      .select("name, phone")
      .eq("id", orgIdMove)
      .maybeSingle();
    partnerName =
      (orgM as { name?: string | null } | null)?.name?.trim() || null;
    partnerPhone =
      (orgM as { phone?: string | null } | null)?.phone?.trim() || null;
  }

  const contractIdMove = (m as { contract_id?: string | null }).contract_id ?? null;
  const isPmMoveRow = !!(contractIdMove && String(contractIdMove).trim()) ||
    !!(m as { is_pm_move?: boolean | null }).is_pm_move;
  const propId = (m as { partner_property_id?: string | null }).partner_property_id;
  let buildingContactName: string | null = null;
  let buildingContactPhone: string | null = null;
  if (propId) {
    const { data: prop } = await admin
      .from("partner_properties")
      .select("building_contact_name, building_contact_phone")
      .eq("id", propId)
      .maybeSingle();
    buildingContactName =
      (prop as { building_contact_name?: string | null } | null)?.building_contact_name?.trim() ||
      null;
    buildingContactPhone =
      (prop as { building_contact_phone?: string | null } | null)?.building_contact_phone?.trim() ||
      null;
  }
  const holdingUnit =
    (m as { holding_unit?: string | null }).holding_unit?.trim() || null;
  const pmPacking = !!(m as { pm_packing_required?: boolean | null }).pm_packing_required;
  const pmReason =
    String(
      (m as { pm_reason_code?: string | null }).pm_reason_code ||
        (m as { pm_move_kind?: string | null }).pm_move_kind ||
        "",
    ).trim() || null;
  const tenantPresent =
    (m as { tenant_present?: boolean | null }).tenant_present !== false;

  return NextResponse.json({
    viewerCrewMemberId: payload.crewMemberId,
    viewerCrewMemberName: payload.name,
    id: m.id,
    jobId: m.move_code || m.id,
    jobType: "move",
    moveType: m.move_type || "residential",
    status: m.status || "scheduled",
    clientName: m.client_name || "-",
    clientPhone: (m.client_phone as string | null | undefined)?.trim() || null,
    clientEmail: (m.client_email as string | null | undefined)?.trim() || null,
    partnerName,
    partnerPhone,
    isPmContractMove: isPmMoveRow,
    pmHoldingUnit: holdingUnit,
    pmReasonCode: pmReason,
    pmPackingRequired: pmPacking,
    tenantPresent,
    buildingContactName,
    buildingContactPhone,
    coordinatorName: "Yugo Operations",
    coordinatorPhone: (process.env.NEXT_PUBLIC_YUGO_PHONE || "").trim() || null,
    fromAddress: m.from_address || "-",
    toAddress: m.to_address || "-",
    fromAccess: fromAccessOut,
    toAccess: toAccessOut,
    accessNotes: (m as any).access_notes || null,
    arrivalWindow: (m as any).arrival_window || null,
    scheduledDate: (m as any).scheduled_date || null,
    access,
    crewMembers: crewWithRoles,
    jobTypeLabel:
      m.move_type === "office" ? "Office · Commercial" : "Residential",
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
    serviceType:
      (m.service_type as string | null) ||
      (m.move_type as string | null) ||
      null,
    complexityBadges: complexityBadgeLabels(m.complexity_indicators),
    preMoveChecklistDone,
    preMoveChecklistTotal,
    preMoveChecklistAllComplete,
    preMoveChecklistNotifiedAt:
      (m as { pre_move_checklist_notified_at?: string | null })
        .pre_move_checklist_notified_at ?? null,
    estimatedDurationMinutes: moveEstMin,
    marginAlertMinutes: moveMarginMin,
    operationalAlerts,
    tipReportNeeded,
  });
}
