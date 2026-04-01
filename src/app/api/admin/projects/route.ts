import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { emailLayout } from "@/lib/email-templates";
import { Resend } from "resend";
import { getEmailFrom } from "@/lib/email/send";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
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
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
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

  // If status is "proposed", send proposal email to the partner
  if (body.status === "proposed") {
    try {
      const { data: org } = await db
        .from("organizations")
        .select("name, email, contact_name")
        .eq("id", body.partner_id)
        .single();
      if (org?.email && process.env.RESEND_API_KEY) {
        const baseUrl = getEmailBaseUrl();
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailFrom = await getEmailFrom();
        const budget = (body.estimated_budget || 0) + (body.project_mgmt_fee || 0);
        const html = emailLayout(`
          <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">New Project Proposal</div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${body.project_name}</h1>
          <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
            Hi${org.contact_name ? ` ${org.contact_name}` : ""},<br/><br/>
            A new project proposal has been created for <strong style="color:#C9A962">${org.name}</strong>.
            ${budget > 0 ? `The estimated budget is <strong style="color:#C9A962">$${budget.toLocaleString()}</strong>.` : ""}
          </p>
          <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
            Log in to your partner portal to review the details.
          </p>
          <a href="${baseUrl}/partner" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
            View Project
          </a>
        `);
        await resend.emails.send({
          from: emailFrom,
          to: org.email,
          subject: `New Project Proposal: ${body.project_name} (${project.project_number})`,
          html,
        });
      }
    } catch (e) {
      console.error("[project-create] Failed to send proposal email:", e);
    }
  }

  return NextResponse.json(project, { status: 201 });
}
