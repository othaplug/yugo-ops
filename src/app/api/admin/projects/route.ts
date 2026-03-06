import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const db = createAdminClient();
  const status = req.nextUrl.searchParams.get("status");
  const partnerId = req.nextUrl.searchParams.get("partner_id");

  let query = db
    .from("projects")
    .select("*, organizations:partner_id(name, type)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (partnerId) query = query.eq("partner_id", partnerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const db = createAdminClient();
  const body = await req.json();

  // Generate project number PRJ-XXXX based on existing count
  const { count } = await db.from("projects").select("id", { count: "exact", head: true });
  const nextNum = (count ?? 0) + 1;
  const projectNumber = `PRJ-${String(nextNum).padStart(4, "0")}`;

  const { data: project, error } = await db
    .from("projects")
    .insert({
      project_number: projectNumber,
      partner_id: body.partner_id,
      project_name: body.project_name,
      description: body.description || null,
      end_client_name: body.end_client_name || null,
      end_client_contact: body.end_client_contact || null,
      site_address: body.site_address || null,
      status: body.status || "draft",
      start_date: body.start_date || null,
      target_end_date: body.target_end_date || null,
      estimated_budget: body.estimated_budget || null,
      project_mgmt_fee: body.project_mgmt_fee || 0,
      project_lead: body.project_lead || null,
      notes: body.notes || null,
      created_by: body.created_by || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create phases if provided
  if (body.phases?.length) {
    const phasesInsert = body.phases.map((p: { phase_name: string; description?: string; scheduled_date?: string; notes?: string }, i: number) => ({
      project_id: project.id,
      phase_name: p.phase_name,
      description: p.description || null,
      phase_order: i + 1,
      scheduled_date: p.scheduled_date || null,
      notes: p.notes || null,
    }));
    await db.from("project_phases").insert(phasesInsert);
  }

  // Create timeline entry
  await db.from("project_timeline").insert({
    project_id: project.id,
    event_type: "created",
    event_description: `Project "${body.project_name}" created`,
    user_id: body.created_by || null,
  });

  return NextResponse.json(project, { status: 201 });
}
