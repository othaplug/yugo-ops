import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { parseItemNameAndQty } from "@/lib/inventory-parse";
import { normalizeDeliveryItem } from "@/lib/delivery-items";

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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  if (jobType === "delivery") {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("*").eq("id", jobId).maybeSingle()
      : await admin.from("deliveries").select("*").ilike("delivery_number", jobId).maybeSingle();

    if (!d) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
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

    return NextResponse.json({
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
    });
  }

  const { data: m } = isUuid
    ? await admin.from("moves").select("*").eq("id", jobId).single()
    : await admin.from("moves").select("*").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();

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

  return NextResponse.json({
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
  });
}
