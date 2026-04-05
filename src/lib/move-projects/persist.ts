import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoveProjectPayload } from "./schema";

type AdminDb = SupabaseClient;

function computeTotalDays(payload: MoveProjectPayload): number {
  if (payload.total_days && payload.total_days > 0) return payload.total_days;
  let n = 0;
  for (const ph of payload.phases) {
    n += ph.days.length;
  }
  return Math.max(1, n);
}

function computeEndDate(payload: MoveProjectPayload, start: string): string | null {
  if (payload.end_date) return payload.end_date;
  const dates: string[] = [];
  for (const ph of payload.phases) {
    for (const d of ph.days) {
      dates.push(d.date);
    }
  }
  if (dates.length === 0) return null;
  dates.sort();
  return dates[dates.length - 1] ?? null;
}

/**
 * Replace phases and days for a move project (full tree sync).
 * Call within a transaction on the caller if needed.
 */
export async function replaceMoveProjectTree(
  db: AdminDb,
  projectId: string,
  payload: MoveProjectPayload,
): Promise<void> {
  const { data: existingDays } = await db.from("move_project_days").select("id").eq("project_id", projectId);
  const { data: existingPhases } = await db.from("move_project_phases").select("id").eq("project_id", projectId);

  if (existingDays?.length) {
    await db.from("move_project_days").delete().eq("project_id", projectId);
  }
  if (existingPhases?.length) {
    await db.from("move_project_phases").delete().eq("project_id", projectId);
  }

  const phaseIdByTemp = new Map<string, string>();

  for (let pi = 0; pi < payload.phases.length; pi++) {
    const ph = payload.phases[pi]!;
    const sortOrder = ph.sort_order ?? pi;
    const { data: insertedPhase, error: pErr } = await db
      .from("move_project_phases")
      .insert({
        project_id: projectId,
        phase_number: ph.phase_number,
        phase_name: ph.phase_name,
        phase_type: ph.phase_type,
        start_date: ph.start_date || null,
        end_date: ph.end_date || null,
        origin_index: ph.origin_index ?? null,
        destination_index: ph.destination_index ?? null,
        description: ph.description ?? null,
        status: ph.status ?? "pending",
        sort_order: sortOrder,
      })
      .select("id")
      .single();

    if (pErr || !insertedPhase) {
      throw new Error(pErr?.message || "Failed to insert phase");
    }

    const phaseId = insertedPhase.id as string;
    if (ph.id) phaseIdByTemp.set(ph.id, phaseId);

    for (const day of ph.days) {
      const { error: dErr } = await db.from("move_project_days").insert({
        project_id: projectId,
        phase_id: phaseId,
        day_number: day.day_number,
        date: day.date,
        day_type: day.day_type,
        label: day.label,
        description: day.description ?? null,
        crew_size: day.crew_size,
        crew_ids: day.crew_ids?.length ? day.crew_ids : null,
        truck_type: day.truck_type ?? null,
        truck_count: day.truck_count,
        estimated_hours: day.estimated_hours ?? null,
        origin_address: day.origin_address ?? null,
        destination_address: day.destination_address ?? null,
        arrival_window: day.arrival_window ?? null,
        start_time: day.start_time || null,
        end_time: day.end_time || null,
        day_cost_estimate: day.day_cost_estimate ?? null,
        status: day.status ?? "scheduled",
        completion_notes: day.completion_notes ?? null,
        issues: day.issues ?? null,
        move_id: day.move_id ?? null,
      });
      if (dErr) throw new Error(dErr.message);
    }
  }
}

export async function upsertMoveProjectForQuote(
  db: AdminDb,
  args: {
    quoteUuid: string;
    contactId: string | null;
    partnerId?: string | null;
    payload: MoveProjectPayload;
    /** When false (preview), skip DB write — caller handles */
    persist: boolean;
  },
): Promise<{ projectId: string | null; skipped: boolean }> {
  const { quoteUuid, contactId, partnerId, payload, persist } = args;
  if (!persist) {
    return { projectId: null, skipped: true };
  }

  const totalDays = computeTotalDays(payload);
  const endDate = computeEndDate(payload, payload.start_date);

  const row = {
    quote_id: quoteUuid,
    contact_id: contactId,
    partner_id: partnerId ?? null,
    project_name: payload.project_name,
    project_type: payload.project_type,
    office_profile: payload.office_profile ?? {},
    multi_home_move_type: payload.multi_home_move_type ?? null,
    start_date: payload.start_date,
    end_date: endDate,
    total_days: totalDays,
    origins: payload.origins,
    destinations: payload.destinations,
    total_price: payload.total_price ?? null,
    deposit: payload.deposit ?? null,
    payment_schedule: payload.payment_schedule ?? [],
    status: payload.status ?? "draft",
    coordinator_id: payload.coordinator_id ?? null,
    coordinator_name: payload.coordinator_name ?? null,
    special_instructions: payload.special_instructions ?? null,
    internal_notes: payload.internal_notes ?? null,
    updated_at: new Date().toISOString(),
  };

  let projectId = payload.id ?? null;
  if (!projectId) {
    const { data: qExisting } = await db.from("quotes").select("move_project_id").eq("id", quoteUuid).maybeSingle();
    const mp = qExisting?.move_project_id as string | undefined;
    if (mp) projectId = mp;
  }

  if (projectId) {
    const { error: uErr } = await db.from("move_projects").update(row).eq("id", projectId);
    if (uErr) throw new Error(uErr.message);
    await replaceMoveProjectTree(db, projectId, payload);
  } else {
    const { data: created, error: cErr } = await db
      .from("move_projects")
      .insert({
        ...row,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (cErr || !created) throw new Error(cErr?.message || "Failed to create move project");
    projectId = created.id as string;
    await replaceMoveProjectTree(db, projectId, payload);
  }

  const { error: qErr } = await db.from("quotes").update({ move_project_id: projectId }).eq("id", quoteUuid);
  if (qErr) throw new Error(qErr.message);

  return { projectId, skipped: false };
}

export async function clearMoveProjectFromQuote(db: AdminDb, quoteUuid: string): Promise<void> {
  const { data: q } = await db.from("quotes").select("move_project_id").eq("id", quoteUuid).maybeSingle();
  const mpId = q?.move_project_id as string | undefined;
  if (!mpId) return;
  await db.from("quotes").update({ move_project_id: null }).eq("id", quoteUuid);
  await db.from("move_projects").delete().eq("id", mpId);
}
