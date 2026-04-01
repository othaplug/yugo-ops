import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyAllAdmins } from "@/lib/notifications";
import {
  EQUIPMENT_TRACKING_UNAVAILABLE_CODE,
  EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE,
  isEquipmentRelationUnavailable,
} from "@/lib/supabase-equipment-errors";
import { getTruckIdForCrewTeam } from "@/lib/crew-truck-resolution";

async function resolveEntityId(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  jobType: "move" | "delivery",
): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id").eq("id", jobId).maybeSingle()
      : await admin.from("moves").select("id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).maybeSingle();
    return move?.id || null;
  }
  const { data: delivery } = isUuid
    ? await admin.from("deliveries").select("id").eq("id", jobId).maybeSingle()
    : await admin.from("deliveries").select("id").ilike("delivery_number", jobId).maybeSingle();
  return delivery?.id || null;
}

async function assertTeamOwnsJob(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  jobType: "move" | "delivery",
  teamId: string,
): Promise<boolean> {
  const table = jobType === "move" ? "moves" : "deliveries";
  const { data } = await admin.from(table).select("crew_id").eq("id", entityId).maybeSingle();
  return !!(data && (data as { crew_id: string }).crew_id === teamId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const jobType = (req.nextUrl.searchParams.get("jobType") || "move") as "move" | "delivery";
  const admin = createAdminClient();
  const entityId = await resolveEntityId(admin, jobId, jobType);
  if (!entityId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const owns = await assertTeamOwnsJob(admin, entityId, jobType, payload.teamId);
  if (!owns) return NextResponse.json({ error: "Not your job" }, { status: 403 });

  const { data: existing, error: existingErr } = await admin
    .from("equipment_checks")
    .select("id, skip_reason, skip_notes")
    .eq("job_type", jobType)
    .eq("job_id", entityId)
    .maybeSingle();

  if (existingErr && isEquipmentRelationUnavailable(existingErr.message)) {
    return NextResponse.json({
      code: EQUIPMENT_TRACKING_UNAVAILABLE_CODE,
      truckId: null,
      lines: [],
      check: null,
      message: EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE,
    });
  }

  const truckId = await getTruckIdForCrewTeam(admin, payload.teamId);
  if (!truckId) {
    return NextResponse.json({
      truckId: null,
      lines: [],
      check: existing || null,
      message:
        "No truck resolved for this team. Ask dispatch to (1) register the iPad with a setup code that includes both truck and team, and/or (2) set today’s truck assignment for your team in Platform → Devices.",
    });
  }

  const { data: rows } = await admin
    .from("truck_equipment")
    .select(
      "equipment_id, assigned_quantity, current_quantity, equipment_inventory(name, category, icon, is_consumable, replacement_cost)",
    )
    .eq("truck_id", truckId);

  let lines =
    (rows || []).map((r: Record<string, unknown>) => {
      const inv = r.equipment_inventory as Record<string, unknown> | null;
      return {
        equipment_id: r.equipment_id as string,
        name: (inv?.name as string) || "Item",
        category: (inv?.category as string) || "supplies",
        icon: (inv?.icon as string) || null,
        is_consumable: !!inv?.is_consumable,
        assigned_quantity: Number(r.assigned_quantity) || 0,
        current_quantity: Number(r.current_quantity) || 0,
        replacement_cost: inv?.replacement_cost != null ? Number(inv.replacement_cost) : null,
      };
    }) || [];

  if (lines.length === 0) {
    const { data: inv } = await admin
      .from("equipment_inventory")
      .select("id, name, category, icon, default_quantity, is_consumable, replacement_cost")
      .eq("active", true);
    const inserts = (inv || []).map((e) => ({
      truck_id: truckId,
      equipment_id: e.id,
      assigned_quantity: e.default_quantity,
      current_quantity: e.default_quantity,
    }));
    if (inserts.length) await admin.from("truck_equipment").insert(inserts);
    lines = (inv || []).map((e) => ({
      equipment_id: e.id,
      name: e.name,
      category: e.category,
      icon: e.icon,
      is_consumable: !!e.is_consumable,
      assigned_quantity: e.default_quantity,
      current_quantity: e.default_quantity,
      replacement_cost: e.replacement_cost != null ? Number(e.replacement_cost) : null,
    }));
  }

  return NextResponse.json({ truckId, lines, check: existing || null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json();
  const jobType = (body.jobType || "move") as "move" | "delivery";
  const skipReason = body.skipReason as "labour_only" | "emergency_later" | undefined;
  const skipNotes = (body.skipNotes || "").toString().trim() || null;
  const linesIn = Array.isArray(body.lines) ? body.lines : [];
  const shortageBatchReason = body.shortageBatchReason as
    | "left_at_client"
    | "damaged"
    | "lost"
    | "consumed"
    | undefined;
  const leftAtClientWillRetrieve = body.leftAtClientWillRetrieve === true;

  const admin = createAdminClient();
  const entityId = await resolveEntityId(admin, jobId, jobType);
  if (!entityId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const owns = await assertTeamOwnsJob(admin, entityId, jobType, payload.teamId);
  if (!owns) return NextResponse.json({ error: "Not your job" }, { status: 403 });

  const { data: dup, error: dupErr } = await admin
    .from("equipment_checks")
    .select("id")
    .eq("job_type", jobType)
    .eq("job_id", entityId)
    .maybeSingle();
  if (dupErr && isEquipmentRelationUnavailable(dupErr.message)) {
    return NextResponse.json(
      { code: EQUIPMENT_TRACKING_UNAVAILABLE_CODE, error: EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }
  if (dup) return NextResponse.json({ error: "Equipment check already submitted" }, { status: 400 });

  const truckId = await getTruckIdForCrewTeam(admin, payload.teamId);
  const crewLeadId = payload.crewMemberId || null;

  if (skipReason) {
    const { data: ins, error } = await admin
      .from("equipment_checks")
      .insert({
        job_type: jobType,
        job_id: entityId,
        truck_id: truckId,
        crew_lead_id: crewLeadId,
        skip_reason: skipReason,
        skip_notes: skipNotes,
      })
      .select("id")
      .single();
    if (error) {
      if (isEquipmentRelationUnavailable(error.message)) {
        return NextResponse.json(
          { code: EQUIPMENT_TRACKING_UNAVAILABLE_CODE, error: EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: ins.id, skipped: true });
  }

  if (!truckId) {
    return NextResponse.json(
      {
        error:
          "No truck resolved for this team. Use a setup code with truck + team, or set today’s truck assignment for this team.",
      },
      { status: 400 },
    );
  }

  const { data: teRows } = await admin
    .from("truck_equipment")
    .select("equipment_id, assigned_quantity, current_quantity, equipment_inventory(is_consumable, replacement_cost, name)")
    .eq("truck_id", truckId);

  const byEq = new Map<string, { assigned: number; current: number; consumable: boolean; cost: number; name: string }>();
  for (const r of teRows || []) {
    const raw = r.equipment_inventory as
      | { is_consumable?: boolean; replacement_cost?: number; name?: string }
      | { is_consumable?: boolean; replacement_cost?: number; name?: string }[]
      | null;
    const inv = Array.isArray(raw) ? raw[0] : raw;
    byEq.set(r.equipment_id as string, {
      assigned: Number(r.assigned_quantity) || 0,
      current: Number(r.current_quantity) || 0,
      consumable: !!inv?.is_consumable,
      cost: inv?.replacement_cost != null ? Number(inv.replacement_cost) : 0,
      name: inv?.name || "Item",
    });
  }

  let needsReason = false;
  const incidents: {
    equipment_id: string;
    expected: number;
    actual: number;
    shortage: number;
    cost: number;
    consumable: boolean;
  }[] = [];

  for (const row of linesIn) {
    const eid = row.equipment_id as string;
    const actual = Math.max(0, Math.floor(Number(row.actual_quantity) || 0));
    const meta = byEq.get(eid);
    if (!meta) continue;
    const expected = meta.current;
    const short = expected - actual;
    if (short <= 0) continue;
    if (meta.consumable) {
      if (actual <= 0 && expected > 0) needsReason = true;
    } else {
      needsReason = true;
    }
    incidents.push({
      equipment_id: eid,
      expected,
      actual,
      shortage: short,
      cost: meta.cost * short,
      consumable: meta.consumable,
    });
  }

  if (needsReason && !shortageBatchReason) {
    return NextResponse.json(
      { error: "Select what happened to missing items before submitting.", code: "SHORTAGE_REASON_REQUIRED" },
      { status: 400 },
    );
  }

  const { data: checkRow, error: cErr } = await admin
    .from("equipment_checks")
    .insert({
      job_type: jobType,
      job_id: entityId,
      truck_id: truckId,
      crew_lead_id: crewLeadId,
      shortage_batch_reason: shortageBatchReason || null,
      left_at_client_will_retrieve: leftAtClientWillRetrieve,
    })
    .select("id")
    .single();

  if (cErr || !checkRow) {
    if (cErr && isEquipmentRelationUnavailable(cErr.message)) {
      return NextResponse.json(
        { code: EQUIPMENT_TRACKING_UNAVAILABLE_CODE, error: EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: cErr?.message || "Insert failed" }, { status: 500 });
  }

  const lineInserts: Record<string, unknown>[] = [];
  const nowIso = new Date().toISOString();
  for (const row of linesIn) {
    const eid = row.equipment_id as string;
    const actual = Math.max(0, Math.floor(Number(row.actual_quantity) || 0));
    const meta = byEq.get(eid);
    if (!meta) continue;
    lineInserts.push({
      check_id: checkRow.id,
      equipment_id: eid,
      expected_quantity: meta.current,
      actual_quantity: actual,
    });
    await admin
      .from("truck_equipment")
      .update({
        current_quantity: actual,
        last_checked: nowIso,
        last_checked_by: payload.name || null,
      })
      .eq("truck_id", truckId)
      .eq("equipment_id", eid);
  }

  if (lineInserts.length) {
    await admin.from("equipment_check_lines").insert(lineInserts);
  }

  const moveId = jobType === "move" ? entityId : null;
  const deliveryId = jobType === "delivery" ? entityId : null;

  const reason = (shortageBatchReason || "lost") as "left_at_client" | "damaged" | "lost" | "consumed";

  for (const inc of incidents) {
    if (inc.consumable && !(inc.actual <= 0 && inc.expected > 0)) continue;

    await admin.from("equipment_incidents").insert({
      move_id: moveId,
      delivery_id: deliveryId,
      equipment_check_id: checkRow.id,
      truck_id: truckId,
      crew_lead_id: crewLeadId,
      equipment_id: inc.equipment_id,
      expected_quantity: inc.expected,
      actual_quantity: inc.actual,
      shortage: inc.shortage,
      reason,
      replacement_cost: inc.cost > 0 ? inc.cost : null,
    });
  }

  const nonConsumableShortages = incidents.filter((i) => !i.consumable);
  if (nonConsumableShortages.length) {
    const parts = nonConsumableShortages.map((c) => `${c.shortage}× ${byEq.get(c.equipment_id)?.name}`).join(", ");
    const retrieveNote =
      shortageBatchReason === "left_at_client" && leftAtClientWillRetrieve !== true
        ? " Not returning now to retrieve — coordinate pickup with the client if needed."
        : "";
    await notifyAllAdmins({
      title: `Equipment shortage after job`,
      body: `${jobType === "move" ? "Move" : "Delivery"} ${entityId.slice(0, 8)}… Missing: ${parts}. Reason: ${shortageBatchReason || "—"}. Crew: ${payload.name || "Lead"}.${retrieveNote}`,
      icon: "warning",
      link: jobType === "move" ? `/admin/moves/${entityId}` : `/admin/deliveries/${entityId}`,
      sourceType: "equipment_check",
      sourceId: checkRow.id,
    });
  }

  const lowStock: string[] = [];
  for (const [eid, meta] of byEq) {
    const actual = linesIn.find((l: { equipment_id: string }) => l.equipment_id === eid);
    const newQ = actual != null ? Math.max(0, Math.floor(Number(actual.actual_quantity) || 0)) : meta.current;
    if (newQ < meta.assigned) {
      lowStock.push(`${meta.name}: ${newQ} of ${meta.assigned}`);
    }
  }
  if (lowStock.length) {
    await notifyAllAdmins({
      title: "Truck below minimum equipment",
      body: `Truck needs restock: ${lowStock.slice(0, 6).join("; ")}${lowStock.length > 6 ? "…" : ""}`,
      icon: "package",
      sourceType: "truck_equipment",
      sourceId: truckId,
    });
  }

  return NextResponse.json({ ok: true, id: checkRow.id });
}
