import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import {
  moveProjectMorningClientEmailHtml,
  moveProjectPhaseReminderEmailHtml,
  moveProjectPaymentReminderEmailHtml,
} from "@/lib/email/move-project-emails";

export const dynamic = "force-dynamic";

function addCalendarDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

type MilestoneRow = { milestone?: string; amount?: number; due?: string; paid?: boolean };

/**
 * Daily cron: move project client emails — morning-of day, phase (T−2), payment (T−3 to due).
 * Vercel Cron — protect with CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const baseUrl = getEmailBaseUrl().replace(/\/$/, "");
  const inTwoDays = addCalendarDays(today, 2);
  const inThreeDays = addCalendarDays(today, 3);

  const errors: string[] = [];

  // ── Morning of each project day ─────────────────────────────
  const { data: days, error } = await supabase
    .from("move_project_days")
    .select("id, date, label, description, project_id, status")
    .eq("date", today)
    .in("status", ["scheduled", "in_progress"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let morningSent = 0;

  for (const day of days ?? []) {
    const { data: proj } = await supabase
      .from("move_projects")
      .select("id, project_name, quote_id, project_type")
      .eq("id", day.project_id as string)
      .maybeSingle();
    if (!proj?.quote_id) continue;

    const { data: quote } = await supabase
      .from("quotes")
      .select("id, contact_id")
      .eq("id", proj.quote_id as string)
      .maybeSingle();
    if (!quote?.contact_id) continue;

    const { data: contact } = await supabase
      .from("contacts")
      .select("email, name")
      .eq("id", quote.contact_id as string)
      .maybeSingle();
    if (!contact) continue;
    const email = contact.email?.trim();
    if (!email) continue;

    const { data: move } = await supabase
      .from("moves")
      .select("id, move_code")
      .eq("move_project_id", proj.id)
      .maybeSingle();

    const trackUrl = move?.id
      ? `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${signTrackToken("move", move.id)}`
      : null;

    const variant =
      String(proj.project_type || "").includes("estate") ||
      String(proj.project_type || "").startsWith("residential")
        ? "estate"
        : "standard";

    const html = moveProjectMorningClientEmailHtml({
      clientName: (contact.name as string | null | undefined)?.split(/\s+/)[0] || "there",
      projectName: String(proj.project_name || "Your move project"),
      dayLabel: String(day.label || "Project day"),
      dayDate: String(day.date),
      description: String(day.description || "").trim(),
      trackingUrl: trackUrl,
      variant,
    });

    const r = await sendEmail({
      to: email,
      subject: `Today: ${String(day.label || "Project day")} — ${String(proj.project_name || "Yugo")}`,
      html,
    });

    if (r.success) {
      morningSent++;
      await supabase.from("move_project_communications").insert({
        project_id: proj.id,
        comm_type: "daily_morning_client",
        channel: "email",
        subject: `Today: ${String(day.label || "Project day")}`,
        body_preview: String(day.description || "").slice(0, 200),
        recipient_kind: "client",
        metadata: { move_project_day_id: day.id },
      });
    } else {
      errors.push(`morning ${email}: ${r.error || "send failed"}`);
    }
  }

  // ── Phase start in 2 days ──────────────────────────────────
  let phaseSent = 0;
  const { data: upcomingPhases, error: phErr } = await supabase
    .from("move_project_phases")
    .select("id, project_id, phase_name, start_date")
    .eq("start_date", inTwoDays);

  if (phErr) {
    errors.push(`phase query: ${phErr.message}`);
  } else {
    for (const ph of upcomingPhases ?? []) {
      const { data: proj } = await supabase
        .from("move_projects")
        .select("id, project_name, quote_id, project_type, status")
        .eq("id", ph.project_id as string)
        .maybeSingle();
      if (!proj?.quote_id) continue;
      const st = String(proj.status || "").toLowerCase();
      if (!["confirmed", "in_progress"].includes(st)) continue;

      const { data: prior } = await supabase
        .from("move_project_communications")
        .select("id, metadata")
        .eq("project_id", proj.id)
        .eq("comm_type", "phase_reminder_client");
      const already = (prior ?? []).some(
        (row) => (row.metadata as { phase_id?: string } | null)?.phase_id === ph.id,
      );
      if (already) continue;

      const { data: quote } = await supabase
        .from("quotes")
        .select("contact_id")
        .eq("id", proj.quote_id as string)
        .maybeSingle();
      if (!quote?.contact_id) continue;
      const { data: contact } = await supabase
        .from("contacts")
        .select("email, name")
        .eq("id", quote.contact_id)
        .maybeSingle();
      const email = contact?.email?.trim();
      if (!email) continue;

      const variant =
        String(proj.project_type || "").includes("estate") ||
        String(proj.project_type || "").startsWith("residential")
          ? "estate"
          : "standard";

      const html = moveProjectPhaseReminderEmailHtml({
        clientName: (contact?.name as string | undefined)?.split(/\s+/)[0] || "there",
        projectName: String(proj.project_name || "Your project"),
        phaseName: String(ph.phase_name || "Next phase"),
        phaseStartDate: String(ph.start_date || inTwoDays),
        variant,
      });

      const r = await sendEmail({
        to: email,
        subject: `Coming up: ${String(ph.phase_name || "Phase")} — ${String(proj.project_name || "Yugo")}`,
        html,
      });
      if (r.success) {
        phaseSent++;
        await supabase.from("move_project_communications").insert({
          project_id: proj.id,
          comm_type: "phase_reminder_client",
          channel: "email",
          subject: `Phase reminder: ${String(ph.phase_name || "")}`,
          body_preview: `Starts ${String(ph.start_date)}`,
          recipient_kind: "client",
          metadata: { phase_id: ph.id },
        });
      } else {
        errors.push(`phase ${email}: ${r.error || "send failed"}`);
      }
    }
  }

  // ── Payment milestone due in 3 days ─────────────────────────
  let paymentSent = 0;
  const { data: payProjects, error: payErr } = await supabase
    .from("move_projects")
    .select("id, project_name, quote_id, project_type, payment_schedule, status")
    .in("status", ["confirmed", "in_progress"]);

  if (payErr) {
    errors.push(`payment query: ${payErr.message}`);
  } else {
    for (const proj of payProjects ?? []) {
      const raw = proj.payment_schedule;
      const schedule = Array.isArray(raw) ? (raw as MilestoneRow[]) : [];
      if (schedule.length === 0) continue;

      const { data: priorPay } = await supabase
        .from("move_project_communications")
        .select("id, metadata")
        .eq("project_id", proj.id)
        .eq("comm_type", "payment_reminder_client");

      const milestoneRemindedInRun = new Set<number>();

      for (let i = 0; i < schedule.length; i++) {
        const m = schedule[i];
        if (!m || m.paid === true) continue;
        const due = typeof m.due === "string" ? m.due.trim().slice(0, 10) : "";
        if (!due || due !== inThreeDays) continue;

        const already =
          milestoneRemindedInRun.has(i) ||
          (priorPay ?? []).some(
            (row) => (row.metadata as { milestone_index?: number } | null)?.milestone_index === i,
          );
        if (already) continue;

        if (!proj.quote_id) continue;
        const { data: quote } = await supabase
          .from("quotes")
          .select("contact_id")
          .eq("id", proj.quote_id as string)
          .maybeSingle();
        if (!quote?.contact_id) continue;
        const { data: contact } = await supabase
          .from("contacts")
          .select("email, name")
          .eq("id", quote.contact_id)
          .maybeSingle();
        const email = contact?.email?.trim();
        if (!email) continue;

        const amt = typeof m.amount === "number" && Number.isFinite(m.amount) ? m.amount : 0;
        const variant =
          String(proj.project_type || "").includes("estate") ||
          String(proj.project_type || "").startsWith("residential")
            ? "estate"
            : "standard";

        const html = moveProjectPaymentReminderEmailHtml({
          clientName: (contact?.name as string | undefined)?.split(/\s+/)[0] || "there",
          projectName: String(proj.project_name || "Your project"),
          milestoneLabel: String(m.milestone || "Payment"),
          amount: amt,
          dueDate: due,
          variant,
        });

        const r = await sendEmail({
          to: email,
          subject: `Payment reminder — ${String(proj.project_name || "Yugo")}`,
          html,
        });
        if (r.success) {
          paymentSent++;
          milestoneRemindedInRun.add(i);
          await supabase.from("move_project_communications").insert({
            project_id: proj.id,
            comm_type: "payment_reminder_client",
            channel: "email",
            subject: "Payment milestone reminder",
            body_preview: `${m.milestone || "Payment"} $${amt} due ${due}`,
            recipient_kind: "client",
            metadata: { milestone_index: i, due },
          });
        } else {
          errors.push(`payment ${email}: ${r.error || "send failed"}`);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    morning: { candidates: days?.length ?? 0, sent: morningSent },
    phase: { targetStartDate: inTwoDays, sent: phaseSent },
    payment: { dueInThreeDays: inThreeDays, sent: paymentSent },
    errors,
  });
}
