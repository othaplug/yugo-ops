import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

const ALLOWED_TYPES = new Set([
  "renovation",
  "building_upgrade",
  "tenant_turnover",
  "office_buildout",
  "flood_remediation",
  "staging_campaign",
  "lease_up",
  "other",
]);

type UnitInput = {
  unit_number?: string;
  unit_type?: string;
  outbound_date?: string;
  return_date?: string;
};

/** Create a PM renovation / turnover program with optional unit rows. */
export async function POST(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectName = String(body.project_name || "").trim();
  const propertyId = String(body.property_id || "").trim();
  let projectType = String(body.project_type || "renovation").trim();
  const startDate = String(body.start_date || "").slice(0, 10) || null;
  const endDate = String(body.end_date || "").slice(0, 10) || null;
  const units = Array.isArray(body.units) ? (body.units as UnitInput[]) : [];

  if (!projectName) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(projectType)) projectType = "other";

  const { data: contract } = await admin
    .from("partner_contracts")
    .select("id")
    .eq("partner_id", orgId)
    .in("status", ["active", "negotiating", "proposed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!propertyId) {
    return NextResponse.json({ error: "Building is required" }, { status: 400 });
  }

  const { data: prop } = await admin.from("partner_properties").select("id, partner_id").eq("id", propertyId).single();
  if (!prop || prop.partner_id !== orgId) {
    return NextResponse.json({ error: "Invalid building" }, { status: 400 });
  }

  const { data: project, error: insErr } = await admin
    .from("pm_projects")
    .insert({
      partner_id: orgId,
      contract_id: contract?.id ?? null,
      property_id: propertyId,
      project_name: projectName,
      project_type: projectType,
      total_units: units.length || null,
      start_date: startDate,
      end_date: endDate,
      status: "active",
    })
    .select("id")
    .single();

  if (insErr || !project) {
    return NextResponse.json({ error: insErr?.message || "Failed to create project" }, { status: 400 });
  }

  const projectId = project.id as string;

  for (const u of units) {
    const un = String(u.unit_number || "").trim();
    if (!un) continue;
    await admin.from("pm_project_units").insert({
      project_id: projectId,
      unit_number: un,
      unit_type: String(u.unit_type || "").trim() || null,
      outbound_date: String(u.outbound_date || "").slice(0, 10) || null,
      return_date: String(u.return_date || "").slice(0, 10) || null,
      status: "pending",
    });
  }

  return NextResponse.json({ ok: true, project_id: projectId });
}
