import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { moveProjectPayloadSchema } from "@/lib/move-projects/schema";
import { replaceMoveProjectTree } from "@/lib/move-projects/persist";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const db = createAdminClient();
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() || "";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 80));

  let q = db
    .from("move_projects")
    .select("id, project_name, project_type, status, start_date, end_date, total_days, quote_id, contact_id, total_price, created_at, updated_at")
    .order("start_date", { ascending: false })
    .limit(limit);

  if (status && status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const db = createAdminClient();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = moveProjectPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const totalDays =
    payload.total_days && payload.total_days > 0
      ? payload.total_days
      : Math.max(
          1,
          payload.phases.reduce((acc, ph) => acc + ph.days.length, 0),
        );

  let endDate = payload.end_date ?? null;
  if (!endDate && payload.phases.length > 0) {
    const dates: string[] = [];
    for (const ph of payload.phases) {
      for (const d of ph.days) dates.push(d.date);
    }
    dates.sort();
    endDate = dates[dates.length - 1] ?? null;
  }

  const row = {
    quote_id: null as string | null,
    contact_id: null as string | null,
    partner_id: (body as { partner_id?: string }).partner_id?.trim() || null,
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
  };

  const quoteUuid = (body as { quote_id?: string }).quote_id?.trim();
  if (quoteUuid) row.quote_id = quoteUuid;

  const contactId = (body as { contact_id?: string }).contact_id?.trim();
  if (contactId) row.contact_id = contactId;

  const { data: created, error: cErr } = await db.from("move_projects").insert(row).select("id").single();
  if (cErr || !created) {
    return NextResponse.json({ error: cErr?.message || "Insert failed" }, { status: 500 });
  }

  const projectId = created.id as string;
  try {
    await replaceMoveProjectTree(db, projectId, payload);
  } catch (e) {
    await db.from("move_projects").delete().eq("id", projectId);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Phase insert failed" }, { status: 500 });
  }

  if (quoteUuid) {
    await db.from("quotes").update({ move_project_id: projectId }).eq("id", quoteUuid);
  }

  return NextResponse.json({ id: projectId });
}
