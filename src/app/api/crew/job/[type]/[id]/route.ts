import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { parseItemNameAndQty } from "@/lib/inventory-parse";

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
      ? await admin.from("deliveries").select("*").eq("id", jobId).single()
      : await admin.from("deliveries").select("*").ilike("delivery_number", jobId).single();
    if (d && d.crew_id === payload.teamId) {
      const rawItems = Array.isArray(d.items) ? d.items : [];
      const items = rawItems.map((name: string, i: number) => {
        const { baseName, qty } = parseItemNameAndQty(name);
        return { id: `noid-${i}`, item_name: baseName || name, quantity: qty };
      });
      const { data: extra } = await admin.from("extra_items").select("id, description, room, quantity, added_at").eq("job_id", d.id).eq("status", "approved").order("added_at");
      const { data: crewRow } = await admin.from("crews").select("id, name, members").eq("id", d.crew_id).single();
      const members = (crewRow?.members as string[] | null) || [];
      const crewWithRoles = members.map((name: string, i: number) => ({ name, role: i === 0 ? "Lead" : "Specialist" }));
      const fromAccess = (d as any).pickup_access || (d as any).from_access || null;
      const toAccess = (d as any).delivery_access || (d as any).to_access || null;
      const accessParts = [fromAccess, toAccess].filter(Boolean);
      const access = accessParts.length ? accessParts.join(" -> ") : null;
      return NextResponse.json({
        id: d.id,
        jobId: d.delivery_number || d.id,
        jobType: "delivery",
        status: d.status || "scheduled",
        clientName: `${d.customer_name || ""}${d.client_name ? ` (${d.client_name})` : ""}`.trim() || "—",
        fromAddress: d.pickup_address || "Warehouse",
        toAddress: d.delivery_address || "—",
        fromAccess,
        toAccess,
        accessNotes: (d as any).access_notes || (d as any).instructions || null,
        arrivalWindow: (d as any).delivery_window || (d as any).time_slot || null,
        scheduledDate: (d as any).scheduled_date || null,
        access,
        crewMembers: crewWithRoles,
        jobTypeLabel: `Delivery · ${rawItems.length} items`,
        itemCount: rawItems.length,
        inventory: [{ room: "Items", items: rawItems, itemsWithId: items }],
        extraItems: extra || [],
        internalNotes: d.instructions || d.next_action || null,
        scheduledTime: d.time_slot || null,
        crewId: d.crew_id,
      });
    }
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
  const assigned = Array.isArray(m.assigned_members) ? m.assigned_members : members;
  const crewWithRoles = assigned.length > 0
    ? assigned.map((name: string, i: number) => ({ name, role: i === 0 ? "Lead" : "Specialist" }))
    : members.map((name: string, i: number) => ({ name, role: i === 0 ? "Lead" : "Specialist" }));

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
    clientName: m.client_name || "—",
    fromAddress: m.from_address || "—",
    toAddress: m.to_address || "—",
    fromAccess: m.from_access || null,
    toAccess: m.to_access || null,
    accessNotes: (m as any).access_notes || null,
    arrivalWindow: (m as any).arrival_window || null,
    scheduledDate: (m as any).scheduled_date || null,
    access,
    crewMembers: crewWithRoles,
    jobTypeLabel: m.move_type === "office" ? "Office · Commercial" : "Premier Residential",
    inventory,
    extraItems: extra || [],
    internalNotes: m.internal_notes || m.next_action || null,
    scheduledTime: m.scheduled_time || null,
    crewId: m.crew_id,
  });
}
