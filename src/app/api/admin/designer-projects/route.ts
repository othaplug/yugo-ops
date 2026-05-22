import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { createDesignerProject } from "@/lib/designer-projects/create";

export async function GET(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const db = createAdminClient();
  const { searchParams } = req.nextUrl;
  const phase = searchParams.get("phase");
  const partnerId = searchParams.get("partner_id");

  let query = db
    .from("projects")
    .select(
      `
      id, project_number, project_name, end_client_name, site_address,
      install_unit, install_floor, install_access, install_access_notes,
      rooms, designer_phase, status, target_end_date, estimated_budget,
      coordinator_name, delivery_job_id, partner_id, created_at,
      organizations:partner_id(name, type),
      project_vendors(id, vendor_name, readiness, sort_order),
      project_inventory(id, item_name, item_status, status, vendor_id)
    `,
    )
    .not("designer_phase", "is", null)
    .order("created_at", { ascending: false });

  if (phase) query = query.eq("designer_phase", phase);
  if (partnerId) query = query.eq("partner_id", partnerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      partnerId,
      projectName,
      endClientName,
      endClientContact,
      siteAddress,
      installUnit,
      installFloor,
      installAccess,
      installAccessNotes,
      rooms,
      targetEndDate,
      estimatedBudget,
      coordinatorId,
      coordinatorName,
      hubspotDealId,
      notes,
    } = body;

    if (!partnerId || !projectName || !siteAddress) {
      return NextResponse.json(
        { error: "partnerId, projectName, and siteAddress are required" },
        { status: 400 },
      );
    }

    const db = createAdminClient();
    const project = await createDesignerProject(
      {
        partnerId,
        projectName,
        endClientName: endClientName || "",
        endClientContact,
        siteAddress,
        installUnit,
        installFloor,
        installAccess,
        installAccessNotes,
        rooms,
        targetEndDate,
        estimatedBudget: estimatedBudget ? Number(estimatedBudget) : undefined,
        coordinatorId,
        coordinatorName,
        hubspotDealId,
        notes,
        createdBy: user?.id,
      },
      db,
    );

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
