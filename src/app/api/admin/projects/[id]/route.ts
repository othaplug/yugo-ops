import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { emailLayout } from "@/lib/email-templates";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { projectProposalEmailBody, enrichPhasesWithJobs } from "@/lib/email/project-proposal";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();

  const [
    { data: project, error },
    { data: phases },
    { data: inventory },
    { data: timeline },
    { data: deliveries },
  ] = await Promise.all([
    db.from("projects").select("*, organizations:partner_id(name, type, vertical, email, contact_name)").eq("id", id).single(),
    db.from("project_phases").select("*").eq("project_id", id).order("phase_order"),
    db.from("project_inventory").select("*").eq("project_id", id).order("created_at"),
    db.from("project_timeline").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    db.from("deliveries").select("id, delivery_number, status, scheduled_date, time_slot, delivery_address, total_price, category, items, phase_id, customer_name").eq("project_id", id).order("scheduled_date"),
  ]);

  if (error || !project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...project, phases: phases || [], inventory: inventory || [], timeline: timeline || [], deliveries: deliveries || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  // Fetch current status before updating so we can detect changes
  const { data: current } = await db.from("projects").select("status").eq("id", id).single();
  const previousStatus = current?.status;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = ["project_name", "description", "end_client_name", "end_client_contact", "site_address", "status", "active_phase", "start_date", "target_end_date", "actual_end_date", "estimated_budget", "project_mgmt_fee", "actual_cost", "project_lead", "notes"];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await db.from("projects").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status && body.status !== previousStatus) {
    await db.from("project_timeline").insert({
      project_id: id,
      event_type: "status_change",
      event_description: `Status changed to "${body.status}"`,
      user_id: body.user_id || null,
    });

    if (body.status === "proposed") {
      try {
        const { data: project } = await db
          .from("projects")
          .select("project_name, project_number, estimated_budget, project_mgmt_fee, start_date, target_end_date, site_address, organizations:partner_id(name, email, contact_name)")
          .eq("id", id)
          .single();
        const orgRaw = project?.organizations as unknown;
        const org = Array.isArray(orgRaw) ? (orgRaw[0] as { name: string; email: string | null; contact_name: string | null } | undefined) ?? null : (orgRaw as { name: string; email: string | null; contact_name: string | null } | null);
        if (org?.email && process.env.RESEND_API_KEY) {
          const baseUrl = getEmailBaseUrl();
          const resend = getResend();
          const emailFrom = await getEmailFrom();
          // Enriched proposal: every phase with its install + teardown date.
          const { data: phases } = await db
            .from("project_phases")
            .select("id, phase_name, scheduled_date, address")
            .eq("project_id", id)
            .order("phase_order");
          const { data: jobs } = await db
            .from("deliveries")
            .select("phase_id, scheduled_date")
            .eq("project_id", id);
          const { subject, html: inner } = projectProposalEmailBody({
            project: project ?? {},
            org,
            phases: enrichPhasesWithJobs(phases ?? [], jobs ?? []),
            baseUrl,
          });
          await resend.emails.send({
            from: emailFrom,
            to: org.email,
            subject,
            html: emailLayout(inner, undefined, "partner"),
          });
        }
      } catch (e) {
        console.error("Failed to send proposal email:", e);
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();

  // Unlink deliveries first
  await db.from("deliveries").update({ project_id: null, phase_id: null }).eq("project_id", id);
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
