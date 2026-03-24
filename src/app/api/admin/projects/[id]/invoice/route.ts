import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * POST /api/admin/projects/[id]/invoice
 * Generate a consolidated project invoice. Logs a timeline event.
 * Returns invoice_url (Square link) if configured, otherwise just logs and returns totals.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { data: project, error } = await db
    .from("projects")
    .select("*, organizations:partner_id(name, email, contact_name)")
    .eq("id", id)
    .single();

  if (error || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { subtotal, hst, grandTotal } = body;

  // Log invoice_generated to project timeline
  await db.from("project_timeline").insert({
    project_id: id,
    event_type: "invoice_generated",
    event_description: `Project invoice generated: ${project.project_number}, Total $${grandTotal?.toFixed(2) ?? "0.00"} (incl. HST)`,
  });

  // Update project status to 'invoiced' if it was completed
  if (project.status === "completed") {
    await db.from("projects").update({ status: "invoiced", updated_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({
    ok: true,
    project_number: project.project_number,
    project_name: project.project_name,
    subtotal,
    hst,
    grandTotal,
    invoice_url: null, // Future: integrate Square invoice here
  });
}
