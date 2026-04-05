import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { moveProjectMorningClientEmailHtml } from "@/lib/email/move-project-emails";

export const dynamic = "force-dynamic";

/**
 * Daily cron: send client “morning of project day” emails for move_project_days.
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

  const { data: days, error } = await supabase
    .from("move_project_days")
    .select("id, date, label, description, project_id, status")
    .eq("date", today)
    .in("status", ["scheduled", "in_progress"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

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
      sent++;
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
      errors.push(`${email}: ${r.error || "send failed"}`);
    }
  }

  return NextResponse.json({ ok: true, date: today, candidates: days?.length ?? 0, sent, errors });
}
