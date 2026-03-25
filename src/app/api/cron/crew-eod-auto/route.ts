import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppTimezone, getLocalClockPartsInAppTimezone, getTodayString } from "@/lib/business-timezone";
import {
  getCrewTeamIdsWithWorkToday,
  resolveCrewLeadIdForTeam,
  upsertEndOfDayReportForTeam,
} from "@/lib/crew/end-of-day-report";

const AUTO_NOTE =
  "[System] End-of-day report auto-generated at 11:50 PM (app timezone) because no report had been submitted for this date.";

/**
 * Vercel Cron: runs every 5 minutes; only acts during 23:50–23:59 in APP_TIMEZONE.
 * Creates an end-of-day report for each crew team that had jobs on the board or tracking
 * activity for the calendar day, if no report exists yet for that team/date.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tz = getAppTimezone();
  const now = new Date();
  const { hour, minute } = getLocalClockPartsInAppTimezone(now, tz);

  if (hour !== 23 || minute < 50) {
    return NextResponse.json({ ok: true, skipped: "outside_2350_window", tz, hour, minute });
  }

  const today = getTodayString(tz);
  const admin = createAdminClient();

  const teamIds = await getCrewTeamIdsWithWorkToday(admin, today);
  const results: { teamId: string; status: string; detail?: string }[] = [];

  for (const teamId of teamIds) {
    const { data: existing } = await admin
      .from("end_of_day_reports")
      .select("id")
      .eq("team_id", teamId)
      .eq("report_date", today)
      .maybeSingle();

    if (existing) {
      results.push({ teamId, status: "skipped", detail: "already_submitted" });
      continue;
    }

    const crewLeadId = await resolveCrewLeadIdForTeam(admin, teamId);
    if (!crewLeadId) {
      results.push({ teamId, status: "skipped", detail: "no_crew_members" });
      continue;
    }

    const res = await upsertEndOfDayReportForTeam(admin, {
      teamId,
      crewLeadId,
      today,
      crewNote: AUTO_NOTE,
      jobNotes: {},
    });

    if (res.ok) {
      results.push({ teamId, status: "created", detail: res.id });
    } else {
      const err = res.error.toLowerCase();
      if (err.includes("duplicate") || err.includes("unique") || err.includes("23505")) {
        results.push({ teamId, status: "skipped", detail: "duplicate_race" });
      } else {
        results.push({ teamId, status: "error", detail: res.error });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    timezone: tz,
    teamsConsidered: teamIds.length,
    results,
  });
}
